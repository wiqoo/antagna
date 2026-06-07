'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  Sparkles, Loader2, Plus, X, Building2, Film, MapPin,
  Users, ChevronDown, ChevronUp, UserPlus,
} from 'lucide-react';
import { parseBriefRich, parseBriefFromFiles, type ParsedBrief } from './actions';
import { QuickClientModal, type QuickClient } from './quick-client-modal';

type Client = { id: string; code: string; nameAr: string; isAgency?: boolean };
type Profile = { id: string; displayName: string; positionKey: string | null };

type Deliverable = {
  format: string;
  aspect_ratio: string;
  duration_sec: number | null;
};

type Location = {
  city: string;
  venue: string | null;
  permit_required: boolean;
};

type CrewLine = { profile_id: string; role: string };

const PROJECT_TYPES = [
  'shoot', 'edit_only', 'live_coverage', 'content_creation', 'consulting', 'other',
];

const TONE_STYLES = [
  { v: 'cinematic',         l: 'سينمائي'         },
  { v: 'documentary',       l: 'وثائقي'           },
  { v: 'fast-cut-social',   l: 'سوشيال سريع'      },
  { v: 'talking-head',      l: 'لقطة حوار'        },
  { v: 'mixed',             l: 'مختلط'            },
];

const FORMATS = [
  { v: 'reel',  l: 'ريل'        },
  { v: 'short', l: 'فيديو قصير' },
  { v: 'long',  l: 'فيديو طويل' },
  { v: 'photo', l: 'صور'         },
  { v: 'print', l: 'طباعة'       },
];

const ASPECT_RATIOS = ['9:16', '16:9', '1:1', '4:5'];

// Photo/image deliverable types — for these the "duration" column becomes a
// count-of-photos field rather than an average video length.
const PHOTO_FORMATS = ['photo', 'image', 'صور'];

const CREW_ROLES = [
  { v: 'project_manager',   l: 'Project Manager' },
  { v: 'account_manager',   l: 'Account Manager' },
  { v: 'production_manager',l: 'Production Manager' },
  { v: 'shooter_lead',      l: 'Shooter Lead' },
  { v: 'shooter',           l: 'Shooter' },
  { v: 'editor_lead',       l: 'Editor Lead' },
  { v: 'editor',            l: 'Editor' },
  { v: 'colorist',          l: 'Colorist' },
  { v: 'sound_engineer',    l: 'Sound Engineer' },
  { v: 'drone_pilot',       l: 'Drone Pilot' },
  { v: 'talent',            l: 'Talent' },
  { v: 'art_director',      l: 'Art Director' },
  { v: 'stylist',           l: 'Stylist' },
  { v: 'makeup',            l: 'Makeup' },
  { v: 'production_assistant', l: 'Production Assistant' },
];

const ASSET_OPTIONS = [
  'script', 'talent', 'wardrobe', 'vehicles', 'location', 'brand_guidelines',
];

