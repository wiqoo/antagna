-- ════════════════════════════════════════════════════════════════════════════
-- Sprint 0 Phase D + E — assembled: assignment/department helpers, the 6
-- v_*_safe masking views, the Abu Luka column + label branch, and the Phase F
-- 'invited' person_status value. (D-037/D-039/D-040; permissions spec Parts 2/5.)
--
-- cepi := current_effective_profile_id() (migration 050) — view-as aware,
-- reads txn-local GUC app.current_profile_id set by withProfileScope(), falls
-- back to the authenticated profile. has_permission(profile, code) := mig 049.
--
-- Views are correct-by-construction: NO role/system_admin bypass. غريب passes
-- Test 10 the instant his TEMP general_manager '*' hat (mig 049 lines ~288-289)
-- is deleted. Column names + order match the base-table selects the pages use.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 0. Phase F — invite-only person_status (idempotent; may already be applied) ─
ALTER TYPE person_status ADD VALUE IF NOT EXISTS 'invited';

-- ── 1. Abu Luka content flag (idempotent) ──────────────────────────────────────
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS is_abu_luka_content boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.projects.is_abu_luka_content IS
  'Abu Luka personal content. Crew (lacking projects.read.client_contacts) see the project EXISTS but client_id/agency_id/contracted_value_sar masked NULL; UI renders generic "محتوى أبو لوكا" label.';

-- ── 2. HELPER: user_assigned_to_project(profile, project) ───────────────────────
-- 2-arg (the views pass cepi explicitly; spec Part 3's 1-arg GUC-reading version
-- is superseded). project_assignments membership OR any manager seat on projects.
CREATE OR REPLACE FUNCTION public.user_assigned_to_project(p_profile_id uuid, p_project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    p_profile_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.project_assignments pa
        WHERE pa.project_id = p_project_id AND pa.profile_id = p_profile_id
      )
      OR EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = p_project_id
          AND (p.account_manager_id    = p_profile_id
            OR p.project_manager_id    = p_profile_id
            OR p.production_manager_id = p_profile_id)
      )
    );
$$;

