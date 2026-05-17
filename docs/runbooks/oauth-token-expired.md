# OAuth token expired / revoked

**Visible symptom:** Drive folder creation failing, Gmail send failing, Instagram analytics returning 401.

## Verify

```sql
-- Which tokens expired?
SELECT provider, subject, expires_at, last_refresh_error
FROM public.oauth_tokens
WHERE revoked = true OR (expires_at IS NOT NULL AND expires_at < now())
ORDER BY expires_at;
```

```sql
-- Recent integration errors per provider
SELECT * FROM public.v_integration_health WHERE errors_24h > 0;
```

## Likely causes

1. **Refresh token expired** — Google refresh tokens for unused integrations
   eventually expire (~6 months idle). Manual re-auth required.
2. **Scopes changed at the provider** — user revoked permissions from the
   provider's dashboard.
3. **Secret reference dangling** — `secret_ref` points at a vault key that was
   rotated; the cleartext is gone.

## Recovery

For Google (Drive / Calendar / Gmail):

1. Sign in to <https://console.cloud.google.com> as the workspace admin.
2. APIs & Services → Credentials → re-authorize the service account.
3. Download new key JSON, store as `GOOGLE_SERVICE_ACCOUNT_JSON` in Vercel +
   Trigger.dev env.
4. Update the `secret_ref` on the `oauth_tokens` row.

For social platforms (Instagram / TikTok / YouTube):

1. Each platform's dashboard → reconnect Antagna app.
2. Note the new access token + expiry; set them via the admin UI (Pillar 12 §10
   power-user customization) or directly:

```sql
UPDATE public.oauth_tokens
   SET secret_ref = '<new_vault_pointer>',
       expires_at = '<new_expiry>',
       revoked = false,
       last_refresh_error = NULL
 WHERE id = '<token_id>';
```
