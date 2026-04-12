/**
 * Signal formatting module for Marrow's AI interpretation layer.
 *
 * Converts raw session summaries + trajectory data into research-backed
 * verbalized formats optimized for LLM consumption.
 *
 * Research basis:
 *   Verbalization    — Netflix "From Logs to Language" (2026): 92.9% improvement
 *   Percentiles      — Numeracy research (2026): most intuitive for LLMs
 *   Anchoring        — Anchoring bias studies (2024): baseline first, then current
 *   Signal hierarchy — "Lost in the Middle" (TACL 2024): primary first, trajectory last
 *   Structure        — Prompt formatting (2024): labeled sections > flat lists
 */

import type { SessionSummaryInput, CalibrationBaseline, OpenPrediction } from './db.ts';
import { getCalibrationSessionsWithText } from './db.ts';
import type { TrajectoryAnalysis } from './bob/trajectory.ts';
import { avg, stddev, percentileRank, computeMATTR, COGNITIVE_WORDS } from './bob/helpers.ts';

// ─── Internal helpers ──────────────────────────────────────────────

function isEnriched(session: SessionSummaryInput): boolean {
  return session.smallDeletionCount != null;
}

interface PersonalBaselines {
  commitmentRatios: number[];
  firstKeystrokeValues: number[];
  durationValues: number[];
  charsPerMinuteValues: number[];
  pBurstLengthValues: number[];
  smallDeletionCounts: number[];
  largeDeletionCounts: number[];
  pauseCounts: number[];
  wordCounts: number[];
}

function computePersonalBaselines(allSummaries: SessionSummaryInput[]): PersonalBaselines {
  return {
    commitmentRatios: allSummaries.map(s => s.commitmentRatio).filter((v): v is number => v != null),
    firstKeystrokeValues: allSummaries.map(s => s.firstKeystrokeMs).filter((v): v is number => v != null),
    durationValues: allSummaries.map(s => s.totalDurationMs).filter((v): v is number => v != null),
    charsPerMinuteValues: allSummaries.filter(s => s.charsPerMinute != null).map(s => s.charsPerMinute!),
    pBurstLengthValues: allSummaries.filter(s => s.avgPBurstLength != null && s.avgPBurstLength > 0).map(s => s.avgPBurstLength!),
    smallDeletionCounts: allSummaries.filter(s => s.smallDeletionCount != null).map(s => s.smallDeletionCount!),
    largeDeletionCounts: allSummaries.filter(s => s.largeDeletionCount != null).map(s => s.largeDeletionCount!),
    pauseCounts: allSummaries.map(s => s.pauseCount),
    wordCounts: allSummaries.map(s => s.wordCount),
  };
}

/**
 * Verbalize a percentile rank as natural language with anchoring number.
 * Netflix research (2026): semantic descriptions outperform raw numbers.
 * Format: "in the Nth percentile — [semantic label]"
 */
function verbalizePercentile(pct: number): string {
  const p = Math.round(pct * 100);
  if (p <= 10) return `${p}th percentile — very low for you`;
  if (p <= 25) return `${p}th percentile — low for you`;
  if (p <= 40) return `${p}th percentile — below your median`;
  if (p <= 60) return `${p}th percentile — near your median`;
  if (p <= 75) return `${p}th percentile — above your median`;
  if (p <= 90) return `${p}th percentile — high for you`;
  return `${p}th percentile — very high for you`;
}

function verbalizeRevisionTiming(firstHalf: number, secondHalf: number): string {
  const total = firstHalf + secondHalf;
  if (total === 0) return 'no large deletions to analyze timing';
  const ratio = secondHalf / total;
  if (ratio < 0.3) return 'revisions concentrated early — false starts, couldn\'t settle on an opening';
  if (ratio > 0.7) return 'revisions concentrated late — wrote a draft then gutted sections';
  return 'revisions spread across the session';
}

function formatDuration(ms: number): string {
  const min = ms / 60000;
  if (min < 1) return `${Math.round(ms / 1000)}s`;
  return `${min.toFixed(1)}min`;
}

function compactPercentile(pct: number): string {
  return `P${Math.round(pct * 100)}`;
}

function revisionTimingLabel(firstHalf: number | null, secondHalf: number | null): string {
  if (firstHalf == null || secondHalf == null) return '?';
  const total = firstHalf + secondHalf;
  if (total === 0) return 'none';
  const ratio = secondHalf / total;
  if (ratio < 0.3) return 'early';
  if (ratio > 0.7) return 'late';
  return 'mixed';
}

// ─── Public API ────────────────────────────────────────────────────

