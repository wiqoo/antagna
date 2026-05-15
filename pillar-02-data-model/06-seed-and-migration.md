# Pillar 2 — Seed Data & Initial Migration

> Part of **Pillar 2 (Data Model)** — see [`../pillar-02-data-model.md`](../pillar-02-data-model.md) for overview + index.
> Sections: **§14 INITIAL SEED DATA**, **§15 INITIAL MIGRATION FROM OLD DB**.
> The team roster for the seed lives in machine-readable form at [`../config/roles.yaml`](../config/roles.yaml).

---

## 14. INITIAL SEED DATA (run after schema is created)

`packages/db/src/seed.ts` populates the static lookup tables:

- 15 capabilities (per §3.3).
- 30+ skills (Premiere Pro, DaVinci Resolve, Final Cut Pro, After Effects, Lightroom, Photoshop, drone models, camera models, sound tools, etc.).
- 5 departments (GM, OP, F_HR, MC, CREATIVE).
- 25+ notification event types (project.assigned, task.overdue, deliverable.submitted, brief.received, quote.sent, invoice.overdue, equipment.due_back, attendance.missed, ai.daily_brief_ready, etc.).
- 20+ tags (urgent, priority_high, abu_luka_content, social_only, internal, do_not_archive, etc.).
- 10+ custom_field_definitions (project: campaign_code, vehicle_model, usage_rights, social_platforms; client: agency_for_brands, primary_language).

---

## 15. INITIAL MIGRATION FROM OLD DB

Now we extend the staging table `legacy_equipment_import` (created in Pillar 1) into a full per-domain import:

| Old Supabase table | New Antagna staging | Mapping |
|---|---|---|
| `equipment` (all 162 rows where `effective_status != 'lost'`) | `legacy_equipment_import` → `equipment` | Map status, group by category to `equipment_groups`, generate new `code` with prefix |
| `clients` where active (project in last 12 months) | `legacy_clients_import` → `clients` | Preserve name, set `is_agency` from old data, generate new `code` from name |
| `client_contacts` for active clients | `legacy_contacts_import` → `contacts` + `contact_methods` (split emails/phones into rows) | |
| `projects` where stage in (brief, quoted, approved, planning, shooting, editing, review) | `legacy_projects_import` → `projects` | Map old stages to new enum; deliverables NOT migrated, recreated as needed |

The migration script runs in two phases:
1. **Dry-run**: write to `legacy_*_import` tables, report counts + integrity issues.
2. **Apply**: with `--confirm` flag, move from staging into real tables.

Migration runs ONCE before launch. Old DB stays read-only for reference.

---

