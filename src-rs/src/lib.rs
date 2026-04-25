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

// ─── napi boundary input types ────────────────────────────────────
// These are the JS-side representation of structured inputs. They use the
// short wire-format names (c/d/u) directly; conversion to internal Rust
// types happens at the entry point. Keeping a separate boundary type means
// the internal `KeystrokeEvent` (with `pub(crate)` visibility and readable
// field names) is decoupled from the FFI ABI.

#[napi(object)]
pub struct KeystrokeEventInput {
    /// Key character / code
    pub c: String,
    /// Key-down offset (ms)
    pub d: f64,
    /// Key-up offset (ms)
    pub u: f64,
}

impl From<KeystrokeEventInput> for KeystrokeEvent {
    fn from(e: KeystrokeEventInput) -> Self {
        KeystrokeEvent {
            character: e.c,
            key_down_ms: e.d,
            key_up_ms: e.u,
        }
    }
}

fn into_internal_stream(input: Vec<KeystrokeEventInput>) -> Vec<KeystrokeEvent> {
    input.into_iter().map(KeystrokeEvent::from).collect()
}

// ─── Dynamical signals ───────────────────────────────────────────

#[napi(object)]
#[derive(Serialize, Default)]
pub struct DynamicalSignals {
    /// Non-empty if the input JSON failed to parse. Caller should log this
    /// rather than treating the all-None result as "insufficient data."
    pub parse_error: Option<String>,
    pub iki_count: i32,
    pub hold_flight_count: i32,
    pub permutation_entropy: Option<f64>,
    pub permutation_entropy_raw: Option<f64>,
    pub pe_spectrum: Option<Vec<f64>>,
    pub dfa_alpha: Option<f64>,
    pub mfdfa_spectrum_width: Option<f64>,
    pub mfdfa_asymmetry: Option<f64>,
    pub mfdfa_peak_alpha: Option<f64>,
    pub temporal_irreversibility: Option<f64>,
    pub iki_psd_spectral_slope: Option<f64>,
    pub iki_psd_respiratory_peak_hz: Option<f64>,
    pub peak_typing_frequency_hz: Option<f64>,
    pub iki_psd_lf_hf_ratio: Option<f64>,
    pub iki_psd_fast_slow_variance_ratio: Option<f64>,
    pub statistical_complexity: Option<f64>,
    pub forbidden_pattern_fraction: Option<f64>,
    pub weighted_pe: Option<f64>,
    pub lempel_ziv_complexity: Option<f64>,
    pub optn_transition_entropy: Option<f64>,
    pub optn_forbidden_transition_count: Option<i32>,
    pub rqa_determinism: Option<f64>,
    pub rqa_laminarity: Option<f64>,
    pub rqa_trapping_time: Option<f64>,
    pub rqa_recurrence_rate: Option<f64>,
    pub rqa_recurrence_time_entropy: Option<f64>,
    pub rqa_mean_recurrence_time: Option<f64>,
    pub recurrence_transitivity: Option<f64>,
    pub recurrence_avg_path_length: Option<f64>,
    pub recurrence_clustering: Option<f64>,
    pub recurrence_assortativity: Option<f64>,
    pub effective_information: Option<f64>,
    pub causal_emergence_index: Option<f64>,
    pub optimal_causal_scale: Option<i32>,
    pub pid_synergy: Option<f64>,
    pub pid_redundancy: Option<f64>,
    pub branching_ratio: Option<f64>,
    pub avalanche_size_exponent: Option<f64>,
    pub dmd_dominant_frequency: Option<f64>,
    pub dmd_dominant_decay_rate: Option<f64>,
    pub dmd_mode_count: Option<i32>,
    pub dmd_spectral_entropy: Option<f64>,
    pub pause_mixture_component_count: Option<i32>,
    pub pause_mixture_motor_proportion: Option<f64>,
    pub pause_mixture_cognitive_load_index: Option<f64>,
    pub te_hold_to_flight: Option<f64>,
    pub te_flight_to_hold: Option<f64>,
    pub te_dominance: Option<f64>,
}

