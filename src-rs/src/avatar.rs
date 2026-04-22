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

use crate::types::{SignalError, SignalResult};

// ─── Adversary Variants ─────────────────────────────────────────
//
// The avatar is a reconstruction adversary: it generates synthetic
// keystroke streams from a person's statistical profile to test
// what a profile alone can reproduce vs. what requires the actual
// person. Each variant adds one modeling improvement to isolate
// which statistical dimension carries the most signal:
//
// 1. Baseline:           Markov text + independent IKI + fixed hold
// 2. ConditionalTiming:  Markov text + AR(1) correlated IKI + fixed hold
// 3. CopulaMotor:        Markov text + independent IKI + copula hold/flight
// 4. PpmText:            PPM text + independent IKI + fixed hold
// 5. FullAdversary:      PPM text + AR(1) IKI + copula hold/flight
//
// Comparing residuals across variants reveals which dimension of
// behavior (text prediction, IKI correlation, hold/flight coupling)
// is most irreducible from the profile alone.

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub(crate) enum AdversaryVariant {
    /// Order-2 Markov + independent ex-Gaussian timing (current ghost)
    Baseline = 1,
    /// Order-2 Markov + AR(1) conditioned IKI preserving serial dependence
    ConditionalTiming = 2,
    /// Order-2 Markov + Gaussian copula joint hold/flight sampling
    CopulaMotor = 3,
    /// Variable-order PPM + independent ex-Gaussian timing
    PpmText = 4,
    /// PPM + AR(1) + copula (strongest adversary within measurement space)
    FullAdversary = 5,
}

impl AdversaryVariant {
    pub(crate) fn from_i32(v: i32) -> Self {
        match v {
            2 => Self::ConditionalTiming,
            3 => Self::CopulaMotor,
            4 => Self::PpmText,
            5 => Self::FullAdversary,
            _ => Self::Baseline,
        }
    }

    fn uses_ppm(self) -> bool {
        matches!(self, Self::PpmText | Self::FullAdversary)
    }

    fn uses_conditional_timing(self) -> bool {
        matches!(self, Self::ConditionalTiming | Self::FullAdversary)
    }

    fn uses_copula(self) -> bool {
        matches!(self, Self::CopulaMotor | Self::FullAdversary)
    }
}

// ─── Types ──────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
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
    /// Used by I-burst synthesis to derive insertion rate (1 - r_burst_ratio).
    pub(crate) r_burst_ratio: Option<f64>,
    /// Mean R-burst deletion size in UTF-16 code units.
    /// Used to calibrate large deletion size instead of fixed 4-15 range.
    pub(crate) rburst_mean_size: Option<f64>,
    /// Fraction of R-bursts at the leading edge of text (Lindgren & Sullivan 2006).
    /// Used to bias revision placement toward point of inscription vs back in text.
    pub(crate) rburst_leading_edge_pct: Option<f64>,
    /// Ratio of second-half to first-half R-burst deletion size within a session.
    /// Values above 1.0 mean R-bursts get larger as the session progresses (consolidation).
    /// Used to scale deletion size by position in the keystroke stream.
    pub(crate) rburst_consolidation: Option<f64>,
    /// Mean duration in ms of a complete R-burst episode (pre-pause + deletion + retype).
    /// Used to calibrate the total timing of synthesized R-burst episodes.
    pub(crate) rburst_mean_duration: Option<f64>,
    // ── Variant-specific fields ──
    /// IKI autocorrelation at lag 1 (mean across sessions).
    /// AR(1) coefficient for conditional timing variant.
    pub(crate) iki_autocorrelation_lag1: Option<f64>,
    /// Spearman rank correlation between hold and flight times.
    /// Copula parameter for joint hold/flight sampling variant.
    pub(crate) hold_flight_rank_correlation: Option<f64>,
    /// Mean hold time across sessions (for copula marginal).
    pub(crate) hold_time_mean: Option<f64>,
    /// Std of hold time across sessions (for copula marginal).
    pub(crate) hold_time_std: Option<f64>,
    /// Mean flight time across sessions (for copula marginal). Reserved for
    /// future copula refinement where flight is sampled from its own marginal.
    #[allow(dead_code)]
    pub(crate) flight_time_mean: Option<f64>,
    /// Std of flight time across sessions (for copula marginal). Reserved.
    #[allow(dead_code)]
    pub(crate) flight_time_std: Option<f64>,
}

#[derive(Debug)]
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
    /// Number of I-burst episodes injected. Cannot be detected from the
    /// flat keystroke stream because position information is lost after
    /// splice; must be returned as metadata.
    pub(crate) i_burst_count: usize,
    /// Which adversary variant produced this result.
    pub(crate) variant: u8,
}

#[derive(Debug)]
pub(crate) struct SyntheticKeystroke {
    pub(crate) character: char,
    pub(crate) key_down_ms: f64,
    pub(crate) key_up_ms: f64,
}

/// Result of computing perplexity of a text against the Markov model.
#[derive(Debug)]
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

// ─── PRNG (xoshiro128+, no external dep) ───────���──────────────
//
// xoshiro128+: Blackman & Vigna (2018). Fast, small-state generator.
// Passes BigCrush on the full 32-bit output. Low bits have linear
// artifacts but f64() uses the upper 31 bits only.
//
// State initialization via SplitMix64: Steele, Lea & Flood (2014).

struct Rng {
    s: [u32; 4],
}

impl Rng {
    /// Initialize from a 64-bit seed via SplitMix64 (Steele, Lea & Flood 2014).
    fn from_seed(seed: u64) -> Self {
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

    /// xoshiro128+ step (Blackman & Vigna 2018).
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
        // Divide by 2^31 (not 2^31 - 1) so the maximum value is
        // (2^31 - 1) / 2^31 < 1.0, guaranteeing the half-open interval.
        (self.next_u32() >> 1) as f64 / (1u64 << 31) as f64
    }

    /// Gaussian sample via the Box-Muller transform (Box & Muller 1958).
    /// Exact for continuous uniform inputs; no approximation error.
    fn gaussian(&mut self, mu: f64, sigma: f64) -> f64 {
        let u1 = self.f64().max(1e-10);
        let u2 = self.f64();
        let z = (-2.0 * u1.ln()).sqrt() * (2.0 * std::f64::consts::PI * u2).cos();
        sigma.mul_add(z, mu)
    }

    /// Ex-Gaussian sample: N(mu, sigma) + Exp(tau).
    /// Convolution of Gaussian and exponential components
    /// (Lacouture & Cousineau 2008). The tau component models the
    /// right tail (attentional lapses in keystroke timing). Floor at 30ms.
    fn ex_gaussian(&mut self, mu: f64, sigma: f64, tau: f64) -> f64 {
        let gauss = self.gaussian(mu, sigma);
        let exp = -tau * self.f64().max(1e-10).ln();
        (gauss + exp).max(30.0)
    }
}

// ─── Markov chain ───────────────────────────────────────────────
//
// All internal collections use sorted vecs, not HashMaps, for
// deterministic iteration order. This is a build-once-sample-many
// data structure: the corpus is processed once into frozen probability
// tables, then sampled hundreds of times during generation. Sorted
// vecs give cache-friendly contiguous memory on the sampling hot path
// and deterministic output for a given PRNG seed.
//
// BTreeMap would also provide deterministic iteration and is the
// simpler default. Use BTreeMap instead if the data structure ever
// needs to support insertion after construction (e.g. online learning
// from new journal entries without rebuilding the full chain).

/// Word-level Markov chain built from a personal writing corpus.
///
/// Strings are cloned into owned `String`s rather than interned or
/// arena-allocated. This is intentional: a personal journal corpus has
/// ~2-5K unique words. The entire chain fits in a few hundred KB.
/// Interning would add complexity (lifetime management or global state)
/// for zero measurable benefit at this vocabulary scale.
#[allow(dead_code)] // total_starters available for diagnostics but not currently read
struct MarkovChain {
    /// state -> [(next_word, count)], sorted by key for deterministic lookup
    transitions: Vec<(String, Vec<(String, u32)>)>,
    /// sentence starters with counts, sorted by key
    starters: Vec<(String, u32)>,
    total_starters: u32,
    order: usize,
    /// Order-1 chain for backoff when order-2 hits a dead end, sorted by key.
    #[allow(clippy::type_complexity)] // Flat sorted vecs are intentional; a wrapper type adds indirection for no benefit
    backoff: Option<Vec<(String, Vec<(String, u32)>)>>,
    /// Total word count across all training texts (for perplexity vocab size)
    vocab_size: usize,
    /// Absolute discounting parameter d = n1 / (n1 + 2*n2).
    /// Chen & Goodman (1999): optimal single-discount estimator.
    discount: f64,
    /// Unigram probability distribution for backoff: word -> P(word), sorted by key.
    unigram_probs: Vec<(String, f64)>,
}

/// Binary search for a key in a sorted `Vec<(String, V)>`.
///
/// All sampling collections in the avatar engine are built as `HashMap` then
/// frozen into sorted vecs for deterministic iteration. This function provides
/// O(log n) lookup into those frozen collections. See the module-level comment
/// on `MarkovChain` for why sorted vecs over `BTreeMap`.
fn sorted_vec_get<'a, V>(sorted: &'a [(String, V)], key: &str) -> Option<&'a V> {
    sorted
        .binary_search_by_key(&key, |(k, _)| k.as_str())
        .ok()
        .map(|i| &sorted[i].1)
}

/// Split text into word tokens and punctuation tokens.
///
/// Punctuation (`.!?,;:`) becomes its own token. Whitespace is a separator
/// (not a token). Contractions (`don't`) are preserved as single tokens
/// because the apostrophe is not in the split set.
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

