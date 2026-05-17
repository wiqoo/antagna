-- Pillar 3 §7 — refine baseline RLS using has_permission / has_capability /
-- is_assigned_to_project. Replaces the Pillar 2 baseline "write=is_admin_caller"
-- with permission-aware checks on the most-touched tables.
--
-- Pattern: read = authenticated; write = permission OR capability check.
-- (Pillar 3 leaves the baseline in place for tables not listed here; later
-- pillars will refine more as feature work demands.)

-- ── projects ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS projects_admin_write ON public.projects;

DROP POLICY IF EXISTS projects_insert ON public.projects;
CREATE POLICY projects_insert ON public.projects
  FOR INSERT WITH CHECK (public.current_user_has_permission('project.create'));

DROP POLICY IF EXISTS projects_update ON public.projects;
CREATE POLICY projects_update ON public.projects
  FOR UPDATE
  USING (
    public.current_user_has_permission('project.update_any')
    OR (
      public.current_user_has_permission('project.update')
      AND public.current_user_is_assigned_to_project(id)
    )
  )
  WITH CHECK (
    public.current_user_has_permission('project.update_any')
    OR (
      public.current_user_has_permission('project.update')
      AND public.current_user_is_assigned_to_project(id)
    )
  );

DROP POLICY IF EXISTS projects_delete ON public.projects;
CREATE POLICY projects_delete ON public.projects
  FOR DELETE USING (public.current_user_has_permission('project.delete'));

-- ── project_assignments ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS project_assignments_admin_write ON public.project_assignments;

DROP POLICY IF EXISTS project_assignments_write ON public.project_assignments;
CREATE POLICY project_assignments_write ON public.project_assignments
  FOR ALL USING (public.current_user_has_permission('project.assign'))
  WITH CHECK (public.current_user_has_permission('project.assign'));

-- ── project_tasks ─────────────────────────────────────────────────────────────
-- Assignees + people with project.update on the project can write tasks.
DROP POLICY IF EXISTS project_tasks_admin_write ON public.project_tasks;

DROP POLICY IF EXISTS project_tasks_write ON public.project_tasks;
CREATE POLICY project_tasks_write ON public.project_tasks
  FOR ALL USING (
    public.current_user_has_permission('project.update_any')
    OR public.current_user_is_assigned_to_project(project_id)
    OR assignee_id = public.current_profile_id()
  )
  WITH CHECK (
    public.current_user_has_permission('project.update_any')
    OR public.current_user_is_assigned_to_project(project_id)
    OR assignee_id = public.current_profile_id()
  );

-- ── project_comments ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS project_comments_admin_write ON public.project_comments;

DROP POLICY IF EXISTS project_comments_write ON public.project_comments;
CREATE POLICY project_comments_write ON public.project_comments
  FOR ALL USING (
    author_id = public.current_profile_id()
    OR public.current_user_has_permission('project.update_any')
  )
  WITH CHECK (
    author_id = public.current_profile_id()
    OR public.current_user_has_permission('project.update_any')
  );

-- ── clients ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS clients_admin_write ON public.clients;

DROP POLICY IF EXISTS clients_insert ON public.clients;
CREATE POLICY clients_insert ON public.clients
  FOR INSERT WITH CHECK (public.current_user_has_permission('client.create'));

DROP POLICY IF EXISTS clients_update ON public.clients;
CREATE POLICY clients_update ON public.clients
  FOR UPDATE USING (public.current_user_has_permission('client.update'))
  WITH CHECK (public.current_user_has_permission('client.update'));

DROP POLICY IF EXISTS clients_delete ON public.clients;
CREATE POLICY clients_delete ON public.clients
  FOR DELETE USING (public.current_user_has_permission('client.merge'));

-- ── contacts + contact_methods ────────────────────────────────────────────────
DROP POLICY IF EXISTS contacts_admin_write ON public.contacts;
DROP POLICY IF EXISTS contacts_write ON public.contacts;
CREATE POLICY contacts_write ON public.contacts
  FOR ALL USING (
    public.current_user_has_permission('contact.create')
    OR public.current_user_has_permission('contact.update')
  )
  WITH CHECK (
    public.current_user_has_permission('contact.create')
    OR public.current_user_has_permission('contact.update')
  );

