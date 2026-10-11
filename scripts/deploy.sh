#!/usr/bin/env bash
# Deploys one app (api or web) to Vercel from a clean copy without git metadata.
# The Vercel CLI attaches the git commit author and blocks the deployment
# (TEAM_ACCESS_REQUIRED) when that author is not a member of the Vercel team.
# usage: scripts/deploy.sh api|web   (projects: snaphunt-api, snaphunt-web)
set -euo pipefail
app="${1:?usage: deploy.sh api|web}"
case "$app" in api | web) ;; *) echo "unknown app: $app" >&2; exit 1 ;; esac
root="$(git rev-parse --show-toplevel)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
cd "$root"
project="$(vercel api "/v9/projects/snaphunt-$app")"
mkdir -p "$tmp/.vercel"
printf '%s' "$project" | python3 -c 'import json,sys; p=json.load(sys.stdin); print(json.dumps({"projectId": p["id"], "orgId": p["accountId"], "projectName": p["name"]}))' >"$tmp/.vercel/project.json"
git ls-files -co --exclude-standard | grep -Ev '^(spikes/|docs/|\.devin/)' | tar -cf - -T - | tar -xf - -C "$tmp"
cd "$tmp"
vercel deploy --prod --yes
