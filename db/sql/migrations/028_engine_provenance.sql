-- 028_engine_provenance.sql
-- Binary provenance tracking for the Rust signal engine.
--
-- Why: Alice claims bit-identical reproducibility for signal computation. The
-- claim only holds when (binary, microarchitecture) is fixed; same source
-- compiled twice can produce different floats due to LLVM nondeterminism, and
-- same binary on different microarchitectures (e.g. AMD EPYC Milan vs Genoa)
-- can take different vectorized paths. Without recording WHICH binary on WHICH
-- CPU produced each signal row, the reproducibility claim cannot be verified
-- post-hoc against any individual measurement.
--
-- This migration adds:
--   - tb_engine_provenance: one row per (binary_sha256, cpu_model) pair ever
--     observed at process boot.
--   - engine_provenance_id (logical FK) on every Rust-derived signal table.
--     Nullable so existing pre-2026-04-25 rows can stay (their provenance is
--     "unknown — pre-provenance era").
--
-- Note: tb_semantic_signals does NOT get the column. computeSemanticSignals
-- and computeDiscourseCoherence are pure TypeScript / TEI HTTP calls; the
-- Rust engine is not in their code path.

SET search_path = alice, public;

-- ============================================================================
-- PROVENANCE TABLE
-- ============================================================================

-- PURPOSE: identify which Rust signal-engine binary produced a given signal
-- USE CASE: at process boot, the engine module computes SHA-256 of the loaded
--           .node file, reads CPU model + arch + target_cpu flag, and looks up
--           or inserts a row here. The returned engine_provenance_id is cached
--           process-wide and stamped on every signal row written by that
--           process. Two processes with the same binary on the same CPU model
--           share a row; different CPU generations (Milan vs Genoa) get
--           distinct rows even with the same binary because vectorized FP
--           paths can diverge.
-- MUTABILITY: insert-only; rows are immutable identity records
-- REFERENCED BY: tb_dynamical_signals.engine_provenance_id,
--                tb_motor_signals.engine_provenance_id,
--                tb_process_signals.engine_provenance_id,
--                tb_cross_session_signals.engine_provenance_id,
--                tb_session_integrity.engine_provenance_id,
--                tb_reconstruction_residuals.engine_provenance_id
-- FOOTER: dttm_observed_first only (no modification)
CREATE TABLE IF NOT EXISTS tb_engine_provenance (
   engine_provenance_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,binary_sha256         TEXT NOT NULL                                 -- SHA-256 of the .node file as loaded
  ,code_commit_hash      TEXT                                          -- git rev-parse HEAD at build time (best-effort)
  ,cpu_model             TEXT NOT NULL                                 -- e.g. "Apple M1 Pro" or "AMD EPYC 9654 96-Core Processor"
  ,host_arch             TEXT NOT NULL                                 -- "aarch64" / "x86_64"
  ,target_cpu_flag       TEXT                                          -- "x86-64-v3" on Linux production, NULL on dev
  ,napi_rs_version       TEXT                                          -- e.g. "3.6.2"
  ,rustc_version         TEXT                                          -- e.g. "rustc 1.85.0"
  ,UNIQUE (binary_sha256, cpu_model)
  ,dttm_observed_first   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- ADD engine_provenance_id COLUMN TO RUST-DERIVED SIGNAL TABLES
-- ============================================================================

ALTER TABLE tb_dynamical_signals
  ADD COLUMN IF NOT EXISTS engine_provenance_id INT;

ALTER TABLE tb_motor_signals
  ADD COLUMN IF NOT EXISTS engine_provenance_id INT;

ALTER TABLE tb_process_signals
  ADD COLUMN IF NOT EXISTS engine_provenance_id INT;

ALTER TABLE tb_cross_session_signals
  ADD COLUMN IF NOT EXISTS engine_provenance_id INT;

ALTER TABLE tb_session_integrity
  ADD COLUMN IF NOT EXISTS engine_provenance_id INT;

ALTER TABLE tb_reconstruction_residuals
  ADD COLUMN IF NOT EXISTS engine_provenance_id INT;
