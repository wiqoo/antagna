'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  User2,
  Award,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  SkipForward,
  Loader2,
} from 'lucide-react';
import { completeOnboarding, skipOnboarding } from './actions';

interface Props {
  profile: {
    displayName: string;
    displayNameEn: string | null;
    email: string;
    role: string;
    uiLanguage: string;
  };
  capabilities: {
    key: string;
    label: string;
    isPrimary: boolean;
    proficiency: number;
  }[];
}

const STEPS = ['welcome', 'profile', 'capabilities', 'done'] as const;
type Step = (typeof STEPS)[number];

export function WelcomeFlow({ profile, capabilities }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('welcome');
  const [pending, startTransition] = useTransition();
  const idx = STEPS.indexOf(step);
  const isLast = step === 'done';

  function next() {
    const nextStep = STEPS[Math.min(idx + 1, STEPS.length - 1)];
    if (nextStep) setStep(nextStep);
  }
  function prev() {
    const prevStep = STEPS[Math.max(idx - 1, 0)];
    if (prevStep) setStep(prevStep);
  }
  function finish() {
    startTransition(async () => {
      await completeOnboarding();
      router.push('/dashboard');
    });
  }
  function skip() {
    startTransition(async () => {
      await skipOnboarding();
      router.push('/dashboard');
    });
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto flex min-h-screen max-w-[640px] flex-col px-4 py-8 md:py-16">
        {/* Progress */}
        <div className="mb-8 flex items-center gap-2">
          {STEPS.slice(0, 3).map((s, i) => (
            <div
              key={s}
              className="h-1 flex-1 rounded-full transition-colors"
              style={{
                background:
                  i < idx
                    ? 'var(--accent)'
                    : i === idx
                      ? 'var(--accent)'
                      : 'var(--line)',
                opacity: i === idx ? 1 : i < idx ? 0.6 : 1,
              }}
            />
          ))}
        </div>

        <div className="flex-1 space-y-6">
          {step === 'welcome' && (
            <>
              <div className="space-y-3">
                <span className="inline-flex items-center gap-1.5 rounded bg-[var(--accent-tint)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--accent)]">
                  <Sparkles size={10} />
                  أهلاً
                </span>
                <h1
                  className="text-[28px] font-bold leading-tight tracking-[-0.02em] md:text-[36px]"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  أهلاً {profile.displayName} — يسعدنا انضمامك إلى Volt
                </h1>
                <p className="text-[14px] leading-relaxed text-[var(--text-muted)]">
                  Antagna هو نظام الإدارة الداخلي الذي يجعل عملك أسرع
                  وأوضح. سنعرض عليك أهم ثلاثة أمور في دقيقة.
                </p>
              </div>
              <ul className="space-y-3 text-[13px]">
                <Bullet text="كل المشاريع والمعدات والمهام في مكان واحد" />
                <Bullet text="الـ AI يقرأ الإيميلات ويصنّفها ويفتح leads تلقائياً" />
                <Bullet text="Cmd+K في أي مكان للتنقّل أو تنفيذ أي إجراء" />
              </ul>
            </>
          )}

          {step === 'profile' && (
            <>
              <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
                  <User2 size={12} />
                  بياناتك
                </span>
                <h2 className="text-[22px] font-bold">هذه بياناتك في النظام</h2>
                <p className="text-[12px] text-[var(--text-muted)]">
                  إن وجدت خطأً، اطلب من المسؤول تعديله لاحقاً من /admin.
                </p>
              </div>
              <dl className="grid grid-cols-1 gap-3 text-[13px]">
                <Row k="الاسم" v={profile.displayName} />
                {profile.displayNameEn && (
                  <Row k="بالإنجليزي" v={profile.displayNameEn} />
                )}
                <Row k="البريد" v={profile.email} mono />
                <Row k="الدور" v={profile.role} mono />
                <Row k="لغة الواجهة" v={profile.uiLanguage === 'ar' ? 'العربية' : 'English'} />
              </dl>
            </>
          )}

          {step === 'capabilities' && (
            <>
              <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
                  <Award size={12} />
                  مهاراتك
                </span>
                <h2 className="text-[22px] font-bold">ما الذي تقوم به</h2>
                <p className="text-[12px] text-[var(--text-muted)]">
                  هذه المهارات المسجّلة لديك. يستخدمها النظام عند اقتراح شخص
                  لـ task أو reservation.
                </p>
              </div>
              {capabilities.length === 0 ? (
                <p className="rounded-md border border-dashed border-[var(--line)] p-4 text-center text-[12px] text-[var(--text-muted)]">
                  لا مهارات مسجّلة. اطلب من المسؤول إضافتها من /admin.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {capabilities.map((c) => (
                    <div
                      key={c.key}
                      className={
                        'rounded-md border p-3 ' +
                        (c.isPrimary
                          ? 'border-[var(--accent)]/40 bg-[var(--accent)]/[0.05]'
                          : 'border-[var(--line)] bg-[var(--surface)]/40')
                      }
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{c.label}</span>
                        {c.isPrimary && (
                          <span className="rounded bg-[var(--accent)]/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-[var(--accent)]">
                            أساسي
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-[10px] text-[var(--text-dim)]">
                        proficiency {c.proficiency}/3
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {step === 'done' && (
            <>
              <div className="space-y-3 text-center">
                <CheckCircle2
                  size={48}
                  className="mx-auto text-[var(--success)]"
                />
                <h2 className="text-[24px] font-bold">جاهز للبدء</h2>
                <p className="text-[13px] text-[var(--text-muted)]">
                  الآن يمكنك فتح Antagna من أي مكان. اضغط Cmd+K في أي وقت
                  لتفتح أي شيء بسرعة.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 flex items-center justify-between gap-3">
          {step !== 'welcome' ? (
            <button
              onClick={prev}
              disabled={pending}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] text-[var(--text-muted)] hover:border-[var(--accent)] disabled:opacity-50"
            >
              <ArrowRight size={12} />
              رجوع
            </button>
          ) : (
            <button
              onClick={skip}
              disabled={pending}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] text-[var(--text-muted)] hover:border-[var(--accent)] disabled:opacity-50"
            >
              <SkipForward size={12} />
              تجاوز
            </button>
          )}
          {isLast ? (
            <button
              onClick={finish}
              disabled={pending}
              className="inline-flex h-10 items-center gap-1.5 rounded-md px-4 text-[13px] font-semibold text-white disabled:opacity-50"
              style={{ background: 'var(--accent-gradient)' }}
            >
              {pending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <CheckCircle2 size={14} />
              )}
              ادخل Antagna
            </button>
          ) : (
            <button
              onClick={next}
              disabled={pending}
              className="inline-flex h-10 items-center gap-1.5 rounded-md px-4 text-[13px] font-semibold text-white disabled:opacity-50"
              style={{ background: 'var(--accent-gradient)' }}
            >
              التالي
              <ArrowLeft size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2">
      <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[var(--accent)]" />
      <span>{text}</span>
    </li>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-[var(--line)] bg-[var(--surface)]/40 px-3 py-2">
      <span className="text-[11px] uppercase tracking-wider text-[var(--text-dim)]">
        {k}
      </span>
      <span className={mono ? 'font-mono text-[var(--text)]' : 'text-[var(--text)]'}>
        {v}
      </span>
    </div>
  );
}
