-- 004_add_personal_profile.sql
-- Rolling behavioral profile aggregated from all journal sessions.
-- Single row, updated in place after each session. The profile IS the current state.
-- Foundation for eventual writing avatar / process reconstruction.

SET search_path = alice, public;

CREATE TABLE IF NOT EXISTS tb_personal_profile (
    profile_id              SERIAL PRIMARY KEY,
    session_count           INT NOT NULL DEFAULT 0,
    last_question_id        INT,

    -- ── Motor fingerprint ──
    digraph_aggregate_json  JSONB,                  -- mean hold+flight per bigram across all sessions
    ex_gaussian_mu_mean     DOUBLE PRECISION,       -- rolling mean of per-session mu
    ex_gaussian_mu_std      DOUBLE PRECISION,
    ex_gaussian_sigma_mean  DOUBLE PRECISION,
    ex_gaussian_sigma_std   DOUBLE PRECISION,
    ex_gaussian_tau_mean    DOUBLE PRECISION,       -- attentional lapse signature
    ex_gaussian_tau_std     DOUBLE PRECISION,
    iki_mean_mean           DOUBLE PRECISION,       -- IKI distribution shape
    iki_mean_std            DOUBLE PRECISION,
    iki_std_mean            DOUBLE PRECISION,
    iki_skewness_mean       DOUBLE PRECISION,
    iki_kurtosis_mean       DOUBLE PRECISION,
    hold_time_mean_mean     DOUBLE PRECISION,
    hold_time_mean_std      DOUBLE PRECISION,
    flight_time_mean_mean   DOUBLE PRECISION,
    flight_time_mean_std    DOUBLE PRECISION,
    hold_time_cv_mean       DOUBLE PRECISION,       -- coefficient of variation baseline

    -- ── Writing process shape ──
    burst_count_mean        DOUBLE PRECISION,
    burst_count_std         DOUBLE PRECISION,
    burst_length_mean       DOUBLE PRECISION,       -- avg P-burst length across sessions
    burst_length_std        DOUBLE PRECISION,
    burst_consolidation     DOUBLE PRECISION,       -- second-half / first-half burst length ratio
    session_duration_mean   DOUBLE PRECISION,
    session_duration_std    DOUBLE PRECISION,
    word_count_mean         DOUBLE PRECISION,
    word_count_std          DOUBLE PRECISION,

    -- ── Pause architecture ──
    pause_within_word_pct   DOUBLE PRECISION,       -- % of pauses within-word (averaged)
    pause_between_word_pct  DOUBLE PRECISION,
    pause_between_sent_pct  DOUBLE PRECISION,
    pause_rate_mean         DOUBLE PRECISION,       -- pauses per active minute
    first_keystroke_mean    DOUBLE PRECISION,
    first_keystroke_std     DOUBLE PRECISION,

    -- ── Revision topology ──
    small_del_rate_mean     DOUBLE PRECISION,       -- small deletions per 100 chars
    large_del_rate_mean     DOUBLE PRECISION,
    revision_timing_bias    DOUBLE PRECISION,       -- 0=early, 1=late, 0.5=distributed
    r_burst_ratio_mean      DOUBLE PRECISION,       -- R-bursts / (R+I bursts)

    -- ── Language signature ──
    trigram_model_json      JSONB,                  -- character trigram frequencies from all entries
    vocab_cumulative        INT,                    -- cumulative unique content words seen
    mattr_mean              DOUBLE PRECISION,
    mattr_std               DOUBLE PRECISION,

    dttm_updated_utc        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE tb_personal_profile IS
'PURPOSE: Rolling behavioral profile aggregated from all journal sessions.
USE CASE: Foundation for writing avatar / process reconstruction. Single row updated in place.
MUTABILITY: Updated after each journal session.
REFERENCED BY: None yet (future avatar system).
FOOTER: dttm_updated_utc only.';
