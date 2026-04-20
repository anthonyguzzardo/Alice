---
title: Why Rust for Signal Computation
slug: why-rust
date: 2026-04-20
status: published
tags: [rust, signals, engineering]
---

A measurement instrument cannot have two implementations.

Alice computes nonlinear dynamical signals from keystroke timing data: permutation entropy, detrended fluctuation analysis, recurrence quantification analysis, transfer entropy. These are numerical estimators with known approximation error bounds, cited from specific papers, producing quantitative claims about cognitive state.

The original plan was TypeScript for everything. One language, one runtime, simpler to maintain. But the signal engine is not application code. It is a measurement instrument. The distinction matters.

## The single source of truth constraint

If you have a TypeScript implementation and a Rust implementation of the same estimator, and they disagree on the fifteenth decimal place, which one is right? You cannot know without a third implementation. Two sources of truth is worse than one, because disagreement between them is indistinguishable from a bug.

The signal engine must be exactly one implementation. Every signal is computed by exactly one function. If that function is unavailable, the measurement does not happen. The session saves; the signals are absent. A silent wrong answer is worse than no answer.

## Why Rust specifically

Three reasons, in order of importance:

**Numerical precision.** The ex-Gaussian MLE uses an EM algorithm (Lacouture & Cousineau 2008) that requires `erfc` with known approximation error bounds (Abramowitz & Stegun 7.1.26). Rust's type system makes it natural to distinguish `IkiSeries` from `FlightTimes` at the type level. A raw `f64[]` passed to the wrong function is a measurement error that compiles successfully. Newtypes with private inner fields prevent this category of mistake.

**Performance where it matters.** Recurrence quantification analysis is O(n^2) in the length of the IKI series. For a 1000-keystroke session, that's a million distance comparisons. In TypeScript this takes hundreds of milliseconds. In Rust it takes single-digit milliseconds. The difference matters because signal computation runs fire-and-forget after the HTTP response. Slow computation means the signals arrive late and miss the witness rendering window.

**napi-rs as a clean boundary.** The Rust crate compiles to a native Node addon via napi-rs. The boundary is three functions: `compute_dynamical_signals`, `compute_motor_signals`, `compute_process_signals`. Each takes a JSON string and returns a flat struct. `Option::None` becomes `undefined` in JavaScript. The TypeScript integration layer coerces these to `null` for postgres.js compatibility. The boundary is thin and typed.

## What this means in practice

If the Rust engine is not built (`npm run build:rust` not run), signal computation returns null. The session saves. The health endpoint reports `rustEngine: false`. The behavioral state engine falls back to summary-only computation for that entry. Nothing breaks. The measurement just does not happen.

This is the right failure mode for an instrument. A thermometer that cannot read the temperature should display nothing, not a guess.
