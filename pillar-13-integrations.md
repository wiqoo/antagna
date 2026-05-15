# Pillar 13 — Integrations

**Status:** Planning
**Depends on:** Pillars 1, 5, 7, 8, 10
**Estimated effort:** 2-3 sessions

> **🩹 Patches (see [pillar-16-hardening.md](pillar-16-hardening.md)):**
> - **§B.1** — all "Inngest" references → "Trigger.dev v3"
> - **§C.1** — **ZATCA section is now MOOT for Phase 1** — Dafterah handles invoicing/ZATCA per D-022. The ZATCA UBL 2.1 design in §7 is kept as schema reference only.
> - **§I** — Drive permission management (`drive-sync-permissions` task on project folder create)
> - **§O.1** — Antagna stores `dafterah_*_number` references only; no invoice generation

The external connectors. Google Drive auto-folders, Google Calendar sync, Gemini meeting notes ingest, ZATCA invoice prep, social-platform APIs, Resend for transactional email, WhatsApp Phase 2.

---

## 1. Goals

- **Google Drive**: per-project folder auto-created on project creation; subfolders standardized; permissions auto-set.
- **Google Calendar**: shoot dates auto-blocked on team calendar; crew invited.
- **Gemini meeting notes**: inbox monitor extracts notes → links to project → posts as activity event with extracted action items.
- **Resend**: outbound transactional email (separate from Gmail-as-Volt).
- **ZATCA e-invoicing**: invoice generation produces compliant QR code and submits to ZATCA portal (schema-ready, integration may be Phase 2).
- **Social platforms** (Instagram Graph, TikTok, YouTube Data): analytics ingestion + scheduled publishing.

## 2. Success Criteria

1. New project created → Drive folder created within 60s with 6 standard subfolders.
2. New project with shoot dates → Calendar event created on team calendar with crew invited.
3. Gemini meeting note for a project arrives → action items extracted → tasks created → activity feed shows it.
4. Resend sends a transactional email (e.g., daily brief) using `notifications@antagna.voltsaudi.com`.
5. Instagram analytics for an Abu Luka post fetched and stored in `post_analytics_snapshots`.

---

## 3. Drive Integration

### 3.1 OAuth setup

- Project-level service account with domain-wide delegation (admin enables in Workspace).
- Permission scope: `drive`, `drive.file`, `drive.metadata`.
- Service account impersonates `info@voltsaudi.com` for project folders.

### 3.2 Auto-folder creation

`apps/worker/src/trigger/drive-create-project-folder.ts`:

```typescript
export const createProjectDriveFolder = task({
  id: "drive-create-project-folder",
  run: async (payload: { projectId: string }) => {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, payload.projectId),
      with: { client: true },
    });
    if (project.driveFolderId) return { skipped: "already exists" };

    const root = process.env.DRIVE_PROJECTS_ROOT_ID;  // existing top-level operations folder
    const name = `${project.code} | ${project.client.code} - ${project.title}`;

    const folder = await drive.files.create({
      requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [root] },
    });

    // Create canonical subfolders
    const subs = ['01_Brief', '02_References', '03_Raw', '04_Edit', '05_Final', '06_BTS', 'Deliverables'];
    for (const sub of subs) {
      await drive.files.create({
        requestBody: { name: sub, mimeType: 'application/vnd.google-apps.folder', parents: [folder.data.id] },
      });
    }

    await db.update(projects).set({
      driveFolderId: folder.data.id,
      driveFolderUrl: folder.data.webViewLink,
    }).where(eq(projects.id, project.id));

    // Also record as external_link
    await db.insert(externalLinks).values({
      entityType: 'project', entityId: project.id,
      provider: 'gdrive', externalId: folder.data.id, url: folder.data.webViewLink,
      isPrimary: true,
    });
  },
});
```

Triggered by Postgres NOTIFY when a project is created.

### 3.3 Folder naming standard

Locked: `[PROJECT_CODE] | [CLIENT_CODE] - [Title in original brief language]`
Example: `PRJ-0042 | MYNM - Ford Taurus 2026 Culture Video`

This replaces the inconsistent naming Volt has today (pipe vs em-dash vs none).

---

## 4. Calendar Integration

### 4.1 Auto-event on shoot dates

When `projects.shootStartsAt` is set or changed:

```typescript
export const syncProjectShootCalendar = task({
  id: "calendar-sync-shoot",
  run: async (payload: { projectId: string }) => {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, payload.projectId),
      with: { assignments: { with: { profile: true } } },
    });
    if (!project.shootStartsAt) return;

    const calendarId = 'team@voltsaudi.com';
    const summary = `📹 ${project.title} (${project.code})`;
    const attendees = project.assignments
      .filter(a => a.profile?.email)
      .map(a => ({ email: a.profile.email }));

    if (project.calendarEventId) {
      // Update existing
      await calendar.events.update({
        calendarId, eventId: project.calendarEventId,
        requestBody: { summary, start: { dateTime: project.shootStartsAt }, end: { dateTime: project.shootEndsAt }, attendees },
      });
    } else {
      const event = await calendar.events.insert({
        calendarId,
        requestBody: { summary, start, end, attendees, description: project.description + `\n\n${project.driveFolderUrl}` },
      });
      await db.update(projects).set({ calendarEventId: event.data.id }).where(eq(projects.id, project.id));
    }
  },
});
```