#[napi]
pub fn compute_dynamical_signals(stream: Vec<KeystrokeEventInput>) -> DynamicalSignals {
    // Typed-boundary path: napi-rs decodes the JS array of {c,d,u} objects
    // directly into Vec<KeystrokeEventInput>, replacing the previous
    // JSON-string + serde_json::from_str round trip. For a 10K-keystroke
    // session this is ~1MB of serialization avoided per call.
    let stream = into_internal_stream(stream);

    let r = dynamical::compute(&stream);

    DynamicalSignals {
        parse_error: None,
        iki_count: i32::try_from(r.iki_count).unwrap_or(i32::MAX),
        hold_flight_count: i32::try_from(r.hold_flight_count).unwrap_or(i32::MAX),
        permutation_entropy: r.permutation_entropy,
        permutation_entropy_raw: r.permutation_entropy_raw,
        pe_spectrum: r.pe_spectrum,
        dfa_alpha: r.dfa_alpha,
        mfdfa_spectrum_width: r.mfdfa.as_ref().map(|m| m.spectrum_width),
        mfdfa_asymmetry: r.mfdfa.as_ref().map(|m| m.asymmetry),
        mfdfa_peak_alpha: r.mfdfa.as_ref().map(|m| m.peak_alpha),
        temporal_irreversibility: r.temporal_irreversibility,
        iki_psd_spectral_slope: r.iki_psd_spectral_slope,
        iki_psd_respiratory_peak_hz: r.iki_psd_respiratory_peak_hz,
        peak_typing_frequency_hz: r.peak_typing_frequency_hz,
        iki_psd_lf_hf_ratio: r.iki_psd_lf_hf_ratio,
        iki_psd_fast_slow_variance_ratio: r.iki_psd_fast_slow_variance_ratio,
        statistical_complexity: r.ordinal.as_ref().map(|o| o.statistical_complexity),
        forbidden_pattern_fraction: r.ordinal.as_ref().map(|o| o.forbidden_pattern_fraction),
        weighted_pe: r.ordinal.as_ref().map(|o| o.weighted_pe),
        lempel_ziv_complexity: r.ordinal.as_ref().map(|o| o.lempel_ziv_complexity),
        optn_transition_entropy: r.ordinal.as_ref().map(|o| o.optn_transition_entropy),
        optn_forbidden_transition_count: r.ordinal.as_ref().map(|o| o.optn_forbidden_transition_count),
        rqa_determinism: r.rqa.as_ref().map(|q| q.determinism),
        rqa_laminarity: r.rqa.as_ref().map(|q| q.laminarity),
        rqa_trapping_time: r.rqa.as_ref().map(|q| q.trapping_time),
        rqa_recurrence_rate: r.rqa.as_ref().map(|q| q.recurrence_rate),
        rqa_recurrence_time_entropy: r.rqa_recurrence_time_entropy,
        rqa_mean_recurrence_time: r.rqa_mean_recurrence_time,
        recurrence_transitivity: r.recurrence_network.as_ref().map(|n| n.transitivity),
        recurrence_avg_path_length: r.recurrence_network.as_ref().map(|n| n.avg_path_length),
        recurrence_clustering: r.recurrence_network.as_ref().map(|n| n.clustering_coefficient),
        recurrence_assortativity: r.recurrence_network.as_ref().map(|n| n.assortativity),
        effective_information: r.effective_information,
        causal_emergence_index: r.causal_emergence_index,
        optimal_causal_scale: r.optimal_causal_scale,
        pid_synergy: r.pid_synergy,
        pid_redundancy: r.pid_redundancy,
        branching_ratio: r.branching_ratio,
        avalanche_size_exponent: r.avalanche_size_exponent,
        dmd_dominant_frequency: r.dmd_dominant_frequency,
        dmd_dominant_decay_rate: r.dmd_dominant_decay_rate,
        dmd_mode_count: r.dmd_mode_count,
        dmd_spectral_entropy: r.dmd_spectral_entropy,
        pause_mixture_component_count: r.pause_mixture_component_count,
        pause_mixture_motor_proportion: r.pause_mixture_motor_proportion,
        pause_mixture_cognitive_load_index: r.pause_mixture_cognitive_load_index,
        te_hold_to_flight: r.te_hold_to_flight,
        te_flight_to_hold: r.te_flight_to_hold,
        te_dominance: r.te_dominance,
    }
}

// ─── Motor signals ───────────────────────────────────────────────

