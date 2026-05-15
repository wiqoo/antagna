# Pillar 3 — Identity, Permissions & Multi-Role

**Status:** Planning
**Depends on:** Pillars 1, 2
**Estimated effort:** 1-2 Claude Code sessions

This pillar implements who-can-do-what. The schema is mostly there from Pillars 1-2; here we wire the resolver functions, the Google SSO flow, the capability checks, and the acting-for pattern. After Pillar 3, every later pillar can simply call `has_permission()` or `is_assigned_to_project()` without re-inventing auth.

---

## 1. Goals

- End-to-end Google Workspace SSO restricted to `voltsaudi.com`.
- Centralized permission resolver: `has_permission(profile_id, key)` returning boolean.
- Capability checks: `has_capability(profile_id, capability_key)`.
- Project assignment checks: `is_assigned_to_project(profile_id, project_id)`.
- Acting-for pattern: enforced server-side via signed session context.
- Per-role test fixtures.

## 2. Success Criteria

1. Mohammed signs in via Google → profile row exists → role updated to `system_admin` (one-time).
2. A non-admin sign-in is blocked from updating `clients` by RLS.
3. `has_permission('project.update', mohammed_id, project_id)` returns `true`.
4. Acting-as flow: Mohammed switches "acting as Abu Luka" → all subsequent writes record `actor_id = mohammed, acted_as_id = abuluka`.
5. Five test fixtures (one per primary role) demonstrate expected reads/writes.

---

## 3. Permission Catalog

A flat list of permission keys (`category.action`):

```
# Projects
project.read
project.create
project.update
project.delete
project.change_stage
project.assign
project.archive

# Briefs / Deliverables / Revisions
brief.create
brief.parse_ai
deliverable.update
deliverable.approve
revision.start
revision.resolve

# Clients / Contacts
client.read
client.create
client.update
client.merge       # admin-only
contact.create
contact.update

# Money
quote.create
quote.send
invoice.issue
invoice.cancel
payment.record

# Equipment
equipment.read
equipment.update
equipment.reserve
equipment.checkout
equipment.return
equipment.mark_lost
equipment.archive

# People
user.read
user.update_self
user.update_role           # admin-only
user.invite

# Communications
email.send
email.template_create
whatsapp.send

# System
audit.read
ai.cost_dashboard.read
settings.update            # admin-only
```

Stored in `permissions` table (seeded from a TS array):

```typescript
export const permissions = pgTable("permissions", {
  key: text("key").primaryKey(),
  category: text("category").notNull(),
  descriptionAr: text("description_ar"),
  descriptionEn: text("description_en"),
  riskLevel: text("risk_level").notNull().default("normal"),  // 'low' | 'normal' | 'high'
});
```

---

## 4. Role → Default Permission Map

Each role gets a default permission set. Stored in `role_default_permissions`:

```typescript
export const roleDefaultPermissions = pgTable("role_default_permissions", {
  role: text("role").notNull(),
  permissionKey: text("permission_key").notNull().references(() => permissions.key),
}, (t) => ({ pk: primaryKey({ columns: [t.role, t.permissionKey] }) }));
```

Roles and their default permissions:

| Role | Permission groups |
|------|-------------------|
| `system_admin` | ALL (bypass) |
| `system_manager` | ALL except `user.update_role`, `settings.update` |
| `admin` | client.*, project.*, equipment.*, communications.*, audit.read |
| `general_manager` | project.*, client.*, audit.read, ai.cost_dashboard.read |
| `production_manager` | project.update, project.assign, deliverable.*, revision.*, equipment.* |
| `project_manager` | project.create, project.update, project.assign, brief.*, deliverable.* |
| `account_manager` | client.*, contact.*, quote.*, project.create, email.send |
| `finance` | invoice.*, payment.*, audit.read |
| `hr` | user.read, user.update_self, audit.read |
| `equipment_manager` (capability) | equipment.* |
| `freelancer` | project.read (assigned only), deliverable.update (assigned only) |
| `user` | project.read, daily_tasks.* (self) |

---

## 5. Per-User Overrides

```typescript
export const userPermissionOverrides = pgTable("user_permission_overrides", {
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  permissionKey: text("permission_key").notNull().references(() => permissions.key),
  granted: boolean("granted").notNull(),               // true = grant, false = explicit deny
  reason: text("reason"),
  grantedBy: uuid("granted_by").references(() => profiles.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ pk: primaryKey({ columns: [t.profileId, t.permissionKey] }) }));
```

