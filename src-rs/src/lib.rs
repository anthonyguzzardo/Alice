//! Alice Signal Engine -- napi-rs native module
//!
//! Ports the compute-heavy signal families from TypeScript to Rust.
//! Dynamical signals (RQA, DFA, permutation entropy, transfer entropy),
//! motor signals (sample entropy, ex-Gaussian, autocorrelation, etc.),
//! and process signals (text reconstruction, pause/burst analysis).

// All keystroke counts are bounded well below 2^52; usize->f64
// precision loss is irrelevant for these magnitudes.
#![allow(clippy::cast_precision_loss)]
// napi entry points are called from JS, not Rust; #[must_use] is meaningless.
#![allow(clippy::must_use_candidate)]

mod avatar;
mod dynamical;
mod motor;
mod process;
mod stats;
mod types;

use napi_derive::napi;
use serde::Serialize;

use types::KeystrokeEvent;

// ─── Dynamical signals ───────────────────────────────────────────

#[napi(object)]
#[derive(Serialize, Default)]
pub struct DynamicalSignals {
    pub iki_count: i32,
    pub hold_flight_count: i32,
    pub permutation_entropy: Option<f64>,
    pub permutation_entropy_raw: Option<f64>,
    pub pe_spectrum: Option<Vec<f64>>,
    pub dfa_alpha: Option<f64>,
    pub rqa_determinism: Option<f64>,
    pub rqa_laminarity: Option<f64>,
    pub rqa_trapping_time: Option<f64>,
    pub rqa_recurrence_rate: Option<f64>,
    pub te_hold_to_flight: Option<f64>,
    pub te_flight_to_hold: Option<f64>,
    pub te_dominance: Option<f64>,
}

#[napi]
#[allow(clippy::needless_pass_by_value)] // napi-rs requires owned String at FFI boundary
pub fn compute_dynamical_signals(stream_json: String) -> DynamicalSignals {
    let stream: Vec<KeystrokeEvent> = match serde_json::from_str(&stream_json) {
        Ok(s) => s,
        Err(_) => return DynamicalSignals::default(),
    };

    let r = dynamical::compute(&stream);

    DynamicalSignals {
        iki_count: i32::try_from(r.iki_count).unwrap_or(i32::MAX),
        hold_flight_count: i32::try_from(r.hold_flight_count).unwrap_or(i32::MAX),
        permutation_entropy: r.permutation_entropy,
        permutation_entropy_raw: r.permutation_entropy_raw,
        pe_spectrum: r.pe_spectrum,
        dfa_alpha: r.dfa_alpha,
        rqa_determinism: r.rqa.as_ref().map(|q| q.determinism),
        rqa_laminarity: r.rqa.as_ref().map(|q| q.laminarity),
        rqa_trapping_time: r.rqa.as_ref().map(|q| q.trapping_time),
        rqa_recurrence_rate: r.rqa.as_ref().map(|q| q.recurrence_rate),
        te_hold_to_flight: r.te_hold_to_flight,
        te_flight_to_hold: r.te_flight_to_hold,
        te_dominance: r.te_dominance,
    }
}

// ─── Motor signals ───────────────────────────────────────────────

#[napi(object)]
#[derive(Serialize, Default)]
pub struct MotorSignals {
    pub sample_entropy: Option<f64>,
    pub iki_autocorrelation: Option<Vec<f64>>,
    pub motor_jerk: Option<f64>,
    pub lapse_rate: Option<f64>,
    pub tempo_drift: Option<f64>,
    pub iki_compression_ratio: Option<f64>,
    pub digraph_latency_profile: Option<String>, // JSON-serialized Record<string, number>
    pub ex_gaussian_tau: Option<f64>,
    pub ex_gaussian_mu: Option<f64>,
    pub ex_gaussian_sigma: Option<f64>,
    pub tau_proportion: Option<f64>,
    pub adjacent_hold_time_cov: Option<f64>,
}

#[napi]
#[allow(clippy::needless_pass_by_value)]
pub fn compute_motor_signals(stream_json: String, total_duration_ms: f64) -> MotorSignals {
    let stream: Vec<KeystrokeEvent> = match serde_json::from_str(&stream_json) {
        Ok(s) => s,
        Err(_) => return MotorSignals::default(),
    };

    let r = motor::compute(&stream, total_duration_ms);

    MotorSignals {
        sample_entropy: r.sample_entropy,
        iki_autocorrelation: r.iki_autocorrelation,
        motor_jerk: r.motor_jerk,
        lapse_rate: r.lapse_rate,
        tempo_drift: r.tempo_drift,
        iki_compression_ratio: r.iki_compression_ratio,
        digraph_latency_profile: r.digraph_latency_profile,
        ex_gaussian_tau: r.ex_gaussian.as_ref().map(|e| e.tau),
        ex_gaussian_mu: r.ex_gaussian.as_ref().map(|e| e.mu),
        ex_gaussian_sigma: r.ex_gaussian.as_ref().map(|e| e.sigma),
        tau_proportion: r.ex_gaussian.as_ref().map(|e| e.tau_proportion),
        adjacent_hold_time_cov: r.adjacent_hold_time_cov,
    }
}

