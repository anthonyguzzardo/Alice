# Signal Integration Handoff -- 2026-04-24 (Final)

## Status: Complete

Phase 0-5 signal integration is fully operational. The pipeline blocking issue (INC-013) was resolved. All public-facing pages updated to reflect the expanded instrument.

## What the instrument computes per session

| Family | Signals | Engine | Table |
|---|---|---|---|
| Dynamical | 48 columns (9 sub-families) | Rust | tb_dynamical_signals |
| Motor | 16 columns | Rust | tb_motor_signals |
| Process | 9 columns | Rust | tb_process_signals |
| Semantic | 12 columns | TypeScript | tb_semantic_signals |
| Cross-session | 11 columns | TypeScript | tb_cross_session_signals |
| Behavioral state | 7 dimensions + convergence (derived) | TypeScript | tb_entry_states |

Ghost residuals: 41 behavioral dimensions across 7 theoretical families, stored in extended_residuals_json on tb_reconstruction_residuals.

Reproducibility: All signals covered by golden value snapshots. CI enforces bit-identity on every PR touching src-rs/.

## What was done this session

### Pipeline + data
- INC-013 fix: libSignalsNative.ts wrapper functions were silently stripping 38 new signal columns. Three edits resolved it. Backfill completed (31 dynamical + 31 motor rows).
- Extended ghost residuals from 13 to 41 dimensions (migration 022). All 180 existing residual rows backfilled.
- Calibration guard added to computeReconstructionResidual (last unguarded aggregate function).

### Public website updates
- **how-it-works.astro**: Signal counts (38->100+, 13->51/17, etc.), expanded signal chips in all family details, INC-013 provenance entry, impact paragraphs on all 8 timeline entries.
- **methodology.astro**: Dynamical section expanded from 4 to 15+ signal cards organized under 9 sub-family headers. New motor (3), semantic (4), cross-session (3) signal cards. New .mt-subfamily CSS.
- **instrument.astro**: Expanded family chips, fixed 8D->7D behavioral state error.
- **for-researchers.astro**: Updated all signal family detail spans.
- **collaborate.astro**: ~163 -> ~102 per-session signals.
- **research.astro**: Semantic signal count 7->14, signal family references expanded, reconstruction fidelity chart expanded from 5 to 9 dimensions with canvas height fix, open questions section updated.
- **docs route created**: New libDocs.ts + src/pages/docs/[slug].astro for /docs/contamination-boundary-v1 and /docs/embedding-methods (previously 404).
- **dev pages**: Fixed 8D->7D in signal-variants.astro (3) and signals.astro (1).

### Documentation
- **signals.md**: Removed all stale "planned"/"implementing" markers. Updated Signal Count summary (129->172 columns). Reclassified implemented sections from "Potential" to active.
- **METHODS_PROVENANCE.md**: INC-013 added, INC-012 resolution noted.
- **Papers**: A, C, F, G updated with signal expansion findings (done in prior session).

## What is NOT done

| Item | Status | Reason |
|---|---|---|
| Word frequency IKI residual | Deferred | Needs SUBTLEX-US data file |
| Persistent homology / TDA | Deferred | ~300 lines Rust, premature at current n |
| Circadian rhythm signals | Data-gated | Needs varied-hour sessions |
| Cognitive microstates / HSMM | Phase 2 | ~500 lines Rust, construct labels need validation |
| Wasserstein distance (cross-session motor) | Deferred | Nice-to-have, not urgent |
| Calibration engine parallel pipeline | Deferred | Design spec at systemDesign/CALIBRATION_ENGINE.md |

## Pipeline health

All 5 signal families flow correctly: Rust engine -> TypeScript wrappers -> database. Error logging comprehensive (9 logError calls in libSignalPipeline.ts). Health endpoint operational. No TODOs or stale references in pipeline code.
