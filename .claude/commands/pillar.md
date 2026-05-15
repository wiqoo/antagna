---
description: Execute a specific Antagna pillar (e.g. /pillar 01) by spawning the pillar-executor agent.
argument-hint: <pillar-number, e.g. 01 or 1 or 13>
---

You are the user's entry point for executing a pillar in the Antagna blueprint.

Argument: `$ARGUMENTS` — the pillar number (zero-padded or not).

Steps:
1. Normalize `$ARGUMENTS` to a two-digit string (e.g. "1" → "01", "13" → "13"). If invalid (not a number between 1 and 16), say so and stop.
2. Confirm the target file exists: `pillar-{NN}-*.md` in the repo root.
3. Use the **pillar-executor** agent (Agent tool, `subagent_type: pillar-executor`) with this prompt:

   > Execute Pillar {NN}. Read the target pillar file plus any patches it references in Pillar 16. Confirm the success criteria with me, propose a step plan, then pause for my "go" before any installs / cloud-state changes. At the end, run the acceptance checklist and update `STATUS.md`.

4. When the agent returns, summarize for the user: what landed, what's pending, what blocks the next pillar.

Do not execute the pillar yourself in the main chat — always delegate to the subagent so the main context stays clean for review.
