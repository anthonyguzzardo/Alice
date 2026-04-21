//! Avatar Text Generation & Timing Synthesis
//!
//! Builds a word-level Markov chain from a personal corpus and generates
//! topic-seeded text following the person's own transition probabilities.
//! Pairs each character with a timing delay derived from a motor profile
//! (digraph latencies, ex-Gaussian IKI distribution, pause architecture).
//!
//! Pure math. No LLM. The words come from probability matrices trained
//! on the person's writing. The timing comes from their behavioral profile.

use std::collections::HashMap;

use serde::Deserialize;

// ─── Types ──────────────────────────────────────────────────────

#[derive(Deserialize)]
pub(crate) struct TimingProfile {
    /// Mean digraph latency per bigram (character pair)
    pub(crate) digraph: Option<HashMap<String, f64>>,
    /// Ex-Gaussian mu (Gaussian mean of IKI distribution)
    pub(crate) mu: Option<f64>,
    /// Ex-Gaussian sigma (Gaussian std of IKI distribution)
    pub(crate) sigma: Option<f64>,
    /// Ex-Gaussian tau (exponential tail, attentional lapses)
    pub(crate) tau: Option<f64>,
    /// Mean P-burst length in chars
    pub(crate) burst_length: Option<f64>,
    /// Proportion of pauses at word boundaries
    pub(crate) pause_between_pct: Option<f64>,
    /// Proportion of pauses at sentence boundaries
    pub(crate) pause_sent_pct: Option<f64>,
    /// First keystroke latency in ms
    pub(crate) first_keystroke: Option<f64>,
    // ── Revision profile ──
    /// Small deletions per 100 chars typed
    pub(crate) small_del_rate: Option<f64>,
    /// Large deletions per 100 chars typed
    pub(crate) large_del_rate: Option<f64>,
    /// Proportion of deletions in second half vs total (0.5 = even, >0.5 = back-loaded)
    pub(crate) revision_timing_bias: Option<f64>,
    /// R-burst ratio: r_bursts / (r_bursts + i_bursts).
    /// Available for future I-burst synthesis (mid-text insertions).
    #[allow(dead_code)]
    pub(crate) r_burst_ratio: Option<f64>,
}

pub(crate) struct AvatarResult {
    /// Generated text
    pub(crate) text: String,
    /// Per-character delay in ms (length = text.len() in chars)
    pub(crate) delays: Vec<f64>,
    /// Synthetic keystroke events: (key_down_ms, key_up_ms, character)
    /// These can be fed directly into the signal pipeline for validation.
    pub(crate) keystroke_events: Vec<SyntheticKeystroke>,
    /// Number of words in generated text
    pub(crate) word_count: usize,
    /// Markov order used
    pub(crate) order: usize,
    /// Number of unique states in the chain
    pub(crate) chain_size: usize,
}

pub(crate) struct SyntheticKeystroke {
    pub(crate) character: char,
    pub(crate) key_down_ms: f64,
    pub(crate) key_up_ms: f64,
}

/// Result of computing perplexity of a text against the Markov model.
pub(crate) struct PerplexityResult {
    /// Per-word log2 perplexity (lower = model predicts the text better)
    pub(crate) perplexity: f64,
    /// Number of words evaluated
    pub(crate) word_count: usize,
    /// Number of words that had a valid transition in the chain
    pub(crate) known_transitions: usize,
    /// Number of words that fell back to uniform (unknown transition)
    pub(crate) unknown_transitions: usize,
}

// ─── PRNG (xoshiro128+ for speed, no external dep) ─────────────

struct Rng {
    s: [u32; 4],
}

impl Rng {
    fn from_seed(seed: u64) -> Self {
        // SplitMix64 to initialize state
        let mut z = seed;
        let mut s = [0u32; 4];
        for slot in &mut s {
            z = z.wrapping_add(0x9e37_79b9_7f4a_7c15);
            let mut r = z;
            r = (r ^ (r >> 30)).wrapping_mul(0xbf58_476d_1ce4_e5b9);
            r = (r ^ (r >> 27)).wrapping_mul(0x94d0_49bb_1331_11eb);
            r ^= r >> 31;
            *slot = r as u32;
        }
        Self { s }
    }

