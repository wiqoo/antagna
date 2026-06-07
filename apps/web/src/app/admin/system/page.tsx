import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { PageHeader } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { requirePermission, canMany } from '@/lib/authz';
import { getCurrentProfile } from '@/lib/view-as';
import { SystemConsole, type TabId } from './console';
import { KeysPanel } from './panels/keys-panel';
import { CostPanel } from './panels/cost-panel';
import { EmailPanel } from './panels/email-panel';
import { WhatsappPanel } from './panels/whatsapp-panel';
import { BrainPanel } from './panels/brain-panel';
import { SettingsPanel } from './panels/settings-panel';
import { SubsPanel } from './panels/subs-panel';
import { getWhatsappSettings } from '@/lib/whatsapp-settings.server';
import { getConnectionState } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

const rows = <T,>(r: unknown): T[] => r as unknown as T[];

const VALID_TABS: TabId[] = ['keys', 'cost', 'email', 'whatsapp', 'brain', 'settings', 'subs'];

/* Env vars probed for presence only — never echoed. */
const ENV_PROBE_KEYS = [
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'RESEND_API_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'DATABASE_URL',
  'VERCEL_TOKEN',
  'VERCEL_PROJECT_ID',
] as const;

function probeEnv() {
  return ENV_PROBE_KEYS.map((name) => {
    const raw = process.env[name];
    const present = typeof raw === 'string' && raw.length > 0;
    return {
      name,
      present,
      // Masked tail only — never the value. Helps confirm the RIGHT key is set.
      tail: present ? raw!.slice(-4) : null,
    };
  });
}

