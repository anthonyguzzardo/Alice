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

import type { SessionSummaryInput, CalibrationBaseline } from './db.ts';
import type { TrajectoryAnalysis } from './bob/trajectory.ts';
import { avg, stddev, percentileRank } from './bob/helpers.ts';

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

      return `[${s.date}] device=${s.deviceType || '?'} hour=${s.hourOfDay ?? '?'} duration=${dur} ${cpmStr} ${commitStr} ${revStr} ${burstStr} pauses=${s.pauseCount} tabs=${s.tabAwayCount} words=${s.wordCount}`.replace(/  +/g, ' ').trim();
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
