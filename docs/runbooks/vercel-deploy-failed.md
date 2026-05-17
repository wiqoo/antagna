# Vercel deploy failed

**Visible symptom:** push to `main` produced a red build on Vercel, production didn't update.

## Verify

```bash
# Last deploy + its status
vercel ls antagna-v2 --scope mohammedelghareib-8561s-projects | head -5

# Open the failed build's inspector
vercel inspect <deployment-url>
```

## Likely causes

1. **Type-check failure** — re-run locally: `pnpm type-check`. Common: a Drizzle
   schema change forgot to update `index.ts` exports.
2. **Build script change** — Vercel reads `apps/web/vercel.json`. If a recent
   commit edited it, verify `installCommand` still does `cd ../.. && pnpm install`.
3. **Missing env var** — `vercel env ls production` and compare against
   `.env.example`. Add any newly-required vars.
4. **Migration drift** — Supabase rejects new migration on push. Run
   `supabase db push` locally first; never let Vercel be the first to see it.

## Recovery

```bash
# Re-trigger a build from the last known-good commit
git checkout <good-sha>
vercel deploy --prod --yes
```

Or roll back via the Vercel dashboard → Deployments → previous green → "Promote to Production".