/**
 * Deep verbalized behavioral signal block for observe.ts (single session).
 *
 * Signal hierarchy (primacy/recency research):
 *   FIRST: Primary signals — deletion character, P-bursts, commitment
 *   MIDDLE: Supporting context — duration, pauses, tab-aways, device
 *   LAST: Trajectory context — phase, convergence, dimensions
 */
export function formatObserveSignals(
  session: SessionSummaryInput,
  allSummaries: SessionSummaryInput[],
): string {
  const baselines = computePersonalBaselines(allSummaries);
  const n = allSummaries.length;
  const lines: string[] = [];

  lines.push(`=== PRIMARY BEHAVIORAL SIGNALS (compared against your personal baseline of ${n} sessions) ===`);
  lines.push('');

  if (isEnriched(session)) {
    // ── Deletion character (Faigley & Witte) ──
    const corrections = session.smallDeletionCount!;
    const revisions = session.largeDeletionCount!;
    const revChars = session.largeDeletionChars!;

    lines.push('Deletion character:');

    const baselineCorrections = avg(baselines.smallDeletionCounts);
    const baselineRevisions = avg(baselines.largeDeletionCounts);
    lines.push(`- ${corrections} corrections (small edits <10 chars) and ${revisions} revision${revisions !== 1 ? 's' : ''} (substantive deletions >=10 chars${revChars > 0 ? `, totaling ${revChars} chars removed` : ''})`);

    if (baselines.smallDeletionCounts.length > 1) {
      const corrPct = percentileRank(corrections, baselines.smallDeletionCounts);
      const revPct = percentileRank(revisions, baselines.largeDeletionCounts);
      lines.push(`- Corrections: ${verbalizePercentile(corrPct)}. Revisions: ${verbalizePercentile(revPct)}.`);
      lines.push(`- Baseline: you average ${baselineCorrections.toFixed(1)} corrections and ${baselineRevisions.toFixed(1)} revisions per session.`);
    }

    if (session.firstHalfDeletionChars != null && session.secondHalfDeletionChars != null) {
      lines.push(`- Timing: ${verbalizeRevisionTiming(session.firstHalfDeletionChars, session.secondHalfDeletionChars)}`);
    }

    lines.push('');

    // ── Production fluency (Chenoweth & Hayes) ──
    lines.push('Production fluency:');
    if (session.pBurstCount != null && session.avgPBurstLength != null && session.avgPBurstLength > 0) {
      lines.push(`- ${session.pBurstCount} P-bursts (sustained typing between 2s pauses), averaging ${session.avgPBurstLength.toFixed(0)} chars per burst`);
      if (baselines.pBurstLengthValues.length > 1) {
        const burstPct = percentileRank(session.avgPBurstLength, baselines.pBurstLengthValues);
        const baselineBurst = avg(baselines.pBurstLengthValues);
        lines.push(`- P-burst length: ${verbalizePercentile(burstPct)}. Baseline: ${baselineBurst.toFixed(0)} chars/burst.`);
      }
    }
    if (session.charsPerMinute != null) {
      const cpmPct = percentileRank(session.charsPerMinute, baselines.charsPerMinuteValues);
      const baselineCpm = avg(baselines.charsPerMinuteValues);
      lines.push(`- Active typing speed: ${session.charsPerMinute.toFixed(0)} chars/min (${verbalizePercentile(cpmPct)}; baseline ${baselineCpm.toFixed(0)} chars/min)`);
    }
    lines.push('');

    // ── Commitment ──
    if (session.commitmentRatio != null) {
      const commitPct = percentileRank(session.commitmentRatio, baselines.commitmentRatios);
      const baselineCommit = avg(baselines.commitmentRatios);
      lines.push(`Commitment: ${(session.commitmentRatio * 100).toFixed(0)}% of typed text kept (${verbalizePercentile(commitPct)}; baseline ${(baselineCommit * 100).toFixed(0)}%)`);
    }
  } else {
    // ── Pre-V3 fallback ──
    lines.push('Note: This session predates enriched capture. Deletion decomposition, P-burst, and revision timing data unavailable.');
    lines.push('');
    lines.push(`- Deletions: ${session.deletionCount} (largest: ${session.largestDeletion} chars, total: ${session.totalCharsDeleted} chars)`);
    if (session.commitmentRatio != null) {
      const commitPct = percentileRank(session.commitmentRatio, baselines.commitmentRatios);
      const baselineCommit = avg(baselines.commitmentRatios);
      lines.push(`- Commitment: ${(session.commitmentRatio * 100).toFixed(0)}% kept (${verbalizePercentile(commitPct)}; baseline ${(baselineCommit * 100).toFixed(0)}%)`);
    }
  }

  lines.push('');
  lines.push('=== SUPPORTING CONTEXT ===');
  lines.push('');

  // Duration
  if (session.totalDurationMs != null) {
    const durPct = percentileRank(session.totalDurationMs, baselines.durationValues);
    lines.push(`- Session duration: ${formatDuration(session.totalDurationMs)} (${verbalizePercentile(durPct)})`);
  }

  // First keystroke
  if (session.firstKeystrokeMs != null) {
    const ksPct = percentileRank(session.firstKeystrokeMs, baselines.firstKeystrokeValues);
    lines.push(`- First keystroke: ${(session.firstKeystrokeMs / 1000).toFixed(1)}s (${verbalizePercentile(ksPct)})`);
  }

  // Pauses
  const pausePct = percentileRank(session.pauseCount, baselines.pauseCounts);
  lines.push(`- Pauses (>30s): ${session.pauseCount} (${verbalizePercentile(pausePct)}; total ${formatDuration(session.totalPauseMs)} paused)`);

  // Tab-aways
  lines.push(`- Tab-aways: ${session.tabAwayCount}${session.totalTabAwayMs > 0 ? ` (total ${formatDuration(session.totalTabAwayMs)} away)` : ''}`);

  // Device + time context
  lines.push(`- Device: ${session.deviceType || 'unknown'}, Time: ${session.hourOfDay != null ? `${session.hourOfDay}:00` : 'unknown'} (day ${session.dayOfWeek ?? '?'})`);

  // Word count
  const wordPct = percentileRank(session.wordCount, baselines.wordCounts);
  lines.push(`- Final: ${session.wordCount} words, ${session.sentenceCount} sentences (${verbalizePercentile(wordPct)})`);

  // Linguistic densities (NRC Emotion Lexicon + Pennebaker)
  if (session.nrcAngerDensity != null) {
    lines.push('');
    lines.push('=== LINGUISTIC PROFILE (NRC Emotion Lexicon + Pennebaker) ===');
    lines.push('');

    const emotionEntries = [
      { label: 'anger', density: session.nrcAngerDensity, baselines: allSummaries.map(s => s.nrcAngerDensity).filter((v): v is number => v != null) },
      { label: 'fear', density: session.nrcFearDensity!, baselines: allSummaries.map(s => s.nrcFearDensity).filter((v): v is number => v != null) },
      { label: 'joy', density: session.nrcJoyDensity!, baselines: allSummaries.map(s => s.nrcJoyDensity).filter((v): v is number => v != null) },
      { label: 'sadness', density: session.nrcSadnessDensity!, baselines: allSummaries.map(s => s.nrcSadnessDensity).filter((v): v is number => v != null) },
      { label: 'trust', density: session.nrcTrustDensity!, baselines: allSummaries.map(s => s.nrcTrustDensity).filter((v): v is number => v != null) },
      { label: 'anticipation', density: session.nrcAnticipationDensity!, baselines: allSummaries.map(s => s.nrcAnticipationDensity).filter((v): v is number => v != null) },
    ];

    const emotionParts = emotionEntries.map(e => {
      const pct = e.baselines.length > 1 ? compactPercentile(percentileRank(e.density, e.baselines)) : '';
      return `${e.label}=${(e.density * 100).toFixed(1)}%${pct ? `(${pct})` : ''}`;
    });
    lines.push(`Emotion word densities: ${emotionParts.join(', ')}`);

    const cogBaselines = allSummaries.map(s => s.cognitiveDensity).filter((v): v is number => v != null);
    const hedgeBaselines = allSummaries.map(s => s.hedgingDensity).filter((v): v is number => v != null);
    const fpBaselines = allSummaries.map(s => s.firstPersonDensity).filter((v): v is number => v != null);

    const cogPct = cogBaselines.length > 1 ? ` (${verbalizePercentile(percentileRank(session.cognitiveDensity!, cogBaselines))})` : '';
    const hedgePct = hedgeBaselines.length > 1 ? ` (${verbalizePercentile(percentileRank(session.hedgingDensity!, hedgeBaselines))})` : '';
    const fpPct = fpBaselines.length > 1 ? ` (${verbalizePercentile(percentileRank(session.firstPersonDensity!, fpBaselines))})` : '';

    lines.push(`Cognitive mechanism words: ${(session.cognitiveDensity! * 100).toFixed(1)}%${cogPct}`);
    lines.push(`Hedging language: ${(session.hedgingDensity! * 100).toFixed(1)}%${hedgePct}`);
    lines.push(`First-person density: ${(session.firstPersonDensity! * 100).toFixed(1)}%${fpPct}`);
  }

  return lines.join('\n');
}

