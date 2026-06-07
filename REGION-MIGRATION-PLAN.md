# Antagna — Region Migration Plan: Tokyo → Frankfurt

**Status:** DRAFT — awaiting Mohammed's go-ahead before any cloud-state change.
**Date:** 2026-06-05
**Goal:** Move the live Antagna stack closer to its Saudi users to cut page latency.

---

## 1. Why

Both halves of the live stack are pinned to **Tokyo** — ~8,500 km from Riyadh:

| Component | Current region | Pinned in |
|---|---|---|
| Vercel functions (SSR) | `hnd1` (Tokyo) | `apps/web/vercel.json` → `"regions": ["hnd1"]` |
| Supabase Postgres + Auth + Storage | `ap-northeast-1` (Tokyo) | project `nicijexpmpekzuzevarf` |

Every logged-in page render does several **sequential** DB round-trips. From Saudi:

| Path | Approx round-trip (RTT) |
|---|---|
| Saudi user → Tokyo | ~150–180 ms |
| Saudi user → Frankfurt | ~50–70 ms |

A page doing 4–6 sequential queries pays that RTT 4–6×. Moving to Frankfurt is expected to **shave ~0.3–0.6 s off the heavier pages** on top of the Cloudflare-proxy removal already done (which took TTFB from ~1.1 s → ~0.5 s).

> The board precompute+cache already added (`dashboard_board_cache`) reduces the dashboard's own round-trips to ~1 cache read. The region move helps **every other** page (projects, inbox, clients, equipment, KPIs) where the cache doesn't apply.

**Target: Frankfurt** — `eu-central-1` (Supabase) + `fra1` (Vercel).
- Matches the originally-locked blueprint decision (stack region = `eu-central-1`).
- Strong network peering between Frankfurt and KSA.
- Both Vercel and Supabase offer it, so functions + DB stay co-located.
- *Alternative to verify at execution:* Mumbai (`ap-south-1` / `bom1`) is ~2,500 km (closer by distance) but peering to KSA is less consistent. **Recommendation: Frankfurt.**

---

## 2. The core constraint

**Supabase has no in-place region change.** A region move = **create a new project** in the target region, migrate everything into it, repoint the app, then retire the old project.

So the work is: stand up a Frankfurt twin → copy data/auth/storage → flip env + Vercel region → verify → keep Tokyo as a hot fallback for a few days → delete.

---

## 3. What must be migrated (full inventory)

| # | Asset | Source | How |
|---|---|---|---|
| 1 | **Schema** (public + custom) | Tokyo Postgres | `supabase db dump --schema public` or `pg_dump --schema-only`; or just re-run `supabase/migrations/*` against the new project |
| 2 | **Table data** | Tokyo Postgres | `pg_dump --data-only` → `psql` restore into Frankfurt |
| 3 | **Auth users** (`auth.users`, `auth.identities`) | Tokyo Auth | dump+restore the `auth` rows (only **2 real users** today: Mohammed + Claude QA — trivial) |
| 4 | **Storage files** (buckets + objects) | Tokyo Storage (S3) | enumerate buckets → copy objects via Storage API/script (re-create buckets first) |
| 5 | **Edge functions** | Tokyo project | `supabase functions deploy` to new project (if any are deployed) |
| 6 | **DB extensions** | Tokyo Postgres | re-enable the same extensions on the new project (`pgvector`, etc.) |
| 7 | **Vault/secrets** (if used) | Tokyo Postgres | re-create any `vault`/`pgsodium` secrets manually |
| 8 | **GitHub → Supabase integration** | wiqoo/antagna | reconnect to the **new** project so `supabase/migrations/*` keep auto-applying |
| 9 | **Cron / webhooks / realtime config** | Tokyo project | re-configure on the new project |