/// Build a word-level Markov chain from a personal writing corpus.
///
/// Constructs order-N transitions (specified by `order`) plus a mandatory
/// order-1 backoff chain. Computes Absolute Discounting (Chen & Goodman 1999)
/// and unigram probabilities for smoothed generation and perplexity scoring.
///
/// All internal `HashMap`s are frozen into sorted vecs at the end so that
/// iteration order is deterministic for a given PRNG seed.
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

    // ── Absolute Discounting parameter (Chen & Goodman 1999) ──
    // d = n1 / (n1 + 2*n2) where n1 = count of n-grams appearing once,
    // n2 = count of n-grams appearing twice. Optimal single-discount estimator.
    let (n1, n2) = transitions
        .values()
        .flat_map(|v| v.values())
        .fold((0u32, 0u32), |(n1, n2), &count| match count {
            1 => (n1 + 1, n2),
            2 => (n1, n2 + 1),
            _ => (n1, n2),
        });
    let discount = if n1 + 2 * n2 > 0 {
        n1 as f64 / (n1 as f64 + 2.0 * n2 as f64)
    } else {
        0.5 // safe default when corpus is too small to estimate
    };

    // ── Unigram probabilities for backoff ──
    let mut unigram_counts: HashMap<String, u32> = HashMap::new();
    let mut unigram_total: u32 = 0;
    for text in texts {
        for token in tokenize(text) {
            *unigram_counts.entry(token).or_insert(0) += 1;
            unigram_total += 1;
        }
    }
    let unigram_total_f = unigram_total.max(1) as f64;
    let mut unigram_probs: Vec<(String, f64)> = unigram_counts
        .into_iter()
        .map(|(k, v)| (k, v as f64 / unigram_total_f))
        .collect();
    unigram_probs.sort_by(|(a, _), (b, _)| a.cmp(b));

    // Flatten to sorted vecs for deterministic weighted sampling.
    // HashMap is used as a builder; sorted vecs are the frozen form.
    let mut transitions: Vec<(String, Vec<(String, u32)>)> = transitions
        .into_iter()
        .map(|(k, v)| {
            let mut dist: Vec<(String, u32)> = v.into_iter().collect();
            dist.sort_by(|(a, _), (b, _)| a.cmp(b));
            (k, dist)
        })
        .collect();
    transitions.sort_by(|(a, _), (b, _)| a.cmp(b));

    let mut starters: Vec<(String, u32)> = starters.into_iter().collect();
    starters.sort_by(|(a, _), (b, _)| a.cmp(b));

    // Build backoff chain if order > 1
    let backoff = if order > 1 {
        let mut bo: Vec<(String, Vec<(String, u32)>)> = order1_transitions
            .into_iter()
            .map(|(k, v)| {
                let mut dist: Vec<(String, u32)> = v.into_iter().collect();
                dist.sort_by(|(a, _), (b, _)| a.cmp(b));
                (k, dist)
            })
            .collect();
        bo.sort_by(|(a, _), (b, _)| a.cmp(b));
        Some(bo)
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
        discount,
        unigram_probs,
    }
}

/// Sample a word from a weighted distribution using cumulative probability.
///
/// Returns `None` if the distribution is empty or has zero total weight.
/// Because the distribution is a sorted vec, iteration order is deterministic.
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

/// Witten-Bell interpolated pick: blend higher and lower order distributions
/// rather than hard-fallback. Produces smoother generation because every
/// sample incorporates evidence from both context lengths.
///
/// lambda = T(h) / (T(h) + C(h)) where T = unique successors, C = total count.
/// With probability (1-lambda), sample from higher order; else from lower order.
/// Jelinek & Mercer (1980); Witten-Bell weight estimation.
fn interpolated_pick(
    primary: Option<&Vec<(String, u32)>>,
    backoff: Option<&Vec<(String, u32)>>,
    rng: &mut Rng,
) -> Option<String> {
    match (primary, backoff) {
        (Some(d_hi), Some(d_lo)) => {
            let t = d_hi.len() as f64;
            let c: f64 = d_hi.iter().map(|(_, count)| *count as f64).sum();
            // lambda: probability of escaping to lower order
            let lambda = t / (t + c);
            if rng.f64() >= lambda {
                weighted_pick(d_hi, rng).or_else(|| weighted_pick(d_lo, rng))
            } else {
                weighted_pick(d_lo, rng).or_else(|| weighted_pick(d_hi, rng))
            }
        }
        (Some(d), None) | (None, Some(d)) => weighted_pick(d, rng),
        (None, None) => None,
    }
}

/// Generate text by walking the Markov chain starting from a topic seed.
///
/// Tries to find a starting state containing a seed word, falling back to
/// transition keys, then to a random starter. Uses Witten-Bell interpolated
/// backoff (Jelinek & Mercer 1980) to blend order-N and order-1 distributions
/// at each step. Dead ends trigger a sentence break and random restart.
///
/// `max_words` is approximate: the output may be slightly longer due to
/// starter tokens and sentence restarts.
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
        for (key, _) in &chain.transitions {
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
        let last_token = &tokens[tokens.len() - 1];

        // Interpolated backoff: blend order-N and order-1 distributions
        let primary = sorted_vec_get(&chain.transitions, &key);
        let lower = chain.backoff.as_ref().and_then(|b| sorted_vec_get(b, last_token.as_str()));

        if let Some(next) = interpolated_pick(primary, lower, rng) {
            tokens.push(next);
            continue;
        }

        // Dead end at both orders: jump to random starter
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

// ─── Word frequency map (for content-process coupling) ──────────

/// Build a word frequency map from the corpus. Words that appear rarely
/// in the person's writing take longer to retrieve; common words flow.
fn build_word_freq(texts: &[String]) -> HashMap<String, f64> {
    let mut counts: HashMap<String, u32> = HashMap::new();
    let mut total: u32 = 0;
    for text in texts {
        for word in text.split_whitespace() {
            let w = word.to_lowercase().trim_matches(|c: char| !c.is_alphanumeric()).to_string();
            if w.len() >= 2 {
                *counts.entry(w).or_insert(0) += 1;
                total += 1;
            }
        }
    }
    let total_f = total.max(1) as f64;
    counts.into_iter().map(|(k, v)| (k, v as f64 / total_f)).collect()
}

/// Returns a delay multiplier based on word frequency in the person's corpus.
/// Common words (high frequency) get a multiplier < 1.0 (shorter pause).
/// Rare words (low frequency) get a multiplier > 1.0 (longer pause).
/// Uses log-frequency scaling per Inhoff & Rayner (1986): fixation time
/// scales linearly with -log(frequency). Range approximately [0.7, 2.5].
fn word_difficulty_multiplier(word: &str, freq_map: &HashMap<String, f64>, rng: &mut Rng) -> f64 {
    let w = word.to_lowercase();
    let w = w.trim_matches(|c: char| !c.is_alphanumeric());
    match freq_map.get(w) {
        Some(&freq) if freq > 0.0 => {
            // -ln(0.05) ≈ 3.0 (very common), -ln(0.0005) ≈ 7.6 (rare)
            // Map to [0.7, 2.5] via linear scaling on log-frequency.
            let log_diff = (-freq.ln() - 3.0).max(0.0);
            (0.7 + log_diff * 0.28).min(2.5)
        }
        _ => 1.8 + rng.f64() * 0.5, // unseen: high difficulty + stochastic jitter
    }
}

// ─── Timing synthesis ───────────────────────────────────────────

#[derive(Debug)]
struct TimingOutput {
    delays: Vec<f64>,
    keystrokes: Vec<SyntheticKeystroke>,
}

/// Synthesize a full keystroke stream with:
/// - Tempo drift (slow start, faster middle, slight slowdown at end)
/// - Content-process coupling (rare words get longer pre-pauses)
/// - Evaluation pauses (periodic read-back pauses at structural boundaries)
/// - I-burst insertion (navigate back and insert text mid-stream)
/// - All prior features (P-bursts, digraph timing, pause architecture)
///
/// The `iki_sampler` closure controls how base IKI delays are generated.
/// For independent timing (Baseline, PpmText), it samples from ex-Gaussian(mu, sigma, tau).
/// For conditioned timing (ConditionalTiming, FullAdversary), it uses an AR(1) process
/// calibrated from the profile's lag-1 autocorrelation.
///
/// The `hold_sampler` closure controls hold/flight time generation.
/// For baseline variants, it samples from a fixed Gaussian.
/// For copula variants (CopulaMotor, FullAdversary), it uses a bivariate
/// Gaussian copula preserving the measured hold-flight rank correlation.
fn synthesize_timing(
    text: &str,
    profile: &TimingProfile,
    word_freq: &HashMap<String, f64>,
    iki_sampler: &mut IkiSampler,
    hold_sampler: &mut HoldSampler,
    rng: &mut Rng,
) -> TimingOutput {
    let chars: Vec<char> = text.chars().collect();
    let total_chars = chars.len();
    let mut delays = Vec::with_capacity(total_chars + total_chars / 10);
    let mut keystrokes = Vec::with_capacity(total_chars + total_chars / 10);

    let base_mu = profile.mu.unwrap_or(120.0);
    let burst_length = profile.burst_length.unwrap_or(150.0) as usize;
    let pause_sent_pct = profile.pause_sent_pct.unwrap_or(0.07);
    let pause_between_pct = profile.pause_between_pct.unwrap_or(0.69);

    let mut chars_since_burst: usize = 0;
    let mut clock: f64 = 0.0;

    // ── Tempo drift: three-phase arc ──
    // Phase 1 (0-20%): exploratory, slower (mu * 1.3)
    // Phase 2 (20-75%): confident, faster (mu * 0.85)
    // Phase 3 (75-100%): reviewing/winding down, slight slowdown (mu * 1.1)
    let tempo_mu = |char_idx: usize| -> f64 {
        let progress = char_idx as f64 / total_chars.max(1) as f64;
        let drift = if progress < 0.2 {
            1.3 - (progress / 0.2) * 0.45  // 1.3 -> 0.85
        } else if progress < 0.75 {
            0.85                            // steady fast
        } else {
            0.85 + ((progress - 0.75) / 0.25) * 0.25  // 0.85 -> 1.1
        };
        base_mu * drift
    };

    // ── Content-process coupling: track current word for difficulty ──
    let words: Vec<(usize, usize, String)> = extract_word_spans(text);
    let mut word_idx = 0;

    // ── Evaluation pauses: every ~3-5 P-bursts, insert a longer read-back ──
    let mut bursts_since_eval: usize = 0;
    let eval_interval = 3 + (rng.f64() * 3.0) as usize; // 3-5 bursts between evals

    // First character: first keystroke latency
    let fk = profile.first_keystroke.unwrap_or(3000.0);
    let first_delay = fk * (0.7 + rng.f64() * 0.6);
    clock += first_delay;
    let (hold, _) = hold_sampler(rng);
    delays.push(first_delay);
    keystrokes.push(SyntheticKeystroke {
        character: chars[0],
        key_down_ms: clock,
        key_up_ms: clock + hold,
    });

    for i in 1..total_chars {
        let prev = chars[i - 1];
        let curr = chars[i];
        chars_since_burst += 1;

        // Advance word index
        while word_idx + 1 < words.len() && i >= words[word_idx + 1].0 {
            word_idx += 1;
        }

        // Current mu adjusted for tempo drift
        let mu = tempo_mu(i);

        let delay;

        // P-burst pause: after ~burst_length chars at a word boundary
        if chars_since_burst >= burst_length && prev == ' ' {
            chars_since_burst = 0;
            bursts_since_eval += 1;

            // Evaluation pause: periodically insert a longer read-back pause
            if bursts_since_eval >= eval_interval {
                bursts_since_eval = 0;
                delay = 4000.0 + rng.f64() * 4000.0;
            } else {
                delay = 2000.0 + rng.f64() * 2000.0;
            }
        }
        // Sentence boundary pause
        else if matches!(prev, '.' | '!' | '?') && curr == ' ' {
            if rng.f64() < pause_sent_pct.min(1.0) * 3.5 {
                delay = 800.0 + rng.f64() * 2200.0;
            } else {
                delay = iki_sampler(mu, rng);
            }
        }
        // Word boundary pause: content-process coupling applies here
        else if prev == ' ' {
            let difficulty = if word_idx < words.len() {
                word_difficulty_multiplier(&words[word_idx].2, word_freq, rng)
            } else {
                1.0
            };

            if rng.f64() < (pause_between_pct * 0.12 * difficulty).min(0.25) {
                delay = (300.0 + rng.f64() * 900.0) * difficulty.min(2.0);
            } else {
                delay = iki_sampler(mu, rng);
            }
        }
        // Digraph-specific timing
        else if let Some(latency) = profile.digraph.as_ref().and_then(|d| {
            let bigram = format!("{}{}", prev, curr);
            d.get(&bigram).copied()
        }) {
            delay = (latency + (rng.f64() - 0.5) * 40.0).max(30.0);
        }
        // Fallback: base IKI sample with tempo drift
        else {
            delay = iki_sampler(mu, rng);
        }

        let (hold, flight_factor) = hold_sampler(rng);
        let adjusted_delay = if flight_factor > 0.0 && (flight_factor - 1.0).abs() > 1e-6 {
            (delay * flight_factor).max(30.0)
        } else {
            delay
        };

        clock += adjusted_delay;
        delays.push(adjusted_delay);
        keystrokes.push(SyntheticKeystroke {
            character: curr,
            key_down_ms: clock,
            key_up_ms: clock + hold,
        });
    }

    TimingOutput { delays, keystrokes }
}

/// Extract word spans from text: (start_char_idx, end_char_idx, word_string)
fn extract_word_spans(text: &str) -> Vec<(usize, usize, String)> {
    let mut spans = Vec::new();
    let chars: Vec<char> = text.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        // Skip non-word characters
        if !chars[i].is_alphanumeric() {
            i += 1;
            continue;
        }
        let start = i;
        let mut word = String::new();
        while i < chars.len() && (chars[i].is_alphanumeric() || chars[i] == '\'') {
            word.push(chars[i]);
            i += 1;
        }
        spans.push((start, i, word));
    }
    spans
}