    fn next_u32(&mut self) -> u32 {
        let result = self.s[0].wrapping_add(self.s[3]);
        let t = self.s[1] << 9;
        self.s[2] ^= self.s[0];
        self.s[3] ^= self.s[1];
        self.s[1] ^= self.s[2];
        self.s[0] ^= self.s[3];
        self.s[2] ^= t;
        self.s[3] = self.s[3].rotate_left(11);
        result
    }

    /// Uniform [0, 1)
    fn f64(&mut self) -> f64 {
        (self.next_u32() >> 1) as f64 / (u32::MAX >> 1) as f64
    }

    /// Gaussian via Box-Muller
    fn gaussian(&mut self, mu: f64, sigma: f64) -> f64 {
        let u1 = self.f64().max(1e-10);
        let u2 = self.f64();
        let z = (-2.0 * u1.ln()).sqrt() * (2.0 * std::f64::consts::PI * u2).cos();
        mu + sigma * z
    }

    /// Ex-Gaussian sample: N(mu, sigma) + Exp(tau)
    fn ex_gaussian(&mut self, mu: f64, sigma: f64, tau: f64) -> f64 {
        let gauss = self.gaussian(mu, sigma);
        let exp = -tau * self.f64().max(1e-10).ln();
        (gauss + exp).max(30.0) // floor at 30ms
    }
}

// ─── Markov chain ───────────────────────────────────────────────

#[allow(dead_code)] // total_starters available for diagnostics but not currently read
struct MarkovChain {
    /// state -> [(next_word, count)]
    transitions: HashMap<String, Vec<(String, u32)>>,
    /// sentence starters with counts
    starters: Vec<(String, u32)>,
    total_starters: u32,
    order: usize,
    /// Order-1 chain for backoff when order-2 hits a dead end
    backoff: Option<HashMap<String, Vec<(String, u32)>>>,
    /// Total word count across all training texts (for perplexity vocab size)
    vocab_size: usize,
}

fn tokenize(text: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current = String::new();

    for ch in text.chars() {
        if ".!?,;:".contains(ch) {
            if !current.is_empty() {
                tokens.push(std::mem::take(&mut current));
            }
            tokens.push(ch.to_string());
        } else if ch.is_whitespace() {
            if !current.is_empty() {
                tokens.push(std::mem::take(&mut current));
            }
        } else {
            current.push(ch);
        }
    }
    if !current.is_empty() {
        tokens.push(current);
    }
    tokens
}

fn build_chain(texts: &[String], order: usize) -> MarkovChain {
    let mut transitions: HashMap<String, HashMap<String, u32>> = HashMap::new();
    let mut starters: HashMap<String, u32> = HashMap::new();
    let mut total_starters: u32 = 0;
    let mut vocab: std::collections::HashSet<String> = std::collections::HashSet::new();

    // Always build order-1 transitions for backoff
    let mut order1_transitions: HashMap<String, HashMap<String, u32>> = HashMap::new();

    for text in texts {
        let tokens = tokenize(text);
        if tokens.len() < 2 {
            continue;
        }

        for token in &tokens {
            vocab.insert(token.clone());
        }

        // Build order-1 transitions (always)
        for i in 0..tokens.len() - 1 {
            order1_transitions
                .entry(tokens[i].clone())
                .or_default()
                .entry(tokens[i + 1].clone())
                .and_modify(|c| *c += 1)
                .or_insert(1);
        }

        if tokens.len() < order + 1 {
            continue;
        }

        // Record starter
        let starter_key: String = tokens[..order].join(" ");
        *starters.entry(starter_key).or_insert(0) += 1;
        total_starters += 1;

        for i in 0..=(tokens.len() - order - 1) {
            let key = tokens[i..i + order].join(" ");
            let next = &tokens[i + order];

            transitions
                .entry(key.clone())
                .or_default()
                .entry(next.clone())
                .and_modify(|c| *c += 1)
                .or_insert(1);

            // Post-sentence tokens are also starters
            if i > 0 && matches!(tokens[i - 1].as_str(), "." | "!" | "?") {
                *starters.entry(key).or_insert(0) += 1;
                total_starters += 1;
            }
        }
    }

    // Flatten to vecs for weighted sampling
    let transitions = transitions
        .into_iter()
        .map(|(k, v)| (k, v.into_iter().collect::<Vec<_>>()))
        .collect();

    let starters = starters.into_iter().collect::<Vec<_>>();

    // Build backoff chain if order > 1
    let backoff = if order > 1 {
        Some(
            order1_transitions
                .into_iter()
                .map(|(k, v)| (k, v.into_iter().collect::<Vec<_>>()))
                .collect(),
        )
    } else {
        None
    };

    let vocab_size = vocab.len();

    MarkovChain {
        transitions,
        starters,
        total_starters,
        order,
        backoff,
        vocab_size,
    }
}

