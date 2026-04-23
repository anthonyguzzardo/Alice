-- Contamination attestation columns on tb_responses.
--
-- Each response row records: which contamination boundary version was active
-- at write time, a reference to the boundary audit document, and the git
-- commit hash of the application code that produced the session.
--
-- This enables a downstream auditor to verify that a given response was
-- produced under a known, audited code path with no AI mediation between
-- keystroke and storage.

SET search_path = alice, public;

ALTER TABLE tb_responses
  ADD COLUMN IF NOT EXISTS contamination_boundary_version TEXT NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS audited_code_paths_ref TEXT NOT NULL DEFAULT 'docs/contamination-boundary-v1.md',
  ADD COLUMN IF NOT EXISTS code_commit_hash TEXT NOT NULL DEFAULT 'pre-attestation';

COMMENT ON COLUMN tb_responses.contamination_boundary_version IS
  'Version tag of the contamination boundary audit active when this response was written.';

COMMENT ON COLUMN tb_responses.audited_code_paths_ref IS
  'File path to the boundary audit document that covers this response''s code paths.';

COMMENT ON COLUMN tb_responses.code_commit_hash IS
  'Git commit hash of the application code at session-write time. "pre-attestation" for rows before this migration.';
