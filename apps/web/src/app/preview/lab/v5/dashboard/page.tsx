import Link from 'next/link';
import { ArrowLeft, Plus, Sparkles, LayoutGrid, Library } from 'lucide-react';
import {
  CardAIBrief, CardAtRisk, CardHotLeads, CardSmartSuggestions,
  CardEmailTriage, CardNextActions, CardProjectHealth, CardCapacityForecast,
  CardTodayShoots, CardMTDRevenue, CardOpenTasks, CardActivity,
  CardEquipmentBattery, CardAICost, CardEmailSLA, CardAITip,
} from '../cards';

export default function V5Dashboard() {
  return (
    <div className="min-h-screen bg-[#0F0F12] text-white">
      {/* Header strip */}
      <header className="sticky top-0 z-10 border-b border-white/[0.06] bg-[#0F0F12]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-2.5">
          <Link
            href="/preview/lab/v5"
            className="inline-flex items-center gap-1.5 text-[11px] text-white/55 hover:text-white"
          >
            <ArrowLeft size={11} className="rtl:rotate-180" />
            <span className="hidden md:inline">العودة</span>
          </Link>
          <span className="text-white/20">·</span>
          <h1 className="font-mono text-[12px] font-semibold text-white">dashboard</h1>
          <span className="text-[10px] text-white/40">١٦ كرت ظاهر · ١٢ مخفي</span>
          <div className="ms-auto flex items-center gap-2">
            <button className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] px-2.5 py-1 text-[11px] text-white/65 hover:bg-white/[0.04] hover:text-white">
              <Plus size={11} />
              ضيف كرت
            </button>
            <Link
              href="/preview/lab/v5/library"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] px-2.5 py-1 text-[11px] text-white/65 hover:bg-white/[0.04] hover:text-white"
            >
              <Library size={11} />
              المكتبة
            </Link>
            <button className="inline-flex items-center gap-1.5 rounded-md bg-[#FF6B1A] px-2.5 py-1 text-[11px] font-semibold text-black hover:bg-[#FF8442]">
              <LayoutGrid size={11} />
              تخصيص
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] p-4">
        {/* Bento grid */}
        <div className="grid grid-cols-12 gap-3">
          {/* Row 1: Hero AI brief (lg) + key metric (sm) + Email SLA (sm) */}
          <CardAIBrief size="lg" editable />
          <CardMTDRevenue size="sm" editable />
          <CardEmailSLA size="sm" editable />
          <CardAICost size="sm" editable />

          {/* Row 2: At-risk (md) + Next actions (md) + Hot leads (md) */}
          <CardAtRisk size="md" editable />
          <CardNextActions size="md" editable />
          <CardHotLeads size="md" editable />

          {/* Row 3: Project health (lg) + Email triage (md) + Smart suggestions (md) */}
          <CardProjectHealth size="lg" editable />
          <CardEmailTriage size="md" editable />
          <CardSmartSuggestions size="md" editable />

          {/* Row 4: Capacity forecast (lg) + Today's shoots (md) + Open tasks (md) */}
          <CardCapacityForecast size="lg" editable />
          <CardTodayShoots size="md" editable />
          <CardOpenTasks size="md" editable />

          {/* Row 5: AI tip (md) + Activity (md) + Battery (sm) */}
          <CardAITip size="md" editable />
          <CardActivity size="md" editable />
          <CardEquipmentBattery size="sm" editable />
        </div>

        {/* Footer hint */}
        <div className="mt-8 flex items-center justify-between rounded-xl border border-dashed border-white/[0.08] bg-[#17171C] px-4 py-3 text-[11px] text-white/55">
          <div className="flex items-center gap-2">
            <Sparkles size={11} className="text-[#FF6B1A]" />
            <span>هذا مثال — ١٦ كرت من ٢٨. اضغط على "المكتبة" تشوف الكل.</span>
          </div>
          <Link href="/preview/lab/v5/library" className="text-[#FF6B1A] hover:underline">
            تصفّح ٢٨ كرت →
          </Link>
        </div>
      </main>
    </div>
  );
}