// ─── I-burst injection ──────────────────────────────────────────

/// Inject I-burst episodes: navigate back to an earlier position
/// and insert new text. These are structurally different from R-bursts
/// (which delete-then-retype at the current position).
///
/// I-bursts show up in the process signal pipeline as mid-text insertions,
/// which is a key marker of genuine composition vs. transcription.
/// Returns the number of I-burst episodes injected.
fn inject_i_bursts(
    keystrokes: &mut Vec<SyntheticKeystroke>,
    delays: &mut Vec<f64>,
    profile: &TimingProfile,
    chain: &MarkovChain,
    word_freq: &HashMap<String, f64>,
    rng: &mut Rng,
) -> usize {
    let r_ratio = profile.r_burst_ratio.unwrap_or(1.0);
    // i_burst_ratio = 1 - r_burst_ratio. If r_ratio is 0.8, 20% of bursts are I-bursts.
    let i_ratio = 1.0 - r_ratio.clamp(0.0, 1.0);
    if i_ratio < 0.05 || keystrokes.len() < 50 {
        return 0; // Negligible I-burst rate or too short
    }

    let base_mu = profile.mu.unwrap_or(120.0);
    let sigma = profile.sigma.unwrap_or(40.0);
    let tau = profile.tau.unwrap_or(80.0);
    let hold_mu = 95.0;
    let hold_sigma = 20.0;
    let total_session_chars = keystrokes.len();

    // Number of I-bursts: proportional to session length and i_ratio
    let burst_count = profile.burst_length.unwrap_or(150.0) as usize;
    let n_total_bursts = keystrokes.len() / burst_count.max(50);
    let n_i_bursts = ((n_total_bursts as f64 * i_ratio) + 0.5) as usize;

    if n_i_bursts == 0 {
        return 0;
    }

    // Pick insertion targets in the first 70% of the text (you go BACK to insert)
    let mut injected: usize = 0;
    for _ in 0..n_i_bursts {
        let target_range = (keystrokes.len() as f64 * 0.7) as usize;
        if target_range < 10 {
            break;
        }
        let target = 5 + (rng.f64() * (target_range - 5) as f64) as usize;
        if target >= keystrokes.len() {
            continue;
        }

        // Find a word boundary near the target (insert after a space)
        let insert_at = find_word_boundary(keystrokes, target);
        if insert_at >= keystrokes.len() {
            continue;
        }

        let mut clock = keystrokes[insert_at].key_up_ms;

        // Navigation pause (reading back to find where to insert): 1.5-4s
        let nav_pause = 1500.0 + rng.f64() * 2500.0;
        clock += nav_pause;

        // Generate 2-6 words to insert from the Markov chain
        let insert_words = 2 + (rng.f64() * 4.0) as usize;
        let last_word = keystrokes[insert_at.saturating_sub(5)..insert_at]
            .iter()
            .filter(|k| k.character.is_alphanumeric())
            .map(|k| k.character)
            .collect::<String>();

        let seed = if last_word.is_empty() { "the" } else { &last_word };
        let inserted_text = generate_text(chain, seed, insert_words, rng);
        let inserted_text = format!(" {}", inserted_text.trim());

        // Generate keystroke events with tempo drift + word difficulty coupling
        // so inserted text is not trivially distinguishable from forward production.
        let insert_words_spans = extract_word_spans(&inserted_text);
        let mut insert_keys: Vec<SyntheticKeystroke> = Vec::new();
        let mut insert_delays: Vec<f64> = Vec::new();
        let mut iw_idx = 0;

        for (ci, ch) in inserted_text.chars().enumerate() {
            // Advance word index for difficulty lookup
            while iw_idx + 1 < insert_words_spans.len() && ci >= insert_words_spans[iw_idx + 1].0 {
                iw_idx += 1;
            }

            // Tempo drift based on position within the overall session
            let progress = insert_at as f64 / total_session_chars.max(1) as f64;
            let drift = if progress < 0.2 {
                1.3 - (progress / 0.2) * 0.45
            } else if progress < 0.75 {
                0.85
            } else {
                0.85 + ((progress - 0.75) / 0.25) * 0.25
            };
            let mu = base_mu * drift;

            // Word difficulty at word boundaries
            let delay = if ch == ' ' && iw_idx < insert_words_spans.len() {
                let diff = word_difficulty_multiplier(&insert_words_spans[iw_idx].2, word_freq, rng);
                rng.ex_gaussian(mu * diff.min(1.5), sigma, tau)
            } else {
                rng.ex_gaussian(mu, sigma, tau)
            };

            clock += delay;
            let hold = rng.gaussian(hold_mu, hold_sigma).clamp(40.0, 200.0);
            insert_keys.push(SyntheticKeystroke {
                character: ch,
                key_down_ms: clock,
                key_up_ms: clock + hold,
            });
            insert_delays.push(delay);
        }

        // Post-insertion pause (re-orient to where you were): 500-1500ms
        let reorient_pause = 500.0 + rng.f64() * 1000.0;
        clock += reorient_pause;

        // Shift all subsequent keystrokes forward in time
        let time_shift = clock - keystrokes[insert_at].key_up_ms;
        for k in keystrokes.iter_mut().skip(insert_at) {
            k.key_down_ms += time_shift;
            k.key_up_ms += time_shift;
        }

        // Splice insertion into the stream
        let ins_len = insert_keys.len();
        keystrokes.splice(insert_at..insert_at, insert_keys);
        delays.splice(insert_at..insert_at, insert_delays);

        // Fix the delay of the keystroke right after the splice
        if insert_at + ins_len < delays.len() {
            delays[insert_at + ins_len] = reorient_pause;
        }

        injected += 1;
    }

    injected
}

