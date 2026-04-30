# Handoff — Alice

What needs doing. Nothing else.

## Closed in 2026-04-30 second pass

- Voyage AI key revoked at the dashboard.
- Supabase password decision: no rotation. `.env` never left the disk (no iCloud/Dropbox/Time Machine sync; no untrusted physical access).
- Provenance stamping verified on prod. 5 affected questions ({126, 127, 157, 162, 194}, subjects 2 + 9) reprocessed via prod's worker; 18 rows now stamped with prod binary (engine_provenance_id = 6). Remaining NULLs on prod are pre-provenance-era rows — NULL by design.
- `npm run drain-subjects` and its 5 child backfill scripts deleted. They wrote signal rows from the laptop without stamping provenance; that path is gone. Surviving laptop-only flow: `npm run embed` (TEI embeddings, by design).
- 6 same-class backfill scripts deleted (process-signals, rburst-sequences, hold-flight-corr, adversary-variants, extended-residuals, integrity). All wrote Rust-derived signals from the laptop without stamping; the prod worker handles all of these on submission.
- Paper one (option_f_draft.md, "Reconstruction Validity") Section 4.4 updated. Three reproducibility properties expanded to four; new property #4 covers per-row binary provenance. Closing paragraph distinguishes pre-reproducibility-era residuals (frozen artifacts) from pre-provenance-era signal rows (NULL stamp by design). Needs a real-eyes pass before publication.
- Migration-030 `TODO(step5): review` markers closed. All 5 active sites (event, health, feedback, avatar, calibrate) determined owner-only; TODO lines deleted, owner-lock comments left in place. Subjects use parallel `/api/subject/*` endpoints for what they actually need. Doc-comment in `libDb.ts:51` intentionally retained (documents the convention).

---

## Open

### 1. `console.*` noise narrowed to one file

Real per-submission spam is 6 timing logs in `src/lib/libSignalsNative.ts` (lines 168, 236, 271, 298, 369, 406 — `[signals] rust dynamical: Xms` etc.). Delete or gate behind `process.env.ALICE_DEBUG_NATIVE`. Other `console.*` in `src/lib/` is intentional (worker boot/shutdown, error-log helper, embed/TEI status) — leave it.

### 2. Remaining `src/scripts/` audit

drain-subjects + 5 child backfills + backfill-embeddings already deleted. ~24 scripts remain; ~9 are aliased in package.json. Deletion candidates (heavyweight, likely one-shot research code):

- `recompute-reconstruction.ts`
- `recompute-cross-session.ts`
- `recompute-semantic-signals.ts`
- `extract-residual-decomposition.ts`
- `verify-residual-integration.ts`
- `extract-calibration-deltas.ts`
- `screen-calibration-deltas.ts` (759 lines)
- `confound-analysis.ts` (774 lines)
- `describe-session-pairs.ts`
- `schedule-questions.ts`

(`backfill-encryption.ts` is encryption migration, not signal compute — keep.)

### 3. Investigate the unexplained low-novelty residual day

Variant-1 `total_l2_norm` for owner has one day reading ~9 against a rolling-window mean of ~38 (>2σ toward "session looked unusually avatar-like"). Either a real low-novelty cognitive day or a measurement artifact. Find the question_id, eyeball word count, duration, P-burst stats, the question text. If structural, document. If real, that's the kind of finding the instrument is designed to surface.

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