-- ── 3. HELPER: has_same_department(viewer, target) ──────────────────────────────
-- True iff both profiles share a non-null department_id. Powers team.read same-
-- department field exposure (Part 2 §team). Self is treated as same-dept.
CREATE OR REPLACE FUNCTION public.has_same_department(p_viewer_id uuid, p_target_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    p_viewer_id IS NOT NULL AND p_target_id IS NOT NULL
    AND (
      p_viewer_id = p_target_id
      OR EXISTS (
        SELECT 1
        FROM public.profiles v
        JOIN public.profiles tg ON tg.department_id = v.department_id
        WHERE v.id = p_viewer_id
          AND tg.id = p_target_id
          AND v.department_id IS NOT NULL
      )
    );
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. v_projects_safe — drop-in for `projects`; full column set (open + masked),
--    base order. Masks per Part 2 §projects. Row visibility: read.all OR
--    (read.assigned AND assigned). is_abu_luka_content is OPEN (UI label driver);
--    client/agency/value masking already nulls identity for crew, so the label
--    kicks in (Tests 8/9). dafterah_* + post_mortem_notes + default_approval_flow
--    + ai_risk_level masked (spec corrections vs the old partial view).
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW public.v_projects_safe AS
SELECT
  p.id,
  p.code,
  p.title,
  p.title_ar,
  p.description,
  p.project_type,
  p.stage,

  -- Client / agency identity — projects.read.client_contacts
  CASE WHEN has_permission(current_effective_profile_id(), 'projects.read.client_contacts')
       THEN p.client_id          ELSE NULL END AS client_id,
  CASE WHEN has_permission(current_effective_profile_id(), 'projects.read.client_contacts')
       THEN p.agency_id          ELSE NULL END AS agency_id,
  CASE WHEN has_permission(current_effective_profile_id(), 'projects.read.client_contacts')
       THEN p.agency_contact_id  ELSE NULL END AS agency_contact_id,
  CASE WHEN has_permission(current_effective_profile_id(), 'projects.read.client_contacts')
       THEN p.primary_contact_id ELSE NULL END AS primary_contact_id,

  -- Manager seats + location (open — operational context)
  p.account_manager_id,
  p.project_manager_id,
  p.production_manager_id,
  p.location_id,

  -- Dates (open)
  p.brief_received_at,
  p.quoted_at,
  p.approved_at,
  p.shoot_starts_at,
  p.shoot_ends_at,
  p.delivery_due_at,
  p.delivered_at,
  p.archived_at,

  p.lost_reason,

  -- Abu Luka flag (OPEN — drives the generic label)
  p.is_abu_luka_content,

  -- Financial — projects.read.financial (crew never hold it)
  CASE WHEN has_permission(current_effective_profile_id(), 'projects.read.financial')
       THEN p.contracted_value_sar ELSE NULL END AS contracted_value_sar,

  -- AI + internal — projects.read.internal_notes
  CASE WHEN has_permission(current_effective_profile_id(), 'projects.read.internal_notes')
       THEN p.ai_status_paragraph ELSE NULL END AS ai_status_paragraph,
  CASE WHEN has_permission(current_effective_profile_id(), 'projects.read.internal_notes')
       THEN p.ai_risk_level       ELSE NULL END AS ai_risk_level,
  CASE WHEN has_permission(current_effective_profile_id(), 'projects.read.internal_notes')
       THEN p.ai_next_action      ELSE NULL END AS ai_next_action,
  p.ai_analyzed_at,

  -- External integrations (open — operational)
  p.drive_folder_url,
  p.drive_folder_id,
  p.calendar_event_id,

  -- Dafterah financial refs — projects.read.financial
  CASE WHEN has_permission(current_effective_profile_id(), 'projects.read.financial')
       THEN p.dafterah_quote_number   ELSE NULL END AS dafterah_quote_number,
  CASE WHEN has_permission(current_effective_profile_id(), 'projects.read.financial')
       THEN p.dafterah_invoice_number ELSE NULL END AS dafterah_invoice_number,
  CASE WHEN has_permission(current_effective_profile_id(), 'projects.read.financial')
       THEN p.dafterah_po_number      ELSE NULL END AS dafterah_po_number,

  -- Approval flow config — leadership only (internal_notes proxy; Part 2)
  CASE WHEN has_permission(current_effective_profile_id(), 'projects.read.internal_notes')
       THEN p.default_approval_flow ELSE NULL END AS default_approval_flow,

  -- Recurrence + custom fields (open)
  p.recurrence_rule,
  p.recurrence_parent_id,
  p.next_occurrence_at,
  p.custom_fields,

  -- Internal notes — projects.read.internal_notes
  CASE WHEN has_permission(current_effective_profile_id(), 'projects.read.internal_notes')
       THEN p.notes            ELSE NULL END AS notes,
  CASE WHEN has_permission(current_effective_profile_id(), 'projects.read.internal_notes')
       THEN p.post_mortem_notes ELSE NULL END AS post_mortem_notes,

  -- Audit (open)
  p.created_by,
  p.created_at,
  p.updated_at
FROM public.projects p
WHERE
  has_permission(current_effective_profile_id(), 'projects.read.all')
  OR (
    has_permission(current_effective_profile_id(), 'projects.read.assigned')
    AND user_assigned_to_project(current_effective_profile_id(), p.id)
  );

-- ════════════════════════════════════════════════════════════════════════════
-- 5. v_clients_safe — drop-in for `clients`. Real columns (client_type,
--    website_url, country, city, address_lines — NO `address`/`type`/`website`).
--    Identity (name/code/type/industry/website/city/address) masked behind
--    clients.read.all OR clients.read.contacts; legal_name behind .all OR
--    .financial; cr/vat behind .financial. Row visibility: .all OR (.own AND
--    assigned via a project). Open numeric/score cols stay raw.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW public.v_clients_safe AS
SELECT
  c.id,
  c.code,  -- code is structural; identity masking is on name/legal/tax below

  -- Display identity — .all OR .contacts (crew that reach a client row at all)
  CASE WHEN has_permission(current_effective_profile_id(), 'clients.read.all')
         OR has_permission(current_effective_profile_id(), 'clients.read.contacts')
       THEN c.name_ar ELSE NULL END AS name_ar,
  CASE WHEN has_permission(current_effective_profile_id(), 'clients.read.all')
         OR has_permission(current_effective_profile_id(), 'clients.read.contacts')
       THEN c.name_en ELSE NULL END AS name_en,

  -- Legal name — .all OR .financial (Part 2: hidden from غريب; financial sees it)
  CASE WHEN has_permission(current_effective_profile_id(), 'clients.read.all')
         OR has_permission(current_effective_profile_id(), 'clients.read.financial')
       THEN c.legal_name ELSE NULL END AS legal_name,

  -- Tax identifiers — financial only (حسين/حازم/GM)
  CASE WHEN has_permission(current_effective_profile_id(), 'clients.read.financial')
       THEN c.vat_number ELSE NULL END AS vat_number,
  CASE WHEN has_permission(current_effective_profile_id(), 'clients.read.financial')
       THEN c.cr_number  ELSE NULL END AS cr_number,

  -- Type / industry / flags — .all OR .contacts
  CASE WHEN has_permission(current_effective_profile_id(), 'clients.read.all')
         OR has_permission(current_effective_profile_id(), 'clients.read.contacts')
       THEN c.client_type ELSE NULL END AS client_type,
  c.is_agency,
  CASE WHEN has_permission(current_effective_profile_id(), 'clients.read.all')
         OR has_permission(current_effective_profile_id(), 'clients.read.contacts')
       THEN c.industry ELSE NULL END AS industry,

  -- Address-ish — .all OR .contacts
  c.country,  -- country open (low-sensitivity; spec country_code = ✓ for AM/PM)
  CASE WHEN has_permission(current_effective_profile_id(), 'clients.read.all')
         OR has_permission(current_effective_profile_id(), 'clients.read.contacts')
       THEN c.city ELSE NULL END AS city,
  CASE WHEN has_permission(current_effective_profile_id(), 'clients.read.all')
         OR has_permission(current_effective_profile_id(), 'clients.read.contacts')
       THEN c.address_lines ELSE NULL END AS address_lines,
  CASE WHEN has_permission(current_effective_profile_id(), 'clients.read.all')
         OR has_permission(current_effective_profile_id(), 'clients.read.contacts')
       THEN c.website_url ELSE NULL END AS website_url,
  c.logo_url,

  -- Operational / financial-health scalars (open — used by health cards)
  c.default_payment_terms_key,
  c.average_payment_days,
  c.trust_score,
  c.archived_at,

  -- Internal notes — .all OR .financial (sensitive)
  CASE WHEN has_permission(current_effective_profile_id(), 'clients.read.all')
         OR has_permission(current_effective_profile_id(), 'clients.read.financial')
       THEN c.notes ELSE NULL END AS notes,
  c.custom_fields,

  c.created_by,
  c.created_at,
  c.updated_at
FROM public.clients c
WHERE
  has_permission(current_effective_profile_id(), 'clients.read.all')
  OR (
    has_permission(current_effective_profile_id(), 'clients.read.own')
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.client_id = c.id
        AND user_assigned_to_project(current_effective_profile_id(), p.id)
    )
  );

