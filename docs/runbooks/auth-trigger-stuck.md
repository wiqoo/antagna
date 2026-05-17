# Auth trigger stuck — sign-ups don't create profiles

**Visible symptom:** user signs up via `/register`, no row in `public.profiles`, dashboard redirects to login.

## Verify

```sql
-- Did the auth user exist?
SELECT id, email, created_at FROM auth.users WHERE email = '<user_email>';

-- Did the trigger try to fire? Look in audit_log:
SELECT * FROM public.audit_log
  WHERE entity_type='profiles' AND action='INSERT'
  ORDER BY created_at DESC LIMIT 5;

-- Is the trigger installed?
SELECT tgname FROM pg_trigger WHERE tgname = 'trg_on_auth_user_created';
```

## Likely causes

1. **Trigger was disabled** by a migration. Re-run `supabase db push` against
   `00000000000006_auth_user_to_profile.sql` + `00008_pillar2_people_extend.sql`.
2. **GRANT missing** on `profiles` for `service_role` — `migration 00007` should
   have fixed this; re-apply if dropped.
3. **fn_on_auth_user_created errored** — check Postgres logs in Supabase dashboard
   → Logs → Postgres. Common cause: a NOT-NULL column added without a default
   that the trigger doesn't fill.

## Recovery

```sql
-- Materialize the missing profile manually:
INSERT INTO public.profiles (auth_user_id, email, display_name, role, status)
SELECT id, email,
       COALESCE(raw_user_meta_data ->> 'full_name', split_part(email, '@', 1)),
       'user', 'active'
FROM auth.users
WHERE id = '<missing_user_id>'
  AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE auth_user_id = auth.users.id);
```