fn weighted_pick(dist: &[(String, u32)], rng: &mut Rng) -> Option<String> {
    let total: u32 = dist.iter().map(|(_, c)| c).sum();
    if total == 0 {
        return None;
    }
    let mut r = (rng.f64() * total as f64) as u32;
    for (key, count) in dist {
        if r < *count {
            return Some(key.clone());
        }
        r -= count;
    }
    dist.last().map(|(k, _)| k.clone())
}

fn generate_text(chain: &MarkovChain, seed: &str, max_words: usize, rng: &mut Rng) -> String {
    let seed_tokens: Vec<String> = seed
        .to_lowercase()
        .split_whitespace()
        .map(String::from)
        .collect();

    // Try to find a starting state containing a seed word
    let mut state: Option<String> = None;
    for (key, _) in &chain.starters {
        let key_lower = key.to_lowercase();
        if seed_tokens.iter().any(|sw| key_lower.contains(sw.as_str())) {
            state = Some(key.clone());
            break;
        }
    }
    // Also search transition keys
    if state.is_none() {
        for key in chain.transitions.keys() {
            let key_lower = key.to_lowercase();
            if seed_tokens.iter().any(|sw| key_lower.contains(sw.as_str())) {
                state = Some(key.clone());
                break;
            }
        }
    }
    // Fallback: random starter
    if state.is_none() {
        state = weighted_pick(&chain.starters, rng);
    }

    let Some(start) = state else {
        return String::new();
    };

    let mut tokens: Vec<String> = start.split(' ').map(String::from).collect();

    for _ in 0..max_words {
        let key = tokens[tokens.len().saturating_sub(chain.order)..]
            .join(" ");

        // Try primary chain first
        if let Some(dist) = chain.transitions.get(&key)
            && let Some(next) = weighted_pick(dist, rng)
        {
            tokens.push(next);
            continue;
        }

        // Backoff: try order-1 chain using just the last token
        if let Some(ref backoff) = chain.backoff {
            let last_token = &tokens[tokens.len() - 1];
            if let Some(dist) = backoff.get(last_token)
                && let Some(next) = weighted_pick(dist, rng)
            {
                tokens.push(next);
                continue;
            }
        }

        // Dead end: jump to random starter (insert sentence break first)
        let last = tokens.last().map(|s| s.as_str()).unwrap_or("");
        if !matches!(last, "." | "!" | "?") {
            tokens.push(".".to_string());
        }
        if let Some(restart) = weighted_pick(&chain.starters, rng) {
            for t in restart.split(' ') {
                tokens.push(t.to_string());
            }
        } else {
            break;
        }
    }

    // Reassemble: attach punctuation, capitalize after sentence boundaries
    let mut result = String::new();
    let mut capitalize_next = true;

    for t in &tokens {
        if t.len() == 1 && ".!?,;:".contains(t.as_str()) {
            result.push_str(t);
            if matches!(t.as_str(), "." | "!" | "?") {
                capitalize_next = true;
            }
        } else {
            if !result.is_empty() {
                result.push(' ');
            }
            if capitalize_next {
                let mut chars = t.chars();
                if let Some(first) = chars.next() {
                    result.extend(first.to_uppercase());
                    result.push_str(chars.as_str());
                }
                capitalize_next = false;
            } else {
                result.push_str(t);
            }
        }
    }
    result
}

// ─── Timing synthesis ───────────────────────────────────────────

struct TimingOutput {
    delays: Vec<f64>,
    keystrokes: Vec<SyntheticKeystroke>,
}

