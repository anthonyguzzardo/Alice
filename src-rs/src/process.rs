//! Writing Process Signal Computation
//!
//! Signals from event log replay: pause location, abandoned thoughts,
//! burst classification, vocabulary expansion, phase transition, strategy shifts.
//!
//! Event log format: `[offsetMs, cursorPos, deletedCount, insertedText]`
//!
//! **cursorPos and deletedCount are JavaScript UTF-16 code unit offsets.**
//! All text operations convert through `utf16_to_byte_offset` before
//! indexing into Rust's UTF-8 strings. Without this, any non-ASCII
//! character (curly quotes, accented letters, emoji) causes a panic
//! at a char boundary.

use std::collections::HashSet;

use crate::stats::mean;
use crate::types::{utf16_to_byte_offset, SignalError, SignalResult};

// ─── Types ────────────────────────────────────────────────────────

#[derive(serde::Deserialize)]
struct EventTuple(f64, usize, usize, String);

pub struct ProcessResult {
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

// ─── Text Reconstruction (UTF-8 safe) ────────────────────────────

fn reconstruct_text(events: &[EventTuple]) -> Vec<String> {
    let mut states = Vec::with_capacity(events.len());
    let mut text = String::new();

    for evt in events {
        // Convert JS UTF-16 cursor position to Rust byte offset
        let cursor_byte = utf16_to_byte_offset(&text, evt.1);

        if evt.2 > 0 {
            // deletedCount is also in UTF-16 code units
            let end_byte = utf16_to_byte_offset(&text, evt.1 + evt.2);
            text = format!("{}{}", &text[..cursor_byte], &text[end_byte..]);
        }
        if !evt.3.is_empty() {
            // Re-clamp after potential deletion shortened the string
            let pos = cursor_byte.min(text.len());
            text.insert_str(pos, &evt.3);
        }
        states.push(text.clone());
    }

    states
}

// ─── Pause Location Profile (Deane 2015, Baaijen & Galbraith 2018)

struct PauseProfile {
    within_word: i32,
    between_word: i32,
    between_sentence: i32,
}

fn pause_location_profile(
    events: &[EventTuple],
    text_states: &[String],
    pause_threshold_ms: f64,
) -> Option<PauseProfile> {
    if events.len() < 10 {
        return None;
    }

    let mut within_word = 0i32;
    let mut between_word = 0i32;
    let mut between_sentence = 0i32;

    for i in 1..events.len() {
        let gap = events[i].0 - events[i - 1].0;
        if gap < pause_threshold_ms {
            continue;
        }

        // Only count pauses before insertions
        if events[i].3.is_empty() {
            continue;
        }

        let text = &text_states[i - 1];
        let cursor_pos = events[i].1; // UTF-16 offset

        if cursor_pos == 0 || text.is_empty() {
            between_sentence += 1;
            continue;
        }

        // Convert to byte offset and get the character before cursor
        let byte_offset = utf16_to_byte_offset(text, cursor_pos);
        match text[..byte_offset.min(text.len())].chars().next_back() {
            Some('.' | '!' | '?') | None => between_sentence += 1,
            Some(' ' | '\t' | '\n') => between_word += 1,
            Some(_) => within_word += 1,
        }
    }

    let total = within_word + between_word + between_sentence;
    if total == 0 {
        return None;
    }

    Some(PauseProfile {
        within_word,
        between_word,
        between_sentence,
    })
}

// ─── Abandoned Thought Signature ─────────────────────────────────

fn abandoned_thought_count(events: &[EventTuple], pause_threshold_ms: f64) -> Option<i32> {
    if events.len() < 10 {
        return None;
    }

    let mut count = 0i32;

    for i in 1..(events.len().saturating_sub(2)) {
        let gap = events[i].0 - events[i - 1].0;
        if gap < pause_threshold_ms {
            continue;
        }

        // Count in UTF-16 code units to match deletedCount from JS
        let inserted_units: usize = events[i].3.chars().map(|c| c.len_utf16()).sum();
        if !(3..=50).contains(&inserted_units) {
            continue;
        }

        let mut deleted_total = 0usize;
        let mut followed_by_new_text = false;
        let look_ahead = events.len().min(i + 8);
        let threshold = (inserted_units as f64 * 0.7) as usize;

        for j in (i + 1)..look_ahead {
            let time_delta = events[j].0 - events[i].0;
            if time_delta > 10000.0 {
                break;
            }

            if events[j].2 > 0 {
                deleted_total += events[j].2;
            }
            if deleted_total >= threshold && !events[j].3.is_empty() {
                followed_by_new_text = true;
                break;
            }
        }

        if deleted_total >= threshold && followed_by_new_text {
            count += 1;
        }
    }

    Some(count)
}

// ─── R-burst / I-burst Classification (Deane 2015) ───────────────

struct BurstResult {
    r_bursts: i32,
    i_bursts: i32,
}

fn burst_classification(
    events: &[EventTuple],
    text_states: &[String],
    burst_threshold_ms: f64,
) -> Option<BurstResult> {
    if events.len() < 10 {
        return None;
    }

    let mut bursts: Vec<Vec<usize>> = Vec::new();
    let mut current_burst: Vec<usize> = vec![0];

    for i in 1..events.len() {
        if events[i].0 - events[i - 1].0 > burst_threshold_ms {
            if !current_burst.is_empty() {
                bursts.push(current_burst);
            }
            current_burst = Vec::new();
        }
        current_burst.push(i);
    }
    if !current_burst.is_empty() {
        bursts.push(current_burst);
    }

    let mut r_bursts = 0i32;
    let mut i_bursts = 0i32;

    for burst in &bursts {
        if burst.len() < 2 {
            continue;
        }

        let last = &events[*burst.last().unwrap()];
        if last.2 > 0 {
            r_bursts += 1;
            continue;
        }

        // I-burst (Deane 2015): insertion *within* existing text, not appending at end.
        // Compare cursor position (UTF-16 units) against text length (UTF-16 units)
        // at the state just before the burst starts.
        let first_idx = burst[0];
        let first = &events[first_idx];
        if !first.3.is_empty() {
            // Text state before this event: use previous state (or empty for first event)
            let empty = String::new();
            let text_before = if first_idx > 0 {
                &text_states[first_idx - 1]
            } else {
                &empty
            };
            let text_len_utf16: usize = text_before.chars().map(|c| c.len_utf16()).sum();
            // Cursor is within existing text (not at end) → I-burst
            if first.1 < text_len_utf16 {
                i_bursts += 1;
            }
        }
    }

    Some(BurstResult { r_bursts, i_bursts })
}

// ─── Vocabulary Expansion Rate (Heaps' Law) ──────────────────────

fn vocab_expansion_rate(text_states: &[String]) -> SignalResult<f64> {
    if text_states.len() < 10 {
        return Err(SignalError::InsufficientData {
            needed: 10,
            got: text_states.len(),
        });
    }

    let samples = 10;
    let step = text_states.len() / samples;
    let mut points: Vec<(f64, f64)> = Vec::new();

    for i in 0..samples {
        let idx = (i * step).min(text_states.len() - 1);
        let text = &text_states[idx];
        let words: Vec<&str> = text.split_whitespace().filter(|w| !w.is_empty()).collect();
        let unique: HashSet<String> = words.iter().map(|w| w.to_lowercase()).collect();

        if !words.is_empty() {
            points.push((words.len() as f64, unique.len() as f64));
        }
    }

    if points.len() < 3 {
        return Err(SignalError::InsufficientData {
            needed: 3,
            got: points.len(),
        });
    }

    let log_points: Vec<(f64, f64)> = points
        .iter()
        .filter(|(t, u)| *t > 0.0 && *u > 0.0)
        .map(|(t, u)| (t.ln(), u.ln()))
        .collect();

    if log_points.len() < 3 {
        return Err(SignalError::InsufficientData {
            needed: 3,
            got: log_points.len(),
        });
    }

    let x: Vec<f64> = log_points.iter().map(|(lx, _)| *lx).collect();
    let y: Vec<f64> = log_points.iter().map(|(_, ly)| *ly).collect();

    crate::stats::linreg_slope(&x, &y)
        .ok_or(SignalError::DegenerateValue("degenerate regression in vocab expansion"))
}

// ─── Phase Transition Point ──────────────────────────────────────

fn phase_transition_point(events: &[EventTuple]) -> SignalResult<Option<f64>> {
    if events.len() < 20 {
        return Err(SignalError::InsufficientData {
            needed: 20,
            got: events.len(),
        });
    }

    let total_duration = events.last().unwrap().0 - events[0].0;
    if total_duration <= 0.0 {
        return Err(SignalError::DegenerateValue("zero duration in phase transition"));
    }

    let window_size = (events.len() / 10).max(5);
    let mut transition_idx: Option<usize> = None;

    for i in window_size..(events.len().saturating_sub(window_size)) {
        let mut insertions = 0usize;
        let mut deletions = 0usize;

        for evt in events.iter().take((i + window_size).min(events.len())).skip(i) {
            insertions += evt.3.len();
            deletions += evt.2;
        }

        if deletions > insertions && transition_idx.is_none() {
            transition_idx = Some(i);
        }
    }

    // No transition found is a valid result (not an error)
    Ok(transition_idx.map(|idx| (events[idx].0 - events[0].0) / total_duration))
}

// ─── Strategy Shift Detection ────────────────────────────────────

fn strategy_shift_count(events: &[EventTuple], burst_threshold_ms: f64) -> Option<i32> {
    let mut burst_lengths: Vec<f64> = Vec::new();
    let mut current_chars = 0usize;

    for i in 0..events.len() {
        current_chars += events[i].3.len();

        let is_gap =
            i < events.len() - 1 && (events[i + 1].0 - events[i].0) > burst_threshold_ms;
        let is_last = i == events.len() - 1;

        if (is_gap || is_last) && current_chars > 0 {
            burst_lengths.push(current_chars as f64);
            current_chars = 0;
        }
    }

    if burst_lengths.len() < 6 {
        return None;
    }

    let window_size = (burst_lengths.len() / 4).max(3);
    let mut shifts = 0i32;

    for i in window_size..=burst_lengths.len().saturating_sub(window_size) {
        let before = &burst_lengths[(i - window_size)..i];
        let end = (i + window_size).min(burst_lengths.len());
        let after = &burst_lengths[i..end];

        let mean_before = mean(before);
        let mean_after = mean(after);

        let mut all_vals = before.to_vec();
        all_vals.extend_from_slice(after);
        let overall_mean = mean(&all_vals);
        let overall_std = (all_vals
            .iter()
            .map(|v| (v - overall_mean).powi(2))
            .sum::<f64>()
            / all_vals.len() as f64)
            .sqrt();

        if overall_std > 0.0 && (mean_after - mean_before).abs() > overall_std {
            shifts += 1;
        }
    }

    Some(shifts)
}

// ─── Public API ──────────────────────────────────────────────────

pub fn compute(event_log_json: &str) -> ProcessResult {
    let null_result = ProcessResult {
        pause_within_word: None,
        pause_between_word: None,
        pause_between_sentence: None,
        abandoned_thought_count: None,
        r_burst_count: None,
        i_burst_count: None,
        vocab_expansion_rate: None,
        phase_transition_point: None,
        strategy_shift_count: None,
    };

    let events: Vec<EventTuple> = match serde_json::from_str(event_log_json) {
        Ok(e) => e,
        Err(_) => return null_result,
    };

    if events.len() < 10 {
        return null_result;
    }

    let text_states = reconstruct_text(&events);
    let pause_profile = pause_location_profile(&events, &text_states, 2000.0);
    let abandoned = abandoned_thought_count(&events, 2000.0);
    let bursts = burst_classification(&events, &text_states, 2000.0);
    let heaps = vocab_expansion_rate(&text_states).ok();
    let phase = phase_transition_point(&events).ok().flatten();
    let shifts = strategy_shift_count(&events, 2000.0);

    ProcessResult {
        pause_within_word: pause_profile.as_ref().map(|p| p.within_word),
        pause_between_word: pause_profile.as_ref().map(|p| p.between_word),
        pause_between_sentence: pause_profile.as_ref().map(|p| p.between_sentence),
        abandoned_thought_count: abandoned,
        r_burst_count: bursts.as_ref().map(|b| b.r_bursts),
        i_burst_count: bursts.as_ref().map(|b| b.i_bursts),
        vocab_expansion_rate: heaps,
        phase_transition_point: phase,
        strategy_shift_count: shifts,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reconstruct_ascii() {
        let events = vec![EventTuple(0.0, 0, 0, "Hello".to_string())];
        let states = reconstruct_text(&events);
        assert_eq!(states[0], "Hello");
    }

    #[test]
    fn reconstruct_with_curly_quotes_no_panic() {
        let events = vec![
            EventTuple(0.0, 0, 0, "it\u{2019}s fine".to_string()),
            // Delete curly quote: UTF-16 pos 2, count 1
            EventTuple(100.0, 2, 1, "'".to_string()),
        ];
        let states = reconstruct_text(&events);
        assert_eq!(states[0], "it\u{2019}s fine");
        assert_eq!(states[1], "it's fine");
    }

    #[test]
    fn reconstruct_with_emoji_no_panic() {
        let events = vec![
            EventTuple(0.0, 0, 0, "a\u{1F600}b".to_string()),
            // Delete emoji: UTF-16 pos 1, count 2 (surrogate pair)
            EventTuple(100.0, 1, 2, "".to_string()),
        ];
        let states = reconstruct_text(&events);
        assert_eq!(states[0], "a\u{1F600}b");
        assert_eq!(states[1], "ab");
    }

    #[test]
    fn reconstruct_insert_after_multibyte() {
        let events = vec![
            EventTuple(0.0, 0, 0, "caf\u{00E9}".to_string()),
            // Insert at end: UTF-16 pos 4 (c-a-f-e with accent = 4 code units)
            EventTuple(100.0, 4, 0, "!".to_string()),
        ];
        let states = reconstruct_text(&events);
        assert_eq!(states[1], "caf\u{00E9}!");
    }

    #[test]
    fn reconstruct_delete_at_end() {
        let events = vec![
            EventTuple(0.0, 0, 0, "abc".to_string()),
            // Delete last char
            EventTuple(100.0, 2, 1, "".to_string()),
        ];
        let states = reconstruct_text(&events);
        assert_eq!(states[1], "ab");
    }

    #[test]
    fn empty_event_log_returns_nulls() {
        let result = compute("[]");
        assert!(result.pause_within_word.is_none());
        assert!(result.vocab_expansion_rate.is_none());
    }

    #[test]
    fn invalid_json_returns_nulls() {
        let result = compute("not json");
        assert!(result.pause_within_word.is_none());
    }

    // ─── Pause Profile Tests ─────────────────────────────────────────

    #[test]
    fn pause_profile_classifies_locations() {
        // Build a stream: type "Hello world. Bye", with pauses at known locations.
        // State after initial typing: "Hello world. Bye"
        // We insert pauses (>2000ms) before specific characters.
        let mut events = Vec::new();
        let mut t = 0.0;

        // Type "Hello" rapidly (no pauses)
        for (i, ch) in "Hello".chars().enumerate() {
            events.push(EventTuple(t, i, 0, ch.to_string()));
            t += 100.0;
        }
        // Pause > 2000ms, then insert " " at pos 5 (between-word pause triggers on char after space)
        t += 3000.0;
        events.push(EventTuple(t, 5, 0, " ".to_string()));
        t += 100.0;

        // Type "world." rapidly
        for (i, ch) in "world.".chars().enumerate() {
            events.push(EventTuple(t, 6 + i, 0, ch.to_string()));
            t += 100.0;
        }

        // Pause > 2000ms, then insert after "." (between-sentence)
        t += 3000.0;
        events.push(EventTuple(t, 12, 0, " ".to_string()));
        t += 100.0;

        // Type "B" rapidly
        events.push(EventTuple(t, 13, 0, "B".to_string()));
        t += 100.0;

        // Pause > 2000ms, then insert within word (after "B")
        t += 3000.0;
        events.push(EventTuple(t, 14, 0, "ye".to_string()));

        let text_states = reconstruct_text(&events);
        let profile = pause_location_profile(&events, &text_states, 2000.0).unwrap();

        // First pause: cursor at pos 5, text is "Hello", char before cursor is 'o' → within-word
        // Second pause: cursor at pos 12, text is "Hello world.", char before is '.' → between-sentence
        // Third pause: cursor at pos 14, text is "Hello world. B", char before is 'B' → within-word
        assert!(profile.within_word >= 1, "expected within_word >= 1, got {}", profile.within_word);
        assert!(profile.between_sentence >= 1, "expected between_sentence >= 1, got {}", profile.between_sentence);
    }

    // ─── Burst Classification Tests ──────────────────────────────────

    #[test]
    fn r_burst_detected_when_burst_ends_with_deletion() {
        // A burst that ends with a deletion → R-burst
        let mut events = Vec::new();
        let mut t = 0.0;

        // Initial text typed with pauses to make >10 events
        for i in 0..8 {
            events.push(EventTuple(t, i, 0, "a".to_string()));
            t += 100.0;
        }
        // Long pause to start new burst
        t += 3000.0;
        // Burst: type then delete
        events.push(EventTuple(t, 8, 0, "x".to_string()));
        t += 100.0;
        events.push(EventTuple(t, 9, 0, "y".to_string()));
        t += 100.0;
        events.push(EventTuple(t, 9, 2, "".to_string())); // delete 2 chars → ends with deletion

        let text_states = reconstruct_text(&events);
        let result = burst_classification(&events, &text_states, 2000.0).unwrap();
        assert!(result.r_bursts >= 1, "expected r_burst >= 1, got {}", result.r_bursts);
    }

    #[test]
    fn i_burst_detected_when_inserting_mid_text() {
        // A burst where the first event inserts within existing text → I-burst
        let mut events = Vec::new();
        let mut t = 0.0;

        // Type "Hello world" first
        events.push(EventTuple(t, 0, 0, "Hello world".to_string()));
        t += 100.0;

        // More events to reach minimum of 10
        for _ in 0..9 {
            events.push(EventTuple(t, 11, 0, ".".to_string()));
            t += 100.0;
        }

        // Long pause, then insert at position 5 (within "Hello world...........")
        // Text is now "Hello world........." (20 chars), cursor at 5 = mid-text
        t += 3000.0;
        events.push(EventTuple(t, 5, 0, " beautiful".to_string()));
        t += 100.0;
        events.push(EventTuple(t, 15, 0, ",".to_string()));

        let text_states = reconstruct_text(&events);
        let result = burst_classification(&events, &text_states, 2000.0).unwrap();
        assert!(result.i_bursts >= 1, "expected i_burst >= 1, got {}", result.i_bursts);
    }

    #[test]
    fn append_at_end_is_not_i_burst() {
        // A burst where insertion is at end of text → NOT an I-burst
        let mut events = Vec::new();
        let mut t = 0.0;

        // Type initial text
        events.push(EventTuple(t, 0, 0, "Hello".to_string()));
        t += 100.0;

        // Padding events
        for i in 0..9 {
            events.push(EventTuple(t, 5 + i, 0, ".".to_string()));
            t += 100.0;
        }

        // Long pause, then append at end (pos 14 = text length in UTF-16)
        t += 3000.0;
        events.push(EventTuple(t, 14, 0, " world".to_string()));
        t += 100.0;
        events.push(EventTuple(t, 20, 0, "!".to_string()));

        let text_states = reconstruct_text(&events);
        let result = burst_classification(&events, &text_states, 2000.0).unwrap();
        assert_eq!(result.i_bursts, 0, "append at end should not be I-burst");
    }

    // ─── Abandoned Thought Tests ─────────────────────────────────────

    #[test]
    fn abandoned_thought_detected() {
        // Pattern: pause → insert 10 chars → quickly delete most → insert new text
        let mut events = Vec::new();
        let mut t = 0.0;

        // Initial padding events
        for i in 0..8 {
            events.push(EventTuple(t, i, 0, "x".to_string()));
            t += 100.0;
        }

        // Long pause
        t += 3000.0;
        // Insert "abcdefghij" (10 chars, within 3..=50 range)
        events.push(EventTuple(t, 8, 0, "abcdefghij".to_string()));
        t += 500.0;
        // Delete 8 chars (>= 70% of 10 = 7)
        events.push(EventTuple(t, 10, 8, "".to_string()));
        t += 200.0;
        // Insert new text (followed_by_new_text = true)
        events.push(EventTuple(t, 10, 0, "newstuff".to_string()));

        let count = abandoned_thought_count(&events, 2000.0);
        assert_eq!(count, Some(1), "expected 1 abandoned thought, got {:?}", count);
    }

    // ─── Vocab Expansion Rate Tests ──────────────────────────────────

    #[test]
    fn vocab_expansion_with_growing_text() {
        // Build text states that grow with new words
        let words = ["the", "quick", "brown", "fox", "jumps", "over", "lazy", "dog",
                     "and", "then", "runs", "away", "fast", "into", "woods"];
        let mut states = Vec::new();
        let mut text = String::new();
        for w in &words {
            if !text.is_empty() {
                text.push(' ');
            }
            text.push_str(w);
            states.push(text.clone());
        }

        let rate = vocab_expansion_rate(&states);
        // Heaps' exponent for pure unique-word growth should be near 1.0
        assert!(rate.is_ok(), "expected Ok rate");
        let r = rate.unwrap();
        assert!(r > 0.0, "vocab expansion rate should be positive, got {r}");
        assert!(r <= 1.5, "vocab expansion rate should be <= 1.5 for unique words, got {r}");
    }

    // ─── Strategy Shift Tests ────────────────────────────────────────

    #[test]
    fn strategy_shift_detects_change_in_burst_length() {
        // First half: short bursts (1-2 chars each). Second half: long bursts (10+ chars).
        let mut events = Vec::new();
        let mut t = 0.0;

        // 20 short bursts: 2 chars then pause
        for _ in 0..20 {
            events.push(EventTuple(t, 0, 0, "ab".to_string()));
            t += 100.0;
            t += 3000.0; // pause
        }
        // 20 long bursts: 15 chars then pause
        for _ in 0..20 {
            events.push(EventTuple(t, 0, 0, "abcdefghijklmno".to_string()));
            t += 100.0;
            t += 3000.0; // pause
        }

        let count = strategy_shift_count(&events, 2000.0);
        assert!(count.is_some(), "expected Some shift count");
        assert!(count.unwrap() >= 1, "expected at least 1 strategy shift, got {:?}", count);
    }
}