export default async function SystemConsolePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requirePermission('access.manage');
  const me = await getCurrentProfile();

  const sp = await searchParams;
  const tab: TabId = VALID_TABS.includes(sp.tab as TabId) ? (sp.tab as TabId) : 'keys';

  const capsMap = await canMany([
    'integration.manage',
    'ai.manage',
    'memory.manage',
    'settings.update',
  ]);
  const caps = {
    'integration.manage': capsMap['integration.manage'] === true,
    'ai.manage': capsMap['ai.manage'] === true,
    'memory.manage': capsMap['memory.manage'] === true,
    'settings.update': capsMap['settings.update'] === true,
  };

  let panel: React.ReactNode = null;

  if (tab === 'keys') {
    const env = probeEnv();
    const tokensR = await db.execute(sql`
      SELECT id::text AS id, provider, subject, scopes,
             expires_at AS "expiresAt", last_refreshed_at AS "lastRefreshedAt",
             last_refresh_error AS "lastRefreshError", revoked
      FROM oauth_tokens
      ORDER BY provider, subject
    `);
    panel = (
      <KeysPanel
        env={env}
        tokens={rows<{
          id: string;
          provider: string;
          subject: string;
          scopes: string[] | null;
          expiresAt: string | null;
          lastRefreshedAt: string | null;
          lastRefreshError: string | null;
          revoked: boolean;
        }>(tokensR)}
        canManage={caps['integration.manage']}
      />
    );
  } else if (tab === 'cost') {
    const [mtdR, byFeatureR, byModelR, cacheR, limitsR, budgetR] = await Promise.all([
      db.execute(sql`
        SELECT COALESCE(SUM(cost_usd), 0)::float8 AS total
        FROM ai_usage
        WHERE created_at >= date_trunc('month', now())
      `),
      db.execute(sql`
        SELECT feature, COALESCE(SUM(cost_usd), 0)::float8 AS cost,
               COUNT(*)::int AS calls
        FROM ai_usage
        WHERE created_at >= date_trunc('month', now())
        GROUP BY feature ORDER BY cost DESC
      `),
      db.execute(sql`
        SELECT model, COALESCE(SUM(cost_usd), 0)::float8 AS cost,
               COUNT(*)::int AS calls
        FROM ai_usage
        WHERE created_at >= date_trunc('month', now())
        GROUP BY model ORDER BY cost DESC
      `),
      db.execute(sql`
        SELECT COALESCE(SUM(cache_read_tokens), 0)::bigint AS cache_read,
               COALESCE(SUM(cache_write_tokens), 0)::bigint AS cache_write,
               COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens
        FROM ai_usage
        WHERE created_at >= date_trunc('month', now())
      `),
      db.execute(sql`
        SELECT l.user_id::text AS "userId", p.display_name AS name, p.email,
               l.daily_limit_usd::float8 AS "dailyLimitUsd",
               l.monthly_limit_usd::float8 AS "monthlyLimitUsd",
               l.hard_cap AS "hardCap"
        FROM ai_user_limits l
        LEFT JOIN profiles p ON p.id = l.user_id
        ORDER BY p.display_name
      `),
      db.execute(sql`SELECT value FROM system_settings WHERE key = 'ai.monthly_budget_usd'`),
    ]);

    const allUsersR = await db.execute(sql`
      SELECT id::text AS id, display_name AS name, email
      FROM profiles
      WHERE archived_at IS NULL AND status <> 'invited'
      ORDER BY display_name
    `);

    const budgetVal = rows<{ value: unknown }>(budgetR)[0]?.value;
    const monthlyBudget = typeof budgetVal === 'number' ? budgetVal : Number(budgetVal) || 0;

    panel = (
      <CostPanel
        mtdTotal={rows<{ total: number }>(mtdR)[0]?.total ?? 0}
        byFeature={rows<{ feature: string; cost: number; calls: number }>(byFeatureR)}
        byModel={rows<{ model: string; cost: number; calls: number }>(byModelR)}
        cache={rows<{ cache_read: string; cache_write: string; input_tokens: string }>(cacheR)[0] ?? null}
        limits={rows<{
          userId: string; name: string | null; email: string | null;
          dailyLimitUsd: number; monthlyLimitUsd: number; hardCap: boolean;
        }>(limitsR)}
        allUsers={rows<{ id: string; name: string; email: string }>(allUsersR)}
        monthlyBudget={monthlyBudget}
        canManage={caps['ai.manage']}
      />
    );
  } else if (tab === 'email') {
    const [enabledR, syncR, routesR] = await Promise.all([
      db.execute(sql`SELECT value FROM system_settings WHERE key = 'email.inbound_enabled'`),
      db.execute(sql`
        SELECT
          MAX(created_at) FILTER (WHERE status = 'ok') AS "lastOk",
          MAX(created_at) FILTER (WHERE status <> 'ok') AS "lastError",
          COUNT(*) FILTER (WHERE status <> 'ok' AND created_at >= now() - interval '24 hours')::int AS "errors24h",
          (ARRAY_AGG(error_message ORDER BY created_at DESC) FILTER (WHERE status <> 'ok'))[1] AS "lastErrorMsg"
        FROM integration_log
        WHERE provider LIKE 'gmail%' OR provider LIKE 'google%'
      `),
      db.execute(sql`SELECT COUNT(*)::int AS active FROM inbound_email_routes WHERE active = true`),
    ]);

    const enabledVal = rows<{ value: unknown }>(enabledR)[0]?.value;
    panel = (
      <EmailPanel
        inboundEnabled={enabledVal === true}
        sync={rows<{
          lastOk: string | null;
          lastError: string | null;
          errors24h: number;
          lastErrorMsg: string | null;
        }>(syncR)[0] ?? null}
        activeRoutes={rows<{ active: number }>(routesR)[0]?.active ?? 0}
        canManage={caps['integration.manage']}
      />
    );
  } else if (tab === 'whatsapp') {
    const [settings, regR, posR, conn] = await Promise.all([
      getWhatsappSettings(),
      db.execute(sql`
        SELECT display_name AS name, whatsapp_e164 AS e164
        FROM profiles WHERE whatsapp_e164 IS NOT NULL AND whatsapp_e164 <> ''
        ORDER BY display_name`),
      db.execute(sql`SELECT key, name_ar AS "nameAr" FROM positions WHERE active = true ORDER BY position`),
      getConnectionState()
        .then((r) => r.state ?? 'unknown')
        .catch(() => 'unknown' as const),
    ]);
    panel = (
      <WhatsappPanel
        settings={settings}
        registered={rows<{ name: string; e164: string }>(regR)}
        positions={rows<{ key: string; nameAr: string }>(posR)}
        connection={conn as 'open' | 'connecting' | 'close' | 'unknown'}
        canManage={caps['integration.manage']}
      />
    );
  } else if (tab === 'brain') {
    const scopeFilter = '';
    const sourceFilter = '';
    const [chunksR, scopesR, sourcesR, countR] = await Promise.all([
      db.execute(sql`
        SELECT id::text AS id, scope, scope_id::text AS "scopeId", source,
               left(content, 160) AS preview, retrieval_count AS "retrievalCount",
               last_retrieved_at AS "lastRetrievedAt", useful,
               relevance_score::float8 AS "relevanceScore", created_at AS "createdAt"
        FROM ai_memory_chunks
        ORDER BY created_at DESC
        LIMIT 100
      `),
      db.execute(sql`SELECT DISTINCT scope FROM ai_memory_chunks ORDER BY scope`),
      db.execute(sql`SELECT DISTINCT source FROM ai_memory_chunks ORDER BY source`),
      db.execute(sql`
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE retrieval_count = 0 AND created_at < now() - interval '30 days')::int AS prunable
        FROM ai_memory_chunks
      `),
    ]);
    void scopeFilter;
    void sourceFilter;

    panel = (
      <BrainPanel
        chunks={rows<{
          id: string; scope: string; scopeId: string | null; source: string;
          preview: string; retrievalCount: number; lastRetrievedAt: string | null;
          useful: boolean | null; relevanceScore: number | null; createdAt: string;
        }>(chunksR)}
        scopes={rows<{ scope: string }>(scopesR).map((r) => r.scope)}
        sources={rows<{ source: string }>(sourcesR).map((r) => r.source)}
        counts={rows<{ total: number; prunable: number }>(countR)[0] ?? { total: 0, prunable: 0 }}
        canManage={caps['memory.manage']}
      />
    );
  } else if (tab === 'settings') {
    const settingsR = await db.execute(sql`
      SELECT key, value, updated_at AS "updatedAt"
      FROM system_settings
      ORDER BY key
    `);
    panel = (
      <SettingsPanel
        settings={rows<{ key: string; value: unknown; updatedAt: string }>(settingsR)}
        canManage={caps['settings.update']}
      />
    );
  } else if (tab === 'subs') {
    const [subsR, cronR] = await Promise.all([
      db.execute(sql`SELECT value FROM system_settings WHERE key = 'subscriptions'`),
      db.execute(sql`
        SELECT source, MAX(beat_at) AS "lastRun", COUNT(*)::int AS beats
        FROM cron_heartbeat
        GROUP BY source
        ORDER BY source
      `),
    ]);
    const subsVal = rows<{ value: unknown }>(subsR)[0]?.value;
    const subs = Array.isArray(subsVal) ? subsVal : [];
    panel = (
      <SubsPanel
        subscriptions={subs as { vendor: string; plan: string; renews_at: string | null; cost_usd: number }[]}
        cron={rows<{ source: string; lastRun: string | null; beats: number }>(cronR)}
        canManage={caps['settings.update']}
      />
    );
  }

  return (
    <Shell user={{ email: me?.email ?? '' }} activePath="/admin">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
      >
        ← الإدارة
      </Link>

      <PageHeader
        eyebrow="System · Admin console"
        title="وحدة تحكّم النظام"
        subtitle="المفاتيح والتوكنات، حارس تكلفة الـ AI، تكامل البريد، ذاكرة النظام، الإعدادات، والاشتراكات."
      />

      <SystemConsole tab={tab}>{panel}</SystemConsole>
    </Shell>
  );
}
