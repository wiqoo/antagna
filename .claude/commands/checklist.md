---
description: Run a pillar's acceptance checklist and report PASS/FAIL per item.
argument-hint: <pillar-number, e.g. 01>
---

You verify a pillar's "DONE when…" success criteria.

Argument: `$ARGUMENTS` — the pillar number.

Steps:

1. Normalize the argument to two digits (1 → 01, etc.). Open `pillar-{NN}-*.md`.
2. Find the section titled `## ⚠N. ACCEPTANCE CHECKLIST` or `## N. Success Criteria — Pillar N is DONE when:` — different pillars use slightly different headers.
3. Extract each numbered checklist item.
4. For each item, decide how to verify:
   - SQL queries → run via `psql` or `supabase db query` against the staging project.
   - Command-line invariants (e.g. "`pnpm build` succeeds") → run that command and capture exit code.
   - Manual-only checks (e.g. "Mohammed can sign in via Google") → mark as `MANUAL` and ask the user.
5. Build a results table:

   | # | Criterion | Status | Notes |
   |---|---|---|---|
   | 1 | … | ✅ PASS / ❌ FAIL / ⏸ MANUAL | … |

6. If any FAIL, list the specific gap (file, query, missing env var). Don't try to "fix" — just report.
7. If all PASS, ask the user whether to update `STATUS.md` to mark this pillar's "Verified" column.

Never claim PASS without running the check. "Should work" is not PASS.