/**
 * Compact enriched one-liner per session for generate.ts and reflect.ts.
 *
 * Percentiles as compact P-notation (P85 = 85th percentile).
 * Enriched sessions get deletion decomposition + P-bursts.
 * Pre-V3 sessions fall back to legacy format with [pre-V3] suffix.
 */
export function formatCompactSignals(
  sessions: Array<SessionSummaryInput & { date: string }>,
  allSummaries: SessionSummaryInput[],
): string {
  const baselines = computePersonalBaselines(allSummaries);

  return sessions.map(s => {
    const dur = s.totalDurationMs != null ? formatDuration(s.totalDurationMs) : '?';

    if (isEnriched(s)) {
      const cpmStr = s.charsPerMinute != null
        ? `speed=${s.charsPerMinute.toFixed(0)}cpm(${compactPercentile(percentileRank(s.charsPerMinute, baselines.charsPerMinuteValues))})`
        : '';
      const commitStr = s.commitmentRatio != null
        ? `commitment=${s.commitmentRatio.toFixed(2)}(${compactPercentile(percentileRank(s.commitmentRatio, baselines.commitmentRatios))})`
        : '';
      const burstStr = s.pBurstCount != null && s.avgPBurstLength != null && s.avgPBurstLength > 0
        ? `bursts=${s.pBurstCount}x${s.avgPBurstLength.toFixed(0)}chars`
        : '';
      const timing = revisionTimingLabel(s.firstHalfDeletionChars, s.secondHalfDeletionChars);
      const revStr = `corrections=${s.smallDeletionCount} revisions=${s.largeDeletionCount}(${s.largeDeletionChars}chars,${timing})`;

      const lingStr = s.nrcAngerDensity != null
        ? `emo=[ang=${(s.nrcAngerDensity*100).toFixed(0)} fear=${(s.nrcFearDensity!*100).toFixed(0)} joy=${(s.nrcJoyDensity!*100).toFixed(0)} sad=${(s.nrcSadnessDensity!*100).toFixed(0)} trust=${(s.nrcTrustDensity!*100).toFixed(0)}%] cog=${(s.cognitiveDensity!*100).toFixed(1)}% hedge=${(s.hedgingDensity!*100).toFixed(1)}% fp=${(s.firstPersonDensity!*100).toFixed(1)}%`
        : '';

      return `[${s.date}] device=${s.deviceType || '?'} hour=${s.hourOfDay ?? '?'} duration=${dur} ${cpmStr} ${commitStr} ${revStr} ${burstStr} pauses=${s.pauseCount} tabs=${s.tabAwayCount} words=${s.wordCount} ${lingStr}`.replace(/  +/g, ' ').trim();
    } else {
      // Pre-V3 fallback
      return `[${s.date}] device=${s.deviceType || '?'} hour=${s.hourOfDay ?? '?'} duration=${dur} commitment=${s.commitmentRatio?.toFixed(2) ?? '?'} deletions=${s.deletionCount}(largest=${s.largestDeletion}) pauses=${s.pauseCount} tabs=${s.tabAwayCount} words=${s.wordCount} [pre-V3]`;
    }
  }).join('\n');
}

