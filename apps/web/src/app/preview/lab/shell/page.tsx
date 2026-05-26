/**
 * DEV-ONLY harness: renders the real @antagna/ui AppShell with a representative
 * dashboard so the nav + container can be iterated visually (Playwright) without
 * logging in. Not linked anywhere; safe to delete.
 */
import { getTranslations } from 'next-intl/server';
import { AppShell } from '@antagna/ui';
import { LocaleSwitch } from '@/components/LocaleSwitch';
import {
  CardSkin, CARD_BY_ID, type CardId,
  CardGlance, CardEmailTriage, CardSmartSuggestions, CardProjectHealth,
  CardCapacityForecast, CardApprovals, CardStaleConvos, CardTodayShoots,
  CardEquipmentConflicts, CardMTDRevenue,
} from '@/app/dashboard/cards';
import { cardSpanClass, type CardSize } from '@/app/dashboard/cards/utils';

const ITEMS: { id: CardId; size: CardSize; Comp: React.ComponentType<{ size?: CardSize }> }[] = [
  { id: 'glance', size: 'sm', Comp: CardGlance },
  { id: 'email_triage', size: 'md', Comp: CardEmailTriage },
  { id: 'ai_suggestions', size: 'md', Comp: CardSmartSuggestions },
  { id: 'project_health', size: 'lg', Comp: CardProjectHealth },
  { id: 'capacity_fc', size: 'lg', Comp: CardCapacityForecast },
  { id: 'approvals', size: 'md', Comp: CardApprovals },
  { id: 'stale_convos', size: 'md', Comp: CardStaleConvos },
  { id: 'shoots', size: 'md', Comp: CardTodayShoots },
  { id: 'equip_conflicts', size: 'sm', Comp: CardEquipmentConflicts },
  { id: 'mtd_revenue', size: 'sm', Comp: CardMTDRevenue },
];

export default async function ShellHarness() {
  const tNav = await getTranslations('nav');
  const tTop = await getTranslations('topbar');
  const navKeys = ['dashboard', 'projects', 'tasks', 'inbox', 'calendar', 'clients', 'equipment', 'social', 'team', 'kpis', 'reports', 'admin', 'settings', 'groupWork', 'groupAnalytics', 'more', 'sidebar', 'bottomNav'] as const;
  const labels: Record<string, string> = Object.fromEntries(navKeys.map((k) => [k, tNav(k)]));
  labels.newProject = tTop('newProject');
  return (
    <AppShell
      user={{ email: 'mohammed@voltsaudi.com', displayName: 'محمد غريب' }}
      activePath="/dashboard"
      labels={labels}
      localeSwitch={<LocaleSwitch />}
    >
      <h1 className="text-[20px] font-bold" style={{ fontFamily: 'var(--font-display)' }}>اللوحة</h1>
      <div className="grid grid-flow-row-dense grid-cols-12 items-start gap-3 md:grid-flow-row">
        {ITEMS.map(({ id, size, Comp }) => (
          <div key={id} className={cardSpanClass(size)}>
            <CardSkin variant="clean" title={CARD_BY_ID[id]?.titleAr}>
              <Comp size={size} />
            </CardSkin>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
