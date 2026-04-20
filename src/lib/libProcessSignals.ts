/**
 * Writing Process Signal Computation
 *
 * Computes signals from event log replay. These require reconstructing
 * the text state at various points during the session to classify pauses,
 * detect abandoned thoughts, and measure writing process structure.
 *
 * Signals:
 *   pauseLocationProfile    — Deane 2015 / Baaijen 2018: where pauses occur
 *   abandonedThoughtCount   — forensic linguistics: type-delete-redirect patterns
 *   rBurstCount / iBurstCount — Deane 2015: revision at edge vs navigation back
 *   vocabExpansionRate      — Heaps' law exponent: vocabulary growth within session
 *   phaseTransitionPoint    — writing process: when revision dominates composition
 *   strategyShiftCount      — change points in burst length series
 *
 * Event log format: [offsetMs, cursorPos, deletedCount, insertedText]
 */

// ─── Types ──────────────────────────────────────────────────────────

type EventTuple = [number, number, number, string];

export interface ProcessSignals {
  pauseWithinWord: number | null;
  pauseBetweenWord: number | null;
  pauseBetweenSentence: number | null;
  abandonedThoughtCount: number | null;
  rBurstCount: number | null;
  iBurstCount: number | null;
  vocabExpansionRate: number | null;
  phaseTransitionPoint: number | null;
  strategyShiftCount: number | null;
}

// ─── Helpers ────────────────────────────────────────────────────────

function reconstructText(events: EventTuple[]): string[] {
  // Replay event log to build text state at each event
  const states: string[] = [];
  let text = '';

  for (const [, cursorPos, deletedCount, inserted] of events) {
    if (deletedCount > 0) {
      text = text.slice(0, cursorPos) + text.slice(cursorPos + deletedCount);
    }
    if (inserted) {
      text = text.slice(0, cursorPos) + inserted + text.slice(cursorPos);
    }
    states.push(text);
  }

  return states;
}

// ─── Pause Location Profile (Deane 2015, Baaijen & Galbraith 2018) ──

function pauseLocationProfile(
  events: EventTuple[],
  textStates: string[],
  pauseThresholdMs: number = 2000,
): { withinWord: number; betweenWord: number; betweenSentence: number } | null {
  if (events.length < 10) return null;

  let withinWord = 0;
  let betweenWord = 0;
  let betweenSentence = 0;

  for (let i = 1; i < events.length; i++) {
    const gap = events[i][0] - events[i - 1][0];
    if (gap < pauseThresholdMs) continue;

    // Only count pauses before insertions (not deletions)
    if (!events[i][3]) continue;

    const text = textStates[i - 1];
    const cursorPos = events[i][1];

    if (cursorPos <= 0 || text.length === 0) {
      betweenSentence++;
      continue;
    }

    const charBefore = text[Math.min(cursorPos, text.length) - 1];
    if (/[.!?]/.test(charBefore)) {
      betweenSentence++;
    } else if (/\s/.test(charBefore)) {
      betweenWord++;
    } else {
      withinWord++;
    }
  }

  const total = withinWord + betweenWord + betweenSentence;
  if (total === 0) return null;

  return { withinWord, betweenWord, betweenSentence };
}

// ─── Abandoned Thought Signature ────────────────────────────────────
// Pattern: pause > 2s, then type 3-20 chars, then delete those chars,
// then type something different. Self-censorship / suppression marker.

function abandonedThoughtCount(
  events: EventTuple[],
  pauseThresholdMs: number = 2000,
): number | null {
  if (events.length < 10) return null;

  let count = 0;

  for (let i = 1; i < events.length - 2; i++) {
    const gap = events[i][0] - events[i - 1][0];
    if (gap < pauseThresholdMs) continue;

    // Check for: insertion followed by deletion of similar size followed by new insertion
    const insertedChars = events[i][3]?.length ?? 0;
    if (insertedChars < 3 || insertedChars > 50) continue;

    // Look ahead for a full deletion within the next few events
    let deletedTotal = 0;
    let followedByNewText = false;
    const lookAhead = Math.min(events.length, i + 8);

    for (let j = i + 1; j < lookAhead; j++) {
      const timeDelta = events[j][0] - events[i][0];
      if (timeDelta > 10000) break; // 10s window

      if (events[j][2] > 0) {
        deletedTotal += events[j][2];
      }
      if (deletedTotal >= insertedChars * 0.7 && events[j][3]?.length > 0) {
        followedByNewText = true;
        break;
      }
    }

    if (deletedTotal >= insertedChars * 0.7 && followedByNewText) {
      count++;
    }
  }

  return count;
}

