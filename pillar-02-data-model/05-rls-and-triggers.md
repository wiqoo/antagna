# Pillar 2 — RLS & Triggers

> Part of **Pillar 2 (Data Model)** — see [`../pillar-02-data-model.md`](../pillar-02-data-model.md) for overview + index.
> Sections: **§11 RLS STRATEGY SUMMARY**, **§12 TRIGGER CATALOG**.
> ⚠️ Patched per Pillar 16 §B.4 — `OLD.role` enforcement moved from RLS to `fn_block_self_role_escalation` trigger.

---

## 11. RLS STRATEGY SUMMARY

| Table | Read | Write |
|-------|------|-------|
| profiles | authenticated | self (limited fields) or admin |
| employees | self or hr or admin | hr or admin |
| capabilities, skills, departments | authenticated | admin |
| user_capabilities, user_skills | authenticated | self or admin |
| clients, contacts, contact_methods | authenticated | manager+ or admin |
| agency_brand_links | authenticated | manager+ or admin |
| projects | authenticated | account/project/production manager assigned OR admin |
| project_assignments | authenticated | assigned PM/AM/admin |
| project_tasks, project_comments | authenticated | assignees or admin |
| daily_tasks | self (owner or assigner) or admin | self or admin |
| briefs | authenticated | assignees or admin |
| deliverables, revision_rounds | authenticated | assignees or admin |
| quotes, invoices, payments | assigned + finance + admin | account_manager + finance + admin |
| equipment, kits | authenticated | equipment_manager + manager+ + admin |
| equipment_reservations | authenticated | reserver OR equipment_manager OR admin |
| attachments | authenticated (read), entity-scoped write | entity-scoped |
| tags, tag_assignments | authenticated | authenticated for assignments; admin for tag defs |
| custom_field_definitions, custom_field_values | authenticated | admin for defs; entity-scoped for values |
| external_links | authenticated | entity-scoped |
| notifications | self only | server (trigger) only |
| notification_subscriptions | self | self |
| activity_events | authenticated | server (trigger) only |

All policies will be implemented via `helpers.sql` functions established in Pillar 1: `is_admin_caller()`, `can_manage_business()`, `is_assigned_to_project(project_id)`, `has_capability('equipment_manager')`, etc.

---

## 12. TRIGGER CATALOG

| Trigger | Table | When | Purpose |
|---------|-------|------|---------|
| `tg_audit_row_change` | every table | AFTER INSERT/UPDATE/DELETE | Write to audit_log |
| `tg_set_updated_at` | every table with `updated_at` | BEFORE UPDATE | Set `updated_at = now()` |
| `tg_normalize_contact_method` | contact_methods | BEFORE INSERT/UPDATE | Lowercase emails, E.164 phones |
| `tg_enforce_agency_brand_roles` | agency_brand_links | BEFORE INSERT/UPDATE | Verify agency/brand flags |
| `tg_auto_create_employee` | profiles | AFTER INSERT | Create matching employees row |
| `tg_log_project_stage` | projects | AFTER UPDATE OF stage | Insert into project_stages_log |
| `tg_check_project_stage_transition` | projects | BEFORE UPDATE OF stage | Reject illegal transitions |
| `tg_invalidate_project_ai_status` | projects, project_tasks, deliverables | AFTER state-relevant change | Set projects.ai_analyzed_at = NULL |
| `tg_bump_deliverable_version` | deliverables | BEFORE UPDATE | Increment version on URL change |
| `tg_check_project_auto_deliver` | deliverables | AFTER UPDATE OF status | Advance project to 'delivered' when all are |
| `tg_sync_equipment_location` | equipment_reservations | AFTER INSERT/UPDATE/DELETE | Call fn_sync_equipment_location |
| `tg_log_equipment_status` | equipment | AFTER UPDATE | Insert into equipment_activity_log |
| `tg_invoice_status_from_payments` | payments | AFTER INSERT/UPDATE/DELETE | Recompute invoice.paid_sar + status |
| `tg_quote_total_from_lines` | quote_line_items | AFTER INSERT/UPDATE/DELETE | Recompute quote totals |
| `tg_emit_activity_on_status` | many | AFTER UPDATE of status | Insert into activity_events with Arabic summary |

A single Drizzle migration file per pillar attaches these. They are NOT in Drizzle schema — they're raw SQL in the migration.

---

