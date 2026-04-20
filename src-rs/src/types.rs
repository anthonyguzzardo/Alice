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
pub enum SignalError {
    /// Not enough data points to compute the signal.
    InsufficientData { needed: usize, got: usize },
    /// Series has zero variance (constant values).
    ZeroVariance { len: usize },
    /// A computed threshold, denominator, or intermediate value is degenerate.
    DegenerateValue(&'static str),
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
        }
    }
}

impl std::error::Error for SignalError {}

pub type SignalResult<T> = Result<T, SignalError>;

// ─── Input types ──────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct KeystrokeEvent {
    #[serde(rename = "c")]
    pub character: String,
    #[serde(rename = "d")]
    pub key_down_ms: f64,
    #[serde(rename = "u")]
    pub key_up_ms: f64,
}

// ─── Domain newtypes ──────────────────────────────────────────────

/// Inter-key intervals in milliseconds, filtered to (0, 5000).
pub struct IkiSeries(Vec<f64>);

impl IkiSeries {
    pub fn from_stream(stream: &[KeystrokeEvent]) -> Self {
        let downs: Vec<f64> = stream.iter().map(|e| e.key_down_ms).collect();
        Self(stats::extract_iki(&downs))
    }

    #[cfg(test)]
    pub fn from_raw(data: Vec<f64>) -> Self {
        Self(data)
    }
}

impl Deref for IkiSeries {
    type Target = [f64];
    fn deref(&self) -> &[f64] {
        &self.0
    }
}

/// Key hold durations (key_up - key_down) in milliseconds.
pub struct HoldTimes(Vec<f64>);

impl Deref for HoldTimes {
    type Target = [f64];
    fn deref(&self) -> &[f64] {
        &self.0
    }
}

/// Inter-key flight times (next_down - prev_up) in milliseconds.
pub struct FlightTimes(Vec<f64>);

impl FlightTimes {
    pub fn from_stream(stream: &[KeystrokeEvent]) -> Self {
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
pub struct HoldFlight {
    pub holds: HoldTimes,
    pub flights: FlightTimes,
}

impl HoldFlight {
    pub fn from_stream(stream: &[KeystrokeEvent]) -> Self {
        let mut holds = Vec::with_capacity(stream.len());
        let mut flights = Vec::with_capacity(stream.len());

        for (i, evt) in stream.iter().enumerate() {
            let ht = evt.key_up_ms - evt.key_down_ms;
            if ht > 0.0 && ht < 2000.0 {
                holds.push(ht);
            }
            if i > 0 {
                let ft = evt.key_down_ms - stream[i - 1].key_up_ms;
                if ft > 0.0 && ft < 5000.0 {
                    flights.push(ft);
                }
            }
        }

        Self {
            holds: HoldTimes(holds),
            flights: FlightTimes(flights),
        }
    }

    /// Length of the shorter series (for aligned operations like transfer entropy).
    pub fn aligned_len(&self) -> usize {
        self.holds.len().min(self.flights.len())
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
pub fn utf16_to_byte_offset(text: &str, utf16_offset: usize) -> usize {
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
}