export function IntakeForm({
  clients,
  profiles,
  commitAction,
  canCreateClient = false,
}: {
  clients: Client[];
  profiles: Profile[];
  commitAction: (formData: FormData) => void | Promise<void>;
  canCreateClient?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  // Rolling progress hint while the AI parses (Mohammed's audit: "8s of silence
  // before the wizard jumps" — UX upgrade to a status carousel).
  const PARSE_HINTS = [
    'يقرأ النصّ…',
    'يستخرج العميل والميزانية…',
    'يحلّل التواريخ والمواقع…',
    'يقترح الـ deliverables…',
    'يضع لمسات أخيرة…',
  ];
  const [parseHintIdx, setParseHintIdx] = useState(0);
  useEffect(() => {
    if (!isPending) {
      setParseHintIdx(0);
      return;
    }
    const id = setInterval(() => {
      setParseHintIdx((h) => Math.min(h + 1, PARSE_HINTS.length - 1));
    }, 1500);
    return () => clearInterval(id);
  }, [isPending]);
  const [briefText, setBriefText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [forBrandUnit, setForBrandUnit] = useState('volt_production');
  // Local client list so a quick-added client appears + gets selected without
  // a page reload (the prop is the server snapshot at first render).
  const [clientList, setClientList] = useState<Client[]>(clients);
  const [quickClientOpen, setQuickClientOpen] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedBrief | null>(null);
  const [step, setStep] = useState(0);

  // form state — pre-filled from parsed, but always editable
  const [clientId, setClientId] = useState('');
  const [agencyId, setAgencyId] = useState('');
  const [titleAr, setTitleAr] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [projectType, setProjectType] = useState('shoot');
  const [quoteNumber, setQuoteNumber] = useState('');
  const [objective, setObjective] = useState('');
  const [toneStyle, setToneStyle] = useState('cinematic');
  const [shootStartsAt, setShootStartsAt] = useState('');
  const [shootEndsAt, setShootEndsAt] = useState('');
  const [deliveryDueAt, setDeliveryDueAt] = useState('');
  const [clientAssets, setClientAssets] = useState<string[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [crew, setCrew] = useState<CrewLine[]>([]);
  const [pmId, setPmId] = useState('');
  const [amId, setAmId] = useState('');
  const [productionManagerId, setProductionManagerId] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const brands = clientList.filter((c) => !c.isAgency);
  const agencies = clientList.filter((c) => c.isAgency);

  // A client just created via the quick popup: add it to the list (sorted) and
  // auto-select it into the right dropdown (brand vs agency) so the user keeps
  // flowing through the project form.
  function handleClientCreated(c: QuickClient) {
    const created: Client = { id: c.id, code: c.code, nameAr: c.nameAr, isAgency: c.isAgency };
    setClientList((prev) =>
      [...prev, created].sort((a, b) => a.nameAr.localeCompare(b.nameAr, 'ar')),
    );
    if (c.isAgency) setAgencyId(c.id);
    else setClientId(c.id);
    setQuickClientOpen(false);
  }

  // Manager dropdowns are filtered by position. general_manager is always
  // eligible for any of the three roles; the optional crew picker stays
  // unfiltered (uses the full `profiles` list).
  const profilesFor = (allowed: string[]) =>
    profiles.filter(
      (p) =>
        p.positionKey === 'general_manager' ||
        (p.positionKey != null && allowed.includes(p.positionKey)),
    );
  const accountManagers = profilesFor(['account_manager']);
  const projectManagers = profilesFor(['project_manager']);
  const productionManagers = profilesFor(['production_director']);

  function applyParsed(p: ParsedBrief) {
    setParsed(p);
    setTitleEn(p.title_en || '');
    setTitleAr(p.title_ar || '');
    setObjective(p.objective || '');
    setToneStyle(p.tone_style || 'cinematic');
    setProjectType(p.project_type || 'shoot');
    setShootStartsAt(p.shoot_date_iso || '');
    setDeliveryDueAt(p.delivery_due_iso || '');
    setClientAssets(p.client_assets_provided || []);
    setLocations(p.locations || []);
    setDeliverables(
      (p.deliverables || []).map((d) => ({
        format: d.format,
        aspect_ratio: d.aspect_ratio,
        duration_sec: d.duration_sec,
      })),
    );
    setShowAdvanced(true);
    setStep(1); // auto-advance to first data step after a successful parse
  }

  async function handleParse() {
    if (!briefText.trim()) return;
    setParseError(null);
    startTransition(async () => {
      const res = await parseBriefRich(briefText);
      if (!res.ok) {
        setParseError(res.error);
        return;
      }
      applyParsed(res.parsed);
    });
  }

  function fileToBase64(file: File): Promise<{ name: string; type: string; dataBase64: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        resolve({ name: file.name, type: file.type, dataBase64: result.split(',')[1] ?? '' });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleParseFiles() {
    if (files.length === 0) return;
    setParseError(null);
    startTransition(async () => {
      try {
        const payload = await Promise.all(files.slice(0, 8).map(fileToBase64));
        // Vercel caps a function payload at ~4.5MB; base64 inflates ~33%. Guard
        // before the call so big files get a clear message, not a raw throw.
        const totalChars = payload.reduce((s, p) => s + p.dataBase64.length, 0);
        if (totalChars > 5_000_000) {
          setParseError('الملفات كبيرة جداً (الحد ~٣.٥ ميجابايت). اختصرها أو الصق نص البريف بدلاً منها.');
          return;
        }
        const res = await parseBriefFromFiles(payload);
        if (!res.ok) {
          setParseError(res.error);
          return;
        }
        applyParsed(res.parsed);
      } catch {
        setParseError('تعذّر قراءة الملفات — تأكد أنها PDF أو صورة وأقل من ~٣.٥ ميجابايت، أو الصق النص بدلاً منها.');
      }
    });
  }

  const STEPS: Array<{ key: number; label: string; short: string }> = [
    { key: 0, label: 'استخراج بـ AI', short: 'AI' },
    { key: 1, label: 'العميل والمالية', short: 'العميل' },
    { key: 2, label: 'الإبداعي والمخرجات', short: 'الإبداع' },
    { key: 3, label: 'لوجستيات الإنتاج', short: 'اللوجستيات' },
    { key: 4, label: 'الفريق والملكية', short: 'الفريق' },
  ];

  function canAdvance(): boolean {
    if (step === 1) return clientId !== '' && titleEn.trim() !== '';
    return true;
  }
  function next() {
    if (step < STEPS.length - 1 && canAdvance()) setStep(step + 1);
  }
  function prev() {
    if (step > 0) setStep(step - 1);
  }
  const isLast = step === STEPS.length - 1;

  function addDeliverable() {
    setDeliverables((arr) => [
      ...arr,
      { format: 'reel', aspect_ratio: '9:16', duration_sec: 15 },
    ]);
  }
  function patchDeliverable(i: number, patch: Partial<Deliverable>) {
    setDeliverables((arr) => arr.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }
  function removeDeliverable(i: number) {
    setDeliverables((arr) => arr.filter((_, idx) => idx !== i));
  }

  function addLocation() {
    setLocations((arr) => [...arr, { city: '', venue: '', permit_required: false }]);
  }
  function patchLocation(i: number, patch: Partial<Location>) {
    setLocations((arr) => arr.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function removeLocation(i: number) {
    setLocations((arr) => arr.filter((_, idx) => idx !== i));
  }

  function addCrew() {
    setCrew((arr) => [...arr, { profile_id: '', role: 'shooter' }]);
  }
  function patchCrew(i: number, patch: Partial<CrewLine>) {
    setCrew((arr) => arr.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function removeCrew(i: number) {
    setCrew((arr) => arr.filter((_, idx) => idx !== i));
  }

  function toggleInArray(
    list: string[],
    setList: (v: string[]) => void,
    v: string,
  ) {
    setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  }

  // Pre-submit guard: makes step-5 "click but no nav" impossible by failing
  // fast with a visible message if a required field was lost between steps.
  const [submitError, setSubmitError] = useState<string | null>(null);
  function preSubmit(e: React.FormEvent<HTMLFormElement>) {
    setSubmitError(null);
    if (!clientId) {
      e.preventDefault();
      setStep(1);
      setSubmitError('اختَر العميل أولاً (الخطوة الثانية).');
      return;
    }
    if (!titleEn.trim()) {
      e.preventDefault();
      setStep(1);
      setSubmitError('عنوان المشروع (الإنجليزي) مطلوب.');
      return;
    }
  }

  return (
    <>
    <form action={commitAction} onSubmit={preSubmit} className="space-y-6">
      {/* AI hidden fields — always submitted regardless of step */}
      <input type="hidden" name="sourceText" value={briefText} />
      <input type="hidden" name="forBrandUnit" value={forBrandUnit} />
      <input type="hidden" name="parsedSummary" value={parsed?.objective ?? ''} />
      <input type="hidden" name="completeness" value={parsed?.completeness_score ?? 0} />
      <input type="hidden" name="missingFields" value={(parsed?.missing_fields ?? []).join(',')} />

      {/* Stepper */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)]/60 p-3">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {STEPS.map((s, i) => {
            const isActive = s.key === step;
            const isDone = s.key < step;
            const accessible = i === 0 || canAdvance() || s.key <= step;
            return (
              <button
                key={s.key}
                type="button"
                disabled={!accessible}
                onClick={() => accessible && setStep(s.key)}
                className={
                  'inline-flex h-8 items-center gap-2 rounded-md px-3 text-[11px] font-semibold whitespace-nowrap transition ' +
                  (isActive
                    ? 'text-white'
                    : isDone
                      ? 'border border-[var(--success)]/40 bg-[var(--success)]/10 text-[var(--success)]'
                      : 'border border-[var(--line)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[var(--line-strong)]')
                }
                style={isActive ? { background: 'var(--accent-gradient)' } : undefined}
              >
                <span className="font-mono text-[10px]">{isDone ? '✓' : i + 1}</span>
                <span className="hidden md:inline">{s.label}</span>
                <span className="md:hidden">{s.short}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[10px] text-[var(--text-dim)]">
          الخطوة {step + 1} من {STEPS.length}: {STEPS[step]?.label}
        </p>
      </div>

      {/* Section 0: AI Intake */}
      <section className={'rounded-lg border border-[var(--accent)]/25 bg-[var(--accent)]/[0.03] p-6 space-y-4 ' + (step !== 0 ? 'hidden' : '')}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
              — ١. ابدأ بـ AI (اختياري)
            </p>
            <h2 className="mt-2 text-base font-semibold text-[var(--text)]">
              ألصق نص البرِيف، الـ AI هيملا الحقول
            </h2>
            <p className="mt-1 text-[12px] text-[var(--text-muted)]">
              من إيميل، WhatsApp، PDF — Claude يستخرج العنوان، الميزانية، التواريخ، المخرجات،
              المواقع. أنت تراجع وتعدّل قبل الإنشاء.
            </p>
          </div>
        </div>

        {/* Sub-brand: Volt vs محتوى أبو لوكا */}
        <div className="space-y-1.5">
          <label className="block text-[12px] font-medium text-[var(--text)]">العلامة</label>
          <select
            value={forBrandUnit}
            onChange={(e) => setForBrandUnit(e.target.value)}
            className="w-full max-w-xs rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-2 text-[13px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
          >
            <option value="volt_production">Volt — إنتاج</option>
            <option value="abu_luka">محتوى أبو لوكا</option>
          </select>
        </div>

        <textarea
          value={briefText}
          onChange={(e) => setBriefText(e.target.value)}
          rows={6}
          placeholder="ألصق هنا الإيميل أو الـ WhatsApp أو أي نص من العميل…"
          className="w-full rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] p-3 text-[13px] leading-relaxed text-[var(--text)] placeholder:text-[var(--text-dim)] focus:border-[var(--accent)] focus:outline-none"
        />
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-[var(--text-dim)]">{briefText.length} حرف</p>
          <button
            type="button"
            onClick={handleParse}
            disabled={isPending || !briefText.trim()}
            className="magnet inline-flex h-10 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[13px] font-semibold text-black hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {isPending ? PARSE_HINTS[parseHintIdx] : 'حلّل بالـ AI'}
          </button>
        </div>

        {/* OR: upload files (images / PDFs) for AI to read */}
        <div className="rounded-md border border-dashed border-[var(--line-strong)] bg-[var(--bg-elevated)]/50 p-3 space-y-2">
          <p className="text-[12px] font-medium text-[var(--text)]">أو ارفع ملفات (صور أو مستندات) والـ AI يحلّلها</p>
          <input
            type="file"
            multiple
            accept="image/*,application/pdf"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 8))}
            className="block w-full text-[12px] text-[var(--text-muted)] file:me-3 file:rounded-md file:border-0 file:bg-[var(--surface)] file:px-3 file:py-1.5 file:text-[12px] file:text-[var(--text)] hover:file:bg-[var(--surface-hover)]"
          />
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-[var(--text-dim)]">
              {files.length > 0 ? `${files.length} ملف · ${files.map((f) => f.name).join('، ').slice(0, 60)}` : 'صور (jpg/png) أو PDF — حتى ٨ ملفات'}
            </p>
            <button
              type="button"
              onClick={handleParseFiles}
              disabled={isPending || files.length === 0}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 text-[12px] font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              حلّل الملفات بالـ AI
            </button>
          </div>
        </div>

        {parseError && <p className="text-[12px] text-[var(--danger)]">⚠ {parseError}</p>}
        {parsed && (
          <div className="rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] p-3 text-[12px]">
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-muted)]">اكتمال البرِيف</span>
              <span className="font-bold text-[var(--text)]">{parsed.completeness_score}%</span>
            </div>
            {parsed.missing_fields.length > 0 && (
              <p className="mt-2 text-[var(--warning)]">
                ⚠ ناقص: {parsed.missing_fields.join('، ')}
              </p>
            )}
          </div>
        )}
      </section>

      {/* Section 1: Client & Commercial */}
      <Section eyebrow="٢. العميل والمالية" icon={<Building2 size={14} />} hidden={step !== 1}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Row label="العميل النهائي (Brand)" required>
            <select name="clientId" required value={clientId} onChange={(e) => setClientId(e.target.value)} className="form-input">
              <option value="" disabled>— اختر —</option>
              {brands.map((c) => (
                <option key={c.id} value={c.id}>{c.code} · {c.nameAr}</option>
              ))}
            </select>
            {canCreateClient && (
              <button
                type="button"
                onClick={() => setQuickClientOpen(true)}
                className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent)] hover:underline"
              >
                <UserPlus size={12} /> عميل جديد — إضافة سريعة
              </button>
            )}
          </Row>
          <Row label="الـ Agency (وسيط)" hint="اختياري — لو فيه agency بتدير المشروع">
            <select name="agencyId" value={agencyId} onChange={(e) => setAgencyId(e.target.value)} className="form-input">
              <option value="">— بدون agency —</option>
              {agencies.map((c) => (
                <option key={c.id} value={c.id}>{c.code} · {c.nameAr}</option>
              ))}
            </select>
          </Row>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Row label="اسم المشروع (عربي)">
            <input
              type="text"
              name="titleAr"
              value={titleAr}
              onChange={(e) => setTitleAr(e.target.value)}
              placeholder="فيديو إعلاني — حملة الصيف"
              className="form-input"
            />
          </Row>
          <Row label="Project Name (English)" required>
            <input
              type="text"
              name="title"
              required
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
              placeholder="Summer Campaign Video"
              className="form-input"
            />
          </Row>
        </div>

        <Row label="رقم عرض السعر" hint="رقم/مرجع عرض السعر (Quote) المرتبط بالمشروع">
          <input
            type="text"
            name="quoteNumber"
            value={quoteNumber}
            onChange={(e) => setQuoteNumber(e.target.value)}
            placeholder="Q-2026-0042"
            className="form-input font-mono"
          />
        </Row>
      </Section>

      {/* Section 2: Creative */}
      <Section eyebrow="٣. الإبداعي والمخرجات" icon={<Film size={14} />} hidden={step !== 2}>
        <Row label="الهدف من المشروع" hint="جملة واحدة — لماذا سيُنفَّذ؟">
          <textarea
            name="objective"
            rows={2}
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="إطلاق سيارة جديدة في السوق السعودي"
            className="form-input"
          />
        </Row>

        <Row label="نمط الإخراج">
          <select name="toneStyle" value={toneStyle} onChange={(e) => setToneStyle(e.target.value)} className="form-input">
            {TONE_STYLES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
        </Row>

        <Row label="نوع المشروع">
          <select name="projectType" value={projectType} onChange={(e) => setProjectType(e.target.value)} className="form-input">
            {PROJECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Row>

        {/* Deliverables array */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[12px] font-medium text-[var(--text)]">المخرجات (Deliverables)</label>
            <button
              type="button"
              onClick={addDeliverable}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-[10px] hover:border-[var(--accent)]"
            >
              <Plus size={10} /> ضيف مخرج
            </button>
          </div>
          {deliverables.length === 0 ? (
            <p className="rounded-md border border-dashed border-[var(--line)] p-3 text-center text-[11px] text-[var(--text-dim)]">
              لا مخرجات بعد. ضيف ريل، فيديو طويل، أو صور.
            </p>
          ) : (
            <div className="space-y-2">
              {/* Column headers — the third column relabels per row type */}
              <div className="grid grid-cols-[1.2fr_0.8fr_1fr_auto] gap-1.5 px-2 text-[10px] font-medium text-[var(--text-dim)]">
                <span>النوع</span>
                <span>الأبعاد</span>
                <span>متوسط مدة الفيديو</span>
                <span className="w-8" />
              </div>
              {deliverables.map((d, i) => {
                const isPhoto = PHOTO_FORMATS.includes(d.format);
                return (
                  <div key={i} className="grid grid-cols-[1.2fr_0.8fr_1fr_auto] gap-1.5 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)]/40 p-2">
                    <select value={d.format} onChange={(e) => patchDeliverable(i, { format: e.target.value })} className="h-8 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-[11px]">
                      {FORMATS.map((f) => <option key={f.v} value={f.v}>{f.l}</option>)}
                    </select>
                    <select value={d.aspect_ratio} onChange={(e) => patchDeliverable(i, { aspect_ratio: e.target.value })} className="h-8 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-[11px] font-mono">
                      {ASPECT_RATIOS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <input
                      type="number"
                      min={1}
                      value={d.duration_sec ?? ''}
                      onChange={(e) => patchDeliverable(i, { duration_sec: e.target.value ? Number(e.target.value) : null })}
                      placeholder={isPhoto ? 'عدد الصور' : 'متوسط مدة الفيديو'}
                      aria-label={isPhoto ? 'عدد الصور' : 'متوسط مدة الفيديو'}
                      className="h-8 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-[11px] font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => removeDeliverable(i)}
                      className="grid h-8 w-8 place-items-center rounded-md text-[var(--text-dim)] hover:bg-red-500/10 hover:text-red-400"
                    >
                      <X size={11} />
                    </button>
                  </div>
                );
              })}
              <p className="text-[10px] text-[var(--text-dim)]">
                سيُنشأ {deliverables.length} عنصر في {new Set(deliverables.map((d) => d.format)).size} مجموعة
              </p>
            </div>
          )}
          <input type="hidden" name="deliverables" value={JSON.stringify(deliverables)} />
        </div>
      </Section>

      {/* Section 3: Logistics */}
      <Section eyebrow="٤. لوجستيات الإنتاج" icon={<MapPin size={14} />} hidden={step !== 3}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Row label="بداية التصوير">
            <input type="date" name="shootStartsAt" value={shootStartsAt} onChange={(e) => setShootStartsAt(e.target.value)} className="form-input font-mono" />
          </Row>
          <Row label="نهاية التصوير">
            <input type="date" name="shootEndsAt" value={shootEndsAt} onChange={(e) => setShootEndsAt(e.target.value)} className="form-input font-mono" />
          </Row>
          <Row label="موعد التسليم النهائي">
            <input type="date" name="deliveryDueAt" value={deliveryDueAt} onChange={(e) => setDeliveryDueAt(e.target.value)} className="form-input font-mono" />
          </Row>
        </div>

        {/* Locations */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[12px] font-medium text-[var(--text)]">المواقع</label>
            <button type="button" onClick={addLocation} className="inline-flex h-7 items-center gap-1 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-[10px] hover:border-[var(--accent)]">
              <Plus size={10} /> ضيف موقع
            </button>
          </div>
          {locations.length > 0 && (
            <div className="space-y-2">
              {locations.map((loc, i) => (
                <div key={i} className="grid grid-cols-[1fr_1.5fr_auto_auto] gap-1.5 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)]/40 p-2">
                  <input
                    type="text"
                    placeholder="المدينة"
                    value={loc.city}
                    onChange={(e) => patchLocation(i, { city: e.target.value })}
                    className="h-8 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-[11px]"
                  />
                  <input
                    type="text"
                    placeholder="الموقع (Venue)"
                    value={loc.venue ?? ''}
                    onChange={(e) => patchLocation(i, { venue: e.target.value })}
                    className="h-8 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-[11px]"
                  />
                  <label className="inline-flex h-8 items-center gap-1 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-[11px]">
                    <input
                      type="checkbox"
                      checked={loc.permit_required}
                      onChange={(e) => patchLocation(i, { permit_required: e.target.checked })}
                      className="accent-[var(--accent)]"
                    />
                    تصريح
                  </label>
                  <button type="button" onClick={() => removeLocation(i)} className="grid h-8 w-8 place-items-center rounded-md text-[var(--text-dim)] hover:bg-red-500/10 hover:text-red-400">
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <input type="hidden" name="locations" value={JSON.stringify(locations)} />
        </div>

        <Row label="أصول يقدّمها العميل">
          <div className="flex flex-wrap gap-1.5">
            {ASSET_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => toggleInArray(clientAssets, setClientAssets, opt)}
                className={
                  'rounded-md border px-2 py-0.5 text-[11px] ' +
                  (clientAssets.includes(opt)
                    ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]'
                    : 'border-[var(--line)] bg-[var(--surface)] text-[var(--text-muted)]')
                }
              >
                {opt}
              </button>
            ))}
          </div>
          <input type="hidden" name="clientAssetsProvided" value={clientAssets.join(',')} />
        </Row>
      </Section>

      {/* Section 4: Ownership & Crew */}
      <Section eyebrow="٥. الفريق والملكية" icon={<Users size={14} />} hidden={step !== 4}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Row label="مدير الحساب">
            <select name="amId" value={amId} onChange={(e) => setAmId(e.target.value)} className="form-input">
              <option value="">— غير محدد —</option>
              {accountManagers.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
            </select>
          </Row>
          <Row label="مدير المشروع">
            <select name="pmId" value={pmId} onChange={(e) => setPmId(e.target.value)} className="form-input">
              <option value="">— غير محدد —</option>
              {projectManagers.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
            </select>
          </Row>
          <Row label="مدير الإنتاج">
            <select name="productionManagerId" value={productionManagerId} onChange={(e) => setProductionManagerId(e.target.value)} className="form-input">
              <option value="">— غير محدد —</option>
              {productionManagers.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
            </select>
          </Row>
        </div>

        {/* Crew (optional advanced) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[12px] font-medium text-[var(--text)]">طاقم العمل (اختياري)</label>
            <button type="button" onClick={addCrew} className="inline-flex h-7 items-center gap-1 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-[10px] hover:border-[var(--accent)]">
              <Plus size={10} /> ضيف عضو
            </button>
          </div>
          {crew.length > 0 && (
            <div className="space-y-2">
              {crew.map((c, i) => (
                <div key={i} className="grid grid-cols-[1.4fr_1fr_auto] gap-1.5 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)]/40 p-2">
                  <select value={c.profile_id} onChange={(e) => patchCrew(i, { profile_id: e.target.value })} className="h-8 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-[11px]">
                    <option value="">— اختار شخص —</option>
                    {profiles.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
                  </select>
                  <select value={c.role} onChange={(e) => patchCrew(i, { role: e.target.value })} className="h-8 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-[11px]">
                    {CREW_ROLES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
                  </select>
                  <button type="button" onClick={() => removeCrew(i)} className="grid h-8 w-8 place-items-center rounded-md text-[var(--text-dim)] hover:bg-red-500/10 hover:text-red-400">
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <input type="hidden" name="crew" value={JSON.stringify(crew)} />
        </div>
      </Section>

      {/* Wizard nav */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prev}
            disabled={step === 0}
            className="inline-flex h-10 items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 text-[13px] text-[var(--text-muted)] hover:border-[var(--line-strong)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← السابق
          </button>
          {!isLast && (
            <button
              type="button"
              onClick={next}
              disabled={!canAdvance()}
              className="inline-flex h-10 items-center gap-1.5 rounded-md px-4 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: 'var(--accent-gradient)' }}
            >
              التالي →
            </button>
          )}
          {isLast && (
            <div className="flex flex-col items-end gap-1">
              {submitError && (
                <p className="text-[11px] text-[var(--danger)]">{submitError}</p>
              )}
              <button
                type="submit"
                disabled={!clientId || !titleEn.trim()}
                className="magnet inline-flex h-10 items-center gap-2 rounded-md px-5 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: 'var(--accent-gradient)' }}
              >
                <Sparkles size={15} />
                إنشاء المشروع
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {step === 1 && !canAdvance() && (
            <span className="text-[11px] text-[var(--warning)]">
              يجب اختيار عميل وإدخال عنوان إنجليزي للمتابعة
            </span>
          )}
          <a
            href="/projects"
            className="text-[12px] text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            إلغاء
          </a>
        </div>
      </div>

      <style>{`
        .form-input {
          width: 100%;
          min-height: 40px;
          padding: 8px 12px;
          border-radius: 6px;
          border: 1px solid var(--line);
          background: var(--bg-elevated);
          color: var(--text);
          font-size: 13px;
        }
        .form-input:focus { outline: none; border-color: var(--accent); }
        textarea.form-input { resize: vertical; min-height: 60px; }
      `}</style>

      {/* Avoid unused-import lint */}
      <span className="hidden">{String(showAdvanced)}{String(setShowAdvanced)}{String(ChevronDown)}{String(ChevronUp)}</span>
    </form>
    <QuickClientModal
      open={quickClientOpen}
      onClose={() => setQuickClientOpen(false)}
      onCreated={handleClientCreated}
      defaultBrandUnit={forBrandUnit}
    />
    </>
  );
}

function Section({
  eyebrow,
  icon,
  hidden,
  children,
}: {
  eyebrow: string;
  icon: React.ReactNode;
  hidden?: boolean;
  children: React.ReactNode;
}) {
  if (hidden) {
    // Keep DOM mounted so form values aren't lost, but visually hidden
    return <div className="hidden">{children}</div>;
  }
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-[var(--text-dim)]">{icon}</span>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-dim)]">
          — {eyebrow}
        </p>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Row({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[12px] font-medium text-[var(--text)]">
        {label}
        {required && <span className="text-[var(--accent)]"> *</span>}
      </span>
      {children}
      {hint && <span className="block text-[10px] text-[var(--text-dim)]">{hint}</span>}
    </label>
  );
}
