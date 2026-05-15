#!/usr/bin/env bash
# scripts/provision-supabase.sh — Create the Antagna staging + prod Supabase projects via Management API.
#
# Requires SUPABASE_ACCESS_TOKEN in env (a Personal Access Token starting with `sbp_`).
# Get one from: https://supabase.com/dashboard/account/tokens
#
# Idempotent — if a project with the given name already exists in your org, this skips create.
#
# Env (override if needed):
#   SUPABASE_ACCESS_TOKEN          # required
#   SUPABASE_ORG_ID                # required — your org slug or ID
#   SUPABASE_REGION=eu-central-1   # Frankfurt; KSA-acceptable until Saudi region opens
#   SUPABASE_PLAN=free             # use 'pro' for production-ready
#   PROJECT_PREFIX=antagna
#
# Usage:
#   SUPABASE_ACCESS_TOKEN=sbp_xxx SUPABASE_ORG_ID=yyy bash scripts/provision-supabase.sh

set -euo pipefail

: "${SUPABASE_ACCESS_TOKEN:?Set SUPABASE_ACCESS_TOKEN (sbp_…)}"
: "${SUPABASE_ORG_ID:?Set SUPABASE_ORG_ID — see https://supabase.com/dashboard/account/orgs}"
SUPABASE_REGION="${SUPABASE_REGION:-eu-central-1}"
SUPABASE_PLAN="${SUPABASE_PLAN:-free}"
PROJECT_PREFIX="${PROJECT_PREFIX:-antagna}"

API="https://api.supabase.com/v1"

list_projects() {
  curl -fsS -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" "$API/projects"
}

create_project() {
  local name="$1"
  local password
  password="$(openssl rand -hex 24)"

  echo "→ Creating Supabase project '$name' in $SUPABASE_REGION (plan=$SUPABASE_PLAN)…"
  echo "  DB password (save this!): $password"

  curl -fsS -X POST "$API/projects" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n \
      --arg n  "$name" \
      --arg o  "$SUPABASE_ORG_ID" \
      --arg r  "$SUPABASE_REGION" \
      --arg p  "$password" \
      --arg pl "$SUPABASE_PLAN" \
      '{name:$n, organization_id:$o, region:$r, db_pass:$p, plan:$pl}')" \
    | jq -r '"\("project_ref"): \(.id)\n\("project_url"): \(.endpoint)"'
}

main() {
  local existing
  existing="$(list_projects | jq -r '.[].name')"

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
  echo "  - Note both project refs + URLs above; put them in .env.local."
  echo "  - Service-role keys are read from /v1/projects/{ref}/api-keys"
  echo "    (or copy from the Supabase dashboard → Settings → API)."
}

main
