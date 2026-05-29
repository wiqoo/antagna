'use server';

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { db, withActor } from '@antagna/db';
import { requirePermissionAction } from '@/lib/authz';
import { writeActivity } from '@/lib/activity';

/**
 * HR records (1:1 with profiles). The profile already exists (created at invite
 * time, D-040); the employee row carries the HR-side payload. `access.manage`
 * gates both create and edit — salary + national ID are sensitive (PDPL), so the
 * detail view masks them for everyone without that permission, and the mutating
 * actions refuse without it too.
 *
 * We upsert on profile_id (UNIQUE) so "create record" and "edit record" share one
 * path: a profile that never had an employee row gets one INSERTed; an existing
 * one is UPDATEd. All writes go through withActor so the audit trigger + any
 * SECURITY DEFINER checks see the acting principal on the same pinned connection.
 */

function nullableInt(v: FormDataEntryValue | null): number | null {
  if (v == null) return null;
  const s = v.toString().trim();
  if (s === '') return null;
  const n = Number(s.replace(/[, ]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : null;
}

function nullableText(v: FormDataEntryValue | null): string | null {
  const s = v?.toString().trim();
  return s ? s : null;
}

export async function saveEmployee(formData: FormData) {
  const actorId = await requirePermissionAction('access.manage');

  const profileId = formData.get('profileId')?.toString();
  if (!profileId) throw new Error('profileId required');

  const jobTitle = nullableText(formData.get('jobTitle'));
  const hireDate = nullableText(formData.get('hireDate'));
  const endDate = nullableText(formData.get('endDate'));
  const employmentType = nullableText(formData.get('employmentType'));
  const nationality = nullableText(formData.get('nationality'));
  const nationalId = nullableText(formData.get('nationalId'));
  const nationalIdType = nullableText(formData.get('nationalIdType'));
  const monthlySalary = nullableInt(formData.get('monthlySalary'));
  const currency = nullableText(formData.get('monthlySalaryCurrency')) ?? 'SAR';

  const isFreelancer = formData.get('isFreelancer') === 'on';
  const canBeShooter = formData.get('canBeShooter') === 'on';
  const canBeEditor = formData.get('canBeEditor') === 'on';
  const canBePilot = formData.get('canBePilot') === 'on';

  await withActor(actorId, (tx) =>
    tx.execute(sql`
      INSERT INTO employees (
        profile_id, job_title, hire_date, end_date, employment_type,
        nationality, national_id, national_id_type,
        monthly_salary, monthly_salary_currency,
        is_freelancer, can_be_shooter, can_be_editor, can_be_pilot, updated_at
      )
      VALUES (
        ${profileId}::uuid, ${jobTitle}, ${hireDate}, ${endDate}, ${employmentType},
        ${nationality}, ${nationalId}, ${nationalIdType},
        ${monthlySalary}, ${currency},
        ${isFreelancer}, ${canBeShooter}, ${canBeEditor}, ${canBePilot}, now()
      )
      ON CONFLICT (profile_id) DO UPDATE SET
        job_title = EXCLUDED.job_title,
        hire_date = EXCLUDED.hire_date,
        end_date = EXCLUDED.end_date,
        employment_type = EXCLUDED.employment_type,
        nationality = EXCLUDED.nationality,
        national_id = EXCLUDED.national_id,
        national_id_type = EXCLUDED.national_id_type,
        monthly_salary = EXCLUDED.monthly_salary,
        monthly_salary_currency = EXCLUDED.monthly_salary_currency,
        is_freelancer = EXCLUDED.is_freelancer,
        can_be_shooter = EXCLUDED.can_be_shooter,
        can_be_editor = EXCLUDED.can_be_editor,
        can_be_pilot = EXCLUDED.can_be_pilot,
        updated_at = now()
    `),
  );

  await writeActivity({
    actorId,
    entityType: 'employee',
    entityId: profileId,
    action: 'hr.save',
    summaryAr: 'حدّث ملف الموظف',
    summaryEn: 'Updated employee HR record',
  });

  revalidatePath('/employees');
  revalidatePath(`/employees/${profileId}`);
}
