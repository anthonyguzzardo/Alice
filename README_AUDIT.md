# README Audit Log

Running record of significant README.md changes, mapped to simulation versions and architectural decisions.

---

## v18 — Programmatic Theory Selection via Thompson Sampling (2026-04-13)

**Trigger:** Theory distribution over-correction problem (v9-v11). Prompt-based distribution guidance ("stop testing below 0.2, spread across theories") worked on Haiku v10 (3 theories, spread 5/4/1) but over-corrected on Sonnet v11 (2 theories, spread 12/7, 0 confirmed). Sonnet locked onto theories and hammered them despite continuous falsification. The fix required moving theory selection from the prompt into deterministic code.

**Research conducted:** Multi-institution academic survey across Anthropic, OpenAI, Oxford, Cambridge, Harvard, Stanford, Columbia, Carnegie Mellon, DeepMind, MIT, Princeton, UCL. 20+ papers cited. Full documentation in `docs/THEORY_SELECTION.md`.

### What Changed in README.md

**New section: "Theory Selection & Hypothesis Management" (Scientific Foundation)**
- 11 new research citations added under a dedicated subsection
- Thompson sampling (Thompson 1933; Agrawal & Goyal, Columbia COLT 2012)
- Bayesian Optimal Experimental Design (Lindley UCL 1956; Chaloner & Verdinelli CMU 1995)
- Sequential Bayes factors (Kass & Raftery CMU/UW 1995; Jeffreys Cambridge 1961; Wald Columbia 1945)
- BALD (Houlsby & Ghahramani, Cambridge 2011)
- Information-Directed Sampling (Russo & Van Roy, Stanford NeurIPS 2014)
- Deep Adaptive Design (Foster, Ivanova, Rainforth, Oxford ICML 2021)
- Sycophancy as architectural constraint (Sharma & Perez, Anthropic ICLR 2024)
- Never Give Up episodic exploration (Badia et al., DeepMind ICLR 2020)
- DSPy Assertions (Singhvi & Khattab, Stanford ICLR 2024)
- Process reward models (Lightman et al., OpenAI 2023)

**Updated: "Bayesian updating" paragraph (The Prediction Engine)**
- Added "Theory lifecycle" paragraph documenting Bayes factor states (active/established/retired) with principled thresholds
- Added "Theory selection" paragraph documenting Thompson sampling replacing prompt-based guidance
- Cited failure mode research: sycophancy (Anthropic ICLR 2024), anchoring (Ahn et al. 2024), multiplicative constraint degradation

**Updated: Architecture section**
- New bullet: "Theory selection engine" (`src/lib/theory-selection.ts`) documenting the three-mechanism architecture
- Updated "Deterministic grader" bullet: added `majority` window mode (any, all, latest, majority)

### What Changed in Code

| File | Change |
|------|--------|
| `src/lib/theory-selection.ts` | **NEW.** Thompson sampling (Marsaglia-Tsang Beta sampler), Bayes factor lifecycle, EIG, prompt formatting. Zero dependencies. Seedable PRNG. |
| `src/lib/db.ts` | Schema: `tb_theory_confidence` gains `log_bayes_factor` (REAL) and `status` (TEXT: active/established/retired). `updateTheoryConfidence` computes incremental Bayes factor and status on every grade. Query functions return new fields. |
| `src/lib/observe.ts` | Theory injection replaced: full table dump + 6-line distribution guidance -> Thompson-sampled 2-3 theories with no posteriors visible and no behavioral instructions. Predict prompt reframed from "choose which theory" to "generate predictions for assigned theories." |
| `src/lib/grader.ts` | Added `windowMode: 'majority'` — confirmed if >50% of session checks confirm. Fixes bug where LLM could emit 'majority' but grader rejected it. |
| `docs/THEORY_SELECTION.md` | **NEW.** Full research documentation with architecture diagram, paper citations, implementation details. |

### Key Architectural Decision

The core insight from the research is a separation of concerns:

- **Layer 1-2 (code):** Which theory to test. Thompson sampling + Bayes factor lifecycle. Deterministic. Model-independent.
- **Layer 3 (LLM):** How to operationalize the test. Turning "test theory X" into a concrete falsifiable prediction with structured criteria. This is what LLMs are good at.

The previous architecture asked the LLM to do both — decide which theory AND generate the prediction. The research from Anthropic (sycophancy), Cambridge (anchoring), and Stanford (DSPy) all show this fails because prompt-based behavioral constraints degrade multiplicatively with complexity and interact unpredictably with model capability. Larger models are often *more* susceptible to over-correction because RLHF creates tension between following instructions and applying independent judgment.

### What This Should Fix

- Theory fixation (Sonnet hammering 2 theories for 12/7 predictions in v11)
- Distribution over-correction (guidance working on Haiku but failing on Sonnet)
- Model-dependent behavior (same code, different theory selection patterns by model)
- Premature theory testing of dead hypotheses (posterior < 0.1 still getting tested)
- Missing `windowMode: 'majority'` that Sonnet consistently requested

### What to Verify in Next Simulation Run

```bash
npm run simulate                    # Haiku mechanics
npm run simulate -- --quality       # Sonnet quality
```

Expected:
- [ ] Theories spread across 3+ keys (not 2 hammered ones)
- [ ] Retired theories (log-BF < -2.3) never appear in predict prompt
- [ ] Established theories (log-BF > 2.3) stop being tested
- [ ] New theories still created on novel data (day 1, novel patterns)
- [ ] `windowMode: 'majority'` predictions accepted and graded correctly
- [ ] Console output shows theory lifecycle counts per day
- [ ] Sonnet and Haiku produce comparable theory distributions (model-independence)
- [ ] Confirmed prediction count improves from v11's 0 (Sonnet)

### Institutions Represented in New Citations

| Institution | Researchers | Papers |
|---|---|---|
| Anthropic | Sharma, Perez, Greenblatt | Sycophancy (ICLR 2024), Alignment Faking (2024) |
| OpenAI | Lightman et al. | Process Reward Models (2023) |
| Oxford | Foster, Ivanova, Rainforth | Deep Adaptive Design (ICML 2021) |
| Cambridge | Houlsby, Ghahramani, Jeffreys | BALD (2011), Bayes factor scale (1961) |
| Harvard | Zhang, Doshi-Velez | Bayesian bandit structure (2022) |
| Stanford | Russo, Van Roy, Khattab, Singhvi | IDS (NeurIPS 2014), DSPy (ICLR 2024) |
| Columbia | Agrawal, Goyal, Wald | Thompson sampling (COLT 2012), SPRT (1945) |
| Carnegie Mellon / UW | Kass, Raftery | Bayes Factors (JASA 1995) |
| DeepMind | Badia et al. | Never Give Up (ICLR 2020) |
| UCL | Lindley | Expected Information Gain (1956) |
| Minnesota / CMU | Chaloner, Verdinelli | Bayesian Experimental Design review (1995) |
| Ohio State | Myung, Pitt | Optimal Experimental Design for Model Discrimination (2009) |
