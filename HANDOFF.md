# Handoff — Alice

What needs doing. Nothing else.

1. **Paper one — methods section.** Reproducibility proof is three layers deep (see memory `project_reproducibility_milestone`). Substrate decisions are catalogued. The methods paragraph is the next deliverable.

---

## Open from 2026-04-30 cleanup pass

### 2. Verify provenance stamping on Supabase prod

The original instrument-health audit claimed 0/36 dynamical, 0/36 motor, 0/190 reconstruction-residual rows have `engine_provenance_id` stamped. That audit was run against a local DB. Prod state was never measured. Owner just got 50 sessions re-pipelined via `npm run drain-subjects`, so any rows with a NULL stamp on prod are either historical pre-provenance rows (NULL by design, fine) or a bug in the stamping path.

```sql
SELECT 'dynamical'   AS t, COUNT(*) FILTER (WHERE engine_provenance_id IS NULL) AS unstamped, COUNT(*) AS total FROM tb_dynamical_signals
UNION ALL SELECT 'motor',         COUNT(*) FILTER (WHERE engine_provenance_id IS NULL), COUNT(*) FROM tb_motor_signals
UNION ALL SELECT 'process',       COUNT(*) FILTER (WHERE engine_provenance_id IS NULL), COUNT(*) FROM tb_process_signals
UNION ALL SELECT 'cross_session', COUNT(*) FILTER (WHERE engine_provenance_id IS NULL), COUNT(*) FROM tb_cross_session_signals
UNION ALL SELECT 'integrity',     COUNT(*) FILTER (WHERE engine_provenance_id IS NULL), COUNT(*) FROM tb_session_integrity
UNION ALL SELECT 'residuals',     COUNT(*) FILTER (WHERE engine_provenance_id IS NULL), COUNT(*) FROM tb_reconstruction_residuals;
```

If the unstamped counts are non-zero on rows written after the worker added `stampEngineProvenance`, dig into `libSignalWorker.runJob` and `libDb.stampEngineProvenance`. Code path is correct on inspection; need to confirm against live data.

### 3. Finish migration-030 `TODO(step5): review` markers

~6 markers left in:

- `src/pages/api/event.ts`
- `src/pages/api/health.ts`
- `src/pages/api/feedback.ts`
- `src/pages/api/avatar.ts`
- `src/pages/api/calibrate.ts`
- `src/lib/libDb.ts`

Each marker flags a place where `subjectId` is currently hard-coded to owner (`subject_id = 1`) and should be derived from `Astro.locals.subject` once multi-tenant work flows through that endpoint. Migration 030's "Step 5" was supposed to do the codebase sweep. It never finished.

For each marker, decide whether the endpoint should be subject-aware. If yes, replace the hard-coded `1` with the resolved subject from `locals.subject`. If no (e.g. owner-only by design), delete the TODO and leave a one-line comment locking it to owner.

### 4. `console.*` noise in `src/lib/`

Some lib files spam on every signal job. The worker runs the pipeline on every submission. `console.log` / `console.error` calls in lib files bypass `data/errors.log` (the structured `logError` helper in `src/lib/utlErrorLog.ts`) and clutter stdout in dev.

Grep `src/lib/` for `console\.`, audit each match. Either delete the call (debug leftovers) or replace with `logError(scope, err, ctx)`. Keep `console.log` in scripts (`src/scripts/`) and dev-only paths.

### 5. Audit `src/scripts/` for stale one-shots

30+ backfill / recompute / verify scripts. Many are likely one-shot research code that already ran. For each, decide:

- **Active tool** (used in operator workflow): keep, document if undocumented.
- **One-shot, completed**: delete.
- **One-shot, broken**: delete.

Cross-reference against `package.json` scripts. Anything not aliased there and never `tsx`-invoked in current workflows is a deletion candidate.

Heavyweight candidates flagged but not investigated:
- `recompute-dynamical-v2.ts`
- `recompute-semantic-signals.ts`
- `recompute-cross-session.ts`
- `recompute-reconstruction.ts`
- `extract-residual-decomposition.ts`
- `verify-residual-integration.ts`
- `confound-analysis.ts` (774 lines)
- `screen-calibration-deltas.ts` (759 lines)

### 6. Revoke the Voyage AI API key

Removed from disk during the cleanup pass. Still live at Voyage. Log in to the VoyageAI dashboard and delete the key labeled `marrow-einstein created 4/11/26`. The key is no longer used by any code, but it remains valid as a credential at Voyage until you click delete.

### 7. Decide whether to rotate the Supabase password

Removed from `.claude/settings.local.json` (untracked file, never committed to git). Still in plaintext in `.env` (also untracked).

Risk class: local-disk only. The exposure was that a permission-allowlist entry captured an `export ALICE_PG_URL=...` command including the password.

Decision factors:
- Has anything ever synced `.claude/settings.local.json` or `.env` to a cloud service (Time Machine cloud backup, Dropbox, iCloud Drive)?
- Has the laptop been physically accessed by anyone you don't fully trust?

If "no" to both, no rotation needed. If "maybe" to either, rotate at Supabase (Project Settings → Database → Reset Database Password) and update `.env` and any other consumer of `ALICE_PG_URL`.

### 8. Investigate the unexplained low-novelty residual day

In the variant-1 `total_l2_norm` series for owner, one day reads ~9 against a rolling-window mean of ~38. That's a >2σ deviation toward "session looked unusually avatar-like" (the avatar reproduced behavior that's normally distinctive). Either:
- A real low-novelty cognitive day (boring topic, stock phrasings, fatigue).
- Or a measurement artifact (thin keystroke stream, atypical session length, calibration leakage).

Find the question_id with the outlier value, eyeball the session's word count, duration, P-burst stats, and the question text itself. If structural, document and move on. If it's a real session that genuinely looked statistically baseline, that's the kind of finding the instrument is designed to surface.

```sql
SELECT r.question_id, q.scheduled_for, ss.word_count, ss.total_duration_ms,
       r.total_l2_norm, r.adversary_variant_id
FROM tb_reconstruction_residuals r
JOIN tb_questions q ON r.question_id = q.question_id
JOIN tb_session_summaries ss ON r.question_id = ss.question_id
WHERE r.subject_id = 1
  AND r.adversary_variant_id = 1
  AND r.total_l2_norm < 15
  AND q.question_source_id != 3
ORDER BY r.total_l2_norm ASC
LIMIT 5;
```
