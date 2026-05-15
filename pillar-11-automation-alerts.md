# Pillar 11 — Automation & Alerts Engine

**Status:** Planning
**Depends on:** Pillars 1-10
**Estimated effort:** 2-3 sessions

The system that turns Mohammed's stated requirement ("zero human errors, follow-up automatic, never forget anything") into rules + scheduled scanners. Everything that should NOT depend on a human remembering is implemented here.

---

## 1. Goals

- A central **rules engine** for alerts (declarative — not buried in code).
- **Escalation chains**: if X is overdue for 1 day, notify A; for 3 days, notify A's manager; for 7 days, notify admin.
- **Auto-actions** with human approval gates: drafts get sent only after a quick OK.
- **Snooze + acknowledge** patterns so the system isn't naggy.
- **Per-user notification preferences** respected.

## 2. Success Criteria

1. Invoice overdue by 30 days → chase email drafted → Mansoury gets WhatsApp "approve?" → 1-tap approve → email goes.
2. Project in `review` stage with no client reply in 5 days → insight + notification.
3. Battery never charged in 30 days → daily Musa3ed alert until acknowledged.
4. Late check-in for a scheduled shoot → notification within 15 minutes.
5. Snooze a notification for 4 hours → it re-fires after 4 hours.

---

## 3. Schema

### 3.1 `alert_rules` (declarative)

