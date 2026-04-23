-- Residual reproducibility: store ghost generation inputs for regeneration.
-- See docs/designs/residual-reproducibility.md for the full design.
--
-- After this migration, every new residual stores the exact inputs needed
-- to regenerate the ghost: PRNG seed, profile snapshot, corpus hash, and
-- topic string. Historical rows get NULL (pre-reproducibility-era).

SET search_path = alice, public;

ALTER TABLE tb_reconstruction_residuals
  ADD COLUMN avatar_seed              TEXT,
  ADD COLUMN profile_snapshot_json    JSONB,
  ADD COLUMN corpus_sha256            TEXT,
  ADD COLUMN avatar_topic             TEXT;

COMMENT ON COLUMN tb_reconstruction_residuals.avatar_seed IS
  'PRNG seed (u64 decimal string) used to generate the ghost. NULL for pre-reproducibility-era rows.';

COMMENT ON COLUMN tb_reconstruction_residuals.profile_snapshot_json IS
  'Exact profile JSON passed to generateAvatar() at computation time. NULL for pre-reproducibility-era rows.';

COMMENT ON COLUMN tb_reconstruction_residuals.corpus_sha256 IS
  'SHA-256 hex digest of the corpusJson string passed to generateAvatar(). NULL for pre-reproducibility-era rows.';

COMMENT ON COLUMN tb_reconstruction_residuals.avatar_topic IS
  'Topic string passed to generateAvatar(). Currently equals question text. NULL for pre-reproducibility-era rows.';
