# Theory Selection: From Prompt Guidance to Programmatic Control

## The Problem

When the full theory table is injected into the LLM predict call with text-based distribution guidance ("stop testing below 0.2, spread across theories"), the model fixates on 2-3 theories and hammers them despite continuous falsification. This works on smaller models (Haiku) but over-corrects on larger ones (Sonnet).

The root cause is not a prompting failure — it is an architectural mismatch. Prompt-based behavioral constraints degrade multiplicatively with complexity and interact unpredictably with model capability.

## The Fix

Move theory selection from the prompt into deterministic code. The LLM generates predictions for pre-selected theories; it no longer decides which theories to test.

Three mechanisms:

1. **Thompson Sampling** — posterior sampling for exploration/exploitation
2. **Bayes Factor Lifecycle** — principled pruning and graduation thresholds
3. **Expected Information Gain** — entropy-based selection ranking (for logging)

## Architecture

```
                    ┌─────────────────────┐
                    │  tb_theory_confidence │
                    │  (alpha, beta, logBF, │
                    │   status)             │
                    └──────────┬────────────┘
                               │
                    ┌──────────▼────────────┐
                    │  Bayes Factor Lifecycle │
                    │  active / established  │
                    │  / retired             │
                    └──────────┬────────────┘
                               │ filter: active only
                    ┌──────────▼────────────┐
                    │  Thompson Sampling     │
                    │  Beta(alpha, beta)     │
                    │  → top-3 by sample     │
                    └──────────┬────────────┘
                               │ 2-3 theories
                    ┌──────────▼────────────┐
                    │  LLM Predict Call      │
                    │  "generate predictions │
                    │   for THESE theories"  │
                    └──────────┬────────────┘
                               │ predictions graded
                    ┌──────────▼────────────┐
                    │  Update alpha/beta,    │
                    │  logBF, status         │
                    └───────────────────────┘
```

## Research Basis

### Why Prompt-Based Control Fails

| Paper | Institution | Finding |
|-------|------------|---------|
| Sharma, Perez et al. "Towards Understanding Sycophancy in Language Models" (ICLR 2024, arXiv 2310.13548) | Anthropic | RLHF-trained models systematically shift outputs toward what the prompt implies is desirable. Theory prominence in the table creates a feedback loop. |
| Ahn et al. "Anchoring Bias in Large Language Models" (arXiv 2412.06593) | IEEE 2025 | LLMs exhibit anchoring effects from prior context. Conventional mitigations (CoT, reflection) don't eliminate it. |
| "Curse of Instructions" (OpenReview) | — | Instruction-following success drops as p^N where N = number of constraints. Multi-constraint distribution guidance degrades unpredictably. |
| Greenblatt et al. "Alignment Faking in Large Language Models" (arXiv 2412.14093) | Anthropic / Redwood Research | Models can develop strategic reasoning about their training signal, potentially entrenching behaviors that resist correction. |
| Xiong et al. "Can LLMs Express Their Uncertainty?" (ICLR 2024, arXiv 2306.13063) | — | LLMs are systematically overconfident when verbalizing confidence, with ECE > 0.377. |

### Thompson Sampling

| Paper | Institution | Relevance |
|-------|------------|-----------|
| Thompson (1933) "On the Likelihood that One Unknown Probability Exceeds Another" (*Biometrika*) | — | Original posterior sampling for multi-armed bandits. |
| Agrawal & Goyal (COLT 2012) "Analysis of Thompson Sampling for the Multi-Armed Bandit Problem" | Columbia | First proof of logarithmic expected regret. Provably optimal exploration-exploitation. |
| Russo & Van Roy (NeurIPS 2014, *Operations Research* 2018) "Learning to Optimize via Information-Directed Sampling" | Stanford | IDS outperforms both UCB and Thompson in heterogeneous noise settings. |

### Bayesian Experimental Design

| Paper | Institution | Relevance |
|-------|------------|-----------|
| Lindley (1956) "On a Measure of the Information Provided by an Experiment" (*Annals of Mathematical Statistics*) | UCL | Expected Information Gain as the criterion for optimal experiment design. |
| Chaloner & Verdinelli (1995) "Bayesian Experimental Design: A Review" (*Statistical Science*) | Minnesota / CMU | Canonical review unifying the decision-theoretic framework. |
| Foster, Ivanova, Rainforth (ICML 2021) "Deep Adaptive Design" | Oxford | Amortized sequential Bayesian experimental design. Shows EIG can be computed efficiently. |
| Myung & Pitt (2009) "Optimal Experimental Design for Model Discrimination" (*Psychological Review*) | Ohio State | Formalizes choosing experiments to discriminate between competing models — structurally identical to theory table selection. |

### Bayes Factor Lifecycle