fn synthesize_timing(text: &str, profile: &TimingProfile, rng: &mut Rng) -> TimingOutput {
    let chars: Vec<char> = text.chars().collect();
    let mut delays = Vec::with_capacity(chars.len());
    let mut keystrokes = Vec::with_capacity(chars.len());

    let mu = profile.mu.unwrap_or(120.0);
    let sigma = profile.sigma.unwrap_or(40.0);
    let tau = profile.tau.unwrap_or(80.0);
    let burst_length = profile.burst_length.unwrap_or(150.0) as usize;
    let pause_sent_pct = profile.pause_sent_pct.unwrap_or(0.07);
    let pause_between_pct = profile.pause_between_pct.unwrap_or(0.69);

    // Hold time: typically 80-120ms, sampled from Gaussian
    let hold_mu = 95.0;
    let hold_sigma = 20.0;

    let mut chars_since_burst: usize = 0;
    let mut clock: f64 = 0.0; // Running timestamp in ms

    // First character: first keystroke latency
    let fk = profile.first_keystroke.unwrap_or(3000.0);
    let first_delay = fk * (0.7 + rng.f64() * 0.6);
    clock += first_delay;
    let hold = rng.gaussian(hold_mu, hold_sigma).clamp(40.0, 200.0);
    delays.push(first_delay);
    keystrokes.push(SyntheticKeystroke {
        character: chars[0],
        key_down_ms: clock,
        key_up_ms: clock + hold,
    });

    for i in 1..chars.len() {
        let prev = chars[i - 1];
        let curr = chars[i];
        chars_since_burst += 1;

        let delay;

        // P-burst pause: after ~burst_length chars at a word boundary
        if chars_since_burst >= burst_length && prev == ' ' {
            chars_since_burst = 0;
            delay = 2000.0 + rng.f64() * 2000.0;
        }
        // Sentence boundary pause
        else if matches!(prev, '.' | '!' | '?') && curr == ' ' {
            if rng.f64() < pause_sent_pct.min(1.0) * 3.5 {
                delay = 800.0 + rng.f64() * 2200.0;
            } else {
                delay = rng.ex_gaussian(mu, sigma, tau);
            }
        }
        // Word boundary pause (use profile's between-word percentage)
        else if prev == ' ' && rng.f64() < (pause_between_pct * 0.12).min(0.15) {
            delay = 300.0 + rng.f64() * 900.0;
        }
        // Digraph-specific timing
        else if let Some(latency) = profile.digraph.as_ref().and_then(|d| {
            let bigram = format!("{}{}", prev, curr);
            d.get(&bigram).copied()
        }) {
            delay = (latency + (rng.f64() - 0.5) * 40.0).max(30.0);
        }
        // Fallback: ex-Gaussian sample
        else {
            delay = rng.ex_gaussian(mu, sigma, tau);
        }

        clock += delay;
        let hold = rng.gaussian(hold_mu, hold_sigma).clamp(40.0, 200.0);

        delays.push(delay);
        keystrokes.push(SyntheticKeystroke {
            character: curr,
            key_down_ms: clock,
            key_up_ms: clock + hold,
        });
    }

    TimingOutput { delays, keystrokes }
}

// ─── Revision synthesis ─────────────────────────────────────────