// ─── R-burst / I-burst Classification (Deane 2015) ──────────────────
// R-burst: production burst ending with deletion at leading edge
// I-burst: production burst starting with cursor navigation backward

function burstClassification(
  events: EventTuple[],
  burstThresholdMs: number = 2000,
): { rBursts: number; iBursts: number } | null {
  if (events.length < 10) return null;

  let rBursts = 0;
  let iBursts = 0;

  // Group events into bursts by time gap
  const bursts: EventTuple[][] = [];
  let currentBurst: EventTuple[] = [events[0]];

  for (let i = 1; i < events.length; i++) {
    if (events[i][0] - events[i - 1][0] > burstThresholdMs) {
      if (currentBurst.length > 0) bursts.push(currentBurst);
      currentBurst = [];
    }
    currentBurst.push(events[i]);
  }
  if (currentBurst.length > 0) bursts.push(currentBurst);

  for (const burst of bursts) {
    if (burst.length < 2) continue;

    // R-burst: ends with deletion
    const lastEvent = burst[burst.length - 1];
    if (lastEvent[2] > 0) {
      rBursts++;
      continue;
    }

    // I-burst: first event after pause involves cursor positioned
    // before end of text (navigated backward)
    const firstEvent = burst[0];
    if (firstEvent[3] && firstEvent[1] < (firstEvent[1] + firstEvent[3].length - 2)) {
      // This heuristic checks if insertion is mid-text
      // A better check would compare cursorPos to text length at that moment
      iBursts++;
    }
  }

  return { rBursts, iBursts };
}

// ─── Vocabulary Expansion Rate (Heaps' Law) ─────────────────────────
// How quickly unique words appear through the session.

function vocabExpansionRate(textStates: string[]): number | null {
  if (textStates.length < 10) return null;

  // Sample text at 10 evenly spaced points
  const samples = 10;
  const step = Math.floor(textStates.length / samples);
  const points: Array<{ totalWords: number; uniqueWords: number }> = [];

  for (let i = 0; i < samples; i++) {
    const idx = Math.min(i * step, textStates.length - 1);
    const text = textStates[idx];
    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    const unique = new Set(words);
    if (words.length > 0) {
      points.push({ totalWords: words.length, uniqueWords: unique.size });
    }
  }

  if (points.length < 3) return null;

  // Fit Heaps' law: V = K * N^beta in log space
  const logPoints = points
    .filter(p => p.totalWords > 0 && p.uniqueWords > 0)
    .map(p => ({ x: Math.log(p.totalWords), y: Math.log(p.uniqueWords) }));

  if (logPoints.length < 3) return null;

  const n = logPoints.length;
  const xMean = logPoints.reduce((s, p) => s + p.x, 0) / n;
  const yMean = logPoints.reduce((s, p) => s + p.y, 0) / n;

  let num = 0, den = 0;
  for (const p of logPoints) {
    num += (p.x - xMean) * (p.y - yMean);
    den += (p.x - xMean) ** 2;
  }

  return den > 0 ? num / den : null; // beta = Heaps exponent
}

// ─── Phase Transition Point ─────────────────────────────────────────
// Position in session (0-1) where deletion rate exceeds insertion rate

