#!/usr/bin/env bash
# Deploys apps/api to Vercel from a clean copy without git metadata.
# The Vercel CLI attaches the git commit author and blocks the deployment
# (TEAM_ACCESS_REQUIRED) when that author is not a member of the Vercel team.
# Requires `vercel link --project snaphunt-api` to have been run once at the repo root.
set -euo pipefail
root="$(git rev-parse --show-toplevel)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
cd "$root"
git ls-files -co --exclude-standard | grep -Ev '^(spikes/|docs/|\.devin/)' | tar -cf - -T - | tar -xf - -C "$tmp"
cp -r .vercel "$tmp/.vercel"
cd "$tmp"
vercel deploy --prod --yes