### Consumers to re-point (env/connection)
| Consumer | Env keys to update | Where |
|---|---|---|
| Vercel web app | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` | Vercel project env (prod) + `apps/web/.env.local` |
| Vercel **region** | `apps/web/vercel.json` → `"regions": ["fra1"]` | repo, committed |
| Trigger.dev worker | DB URL / Supabase keys | worker env |
| WhatsApp bridge | DB URL / Supabase keys (if it reads the DB) | `infra/whatsapp/.env` |
| Local dev | same keys | `.env.local`, `apps/web/.env.local` |

---

## 4. Phased execution

### Phase A — Stand up the Frankfurt twin (NO downtime, NO user impact)
1. **Pre-flight check:** confirm the Antagna org (`gyriqxqzlrrxylyasucv`) has a **free project slot** (Free tier = 2 projects/org). If full, free a slot or accept a 1-month Pro upgrade for the cutover (~$25 — see §7).
2. Create new Supabase project: name `antagna-v2-fra`, region **`eu-central-1`**, same Postgres major version, **note the new DB password**.
3. Re-enable extensions to match Tokyo (esp. `vector` for embeddings).
4. Apply the full schema: run the repo migrations against the new project (cleanest — guarantees parity), OR restore a `--schema-only` dump.
5. **Dry-run data load:** `pg_dump --data-only` from Tokyo → restore to Frankfurt. Verify row counts per table match. (This is a rehearsal; real cutover repeats it with fresh data.)
6. Re-create Storage buckets; copy a sample object to validate the storage-copy script.
7. In a branch, set `apps/web/vercel.json` region to `fra1` and stage the new env values (don't deploy yet).

→ At the end of Phase A, Frankfurt is a verified, fully-loaded twin. Tokyo is still live and serving users.

### Phase B — Cutover (SHORT maintenance window, ~15–30 min, off-peak)
> The team is tiny right now (2 real users, phase-1 testing) so a night-time window is low-impact.

1. Announce a brief maintenance window to the team.
2. **Freeze writes** on Tokyo (put the app in maintenance mode or stop the worker; reads can continue).
3. **Final sync:** fresh `pg_dump --data-only` (Tokyo) → restore to Frankfurt. Migrate `auth.users`/`auth.identities`. Run the storage-copy for all objects.
4. **Flip env** (Vercel prod + worker + WhatsApp bridge): Supabase URL, anon key, service-role key, `DATABASE_URL` → Frankfurt.
5. Merge the `fra1` region branch → push to main → Vercel auto-deploys to Frankfurt.
6. Reconnect GitHub → Supabase integration to the new project.

### Phase C — Verify (still in the window)
- DNS unaffected (antagna.me already DNS-only → Vercel edge; only the *function region + DB* changed).
- Smoke test against prod: **login → dashboard → open a project → create a client → reserve equipment → WhatsApp webhook delivers**.
- Re-measure TTFB on the heavy pages (expect the ~0.3–0.6 s drop).
- 0 console errors, pages render, mobile OK at 390px.

### Phase D — Stabilize & retire
- Keep the **Tokyo project intact, read-only**, as a hot fallback for **3–5 days**.
- If anything misbehaves: revert env vars + `vercel.json` region → redeploy = back on Tokyo in minutes.
- After confidence: **delete the Tokyo project** (explicit go-ahead required — §7).
- Update memory `credentials-supabase.md` + `project_vercel_preview_env.md` with the new project/region.

---

## 5. Rollback

At every point before Phase D's delete, rollback is fast and total:
- **Env vars** still hold the Tokyo project values (kept as a saved set).
- Revert `apps/web/vercel.json` → `"regions": ["hnd1"]`, restore Tokyo env in Vercel, redeploy → live on Tokyo again.
- Tokyo data is untouched during the window (we only *read* from it), so no data loss on rollback.

The only irreversible step is **deleting the Tokyo project** — deliberately deferred to Phase D, gated on explicit approval.

---

## 6. Downtime & data-loss

- **Downtime:** one short maintenance window (~15–30 min) during Phase B. Achievable near-zero with more effort (logical replication), but not worth it for a 2-user phase-1 system.
- **Data loss:** none if writes are frozen during the final sync. Anything written to Tokyo after the freeze would be lost — hence the freeze.

---

## 7. Approvals needed (the "مصيري" gates)

Per the autonomy contract, I will **pause and ask** before:
1. **Creating the new Supabase project** (new cloud state). *(Free-tier twin = low-risk, but it's cloud provisioning → I'll confirm.)*
2. **Any Pro upgrade** if the free slot isn't available (~$25/mo — crosses the money threshold).
3. **The cutover itself** (flipping the LIVE app's env to the new DB).
4. **Deleting the Tokyo project** (irreversible, touches live data).

Everything in Phase A up to provisioning is prep I can stage in the repo without asking.

**Cost:** Free → Free = **$0** if a slot is available. Only the temporary Pro path (if needed) is ~$25 for one month.

---

## 8. Pre-flight checklist (run at execution start)
- [ ] Measure exact Tokyo DB size + per-table row counts (baseline for verification).
- [ ] List Storage buckets + object counts.
- [ ] List deployed Edge functions + enabled extensions.
- [ ] Confirm Postgres major version to match.
- [ ] Confirm the Antagna org has a free project slot.
- [ ] Snapshot current Vercel env var set (Tokyo) as the rollback set.
- [ ] Decide the maintenance window (off-peak, KSA time).

---

## Open question for Mohammed
- **Window timing:** which night works for the ~15–30 min maintenance window? (Phase-1 has 2 users, so impact is minimal — but better to pick a quiet hour.)
