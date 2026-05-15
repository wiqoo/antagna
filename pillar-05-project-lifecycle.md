# Pillar 5 — Project Lifecycle

**Status:** Planning
**Depends on:** Pillars 1-4
**Estimated effort:** 3-4 sessions (the longest feature pillar)

The heart of the system. Replicates and structures Volt's existing 11-stage project flow, but with state-machine enforcement, auto-advance triggers, deliverables review (Sheet-pattern → first-class feature), and the share-token client portal.

---

## 1. Goals

- Project state machine **enforced in SQL** — illegal transitions rejected at DB level.
- Auto-advance: when conditions hold (e.g., all deliverables = `delivered`), project auto-moves to `delivered`.
- Native deliverables review interface replacing the Hara_BMW spreadsheet pattern.
- Public client portal via `share_token` (no client login required).
- Project templates: 1-click create from a template (e.g., "Standard 1-day shoot").
- Stage-task templates: when project enters `planning`, auto-create canonical tasks.
- Recurrence: monthly retainers, weekly Lexus stories, etc.

## 2. Success Criteria

1. Create project from `STD_SHOOT_1DAY` template → all standard tasks + deliverables auto-created.
2. Try to move project from `delivered` → `editing` → rejected with helpful error.
3. Mark all deliverables `delivered` → project auto-moves to `delivered` stage → activity event fires → client notification queued.
4. Share token rotated → old URL returns 404 → new URL works.
5. Client view via `share_token` shows project status + deliverables (no auth, restricted fields).
6. Recurrence rule generates next occurrence after current closes.

---

## 3. Schema Additions

Most project tables are in Pillar 2. Here we add the workflow-specific pieces.

### 3.1 `stage_task_templates`

```typescript
export const stageTaskTemplates = pgTable("stage_task_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  stage: projectStageEnum("stage").notNull(),
  titleAr: text("title_ar").notNull(),
  titleEn: text("title_en"),
  description: text("description"),
  assigneeRoleHint: projectAssignmentRoleEnum("assignee_role_hint"),
  dueOffsetDays: integer("due_offset_days"),                // relative to stage entry
  isMandatory: boolean("is_mandatory").notNull().default(false),
  position: integer("position").notNull().default(0),
  active: boolean("active").notNull().default(true),
});
```

Seed (canonical task list per stage):

| Stage | Tasks |
|-------|-------|
| `brief` | "Verify brief completeness", "Schedule internal review meeting", "Send acknowledgement to client" |
| `quoted` | "Prepare cost sheet", "Get internal sign-off (PM + GM)", "Send quote to client" |
| `approved` | "Receive PO", "Confirm dates", "Lock crew + equipment + locations" |
| `planning` | "Crew briefing", "Location scout", "Equipment list final", "Travel + accommodation", "Permits", "Pre-prod meeting" |
| `shooting` | "Daily call sheet", "Equipment check-in/out", "BTS captured", "Footage backed up daily" |
| `editing` | "Selects", "First cut", "Color grade", "Sound mix", "Master export" |
| `review` | "Submit to client", "Track feedback rounds", "Apply revisions" |
| `delivered` | "Final delivery", "Generate invoice", "Project archive prep" |

### 3.2 `project_recurrence_rules` (clean separation from `projects.recurrence_rule` text)

```typescript
export const projectRecurrenceRules = pgTable("project_recurrence_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateProjectId: uuid("template_project_id").notNull().references(() => projects.id),
  rrule: text("rrule").notNull(),                           // 'FREQ=MONTHLY;INTERVAL=1', etc.
  nextOccurrenceAt: timestamp("next_occurrence_at", { withTimezone: true }),
  lastSpawnedAt: timestamp("last_spawned_at", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
});
```

A Trigger.dev scheduled task runs hourly and spawns new project rows from templates whose `nextOccurrenceAt <= now()`.

### 3.3 `project_share_views` (per-link customization)

```typescript
export const projectShareViews = pgTable("project_share_views", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  shareToken: uuid("share_token").notNull().unique().defaultRandom(),
  audienceLabel: text("audience_label"),                    // "Client", "Agency Review", "Stakeholder Group X"
  showSections: text("show_sections").array().notNull().default(sql`ARRAY['overview','deliverables']::text[]`),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

This replaces the single `projects.share_token` from Pillar 2 — letting multiple links exist per project, each with different audience scope.

---

## 4. The State Machine Enforcement

```sql
CREATE OR REPLACE FUNCTION fn_check_project_stage_transition() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_allowed boolean := false;
BEGIN
  IF OLD.stage = NEW.stage THEN RETURN NEW; END IF;

  v_allowed := CASE
    -- Forward path
    WHEN OLD.stage = 'lead' AND NEW.stage IN ('brief', 'lost')                 THEN true
    WHEN OLD.stage = 'brief' AND NEW.stage IN ('quoted', 'lost', 'cancelled')  THEN true
    WHEN OLD.stage = 'quoted' AND NEW.stage IN ('approved', 'lost', 'cancelled') THEN true
    WHEN OLD.stage = 'approved' AND NEW.stage IN ('planning', 'cancelled')     THEN true
    WHEN OLD.stage = 'planning' AND NEW.stage IN ('shooting', 'cancelled')     THEN true
    WHEN OLD.stage = 'shooting' AND NEW.stage IN ('editing', 'cancelled')      THEN true
    WHEN OLD.stage = 'editing' AND NEW.stage IN ('review', 'shooting')         THEN true  -- backwards allowed
    WHEN OLD.stage = 'review' AND NEW.stage IN ('delivered', 'editing')        THEN true  -- backwards for revisions
    WHEN OLD.stage = 'delivered' AND NEW.stage IN ('archived')                 THEN true
    WHEN OLD.stage = 'lost' AND NEW.stage IN ('brief')                         THEN true  -- reopen allowed
    -- Admin override
    WHEN is_admin_caller()                                                      THEN true
    ELSE false
  END;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Invalid stage transition: % -> %', OLD.stage, NEW.stage USING HINT = 'Use admin override or correct prior stage';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER tg_check_project_stage BEFORE UPDATE OF stage ON projects