-- ════════════════════════════════════════════════════════════════════════════
-- 6. v_contacts_safe — drop-in for `contacts`. Contact identity is visible to
--    anyone who can READ the contact at all; the gate is the row WHERE (must
--    have clients.read.all OR own-the-parent-client). `notes` masked behind
--    clients.read.contacts. Crew/freelancers fail the WHERE → 0 rows (Test 5).
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW public.v_contacts_safe AS
SELECT
  ct.id,
  ct.client_id,
  ct.full_name,
  ct.full_name_ar,
  ct.job_title,
  ct.job_title_ar,
  ct.department,
  ct.is_primary,
  ct.is_decision_maker,
  ct.preferred_language,
  CASE WHEN has_permission(current_effective_profile_id(), 'clients.read.contacts')
         OR has_permission(current_effective_profile_id(), 'clients.read.all')
       THEN ct.notes ELSE NULL END AS notes,
  ct.custom_fields,
  ct.archived_at,
  ct.created_at,
  ct.updated_at
FROM public.contacts ct
WHERE
  has_permission(current_effective_profile_id(), 'clients.read.all')
  OR has_permission(current_effective_profile_id(), 'clients.read.contacts')
  OR (
    has_permission(current_effective_profile_id(), 'clients.read.own')
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.client_id = ct.client_id
        AND user_assigned_to_project(current_effective_profile_id(), p.id)
    )
  );

-- ════════════════════════════════════════════════════════════════════════════
-- 7. v_equipment_safe — drop-in for `equipment`. NO row WHERE (all production
--    team sees all equipment). Operational cols raw; financial/serial masked
--    behind equipment.read.financial (Tests 3/4 — مساعد has it → numeric).
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW public.v_equipment_safe AS
SELECT
  e.id,
  e.code,
  e.group_id,
  e.category,
  e.manufacturer,
  e.model,
  e.model_name_ar,
  CASE WHEN has_permission(current_effective_profile_id(), 'equipment.read.financial')
       THEN e.serial_number ELSE NULL END AS serial_number,
  e.tracking_mode,
  e.quantity_total,
  e.status,
  e.current_location,
  CASE WHEN has_permission(current_effective_profile_id(), 'equipment.read.financial')
       THEN e.purchase_date ELSE NULL END AS purchase_date,
  CASE WHEN has_permission(current_effective_profile_id(), 'equipment.read.financial')
       THEN e.purchase_price_sar ELSE NULL END AS purchase_price_sar,
  CASE WHEN has_permission(current_effective_profile_id(), 'equipment.read.financial')
       THEN e.insurance_value_sar ELSE NULL END AS insurance_value_sar,
  e.warranty_until,
  e.depreciation_method,
  e.useful_life_months,
  CASE WHEN has_permission(current_effective_profile_id(), 'equipment.read.financial')
       THEN e.current_book_value_sar ELSE NULL END AS current_book_value_sar,
  e.requires_charging,
  e.last_charged_at,
  e.photo_url,
  e.manual_url,
  e.specs,
  e.is_kit_item,
  e.parent_kit_id,
  e.notes,
  e.archived_at,
  e.created_at,
  e.updated_at