Use case: Mansoury normally can't archive projects, but Mohammed grants him `project.archive` temporarily for 30 days.

---

## 6. The Resolver Functions

```sql
-- Core resolver: does this user have this permission?
CREATE OR REPLACE FUNCTION public.has_permission(p_profile_id uuid, p_key text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_role text;
  v_override boolean;
BEGIN
  IF p_profile_id IS NULL THEN RETURN false; END IF;

  -- 1. Per-user override (highest precedence)
  SELECT granted INTO v_override
  FROM user_permission_overrides
  WHERE profile_id = p_profile_id
    AND permission_key = p_key
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;
  IF FOUND THEN RETURN v_override; END IF;

  -- 2. System admin bypass
  SELECT role INTO v_role FROM profiles WHERE id = p_profile_id;
  IF v_role IN ('system_admin') THEN RETURN true; END IF;

  -- 3. Role default
  RETURN EXISTS (
    SELECT 1 FROM role_default_permissions
    WHERE role = v_role AND permission_key = p_key
  );
END $$;

-- Capability check (multi-hat)
CREATE OR REPLACE FUNCTION public.has_capability(p_profile_id uuid, p_capability_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_capabilities
    WHERE profile_id = p_profile_id AND capability_key = p_capability_key
  );
$$;

-- Project assignment check
CREATE OR REPLACE FUNCTION public.is_assigned_to_project(p_profile_id uuid, p_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_assignments
    WHERE project_id = p_project_id AND profile_id = p_profile_id
  ) OR EXISTS (
    SELECT 1 FROM projects
    WHERE id = p_project_id
      AND (account_manager_id = p_profile_id OR project_manager_id = p_profile_id OR production_manager_id = p_profile_id)
  );
$$;

-- Helpers used directly in RLS policies (current user)
CREATE OR REPLACE FUNCTION public.current_profile_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id FROM profiles WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_has_permission(p_key text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT has_permission(current_profile_id(), p_key);
$$;

CREATE OR REPLACE FUNCTION public.current_user_has_capability(p_key text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT has_capability(current_profile_id(), p_key);
$$;
```

All these are `SECURITY DEFINER` so RLS doesn't recurse.

---

## 7. RLS Policies (canonical examples)

```sql
-- Projects: read all, write if assigned or has permission
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY projects_read ON projects FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY projects_write ON projects FOR UPDATE
  USING (
    current_user_has_permission('project.update')
    AND (is_assigned_to_project(current_profile_id(), id)
         OR current_user_has_permission('project.update_any'))
  );

CREATE POLICY projects_create ON projects FOR INSERT
  WITH CHECK (current_user_has_permission('project.create'));

-- Clients: read all, write requires permission
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY clients_read ON clients FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY clients_write ON clients FOR ALL USING (current_user_has_permission('client.update'));

-- Equipment: read all, write needs capability OR permission
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
CREATE POLICY equipment_read ON equipment FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY equipment_write ON equipment FOR ALL USING (
  current_user_has_capability('equipment_manager')
  OR current_user_has_permission('equipment.update')
);
```

Pattern: every table uses this skeleton (read = authenticated, write = permission/capability check). Pillar 2 lists per-table RLS specifics.

---

## 8. Google Workspace SSO Flow

### 8.1 Google Cloud setup

OAuth Client (Web app) configured in Pillar 1 §4.7 with:
- **HD restriction** (`hosted_domain = voltsaudi.com`) → only Workspace emails accepted.
- Redirect URI: `https://<app-domain>/auth/callback`.

### 8.2 Supabase Auth provider

In Supabase Dashboard → Authentication → Providers → Google:
- Enable.
- Paste OAuth Client ID + Secret.
- Authorized Client IDs: same as Google Cloud.

### 8.3 Sign-in code

`apps/web/src/app/auth/sign-in/page.tsx`:
```typescript
"use client";
import { createBrowserClient } from "@supabase/ssr";

export default function SignInPage() {
  const supabase = createBrowserClient(/* env */);
  const handle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { hd: "voltsaudi.com" }, // belt + braces
      },
    });
  };
  return <button onClick={handle}>تسجيل الدخول عبر Google</button>;
}
```

`apps/web/src/app/auth/callback/route.ts`:
```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  if (code) {
    const supabase = createServerClient(/* env */);
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect("/app");
}
```