/// Inject revision episodes into the keystroke stream.
///
/// Walks through the forward-only stream and stochastically inserts
/// deletion + retype sequences at rates matching the person's profile.
///
/// Two kinds of revision:
/// - Small deletions (1-3 chars): typo corrections, rethinking a word ending
/// - Large deletions (4-15 chars): word or phrase reformulation (R-bursts)
///
/// Revision timing bias controls whether deletions cluster in the first
/// or second half of the session.
fn inject_revisions(
    keystrokes: &mut Vec<SyntheticKeystroke>,
    delays: &mut Vec<f64>,
    profile: &TimingProfile,
    rng: &mut Rng,
) {
    let small_rate = profile.small_del_rate.unwrap_or(0.0);
    let large_rate = profile.large_del_rate.unwrap_or(0.0);

    // No revision data: skip
    if small_rate <= 0.0 && large_rate <= 0.0 {
        return;
    }

    let timing_bias = profile.revision_timing_bias.unwrap_or(0.5);
    let mu = profile.mu.unwrap_or(120.0);
    let sigma = profile.sigma.unwrap_or(40.0);
    let tau = profile.tau.unwrap_or(80.0);
    let hold_mu = 95.0;
    let hold_sigma = 20.0;

    let total_chars = keystrokes.len();
    if total_chars < 20 {
        return;
    }

    let midpoint = total_chars / 2;

    // Compute how many revisions to inject based on rates (per 100 chars)
    let n_small = ((small_rate * total_chars as f64 / 100.0) + 0.5) as usize;
    let n_large = ((large_rate * total_chars as f64 / 100.0) + 0.5) as usize;

    // Pick insertion positions, biased by revision_timing_bias
    let mut positions: Vec<(usize, bool)> = Vec::new(); // (index, is_large)

    for _ in 0..n_small {
        let pos = pick_revision_position(total_chars, midpoint, timing_bias, rng);
        positions.push((pos, false));
    }
    for _ in 0..n_large {
        let pos = pick_revision_position(total_chars, midpoint, timing_bias, rng);
        positions.push((pos, true));
    }

    // Sort descending so insertions don't shift earlier indices
    positions.sort_by_key(|p| std::cmp::Reverse(p.0));

    for (pos, is_large) in positions {
        if pos < 2 || pos >= keystrokes.len() {
            continue;
        }

        let del_count = if is_large {
            // R-burst: delete 4-15 chars (a word or phrase)
            4 + (rng.f64() * 11.0) as usize
        } else {
            // Small deletion: 1-3 chars
            1 + (rng.f64() * 2.0) as usize
        };

        let del_count = del_count.min(pos); // Don't delete past start
        if del_count == 0 {
            continue;
        }

        // Clock position: start from the keystroke we're revising at
        let mut clock = keystrokes[pos].key_up_ms;

        // Pre-deletion pause (recognition that something is wrong)
        let pre_pause = if is_large {
            400.0 + rng.f64() * 1200.0 // R-burst: longer deliberation
        } else {
            100.0 + rng.f64() * 300.0 // Small: quick correction
        };
        clock += pre_pause;

        // Collect the characters we're about to "delete" (for retyping)
        let deleted_chars: Vec<char> = keystrokes[pos - del_count..pos]
            .iter()
            .map(|k| k.character)
            .collect();

        // Generate Backspace events
        let mut revision_keys: Vec<SyntheticKeystroke> = Vec::new();
        let mut revision_delays: Vec<f64> = Vec::new();

        for _ in 0..del_count {
            let bs_delay = rng.gaussian(80.0, 25.0).clamp(40.0, 200.0);
            clock += bs_delay;
            let hold = rng.gaussian(60.0, 15.0).clamp(30.0, 120.0);
            revision_keys.push(SyntheticKeystroke {
                character: '\u{0008}', // Backspace
                key_down_ms: clock,
                key_up_ms: clock + hold,
            });
            revision_delays.push(bs_delay);
        }

        // Brief pause before retyping
        let retype_pause = 150.0 + rng.f64() * 400.0;
        clock += retype_pause;

        // Retype the deleted characters (possibly with a variant for large deletions)
        for ch in &deleted_chars {
            let delay = rng.ex_gaussian(mu, sigma, tau);
            clock += delay;
            let hold = rng.gaussian(hold_mu, hold_sigma).clamp(40.0, 200.0);
            revision_keys.push(SyntheticKeystroke {
                character: *ch,
                key_down_ms: clock,
                key_up_ms: clock + hold,
            });
            revision_delays.push(delay);
        }

        // Splice revision events into the stream after position `pos`
        let splice_at = pos;
        let time_shift = clock - keystrokes[pos].key_up_ms;

        // Shift all subsequent keystrokes forward in time
        for k in keystrokes.iter_mut().skip(splice_at) {
            k.key_down_ms += time_shift;
            k.key_up_ms += time_shift;
        }

        // Insert revision keystrokes and delays
        let rev_len = revision_keys.len();
        keystrokes.splice(splice_at..splice_at, revision_keys);
        delays.splice(splice_at..splice_at, revision_delays);

        // Delays for shifted keystrokes need no change (they're relative to previous)
        // but we do need to fix the delay of the keystroke right after the splice
        if splice_at + rev_len < delays.len() {
            delays[splice_at + rev_len] = rng.ex_gaussian(mu, sigma, tau);
        }
    }
}

/// Pick a revision position biased by timing_bias.
/// timing_bias > 0.5 means more revisions in the second half.
fn pick_revision_position(total: usize, midpoint: usize, bias: f64, rng: &mut Rng) -> usize {
    let in_second_half = rng.f64() < bias;
    if in_second_half {
        midpoint + (rng.f64() * (total - midpoint) as f64) as usize
    } else {
        2 + (rng.f64() * (midpoint - 2).max(1) as f64) as usize
    }
}

// ─── Perplexity ─────────────────────────────────────────────────

