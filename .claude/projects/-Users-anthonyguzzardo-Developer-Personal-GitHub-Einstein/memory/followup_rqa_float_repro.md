---
name: RQA float reproducibility across recompilation
description: DFA/PE/RQA show ULP-level differences after Rust recompilation, not a code bug but a compiler reproducibility issue
type: project
---

DFA alpha, PE, and RQA show last-significant-digit differences when recomputed after rebuilding the native module, even with identical source code and identical input data. This is not a code-level determinism bug. It is LLVM optimizer nondeterminism: different compilation runs can produce different instruction orderings for floating-point operations, shifting results at the ULP boundary.

**Why:** Verified 2026-04-21 during the HoldFlight alignment fix. IKI counts were identical (same input), PE was bit-identical for 3/4 sessions, DFA differed at the 15th significant digit for all 4. The RQA O(n^2) loop has no HashMap, no parallel iteration, no randomness. The delta is purely from recompilation.

**How to apply:** This is not actionable as a code fix. If bit-exact reproducibility across recompilations matters for the paper, the options are: (1) pin the exact binary and never recompile, (2) use `#[inline(never)]` on hot float paths to reduce optimizer variance, or (3) accept ULP-level variance and document the tolerance in the paper's methods section. Option 3 is the pragmatic choice. The deltas are <0.005% and do not affect any measurement interpretation.

**Follow-up:** If the paper claims exact reproducibility, add a tolerance bound (e.g., |delta| < 1e-10 per signal) and document that this is the recompilation tolerance, not the measurement tolerance.