/// Find the nearest word boundary (space character) at or after `pos`.
fn find_word_boundary(keystrokes: &[SyntheticKeystroke], pos: usize) -> usize {
    for (i, k) in keystrokes.iter().enumerate().skip(pos).take(20) {
        if k.character == ' ' {
            return i + 1; // Insert after the space
        }
    }
    pos // Fallback: insert at pos
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
    chain: &MarkovChain,
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
    // Large deletions (R-bursts): bias toward leading edge if profile says so.
    // rburst_leading_edge_pct controls what fraction of R-bursts land near the
    // current writing front vs. back in earlier text.
    let leading_edge_pct = profile.rburst_leading_edge_pct.unwrap_or(0.5);
    for _ in 0..n_large {
        let pos = if rng.f64() < leading_edge_pct {
            // Leading edge: position in last 20% of text
            let start = (total_chars as f64 * 0.8) as usize;
            start.max(2) + (rng.f64() * (total_chars - start.max(2)).max(1) as f64) as usize
        } else {
            pick_revision_position(total_chars, midpoint, timing_bias, rng)
        };
        positions.push((pos, true));
    }

    // Sort descending so insertions don't shift earlier indices
    positions.sort_by_key(|p| std::cmp::Reverse(p.0));

    // R-burst consolidation: scale deletion size by position in the stream.
    // consolidation > 1.0 means R-bursts grow larger as the session progresses.
    // We model this as a linear ramp: first-half deletions are scaled down,
    // second-half deletions are scaled up, preserving the mean size overall.
    //
    // NOTE (2026-04-21): consolidation and duration budget were added after the
    // initial 23 sessions were computed. Residuals for those sessions used
    // hardcoded R-burst timing (fixed 80ms backspace IKI, 400-1600ms deliberation).
    // New sessions use calibrated values. To recompute old sessions, delete their
    // rows from tb_reconstruction_residuals and re-run backfill-adversary-variants.
    let consolidation = profile.rburst_consolidation.unwrap_or(1.0).clamp(0.2, 5.0);

    // R-burst duration budget: calibrate episode timing from profile.
    // The budget covers pre-pause + backspace sequence + retype pause + retype.
    // If not available, the old hardcoded values are used.
    let rburst_duration_budget = profile.rburst_mean_duration;

    for (pos, is_large) in positions {
        if pos < 2 || pos >= keystrokes.len() {
            continue;
        }

        let del_count = if is_large {
            // R-burst: deletion size from profile mean, or fallback to 4-15 range
            let base_size = if let Some(mean_size) = profile.rburst_mean_size {
                rng.gaussian(mean_size, mean_size * 0.4).clamp(2.0, mean_size * 3.0)
            } else {
                4.0 + rng.f64() * 11.0
            };
            // Apply consolidation scaling: early R-bursts shrink, late ones grow.
            // At progress=0 scale is 1/consolidation, at progress=1 scale is consolidation.
            // For consolidation=1.0 (even), scale is always 1.0.
            let progress = pos as f64 / total_chars.max(1) as f64;
            let scale = if (consolidation - 1.0).abs() < 0.01 {
                1.0
            } else {
                // Log-linear interpolation: ln(scale) goes from -ln(c) to +ln(c)
                let log_c = consolidation.ln();
                (log_c.mul_add(2.0 * progress - 1.0, 0.0)).exp()
            };
            (base_size * scale).clamp(2.0, base_size * 3.0) as usize
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

        // Pre-deletion pause (recognition that something is wrong).
        // If we have a duration budget, allocate ~25% to deliberation.
        let pre_pause = if is_large {
            if let Some(budget) = rburst_duration_budget {
                let target = budget * 0.25;
                rng.gaussian(target, target * 0.3).clamp(100.0, budget * 0.5)
            } else {
                400.0 + rng.f64() * 1200.0
            }
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

        // Backspace IKI and retype pause: calibrated from duration budget if available.
        // Budget allocation: 25% pre-pause (above), 35% backspace, 10% retype pause, 30% retype.
        let (bs_iki_target, retype_pause_target) = if is_large {
            if let Some(budget) = rburst_duration_budget {
                let remaining = budget - pre_pause;
                let bs_share = remaining * 0.35;
                let bs_per_key = if del_count > 0 { bs_share / del_count as f64 } else { 80.0 };
                let rp = remaining * 0.10;
                (bs_per_key.clamp(40.0, 200.0), rp.clamp(80.0, 800.0))
            } else {
                (80.0, 150.0 + rng.f64() * 400.0)
            }
        } else {
            (80.0, 150.0 + rng.f64() * 400.0)
        };

        for _ in 0..del_count {
            let bs_delay = rng.gaussian(bs_iki_target, bs_iki_target * 0.3).clamp(40.0, 200.0);
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
        let retype_pause = if is_large {
            rng.gaussian(retype_pause_target, retype_pause_target * 0.3).clamp(80.0, 1500.0)
        } else {
            retype_pause_target
        };
        clock += retype_pause;

        // Retype: small deletions re-emit the same chars (typo fix).
        // R-bursts generate variant text from the Markov chain (reformulation).
        // Real R-bursts delete to rephrase, not to re-emit identical text.
        let retype_chars: Vec<char> = if is_large {
            let ctx_end = pos.saturating_sub(del_count);
            let ctx_start = pos.saturating_sub(del_count + 20);
            let context: String = if ctx_start < ctx_end {
                keystrokes[ctx_start..ctx_end]
                    .iter()
                    .filter(|k| k.character.is_alphanumeric() || k.character == ' ')
                    .map(|k| k.character)
                    .collect()
            } else {
                String::new()
            };
            let seed = context.split_whitespace().last().unwrap_or("the");
            let target_words = (del_count / 5).max(1);
            let replacement = generate_text(chain, seed, target_words, rng);
            if replacement.is_empty() {
                deleted_chars.clone()
            } else {
                replacement.chars().collect()
            }
        } else {
            deleted_chars.clone()
        };

        for ch in &retype_chars {
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

/// IKI sampler: given current tempo-adjusted mu and an RNG, returns a delay in ms.
type IkiSampler = dyn FnMut(f64, &mut Rng) -> f64;

/// Hold sampler: given an RNG, returns (hold_ms, flight_factor).
/// flight_factor is 1.0 when no copula modulation is applied.
type HoldSampler = dyn FnMut(&mut Rng) -> (f64, f64);

// ─── IKI Sampler Factories ──────────────────────────────────────
//
// Each adversary variant combines one IKI sampler with one hold sampler.
// The factories below construct the closures that `synthesize_timing`
// uses, keeping the generation skeleton free of variant-specific logic.

/// Build an independent ex-Gaussian IKI sampler (Baseline, PpmText).
fn make_independent_iki(sigma: f64, tau: f64) -> impl FnMut(f64, &mut Rng) -> f64 {
    move |mu: f64, rng: &mut Rng| rng.ex_gaussian(mu, sigma, tau)
}

/// Build an AR(1) conditioned IKI sampler (ConditionalTiming, FullAdversary).
///
/// AR(1): IKI[t] = mu + phi * (IKI[t-1] - mu) + epsilon
/// where phi = iki_autocorrelation_lag1, epsilon ~ ex-Gaussian(0, sigma_adj, tau).
/// sigma_adj = sigma * sqrt(1 - phi^2) preserves marginal variance.
///
/// Citation: Box, Jenkins & Reinsel (2008). Time Series Analysis.
fn make_ar1_iki(sigma: f64, tau: f64, phi: f64, base_mu: f64) -> impl FnMut(f64, &mut Rng) -> f64 {
    let sigma_adj = sigma * (1.0 - phi * phi).max(0.01).sqrt();
    let mut prev_iki = base_mu;
    move |mu: f64, rng: &mut Rng| {
        let innovation = rng.ex_gaussian(0.0, sigma_adj, tau) - tau; // center the exponential
        let iki = mu + phi * (prev_iki - mu) + innovation;
        let iki = iki.max(30.0);
        prev_iki = iki;
        iki
    }
}

/// Build a fixed-Gaussian hold sampler (Baseline, ConditionalTiming, PpmText).
/// Returns (hold_ms, flight_factor=1.0) so the caller can ignore flight_factor.
fn make_fixed_hold(hold_mean: f64, hold_std: f64) -> impl FnMut(&mut Rng) -> (f64, f64) {
    move |rng: &mut Rng| {
        let hold = rng.gaussian(hold_mean, hold_std).clamp(40.0, 200.0);
        (hold, 1.0)
    }
}

/// Build a Gaussian copula hold/flight sampler (CopulaMotor, FullAdversary).
///
/// Generates bivariate Gaussian samples preserving the measured Spearman
/// rank correlation between hold and flight times. Spearman rho is converted
/// to Pearson via Kruskal (1958): r_pearson = 2 * sin(pi/6 * r_spearman).
fn make_copula_hold(
    hold_mean: f64,
    hold_std: f64,
    spearman_rho: f64,
) -> impl FnMut(&mut Rng) -> (f64, f64) {
    let copula_pearson = 2.0 * (std::f64::consts::FRAC_PI_6 * spearman_rho).sin();
    move |rng: &mut Rng| {
        if spearman_rho.abs() < 0.01 {
            let hold = rng.gaussian(hold_mean, hold_std).clamp(40.0, 200.0);
            return (hold, 1.0);
        }
        let z1 = rng.gaussian(0.0, 1.0);
        let z2 = rng.gaussian(0.0, 1.0);
        let u2 = copula_pearson.mul_add(z1, (1.0 - copula_pearson * copula_pearson).max(0.01).sqrt() * z2);
        let hold = (hold_mean + hold_std * z1).clamp(40.0, 200.0);
        let flight_factor = 1.0 + 0.2 * u2; // modest modulation
        (hold, flight_factor)
    }
}

// ─── PPM Text Generation (Prediction by Partial Matching) ───────
//
// Variable-order Markov model using PPM Method C (Cleary & Witten 1984,
// Moffat 1990). Adaptively selects the longest context with predictive
// power for each position, rather than fixed order-2.
//
// The PPM trie stores word-level contexts up to max_depth. At generation
// time, the longest matching context is tried first. On escape (novel
// continuation), the model backs off to shorter contexts until order-0
// (unigram) or uniform distribution.

/// Mutable PPM node used during trie construction. Converted to
/// `FrozenPpmNode` after building for deterministic sampling.
struct PpmNodeBuilder {
    children: HashMap<String, PpmNodeBuilder>,
    counts: HashMap<String, u32>,
    total: u32,
}

impl PpmNodeBuilder {
    fn new() -> Self {
        Self {
            children: HashMap::new(),
            counts: HashMap::new(),
            total: 0,
        }
    }

    /// Recursively freeze into sorted form for deterministic iteration.
    fn freeze(self) -> FrozenPpmNode {
        let mut children: Vec<(String, FrozenPpmNode)> = self.children
            .into_iter()
            .map(|(k, v)| (k, v.freeze()))
            .collect();
        children.sort_by(|(a, _), (b, _)| a.cmp(b));

        let mut counts: Vec<(String, u32)> = self.counts.into_iter().collect();
        counts.sort_by(|(a, _), (b, _)| a.cmp(b));

        FrozenPpmNode {
            children,
            counts,
            total: self.total,
        }
    }
}

/// Immutable PPM node with sorted children and counts for deterministic sampling.
struct FrozenPpmNode {
    children: Vec<(String, FrozenPpmNode)>,
    counts: Vec<(String, u32)>,
    total: u32,
}

struct PpmTrie {
    root: FrozenPpmNode,
    max_depth: usize,
    /// Sorted by key for deterministic fallback sampling.
    unigram_probs: Vec<(String, f64)>,
    vocab_size: usize,
    /// Sorted by key for deterministic starter selection.
    starters: Vec<(String, u32)>,
    total_starters: u32,
}

/// Build a PPM (Prediction by Partial Matching) trie from the corpus.
///
/// Constructs a variable-order Markov model up to `max_depth` using
/// PPM Method C (Cleary & Witten 1984, Moffat 1990). The trie is built
/// with mutable `PpmNodeBuilder` nodes, then frozen into sorted
/// `FrozenPpmNode`s for deterministic sampling.
fn build_ppm_trie(texts: &[String], max_depth: usize) -> PpmTrie {
    let mut root = PpmNodeBuilder::new();
    let mut unigram_counts: HashMap<String, u32> = HashMap::new();
    let mut total_words: u32 = 0;
    let mut starters: HashMap<String, u32> = HashMap::new();

    for text in texts {
        let tokens = tokenize(text);
        if tokens.is_empty() {
            continue;
        }

        // Record sentence starters
        *starters.entry(tokens[0].clone()).or_default() += 1;
        for i in 1..tokens.len() {
            if i > 0 && matches!(tokens[i - 1].as_str(), "." | "!" | "?") {
                *starters.entry(tokens[i].clone()).or_default() += 1;
            }
        }

        for i in 0..tokens.len() {
            let next = &tokens[i];
            *unigram_counts.entry(next.clone()).or_default() += 1;
            total_words += 1;

            // Insert contexts of all lengths from 1 to max_depth
            for depth in 1..=max_depth.min(i + 1) {
                let ctx_start = i.saturating_sub(depth);
                let ctx_tokens = &tokens[ctx_start..i];

                // Navigate to the correct node
                let mut node = &mut root;
                for tok in ctx_tokens {
                    node = node.children.entry(tok.clone()).or_insert_with(PpmNodeBuilder::new);
                }
                *node.counts.entry(next.clone()).or_default() += 1;
                node.total += 1;
            }
        }
    }

    let vocab_size = unigram_counts.len();
    let total_f = total_words.max(1) as f64;
    let mut unigram_probs: Vec<(String, f64)> = unigram_counts
        .into_iter()
        .map(|(w, c)| (w, c as f64 / total_f))
        .collect();
    unigram_probs.sort_by(|(a, _), (b, _)| a.cmp(b));

    let mut starter_vec: Vec<(String, u32)> = starters.into_iter().collect();
    starter_vec.sort_by(|(a, _), (b, _)| a.cmp(b));
    let total_starters: u32 = starter_vec.iter().map(|(_, c)| *c).sum();

    // Freeze the mutable trie into sorted form for deterministic sampling
    PpmTrie {
        root: root.freeze(),
        max_depth,
        unigram_probs,
        vocab_size,
        starters: starter_vec,
        total_starters,
    }
}

/// PPM Method C: P(escape|context) = unique_successors / (unique_successors + total)
/// Returns the probability mass after escape for backoff.
fn ppm_sample(trie: &PpmTrie, context: &[String], rng: &mut Rng) -> String {
    // Try longest matching context first, backoff on escape
    for depth in (1..=trie.max_depth.min(context.len())).rev() {
        let ctx_start = context.len().saturating_sub(depth);
        let ctx = &context[ctx_start..];

        // Navigate to the node for this context (sorted vec binary search)
        let mut node = &trie.root;
        let mut found = true;
        for tok in ctx {
            match sorted_vec_get(&node.children, tok) {
                Some(child) => node = child,
                None => {
                    found = false;
                    break;
                }
            }
        }

        if !found || node.total == 0 {
            continue;
        }

        let unique = node.counts.len() as f64;
        let total = node.total as f64;
        // PPM-C escape probability
        let p_escape = unique / (unique + total);

        if rng.f64() < p_escape {
            continue; // escape to shorter context
        }

        // Sample from this context's distribution
        let r = rng.f64() * total;
        let mut cumulative = 0.0;
        for (word, count) in &node.counts {
            cumulative += *count as f64;
            if r < cumulative {
                return word.clone();
            }
        }
        // Shouldn't reach here, but safety fallback
        if let Some((word, _)) = node.counts.first() {
            return word.clone();
        }
    }

    // Order-0 fallback: sample from unigram distribution
    if !trie.unigram_probs.is_empty() {
        let r = rng.f64();
        let mut cumulative = 0.0;
        for (word, prob) in &trie.unigram_probs {
            cumulative += prob;
            if r < cumulative {
                return word.clone();
            }
        }
    }

    // Absolute fallback
    String::from("the")
}

/// Generate text using the PPM trie for variable-order context matching.
///
/// Similar to `generate_text` but uses PPM-C escape-based backoff instead
/// of fixed-order Markov with Witten-Bell interpolation. Produces more
/// varied text when the corpus is large enough to support deeper contexts.
fn generate_text_ppm(trie: &PpmTrie, seed: &str, max_words: usize, rng: &mut Rng) -> String {
    let seed_lower = seed.to_lowercase();
    let seed_tokens: Vec<String> = tokenize(&seed_lower);

    // Try to find a starter containing the seed
    let mut current_context: Vec<String> = Vec::new();
    let mut found_seed = false;

    for token in &seed_tokens {
        for (starter, _) in &trie.starters {
            if starter.contains(token.as_str()) {
                current_context.push(starter.clone());
                found_seed = true;
                break;
            }
        }
        if found_seed {
            break;
        }
    }

    if !found_seed && trie.total_starters > 0 {
        // Random starter
        if let Some(starter) = weighted_pick(&trie.starters, rng) {
            current_context.push(starter);
        }
    }

    let mut output = current_context.clone();
    let target = max_words.max(5);

    for _ in output.len()..target {
        let next = ppm_sample(trie, &current_context, rng);

        output.push(next.clone());
        current_context.push(next.clone());
        if current_context.len() > trie.max_depth {
            current_context.remove(0);
        }

        // Sentence boundaries: capitalize next word
        if matches!(next.as_str(), "." | "!" | "?")
            && trie.total_starters > 0
            && let Some(starter) = weighted_pick(&trie.starters, rng)
        {
            output.push(starter.clone());
            current_context.push(starter);
            if current_context.len() > trie.max_depth {
                current_context.remove(0);
            }
        }
    }

    // Reassemble with spacing
    let mut result = String::new();
    for (i, token) in output.iter().enumerate() {
        if i > 0
            && !matches!(token.as_str(), "." | "," | "!" | "?" | ";" | ":" | "'" | "\"")
            && let Some(prev) = output.get(i - 1)
            && !matches!(prev.as_str(), "'" | "\"")
        {
            result.push(' ');
        }
        if i == 0 {
            // Capitalize first word
            let mut chars = token.chars();
            if let Some(first) = chars.next() {
                result.push(first.to_uppercase().next().unwrap_or(first));
                result.extend(chars);
            }
        } else {
            result.push_str(token);
        }
    }

    result
}

/// Compute perplexity of text under the PPM model.
#[cfg(test)]
fn compute_ppm_perplexity(trie: &PpmTrie, text: &str) -> SignalResult<PerplexityResult> {
    let tokens = tokenize(text);
    if tokens.len() < 2 {
        return Err(SignalError::InsufficientData {
            needed: 2,
            got: tokens.len(),
        });
    }

    let mut log_prob_sum: f64 = 0.0;
    let mut known: usize = 0;
    let mut unknown: usize = 0;
    let vocab = trie.vocab_size.max(1) as f64;

    for i in 0..tokens.len() {
        let next = &tokens[i];
        let mut found_context = false;

        // Try longest matching context first
        for depth in (1..=trie.max_depth.min(i)).rev() {
            let ctx_start = i.saturating_sub(depth);
            let ctx = &tokens[ctx_start..i];

            let mut node = &trie.root;
            let mut valid = true;
            for tok in ctx {
                match sorted_vec_get(&node.children, tok) {
                    Some(child) => node = child,
                    None => {
                        valid = false;
                        break;
                    }
                }
            }

            if !valid || node.total == 0 {
                continue;
            }

            let unique = node.counts.len() as f64;
            let total = node.total as f64;
            let p_escape = unique / (unique + total);

            if let Some(count) = sorted_vec_get(&node.counts, next) {
                // Non-escape probability * word probability within context
                let prob = (1.0 - p_escape) * (*count as f64 / total);
                log_prob_sum += prob.max(1e-20).log2();
                known += 1;
                found_context = true;
                break;
            }
            // Word not in this context, escape to shorter
        }

        if !found_context {
            // Unigram fallback
            let prob = sorted_vec_get(&trie.unigram_probs, next).copied().unwrap_or(1.0 / vocab);
            log_prob_sum += prob.max(1e-20).log2();
            unknown += 1;
        }
    }

    let n = (known + unknown).max(1) as f64;
    let avg_log_prob = log_prob_sum / n;
    let perplexity = (-avg_log_prob).exp2();

    Ok(PerplexityResult {
        perplexity,
        word_count: known + unknown,
        known_transitions: known,
        unknown_transitions: unknown,
    })
}

// ─── Perplexity ─────────────────────────────────────────────────

/// Compute the per-word log2 perplexity of `text` under the Markov chain
/// built from `corpus_texts`. Lower perplexity = the model predicts the
/// text better = the corpus has converged on the person's language.
///
/// Uses Absolute Discounting (Chen & Goodman 1999) instead of Laplace
/// smoothing. Laplace over-smooths small-vocabulary personal corpora by
/// assigning too much mass to impossible transitions. Absolute Discounting
/// subtracts a fixed discount d from observed counts and redistributes
/// the freed mass via a unigram backoff, producing tighter estimates.
fn compute_perplexity(chain: &MarkovChain, text: &str) -> SignalResult<PerplexityResult> {
    let tokens = tokenize(text);
    if tokens.len() < chain.order + 1 {
        return Err(SignalError::InsufficientData {
            needed: chain.order + 1,
            got: tokens.len(),
        });
    }

    let mut log_prob_sum: f64 = 0.0;
    let mut known: usize = 0;
    let mut unknown: usize = 0;
    let d = chain.discount;
    let vocab = chain.vocab_size.max(1) as f64;

    for i in chain.order..tokens.len() {
        let key = tokens[i - chain.order..i].join(" ");
        let next = &tokens[i];

        if let Some(dist) = sorted_vec_get(&chain.transitions, &key) {
            let total: f64 = dist.iter().map(|(_, c)| *c as f64).sum();
            let count = dist
                .iter()
                .find(|(w, _)| w == next)
                .map(|(_, c)| *c as f64)
                .unwrap_or(0.0);
            // Number of unique successors for this context
            let unique_successors = dist.len() as f64;
            // Interpolation weight for backoff: lambda = d * N1+(h) / c(h)
            let lambda = (d * unique_successors) / total.max(1.0);
            // Unigram backoff probability for the next word
            let p_backoff = sorted_vec_get(&chain.unigram_probs, next).copied().unwrap_or(1.0 / vocab);

            if count > 0.0 {
                // P(w|h) = max(c(h,w) - d, 0) / c(h) + lambda * P_bo(w)
                let prob = (count - d).max(0.0) / total + lambda * p_backoff;
                log_prob_sum += prob.max(1e-20).log2();
                known += 1;
            } else {
                // Transition unseen in this context: all mass from backoff
                let prob = lambda * p_backoff;
                log_prob_sum += prob.max(1e-20).log2();
                unknown += 1;
            }
        } else {
            // Context not in chain: fall through to unigram
            let prob = sorted_vec_get(&chain.unigram_probs, next).copied().unwrap_or(1.0 / vocab);
            log_prob_sum += prob.max(1e-20).log2();
            unknown += 1;
        }
    }

    let n = (known + unknown).max(1) as f64;
    // Perplexity = 2^(-avg_log2_prob)
    let avg_log_prob = log_prob_sum / n;
    let perplexity = (-avg_log_prob).exp2();

    Ok(PerplexityResult {
        perplexity,
        word_count: known + unknown,
        known_transitions: known,
        unknown_transitions: unknown,
    })
}

// ─── Public API ─────────────────────────────────────────────────

#[cfg(test)]
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
        rburst_mean_size: None,
        rburst_leading_edge_pct: None,
        rburst_consolidation: None,
        rburst_mean_duration: None,
        iki_autocorrelation_lag1: None,
        hold_flight_rank_correlation: None,
        hold_time_mean: None,
        hold_time_std: None,
        flight_time_mean: None,
        flight_time_std: None,
    }
}

/// Result of `compute()`: the avatar output plus the PRNG seed used.
/// The seed is needed for reproducibility -- store it to regenerate the same ghost.
#[derive(Debug)]
pub(crate) struct SeededAvatarResult {
    pub(crate) result: AvatarResult,
    pub(crate) seed: u64,
}

pub(crate) fn compute(
    corpus_json: &str,
    topic: &str,
    profile_json: &str,
    max_words: usize,
    variant: AdversaryVariant,
) -> SignalResult<SeededAvatarResult> {
    // Production path: time-based seed for variety across calls.
    let seed_val = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(42);
    let result = compute_seeded(corpus_json, topic, profile_json, max_words, variant, seed_val)?;
    Ok(SeededAvatarResult { result, seed: seed_val })
}

/// Core generation pipeline, separated from `compute` to allow deterministic
/// seeding in tests. All randomness flows from the single `seed` value.
/// Given identical inputs and seed, output must be identical across runs.
pub(crate) fn compute_seeded(
    corpus_json: &str,
    topic: &str,
    profile_json: &str,
    max_words: usize,
    variant: AdversaryVariant,
    seed: u64,
) -> SignalResult<AvatarResult> {
    // Parse inputs -- propagate errors instead of silently defaulting.
    let texts: Vec<String> = serde_json::from_str(corpus_json)
        .map_err(|e| SignalError::ParseError(format!("corpus JSON: {e}")))?;
    let profile: TimingProfile = serde_json::from_str(profile_json)
        .map_err(|e| SignalError::ParseError(format!("profile JSON: {e}")))?;

    if texts.is_empty() {
        return Err(SignalError::InsufficientData { needed: 1, got: 0 });
    }

    let mut rng = Rng::from_seed(seed);

    // Choose order based on corpus size (used for Markov variants)
    let order = if texts.len() >= 10 { 2 } else { 1 };

    // Build word frequency map for content-process coupling (all variants)
    let word_freq = build_word_freq(&texts);

    // ── Text generation: Markov or PPM ──
    let (text, chain_size, effective_order) = if variant.uses_ppm() && texts.len() >= 5 {
        let max_depth = if texts.len() >= 20 { 5 } else { 3 };
        let trie = build_ppm_trie(&texts, max_depth);
        let chain_size = trie.vocab_size;
        let text = generate_text_ppm(&trie, topic, max_words, &mut rng);
        (text, chain_size, max_depth)
    } else {
        let chain = build_chain(&texts, order);
        let chain_size = chain.transitions.len();
        let text = generate_text(&chain, topic, max_words, &mut rng);
        (text, chain_size, order)
    };

    let word_count = text.split_whitespace().count();

    // ── Timing synthesis: construct IKI + hold samplers per variant ──
    let sigma = profile.sigma.unwrap_or(40.0);
    let tau = profile.tau.unwrap_or(80.0);
    let base_mu = profile.mu.unwrap_or(120.0);
    let hold_mean = profile.hold_time_mean.unwrap_or(95.0);
    let hold_std = profile.hold_time_std.unwrap_or(20.0);

    let mut iki_sampler: Box<IkiSampler> = if variant.uses_conditional_timing() {
        let phi = profile.iki_autocorrelation_lag1.unwrap_or(0.0).clamp(-0.99, 0.99);
        Box::new(make_ar1_iki(sigma, tau, phi, base_mu))
    } else {
        Box::new(make_independent_iki(sigma, tau))
    };

    let mut hold_sampler: Box<HoldSampler> = if variant.uses_copula() {
        let rho = profile.hold_flight_rank_correlation.unwrap_or(0.0);
        Box::new(make_copula_hold(hold_mean, hold_std, rho))
    } else {
        Box::new(make_fixed_hold(hold_mean, hold_std))
    };

    let timing = synthesize_timing(
        &text, &profile, &word_freq,
        &mut *iki_sampler, &mut *hold_sampler, &mut rng,
    );
    let mut delays = timing.delays;
    let mut keystrokes = timing.keystrokes;

    // Build a Markov chain for revision/I-burst text generation
    // (revisions need the chain even if PPM was used for primary text)
    let chain = build_chain(&texts, order);

    // Inject revision episodes (deletions + retypes) from the revision profile
    inject_revisions(&mut keystrokes, &mut delays, &profile, &chain, &mut rng);

    // Inject I-bursts (mid-text insertions) from the process profile
    let i_burst_count =
        inject_i_bursts(&mut keystrokes, &mut delays, &profile, &chain, &word_freq, &mut rng);

    Ok(AvatarResult {
        text,
        delays,
        keystroke_events: keystrokes,
        word_count,
        order: effective_order,
        chain_size,
        i_burst_count,
        variant: variant as u8,
    })
}

/// Compute perplexity of a new text against the corpus Markov model.
/// Used to track convergence: as the corpus grows, perplexity of real
/// journal responses should decrease.
pub(crate) fn compute_text_perplexity(
    corpus_json: &str,
    text: &str,
) -> SignalResult<PerplexityResult> {
    let texts: Vec<String> = serde_json::from_str(corpus_json)
        .map_err(|e| SignalError::ParseError(format!("corpus JSON: {e}")))?;
    if texts.is_empty() {
        return Err(SignalError::InsufficientData { needed: 1, got: 0 });
    }

    let order = if texts.len() >= 10 { 2 } else { 1 };
    let chain = build_chain(&texts, order);
    compute_perplexity(&chain, text)
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── Helper ──

    fn make_rng() -> Rng {
        Rng::from_seed(12345)
    }

    fn sample_corpus() -> Vec<String> {
        vec![
            "I think about the way things change over time.".into(),
            "The morning felt different today, like something shifted.".into(),
            "I keep returning to the same questions about meaning.".into(),
            "There is something about writing that reveals what I think.".into(),
            "The question made me pause and consider my assumptions.".into(),
        ]
    }

    // ── PRNG tests ──

    #[test]
    fn prng_f64_never_reaches_one() {
        let mut rng = make_rng();
        for _ in 0..100_000 {
            let v = rng.f64();
            assert!(v >= 0.0, "f64() returned negative: {v}");
            assert!(v < 1.0, "f64() reached 1.0: {v}");
        }
    }

    #[test]
    fn prng_gaussian_bounded_mean() {
        let mut rng = make_rng();
        let samples: Vec<f64> = (0..10_000).map(|_| rng.gaussian(100.0, 20.0)).collect();
        let mean = samples.iter().sum::<f64>() / samples.len() as f64;
        assert!(
            (mean - 100.0).abs() < 2.0,
            "Gaussian mean should be ~100, got {mean}"
        );
    }

    #[test]
    fn prng_ex_gaussian_floor() {
        let mut rng = make_rng();
        for _ in 0..10_000 {
            let v = rng.ex_gaussian(50.0, 10.0, 30.0);
            assert!(v >= 30.0, "ex-Gaussian below 30ms floor: {v}");
        }
    }

    // ── Tokenizer tests ──

    #[test]
    fn tokenize_basic() {
        let tokens = tokenize("Hello world.");
        assert_eq!(tokens, vec!["Hello", "world", "."]);
    }

    #[test]
    fn tokenize_punctuation_splits() {
        let tokens = tokenize("Wait, what? Yes!");
        assert_eq!(tokens, vec!["Wait", ",", "what", "?", "Yes", "!"]);
    }

    #[test]
    fn tokenize_preserves_contractions() {
        // Apostrophe is not in the punctuation split set
        let tokens = tokenize("I don't know");
        assert_eq!(tokens, vec!["I", "don't", "know"]);
    }

    #[test]
    fn tokenize_empty() {
        assert!(tokenize("").is_empty());
        assert!(tokenize("   ").is_empty());
    }

    // ── Chain building tests ──

    #[test]
    fn build_chain_order1_has_transitions() {
        let texts = sample_corpus();
        let chain = build_chain(&texts, 1);
        assert!(!chain.transitions.is_empty());
        assert!(!chain.starters.is_empty());
        assert_eq!(chain.order, 1);
    }

    #[test]
    fn build_chain_order2_has_backoff() {
        let texts = sample_corpus();
        let chain = build_chain(&texts, 2);
        assert!(chain.backoff.is_some(), "Order-2 chain must have backoff");
        assert_eq!(chain.order, 2);
    }

    #[test]
    fn build_chain_discount_in_range() {
        let texts = sample_corpus();
        let chain = build_chain(&texts, 1);
        assert!(
            chain.discount > 0.0 && chain.discount < 1.0,
            "Discount should be in (0, 1), got {}",
            chain.discount
        );
    }

    #[test]
    fn build_chain_unigram_probs_sum_to_one() {
        let texts = sample_corpus();
        let chain = build_chain(&texts, 1);
        let sum: f64 = chain.unigram_probs.iter().map(|(_, p)| p).sum();
        assert!(
            (sum - 1.0).abs() < 1e-6,
            "Unigram probs should sum to ~1.0, got {sum}"
        );
    }

    // ── Weighted pick tests ──

    #[test]
    fn weighted_pick_empty() {
        let mut rng = make_rng();
        assert!(weighted_pick(&[], &mut rng).is_none());
    }

    #[test]
    fn weighted_pick_single() {
        let mut rng = make_rng();
        let dist = vec![("only".to_string(), 1)];
        assert_eq!(weighted_pick(&dist, &mut rng).unwrap(), "only");
    }

    #[test]
    fn weighted_pick_respects_weights() {
        let mut rng = make_rng();
        let dist = vec![("heavy".to_string(), 9999), ("light".to_string(), 1)];
        let mut heavy_count = 0;
        for _ in 0..1000 {
            if weighted_pick(&dist, &mut rng).unwrap() == "heavy" {
                heavy_count += 1;
            }
        }
        assert!(heavy_count > 900, "Heavy item should dominate, got {heavy_count}/1000");
    }

    // ── Text generation tests ──

    #[test]
    fn generate_text_nonempty() {
        let texts = sample_corpus();
        let chain = build_chain(&texts, 1);
        let mut rng = make_rng();
        let text = generate_text(&chain, "morning", 20, &mut rng);
        assert!(!text.is_empty(), "Generated text should not be empty");
    }

    #[test]
    fn generate_text_respects_max_words_approximately() {
        let texts = sample_corpus();
        let chain = build_chain(&texts, 1);
        let mut rng = make_rng();
        let text = generate_text(&chain, "think", 10, &mut rng);
        let words = text.split_whitespace().count();
        // max_words is approximate (starter + up to max_words iterations)
        assert!(words <= 25, "Word count {words} far exceeds max_words=10");
    }

    #[test]
    fn generate_text_capitalizes_after_period() {
        let texts = sample_corpus();
        let chain = build_chain(&texts, 1);
        let mut rng = make_rng();
        let text = generate_text(&chain, "things", 50, &mut rng);
        // First character should be capitalized
        let first = text.chars().next().unwrap();
        assert!(first.is_uppercase(), "First char should be capitalized, got '{first}'");
    }

    #[test]
    fn generate_text_empty_chain() {
        let chain = build_chain(&[], 1);
        let mut rng = make_rng();
        let text = generate_text(&chain, "anything", 10, &mut rng);
        assert!(text.is_empty(), "Empty corpus should produce empty text");
    }

    // ── Word difficulty tests ──

    #[test]
    fn word_difficulty_common_words_fast() {
        let mut freq = HashMap::new();
        freq.insert("the".to_string(), 0.05);
        freq.insert("and".to_string(), 0.03);
        let mut rng = make_rng();
        let d = word_difficulty_multiplier("the", &freq, &mut rng);
        assert!(d < 1.0, "Very common word should have multiplier < 1.0, got {d}");
    }

    #[test]
    fn word_difficulty_rare_words_slow() {
        let mut freq = HashMap::new();
        freq.insert("ephemeral".to_string(), 0.0005);
        let mut rng = make_rng();
        let d = word_difficulty_multiplier("ephemeral", &freq, &mut rng);
        assert!(d > 1.0, "Rare word should have multiplier > 1.0, got {d}");
    }

    #[test]
    fn word_difficulty_unseen_high() {
        let freq = HashMap::new();
        let mut rng = make_rng();
        let d = word_difficulty_multiplier("xyzzy", &freq, &mut rng);
        assert!(d >= 1.8, "Unseen word should have multiplier >= 1.8, got {d}");
        assert!(d <= 2.3, "Unseen word should have multiplier <= 2.3, got {d}");
    }

    #[test]
    fn word_difficulty_monotonic() {
        // Higher frequency should mean lower difficulty
        let mut freq = HashMap::new();
        freq.insert("common".to_string(), 0.04);
        freq.insert("rare".to_string(), 0.001);
        let mut rng = make_rng();
        let d_common = word_difficulty_multiplier("common", &freq, &mut rng);
        let d_rare = word_difficulty_multiplier("rare", &freq, &mut rng);
        assert!(
            d_common < d_rare,
            "Common ({d_common}) should be easier than rare ({d_rare})"
        );
    }

    // ── Perplexity tests ──

    #[test]
    fn perplexity_known_text_lower() {
        let texts = sample_corpus();
        let chain = build_chain(&texts, 1);
        // Text from the corpus should have low perplexity
        let known = compute_perplexity(&chain, "I think about the way things change").unwrap();
        // Random text should have higher perplexity
        let unknown =
            compute_perplexity(&chain, "Purple elephants dance on quantum strings").unwrap();
        assert!(
            known.perplexity < unknown.perplexity,
            "Known text perplexity ({}) should be lower than unknown ({})",
            known.perplexity,
            unknown.perplexity
        );
    }

    #[test]
    fn perplexity_finite_for_nonempty() {
        let texts = sample_corpus();
        let chain = build_chain(&texts, 1);
        let result = compute_perplexity(&chain, "The morning felt different.").unwrap();
        assert!(
            result.perplexity.is_finite(),
            "Perplexity should be finite, got {}",
            result.perplexity
        );
    }

    #[test]
    fn perplexity_insufficient_data() {
        let texts = sample_corpus();
        let chain = build_chain(&texts, 2);
        // Fewer tokens than order+1 should return InsufficientData
        assert!(matches!(
            compute_perplexity(&chain, "Hi"),
            Err(SignalError::InsufficientData { .. })
        ));
    }

    #[test]
    fn perplexity_known_fraction_tracks() {
        let texts = sample_corpus();
        let chain = build_chain(&texts, 1);
        let result = compute_perplexity(&chain, "I think about the way things change").unwrap();
        assert!(
            result.known_transitions > 0,
            "Text from corpus should have known transitions"
        );
    }

    // ── Interpolated pick tests ──

    #[test]
    fn interpolated_pick_primary_only() {
        let mut rng = make_rng();
        let primary = vec![("word".to_string(), 10)];
        let result = interpolated_pick(Some(&primary), None, &mut rng);
        assert_eq!(result.unwrap(), "word");
    }

    #[test]
    fn interpolated_pick_backoff_only() {
        let mut rng = make_rng();
        let backoff = vec![("fallback".to_string(), 10)];
        let result = interpolated_pick(None, Some(&backoff), &mut rng);
        assert_eq!(result.unwrap(), "fallback");
    }

    #[test]
    fn interpolated_pick_both_produces_mix() {
        let mut rng = make_rng();
        let primary = vec![("hi".to_string(), 100)];
        let backoff = vec![("lo".to_string(), 100)];
        let mut hi_count = 0;
        let mut lo_count = 0;
        for _ in 0..1000 {
            match interpolated_pick(Some(&primary), Some(&backoff), &mut rng)
                .unwrap()
                .as_str()
            {
                "hi" => hi_count += 1,
                "lo" => lo_count += 1,
                _ => {}
            }
        }
        assert!(hi_count > 0, "Should sometimes pick from primary");
        assert!(lo_count > 0, "Should sometimes pick from backoff");
    }

    // ── Timing synthesis tests ──

    fn test_synthesize(text: &str, profile: &TimingProfile, word_freq: &HashMap<String, f64>, rng: &mut Rng) -> TimingOutput {
        let mut iki = make_independent_iki(
            profile.sigma.unwrap_or(40.0),
            profile.tau.unwrap_or(80.0),
        );
        let mut hold = make_fixed_hold(95.0, 20.0);
        synthesize_timing(text, profile, word_freq, &mut iki, &mut hold, rng)
    }

    #[test]
    fn timing_delays_all_positive() {
        let texts = sample_corpus();
        let word_freq = build_word_freq(&texts);
        let profile = default_profile();
        let mut rng = make_rng();
        let result = test_synthesize("Hello world, this is a test.", &profile, &word_freq, &mut rng);
        for (i, d) in result.delays.iter().enumerate() {
            assert!(*d > 0.0, "Delay at index {i} should be positive, got {d}");
        }
    }

    #[test]
    fn timing_keystrokes_monotonic_clock() {
        let texts = sample_corpus();
        let word_freq = build_word_freq(&texts);
        let profile = default_profile();
        let mut rng = make_rng();
        let result = test_synthesize("Some words to type out.", &profile, &word_freq, &mut rng);
        for i in 1..result.keystrokes.len() {
            assert!(
                result.keystrokes[i].key_down_ms >= result.keystrokes[i - 1].key_down_ms,
                "Clock should be monotonically increasing at index {i}"
            );
        }
    }

    #[test]
    fn timing_hold_within_bounds() {
        let texts = sample_corpus();
        let word_freq = build_word_freq(&texts);
        let profile = default_profile();
        let mut rng = make_rng();
        let result = test_synthesize("Testing hold times.", &profile, &word_freq, &mut rng);
        for (i, k) in result.keystrokes.iter().enumerate() {
            let hold = k.key_up_ms - k.key_down_ms;
            assert!(
                hold >= 40.0 && hold <= 200.0,
                "Hold time at index {i} should be in [40, 200], got {hold}"
            );
        }
    }

    // ── Full pipeline (compute) tests ──

    #[test]
    fn compute_produces_output() {
        let corpus = serde_json::to_string(&sample_corpus()).unwrap();
        let profile = "{}";
        let seeded = compute(&corpus, "morning", profile, 20, AdversaryVariant::Baseline).unwrap();
        assert!(!seeded.seed.to_string().is_empty(), "Should have a seed");
        let result = seeded.result;
        assert!(!result.text.is_empty(), "Should produce text");
        assert!(!result.delays.is_empty(), "Should produce delays");
        assert!(!result.keystroke_events.is_empty(), "Should produce keystroke events");
        assert!(result.word_count > 0, "Should have words");
    }

    #[test]
    fn compute_empty_corpus_insufficient_data() {
        assert!(matches!(
            compute("[]", "anything", "{}", 20, AdversaryVariant::Baseline),
            Err(SignalError::InsufficientData { needed: 1, got: 0 })
        ));
    }

    #[test]
    fn compute_with_revision_profile() {
        let corpus = serde_json::to_string(&sample_corpus()).unwrap();
        let profile = r#"{"small_del_rate": 2.0, "large_del_rate": 1.0, "revision_timing_bias": 0.6}"#;
        let result = compute(&corpus, "think", profile, 30, AdversaryVariant::Baseline).unwrap().result;
        // With revisions, keystrokes should include backspace characters
        let has_backspace = result.keystroke_events.iter().any(|k| k.character == '\u{0008}');
        assert!(has_backspace, "Revision profile should inject backspace events");
    }

    #[test]
    fn compute_keystroke_stream_has_wire_format() {
        let corpus = serde_json::to_string(&sample_corpus()).unwrap();
        let result = compute(&corpus, "time", "{}", 10, AdversaryVariant::Baseline).unwrap().result;
        // Every keystroke event should have valid character, key_down, key_up
        for (i, k) in result.keystroke_events.iter().enumerate() {
            assert!(
                k.key_up_ms > k.key_down_ms,
                "Keystroke {i}: key_up ({}) must be > key_down ({})",
                k.key_up_ms,
                k.key_down_ms
            );
        }
    }

    // ── Extract word spans ──

    #[test]
    fn extract_word_spans_basic() {
        let spans = extract_word_spans("hello world");
        assert_eq!(spans.len(), 2);
        assert_eq!(spans[0].2, "hello");
        assert_eq!(spans[1].2, "world");
    }

    #[test]
    fn extract_word_spans_with_punctuation() {
        let spans = extract_word_spans("wait, what?");
        assert_eq!(spans.len(), 2);
        assert_eq!(spans[0].2, "wait");
        assert_eq!(spans[1].2, "what");
    }

    // ── Absolute Discounting properties ──

    #[test]
    fn perplexity_abs_discount_lower_than_uniform() {
        let texts = sample_corpus();
        let chain = build_chain(&texts, 1);
        let result = compute_perplexity(&chain, "I think about the way things").unwrap();
        let uniform_ppl = chain.vocab_size as f64; // uniform distribution perplexity = vocab size
        assert!(
            result.perplexity < uniform_ppl,
            "Model perplexity ({}) should beat uniform ({})",
            result.perplexity,
            uniform_ppl
        );
    }

    // ── Adversary variant tests ──

    #[test]
    fn variant_from_i32_roundtrip() {
        assert_eq!(AdversaryVariant::from_i32(1) as u8, 1);
        assert_eq!(AdversaryVariant::from_i32(2) as u8, 2);
        assert_eq!(AdversaryVariant::from_i32(3) as u8, 3);
        assert_eq!(AdversaryVariant::from_i32(4) as u8, 4);
        assert_eq!(AdversaryVariant::from_i32(5) as u8, 5);
        assert_eq!(AdversaryVariant::from_i32(99) as u8, 1); // unknown -> baseline
    }

    #[test]
    fn compute_conditional_timing_produces_output() {
        let corpus = serde_json::to_string(&sample_corpus()).unwrap();
        let profile = r#"{"iki_autocorrelation_lag1": 0.4}"#;
        let result = compute(&corpus, "morning", profile, 20, AdversaryVariant::ConditionalTiming).unwrap().result;
        assert!(!result.text.is_empty());
        assert_eq!(result.variant, 2);
    }

    #[test]
    fn compute_copula_motor_produces_output() {
        let corpus = serde_json::to_string(&sample_corpus()).unwrap();
        let profile = r#"{"hold_flight_rank_correlation": 0.3, "hold_time_mean": 90.0, "hold_time_std": 18.0}"#;
        let result = compute(&corpus, "morning", profile, 20, AdversaryVariant::CopulaMotor).unwrap().result;
        assert!(!result.text.is_empty());
        assert_eq!(result.variant, 3);
    }

    #[test]
    fn compute_ppm_text_produces_output() {
        let corpus = serde_json::to_string(&sample_corpus()).unwrap();
        let result = compute(&corpus, "morning", "{}", 20, AdversaryVariant::PpmText).unwrap().result;
        assert!(!result.text.is_empty());
        assert_eq!(result.variant, 4);
    }

    #[test]
    fn compute_full_adversary_produces_output() {
        let corpus = serde_json::to_string(&sample_corpus()).unwrap();
        let profile = r#"{"iki_autocorrelation_lag1": 0.3, "hold_flight_rank_correlation": 0.2, "hold_time_mean": 95.0, "hold_time_std": 20.0}"#;
        let result = compute(&corpus, "morning", profile, 20, AdversaryVariant::FullAdversary).unwrap().result;
        assert!(!result.text.is_empty());
        assert_eq!(result.variant, 5);
    }

    #[test]
    fn all_variants_produce_valid_keystrokes() {
        let corpus = serde_json::to_string(&sample_corpus()).unwrap();
        let profile = r#"{"iki_autocorrelation_lag1": 0.3, "hold_flight_rank_correlation": 0.2, "hold_time_mean": 95.0, "hold_time_std": 20.0}"#;
        for v in [
            AdversaryVariant::Baseline,
            AdversaryVariant::ConditionalTiming,
            AdversaryVariant::CopulaMotor,
            AdversaryVariant::PpmText,
            AdversaryVariant::FullAdversary,
        ] {
            let result = compute(&corpus, "morning", profile, 15, v).unwrap().result;
            for (i, k) in result.keystroke_events.iter().enumerate() {
                assert!(
                    k.key_up_ms >= k.key_down_ms,
                    "Variant {:?} keystroke {i}: key_up ({}) < key_down ({})",
                    v,
                    k.key_up_ms,
                    k.key_down_ms
                );
            }
        }
    }

    #[test]
    fn ppm_trie_builds_correctly() {
        let texts = sample_corpus();
        let trie = build_ppm_trie(&texts, 3);
        assert!(trie.vocab_size > 0);
        assert!(!trie.starters.is_empty());
        assert!(trie.total_starters > 0);
    }

    #[test]
    fn ppm_perplexity_computable() {
        let texts = sample_corpus();
        let trie = build_ppm_trie(&texts, 3);
        let result = compute_ppm_perplexity(&trie, "I think about what matters").unwrap();
        assert!(result.perplexity > 0.0);
        assert!(result.perplexity.is_finite());
    }

    // ── Determinism tests ──
    //
    // Same seed + same corpus must produce identical output across runs.
    // If HashMap iteration order leaks into sampling, these fail.

    #[test]
    fn determinism_baseline_same_seed_same_output() {
        let corpus = serde_json::to_string(&sample_corpus()).unwrap();
        let seed = 99999u64;
        let a = compute_seeded(&corpus, "morning", "{}", 20, AdversaryVariant::Baseline, seed).unwrap();
        let b = compute_seeded(&corpus, "morning", "{}", 20, AdversaryVariant::Baseline, seed).unwrap();
        assert_eq!(a.text, b.text, "Same seed should produce identical text");
        assert_eq!(a.delays.len(), b.delays.len(), "Same seed should produce same delay count");
        for (i, (da, db)) in a.delays.iter().zip(b.delays.iter()).enumerate() {
            assert!(
                (da - db).abs() < 1e-10,
                "Delay mismatch at index {i}: {da} vs {db}"
            );
        }
    }

    #[test]
    fn determinism_ppm_same_seed_same_output() {
        let corpus = serde_json::to_string(&sample_corpus()).unwrap();
        let seed = 77777u64;
        let a = compute_seeded(&corpus, "think", "{}", 20, AdversaryVariant::PpmText, seed).unwrap();
        let b = compute_seeded(&corpus, "think", "{}", 20, AdversaryVariant::PpmText, seed).unwrap();
        assert_eq!(a.text, b.text, "PPM: same seed should produce identical text");
        assert_eq!(a.delays.len(), b.delays.len());
    }

    #[test]
    fn determinism_full_adversary_same_seed_same_output() {
        let corpus = serde_json::to_string(&sample_corpus()).unwrap();
        let profile = r#"{"iki_autocorrelation_lag1": 0.3, "hold_flight_rank_correlation": 0.2, "hold_time_mean": 95.0, "hold_time_std": 20.0, "small_del_rate": 1.5, "large_del_rate": 0.8}"#;
        let seed = 55555u64;
        let a = compute_seeded(&corpus, "change", profile, 20, AdversaryVariant::FullAdversary, seed).unwrap();
        let b = compute_seeded(&corpus, "change", profile, 20, AdversaryVariant::FullAdversary, seed).unwrap();
        assert_eq!(a.text, b.text, "FullAdversary: same seed should produce identical text");
        assert_eq!(a.delays.len(), b.delays.len());
        assert_eq!(a.i_burst_count, b.i_burst_count, "I-burst count should be deterministic");
    }

    #[test]
    fn determinism_different_seeds_differ() {
        let corpus = serde_json::to_string(&sample_corpus()).unwrap();
        let a = compute_seeded(&corpus, "morning", "{}", 20, AdversaryVariant::Baseline, 11111).unwrap();
        let b = compute_seeded(&corpus, "morning", "{}", 20, AdversaryVariant::Baseline, 22222).unwrap();
        // Different seeds should (almost certainly) produce different text
        assert_ne!(a.text, b.text, "Different seeds should produce different text");
    }

    // ── JSON parse error tests ──

    #[test]
    fn compute_invalid_corpus_json_returns_error() {
        let result = compute_seeded("not json", "topic", "{}", 20, AdversaryVariant::Baseline, 1);
        assert!(
            matches!(result, Err(SignalError::ParseError(_))),
            "Invalid corpus JSON should return ParseError, got {:?}",
            result.err()
        );
    }

    #[test]
    fn compute_invalid_profile_json_returns_error() {
        let corpus = serde_json::to_string(&sample_corpus()).unwrap();
        let result = compute_seeded(&corpus, "topic", "not json", 20, AdversaryVariant::Baseline, 1);
        assert!(
            matches!(result, Err(SignalError::ParseError(_))),
            "Invalid profile JSON should return ParseError, got {:?}",
            result.err()
        );
    }
}