#[napi(object)]
#[derive(Serialize, Default)]
pub struct MotorSignals {
    /// Non-empty if the input JSON failed to parse.
    pub parse_error: Option<String>,
    pub sample_entropy: Option<f64>,
    pub mse_series: Option<Vec<f64>>,
    pub complexity_index: Option<f64>,
    pub ex_gaussian_fisher_trace: Option<f64>,
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
    pub hold_flight_rank_corr: Option<f64>,
}

#[napi]
pub fn compute_motor_signals(stream: Vec<KeystrokeEventInput>, total_duration_ms: f64) -> MotorSignals {
    // Typed-boundary path: see compute_dynamical_signals for rationale.
    let stream = into_internal_stream(stream);

    let r = motor::compute(&stream, total_duration_ms);

    MotorSignals {
        parse_error: None,
        sample_entropy: r.sample_entropy,
        mse_series: r.mse_series,
        complexity_index: r.complexity_index,
        ex_gaussian_fisher_trace: r.ex_gaussian_fisher_trace,
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
        hold_flight_rank_corr: r.hold_flight_rank_corr,
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
    /// Markov order used (1 or 2, or PPM max_depth for PPM variants)
    pub order: i32,
    /// Number of unique states in the chain
    pub chain_size: i32,
    /// Number of I-burst episodes injected. Cannot be detected from the
    /// flat keystroke stream; must be returned as metadata.
    pub i_burst_count: i32,
    /// Which adversary variant produced this result (1-5).
    pub variant: i32,
    /// PRNG seed used for this generation (u64 as decimal string).
    /// Store this to reproduce the exact same ghost via `regenerate_avatar`.
    /// Serialized as a string because JS Number loses precision above 2^53.
    pub seed: String,
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
    variant: i32,
) -> AvatarOutput {
    let av = avatar::AdversaryVariant::from_i32(variant);
    let seeded = match avatar::compute(
        &corpus_json,
        &topic,
        &profile_json,
        max_words.max(10) as usize,
        av,
    ) {
        Ok(s) => s,
        Err(_) => return AvatarOutput::default(),
    };

    let seed_str = seeded.seed.to_string();
    let r = seeded.result;

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
        variant: r.variant as i32,
        seed: seed_str,
    }
}

/// Regenerate a ghost from a stored seed for reproducibility verification.
///
/// Identical to `generate_avatar` except the PRNG seed is provided explicitly
/// (as a decimal string, since JS cannot represent u64 without precision loss)
/// instead of being derived from `SystemTime`. Given the same inputs and seed,
/// the output is bit-identical to the original generation.
#[napi]
#[allow(clippy::needless_pass_by_value)]
pub fn regenerate_avatar(
    corpus_json: String,
    topic: String,
    profile_json: String,
    max_words: i32,
    variant: i32,
    seed: String,
) -> AvatarOutput {
    let seed_val: u64 = match seed.parse() {
        Ok(v) => v,
        Err(_) => return AvatarOutput::default(),
    };

    let av = avatar::AdversaryVariant::from_i32(variant);
    let r = match avatar::compute_seeded(
        &corpus_json,
        &topic,
        &profile_json,
        max_words.max(10) as usize,
        av,
        seed_val,
    ) {
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
        variant: r.variant as i32,
        seed,
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
pub fn compute_profile_distance(
    values: Vec<f64>,
    means: Vec<f64>,
    stds: Vec<f64>,
) -> ProfileDistanceOutput {
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
pub fn compute_batch_correlations(
    series_a: Vec<Vec<f64>>,
    series_b: Vec<Vec<f64>>,
    window_sizes: Vec<i32>,
    max_lag: i32,
    threshold: f64,
) -> Vec<CorrelationResult> {
    let ml = max_lag.max(0) as usize;
    let ws: Vec<usize> = window_sizes.iter().map(|&w| w.max(0) as usize).collect();

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
pub fn compute_perplexity(corpus: Vec<String>, text: String) -> PerplexityOutput {
    // Re-serialize the corpus to JSON for the internal `compute_text_perplexity`
    // function. The avatar module accepts the JSON form because it's shared with
    // generate_avatar which still uses heterogeneous JSON profiles. Once the
    // avatar module is refactored to take typed inputs (Phase 4 follow-up),
    // this re-serialization can be removed too.
    let corpus_json = serde_json::to_string(&corpus).unwrap_or_else(|_| "[]".to_string());
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