DROP POLICY IF EXISTS contact_methods_admin_write ON public.contact_methods;
DROP POLICY IF EXISTS contact_methods_write ON public.contact_methods;
CREATE POLICY contact_methods_write ON public.contact_methods
  FOR ALL USING (
    public.current_user_has_permission('contact.create')
    OR public.current_user_has_permission('contact.update')
  )
  WITH CHECK (
    public.current_user_has_permission('contact.create')
    OR public.current_user_has_permission('contact.update')
  );

-- ── briefs + deliverable_groups + deliverables + revisions ────────────────────
DROP POLICY IF EXISTS briefs_admin_write ON public.briefs;
DROP POLICY IF EXISTS briefs_write ON public.briefs;
CREATE POLICY briefs_write ON public.briefs
  FOR ALL USING (
    public.current_user_has_permission('brief.create')
    AND public.current_user_is_assigned_to_project(project_id)
  )
  WITH CHECK (
    public.current_user_has_permission('brief.create')
    AND public.current_user_is_assigned_to_project(project_id)
  );

DROP POLICY IF EXISTS deliverable_groups_admin_write ON public.deliverable_groups;
DROP POLICY IF EXISTS deliverable_groups_write ON public.deliverable_groups;
CREATE POLICY deliverable_groups_write ON public.deliverable_groups
  FOR ALL USING (
    public.current_user_has_permission('deliverable.update')
    AND public.current_user_is_assigned_to_project(project_id)
  )
  WITH CHECK (
    public.current_user_has_permission('deliverable.update')
    AND public.current_user_is_assigned_to_project(project_id)
  );

DROP POLICY IF EXISTS deliverables_admin_write ON public.deliverables;
DROP POLICY IF EXISTS deliverables_write ON public.deliverables;
CREATE POLICY deliverables_write ON public.deliverables
  FOR ALL USING (
    public.current_user_has_permission('deliverable.update')
    AND public.current_user_is_assigned_to_project(project_id)
  )
  WITH CHECK (
    public.current_user_has_permission('deliverable.update')
    AND public.current_user_is_assigned_to_project(project_id)
  );

DROP POLICY IF EXISTS revision_rounds_admin_write ON public.revision_rounds;
DROP POLICY IF EXISTS revision_rounds_write ON public.revision_rounds;
CREATE POLICY revision_rounds_write ON public.revision_rounds
  FOR ALL USING (
    public.current_user_has_permission('revision.start')
    OR public.current_user_has_permission('revision.resolve')
  )
  WITH CHECK (
    public.current_user_has_permission('revision.start')
    OR public.current_user_has_permission('revision.resolve')
  );

DROP POLICY IF EXISTS revision_items_admin_write ON public.revision_items;
DROP POLICY IF EXISTS revision_items_write ON public.revision_items;
CREATE POLICY revision_items_write ON public.revision_items
  FOR ALL USING (
    public.current_user_has_permission('revision.start')
    OR public.current_user_has_permission('revision.resolve')
  )
  WITH CHECK (
    public.current_user_has_permission('revision.start')
    OR public.current_user_has_permission('revision.resolve')
  );

-- ── internal_approvals (reviewers only + admin) ──────────────────────────────
DROP POLICY IF EXISTS internal_approvals_admin_write ON public.internal_approvals;
DROP POLICY IF EXISTS internal_approvals_write ON public.internal_approvals;
CREATE POLICY internal_approvals_write ON public.internal_approvals
  FOR UPDATE USING (
    reviewer_profile_id = public.current_profile_id()
    OR public.current_user_has_permission('deliverable.approve')
  )
  WITH CHECK (
    reviewer_profile_id = public.current_profile_id()
    OR public.current_user_has_permission('deliverable.approve')
  );

DROP POLICY IF EXISTS internal_approvals_insert ON public.internal_approvals;
CREATE POLICY internal_approvals_insert ON public.internal_approvals
  FOR INSERT WITH CHECK (public.current_user_has_permission('deliverable.update'));

-- ── money tables ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS quotes_admin_write ON public.quotes;
DROP POLICY IF EXISTS quotes_write ON public.quotes;
CREATE POLICY quotes_write ON public.quotes
  FOR ALL USING (
    public.current_user_has_permission('quote.create')
    OR public.current_user_has_permission('quote.send')
  )
  WITH CHECK (
    public.current_user_has_permission('quote.create')
    OR public.current_user_has_permission('quote.send')
  );