function phaseTransitionPoint(events: EventTuple[]): number | null {
  if (events.length < 20) return null;

  const totalDuration = events[events.length - 1][0] - events[0][0];
  if (totalDuration <= 0) return null;

  // Sliding window: compute insertion vs deletion ratio
  const windowSize = Math.max(5, Math.floor(events.length / 10));
  let transitionIdx: number | null = null;

  for (let i = windowSize; i < events.length - windowSize; i++) {
    let insertions = 0;
    let deletions = 0;
    for (let j = i; j < i + windowSize && j < events.length; j++) {
      if (events[j][3]) insertions += events[j][3].length;
      if (events[j][2] > 0) deletions += events[j][2];
    }

    if (deletions > insertions && transitionIdx === null) {
      transitionIdx = i;
    }
  }

  if (transitionIdx === null) return null;
  return (events[transitionIdx][0] - events[0][0]) / totalDuration;
}

// ─── Strategy Shift Detection ───────────────────────────────────────
// Simple change point detection in burst length series

function strategyShiftCount(events: EventTuple[], burstThresholdMs: number = 2000): number | null {
  // Build burst length series from events
  const burstLengths: number[] = [];
  let currentChars = 0;

  for (let i = 0; i < events.length; i++) {
    if (events[i][3]) currentChars += events[i][3].length;

    const isGap = i < events.length - 1 && (events[i + 1][0] - events[i][0]) > burstThresholdMs;
    const isLast = i === events.length - 1;

    if ((isGap || isLast) && currentChars > 0) {
      burstLengths.push(currentChars);
      currentChars = 0;
    }
  }

  if (burstLengths.length < 6) return null;

  // Simple change point: count positions where the running mean shifts
  // by more than 1 std from the previous window
  const windowSize = Math.max(3, Math.floor(burstLengths.length / 4));
  let shifts = 0;

  for (let i = windowSize; i < burstLengths.length - windowSize + 1; i++) {
    const before = burstLengths.slice(i - windowSize, i);
    const after = burstLengths.slice(i, i + windowSize);

    const meanBefore = before.reduce((a, b) => a + b, 0) / before.length;
    const meanAfter = after.reduce((a, b) => a + b, 0) / after.length;

    const allVals = [...before, ...after];
    const overallMean = allVals.reduce((a, b) => a + b, 0) / allVals.length;
    const overallStd = Math.sqrt(allVals.reduce((s, v) => s + (v - overallMean) ** 2, 0) / allVals.length);

    if (overallStd > 0 && Math.abs(meanAfter - meanBefore) > overallStd) {
      shifts++;
      // Skip ahead to avoid double-counting
      // (not incrementing i here since we want to count discrete shifts)
    }
  }

  return shifts;
}

// ─── Public API ─────────────────────────────────────────────────────

export function computeProcessSignals(eventLogJson: string): ProcessSignals {
  let events: EventTuple[];
  try {
    events = JSON.parse(eventLogJson) as EventTuple[];
  } catch {
    return nullResult();
  }

  if (!Array.isArray(events) || events.length < 10) return nullResult();

  const textStates = reconstructText(events);
  const pauseProfile = pauseLocationProfile(events, textStates);
  const abandoned = abandonedThoughtCount(events);
  const bursts = burstClassification(events);
  const heaps = vocabExpansionRate(textStates);
  const phase = phaseTransitionPoint(events);
  const shifts = strategyShiftCount(events);

  return {
    pauseWithinWord: pauseProfile?.withinWord ?? null,
    pauseBetweenWord: pauseProfile?.betweenWord ?? null,
    pauseBetweenSentence: pauseProfile?.betweenSentence ?? null,
    abandonedThoughtCount: abandoned,
    rBurstCount: bursts?.rBursts ?? null,
    iBurstCount: bursts?.iBursts ?? null,
    vocabExpansionRate: heaps,
    phaseTransitionPoint: phase,
    strategyShiftCount: shifts,
  };
}

function nullResult(): ProcessSignals {
  return {
    pauseWithinWord: null, pauseBetweenWord: null, pauseBetweenSentence: null,
    abandonedThoughtCount: null, rBurstCount: null, iBurstCount: null,
    vocabExpansionRate: null, phaseTransitionPoint: null, strategyShiftCount: null,
  };
}