/**
 * Trajectory context block.
 *
 * Placed LAST in the signal hierarchy (recency effect — "Lost in the Middle").
 * Provides the cross-session meta-signal that makes individual sessions meaningful.
 *
 * @param mode 'observe' for full verbalized block, 'compact' for 2-line summary
 */
export function formatTrajectoryContext(
  analysis: TrajectoryAnalysis,
  mode: 'observe' | 'compact',
): string {
  if (analysis.points.length === 0) return '';

  const latest = analysis.points[analysis.points.length - 1];

  const phaseDesc = {
    'insufficient': 'Insufficient data for phase detection.',
    'stable': 'Stable — writing behavior is consistent across recent sessions. Patterns are reliable.',
    'shifting': 'Shifting — a consistent trend is emerging in at least one behavioral dimension. Something is changing.',
    'disrupted': 'Disrupted — sharp behavioral spike after a period of stability. Something real just happened.',
  }[analysis.phase];

  const convergenceDesc =
    latest.convergenceLevel === 'high'
      ? 'Multiple dimensions moved together — this is a coherent behavioral shift, not noise.'
      : latest.convergenceLevel === 'moderate'
      ? 'Some dimensions moved together. Possible signal, possible coincidence.'
      : 'Dimensions moved independently — likely noise, not a meaningful shift.';

  const velocityDesc =
    analysis.velocity > 0.6 ? 'volatile — behavioral fingerprint changing rapidly between sessions'
    : analysis.velocity > 0.3 ? 'moderate — some session-to-session variation'
    : 'stable — behavior consistent across recent sessions';

  if (mode === 'observe') {
    const lines: string[] = [];
    lines.push('');
    lines.push('=== TRAJECTORY CONTEXT (4D behavioral fingerprint across all sessions) ===');
    lines.push('');
    lines.push(`Phase: ${phaseDesc}`);
    lines.push(`Latest convergence: ${latest.convergenceLevel} (${latest.convergence.toFixed(2)}) — ${convergenceDesc}`);
    lines.push(`Dimensions: fluency=${latest.fluency.toFixed(2)} deliberation=${latest.deliberation.toFixed(2)} revision=${latest.revision.toFixed(2)} expression=${latest.expression.toFixed(2)}`);

    // Call out dimensions that moved >1 std from center (z-score > 1)
    const spikes: string[] = [];
    if (Math.abs(latest.fluency) > 1) spikes.push(`fluency ${latest.fluency > 0 ? 'high' : 'low'} (z=${latest.fluency.toFixed(1)})`);
    if (Math.abs(latest.deliberation) > 1) spikes.push(`deliberation ${latest.deliberation > 0 ? 'high' : 'low'} (z=${latest.deliberation.toFixed(1)})`);
    if (Math.abs(latest.revision) > 1) spikes.push(`revision ${latest.revision > 0 ? 'high' : 'low'} (z=${latest.revision.toFixed(1)})`);
    if (Math.abs(latest.expression) > 1) spikes.push(`expression ${latest.expression > 0 ? 'high' : 'low'} (z=${latest.expression.toFixed(1)})`);
    if (spikes.length > 0) {
      lines.push(`Notable deviations: ${spikes.join(', ')}`);
    }

    lines.push(`Velocity: ${analysis.velocity.toFixed(2)} — ${velocityDesc}`);
    return lines.join('\n');
  }

  // Compact mode for generate/reflect
  const arrow = (dim: number) => Math.abs(dim) > 1 ? (dim > 0 ? '+' : '-') : '=';
  return [
    `Trajectory: phase=${analysis.phase} velocity=${analysis.velocity.toFixed(2)} convergence=${latest.convergenceLevel}(${latest.convergence.toFixed(2)}) | flu=${latest.fluency.toFixed(1)} del=${latest.deliberation.toFixed(1)} rev=${latest.revision.toFixed(1)} exp=${latest.expression.toFixed(1)} [${arrow(latest.fluency)}${arrow(latest.deliberation)}${arrow(latest.revision)}${arrow(latest.expression)}]`,
  ].join('\n');
}

