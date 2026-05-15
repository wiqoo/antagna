# Pillar 15 — Migration & Launch Plan

**Status:** Planning
**Depends on:** Pillars 1-14 all done
**Estimated effort:** 1-2 sessions

The final pillar. Moves Antagna from "built and tested" to "team is using it daily and loves it". Defines the data migration, team onboarding, parallel-run window, and the cut-over criteria.

---

## 1. Goals

- Selective data migration from old Supabase complete and verified.
- All 11 team members onboarded with accounts + reference photos + initial training.
- 2-week parallel-run window — Antagna alongside current Google Drive/Sheets workflow.
- Defined launch criteria; defined rollback criteria.
- Post-launch support cadence.

## 2. Success Criteria

1. 162 equipment items, ~30 active clients, ~10 active projects imported and verified.
2. All 11 profiles created, capabilities set, reference photos uploaded.
3. Initial brand-voice + project-templates seeded.
4. Team has used Antagna for 5 real shoots and 5 real client emails by end of parallel-run.
5. Mohammed declares launch criteria met.

---

## 3. Migration — Final Pass

### 3.1 Pre-migration checklist

- [ ] All Pillar 1-14 acceptance criteria met.
- [ ] Staging environment fully functional.
- [ ] Production environment provisioned but locked.
- [ ] Dry-run completed on staging without errors.
- [ ] Backup of old Supabase taken.

### 3.2 Migration sequence

`scripts/migrate-from-old-supabase.ts` runs in stages:

```
1. Equipment + equipment_groups
   - 162 equipment rows
   - Derive ~62 equipment_groups
   - Carry photo URLs + serial numbers
   - Verify count: SELECT COUNT(*) = 162

2. Clients + contacts + contact_methods
   - 30-50 active clients (criterion: project in last 12 months)
   - Their contacts (split contacts.email/phone/whatsapp into contact_methods rows)
   - Normalize emails (lowercase) + phones (E.164)

3. Active projects only
   - WHERE stage IN (brief, quoted, approved, planning, shooting, editing, review)
   - Carry: title, client, stage, dates, owners
   - DO NOT migrate: deliverables (will be re-entered), historical comments

4. Equipment kit_suggestions
   - From old `bundles` + `bundle_items` data, generate kit_suggestions per equipment group

5. Verify
   - SELECT counts for each entity
   - SELECT 5 random rows per entity, spot-check
   - Trigger RLS check from a test user
```

### 3.3 What is NOT migrated

