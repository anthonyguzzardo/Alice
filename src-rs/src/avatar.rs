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
}

pub(crate) struct AvatarResult {
    /// Generated text
    pub(crate) text: String,
    /// Per-character delay in ms (length = text.len() in chars)
    pub(crate) delays: Vec<f64>,
    /// Number of words in generated text
    pub(crate) word_count: usize,
    /// Markov order used
    pub(crate) order: usize,
    /// Number of unique states in the chain
    pub(crate) chain_size: usize,
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

struct MarkovChain {
    /// state -> [(next_word, count)]
    transitions: HashMap<String, Vec<(String, u32)>>,
    /// sentence starters with counts
    starters: Vec<(String, u32)>,
    total_starters: u32,
    order: usize,
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

    for text in texts {
        let tokens = tokenize(text);
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

    MarkovChain {
        transitions,
        starters,
        total_starters,
        order,
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

        if let Some(dist) = chain.transitions.get(&key) {
            if let Some(next) = weighted_pick(dist, rng) {
                tokens.push(next);
                continue;
            }
        }
        // Dead end: jump to random starter
        if let Some(restart) = weighted_pick(&chain.starters, rng) {
            for t in restart.split(' ') {
                tokens.push(t.to_string());
            }
        } else {
            break;
        }
    }

    // Reassemble: attach punctuation to preceding word
    let mut result = String::new();
    for t in &tokens {
        if t.len() == 1 && ".!?,;:".contains(t.as_str()) {
            result.push_str(t);
        } else {
            if !result.is_empty() {
                result.push(' ');
            }
            result.push_str(t);
        }
    }
    result
}

// ─── Timing synthesis ───────────────────────────────────────────

fn synthesize_timing(text: &str, profile: &TimingProfile, rng: &mut Rng) -> Vec<f64> {
    let chars: Vec<char> = text.chars().collect();
    let mut delays = Vec::with_capacity(chars.len());

    let mu = profile.mu.unwrap_or(120.0);
    let sigma = profile.sigma.unwrap_or(40.0);
    let tau = profile.tau.unwrap_or(80.0);
    let burst_length = profile.burst_length.unwrap_or(150.0) as usize;
    let pause_sent_pct = profile.pause_sent_pct.unwrap_or(0.07);

    let mut chars_since_burst: usize = 0;

    // First character: first keystroke latency
    let fk = profile.first_keystroke.unwrap_or(3000.0);
    delays.push(fk * (0.7 + rng.f64() * 0.6));

    for i in 1..chars.len() {
        let prev = chars[i - 1];
        let curr = chars[i];
        chars_since_burst += 1;

        // P-burst pause: after ~burst_length chars at a word boundary
        if chars_since_burst >= burst_length && prev == ' ' {
            chars_since_burst = 0;
            delays.push(2000.0 + rng.f64() * 2000.0);
            continue;
        }

        // Sentence boundary pause
        if matches!(prev, '.' | '!' | '?') && curr == ' ' {
            if rng.f64() < pause_sent_pct.min(1.0) * 3.5 {
                delays.push(800.0 + rng.f64() * 2200.0);
                continue;
            }
        }

        // Word boundary pause
        if prev == ' ' && rng.f64() < 0.08 {
            delays.push(300.0 + rng.f64() * 900.0);
            continue;
        }

        // Digraph-specific timing
        if let Some(ref digraph) = profile.digraph {
            let bigram = format!("{}{}", prev, curr);
            if let Some(&latency) = digraph.get(&bigram) {
                delays.push((latency + (rng.f64() - 0.5) * 40.0).max(30.0));
                continue;
            }
        }

        // Fallback: ex-Gaussian sample
        delays.push(rng.ex_gaussian(mu, sigma, tau));
    }

    delays
}

// ─── Public API ─────────────────────────────────────────────────

pub(crate) fn compute(
    corpus_json: &str,
    topic: &str,
    profile_json: &str,
    max_words: usize,
) -> AvatarResult {
    // Parse inputs
    let texts: Vec<String> = serde_json::from_str(corpus_json).unwrap_or_default();
    let profile: TimingProfile = serde_json::from_str(profile_json).unwrap_or(TimingProfile {
        digraph: None,
        mu: None,
        sigma: None,
        tau: None,
        burst_length: None,
        pause_between_pct: None,
        pause_sent_pct: None,
        first_keystroke: None,
    });

    if texts.is_empty() {
        return AvatarResult {
            text: String::new(),
            delays: Vec::new(),
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

    // Synthesize timing
    let delays = synthesize_timing(&text, &profile, &mut rng);

    AvatarResult {
        text,
        delays,
        word_count,
        order,
        chain_size,
    }
}
