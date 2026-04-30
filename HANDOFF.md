# Handoff — Alice

What needs doing. Nothing else.

## Closed in 2026-04-30 second pass

- Voyage AI key revoked at the dashboard.
- Supabase password decision: no rotation. `.env` never left the disk (no iCloud/Dropbox/Time Machine sync; no untrusted physical access).
- Provenance stamping verified on prod. 5 affected questions ({126, 127, 157, 162, 194}, subjects 2 + 9) reprocessed via prod's worker; 18 rows now stamped with prod binary (engine_provenance_id = 6). Remaining NULLs on prod are pre-provenance-era rows — NULL by design.
- `npm run drain-subjects` and its 5 child backfill scripts deleted. They wrote signal rows from the laptop without stamping provenance; that path is gone. Surviving laptop-only flow: `npm run embed` (TEI embeddings, by design).
- 6 same-class backfill scripts deleted (process-signals, rburst-sequences, hold-flight-corr, adversary-variants, extended-residuals, integrity). All wrote Rust-derived signals from the laptop without stamping; the prod worker handles all of these on submission.

---

## Open

### 1. Paper one — methods section

Reproducibility proof is three layers deep (see memory `project_reproducibility_milestone`). Substrate decisions are catalogued. Provenance stamping verified end-to-end on prod after 2026-04-30 cleanup. The methods paragraph is the next deliverable.

Caveat to bake into the wording: a small number of prod rows carry `engine_provenance_id` linking to provenance row id=1 (Apple M5, owner's laptop) instead of id=6 (Hetzner AMD EPYC-Milan). This is from earlier worker runs hitting prod DB from the laptop, not from prod's binary. Either re-stamp those rows during the next prod-side recompute, or footnote: "stamps reflect the binary that ran the pipeline; prod-resident binaries dominate post-2026-04-30." The honest version is the second.

### 2. Finish migration-030 `TODO(step5): review` markers

5 active markers + 1 doc-comment in:

- `src/pages/api/event.ts`
- `src/pages/api/health.ts`
- `src/pages/api/feedback.ts`
- `src/pages/api/avatar.ts`
- `src/pages/api/calibrate.ts`
- `src/lib/libDb.ts` (the doc-comment, leave it)

Each active marker flags a place where `subjectId` is currently hard-coded to owner (`subject_id = 1`) and should be derived from `Astro.locals.subject` once multi-tenant work flows through that endpoint. For each, decide: subject-aware → replace with resolved subject from `locals.subject`; owner-only by design → delete the TODO and leave a one-line comment locking it to owner.

### 3. `console.*` noise narrowed to one file

Real per-submission spam is 6 timing logs in `src/lib/libSignalsNative.ts` (lines 168, 236, 271, 298, 369, 406 — `[signals] rust dynamical: Xms` etc.). Delete or gate behind `process.env.ALICE_DEBUG_NATIVE`. Other `console.*` in `src/lib/` is intentional (worker boot/shutdown, error-log helper, embed/TEI status) — leave it.

### 4. Remaining `src/scripts/` audit

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

### 5. Investigate the unexplained low-novelty residual day

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
