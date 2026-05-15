---
description: Show Antagna decisions (locked, pending, or by ID) from config/decisions.yaml.
argument-hint: [locked | pending | D-NNN | <pillar number>]
---

You query the decisions log. Source of truth: `config/decisions.yaml` (mirrors `decisions-log.md`).

Argument: `$ARGUMENTS`.

Behavior by argument:

| Argument | Action |
|---|---|
| empty or `all` | List every locked decision, one line each: `D-NNN — title (pillar X, reversibility)`. |
| `pending` | List the `pending:` block — decisions still to make and which pillar resolves them. |
| `locked` | Same as `all` but exclude superseded. |
| `D-NNN` (e.g. `D-005`) | Print that decision's full record from the YAML, plus a link to its prose entry. |
| a number `1`..`16` | List all decisions where `pillar:` includes that number. |

Read `config/decisions.yaml`, parse it (it's standard YAML — use `yq` if available, otherwise just grep). Present the result as a markdown list or table.

If the user asks about a decision that doesn't exist, say so cleanly — don't make one up.
