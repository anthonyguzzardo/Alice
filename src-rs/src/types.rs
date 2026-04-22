//! Domain types and error definitions for the signal engine.
//!
//! Newtypes prevent confusion between hold times, flight times, and IKIs
//! at the type level. SignalError preserves *why* a computation failed,
//! not just that it failed.

use std::ops::Deref;

use serde::Deserialize;

use crate::stats;

// ─── Error types ──────────────────────────────────────────────────

/// Distinguishes why a signal computation failed.
///
/// At the napi boundary these become `None` fields. Internally,
/// preserving the variant enables tests to assert on failure mode
/// and diagnostics to explain which signals are missing and why.
#[derive(Debug)]
pub(crate) enum SignalError {
    /// Not enough data points to compute the signal.
    InsufficientData { needed: usize, got: usize },
    /// Series has zero variance (constant values).
    ZeroVariance { len: usize },
    /// A computed threshold, denominator, or intermediate value is degenerate.
    DegenerateValue(&'static str),
    /// Input JSON failed to parse at the napi boundary.
    ParseError(String),
}

impl std::fmt::Display for SignalError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InsufficientData { needed, got } => {
                write!(f, "insufficient data: need {needed}, got {got}")
            }
            Self::ZeroVariance { len } => {
                write!(f, "zero variance in series of {len} points")
            }
            Self::DegenerateValue(ctx) => {
                write!(f, "degenerate value in {ctx}")
            }
            Self::ParseError(detail) => {
                write!(f, "parse error: {detail}")
            }
        }
    }
}

impl std::error::Error for SignalError {}

pub(crate) type SignalResult<T> = Result<T, SignalError>;

// ─── Input types ──────────────────────────────────────────────────

#[derive(Deserialize)]
pub(crate) struct KeystrokeEvent {
    #[serde(rename = "c")]
    pub(crate) character: String,
    #[serde(rename = "d")]
    pub(crate) key_down_ms: f64,
    #[serde(rename = "u")]
    pub(crate) key_up_ms: f64,
}

// ─── Domain newtypes ──────────────────────────────────────────────

/// Inter-key intervals in milliseconds, filtered to (0, 5000).
pub(crate) struct IkiSeries(Vec<f64>);

impl IkiSeries {
    pub(crate) fn from_stream(stream: &[KeystrokeEvent]) -> Self {
        let downs: Vec<f64> = stream.iter().map(|e| e.key_down_ms).collect();
        Self(stats::extract_iki(&downs))
    }

    #[cfg(test)]
    pub(crate) fn from_raw(data: Vec<f64>) -> Self {
        Self(data)
    }
}

impl Deref for IkiSeries {
    type Target = [f64];
    fn deref(&self) -> &[f64] {
        &self.0
    }
}


/// Inter-key flight times (next_down - prev_up) in milliseconds.
pub(crate) struct FlightTimes(Vec<f64>);

impl FlightTimes {
    pub(crate) fn from_stream(stream: &[KeystrokeEvent]) -> Self {
        let mut flights = Vec::with_capacity(stream.len());
        for i in 1..stream.len() {
            let ft = stream[i].key_down_ms - stream[i - 1].key_up_ms;
            if ft > 0.0 && ft < 5000.0 {
                flights.push(ft);
            }
        }
        Self(flights)
    }
}

impl Deref for FlightTimes {
    type Target = [f64];
    fn deref(&self) -> &[f64] {
        &self.0
    }
}

/// Paired hold and flight time series extracted from a keystroke stream.
pub(crate) struct HoldFlight {
    holds: Vec<f64>,
    flights: FlightTimes,
}

impl HoldFlight {
    pub(crate) fn holds(&self) -> &[f64] {
        &self.holds
    }

    pub(crate) fn flights(&self) -> &[f64] {
        &self.flights
    }

    /// Extract paired hold and flight times from a keystroke stream.
    ///
    /// Hold and flight are filtered *together* for each event: both must be
    /// valid for the pair to be included. This guarantees `holds[k]` and
    /// `flights[k]` always refer to the same keystroke event, which is
    /// required for transfer entropy and RQA on hold-flight pairs.
    ///
    /// Prior to 2026-04-21, holds and flights were filtered independently,
    /// causing misalignment when a keystroke had a valid hold but invalid
    /// flight (e.g., rollover typing where key_down[i] < key_up[i-1]).
    /// This affected 100% of sessions. See GOTCHAS.md.
    pub(crate) fn from_stream(stream: &[KeystrokeEvent]) -> Self {
        let mut holds = Vec::with_capacity(stream.len());
        let mut flights = Vec::with_capacity(stream.len());

        for i in 1..stream.len() {
            let ht = stream[i].key_up_ms - stream[i].key_down_ms;
            let ft = stream[i].key_down_ms - stream[i - 1].key_up_ms;
            if ht > 0.0 && ht < 2000.0 && ft > 0.0 && ft < 5000.0 {
                holds.push(ht);
                flights.push(ft);
            }
        }

        Self {
            holds,
            flights: FlightTimes(flights),
        }
    }

    /// Length of the paired series. Holds and flights are always the same
    /// length because `from_stream` filters them together.
    pub(crate) fn aligned_len(&self) -> usize {
        debug_assert_eq!(
            self.holds.len(),
            self.flights.len(),
            "HoldFlight invariant violated: holds and flights must be same length"
        );
        self.holds.len()
    }
}

// ─── UTF-16 / UTF-8 conversion ───────────────────────────────────

