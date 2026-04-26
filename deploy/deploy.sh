#!/usr/bin/env bash
# deploy/deploy.sh — push the latest commit + linux-x64 .node binary to Hetzner.
#
# Usage:
#   ALICE_DEPLOY_HOST=<ip-or-hostname> deploy/deploy.sh [path-to-linux-x64-node]
#
# Env vars:
#   ALICE_DEPLOY_HOST   (required) — Hetzner host
#   ALICE_DEPLOY_USER   (default: alice)
#   ALICE_DEPLOY_PATH   (default: /opt/alice)
#   LOCAL_NODE_BINARY   (default: 1st arg) — path to alice-signals.linux-x64-gnu.node
#                       built via `gh run download` from CI's signal-reproducibility
#                       workflow's `alice-signals-linux-x64` artifact.
#
# What it does:
#   1. SSHs to the host, fetches the latest main, runs `npm ci`.
#   2. SCPs the linux-x64 .node into src-rs/.
#   3. Runs `npm run build` (Astro server build; skips Rust because the .node
#      we just uploaded is already current).
#   4. systemctl restart alice.
#
# What it does NOT do:
#   - Run database migrations. Those go directly against Supabase via
#     `psql -d "$ALICE_PG_URL" -f db/sql/migrations/NNN_*.sql` — explicit, not
#     wrapped, so a bad migration doesn't get auto-applied to prod.
#   - Validate the .node binary's SHA-256 against CI provenance. Phase 6.5
#     should add this check before the systemctl restart.

set -euo pipefail

: "${ALICE_DEPLOY_HOST:?ALICE_DEPLOY_HOST not set}"
REMOTE_USER="${ALICE_DEPLOY_USER:-alice}"
REMOTE_PATH="${ALICE_DEPLOY_PATH:-/opt/alice}"
LOCAL_NODE_BINARY="${LOCAL_NODE_BINARY:-${1:-}}"

if [[ -z "$LOCAL_NODE_BINARY" ]]; then
  echo "ERROR: LOCAL_NODE_BINARY not provided." >&2
  echo "" >&2
  echo "Download the latest linux-x64 .node artifact from GitHub Actions:" >&2
  echo "  gh run download --name alice-signals-linux-x64 -D /tmp/alice-deploy" >&2
  echo "Then re-run with:" >&2
  echo "  LOCAL_NODE_BINARY=/tmp/alice-deploy/alice-signals.linux-x64-gnu.node \\" >&2
  echo "  ALICE_DEPLOY_HOST=$ALICE_DEPLOY_HOST deploy/deploy.sh" >&2
  exit 2
fi

if [[ ! -f "$LOCAL_NODE_BINARY" ]]; then
  echo "ERROR: $LOCAL_NODE_BINARY does not exist." >&2
  exit 2
fi

REMOTE="$REMOTE_USER@$ALICE_DEPLOY_HOST"

echo "==> [1/4] Pulling latest main on $REMOTE..."
ssh "$REMOTE" "cd $REMOTE_PATH && git fetch origin && git checkout main && git reset --hard origin/main"

echo "==> [2/4] Installing npm deps + uploading .node binary..."
ssh "$REMOTE" "cd $REMOTE_PATH && npm ci"
scp "$LOCAL_NODE_BINARY" "$REMOTE:$REMOTE_PATH/src-rs/alice-signals.linux-x64-gnu.node"

echo "==> [3/4] Building Astro server..."
# Skip the Rust build step (it would try to recompile and overwrite the
# uploaded .node with a host-built one). Astro build alone is sufficient.
ssh "$REMOTE" "cd $REMOTE_PATH && npx astro build"

echo "==> [4/4] Restarting alice.service..."
ssh "$REMOTE" "sudo systemctl restart alice.service"
ssh "$REMOTE" "systemctl --no-pager status alice.service | head -20"

echo ""
echo "Deploy complete. Check the journal at https://fweeo.com/"