/// Compute the per-word log2 perplexity of `text` under the Markov chain
/// built from `corpus_texts`. Lower perplexity = the model predicts the
/// text better = the corpus has converged on the person's language.
fn compute_perplexity(chain: &MarkovChain, text: &str) -> PerplexityResult {
    let tokens = tokenize(text);
    if tokens.len() < chain.order + 1 {
        return PerplexityResult {
            perplexity: f64::INFINITY,
            word_count: tokens.len(),
            known_transitions: 0,
            unknown_transitions: tokens.len(),
        };
    }

    let mut log_prob_sum: f64 = 0.0;
    let mut known: usize = 0;
    let mut unknown: usize = 0;
    let vocab = chain.vocab_size.max(1) as f64;

    for i in chain.order..tokens.len() {
        let key = tokens[i - chain.order..i].join(" ");
        let next = &tokens[i];

        if let Some(dist) = chain.transitions.get(&key) {
            let total: u32 = dist.iter().map(|(_, c)| c).sum();
            let count = dist.iter().find(|(w, _)| w == next).map(|(_, c)| *c).unwrap_or(0);

            if count > 0 {
                // Laplace-smoothed probability
                let prob = (count as f64 + 1.0) / (total as f64 + vocab);
                log_prob_sum += prob.log2();
                known += 1;
            } else {
                // Word exists in chain but this transition unseen: smoothed
                let prob = 1.0 / (total as f64 + vocab);
                log_prob_sum += prob.log2();
                unknown += 1;
            }
        } else {
            // State not in chain at all: uniform over vocab
            let prob = 1.0 / vocab;
            log_prob_sum += prob.log2();
            unknown += 1;
        }
    }

    let n = (known + unknown).max(1) as f64;
    // Perplexity = 2^(-avg_log2_prob)
    let avg_log_prob = log_prob_sum / n;
    let perplexity = (-avg_log_prob).exp2();

    PerplexityResult {
        perplexity,
        word_count: known + unknown,
        known_transitions: known,
        unknown_transitions: unknown,
    }
}

// ─── Public API ─────────────────────────────────────────────────

fn default_profile() -> TimingProfile {
    TimingProfile {
        digraph: None,
        mu: None,
        sigma: None,
        tau: None,
        burst_length: None,
        pause_between_pct: None,
        pause_sent_pct: None,
        first_keystroke: None,
        small_del_rate: None,
        large_del_rate: None,
        revision_timing_bias: None,
        r_burst_ratio: None,
    }
}

pub(crate) fn compute(
    corpus_json: &str,
    topic: &str,
    profile_json: &str,
    max_words: usize,
) -> AvatarResult {
    // Parse inputs
    let texts: Vec<String> = serde_json::from_str(corpus_json).unwrap_or_default();
    let profile: TimingProfile =
        serde_json::from_str(profile_json).unwrap_or_else(|_| default_profile());

    if texts.is_empty() {
        return AvatarResult {
            text: String::new(),
            delays: Vec::new(),
            keystroke_events: Vec::new(),
            word_count: 0,
            order: 0,
            chain_size: 0,
        };
    }

    // Choose order based on corpus size
    let order = if texts.len() >= 10 { 2 } else { 1 };

    // Build chain
    let chain = build_chain(&texts, order);
    let chain_size = chain.transitions.len();

    // Generate with time-based seed for variety
    let seed_val = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(42);
    let mut rng = Rng::from_seed(seed_val);

    let text = generate_text(&chain, topic, max_words, &mut rng);
    let word_count = text.split_whitespace().count();

    // Synthesize timing (produces both delays and full keystroke events)
    let timing = synthesize_timing(&text, &profile, &mut rng);
    let mut delays = timing.delays;
    let mut keystrokes = timing.keystrokes;

    // Inject revision episodes (deletions + retypes) from the revision profile
    inject_revisions(&mut keystrokes, &mut delays, &profile, &mut rng);

    AvatarResult {
        text,
        delays,
        keystroke_events: keystrokes,
        word_count,
        order,
        chain_size,
    }
}

/// Compute perplexity of a new text against the corpus Markov model.
/// Used to track convergence: as the corpus grows, perplexity of real
/// journal responses should decrease.
pub(crate) fn compute_text_perplexity(
    corpus_json: &str,
    text: &str,
) -> PerplexityResult {
    let texts: Vec<String> = serde_json::from_str(corpus_json).unwrap_or_default();
    if texts.is_empty() {
        return PerplexityResult {
            perplexity: f64::INFINITY,
            word_count: 0,
            known_transitions: 0,
            unknown_transitions: 0,
        };
    }

    let order = if texts.len() >= 10 { 2 } else { 1 };
    let chain = build_chain(&texts, order);
    compute_perplexity(&chain, text)
}
