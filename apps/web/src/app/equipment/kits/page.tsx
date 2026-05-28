import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import {
  PageHeader,
  Card,
  CardHeader,
  StatusPill,
  EmptyState,
} from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { ArrowLeft, Boxes, Plus, X, Package } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { createKit, addKitItem, removeKitItem } from '../actions';

export const dynamic = 'force-dynamic';

const rows = <T,>(r: unknown): T[] => r as unknown as T[];

type Kit = {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string | null;
  description: string | null;
  primaryEqLabel: string | null;
  active: boolean;
};

type KitItemRow = {
  id: string;
  kitId: string;
  equipmentLabel: string;
  quantity: number;
  isMandatory: boolean;
  notes: string | null;
};

type EqOption = { id: string; label: string };

export default async function KitsPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/equipment/kits');

  const [kR, iR, eqR] = await Promise.all([
    db.execute(sql`
      SELECT k.id::text AS id, k.code, k.name_ar AS "nameAr", k.name_en AS "nameEn",
             k.description, k.active,
             (e.code || ' · ' || COALESCE(e.model,'')) AS "primaryEqLabel"
      FROM kits k
      LEFT JOIN equipment e ON e.id = k.primary_equipment_id
      ORDER BY k.code`),
    db.execute(sql`
      SELECT ki.id::text AS id, ki.kit_id::text AS "kitId",
             (e.code || ' · ' || COALESCE(e.model,'')) AS "equipmentLabel",
             ki.quantity, ki.is_mandatory AS "isMandatory", ki.notes
      FROM kit_items ki
      LEFT JOIN equipment e ON e.id = ki.equipment_id
      ORDER BY ki.kit_id, ki.position NULLS LAST, ki.is_mandatory DESC`),
    db.execute(sql`
      SELECT id::text AS id,
             (code || ' · ' || COALESCE(model, category)) AS label
      FROM equipment
      WHERE archived_at IS NULL
      ORDER BY category, code
      LIMIT 200`),
  ]);

  const kits = rows<Kit>(kR);
  const itemsByKit = new Map<string, KitItemRow[]>();
  for (const it of rows<KitItemRow>(iR)) {
    const arr = itemsByKit.get(it.kitId) ?? [];
    arr.push(it);
    itemsByKit.set(it.kitId, arr);
  }
  const eqOptions = rows<EqOption>(eqR);

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/equipment">
      <Link
        href="/equipment"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
      >
        <ArrowLeft size={14} className="rtl:rotate-180" /> المعدات
      </Link>

      <PageHeader
        eyebrow="Kits / Presets"
        title="مجموعات المعدات"
        subtitle="بريسِتات جاهزة لأنواع التصوير (Reel · Studio · Drone…). بناة الـ AI ستقترح أقرب كيت لكل مشروع."
      />

      <Card>
        <CardHeader title="إنشاء كيت جديد" subtitle="ابدأ بالاسم والـ code ثم أضِف العناصر." />
        <form
          action={createKit}
          className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[120px_1fr_1fr_auto]"
        >
          <input
            name="code"
            required
            placeholder="KIT-…"
            dir="ltr"
            className="h-9 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 font-mono text-[12px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
          />
          <input
            name="nameAr"
            required
            placeholder="اسم الكيت (مثلاً: ريل سوشيال)"
            className="h-9 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 text-[12px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
          />
          <select
            name="primaryEquipmentId"
            defaultValue=""
            className="h-9 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-2 text-[12px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
          >
            <option value="">— العنصر الأساسي (اختياري) —</option>
            {eqOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="inline-flex h-9 items-center justify-center rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-black hover:opacity-90"
          >
            <Plus size={14} className="mx-0.5" /> أضف كيت
          </button>
        </form>
      </Card>

      {kits.length === 0 ? (
        <EmptyState
          icon={<Boxes size={20} />}
          title="لا توجد كيتات بعد"
          description="ابدأ بكيت — مثل «ريل سوشيال» — ثم ضع فيه العدسات والإضاءات المعتادة."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {kits.map((k) => {
            const items = itemsByKit.get(k.id) ?? [];
            return (
              <Card key={k.id} padded={false}>
                <div className="flex items-start justify-between gap-3 px-6 pt-6">
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] text-[var(--text-dim)]">{k.code}</p>
                    <p className="text-[15px] font-semibold text-[var(--text)]">{k.nameAr}</p>
                    {k.nameEn && (
                      <p className="text-[11px] text-[var(--text-dim)]">{k.nameEn}</p>
                    )}
                    {k.primaryEqLabel && (
                      <p className="mt-1 inline-flex items-center gap-1 rounded-full border border-[var(--line)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                        <Package size={10} /> {k.primaryEqLabel}
                      </p>
                    )}
                  </div>
                  <StatusPill
                    tone={k.active ? 'success' : 'neutral'}
                    withDot={false}
                  >
                    {k.active ? 'نشط' : 'متوقّف'}
                  </StatusPill>
                </div>

                <ul className="mt-3 divide-y divide-[var(--line)] border-t border-[var(--line)]">
                  {items.length === 0 && (
                    <li className="px-6 py-3 text-[11px] text-[var(--text-dim)]">
                      لا عناصر بعد.
                    </li>
                  )}
                  {items.map((it) => (
                    <li
                      key={it.id}
                      className="flex items-center justify-between gap-3 px-6 py-2 text-[12px]"
                    >
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <span className="font-mono text-[11px] text-[var(--text-muted)]">
                          ×{it.quantity}
                        </span>
                        <span className="truncate text-[var(--text)]">
                          {it.equipmentLabel}
                        </span>
                        {it.isMandatory && (
                          <StatusPill tone="warning" withDot={false}>
                            إلزامي
                          </StatusPill>
                        )}
                      </span>
                      <form action={removeKitItem.bind(null, it.id)}>
                        <button
                          type="submit"
                          className="text-[var(--text-dim)] hover:text-[var(--danger)]"
                          aria-label="حذف"
                        >
                          <X size={12} />
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>

                <form
                  action={addKitItem.bind(null, k.id)}
                  className="grid grid-cols-1 gap-2 border-t border-[var(--line)] bg-[var(--bg-elevated)] p-3 sm:grid-cols-[1fr_60px_auto_auto]"
                >
                  <select
                    name="equipmentId"
                    required
                    defaultValue=""
                    className="h-8 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-[11px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                  >
                    <option value="">— أضف عنصر —</option>
                    {eqOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <input
                    name="quantity"
                    type="number"
                    defaultValue={1}
                    min={1}
                    className="h-8 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 font-mono text-[11px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                  />
                  <label className="inline-flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                    <input type="checkbox" name="mandatory" />
                    إلزامي
                  </label>
                  <button
                    type="submit"
                    className="h-8 rounded-md bg-[var(--accent)] px-3 text-[11px] font-semibold text-black hover:opacity-90"
                  >
                    +
                  </button>
                </form>
              </Card>
            );
          })}
        </div>
      )}
    </Shell>
  );
}
