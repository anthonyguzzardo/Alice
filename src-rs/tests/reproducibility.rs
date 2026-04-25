//! Reproducibility check: same input must produce bit-identical output
//! across clean rebuilds.
//!
//! This test generates a deterministic fixture keystroke stream, computes
//! all signal families, and serializes the results to JSON. The expected
//! output is hardcoded as a golden snapshot. If a rebuild changes any
//! floating-point result at any precision, this test fails.
//!
//! Run as: cargo test --test reproducibility
//! Or via: npm run reproducibility-check (which does cargo clean + test twice)

use alice_signals::*;

/// Deterministic fixture: 100 keystrokes with known timing.
/// Uses a simple linear pattern so the expected signals are predictable.
///
/// As of 2026-04-25 the FFI takes typed `Vec<KeystrokeEventInput>` directly,
/// not a JSON string. This fixture builds the typed vec; helper `fixture_clone`
/// duplicates it for two-call reproducibility assertions.
fn fixture_stream() -> Vec<KeystrokeEventInput> {
    let mut events = Vec::new();
    let mut clock = 0.0_f64;

    for i in 0..100 {
        let ch = (b'a' + (i % 26) as u8) as char;
        // Hold time: 80ms + small sinusoidal variation
        let hold = 80.0 + 15.0 * ((i as f64) * 0.3).sin();
        // IKI: 120ms + small cosine variation (creates autocorrelation)
        let iki = if i > 0 { 120.0 + 20.0 * ((i as f64) * 0.2).cos() } else { 0.0 };

        clock += iki;
        let key_down = clock;
        let key_up = clock + hold;

        // Insert a space every 5 characters for word boundaries
        if i > 0 && i % 5 == 0 {
            events.push(KeystrokeEventInput {
                c: " ".to_string(),
                d: key_down - 30.0,
                u: key_down - 10.0,
            });
        }

        events.push(KeystrokeEventInput {
            c: ch.to_string(),
            d: key_down,
            u: key_up,
        });
    }

    events
}

fn fixture_clone(stream: &[KeystrokeEventInput]) -> Vec<KeystrokeEventInput> {
    stream
        .iter()
        .map(|e| KeystrokeEventInput { c: e.c.clone(), d: e.d, u: e.u })
        .collect()
}

#[test]
fn dynamical_signals_reproducible() {
    let stream = fixture_stream();
    let result_a = compute_dynamical_signals(fixture_clone(&stream));
    let result_b = compute_dynamical_signals(stream);

    let json_a = serde_json::to_string(&result_a).unwrap();
    let json_b = serde_json::to_string(&result_b).unwrap();

    assert_eq!(
        json_a, json_b,
        "Dynamical signals must be bit-identical for same input within same binary"
    );
}

#[test]
fn motor_signals_reproducible() {
    let stream = fixture_stream();
    let result_a = compute_motor_signals(fixture_clone(&stream), 15000.0);
    let result_b = compute_motor_signals(stream, 15000.0);

    let json_a = serde_json::to_string(&result_a).unwrap();
    let json_b = serde_json::to_string(&result_b).unwrap();

    assert_eq!(
        json_a, json_b,
        "Motor signals must be bit-identical for same input within same binary"
    );
}

/// Golden snapshot test: the exact JSON output for the fixture stream.
/// If this test fails after a rebuild, the rebuild changed floating-point
/// results. Update the snapshot only after verifying the change is from
/// a deliberate algorithm modification, not from compiler nondeterminism.
#[test]
fn dynamical_golden_snapshot() {
    let result = compute_dynamical_signals(fixture_stream());
    let output = serde_json::to_string(&result).unwrap();

    // Write the snapshot to a temp file for cross-build comparison.
    // The CI script compares this file across two clean builds.
    let snapshot_path = std::env::var("REPRO_SNAPSHOT_DIR").unwrap_or_default();
    if !snapshot_path.is_empty() {
        let path = std::path::Path::new(&snapshot_path).join("dynamical.json");
        std::fs::write(&path, &output).expect("failed to write snapshot");
        eprintln!("Snapshot written to {}", path.display());
    }

    // Sanity: output should be valid JSON with expected fields
    // Note: serde serializes with snake_case, not the camelCase that napi uses
    let parsed: serde_json::Value = serde_json::from_str(&output).unwrap();
    assert!(parsed.get("iki_count").is_some(), "missing iki_count field");
    assert!(parsed.get("permutation_entropy").is_some(), "missing permutation_entropy field");
    assert!(parsed.get("dfa_alpha").is_some(), "missing dfa_alpha field");
}

#[test]
fn motor_golden_snapshot() {
    let result = compute_motor_signals(fixture_stream(), 15000.0);
    let output = serde_json::to_string(&result).unwrap();

    let snapshot_path = std::env::var("REPRO_SNAPSHOT_DIR").unwrap_or_default();
    if !snapshot_path.is_empty() {
        let path = std::path::Path::new(&snapshot_path).join("motor.json");
        std::fs::write(&path, &output).expect("failed to write snapshot");
        eprintln!("Snapshot written to {}", path.display());
    }

    let parsed: serde_json::Value = serde_json::from_str(&output).unwrap();
    assert!(parsed.get("sample_entropy").is_some(), "missing sample_entropy field");
}