/// Convert a JavaScript UTF-16 code unit offset to a Rust byte offset.
///
/// JS `selectionStart` counts UTF-16 code units. Rust strings are UTF-8.
/// A curly quote (U+2019) is 1 UTF-16 unit but 3 UTF-8 bytes.
/// An emoji like U+1F600 is 2 UTF-16 units but 4 UTF-8 bytes.
///
/// Returns `text.len()` if the offset is past the end.
pub(crate) fn utf16_to_byte_offset(text: &str, utf16_offset: usize) -> usize {
    let mut utf16_count = 0;
    for (byte_idx, ch) in text.char_indices() {
        if utf16_count >= utf16_offset {
            return byte_idx;
        }
        utf16_count += ch.len_utf16();
    }
    text.len()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn utf16_ascii() {
        assert_eq!(utf16_to_byte_offset("hello", 3), 3);
    }

    #[test]
    fn utf16_curly_quote() {
        let text = "it\u{2019}s"; // right single quotation mark
        // UTF-16: i(1) t(1) \u2019(1) s(1) => offset 3 points to 's'
        // UTF-8:  i(1) t(1) \u2019(3) s(1) => byte 5 is 's'
        assert_eq!(utf16_to_byte_offset(text, 3), 5);
    }

    #[test]
    fn utf16_emoji() {
        let text = "a\u{1F600}b"; // grinning face
        // UTF-16: a(1) \u1F600(2) b(1)
        // UTF-8:  a(1) \u1F600(4) b(1)
        assert_eq!(utf16_to_byte_offset(text, 1), 1); // start of emoji
        assert_eq!(utf16_to_byte_offset(text, 3), 5); // after emoji
    }

    #[test]
    fn utf16_past_end() {
        assert_eq!(utf16_to_byte_offset("hi", 99), 2);
    }

    #[test]
    fn utf16_empty() {
        assert_eq!(utf16_to_byte_offset("", 0), 0);
        assert_eq!(utf16_to_byte_offset("", 5), 0);
    }

    // ── HoldFlight alignment tests ──

    fn make_event(c: &str, d: f64, u: f64) -> KeystrokeEvent {
        KeystrokeEvent {
            character: c.to_string(),
            key_down_ms: d,
            key_up_ms: u,
        }
    }

    #[test]
    fn holdflight_vectors_always_same_length() {
        // Rollover typing: key_down[i] < key_up[i-1] produces negative flight.
        // Old code pushed hold but dropped flight, causing misalignment.
        // New code must always produce equal-length vectors.
        let stream = vec![
            make_event("a", 0.0, 80.0),
            make_event("b", 50.0, 130.0),   // overlap: flight = 50 - 80 = -30 (invalid)
            make_event("c", 200.0, 280.0),   // normal: flight = 200 - 130 = 70 (valid)
            make_event("d", 250.0, 330.0),   // overlap: flight = 250 - 280 = -30 (invalid)
            make_event("e", 400.0, 480.0),   // normal: flight = 400 - 330 = 70 (valid)
        ];
        let hf = HoldFlight::from_stream(&stream);
        assert_eq!(
            hf.holds().len(),
            hf.flights().len(),
            "holds and flights must be same length; got holds={}, flights={}",
            hf.holds().len(),
            hf.flights().len()
        );
    }

    #[test]
    fn holdflight_pairs_refer_to_same_event() {
        // Construct stream where we can verify pairing by value.
        // Event 1: hold=80, flight=-30 (invalid) -> excluded
        // Event 2: hold=80, flight=70 -> included as pair (80, 70)
        // Event 3: hold=80, flight=-30 (invalid) -> excluded
        // Event 4: hold=80, flight=70 -> included as pair (80, 70)
        let stream = vec![
            make_event("a", 0.0, 80.0),
            make_event("b", 50.0, 130.0),
            make_event("c", 200.0, 280.0),
            make_event("d", 250.0, 330.0),
            make_event("e", 400.0, 480.0),
        ];
        let hf = HoldFlight::from_stream(&stream);
        assert_eq!(hf.holds().len(), 2, "only 2 events have both valid hold and flight");
        assert_eq!(hf.flights().len(), 2);
        // Event 2 (c): hold = 280 - 200 = 80, flight = 200 - 130 = 70
        assert!((hf.holds()[0] - 80.0).abs() < 1e-10);
        assert!((hf.flights()[0] - 70.0).abs() < 1e-10);
        // Event 4 (e): hold = 480 - 400 = 80, flight = 400 - 330 = 70
        assert!((hf.holds()[1] - 80.0).abs() < 1e-10);
        assert!((hf.flights()[1] - 70.0).abs() < 1e-10);
    }

    #[test]
    fn holdflight_excludes_invalid_hold_with_valid_flight() {
        // Event where hold is invalid (>2000ms) but flight is valid.
        // Must NOT be included (old code would push flight but drop hold).
        let stream = vec![
            make_event("a", 0.0, 80.0),
            make_event("b", 200.0, 2500.0), // hold = 2300 (invalid), flight = 120 (valid)
            make_event("c", 2600.0, 2680.0), // hold = 80 (valid), flight = 100 (valid)
        ];
        let hf = HoldFlight::from_stream(&stream);
        assert_eq!(hf.holds().len(), 1, "event with invalid hold must be excluded");
        assert_eq!(hf.flights().len(), 1);
        // Only event 2 (c) should be present
        assert!((hf.holds()[0] - 80.0).abs() < 1e-10);
        assert!((hf.flights()[0] - 100.0).abs() < 1e-10);
    }

    #[test]
    fn holdflight_aligned_len_equals_vector_length() {
        let stream = vec![
            make_event("a", 0.0, 80.0),
            make_event("b", 150.0, 230.0),
            make_event("c", 300.0, 380.0),
        ];
        let hf = HoldFlight::from_stream(&stream);
        assert_eq!(hf.aligned_len(), hf.holds().len());
        assert_eq!(hf.aligned_len(), hf.flights().len());
    }
}