### 4.2 Bidirectional sync (Phase 2)

For Phase 1: one-way (Antagna → Calendar). For Phase 2: if a calendar event is moved by the user, webhook informs Antagna.

---

## 5. Gemini Meeting Notes

`apps/worker/src/trigger/ingest-gemini-notes.ts`:

Triggered by Gmail pipeline (Pillar 8) when an inbound email arrives from `gemini-notes@google.com`.

```typescript
export const ingestGeminiNote = task({
  id: "ingest-gemini-notes",
  run: async (payload: { emailMessageId: string }) => {
    const msg = await db.query.emailMessages.findFirst({ where: eq(emailMessages.id, payload.emailMessageId) });

    // Extract project code from subject — Volt uses titles like "Production X Uber" sometimes including codes
    const projectCode = extractProjectCode(msg.subject);
    const project = projectCode ? await db.query.projects.findFirst({ where: eq(projects.code, projectCode) }) : null;

    // AI extracts action items from the body
    const extracted = await callClaude({
      feature: "meeting_notes_extract",
      prompt: EXTRACT_ACTION_ITEMS_PROMPT,
      variables: { body: msg.bodyText, knownAttendees: project?.assignments },
    });

    await db.insert(meetingNotes).values({
      source: 'gemini',
      sourceId: msg.gmailMessageId,
      meetingTitle: msg.subject.replace(/^Notes: /, ''),
      meetingDate: msg.sentAt,
      attendeesText: extracted.attendees,
      noteContent: msg.bodyText,
      projectId: project?.id,
      aiActionItems: extracted.actionItems,
    });

    // Create tasks for action items
    for (const item of extracted.actionItems) {
      await db.insert(projectTasks).values({
        projectId: project?.id ?? null,
        title: item.task,
        assigneeId: await resolveAttendee(item.owner) ?? null,
        dueAt: item.due ?? null,
        aiSuggested: true,
      });
    }
  },
});
```

---

## 6. Resend (Transactional Email)

Used for: daily briefs, notifications, system alerts. NOT for client comms (those go via Gmail send-as alias).

Setup:
- Domain: `antagna.voltsaudi.com` (subdomain) with proper SPF/DKIM/DMARC.
- From: `notifications@antagna.voltsaudi.com`.

```typescript
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: 'Antagna <notifications@antagna.voltsaudi.com>',
  to: profile.email,
  subject: 'Your daily brief',
  react: DailyBriefEmail({ brief }),
});
```

---

## 7. ZATCA E-Invoicing

Schema-ready (Pillar 2 has `zatca_uuid`, `zatca_hash`, `zatca_qr_url` on invoices). Integration approach:

- Phase 1: generate compliant PDF with QR code locally (using `zatca-einvoice-sdk` or equivalent).
- Phase 2: submit invoice XML to ZATCA Fatoora portal via API + receive clearance.

Pillar 13 lists this as DEFERRED to Pillar 14 / Phase 2 — needs legal review with Hussein (Volt's accountant).

---

## 8. Social Platform APIs

### 8.1 Instagram Graph API

Required: Instagram Business Account linked to Facebook Page.
Capabilities: scheduled publishing (text + image + carousel), insights fetching, comments/messages (Phase 2).

### 8.2 TikTok Business API

Capabilities: scheduled publishing, analytics.
Note: TikTok API is more restricted; we may use scheduled "remind to post" notifications for now.

### 8.3 YouTube Data API

Capabilities: analytics, comments, video uploads (for long-form).

Tasks:
- `analytics-snapshot-instagram(post_id)`
- `analytics-snapshot-tiktok(post_id)`
- `analytics-snapshot-youtube(post_id)`

Token storage: each `managed_accounts.oauth_token_ref` points at a secret in Supabase Vault (or env-driven for now).

---

## 9. Secrets Management

For OAuth tokens (Drive, Calendar, Instagram, etc.):
- Pillar 13 introduces Supabase Vault usage for encrypted-at-rest secrets.
- Each `managed_accounts.oauth_token_ref` is a Vault key name.
- Workers retrieve secrets via Vault API, never log them.
- Tokens rotated per provider's policy.

---

## 10. Acceptance Checklist

- [ ] Drive folder auto-creation: insert test project → folder + subfolders appear in Drive within 60s; `projects.driveFolderUrl` set.
- [ ] Calendar event created on shoot date set; crew receives invites.
- [ ] Calendar event updated when shoot dates change.
- [ ] Gemini meeting note from test email → meeting_notes row + action items + tasks.
- [ ] Resend transactional email sends from `notifications@antagna.voltsaudi.com` with proper SPF/DKIM.
- [ ] Instagram OAuth flow: authorize Abu Luka's account → token stored in vault → analytics fetch succeeds.
- [ ] All integration jobs are idempotent (re-run produces same result, no duplicates).

---

## 11. Deferred

- **ZATCA e-invoicing submission API** → Phase 2 with Hussein.
- **TikTok scheduled posting** → Phase 2 (API limitations).
- **YouTube uploads** → Phase 2.
- **Calendar bidirectional sync** → Phase 2.
- **WhatsApp Meta Cloud API** → Phase 2.

---

## 12. Next: Pillar 14 — Deployment & Operations