FOR EACH ROW EXECUTE FUNCTION fn_check_project_stage_transition();
```

---

## 5. Auto-Advance Logic

```sql
-- When all deliverables in a project are 'delivered', advance project to 'delivered'
CREATE OR REPLACE FUNCTION fn_check_project_auto_deliver() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_total int;
  v_delivered int;
  v_project_stage project_stage;
BEGIN
  IF NEW.status <> 'delivered' THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_total FROM deliverables WHERE project_id = NEW.project_id;
  SELECT COUNT(*) INTO v_delivered FROM deliverables
   WHERE project_id = NEW.project_id AND status = 'delivered';

  IF v_total > 0 AND v_total = v_delivered THEN
    SELECT stage INTO v_project_stage FROM projects WHERE id = NEW.project_id;
    IF v_project_stage = 'review' THEN
      UPDATE projects SET stage = 'delivered', delivered_at = now() WHERE id = NEW.project_id;
      INSERT INTO activity_events (entity_type, entity_id, project_id, action, summary_ar, summary_en, metadata)
      VALUES ('project', NEW.project_id, NEW.project_id, 'auto_advanced',
              'تم تسليم كل المخرجات، المشروع انتقل لحالة "تم التسليم"',
              'All deliverables completed; project moved to delivered',
              jsonb_build_object('auto', true));
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER tg_auto_deliver AFTER UPDATE OF status ON deliverables
FOR EACH ROW EXECUTE FUNCTION fn_check_project_auto_deliver();
```

---

## 6. Stage-Entry Hook

When a project ENTERS a stage, auto-spawn the canonical tasks for that stage.

```sql
CREATE OR REPLACE FUNCTION fn_spawn_stage_tasks() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    INSERT INTO project_tasks (project_id, title, description, status, position, ai_suggested, due_at)
    SELECT NEW.id,
           stt.title_ar,
           stt.description,
           'pending'::task_status,
           stt.position,
           false,
           CASE WHEN stt.due_offset_days IS NULL THEN NULL
                ELSE now() + (stt.due_offset_days || ' days')::interval END
    FROM stage_task_templates stt
    WHERE stt.stage = NEW.stage AND stt.active = true;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER tg_spawn_stage_tasks AFTER UPDATE OF stage ON projects
FOR EACH ROW EXECUTE FUNCTION fn_spawn_stage_tasks();
```

---

## 7. Project Templates → New Project

`fn_create_project_from_template(template_id, client_id, title)`:
- Inserts new project at stage `brief`.
- Applies template's `payload` jsonb: pre-seeds tasks, deliverable groups, default assignments.
- Auto-creates Drive folder (via Trigger.dev task in Pillar 13).
- Returns new project ID.

---

## 8. The Client Portal (`/p/[share_token]`)

Public Next.js route, NO auth required:

```typescript
// apps/web/src/app/p/[token]/page.tsx
export default async function ProjectShareView({ params }: { params: { token: string } }) {
  const supabase = createServerClient(/* */);
  const { data } = await supabase.rpc('fn_get_shared_project', { token_in: params.token });

  if (!data || data.expired) return <NotFoundOrExpired />;

  return (
    <PortalShell project={data}>
      <PortalOverview />
      <PortalDeliverables />
      <PortalTimeline />
    </PortalShell>
  );
}
```

`fn_get_shared_project` is `SECURITY DEFINER`, validates token + expiry, returns a redacted JSON of project + deliverables (no internal notes, no costs).

---

## 9. Deliverables Review (replaces Hara_BMW spreadsheet)

UI in Pillar 12 — backend in Pillar 5:

- Each project's deliverables list rendered as a table.
- Per-row inline status pill, client note input, version preview, history toggle.
- Internal team can: mark version updated, set status, add internal note.
- Client (via share token): can view, add client notes, approve/reject.
- All edits flow through `deliverables` + `revision_items` tables → audit + activity event per change.

---

## 10. Acceptance Checklist

- [ ] `stage_task_templates`, `project_recurrence_rules`, `project_share_views` tables + RLS.
- [ ] Seed: ~25 stage task templates (per §3.1 table).
- [ ] State-machine trigger rejects illegal transitions (test 5 invalid + 5 valid).
- [ ] `fn_check_project_auto_deliver` fires correctly on full-deliverables-delivered.
- [ ] `fn_spawn_stage_tasks` creates expected tasks on stage entry.
- [ ] `fn_create_project_from_template` creates project + tasks + deliverable groups in one call.
- [ ] `fn_rotate_project_share_token` rotates, old token returns null.
- [ ] Public portal at `/p/<token>` renders project for unauthenticated visitor; redacts internal fields.
- [ ] Recurrence scheduled task spawns next occurrence on schedule.
- [ ] Audit log records every stage transition + deliverable status change.

---

## 11. Deferred

- **Drive folder auto-creation** → Pillar 13.
- **Calendar event auto-creation** → Pillar 13.
- **Deliverables UI** → Pillar 12.
- **AI brief parsing into structured deliverable groups** → Pillar 10.
- **Client portal UI polish + multi-language** → Pillar 12.

---

## 12. Next: Pillar 6 — Equipment & Reservations

Extends the equipment model with kit smart-suggest, compatibility rules (lessons learned from old schema), the 1-day-rule enforcement, location auto-sync, repair workflow.