DROP POLICY IF EXISTS invoices_admin_write ON public.invoices;
DROP POLICY IF EXISTS invoices_write ON public.invoices;
CREATE POLICY invoices_write ON public.invoices
  FOR ALL USING (
    public.current_user_has_permission('invoice.issue')
    OR public.current_user_has_permission('invoice.cancel')
  )
  WITH CHECK (
    public.current_user_has_permission('invoice.issue')
    OR public.current_user_has_permission('invoice.cancel')
  );

DROP POLICY IF EXISTS payments_admin_write ON public.payments;
DROP POLICY IF EXISTS payments_write ON public.payments;
CREATE POLICY payments_write ON public.payments
  FOR ALL USING (public.current_user_has_permission('payment.record'))
  WITH CHECK (public.current_user_has_permission('payment.record'));

-- ── equipment + reservations + kits ───────────────────────────────────────────
DROP POLICY IF EXISTS equipment_admin_write ON public.equipment;
DROP POLICY IF EXISTS equipment_write ON public.equipment;
CREATE POLICY equipment_write ON public.equipment
  FOR ALL USING (
    public.current_user_has_capability('equipment_manager')
    OR public.current_user_has_permission('equipment.update')
  )
  WITH CHECK (
    public.current_user_has_capability('equipment_manager')
    OR public.current_user_has_permission('equipment.update')
  );

DROP POLICY IF EXISTS equipment_reservations_admin_write ON public.equipment_reservations;
DROP POLICY IF EXISTS equipment_reservations_write ON public.equipment_reservations;
CREATE POLICY equipment_reservations_write ON public.equipment_reservations
  FOR ALL USING (
    public.current_user_has_permission('equipment.reserve')
    OR public.current_user_has_capability('equipment_manager')
  )
  WITH CHECK (
    public.current_user_has_permission('equipment.reserve')
    OR public.current_user_has_capability('equipment_manager')
  );

DROP POLICY IF EXISTS kits_admin_write ON public.kits;
DROP POLICY IF EXISTS kits_write ON public.kits;
CREATE POLICY kits_write ON public.kits
  FOR ALL USING (
    public.current_user_has_capability('equipment_manager')
    OR public.current_user_has_permission('equipment.update')
  )
  WITH CHECK (
    public.current_user_has_capability('equipment_manager')
    OR public.current_user_has_permission('equipment.update')
  );

-- ── profiles role-change still trigger-enforced (Pillar 1 §B.4) ───────────────
-- The fn_block_self_role_escalation trigger from migration 00004 already
-- prevents self-promotion. Admin path is via has_permission('user.update_role').

-- ── new permission tables themselves: read for authenticated, write admin ─────

ALTER TABLE public.permissions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_default_permissions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS permissions_read ON public.permissions;
CREATE POLICY permissions_read ON public.permissions
  FOR SELECT USING (auth.role() = 'authenticated' OR public.is_admin_caller());

DROP POLICY IF EXISTS permissions_admin_write ON public.permissions;
CREATE POLICY permissions_admin_write ON public.permissions
  FOR ALL USING (public.is_admin_caller()) WITH CHECK (public.is_admin_caller());

DROP POLICY IF EXISTS rdp_read ON public.role_default_permissions;
CREATE POLICY rdp_read ON public.role_default_permissions
  FOR SELECT USING (auth.role() = 'authenticated' OR public.is_admin_caller());

DROP POLICY IF EXISTS rdp_admin_write ON public.role_default_permissions;
CREATE POLICY rdp_admin_write ON public.role_default_permissions
  FOR ALL USING (public.is_admin_caller()) WITH CHECK (public.is_admin_caller());

-- user_permission_overrides: read own + admin; write admin only.
DROP POLICY IF EXISTS upo_self_read ON public.user_permission_overrides;
CREATE POLICY upo_self_read ON public.user_permission_overrides
  FOR SELECT USING (
    profile_id = public.current_profile_id() OR public.is_admin_caller()
  );

DROP POLICY IF EXISTS upo_admin_write ON public.user_permission_overrides;
CREATE POLICY upo_admin_write ON public.user_permission_overrides
  FOR ALL USING (public.current_user_has_permission('user.update_role') OR public.is_admin_caller())
  WITH CHECK (public.current_user_has_permission('user.update_role') OR public.is_admin_caller());