```typescript
export const alertRuleTriggerTypeEnum = pgEnum("alert_rule_trigger_type", [
  "schedule",     // cron-based scan
  "event",        // fires on DB event
  "threshold"     // fires when computed value crosses
]);

export const alertRules = pgTable("alert_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),                      // 'invoice_overdue_30d', 'project_stalled_7d', 'battery_stale_30d'
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en"),
  description: text("description"),

  triggerType: alertRuleTriggerTypeEnum("trigger_type").notNull(),
  triggerSpec: jsonb("trigger_spec").notNull(),
  /* triggerSpec examples:
     schedule: { cron: "0 9 * * *", query: "SELECT id FROM invoices WHERE status='issued' AND due_at < now() - interval '30 days'" }
     event:    { tableName: "deliverables", whenStatus: "needs_revision" }
     threshold: { metricKey: "client_avg_payment_days", op: ">", value: 90 }
  */

  // What to do when triggered
  notificationEventKey: text("notification_event_key").references(() => notificationEventTypes.key),
  recipientStrategy: text("recipient_strategy").notNull(),  // 'assignee' | 'pm' | 'am' | 'admin' | 'role:<role>' | 'capability:<cap>'

  // Escalation
  escalationChain: jsonb("escalation_chain"),
  /* Example: [
       { afterMinutes: 0, recipientStrategy: "assignee" },
       { afterMinutes: 1440, recipientStrategy: "pm" },
       { afterMinutes: 4320, recipientStrategy: "admin" }
     ] */

  // Auto-action (optional)
  autoAction: jsonb("auto_action"),
  /* Example: { type: "draft_email", templateKey: "chase_30d", requiresApproval: true } */

  // Cooldown — don't refire for same entity within window
  cooldownMinutes: integer("cooldown_minutes").notNull().default(60),

  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### 3.2 `alert_fires` (audit of every fire)

```typescript
export const alertFires = pgTable("alert_fires", {
  id: bigserial("id").primaryKey(),
  ruleKey: text("rule_key").notNull().references(() => alertRules.key),

  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),

  notifiedProfileIds: uuid("notified_profile_ids").array(),
  escalationStep: integer("escalation_step").notNull().default(0),

  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  acknowledgedById: uuid("acknowledged_by_id").references(() => profiles.id),
  snoozedUntil: timestamp("snoozed_until", { withTimezone: true }),

  autoActionTaken: text("auto_action_taken"),               // null | 'draft_created' | 'email_sent' | 'task_created'
  autoActionRefId: uuid("auto_action_ref_id"),               // FK to draft/task

  metadata: jsonb("metadata"),
  firedAt: timestamp("fired_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byEntity: index("fires_by_entity").on(t.entityType, t.entityId, t.firedAt.desc()),
  byRule: index("fires_by_rule").on(t.ruleKey, t.firedAt.desc()),
}));
```

### 3.3 `chase_templates` (deferred to Pillar 8 for the actual templates; here we add the rules around them)

The chase logic is `alert_rules` with `autoAction.type = 'draft_email'`. Already covered by §3.1.

---

## 4. Seed: Initial Alert Rules

Loaded by Pillar 11 migration.

| key | trigger | recipient | escalation | auto-action |
|-----|---------|-----------|------------|-------------|
| `invoice_overdue_30d` | schedule daily 9am | AM of client | +3d to PM, +7d to admin | draft chase_30d, requires approval |
| `invoice_overdue_60d` | schedule daily 9am | AM + finance | escalate to GM | draft chase_60d, requires approval |
| `project_stalled_7d` | schedule daily 9am | PM | +2d to GM | none (insight + notify only) |
| `project_no_client_reply_5d` | schedule daily 9am | AM | +2d to PM | suggest follow-up template |
| `deliverable_revision_pending_3d` | schedule daily 9am | assigned editor | +2d to PM | reminder DM |
| `battery_stale_30d` | schedule daily 9am | Musa3ed | +3d to admin | none |
| `battery_never_charged` | schedule daily 9am | Musa3ed | none | none |
| `equipment_repair_unreturned_30d` | schedule daily 9am | Musa3ed + admin | none | none |
| `quote_expiring_3d` | schedule daily 9am | AM | none | reminder note |
| `lead_no_followup_3d` | schedule daily 9am | assignee | +1d to PM | suggest follow-up template |
| `lead_ghosted_14d` | schedule daily 9am | assignee | none | mark lead status='ghosted' (auto) |
| `shoot_starts_in_24h_unconfirmed` | schedule hourly | PM + crew | escalate to admin | none |
| `attendance_late_30min` | event (no check-in by 30 min after scheduled start) | self + HR | +1h to PM | none |
| `attendance_flagged_low_match` | event (verification = flagged_*) | HR | none | none |
| `vendor_onboarding_packet_resent` | event (new contact at new client) | AM | none | suggest send onboarding packet |
| `client_health_drop` | threshold (avg_payment_days crosses 90) | AM | escalate to admin | none |
| `daily_user_brief_ready` | event (daily_briefs insert) | self | none | none |
| `client_first_email_response_due` | schedule hourly (acknowledgement should be within 4h of inbound) | assigned profile | escalate to PM | suggest acknowledgement template |
| `recurring_project_about_to_spawn` | schedule daily | AM | none | preview next occurrence |
| `kit_suggestion_unconsumed` | event (FX6 reserved without bundled items) | reserver | none | offer kit suggestions |

---

## 5. The Scanner

`apps/worker/src/trigger/alert-scanner.ts`:

```typescript
export const alertScanner = task({
  id: "alert-scanner",
  schedules: [{ cron: "*/5 * * * *" }],
  run: async () => {
    const rules = await db.query.alertRules.findMany({
      where: and(eq(alertRules.active, true), eq(alertRules.triggerType, "schedule")),
    });

    for (const rule of rules) {
      // Run the rule's SQL to get candidate entities
      const candidates = await db.execute(sql.raw(rule.triggerSpec.query));

      for (const entity of candidates) {
        // Check cooldown
        const lastFire = await db.query.alertFires.findFirst({
          where: and(
            eq(alertFires.ruleKey, rule.key),
            eq(alertFires.entityId, entity.id),
            gt(alertFires.firedAt, subMinutes(new Date(), rule.cooldownMinutes))
          ),
        });
        if (lastFire) continue;

        // Resolve recipients per strategy
        const recipients = await resolveRecipients(rule, entity);

        // Fire
        const fire = await db.insert(alertFires).values({
          ruleKey: rule.key,
          entityType: rule.triggerSpec.entityType,
          entityId: entity.id,
          notifiedProfileIds: recipients,
          escalationStep: 0,
        }).returning();

        // Send notifications
        for (const recipientId of recipients) {
          await sendNotification({
            recipientId,
            eventKey: rule.notificationEventKey,
            entityType: rule.triggerSpec.entityType,
            entityId: entity.id,
          });
        }

        // Auto-action?
        if (rule.autoAction) {
          await executeAutoAction(rule.autoAction, entity, fire[0].id);
        }
      }
    }
  },
});
```

---

## 6. Escalation Worker

`apps/worker/src/trigger/escalation-worker.ts` (runs every 30 min):

For each open alert (not acknowledged, not snoozed), check if escalation step should advance:

```typescript
for (const fire of openFires) {
  const rule = ruleByKey[fire.ruleKey];
  const nextStep = rule.escalationChain[fire.escalationStep + 1];
  if (!nextStep) continue;
  if (fire.firedAt < subMinutes(new Date(), nextStep.afterMinutes)) continue;

  const recipients = await resolveRecipients({ ...rule, recipientStrategy: nextStep.recipientStrategy }, fire);
  await sendNotificationToList(recipients, { ... });
  await db.update(alertFires).set({
    escalationStep: fire.escalationStep + 1,
    notifiedProfileIds: [...fire.notifiedProfileIds, ...recipients],
  }).where(eq(alertFires.id, fire.id));
}
```

---

## 7. Auto-Actions

When `rule.autoAction.type === 'draft_email'`:

```typescript
async function executeAutoAction(autoAction, entity, fireId) {
  if (autoAction.type === 'draft_email') {
    const draft = await createTemplatedDraft({
      templateKey: autoAction.templateKey,
      contextEntity: entity,
      requiresReview: autoAction.requiresApproval ?? true,
    });
    await db.update(alertFires).set({
      autoActionTaken: 'draft_created',
      autoActionRefId: draft.id,
    }).where(eq(alertFires.id, fireId));

    // Notify assignee with one-tap approve
    await sendNotification({
      eventKey: 'auto_draft_awaiting_approval',
      linkUrl: `/app/drafts/${draft.id}`,
    });
  }

  if (autoAction.type === 'create_task') { /* ... */ }
  if (autoAction.type === 'tag_entity') { /* ... */ }
  if (autoAction.type === 'change_stage') { /* ... only if pre-approved */ }
}
```

---

## 8. Snooze / Acknowledge

UI exposes:
- **Acknowledge**: marks `alert_fires.acknowledged_at = now()`. No future fires for that entity until cooldown reset.
- **Snooze**: marks `alert_fires.snoozed_until = X`. Hidden from UI until then. Same rule won't re-fire until snooze expires.
- **Dismiss with reason**: requires text input. Logs to `audit_log` for analytics.

---

## 9. Per-User Notification Preferences

Already in Pillar 2 (`notification_subscriptions`). Each alert rule respects:
- User's `notification_subscriptions.muted` for that `event_type_key`.
- User's `quiet_hours_start` / `quiet_hours_end` — defer non-critical alerts.
- Channel preferences — `in_app` always; `email` / `whatsapp` / `push` per opt-in.

Critical alerts (severity = `urgent`) ignore quiet hours.

---

## 10. Acceptance Checklist

- [ ] `alert_rules`, `alert_fires` tables + RLS.
- [ ] 20 rules seeded per §4.
- [ ] Scanner task fires every 5 min; test rule fires for synthetic data.
- [ ] Escalation chain: simulate time → recipients advance correctly.
- [ ] Cooldown test: rule won't refire within cooldown window.
- [ ] Snooze test: snoozed fire hidden until snooze expires.
- [ ] Acknowledge test: ack marks fire closed and stops escalation.
- [ ] Auto-draft email created on `invoice_overdue_30d`; approval flow goes through Pillar 8.
- [ ] Quiet hours respected for non-urgent alerts.
- [ ] Notification dispatched on user's preferred channel.

---

## 11. Deferred

- **AI-driven rule creation** ("notice clients pay late after Q4 — create a rule") → Phase 2.
- **A/B testing chase templates** → Phase 2.
- **Alert dashboards / fatigue tracking** → Pillar 12.

---

## 12. Next: Pillar 12 — UI/UX System
