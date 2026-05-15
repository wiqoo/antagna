# config/ — machine-readable source of truth

The prose pillars are documentation. The files in this folder are what **code, CI, and tooling actually read**.

| File | What it is | Lives in prose at |
|---|---|---|
| `roles.yaml` | The 11-person team — names, roles, capabilities, emails. Profile-seed input. | `pillar-16-hardening.md §A` |
| `decisions.yaml` | D-001..D-026 in structured form (id, pillar, reversibility, status, supersedes). | `decisions-log.md` |

When the code starts being written:
- `packages/db/src/seed.ts` imports `roles.yaml`
- `scripts/check-decisions.mjs` reads `decisions.yaml`
- CI workflow validates these files against the prose

If you edit any of these, also reflect the change in the matching prose file. Treat the prose as the "why" and the YAML as the "what".
