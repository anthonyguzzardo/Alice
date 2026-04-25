//! Avatar reproducibility check: same (corpus, profile, seed, variant)
//! must produce bit-identical output across clean rebuilds.
//!
//! This test calls `regenerate_avatar` with a fixed seed for each of the
//! five adversary variants and serializes the full output (text, delays,
//! keystroke stream) to JSON. The CI script diffs these snapshots across
//! two clean builds.
//!
//! Run as: cargo test --test avatar_reproducibility
//! Or via: npm run reproducibility-check (which includes this automatically)

use alice_signals::*;

/// Fixed 5-entry corpus for deterministic Markov chain construction.
///
/// As of 2026-04-25 the napi boundary takes typed `Vec<String>` directly.
fn fixture_corpus() -> Vec<String> {
    vec![
        "I think about the way mornings feel when everything is still quiet and the light comes in slow.".to_string(),
        "There is something about writing that makes me see things I did not know I was carrying around.".to_string(),
        "The question made me pause because I realized I have been avoiding the obvious answer for weeks.".to_string(),
        "Sometimes the hardest part is not knowing what to say but deciding what actually matters right now.".to_string(),
        "I noticed today that my thinking changes shape depending on whether I am tired or just uncertain.".to_string(),
    ]
}

/// Fixed profile with all timing fields populated.
/// Values are realistic but arbitrary; the point is determinism, not accuracy.
///
/// Returns a fresh struct on each call (AvatarProfileInput contains a Vec
/// that doesn't impl Clone in napi(object) form).
fn fixture_profile() -> AvatarProfileInput {
    AvatarProfileInput {
        digraph: None,
        mu: Some(85.0),
        sigma: Some(22.0),
        tau: Some(45.0),
        burst_length: Some(12.0),
        pause_between_pct: Some(0.35),
        pause_sent_pct: Some(0.10),
        first_keystroke: Some(2500.0),
        small_del_rate: Some(1.8),
        large_del_rate: Some(0.4),
        revision_timing_bias: Some(0.55),
        r_burst_ratio: Some(0.25),
        rburst_mean_size: Some(3.2),
        rburst_leading_edge_pct: Some(0.6),
        rburst_consolidation: Some(0.45),
        rburst_mean_duration: Some(1800.0),
        iki_autocorrelation_lag1: Some(0.35),
        hold_flight_rank_correlation: Some(0.28),
        hold_time_mean: Some(92.0),
        hold_time_std: Some(19.0),
        flight_time_mean: Some(110.0),
        flight_time_std: Some(35.0),
    }
}

const FIXED_SEED: &str = "99999";
const MAX_WORDS: i32 = 50;

/// Write snapshot for a single variant.
fn snapshot_variant(variant: i32, snapshot_dir: &str) {
    let result = regenerate_avatar(
        fixture_corpus(),
        "morning".to_string(),
        fixture_profile(),
        MAX_WORDS,
        variant,
        FIXED_SEED.to_string(),
    );

    let output = serde_json::to_string(&result).unwrap();

    if !snapshot_dir.is_empty() {
        let path = std::path::Path::new(snapshot_dir).join(format!("avatar_v{variant}.json"));
        std::fs::write(&path, &output).expect("failed to write avatar snapshot");
        eprintln!("Snapshot written to {}", path.display());
    }
}

#[test]
fn avatar_v1_reproducible() {
    let dir = std::env::var("REPRO_SNAPSHOT_DIR").unwrap_or_default();
    snapshot_variant(1, &dir);

    // Within-binary determinism: same inputs, same output
    let a = regenerate_avatar(
        fixture_corpus(), "morning".into(),
        fixture_profile(), MAX_WORDS, 1, FIXED_SEED.into(),
    );
    let b = regenerate_avatar(
        fixture_corpus(), "morning".into(),
        fixture_profile(), MAX_WORDS, 1, FIXED_SEED.into(),
    );
    assert_eq!(
        serde_json::to_string(&a).unwrap(),
        serde_json::to_string(&b).unwrap(),
        "Variant 1 must be deterministic for same seed within same binary"
    );
}

#[test]
fn avatar_v2_reproducible() {
    let dir = std::env::var("REPRO_SNAPSHOT_DIR").unwrap_or_default();
    snapshot_variant(2, &dir);

    let a = regenerate_avatar(
        fixture_corpus(), "morning".into(),
        fixture_profile(), MAX_WORDS, 2, FIXED_SEED.into(),
    );
    let b = regenerate_avatar(
        fixture_corpus(), "morning".into(),
        fixture_profile(), MAX_WORDS, 2, FIXED_SEED.into(),
    );
    assert_eq!(
        serde_json::to_string(&a).unwrap(),
        serde_json::to_string(&b).unwrap(),
        "Variant 2 must be deterministic for same seed within same binary"
    );
}

#[test]
fn avatar_v3_reproducible() {
    let dir = std::env::var("REPRO_SNAPSHOT_DIR").unwrap_or_default();
    snapshot_variant(3, &dir);

    let a = regenerate_avatar(
        fixture_corpus(), "morning".into(),
        fixture_profile(), MAX_WORDS, 3, FIXED_SEED.into(),
    );
    let b = regenerate_avatar(
        fixture_corpus(), "morning".into(),
        fixture_profile(), MAX_WORDS, 3, FIXED_SEED.into(),
    );
    assert_eq!(
        serde_json::to_string(&a).unwrap(),
        serde_json::to_string(&b).unwrap(),
        "Variant 3 must be deterministic for same seed within same binary"
    );
}

#[test]
fn avatar_v4_reproducible() {
    let dir = std::env::var("REPRO_SNAPSHOT_DIR").unwrap_or_default();
    snapshot_variant(4, &dir);

    let a = regenerate_avatar(
        fixture_corpus(), "morning".into(),
        fixture_profile(), MAX_WORDS, 4, FIXED_SEED.into(),
    );
    let b = regenerate_avatar(
        fixture_corpus(), "morning".into(),
        fixture_profile(), MAX_WORDS, 4, FIXED_SEED.into(),
    );
    assert_eq!(
        serde_json::to_string(&a).unwrap(),
        serde_json::to_string(&b).unwrap(),
        "Variant 4 must be deterministic for same seed within same binary"
    );
}

#[test]
fn avatar_v5_reproducible() {
    let dir = std::env::var("REPRO_SNAPSHOT_DIR").unwrap_or_default();
    snapshot_variant(5, &dir);

    let a = regenerate_avatar(
        fixture_corpus(), "morning".into(),
        fixture_profile(), MAX_WORDS, 5, FIXED_SEED.into(),
    );
    let b = regenerate_avatar(
        fixture_corpus(), "morning".into(),
        fixture_profile(), MAX_WORDS, 5, FIXED_SEED.into(),
    );
    assert_eq!(
        serde_json::to_string(&a).unwrap(),
        serde_json::to_string(&b).unwrap(),
        "Variant 5 must be deterministic for same seed within same binary"
    );
}
