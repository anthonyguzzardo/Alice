-- Phase 4: Cross-session motor and semantic extensions (INC-012)
-- Motor self-perplexity: motor twin of text selfPerplexity
-- Discourse coherence: global vs local thematic coherence (Asgari 2023)

SET search_path = alice, public;

-- Motor self-perplexity (cross-session)
ALTER TABLE tb_cross_session_signals
  ADD COLUMN IF NOT EXISTS motor_self_perplexity         DOUBLE PRECISION;

-- Discourse coherence (semantic)
ALTER TABLE tb_semantic_signals
  ADD COLUMN IF NOT EXISTS discourse_global_coherence    DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS discourse_local_coherence     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS discourse_global_local_ratio  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS discourse_coherence_decay_slope DOUBLE PRECISION;

COMMENT ON COLUMN tb_cross_session_signals.motor_self_perplexity IS 'Motor twin of selfPerplexity. IKI trigram model perplexity against personal motor baseline. Higher = more novel timing patterns.';
COMMENT ON COLUMN tb_semantic_signals.discourse_global_coherence IS 'Mean cosine similarity of each sentence to the first sentence. Thematic consistency across the response (Asgari 2023).';
COMMENT ON COLUMN tb_semantic_signals.discourse_local_coherence IS 'Mean cosine similarity of each sentence to the preceding sentence. Adjacent idea connectivity.';
COMMENT ON COLUMN tb_semantic_signals.discourse_global_local_ratio IS 'Global / local coherence ratio. High = globally coherent. Low = locally connected but thematically drifting.';
COMMENT ON COLUMN tb_semantic_signals.discourse_coherence_decay_slope IS 'Linear regression slope of global coherence against sentence position. Negative = coherence erodes through the response.';
