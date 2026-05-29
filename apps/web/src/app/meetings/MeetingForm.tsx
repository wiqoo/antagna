'use client';

import Link from 'next/link';
import { Save } from 'lucide-react';

export interface MeetingFormProps {
  action: (formData: FormData) => void | Promise<void>;
  projectOptions: { id: string; label: string }[];
  clientOptions: { id: string; label: string }[];
  cancelHref: string;
  submitLabel?: string;
  initial?: {
    meetingTitle?: string | null;
    meetingDateLocal?: string | null; // datetime-local value
    attendeesText?: string | null;
    noteContent?: string | null;
    driveUrl?: string | null;
    projectId?: string | null;
    clientId?: string | null;
    actionItemsText?: string | null; // newline-joined
  };
}

export function MeetingForm({
  action,
  projectOptions,
  clientOptions,
  cancelHref,
  submitLabel = 'حفظ',
  initial,
}: MeetingFormProps) {
  return (
    <form action={action} className="space-y-6">
      <Field label="عنوان الاجتماع" required>
        <input
          type="text"
          name="meetingTitle"
          required
          defaultValue={initial?.meetingTitle ?? ''}
          placeholder="اجتماع كيك-أوف مع العميل"
          className="form-input"
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="التاريخ والوقت">
          <input
            type="datetime-local"
            name="meetingDate"
            defaultValue={initial?.meetingDateLocal ?? ''}
            className="form-input"
            dir="ltr"
          />
        </Field>
        <Field label="رابط Drive / تسجيل" hint="رابط ملف الملاحظات أو تسجيل الاجتماع (اختياري).">
          <input
            type="url"
            name="driveUrl"
            defaultValue={initial?.driveUrl ?? ''}
            placeholder="https://drive.google.com/…"
            className="form-input font-mono"
            dir="ltr"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="العميل" hint="اربط الاجتماع بعميل (اختياري).">
          <select name="clientId" defaultValue={initial?.clientId ?? ''} className="form-input">
            <option value="">— بدون —</option>
            {clientOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="المشروع" hint="اربط الاجتماع بمشروع (اختياري).">
          <select name="projectId" defaultValue={initial?.projectId ?? ''} className="form-input">
            <option value="">— بدون —</option>
            {projectOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="الحضور" hint="أسماء الحضور مفصولة بفواصل أو أسطر.">
        <textarea
          name="attendeesText"
          rows={2}
          defaultValue={initial?.attendeesText ?? ''}
          placeholder="محمد الغريب، أحمد الجنيد، فريق العميل"
          className="form-input h-auto py-2.5"
        />
      </Field>

      <Field label="الملاحظات / المحضر">
        <textarea
          name="noteContent"
          rows={8}
          defaultValue={initial?.noteContent ?? ''}
          placeholder="أهم ما دار في الاجتماع، القرارات، الملاحظات…"
          className="form-input h-auto py-2.5 leading-relaxed"
        />
      </Field>

      <Field label="المهام المتفق عليها" hint="مهمة واحدة في كل سطر — تظهر كقائمة قابلة للتحقيق في صفحة المحضر.">
        <textarea
          name="actionItems"
          rows={4}
          defaultValue={initial?.actionItemsText ?? ''}
          placeholder={'إرسال عرض السعر المعدّل\nتأكيد موعد التصوير\nمشاركة المراجع البصرية'}
          className="form-input h-auto py-2.5 leading-relaxed"
        />
      </Field>

      <div className="flex items-center gap-3 border-t border-[var(--line)] pt-6">
        <button
          type="submit"
          className="inline-flex h-10 items-center gap-2 rounded-md bg-[var(--accent)] px-5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
        >
          <Save size={16} /> {submitLabel}
        </button>
        <Link
          href={cancelHref}
          className="inline-flex h-10 items-center rounded-md px-4 text-sm text-[var(--text-muted)] hover:bg-[var(--surface)]/60 hover:text-[var(--text)]"
        >
          إلغاء
        </Link>
      </div>

      <style>{`
        .form-input {
          width: 100%;
          height: 40px;
          padding: 0 12px;
          border-radius: 12px;
          border: 1px solid var(--line);
          background: var(--bg-elevated);
          color: var(--text);
          font-size: 14px;
        }
        textarea.form-input { height: auto; }
        .form-input:focus { outline: none; border-color: var(--accent); }
      `}</style>
    </form>
  );
}

function Field({
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
      <span className="block text-sm font-medium text-[var(--text)]">
        {label}
        {required && <span className="text-[var(--accent)]"> *</span>}
      </span>
      {hint && (
        <span className="block text-[11px] leading-relaxed text-[var(--text-dim)]">{hint}</span>
      )}
      {children}
    </label>
  );
}
