> **Note:** This document predates the rename from Marrow to Alice (2026-04-12).

# BOB_AUDIT V2 — Trajectory Engine

## What Changed

V1 expanded Bob's input signals from 18 to 36 (adding recency, variance, shape, and relational signals). That improved what Bob *sees*.

V2 adds what Bob *generates*: a trajectory engine that tracks how the person changes over time.

## The Problem V2 Solves

Bob's 26 interpreted traits are non-deterministic (Opus might interpret the same signals differently twice) and the 36 aggregated signals shift with every new entry. Neither can serve as fixed coordinates for trajectory analysis.

The trajectory engine sidesteps both by going directly to the raw per-session data in `tb_session_summaries` and `tb_responses` — deterministic, frozen at submission time, never changes.

## Architecture

### Two branches from the same source

```
User writes
  → 36 aggregated signals (shift over time)
      → Opus interprets → 26 traits → shader → Bob visual (art)

  → Per-session raw data (frozen at submission)
      → Trajectory engine (pure math) → 4 dimensions + convergence
          → feeds Marrow question generation
          → becomes Einstein's foundation
```

The visual branch is artistic and interpretive. The trajectory branch is mathematical and deterministic. They never touch each other.

### Four honest dimensions

Individual behavioral signals are noisy and ambiguous. A pause could mean contemplation, distraction, or a cat on the keyboard. The trajectory engine doesn't use raw signals as coordinates. It collapses correlated metrics into composite dimensions and z-scores everything against the person's own baseline.

| Dimension | What it combines | What it measures |
|---|---|---|
| **Engagement** | duration + word count + sentence count | How much did you give? |
| **Processing** | first-keystroke latency | How hard was it to start? |
| **Revision** | commitment ratio (inverted) + deletion intensity | How much did you change your mind? |
| **Structure** | sentence length + question density + first-person density | How differently did you write vs. your norm? |

Each dimension is a z-score against the person's own mean. A value of 0 means "normal for you." A value of +2 means "2 standard deviations above your personal average."

### Convergence — the meta-signal

Convergence is the Euclidean distance from the person's center in 4D space. It answers: **did multiple dimensions move together?**

- Low convergence → normal session, nothing unusual
- High convergence → multiple dimensions deviated simultaneously → something real happened

A single metric deviating is noise. Four metrics deviating together is signal. Convergence separates the two.

### Phase detection

The engine detects the current phase of the trajectory:

- **insufficient** — fewer than 3 entries, no baseline possible
- **stable** — low velocity, low convergence, the person is in their normal range
- **shifting** — consistent directional movement in one or more dimensions
- **disrupted** — sudden high-convergence spike after a period of stability

### What's actionable for Marrow

| Phase | What Marrow should do |
|---|---|
| stable (5+ entries) | Disrupt. Ask something unexpected. The person is coasting. |
| shifting | Target the direction of change. Something is in motion. |
| disrupted | Something happened. Generate a question that probes the shift without knowing what shifted. |
| insufficient | Use seeds. Not enough data yet. |

## Files

| File | Purpose |
|---|---|
| `src/lib/bob/trajectory.ts` | Trajectory computation engine — loads sessions, computes shape metrics, z-scores, 4 dimensions, convergence, velocity, phase detection |
| `src/pages/api/trajectory.ts` | API endpoint returning full trajectory analysis as JSON |

## What's NOT in V2

- No AI in the trajectory loop. Pure math.
- No new database tables. Computed on the fly from existing data.
- No integration with Marrow's question generation yet. The engine produces data; generation doesn't consume it yet.
- No Einstein integration yet. That's V3 territory.
- No sound. Still visual only.

## Dependencies

- Requires non-calibration entries with session summaries (`tb_session_summaries` joined to `tb_responses` where `question_source_id != 3`)
- Minimum 3 entries for baseline computation
- Currently 0 qualifying entries in the database (2 seed responses lack session data, 9 calibration entries are filtered out)

## Open Questions

1. Should the baseline be computed from ALL entries, or should it use a rolling window? All-entry baseline means early entries carry less weight as history grows. Rolling window means the baseline shifts — which is more responsive but could mask long-term drift.
2. When the trajectory feeds Marrow, should it pass the raw dimension values or just the phase + convergence? Raw values give generation more to work with but risk over-interpretation. Phase + convergence is simpler and more honest.
3. The structure dimension uses absolute z-scores (how different, regardless of direction). Engagement, processing, and revision preserve direction. Is this the right split?
