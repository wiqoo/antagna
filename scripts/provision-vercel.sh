#!/usr/bin/env bash
# scripts/provision-vercel.sh — Create the Antagna staging + prod Vercel projects via REST API.
#
# Requires VERCEL_TOKEN in env (vca_…).
# Get one from: https://vercel.com/account/tokens
#
# Idempotent — if a project with the given name already exists in your team, this skips create.
#
# Env (override if needed):
#   VERCEL_TOKEN                   # required
#   VERCEL_TEAM_ID                 # required (team_…)
#   PROJECT_PREFIX=antagna
#   FRAMEWORK=nextjs               # set on creation
#
# Usage:
#   VERCEL_TOKEN=vca_xxx VERCEL_TEAM_ID=team_yyy bash scripts/provision-vercel.sh

set -euo pipefail

: "${VERCEL_TOKEN:?Set VERCEL_TOKEN (vca_…)}"
: "${VERCEL_TEAM_ID:?Set VERCEL_TEAM_ID (team_…)}"
PROJECT_PREFIX="${PROJECT_PREFIX:-antagna}"
FRAMEWORK="${FRAMEWORK:-nextjs}"

API="https://api.vercel.com"
AUTH=(-H "Authorization: Bearer $VERCEL_TOKEN")
TEAM_QS="teamId=$VERCEL_TEAM_ID"

list_projects() {
  curl -fsS "${AUTH[@]}" "$API/v9/projects?$TEAM_QS&limit=100"
}

create_project() {
  local name="$1"
  echo "→ Creating Vercel project '$name' (framework=$FRAMEWORK)…"
  curl -fsS -X POST "$API/v10/projects?$TEAM_QS" \
    "${AUTH[@]}" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg n "$name" --arg f "$FRAMEWORK" '{name:$n, framework:$f}')" \
    | jq -r '"\("project_id"): \(.id)\n\("name"):       \(.name)"'
}

main() {
  local existing
  existing="$(list_projects | jq -r '.projects[].name')"

  for env in staging prod; do
    local proj="${PROJECT_PREFIX}-${env}"
    if grep -qxF "$proj" <<<"$existing"; then
      echo "✓ '$proj' already exists — skipping."
    else
      create_project "$proj"
    fi
  done

  echo ""
  echo "Done. Next:"
  echo "  - Note both project IDs above; put them in .env.local."
  echo "  - Set env vars on each project via 'vercel env add' or scripts/sync-vercel-env.sh"
  echo "  - Link the local dir: cd apps/web && vercel link --project antagna-staging"
}

main