// ─── Process signals ─────────────────────────────────────────────

#[napi(object)]
#[derive(Serialize, Default)]
pub struct RBurstEntry {
    pub deleted_char_count: i32,
    pub total_char_count: i32,
    pub duration_ms: f64,
    pub start_offset_ms: f64,
    pub is_leading_edge: bool,
}

#[napi(object)]
#[derive(Serialize, Default)]
pub struct ProcessSignals {
    pub pause_within_word: Option<i32>,
    pub pause_between_word: Option<i32>,
    pub pause_between_sentence: Option<i32>,
    pub abandoned_thought_count: Option<i32>,
    pub r_burst_count: Option<i32>,
    pub i_burst_count: Option<i32>,
    pub r_burst_sequences: Vec<RBurstEntry>,
    pub vocab_expansion_rate: Option<f64>,
    pub phase_transition_point: Option<f64>,
    pub strategy_shift_count: Option<i32>,
}

#[napi]
#[allow(clippy::needless_pass_by_value)]
pub fn compute_process_signals(event_log_json: String) -> ProcessSignals {
    let r = process::compute(&event_log_json);

    ProcessSignals {
        pause_within_word: r.pause_within_word,
        pause_between_word: r.pause_between_word,
        pause_between_sentence: r.pause_between_sentence,
        abandoned_thought_count: r.abandoned_thought_count,
        r_burst_count: r.r_burst_count,
        i_burst_count: r.i_burst_count,
        r_burst_sequences: r
            .r_burst_details
            .into_iter()
            .map(|d| RBurstEntry {
                deleted_char_count: d.deleted_char_count,
                total_char_count: d.total_char_count,
                duration_ms: d.duration_ms,
                start_offset_ms: d.start_offset_ms,
                is_leading_edge: d.is_leading_edge,
            })
            .collect(),
        vocab_expansion_rate: r.vocab_expansion_rate,
        phase_transition_point: r.phase_transition_point,
        strategy_shift_count: r.strategy_shift_count,
    }
}

// ─── Avatar (text generation + timing synthesis) ────────────────

#[napi(object)]
#[derive(Serialize, Default)]
pub struct AvatarOutput {
    /// Generated text from Markov chain
    pub text: String,
    /// Per-character delay in ms
    pub delays: Vec<f64>,
    /// Synthetic keystroke stream as JSON (array of {c, d, u} events).
    /// Can be passed directly to the signal pipeline for validation.
    pub keystroke_stream_json: String,
    /// Word count of generated text
    pub word_count: i32,
    /// Markov order used (1 or 2)
    pub order: i32,
    /// Number of unique states in the chain
    pub chain_size: i32,
    /// Number of I-burst episodes injected. Cannot be detected from the
    /// flat keystroke stream; must be returned as metadata.
    pub i_burst_count: i32,
}

#[napi(object)]
#[derive(Serialize, Default)]
pub struct PerplexityOutput {
    /// Per-word log2 perplexity (lower = model predicts the text better)
    pub perplexity: f64,
    /// Number of words evaluated
    pub word_count: i32,
    /// Fraction of transitions that were known to the chain (0.0 to 1.0)
    pub known_fraction: f64,
}

/// Generate text from a personal corpus Markov chain with timing from a motor profile.
///
/// `corpus_json`: JSON array of response text strings
/// `topic`: seed topic for generation
/// `profile_json`: JSON object with timing profile fields (digraph, mu, sigma, tau, etc.)
/// `max_words`: maximum words to generate
#[napi]
#[allow(clippy::needless_pass_by_value)]
pub fn generate_avatar(
    corpus_json: String,
    topic: String,
    profile_json: String,
    max_words: i32,
) -> AvatarOutput {
    let r = match avatar::compute(&corpus_json, &topic, &profile_json, max_words.max(10) as usize)
    {
        Ok(r) => r,
        Err(_) => return AvatarOutput::default(),
    };

    // Serialize keystroke events into the wire format the signal pipeline expects
    let stream: Vec<serde_json::Value> = r
        .keystroke_events
        .iter()
        .map(|k| {
            serde_json::json!({
                "c": k.character.to_string(),
                "d": k.key_down_ms,
                "u": k.key_up_ms
            })
        })
        .collect();
    let keystroke_stream_json = serde_json::to_string(&stream).unwrap_or_default();

    AvatarOutput {
        text: r.text,
        delays: r.delays,
        keystroke_stream_json,
        word_count: i32::try_from(r.word_count).unwrap_or(i32::MAX),
        order: i32::try_from(r.order).unwrap_or(0),
        chain_size: i32::try_from(r.chain_size).unwrap_or(0),
        i_burst_count: i32::try_from(r.i_burst_count).unwrap_or(i32::MAX),
    }
}