- Historical projects (lost, delivered, archived) — read-only reference in old DB.
- Old financial entries — Mohammed working on AR separately.
- Old briefs (will be re-parsed via AI if useful).
- Old discovery module data.
- Old WhatsApp/email tables.
- 4 abandoned KPI folders (replaced by Pillar 9's KPI system).
- 25% partner share data (out of scope).

---

## 4. Team Onboarding

### 4.1 Pre-launch (Week -1)

- [ ] Provision Workspace email for Abu Luka (when he's ready) OR skip his sign-in.
- [ ] All 11 profiles created with capabilities + departments + initial role.
- [ ] Reference photos captured (for attendance face-match).
- [ ] Mohammed sets initial role assignments (system_admin = Mohammed, account_manager = Mansoury, project_manager = Khaled, etc.).
- [ ] Each user's notification preferences default-tuned (Mohammed reviews + adjusts per person).

### 4.2 Onboarding sessions

Five 30-minute sessions, grouped by role:

| Session | Audience | Content |
|---------|----------|---------|
| 1. Production team | Mohammed (Production), Hamada, Mohsen, Ahmed | Project lifecycle, deliverables review, equipment reservations, attendance check-in |
| 2. Business team | Mansoury (AM), Khaled (PM) | CRM, lead pipeline, project creation, draft-review-send for emails, AI assistant |
| 3. Operations | Musa3ed (Equipment), Kabsy (Procurement) | Equipment catalog, reservations, kit suggestions, repair workflow, procurement notes |
| 4. Admin & Talent | Abu Luka (when ready), Turky (HR), Hussein (Accountant) | Admin: dashboards, role overrides, audit log. Talent: managed accounts, content calendar |
| 5. AI & Power-features | All | Ask Antagna, Cmd+K, daily briefs, MCP server, memory layer |

### 4.3 Self-serve docs

`docs/users/` in the blueprint repo:
- `getting-started.md` — first 5 minutes (sign in, take reference photo, change language).
- `daily-workflow.md` — what to do each day.
- `cmd-k-cheatsheet.md` — keyboard shortcuts.
- `faqs.md` — common questions.

All in Arabic + English.

---

## 5. Parallel-Run Window

Two weeks where Antagna and current workflow coexist:

### Week 1: Read-only Antagna
- Team continues using Google Drive/Sheets as primary.
- Antagna receives new emails (Pillar 8) and creates lead rows in parallel.
- Each evening, Mohammed reviews what Antagna captured vs reality.
- Discrepancies → file as bugs in `pillar-15-bugs.md`; fix the day after.

### Week 2: Write-allowed Antagna
- New projects start in Antagna; old projects stay in old workflow.
- New briefs go through AI parsing in Antagna.
- New equipment reservations go through Antagna.
- Team learns daily-brief habit.

### End of Week 2: Launch decision

Mohammed reviews the launch criteria checklist and decides.

---

## 6. Launch Criteria

Antagna goes "primary" (old workflow becomes secondary) when:

- [ ] 0 P0 bugs open (P0 = data loss, security, can't sign in).
- [ ] ≤5 P1 bugs open (P1 = workflow blocker).
- [ ] All 11 team members signed in at least once.
- [ ] ≥3 projects taken end-to-end (brief → delivery) in Antagna.
- [ ] ≥10 real client emails handled via Antagna.
- [ ] AI daily brief delivered for 7 consecutive days.
- [ ] At least 5 real attendance check-ins per active team member.
- [ ] Mohammed says "yalla, نروح" (let's go).

---

## 7. Rollback Plan

If launch fails:

- Antagna remains running (don't tear it down — fix forward).
- Old workflow remains primary; team resumes Drive/Sheets discipline.
- Bug-fix sprint of 1-2 weeks.
- Re-attempt launch.

If catastrophic (data loss, can't authenticate, etc.):
- Failover to old Supabase (read-only DB still alive).
- Email Mohammed's contacts manually if needed (Resend + saved-views in old data).
- Post-mortem within 48 hours.

---

## 8. Post-Launch (Month 1)

- Daily 15-min standup (Mohammed + Khaled + Mansoury) to surface friction.
- Weekly retro with full team.
- AI cost report reviewed weekly.
- Alert rule tuning (which alerts are too noisy? too quiet?).
- KPI dashboard refinement (which numbers matter? which to add/remove?).

### Month 1 deliverables
- 100% of new briefs flow through Antagna.
- 100% of equipment reservations in Antagna.
- 100% of new invoices issued through Antagna.
- 0 P0 bugs open at month-end.
- AI cost under projected budget.

---

## 9. Month 2-3: Phase 2 Planning

Defer-list to revisit (Mohammed prioritizes):
- WhatsApp Meta Cloud API integration.
- HR module (leave, payroll, performance).
- Finance module proper (full AR/AP, ZATCA submission).
- KSA-hosted Postgres if any client requires.
- Mobile native apps (Capacitor wrapping PWA).
- Bidirectional Calendar sync.
- A/B testing chase templates.
- AI-driven rule creation.
- TikTok scheduled posting.
- Voice input (Whisper).

---

## 10. Acceptance Checklist

- [ ] Migration script run on production with 0 errors.
- [ ] All 11 profiles + capabilities + reference photos exist.
- [ ] 5 onboarding sessions scheduled and held.
- [ ] User docs published in `docs/users/`.
- [ ] Parallel-run window completed.
- [ ] Launch criteria all met OR explicit Mohammed approval.
- [ ] Post-launch standup + retro cadence established.

---

## 11. End of Blueprint

When Pillar 15 is complete, Antagna is in production with the full Volt team using it daily. The system runs itself with humans approving the critical actions.

The blueprint repo (`antagna-blueprint`) becomes the canonical reference forever — every future change starts with: "which pillar does this affect?" + a PR to the blueprint first, then a PR to the code.

---

**End of Antagna Blueprint.**

Welcome to a system you'll actually love using. — Claude