/**
 * Expanded calibration baselines block.
 * Anchoring research: baseline values presented first set the reference frame.
 */
export function formatEnrichedCalibration(calibration: CalibrationBaseline, deviceType?: string | null): string {
  if (calibration.sessionCount === 0) {
    return 'No calibration baselines yet. Baseline confidence: NONE. You cannot distinguish normal typing from emotionally significant behavior. Default to mundane interpretations for all behavioral signals. State this limitation explicitly.';
  }

  const lines: string[] = [];
  lines.push(`Calibration baselines (confidence: ${calibration.confidence}, from ${calibration.sessionCount} sessions${deviceType ? `, matched to ${deviceType}` : ''}):`);
  lines.push(`- Avg first keystroke: ${calibration.avgFirstKeystrokeMs?.toFixed(0)}ms`);
  lines.push(`- Avg commitment ratio: ${calibration.avgCommitmentRatio?.toFixed(2)}`);
  lines.push(`- Avg session duration: ${calibration.avgDurationMs?.toFixed(0)}ms`);
  lines.push(`- Avg pause count: ${calibration.avgPauseCount?.toFixed(1)}`);
  lines.push(`- Avg deletion count: ${calibration.avgDeletionCount?.toFixed(1)}`);

  // Enriched baselines (only if calibration sessions include V3 data)
  if (calibration.avgSmallDeletionCount != null) {
    lines.push(`- Avg corrections (small deletions <10 chars): ${calibration.avgSmallDeletionCount.toFixed(1)}`);
  }
  if (calibration.avgLargeDeletionCount != null) {
    lines.push(`- Avg revisions (large deletions >=10 chars): ${calibration.avgLargeDeletionCount.toFixed(1)}`);
  }
  if (calibration.avgLargeDeletionChars != null) {
    lines.push(`- Avg chars in large deletions: ${calibration.avgLargeDeletionChars.toFixed(0)}`);
  }
  if (calibration.avgCharsPerMinute != null) {
    lines.push(`- Avg active typing speed: ${calibration.avgCharsPerMinute.toFixed(0)} chars/min`);
  }
  if (calibration.avgPBurstCount != null) {
    lines.push(`- Avg P-burst count: ${calibration.avgPBurstCount.toFixed(1)}`);
  }
  if (calibration.avgPBurstLength != null) {
    lines.push(`- Avg P-burst length: ${calibration.avgPBurstLength.toFixed(0)} chars`);
  }

  lines.push('');
  lines.push(
    calibration.confidence === 'low' ? 'Baseline confidence is low. Too few calibration sessions to draw strong conclusions. Weight behavioral interpretations toward mundane explanations.' :
    calibration.confidence === 'moderate' ? 'Baseline confidence is moderate. Baseline is forming but not robust. Flag significant deviations but hold interpretations loosely.' :
    'Baseline confidence is strong. Baseline is reliable. Deviations from it are meaningful signal.'
  );

  return lines.join('\n');
}

