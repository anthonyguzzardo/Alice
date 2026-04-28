#!/usr/bin/env bash
# ============================================================================
# run-migration.sh — Maintenance-mode wrapper for Alice schema migrations
# ============================================================================
#
# Runs a single migration file against production with a service quiesce:
#   1. systemctl stop alice.service       (Hetzner box, via SSH)
#   2. psql --apply migration             (laptop, against Supabase)
#   3. inspect verification output         (operator review pause)
#   4. systemctl start alice.service      (Hetzner box, via SSH)
#
# Why this exists: schema surgery happens against a quiesced system. Even a
# sub-second migration can race with an in-flight signal-pipeline job. A
# 30-second downtime window is invisible to a single-user instrument; it is
# catastrophic to a half-applied schema change.
#
# USAGE
#   ./deploy/run-migration.sh db/sql/migrations/030_unify_subject_id.sql
#
# ENV (must be set before invocation)
#   ALICE_PG_URL              Supabase Session pooler URL (read from .env)
#   ALICE_DEPLOY_HOST         Hetzner IPv4 (default 5.78.203.243)
#   ALICE_SSH_KEY             SSH key path (default ~/.ssh/alice_hetzner)
#
# DRY RUN
#   Set DRY_RUN=1 to print what would happen without executing anything.
#
# ============================================================================

set -euo pipefail

MIGRATION_FILE="${1:-}"
if [[ -z "$MIGRATION_FILE" || ! -f "$MIGRATION_FILE" ]]; then
  echo "ERROR: pass a migration file path as argument 1" >&2
  echo "Usage: $0 db/sql/migrations/NNN_description.sql" >&2
  exit 2
fi

# Load .env if ALICE_PG_URL not already set
if [[ -z "${ALICE_PG_URL:-}" ]]; then
  if [[ -f .env ]]; then
    set -a; source .env; set +a
  else
    echo "ERROR: ALICE_PG_URL not set and no .env found" >&2
    exit 2
  fi
fi

DEPLOY_HOST="${ALICE_DEPLOY_HOST:-5.78.203.243}"
SSH_KEY="${ALICE_SSH_KEY:-$HOME/.ssh/alice_hetzner}"
DRY_RUN="${DRY_RUN:-0}"

run() {
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "[DRY RUN] $*"
  else
    "$@"
  fi
}

ssh_root() {
  run ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "root@$DEPLOY_HOST" "$@"
}

echo "=========================================================================="
echo "Migration: $MIGRATION_FILE"
echo "Target:    Supabase (via ALICE_PG_URL)"
echo "Host:      $DEPLOY_HOST"
echo "Dry run:   $DRY_RUN"
echo "=========================================================================="
echo

# ----------------------------------------------------------------------------
# Pre-flight: confirm we can reach both the box and the DB
# ----------------------------------------------------------------------------
echo "[1/6] Pre-flight checks..."
ssh_root 'systemctl is-active alice.service caddy.service' || true
if [[ "$DRY_RUN" != "1" ]]; then
  psql "$ALICE_PG_URL" -c 'SELECT now() AS db_reachable;' >/dev/null
  echo "  ✓ Database reachable"
fi
echo

# ----------------------------------------------------------------------------
# Step 1: Stop alice.service (caddy keeps serving — subjects see 502)
# ----------------------------------------------------------------------------
echo "[2/6] Stopping alice.service for maintenance window..."
ssh_root 'systemctl stop alice.service'
START_TIME=$(date +%s)
echo "  ✓ alice.service stopped at $(date -u +%H:%M:%S)Z"
echo

# ----------------------------------------------------------------------------
# Step 2: Apply migration with psql
# ----------------------------------------------------------------------------
LOG_FILE="/tmp/alice-migration-$(basename "$MIGRATION_FILE" .sql)-$(date +%Y%m%d-%H%M%S).log"
echo "[3/6] Applying migration → $LOG_FILE"
if [[ "$DRY_RUN" == "1" ]]; then
  echo "[DRY RUN] psql \"\$ALICE_PG_URL\" -v ON_ERROR_STOP=1 -f $MIGRATION_FILE"
else
  if psql "$ALICE_PG_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION_FILE" > "$LOG_FILE" 2>&1; then
    echo "  ✓ Migration applied (exit 0). Last lines:"
    tail -20 "$LOG_FILE" | sed 's/^/    /'
  else
    echo "  ✗ MIGRATION FAILED. Last lines:"
    tail -40 "$LOG_FILE" | sed 's/^/    /'
    echo
    echo "  Service is STOPPED. Investigate before restarting."
    echo "  Migration ran inside BEGIN/COMMIT — failure means transaction rolled back."
    echo "  Verify with: psql \"\$ALICE_PG_URL\" -c '\\d alice.tb_questions'"
    echo
    echo "  When ready to restart:"
    echo "    ssh -i $SSH_KEY root@$DEPLOY_HOST 'systemctl start alice.service'"
    exit 1
  fi
fi
echo

# ----------------------------------------------------------------------------
# Step 3: Operator pause — review verification output
# ----------------------------------------------------------------------------
echo "[4/6] OPERATOR REVIEW — inspect Block 6 verification output above."
echo "  Expected:"
echo "    - 4 UNIQUE constraints listed (questions, session_delta, semantic_baselines, personal_profile)"
echo "    - row counts match the pre-migration snapshot"
echo "    - every distinct subject_id value is exactly {1}"
echo
if [[ "$DRY_RUN" != "1" ]]; then
  # Read from /dev/tty directly so the pause cannot be skipped by piping the
  # wrapper's output to a file or running under any non-interactive context.
  # If there is no controlling terminal, fail loudly — leaving the service
  # stopped is the safer outcome than silently restarting without review.
  if [[ ! -r /dev/tty ]] || [[ ! -w /dev/tty ]]; then
    echo "  ✗ ERROR: /dev/tty not available. The operator review pause requires a"
    echo "    controlling terminal. Aborting with service still stopped."
    echo "    Restart manually when ready:"
    echo "      ssh -i $SSH_KEY root@$DEPLOY_HOST 'systemctl start alice.service'"
    exit 1
  fi
  printf "  Type 'continue' to restart alice.service, anything else to abort: " > /dev/tty
  read -r CONFIRM < /dev/tty
  if [[ "$CONFIRM" != "continue" ]]; then
    echo "  ✗ Aborted by operator. Service still stopped."
    echo "    Restart manually when ready: ssh -i $SSH_KEY root@$DEPLOY_HOST 'systemctl start alice.service'"
    exit 1
  fi
fi
echo

# ----------------------------------------------------------------------------
# Step 4: Restart alice.service
# ----------------------------------------------------------------------------
echo "[5/6] Restarting alice.service..."
ssh_root 'systemctl start alice.service'
sleep 2
ssh_root 'systemctl is-active alice.service'
echo "  ✓ alice.service started"
echo

# ----------------------------------------------------------------------------
# Step 5: Smoke check + report downtime
# ----------------------------------------------------------------------------
END_TIME=$(date +%s)
DOWNTIME=$((END_TIME - START_TIME))
echo "[6/6] Post-migration smoke check..."
if [[ "$DRY_RUN" != "1" ]]; then
  curl -sf -o /dev/null https://fweeo.com/login && echo "  ✓ /login responds 200" || echo "  ✗ /login check failed — investigate"
fi
echo
echo "=========================================================================="
echo "Migration complete."
echo "  Total downtime: ${DOWNTIME}s"
echo "  Log: $LOG_FILE"
echo "=========================================================================="