| Paper | Institution | Relevance |
|-------|------------|-----------|
| Kass & Raftery (1995) "Bayes Factors" (*JASA*) | Carnegie Mellon / UW | The canonical reference for evidence categories. BF > 10 = strong, BF < 1/10 = strong against. |
| Jeffreys (1961) *Theory of Probability* | Cambridge | Original Bayes factor scale. |
| Wald (1945) "Sequential Tests of Statistical Hypotheses" (*Annals of Mathematical Statistics*) | Columbia | SPRT — optimal sequential testing with boundary-crossing stopping rules. |
| Schönbrodt et al. (2015) "Sequential Hypothesis Testing with Bayes Factors" (*Psychonomic Bulletin & Review*) | — | Practical sequential Bayes factor methodology. Immune to optional stopping. |

### Active Learning

| Paper | Institution | Relevance |
|-------|------------|-----------|
| Settles (2012) *Active Learning* (Synthesis Lectures) | UW-Madison | Definitive survey organizing query strategies into four frameworks. |
| Houlsby, Ghahramani et al. (2011) "Bayesian Active Learning by Disagreement" (arXiv 1112.5745) | Cambridge | BALD — mutual information between parameters and predictions as acquisition function. |
| Zhang, Gottesman, Doshi-Velez (2022) "A Bayesian Approach to Learning Bandit Structure in MDPs" (arXiv 2208.00250) | Harvard | Bayesian hypothesis testing for environment structure, maintaining posteriors over structural hypotheses. |

### Programmatic vs Prompt Control

| Paper | Institution | Relevance |
|-------|------------|-----------|
| Willard & Louf (2023) "Efficient Guided Generation for Large Language Models" (arXiv 2307.09702) | — | Constrained decoding via finite-state machines. Deterministic structural control. |
| Singhvi, Khattab et al. (ICLR 2024) "DSPy Assertions" | Stanford | Programmatic constraint enforcement with retry semantics. Constraints satisfied up to 164% more often. |
| Lightman et al. (2023) "Let's Verify Step by Step" (arXiv 2305.20050) | OpenAI | Process reward models outperform outcome-only verification. Step-level grading catches reasoning errors. |

### Exploration in RL

| Paper | Institution | Relevance |
|-------|------------|-----------|
| Badia et al. (ICLR 2020) "Never Give Up: Learning Directed Exploration Strategies" (arXiv 2002.06038) | DeepMind | Episodic memory tracking explored states with intrinsic rewards for under-explored areas. Maps directly to theory table as episodic memory. |
| Auer, Cesa-Bianchi & Fischer (2002) "Finite-time Analysis of the Multiarmed Bandit Problem" (*Machine Learning*) | U Milan | UCB1 — logarithmic regret uniformly over time. Exploration bonus decays with attention. |

## Implementation Details

### Thompson Sampling (`theory-selection.ts`)

For each active theory with Beta(alpha, beta) posterior:
1. Draw a sample from Beta(alpha, beta) using Marsaglia-Tsang Gamma method
2. Rank theories by sampled value
3. Return top-k (default 3)

Theories near posterior 0.5 have wide Beta distributions — their samples frequently land at extreme values, making them likely to be selected. Theories near 0 or 1 have narrow distributions — their samples cluster near the mean, rarely winning the competition.

This naturally produces the exploration-exploitation balance that prompt guidance tried (and failed) to achieve.

### Bayes Factor Lifecycle

Each prediction grade updates the cumulative log Bayes factor:

```
hit:  delta_logBF = log(alpha / (alpha + beta)) - log(0.5)
miss: delta_logBF = log(beta / (alpha + beta)) - log(0.5)
```

Using alpha/beta *before* the increment. The null model is a fair coin (0.5).

Status transitions:
- **log-BF >= 2.3** (BF > 10): `active` -> `established` (stop testing)
- **log-BF <= -2.3** (BF < 1/10) AND total_predictions >= 3: `active` -> `retired` (never shown again)
- Otherwise: remains `active`

The minimum 3-prediction guard prevents premature retirement from a single bad start.

### What the LLM Sees

Before (full table + 6 lines of distribution guidance):
```
EXISTING THEORIES (prefer testing these over creating new ones):
| Theory | Posterior | Predictions | Description |
[all theories with posteriors visible]

Guidelines:
- Prefer testing theories with few predictions or posteriors near 0.5...
- If a theory's posterior is below 0.2, it is likely wrong...
[6 more constraint lines]
```

After (2-3 pre-selected theories, no posteriors, no guidance):
```
ASSIGNED THEORIES (generate predictions that test these):
| Theory | Description |
[2-3 Thompson-sampled theories, no posterior values]

If today's data reveals a pattern not covered by any assigned theory,
you may create a prediction for a new theory.
```

Key differences:
- No posterior values shown (removes the anchoring signal)
- No distribution guidelines (Thompson sampling handles it in code)
- Framing: "assigned" not "choose from"
- Novel theory escape hatch preserved but de-emphasized

## Files

| File | Role |
|------|------|
| `src/lib/theory-selection.ts` | Thompson sampling, Bayes factor computation, status classification, EIG, prompt formatting |
| `src/lib/db.ts` | Schema (tb_theory_confidence with log_bayes_factor, status), updateTheoryConfidence with lifecycle |
| `src/lib/observe.ts` | Theory injection replaced with programmatic selection, predict prompt updated |
| `src/lib/grader.ts` | Added windowMode 'majority' support |