// ─── Knowledge-transforming detection ─────────────────────────────
// Baaijen, Galbraith & de Glopper (2012): knowledge-transforming episodes
// produce shorter initial bursts → longer subsequent bursts, more revisions,
// vocabulary diversification, and revision clustering late in session.

export interface KnowledgeTransformResult {
  score: number;            // 0-1, higher = more knowledge-transforming
  calibrationFloor: number; // KT score of neutral/calibration writing (the baseline)
  aboveFloor: number;       // how far above calibration floor (score - floor, clamped to 0)
  signals: string[];
}

/**
 * Compute the knowledge-telling floor from calibration sessions.
 * This is what writing looks like when nothing interesting is happening.
 * Cached per call since calibration data changes rarely.
 */
function computeCalibrationKTFloor(allSummaries: SessionSummaryInput[]): number {
  const calSessions = getCalibrationSessionsWithText();
  // Need at least 5 calibration sessions with decent length for a reliable floor
  const usable = calSessions.filter(s => s.wordCount >= 20);
  if (usable.length < 3) return 0; // insufficient data — fall back to no floor

  const scores: number[] = [];
  for (const cal of usable) {
    const result = computeRawKTScore(cal, (cal as any).responseText, allSummaries);
    scores.push(result.rawScore);
  }

  // Use the 75th percentile as the floor (generous — most calibration writing
  // should be below this, so anything above it in a real session is meaningful)
  scores.sort((a, b) => a - b);
  return scores[Math.floor(scores.length * 0.75)];
}

/**
 * Internal: compute raw KT score without calibration adjustment.
 */