### 8.4 Profile auto-provision

DB trigger on `auth.users` insert:
```sql
CREATE OR REPLACE FUNCTION fn_handle_new_auth_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_display text;
BEGIN
  v_display := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));

  -- Reject if not @voltsaudi.com (belt + Google HD restriction)
  IF NEW.email NOT LIKE '%@voltsaudi.com' THEN
    RAISE EXCEPTION 'Sign-up restricted to voltsaudi.com domain';
  END IF;

  INSERT INTO profiles (auth_user_id, email, display_name, display_name_en, role)
  VALUES (NEW.id, NEW.email, v_display, v_display, 'user')
  ON CONFLICT (email) DO UPDATE SET auth_user_id = EXCLUDED.auth_user_id;

  RETURN NEW;
END $$;

CREATE TRIGGER tg_handle_new_auth_user
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION fn_handle_new_auth_user();
```

### 8.5 Middleware

`apps/web/src/middleware.ts`:
```typescript
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createServerClient(/* env */, { request: req, response: res });
  const { data: { user } } = await supabase.auth.getUser();

  const isAuthRoute = req.nextUrl.pathname.startsWith("/auth");
  const isAppRoute = req.nextUrl.pathname.startsWith("/app");

  if (!user && isAppRoute) return NextResponse.redirect(new URL("/auth/sign-in", req.url));
  if (user && isAuthRoute) return NextResponse.redirect(new URL("/app", req.url));

  return res;
}

export const config = { matcher: ["/app/:path*", "/auth/:path*"] };
```

---

## 9. The Acting-For Pattern

When Mohammed needs to act on Abu Luka's behalf (until Abu Luka has his own account):

### 9.1 UI

A header dropdown "Acting as: [self ▾]" → can switch to "أبو لوكا" if the current user has the `act_for.abuluka` permission.

### 9.2 Storage

When user picks "Acting as Abu Luka":
1. UI POSTs to `/api/session/act-as` with `target_profile_id`.
2. Server verifies the permission (`act_for.<target_id>` exists or current user is admin).
3. Server sets a custom JWT claim `acting_as` on the session (Supabase JWT custom claims supported via `auth.users.app_metadata.acting_as = uuid`).
4. Reads the value in every server action.

### 9.3 Database insertion

All write operations server-side use a helper that fills `acted_as_id`:

```typescript
// packages/db/src/with-acting.ts
export async function recordAction(action: () => Promise<void>) {
  const { actor, actingAs } = getSessionContext();
  await db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL app.acting_as = ${actingAs ?? null}`);
    await action();
  });
}
```

DB triggers populate `actor_id = auth.uid()` and `acted_as_id = current_setting('app.acting_as', true)::uuid` on `audit_log` + `activity_events`.

### 9.4 UI display rule

If `acted_as_id IS NOT NULL`, every audit row shows: **"محمد غريب → أبو لوكا"** in the actor column.

---

## 10. Acceptance Checklist

- [ ] `permissions` table seeded with all keys from §3.
- [ ] `role_default_permissions` seeded per §4.
- [ ] All resolver functions in §6 created and tested.
- [ ] RLS policies applied per §7 to all Pillar 2 tables.
- [ ] Google SSO restricted to `@voltsaudi.com` — non-Workspace email is rejected at OAuth screen.
- [ ] Mohammed signs in via Google → profile auto-created → manual SQL to `system_admin` → can access everything.
- [ ] Test fixture: 5 profiles (admin, PM, AM, Production, Freelancer) — each one's reads/writes match expected matrix.
- [ ] Acting-as flow: switch + write → audit_log shows actor + acted_as.
- [ ] Per-user override: grant Mansoury `project.archive` → he can archive; revoke → he can't.
- [ ] Permission expiry: temporary grant with `expires_at` past now → `has_permission` returns false.

---

## 11. What's Deferred

- **WhatsApp OTP login** → Pillar 8 (alongside WhatsApp integration).
- **MFA / 2FA** → Pillar 14 (Production-hardening).
- **Audit-log UI viewer** → Pillar 12.
- **Permission-aware UI controls** (hide buttons user can't use) → Pillar 12.
- **The `act_for.<target_id>` permission key generator** for any new user → Pillar 11 (automation).

---

## 12. Next: Pillar 4 — CRM Core

Picks up with: client landscape, agency-brand graph, lead pipeline, the "shared inbox routes to person" solution.