// ─── Profile distance (mediation detection) ────────────────────

#[napi(object)]
#[derive(Serialize, Default)]
pub struct ProfileDistanceOutput {
    /// Per-dimension z-scores (only dimensions with std > 0)
    pub z_scores: Vec<f64>,
    /// L2 norm of z-scores
    pub distance: f64,
    /// How many dimensions contributed
    pub dimension_count: i32,
}

/// Compute profile distance: z-score each dimension against profile means/stds,
/// return L2 norm. Used for mediation detection (flagging anomalous sessions).
#[napi]
#[allow(clippy::needless_pass_by_value)]
pub fn compute_profile_distance(
    values_json: String,
    means_json: String,
    stds_json: String,
) -> ProfileDistanceOutput {
    let values: Vec<f64> = match serde_json::from_str(&values_json) {
        Ok(v) => v,
        Err(_) => return ProfileDistanceOutput::default(),
    };
    let means: Vec<f64> = match serde_json::from_str(&means_json) {
        Ok(v) => v,
        Err(_) => return ProfileDistanceOutput::default(),
    };
    let stds: Vec<f64> = match serde_json::from_str(&stds_json) {
        Ok(v) => v,
        Err(_) => return ProfileDistanceOutput::default(),
    };

    let (z_scores, distance) = stats::z_scores_and_distance(&values, &means, &stds);
    let dimension_count = i32::try_from(z_scores.len()).unwrap_or(i32::MAX);

    ProfileDistanceOutput {
        z_scores,
        distance,
        dimension_count,
    }
}

// ─── Batch lagged correlations (coupling stability) ─────────────

#[napi(object)]
#[derive(Serialize)]
pub struct CorrelationResult {
    /// Index of the first series (emotion dimension)
    pub a_index: i32,
    /// Index of the second series (behavior dimension)
    pub b_index: i32,
    /// Window size used
    pub window_size: i32,
    /// Best lagged Pearson correlation
    pub correlation: f64,
    /// Lag at which best correlation was found
    pub lag: i32,
}

/// Batch-compute lagged Pearson correlations between all pairs of
/// series_a and series_b at multiple window sizes. Returns only pairs
/// exceeding the threshold. Used for coupling stability analysis.
///
/// `series_a_json`: JSON array of arrays (e.g., 9 emotion dims x N entries)
/// `series_b_json`: JSON array of arrays (e.g., 7 behavior dims x N entries)
/// `window_sizes_json`: JSON array of window sizes to test
/// `max_lag`: maximum lag to test
/// `threshold`: minimum |r| to include in results
#[napi]
#[allow(clippy::needless_pass_by_value)]
pub fn compute_batch_correlations(
    series_a_json: String,
    series_b_json: String,
    window_sizes_json: String,
    max_lag: i32,
    threshold: f64,
) -> Vec<CorrelationResult> {
    let series_a: Vec<Vec<f64>> = match serde_json::from_str(&series_a_json) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };
    let series_b: Vec<Vec<f64>> = match serde_json::from_str(&series_b_json) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };
    let window_sizes_i32: Vec<i32> = match serde_json::from_str(&window_sizes_json) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };

    let ml = max_lag.max(0) as usize;
    let ws: Vec<usize> = window_sizes_i32.iter().map(|&w| w.max(0) as usize).collect();

    stats::batch_lagged_correlations(&series_a, &series_b, &ws, ml, threshold)
        .into_iter()
        .map(|(ai, bi, w, corr, lag)| CorrelationResult {
            a_index: i32::try_from(ai).unwrap_or(i32::MAX),
            b_index: i32::try_from(bi).unwrap_or(i32::MAX),
            window_size: i32::try_from(w).unwrap_or(i32::MAX),
            correlation: corr,
            lag: i32::try_from(lag).unwrap_or(i32::MAX),
        })
        .collect()
}

/// Compute perplexity of a text against the corpus Markov model.
/// Tracks convergence: as the corpus grows, perplexity of real journal
/// responses should decrease monotonically.
#[napi]
#[allow(clippy::needless_pass_by_value)]
pub fn compute_perplexity(corpus_json: String, text: String) -> PerplexityOutput {
    let r = match avatar::compute_text_perplexity(&corpus_json, &text) {
        Ok(r) => r,
        Err(_) => return PerplexityOutput { perplexity: -1.0, ..PerplexityOutput::default() },
    };
    let total = (r.known_transitions + r.unknown_transitions).max(1) as f64;

    PerplexityOutput {
        perplexity: if r.perplexity.is_finite() { r.perplexity } else { -1.0 },
        word_count: i32::try_from(r.word_count).unwrap_or(i32::MAX),
        known_fraction: r.known_transitions as f64 / total,
    }
}
