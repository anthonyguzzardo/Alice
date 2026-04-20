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
use crate::types::utf16_to_byte_offset;

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

        let inserted_chars = events[i].3.len();
        if !(3..=50).contains(&inserted_chars) {
            continue;
        }

        let mut deleted_total = 0usize;
        let mut followed_by_new_text = false;
        let look_ahead = events.len().min(i + 8);
        let threshold = (inserted_chars as f64 * 0.7) as usize;

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

fn burst_classification(events: &[EventTuple], burst_threshold_ms: f64) -> Option<BurstResult> {
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

        let first = &events[burst[0]];
        if !first.3.is_empty() && first.1 < first.1 + first.3.len().saturating_sub(2) {
            i_bursts += 1;
        }
    }

    Some(BurstResult { r_bursts, i_bursts })
}

// ─── Vocabulary Expansion Rate (Heaps' Law) ──────────────────────

fn vocab_expansion_rate(text_states: &[String]) -> Option<f64> {
    if text_states.len() < 10 {
        return None;
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
        return None;
    }

    let log_points: Vec<(f64, f64)> = points
        .iter()
        .filter(|(t, u)| *t > 0.0 && *u > 0.0)
        .map(|(t, u)| (t.ln(), u.ln()))
        .collect();

    if log_points.len() < 3 {
        return None;
    }

    let x: Vec<f64> = log_points.iter().map(|(lx, _)| *lx).collect();
    let y: Vec<f64> = log_points.iter().map(|(_, ly)| *ly).collect();

    crate::stats::linreg_slope(&x, &y)
}

// ─── Phase Transition Point ──────────────────────────────────────

fn phase_transition_point(events: &[EventTuple]) -> Option<f64> {
    if events.len() < 20 {
        return None;
    }

    let total_duration = events.last()?.0 - events[0].0;
    if total_duration <= 0.0 {
        return None;
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

    transition_idx.map(|idx| (events[idx].0 - events[0].0) / total_duration)
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
    let bursts = burst_classification(&events, 2000.0);
    let heaps = vocab_expansion_rate(&text_states);
    let phase = phase_transition_point(&events);
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
}
