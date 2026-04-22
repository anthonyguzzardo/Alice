Forget the letter grades. I want a concrete defect list, not a narrative.

For each issue you flag, give me:
1. File and line numbers (or function name if line numbers are unstable)
2. The actual current code (paste it)
3. Why it's wrong — specifically, what input or condition makes it fail or degrade
4. The fix, written out
5. A test that would have caught it

Categories I want you to sweep for, in this order:

**Correctness under adversarial input.** What happens with empty IkiSeries? Single-element? NaN or Inf in flight times? Duplicate timestamps? Out-of-order events? Integer overflow on long sessions? For each signal function, name the input that breaks it or silently produces garbage.

**Determinism violations beyond HashMap.** Float summation order, parallel iteration, system time, thread-local RNG, locale-dependent parsing, filesystem ordering. Anywhere the same input could produce a different number on a different machine or run.

**Silent failure modes.** Every `unwrap_or`, `unwrap_or_default`, `ok()`, `.unwrap_or_else(|_| ...)`, and `if let Ok(...)` that swallows information. For each one, tell me what gets hidden and whether the caller can tell the difference between "real zero" and "failed to compute."

**Numerical issues.** Catastrophic cancellation in any subtraction of similar floats. Division without zero checks. Accumulated error in running sums. Anywhere you're computing variance, stddev, or correlation — is it numerically stable (Welford) or naive?

**FFI boundary leaks.** Any panic that can cross the napi boundary. Any place a Rust error becomes a generic JS error and loses the typed variant. Any allocation pattern that could leak under exception.

For each finding, rate severity as: produces-wrong-number, produces-no-number-when-it-should, slow, ugly. I only care about the first two right now.