function computeRawKTScore(
  session: SessionSummaryInput,
  responseText: string,
  allSummaries: SessionSummaryInput[],
): { rawScore: number; signals: string[] } {
  const signals: string[] = [];
  let scoreSum = 0;
  let componentCount = 0;

  // 1. Late revision ratio — writing then restructuring
  if (session.firstHalfDeletionChars != null && session.secondHalfDeletionChars != null) {
    const total = session.firstHalfDeletionChars + session.secondHalfDeletionChars;
    if (total > 0) {
      const lateRatio = session.secondHalfDeletionChars / total;
      const lateScore = Math.min(1, lateRatio / 0.7);
      scoreSum += lateScore;
      componentCount++;
      if (lateRatio > 0.6) signals.push('late revisions (wrote then restructured)');
    }
  }

  // 2. Substantive revisions present
  if (session.largeDeletionCount != null) {
    const revBaseline = allSummaries
      .filter(s => s.largeDeletionCount != null)
      .map(s => s.largeDeletionCount!);
    if (revBaseline.length > 1 && session.largeDeletionCount > 0) {
      const revPct = percentileRank(session.largeDeletionCount, revBaseline);
      scoreSum += revPct;
      componentCount++;
      if (revPct > 0.6) signals.push('above-baseline substantive revisions');
    }
  }

  // 3. MATTR — vocabulary diversification
  const words = responseText.toLowerCase()
    .replace(/[^a-z'\s-]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 1);
  if (words.length >= 25) {
    const mattr = computeMATTR(words);
    const mattrScore = Math.min(1, (mattr - 0.5) / 0.3);
    scoreSum += Math.max(0, mattrScore);
    componentCount++;
    if (mattr > 0.7) signals.push('high vocabulary diversity (MATTR)');
  }

  // 4. Cognitive mechanism words (Pennebaker) — thinking/reasoning language
  const cogCount = words.filter(w => COGNITIVE_WORDS.has(w)).length;
  const cogDensity = words.length > 0 ? cogCount / words.length : 0;
  if (cogDensity > 0.04) {
    scoreSum += Math.min(1, cogDensity / 0.08);
    componentCount++;
    signals.push('high cognitive mechanism word density');
  }

  const rawScore = componentCount > 0 ? scoreSum / componentCount : 0;
  return { rawScore, signals };
}

/**
 * Detect whether a session shows the knowledge-transforming signature
 * (generating new understanding through writing, not just reciting).
 *
 * Returns both the raw score and the calibration-relative score.
 * The calibration floor is computed from free-write sessions — what
 * writing looks like when nothing interesting is happening. The
 * distance above that floor is the real signal.
 */
export function computeKnowledgeTransformScore(
  session: SessionSummaryInput,
  responseText: string,
  allSummaries: SessionSummaryInput[],
): KnowledgeTransformResult {
  const { rawScore, signals } = computeRawKTScore(session, responseText, allSummaries);
  const calibrationFloor = computeCalibrationKTFloor(allSummaries);
  const aboveFloor = Math.max(0, rawScore - calibrationFloor);

  if (calibrationFloor > 0 && aboveFloor > 0.15) {
    signals.push(`${(aboveFloor * 100).toFixed(0)}% above calibration floor (neutral writing = ${(calibrationFloor * 100).toFixed(0)}%)`);
  }

  return { score: rawScore, calibrationFloor, aboveFloor, signals };
}

// ─── Prediction formatting for LLM consumption ───────────────────

/**
 * Format open predictions for the observation prompt so the AI can grade them.
 */
export function formatOpenPredictions(predictions: OpenPrediction[]): string {
  if (predictions.length === 0) return '';

  const lines: string[] = [];
  lines.push('=== OPEN PREDICTIONS (grade these against today\'s data) ===');
  lines.push('');
  lines.push('For each prediction below, assess whether today\'s session data CONFIRMS, FALSIFIES, or is INDETERMINATE. If the prediction\'s expiry window has passed, mark it EXPIRED.');
  lines.push('');

  for (const p of predictions) {
    lines.push(`[Prediction #${p.predictionId}] (created ${p.dttmCreatedUtc})`);
    lines.push(`  Hypothesis: ${p.hypothesis}`);
    if (p.favoredFrame) lines.push(`  Favored frame: ${p.favoredFrame}`);
    if (p.targetTopic) lines.push(`  Topic: ${p.targetTopic}`);
    lines.push(`  Would confirm: ${p.expectedSignature}`);
    lines.push(`  Would falsify: ${p.falsificationCriteria}`);
    lines.push(`  Expires after: ${p.expirySessions} sessions`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format prediction track record + theory confidence for generation/reflection prompts.
 */
export function formatPredictionTrackRecord(
  stats: { total: number; confirmed: number; falsified: number; expired: number; open: number },
  theories: Array<{ theoryKey: string; description: string; posteriorMean: number; totalPredictions: number }>,
  recentGraded: Array<{ hypothesis: string; statusCode: string; gradeRationale: string | null }>,
): string {
  if (stats.total === 0) return '';

  const lines: string[] = [];
  lines.push('=== PREDICTION TRACK RECORD ===');
  lines.push('');
  lines.push(`Total predictions: ${stats.total} | Confirmed: ${stats.confirmed} | Falsified: ${stats.falsified} | Expired: ${stats.expired} | Open: ${stats.open}`);

  if (stats.confirmed + stats.falsified > 0) {
    const hitRate = stats.confirmed / (stats.confirmed + stats.falsified);
    lines.push(`Hit rate (excluding expired/open): ${(hitRate * 100).toFixed(0)}%`);
  }
  lines.push('');

  if (theories.length > 0) {
    lines.push('Theory confidence (Bayesian posterior, 0.5 = no evidence):');
    for (const t of theories) {
      const bar = t.posteriorMean > 0.65 ? 'strong' : t.posteriorMean > 0.5 ? 'leaning confirmed' : t.posteriorMean > 0.35 ? 'leaning falsified' : 'weak';
      lines.push(`  ${t.theoryKey}: ${t.posteriorMean.toFixed(2)} (${bar}, n=${t.totalPredictions}) — ${t.description}`);
    }
    lines.push('');
  }

  if (recentGraded.length > 0) {
    lines.push('Recent graded predictions:');
    for (const g of recentGraded.slice(0, 5)) {
      lines.push(`  [${g.statusCode}] ${g.hypothesis}${g.gradeRationale ? ` — ${g.gradeRationale}` : ''}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format calibration-relative deviations for the observation prompt.
 * Shows how far each metric deviates from the neutral writing baseline,
 * making predictions anchored to "unusual relative to boring writing"
 * rather than "unusual relative to other emotional writing."
 */
export function formatCalibrationDeviation(
  session: SessionSummaryInput,
  calibration: CalibrationBaseline,
): string {
  if (calibration.sessionCount === 0) return '';

  const lines: string[] = [];
  lines.push('=== CALIBRATION-RELATIVE DEVIATION (how far from neutral writing) ===');
  lines.push('');

  // Commitment ratio deviation
  if (session.commitmentRatio != null && calibration.avgCommitmentRatio != null) {
    const dev = session.commitmentRatio - calibration.avgCommitmentRatio;
    const pctDev = calibration.avgCommitmentRatio > 0
      ? (dev / calibration.avgCommitmentRatio * 100).toFixed(0)
      : '?';
    const dir = dev < -0.1 ? 'well below' : dev < -0.05 ? 'below' : dev > 0.05 ? 'above' : 'near';
    lines.push(`- Commitment: ${(session.commitmentRatio * 100).toFixed(0)}% vs neutral ${(calibration.avgCommitmentRatio * 100).toFixed(0)}% (${dir} baseline, ${pctDev}% deviation)`);
  }

  // First keystroke deviation
  if (session.firstKeystrokeMs != null && calibration.avgFirstKeystrokeMs != null && calibration.avgFirstKeystrokeMs > 0) {
    const ratio = session.firstKeystrokeMs / calibration.avgFirstKeystrokeMs;
    const label = ratio > 3 ? 'dramatically longer' : ratio > 1.5 ? 'notably longer' : ratio > 1.1 ? 'slightly longer' : ratio < 0.5 ? 'much shorter' : 'similar';
    lines.push(`- First keystroke: ${(session.firstKeystrokeMs / 1000).toFixed(1)}s vs neutral ${(calibration.avgFirstKeystrokeMs / 1000).toFixed(1)}s (${label} than baseline, ${ratio.toFixed(1)}x)`);
  }

  // P-burst deviation
  if (session.avgPBurstLength != null && session.avgPBurstLength > 0 && calibration.avgPBurstLength != null && calibration.avgPBurstLength > 0) {
    const ratio = session.avgPBurstLength / calibration.avgPBurstLength;
    const label = ratio < 0.5 ? 'much shorter bursts' : ratio < 0.8 ? 'shorter bursts' : ratio > 1.5 ? 'much longer bursts' : ratio > 1.2 ? 'longer bursts' : 'similar bursts';
    lines.push(`- P-burst length: ${session.avgPBurstLength.toFixed(0)} vs neutral ${calibration.avgPBurstLength.toFixed(0)} chars/burst (${label}, ${ratio.toFixed(1)}x)`);
  }

  // Chars per minute deviation
  if (session.charsPerMinute != null && calibration.avgCharsPerMinute != null && calibration.avgCharsPerMinute > 0) {
    const ratio = session.charsPerMinute / calibration.avgCharsPerMinute;
    const label = ratio < 0.6 ? 'much slower' : ratio < 0.85 ? 'slower' : ratio > 1.4 ? 'much faster' : ratio > 1.15 ? 'faster' : 'similar speed';
    lines.push(`- Typing speed: ${session.charsPerMinute.toFixed(0)} vs neutral ${calibration.avgCharsPerMinute.toFixed(0)} cpm (${label}, ${ratio.toFixed(1)}x)`);
  }

  if (lines.length <= 2) return ''; // no meaningful deviations to report

  lines.push('');
  lines.push('Deviations from calibration baseline are more meaningful than deviations from journal entry history, because calibration captures what neutral writing looks like — no emotional content, no deep questions, just describing breakfast or the weather.');

  return lines.join('\n');
}

/**
 * Format leading indicator findings for trajectory context.
 */
export function formatLeadingIndicators(
  indicators: Array<{ leader: string; follower: string; lagSessions: number; correlation: number }>,
): string {
  if (indicators.length === 0) return '';

  const lines: string[] = [];
  lines.push('Leading indicators (which dimensions predict others for this person):');
  for (const ind of indicators) {
    lines.push(`  ${ind.leader} leads ${ind.follower} by ${ind.lagSessions} session${ind.lagSessions !== 1 ? 's' : ''} (r=${ind.correlation.toFixed(2)})`);
  }
  return lines.join('\n');
}
