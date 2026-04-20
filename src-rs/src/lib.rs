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
pub struct ProcessSignals {
    pub pause_within_word: Option<i32>,
    pub pause_between_word: Option<i32>,
    pub pause_between_sentence: Option<i32>,
    pub abandoned_thought_count: Option<i32>,
    pub r_burst_count: Option<i32>,
    pub i_burst_count: Option<i32>,
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
    /// Word count of generated text
    pub word_count: i32,
    /// Markov order used (1 or 2)
    pub order: i32,
    /// Number of unique states in the chain
    pub chain_size: i32,
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
    let r = avatar::compute(&corpus_json, &topic, &profile_json, max_words.max(10) as usize);

    AvatarOutput {
        text: r.text,
        delays: r.delays,
        word_count: i32::try_from(r.word_count).unwrap_or(i32::MAX),
        order: i32::try_from(r.order).unwrap_or(0),
        chain_size: i32::try_from(r.chain_size).unwrap_or(0),
    }
}
