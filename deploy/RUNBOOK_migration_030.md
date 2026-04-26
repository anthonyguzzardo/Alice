# Runbook — migration 030 (unify subject_id)

Cutover procedure for applying `db/sql/migrations/030_unify_subject_id.sql`
against production Supabase. Reviewed once now, executed once later when the
broader unification plan is ready (Steps 3–10 land first).

## Pre-conditions

- [ ] Migration 030 reviewed and approved.
- [ ] Local laptop has `.env` with `ALICE_PG_URL` (Session pooler URL).
- [ ] SSH key `~/.ssh/alice_hetzner` works (`ssh -i ~/.ssh/alice_hetzner root@5.78.203.243 uptime` returns).
- [ ] No subject is mid-session (check `journalctl -u alice.service -f` is quiet for ≥30s).
- [ ] Hetzner snapshot is recent (last 24h) — Hetzner Cloud Console → alice-prod → Snapshots.
- [ ] Local dry-run on `alice_migration_test` passed (Step 2 verification log on file).

## Expected downtime

**Sub-second migration runtime, 30s budget.** The window is dominated by the
ssh round-trip + service stop/start, not the SQL itself. During the window
subjects hitting the app see 502 from Caddy (alice.service down). Owner paths
served from the same backend; same 502 behavior.

## Procedure

### Option A — automated wrapper (recommended)

```bash
# From laptop, repo root
./deploy/run-migration.sh db/sql/migrations/030_unify_subject_id.sql
```

The wrapper:
1. Pre-flight: confirms ssh + database reachable
2. `systemctl stop alice.service` on Hetzner
3. `psql -v ON_ERROR_STOP=1 -f <migration>` against Supabase
4. **Pauses for operator review** of Block 6 verification output
5. Operator types `continue` to proceed (anything else aborts, service stays stopped)
6. `systemctl start alice.service` on Hetzner
7. Smoke check (`curl https://fweeo.com/enter`)
8. Reports total downtime

The pause at step 4 is the safety gate — review the verification output before
restarting the service. If anything looks wrong, type anything other than
`continue` and the service stays stopped for manual investigation.

Dry-run mode for sanity-check without execution:
```bash
DRY_RUN=1 ./deploy/run-migration.sh db/sql/migrations/030_unify_subject_id.sql
```

### Option B — manual (if the wrapper fails)

```bash
# From laptop
ssh -i ~/.ssh/alice_hetzner root@5.78.203.243 'systemctl stop alice.service'

# Apply migration
set -a; source .env; set +a
psql "$ALICE_PG_URL" -v ON_ERROR_STOP=1 -f db/sql/migrations/030_unify_subject_id.sql 2>&1 | tee /tmp/migration-030-prod.log

# Review the log — confirm:
#   - exit code 0 (last line shows COMMIT then 'migration complete')
#   - Block 6 shows 4 UNIQUE constraints
#   - Block 6 shows row counts unchanged from pre-migration
#   - Block 6 shows array_agg subject_id = {1} for every sampled table

# If verification looks right:
ssh -i ~/.ssh/alice_hetzner root@5.78.203.243 'systemctl start alice.service'

# Smoke check
curl -I https://fweeo.com/enter   # expect 200
```

## Expected verification output

After Block 6 the log should contain four blocks matching the local dry-run
exactly. Compare line-by-line against `/tmp/alice-migration-test/migration_run.log`
from the Step 2 dry-run.

Specifically:

```
--- 030: BLOCK 6 — post-migration constraint validation ---
                 conname                  |          tbl          |                def
------------------------------------------+-----------------------+------------------------------------
 tb_personal_profile_subject_key          | tb_personal_profile   | UNIQUE (subject_id)
 tb_questions_subject_scheduled_for_key   | tb_questions          | UNIQUE (subject_id, scheduled_for)
 tb_semantic_baselines_subject_signal_key | tb_semantic_baselines | UNIQUE (subject_id, signal_name)
 tb_session_delta_subject_date_key        | tb_session_delta      | UNIQUE (subject_id, session_date)
(4 rows)
```

If the constraint dump is missing one of these four, **stop and investigate** —
the wrapper has paused at step 4, service is still down. Do not type `continue`.

## Rollback

The migration runs in a single `BEGIN/COMMIT`. If `psql` exits non-zero
(`-v ON_ERROR_STOP=1`), the transaction has already rolled back — production
schema is unchanged. The wrapper detects this and exits early without
restarting the service, so you can investigate without a live app racing the
schema.

If the migration committed successfully but post-cutover monitoring reveals a
problem:

1. **Code-level rollback** (revert app changes from Steps 4–8) is preferred.
   The schema additions in 030 are backward-compatible — old code that ignores
   `subject_id` columns continues to work because Postgres allows extra columns
   to be present without referencing them.
2. **Schema-level rollback** is possible but expensive. The 030 migration adds
   columns and constraints; a reverse migration would `DROP CONSTRAINT` the
   five new UNIQUEs, restore the old ones (`scheduled_for UNIQUE`,
   `session_date UNIQUE`, `signal_name UNIQUE`), and either `DROP COLUMN
   subject_id` (loses the denormalized data) or leave the columns in place as
   nullable. There is no automated reverse migration. Write one only if a
   real production incident demands it.

The point of safety: the migration is small, atomic, and on a quiesced
service. The window for things to go wrong is narrow.

## Post-migration

- [ ] Block 6 verification matches the dry-run log line-by-line.
- [ ] `curl -I https://fweeo.com/enter` returns 200.
- [ ] `journalctl -u alice.service -n 50` shows clean startup (worker registered,
      no pgvector errors, no missing-column errors).
- [ ] Owner can log in via Caddy basic-auth and submit a journal session
      end-to-end (this exercises every modified write path).
- [ ] Subject `ash` can log in and reach `/subject` (this exercises the
      subject-scoped read path against unified tables).
- [ ] Update RESUME.md §1 to note migration 030 applied with date.
- [ ] Stash the production verification log alongside the dry-run log for
      future reference.

## When to run this

**Not yet.** This runbook exists so the procedure is reviewed and ready, but
the migration runs as part of Step 9 of the broader unification plan, AFTER:

- Step 3: `dbAlice_Tables.sql` updated to match the new shape
- Step 4: `libDb.ts` function signatures threaded with `subjectId`
- Step 5: All 47 query sites updated to scope by subject
- Step 6: All 12 aggregation hotspots reworked + tested
- Step 7: Lint rule added to prevent regression
- Step 8: Encryption uniformity applied

The migration is reversible until the DROP block at the end of 030 (which is
commented out). Step 9 is when those drops execute and the cutover becomes
the point of no return.