FROM public.equipment e;

-- ════════════════════════════════════════════════════════════════════════════
-- 8. v_email_threads_safe — drop-in for `email_threads`. Row visibility:
--    email_threads.read.all OR (read.assigned AND viewer is assigned to the
--    thread OR to its linked project). Crew/freelancers/HR hold neither → 0 rows
--    (Part 2 §email_threads: الفريق الفني/Freelancers/تركي ❌). No column masks
--    beyond the row gate (subject/summary visible once you can see the thread).
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW public.v_email_threads_safe AS
SELECT
  et.id,
  et.gmail_thread_id,
  et.subject,
  et.project_id,
  et.lead_id,
  et.client_id,
  et.primary_contact_id,
  et.assigned_profile_id,
  et.status,
  et.message_count,
  et.last_message_at,
  et.last_inbound_at,
  et.last_outbound_at,
  et.ai_summary,
  et.ai_summary_updated_at,
  et.ai_topic_tags,
  et.created_at,
  et.updated_at
FROM public.email_threads et
WHERE
  has_permission(current_effective_profile_id(), 'email_threads.read.all')
  OR (
    has_permission(current_effective_profile_id(), 'email_threads.read.assigned')
    AND (
      et.assigned_profile_id = current_effective_profile_id()
      OR (et.project_id IS NOT NULL
          AND user_assigned_to_project(current_effective_profile_id(), et.project_id))
    )
  );

-- ════════════════════════════════════════════════════════════════════════════
-- 9. v_team_safe — drop-in for `profiles` (team views). Name/role/photo/dept/
--    position OPEN to all. email/phone visible for self OR same-dept OR team.read
--    (HR/GM). Salary is on employees.monthly_salary (NOT profiles) — exposed as
--    a joined masked column behind team.read.salaries (Test 7: حازم → NULL).
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW public.v_team_safe AS
SELECT
  pr.id,
  pr.auth_user_id,
  pr.display_name,
  pr.display_name_en,
  -- legal name: self or HR/GM (team.read)
  CASE WHEN pr.id = current_effective_profile_id()
         OR has_permission(current_effective_profile_id(), 'team.read')
       THEN pr.legal_name ELSE NULL END AS legal_name,
  pr.role,
  pr.position_key,
  pr.status,
  pr.department_id,
  pr.reports_to_id,
  pr.avatar_url,
  -- email/phone: self OR same-dept OR team.read (Part 2 §team)
  CASE WHEN pr.id = current_effective_profile_id()
         OR has_permission(current_effective_profile_id(), 'team.read')
         OR has_same_department(current_effective_profile_id(), pr.id)
       THEN pr.email ELSE NULL END AS email,
  CASE WHEN pr.id = current_effective_profile_id()
         OR has_permission(current_effective_profile_id(), 'team.read')
         OR has_same_department(current_effective_profile_id(), pr.id)
       THEN pr.phone_e164 ELSE NULL END AS phone_e164,
  CASE WHEN pr.id = current_effective_profile_id()
         OR has_permission(current_effective_profile_id(), 'team.read')
         OR has_same_department(current_effective_profile_id(), pr.id)
       THEN pr.whatsapp_e164 ELSE NULL END AS whatsapp_e164,
  pr.ui_language,
  pr.timezone,
  -- Salary (from employees) — self OR team.read.salaries (HR/GM). Test 7: حازم NULL.
  CASE WHEN pr.id = current_effective_profile_id()
         OR has_permission(current_effective_profile_id(), 'team.read.salaries')
       THEN emp.monthly_salary ELSE NULL END AS monthly_salary,
  CASE WHEN pr.id = current_effective_profile_id()
         OR has_permission(current_effective_profile_id(), 'team.read.salaries')
       THEN emp.monthly_salary_currency ELSE NULL END AS monthly_salary_currency,
  pr.created_at,
  pr.updated_at,
  pr.archived_at
FROM public.profiles pr
LEFT JOIN public.employees emp ON emp.profile_id = pr.id;
-- No row WHERE: the team directory is visible to all; sensitive *columns* masked.
