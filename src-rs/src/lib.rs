//! Alice Signal Engine — napi-rs native module
//!
//! Ports the compute-heavy signal families from TypeScript to Rust.
//! Dynamical signals (RQA, DFA, permutation entropy, transfer entropy),
//! motor signals (sample entropy, ex-Gaussian, autocorrelation, etc.),
//! and process signals (text reconstruction, pause/burst analysis).

mod dynamical;
mod motor;
mod process;
mod stats;

use napi_derive::napi;
use serde::{Deserialize, Serialize};

// ─── Shared types ──────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct KeystrokeEvent {
    pub c: String,
    pub d: f64,
    pub u: f64,
}

// ─── Dynamical signals ─────────────────────────────────────────────

#[napi(object)]
#[derive(Serialize)]
pub struct DynamicalSignals {
    pub iki_count: i32,
    pub hold_flight_count: i32,
    pub permutation_entropy: Option<f64>,
    pub permutation_entropy_raw: Option<f64>,
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
pub fn compute_dynamical_signals(stream_json: String) -> DynamicalSignals {
    let stream: Vec<KeystrokeEvent> = match serde_json::from_str(&stream_json) {
        Ok(s) => s,
        Err(_) => {
            return DynamicalSignals {
                iki_count: 0,
                hold_flight_count: 0,
                permutation_entropy: None,
                permutation_entropy_raw: None,
                dfa_alpha: None,
                rqa_determinism: None,
                rqa_laminarity: None,
                rqa_trapping_time: None,
                rqa_recurrence_rate: None,
                te_hold_to_flight: None,
                te_flight_to_hold: None,
                te_dominance: None,
            };
        }
    };

    dynamical::compute(&stream)
}

// ─── Motor signals ─────────────────────────────────────────────────

#[napi(object)]
#[derive(Serialize)]
pub struct MotorSignals {
    pub sample_entropy: Option<f64>,
    pub iki_autocorrelation: Option<Vec<f64>>,
    pub motor_jerk: Option<f64>,
    pub lapse_rate: Option<f64>,
    pub tempo_drift: Option<f64>,
    pub iki_compression_ratio: Option<f64>,
    pub digraph_latency_profile: Option<String>, // JSON string of Record<string, number>
    pub ex_gaussian_tau: Option<f64>,
    pub ex_gaussian_mu: Option<f64>,
    pub ex_gaussian_sigma: Option<f64>,
    pub tau_proportion: Option<f64>,
    pub adjacent_hold_time_cov: Option<f64>,
}

#[napi]
pub fn compute_motor_signals(stream_json: String, total_duration_ms: f64) -> MotorSignals {
    let stream: Vec<KeystrokeEvent> = match serde_json::from_str(&stream_json) {
        Ok(s) => s,
        Err(_) => {
            return MotorSignals {
                sample_entropy: None,
                iki_autocorrelation: None,
                motor_jerk: None,
                lapse_rate: None,
                tempo_drift: None,
                iki_compression_ratio: None,
                digraph_latency_profile: None,
                ex_gaussian_tau: None,
                ex_gaussian_mu: None,
                ex_gaussian_sigma: None,
                tau_proportion: None,
                adjacent_hold_time_cov: None,
            };
        }
    };

    motor::compute(&stream, total_duration_ms)
}

// ─── Process signals ───────────────────────────────────────────────

#[napi(object)]
#[derive(Serialize)]
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
pub fn compute_process_signals(event_log_json: String) -> ProcessSignals {
    process::compute(&event_log_json)
}
