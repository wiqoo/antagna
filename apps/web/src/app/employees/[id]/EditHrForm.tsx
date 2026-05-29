'use client';

import { useState } from 'react';
import { Pencil, X } from 'lucide-react';
import { saveEmployee } from '../actions';

export interface HrFormValues {
  profileId: string;
  jobTitle: string | null;
  hireDate: string | null;
  endDate: string | null;
  employmentType: string | null;
  nationality: string | null;
  nationalId: string | null;
  nationalIdType: string | null;
  monthlySalary: number | null;
  monthlySalaryCurrency: string | null;
  isFreelancer: boolean;
  canBeShooter: boolean;
  canBeEditor: boolean;
  canBePilot: boolean;
}

const inputCls =
  'h-9 w-full rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 text-[13px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none';
const labelCls = 'mb-1 block text-[11px] font-medium text-[var(--text-muted)]';

export function EditHrForm({ values }: { values: HrFormValues }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
      >
        <Pencil size={13} /> تعديل الملف
      </button>
    );
  }

  return (
    <form
      action={async (fd) => {
        await saveEmployee(fd);
        setOpen(false);
      }}
      className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5"
    >
      <input type="hidden" name="profileId" value={values.profileId} />

      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-[var(--text)]">تعديل بيانات الموظف</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="grid h-7 w-7 place-items-center rounded-md text-[var(--text-dim)] hover:text-[var(--text)]"
        >
          <X size={15} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>المسمى الوظيفي</label>
          <input name="jobTitle" defaultValue={values.jobTitle ?? ''} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>نوع التوظيف</label>
          <select
            name="employmentType"
            defaultValue={values.employmentType ?? ''}
            className={inputCls}
          >
            <option value="">—</option>
            <option value="full_time">دوام كامل</option>
            <option value="part_time">دوام جزئي</option>
            <option value="freelancer">فريلانسر</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>تاريخ التعيين</label>
          <input
            type="date"
            name="hireDate"
            defaultValue={values.hireDate ?? ''}
            className={inputCls}
            dir="ltr"
          />
        </div>
        <div>
          <label className={labelCls}>تاريخ الانتهاء</label>
          <input
            type="date"
            name="endDate"
            defaultValue={values.endDate ?? ''}
            className={inputCls}
            dir="ltr"
          />
        </div>
        <div>
          <label className={labelCls}>الجنسية</label>
          <input name="nationality" defaultValue={values.nationality ?? ''} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>نوع الهوية</label>
          <select
            name="nationalIdType"
            defaultValue={values.nationalIdType ?? ''}
            className={inputCls}
          >
            <option value="">—</option>
            <option value="saudi">سعودي</option>
            <option value="iqama">إقامة</option>
            <option value="visitor">زائر</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>رقم الهوية / الإقامة</label>
          <input
            name="nationalId"
            defaultValue={values.nationalId ?? ''}
            className={inputCls}
            dir="ltr"
          />
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <div>
            <label className={labelCls}>الراتب الشهري</label>
            <input
              type="number"
              name="monthlySalary"
              defaultValue={values.monthlySalary ?? ''}
              className={inputCls}
              dir="ltr"
              min={0}
            />
          </div>
          <div>
            <label className={labelCls}>العملة</label>
            <select
              name="monthlySalaryCurrency"
              defaultValue={values.monthlySalaryCurrency ?? 'SAR'}
              className={inputCls + ' w-20'}
            >
              <option value="SAR">SAR</option>
              <option value="USD">USD</option>
              <option value="AED">AED</option>
            </select>
          </div>
        </div>
      </div>

      <fieldset className="mt-4 rounded-lg border border-[var(--line)] p-3">
        <legend className="px-1 text-[11px] font-medium text-[var(--text-muted)]">
          القدرات الإنتاجية
        </legend>
        <div className="flex flex-wrap gap-4 pt-1">
          <Check name="isFreelancer" label="فريلانسر" defaultChecked={values.isFreelancer} />
          <Check name="canBeShooter" label="مصوّر" defaultChecked={values.canBeShooter} />
          <Check name="canBeEditor" label="مونتير" defaultChecked={values.canBeEditor} />
          <Check name="canBePilot" label="طيّار درون" defaultChecked={values.canBePilot} />
        </div>
      </fieldset>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-9 rounded-md border border-[var(--line)] px-4 text-[12px] text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          إلغاء
        </button>
        <button
          type="submit"
          className="h-9 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)]"
        >
          حفظ
        </button>
      </div>
    </form>
  );
}

function Check({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-[12px] text-[var(--text)]">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-[var(--line)] accent-[var(--accent)]"
      />
      {label}
    </label>
  );
}
