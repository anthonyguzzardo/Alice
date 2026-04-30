# Handoff — Alice

What needs doing. Nothing else.

## Closed in 2026-04-30 cleanup

- Voyage AI key revoked at the dashboard.
- Supabase password decision: no rotation. `.env` never left disk (no iCloud/Dropbox/Time Machine sync, no untrusted physical access).
- Provenance stamping verified on prod. 5 affected questions reprocessed via prod's worker; 18 rows now stamped with prod binary (`engine_provenance_id = 6`).
- 12 backfill / drain / recompute scripts deleted (drain-subjects + 5 child backfills, 6 same-class signal backfills, plus repo-root `recompute-dynamical-v2` and `diagnose-holdlight-alignment`). All wrote Rust-derived signals from the laptop without stamping; the prod worker handles all of these on submission. Surviving laptop-only flow: `npm run embed`.
- 9 dead one-shot research / analysis scripts deleted (`recompute-reconstruction`, `recompute-cross-session`, `recompute-semantic-signals`, `extract-residual-decomposition`, `verify-residual-integration`, `extract-calibration-deltas`, `screen-calibration-deltas`, `confound-analysis`, `describe-session-pairs`). 4 orphaned test files removed alongside.
- Paper one (`option_f_draft.md`, "Reconstruction Validity") Section 4.4 updated. Three reproducibility properties expanded to four; new property #4 covers per-row binary provenance. Closing paragraph distinguishes pre-reproducibility-era residuals from pre-provenance-era signal rows. Needs a real-eyes pass before publication.
- Migration-030 `TODO(step5): review` markers closed. All 5 active sites (event, health, feedback, avatar, calibrate) determined owner-only; TODOs deleted, owner-lock comments left in place. Subjects use parallel `/api/subject/*` endpoints. Doc-comment in `libDb.ts:51` retained intentionally.
- `console.*` per-job timing spam removed from `libSignalsNative.ts` (6 logs + their orphan `t0` declarations).

---

## Open

### 1. Low-novelty residual cluster — cold-start, not a bug

The HANDOFF flagged "one day reading ~9 against rolling-window mean of ~38." The query returned five sessions, not one:

| qid | scheduled_for | word_count | duration_ms | total_l2_norm |
|-----|---------------|-----------:|------------:|--------------:|
|   1 | 2026-04-13    |         90 |     236,936 |          7.89 |
|   3 | 2026-04-15    |        153 |     169,729 |          8.64 |
|  12 | 2026-04-24    |        131 |     308,507 |          8.87 |
|   5 | 2026-04-17    |        146 |     137,970 |          9.37 |
|   2 | 2026-04-14    |        187 |     194,283 |          9.60 |

Four of five are sessions Q1–Q5 (Apr 13–17 — the first week of journaling). Word counts and durations are unremarkable. The pattern is a cold-start: the avatar reconstructs more faithfully when the profile has thin behavioral diversity, so early-corpus residuals collapse toward the lower bound. This is a real instrument property, not a measurement artifact and not a structural error. Q12 is the only later outlier worth a deeper look if reviewer questions arise.

Decision needed: document this as a known cold-start regime in the methods section (one sentence in Section 4.4 or 6), or footnote it where the residual values are first reported.
