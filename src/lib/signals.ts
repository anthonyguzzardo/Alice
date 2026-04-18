/**
 * Signal formatting module for Alice's AI interpretation layer.
 *
 * Converts raw session summaries into research-backed verbalized formats
 * optimized for LLM consumption.
 *
 * Research basis:
 *   Verbalization    — Netflix "From Logs to Language" (2026): 92.9% improvement
 *   Percentiles      — Numeracy research (2026): most intuitive for LLMs
 *   Anchoring        — Anchoring bias studies (2024): baseline first, then current
 *   Signal hierarchy — "Lost in the Middle" (TACL 2024): primary first, dynamics last
 *   Structure        — Prompt formatting (2024): labeled sections > flat lists
 */

import type { SessionSummaryInput, CalibrationBaseline } from './db.ts';
import { getCalibrationSessionsWithText, getBurstSequence } from './db.ts';
import type { DynamicsAnalysis } from './alice-negative/dynamics.ts';
import { avg, stddev, percentileRank, computeMATTR, COGNITIVE_WORDS } from './alice-negative/helpers.ts';

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
  interKeyIntervalMeans: number[];
  interKeyIntervalStds: number[];
  revisionChainCounts: number[];
  revisionChainAvgLengths: number[];
  scrollBackCounts: number[];
  questionRereadCounts: number[];
  // Hold time + flight time (Kim et al. 2024)
  holdTimeMeans: number[];
  flightTimeMeans: number[];
  // Keystroke entropy (Ajilore et al. 2025)
  keystrokeEntropies: number[];
  // MATTR (McCarthy & Jarvis 2010)
  mattrs: number[];
  // Sentence metrics
  avgSentenceLengths: number[];
  sentenceLengthVariances: number[];
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
    interKeyIntervalMeans: allSummaries.filter(s => s.interKeyIntervalMean != null).map(s => s.interKeyIntervalMean!),
    interKeyIntervalStds: allSummaries.filter(s => s.interKeyIntervalStd != null).map(s => s.interKeyIntervalStd!),
    revisionChainCounts: allSummaries.filter(s => s.revisionChainCount != null).map(s => s.revisionChainCount!),
    revisionChainAvgLengths: allSummaries.filter(s => s.revisionChainAvgLength != null).map(s => s.revisionChainAvgLength!),
    scrollBackCounts: allSummaries.filter(s => s.scrollBackCount != null).map(s => s.scrollBackCount!),
    questionRereadCounts: allSummaries.filter(s => s.questionRereadCount != null).map(s => s.questionRereadCount!),
    // Hold time + flight time (Kim et al. 2024)
    holdTimeMeans: allSummaries.filter(s => s.holdTimeMean != null).map(s => s.holdTimeMean!),
    flightTimeMeans: allSummaries.filter(s => s.flightTimeMean != null).map(s => s.flightTimeMean!),
    // Keystroke entropy (Ajilore et al. 2025)
    keystrokeEntropies: allSummaries.filter(s => s.keystrokeEntropy != null).map(s => s.keystrokeEntropy!),
    // MATTR (McCarthy & Jarvis 2010)
    mattrs: allSummaries.filter(s => s.mattr != null).map(s => s.mattr!),
    // Sentence metrics
    avgSentenceLengths: allSummaries.filter(s => s.avgSentenceLength != null).map(s => s.avgSentenceLength!),
    sentenceLengthVariances: allSummaries.filter(s => s.sentenceLengthVariance != null).map(s => s.sentenceLengthVariance!),
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
 *   LAST: Dynamics context — phase, dimensions, deviations
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

  // Keystroke dynamics (Epp et al. 2011; Leijten & Van Waes 2013; Czerwinski et al. 2004)
  const hasKeystrokeDynamics = session.interKeyIntervalMean != null;
  if (hasKeystrokeDynamics) {
    lines.push('');
    lines.push('=== KEYSTROKE DYNAMICS ===');
    lines.push('');

    // Inter-key intervals
    const ikiMean = session.interKeyIntervalMean!;
    const ikiStd = session.interKeyIntervalStd!;
    const ikiCv = ikiMean > 0 ? ikiStd / ikiMean : 0;

    lines.push('Inter-key interval dynamics (Epp et al. 2011):');
    lines.push(`- Mean: ${ikiMean.toFixed(0)}ms between keystrokes, std: ${ikiStd.toFixed(0)}ms`);
    if (baselines.interKeyIntervalMeans.length > 1) {
      const meanPct = percentileRank(ikiMean, baselines.interKeyIntervalMeans);
      const stdPct = percentileRank(ikiStd, baselines.interKeyIntervalStds);
      lines.push(`- Mean interval: ${verbalizePercentile(meanPct)}. Variability: ${verbalizePercentile(stdPct)}.`);
    }
    if (ikiCv > 0.8) {
      lines.push('- High interval variability relative to mean — indicates cognitive switching or hesitation patterns');
    } else if (ikiCv < 0.4) {
      lines.push('- Low interval variability — uniform rhythm, suggests flow state or automatic writing');
    }

    // Hold time + flight time decomposition (Kim et al. 2024)
    if (session.holdTimeMean != null && session.flightTimeMean != null) {
      lines.push('');
      lines.push('Motor vs cognitive decomposition (Kim et al. 2024):');
      lines.push(`- Hold time (motor execution): mean ${session.holdTimeMean.toFixed(0)}ms, std ${(session.holdTimeStd ?? 0).toFixed(0)}ms`);
      lines.push(`- Flight time (cognitive planning): mean ${session.flightTimeMean.toFixed(0)}ms, std ${(session.flightTimeStd ?? 0).toFixed(0)}ms`);
      if (baselines.holdTimeMeans.length > 1) {
        const htPct = percentileRank(session.holdTimeMean, baselines.holdTimeMeans);
        const ftPct = percentileRank(session.flightTimeMean, baselines.flightTimeMeans);
        lines.push(`- Hold time: ${verbalizePercentile(htPct)}. Flight time: ${verbalizePercentile(ftPct)}.`);
      }
      const htFtRatio = session.flightTimeMean > 0 ? session.holdTimeMean / session.flightTimeMean : 0;
      if (htFtRatio > 1.5) {
        lines.push('- Hold/flight ratio elevated — motor execution dominates over cognitive planning');
      } else if (htFtRatio < 0.3) {
        lines.push('- Flight time dominates — long pauses between keys suggest deliberate word retrieval');
      }
    }

    // Keystroke entropy (Ajilore et al. 2025, BiAffect)
    if (session.keystrokeEntropy != null) {
      lines.push('');
      lines.push('Keystroke entropy (Ajilore et al. 2025):');
      lines.push(`- Timing entropy: ${session.keystrokeEntropy.toFixed(2)} bits`);
      if (baselines.keystrokeEntropies.length > 1) {
        const entPct = percentileRank(session.keystrokeEntropy, baselines.keystrokeEntropies);
        lines.push(`- ${verbalizePercentile(entPct)}. Higher entropy = more irregular typing rhythm; lower = more metronomic.`);
      }
    }

    // Revision chains
    if (session.revisionChainCount != null) {
      const chains = session.revisionChainCount;
      const avgLen = session.revisionChainAvgLength ?? 0;
      lines.push('');
      lines.push('Revision chain topology (Leijten & Van Waes 2013):');
      lines.push(`- ${chains} revision chain${chains !== 1 ? 's' : ''}, averaging ${avgLen.toFixed(1)} deletions per chain`);
      if (baselines.revisionChainCounts.length > 1) {
        const chainPct = percentileRank(chains, baselines.revisionChainCounts);
        lines.push(`- Chain count: ${verbalizePercentile(chainPct)}.`);
      }
      if (baselines.revisionChainAvgLengths.length > 1 && avgLen > 0) {
        const lenPct = percentileRank(avgLen, baselines.revisionChainAvgLengths);
        lines.push(`- Avg chain length: ${verbalizePercentile(lenPct)}.`);
      }
      if (avgLen > 5) {
        lines.push('- Long chains suggest deep structural revision — rethinking, not fixing typos');
      } else if (chains > 0 && avgLen <= 2) {
        lines.push('- Short chains suggest surface correction — typo fixing, minor word swaps');
      }
    }

    // Scroll-back behavior
    if (session.scrollBackCount != null || session.questionRereadCount != null) {
      lines.push('');
      lines.push('Re-engagement behavior (Czerwinski et al. 2004):');
      if (session.scrollBackCount != null) {
        lines.push(`- Scroll-back in own text: ${session.scrollBackCount} time${session.scrollBackCount !== 1 ? 's' : ''}`);
        if (baselines.scrollBackCounts.length > 1) {
          const sbPct = percentileRank(session.scrollBackCount, baselines.scrollBackCounts);
          lines.push(`  ${verbalizePercentile(sbPct)}. Re-reading own text mid-session correlates with deeper engagement.`);
        }
      }
      if (session.questionRereadCount != null) {
        lines.push(`- Question re-reads: ${session.questionRereadCount} time${session.questionRereadCount !== 1 ? 's' : ''}`);
        if (baselines.questionRereadCounts.length > 1) {
          const qrPct = percentileRank(session.questionRereadCount, baselines.questionRereadCounts);
          lines.push(`  ${verbalizePercentile(qrPct)}. Re-reading the question suggests recalibrating against the prompt.`);
        }
      }
    }
  }

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

    // MATTR — vocabulary diversity (McCarthy & Jarvis 2010)
    if (session.mattr != null) {
      const mattrPct = baselines.mattrs.length > 1 ? ` (${verbalizePercentile(percentileRank(session.mattr, baselines.mattrs))})` : '';
      lines.push(`Vocabulary diversity (MATTR): ${session.mattr.toFixed(3)}${mattrPct}`);
    }

    // Sentence metrics
    if (session.avgSentenceLength != null) {
      const aslPct = baselines.avgSentenceLengths.length > 1 ? ` (${verbalizePercentile(percentileRank(session.avgSentenceLength, baselines.avgSentenceLengths))})` : '';
      lines.push(`Avg sentence length: ${session.avgSentenceLength.toFixed(1)} words${aslPct}`);
    }
    if (session.sentenceLengthVariance != null && session.sentenceLengthVariance > 0) {
      const slvPct = baselines.sentenceLengthVariances.length > 1 ? ` (${verbalizePercentile(percentileRank(session.sentenceLengthVariance, baselines.sentenceLengthVariances))})` : '';
      lines.push(`Sentence length variance: ${session.sentenceLengthVariance.toFixed(1)}${slvPct}`);
    }
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

      const ikiStr = s.interKeyIntervalMean != null
        ? `iki=${s.interKeyIntervalMean.toFixed(0)}ms(std=${s.interKeyIntervalStd?.toFixed(0) ?? '?'})`
        : '';
      const chainStr = s.revisionChainCount != null
        ? `chains=${s.revisionChainCount}x${(s.revisionChainAvgLength ?? 0).toFixed(1)}avg`
        : '';
      const scrollStr = s.scrollBackCount != null || s.questionRereadCount != null
        ? `scrollback=${s.scrollBackCount ?? '?'} rereads=${s.questionRereadCount ?? '?'}`
        : '';

      const htftStr = s.holdTimeMean != null && s.flightTimeMean != null
        ? `hold=${s.holdTimeMean.toFixed(0)}ms flight=${s.flightTimeMean.toFixed(0)}ms`
        : '';
      const entropyStr = s.keystrokeEntropy != null
        ? `entropy=${s.keystrokeEntropy.toFixed(2)}bits`
        : '';
      const mattrStr = s.mattr != null
        ? `mattr=${s.mattr.toFixed(3)}`
        : '';

      return `[${s.date}] device=${s.deviceType || '?'} hour=${s.hourOfDay ?? '?'} duration=${dur} ${cpmStr} ${commitStr} ${revStr} ${burstStr} ${ikiStr} ${htftStr} ${entropyStr} ${chainStr} ${scrollStr} pauses=${s.pauseCount} tabs=${s.tabAwayCount} words=${s.wordCount} ${mattrStr} ${lingStr}`.replace(/  +/g, ' ').trim();
    } else {
      // Pre-V3 fallback
      return `[${s.date}] device=${s.deviceType || '?'} hour=${s.hourOfDay ?? '?'} duration=${dur} commitment=${s.commitmentRatio?.toFixed(2) ?? '?'} deletions=${s.deletionCount}(largest=${s.largestDeletion}) pauses=${s.pauseCount} tabs=${s.tabAwayCount} words=${s.wordCount} [pre-V3]`;
    }
  }).join('\n');
}

/**
 * Behavioral dynamics context block (7D PersDyn model since slice 3, 2026-04-16).
 * Dimension list is whatever the analysis carries — generic over the dim set
 * so the same formatter works for the parallel semantic space if needed.
 *
 * @param mode 'observe' for full verbalized block, 'compact' for summary
 */
export function formatDynamicsContext(
  analysis: DynamicsAnalysis,
  mode: 'observe' | 'compact',
): string {
  if (analysis.entryCount === 0) return '';

  if (analysis.phase === 'insufficient') {
    return mode === 'observe'
      ? '\n=== BEHAVIORAL DYNAMICS ===\nInsufficient data for dynamics analysis (need 5+ entries).'
      : 'Dynamics: insufficient data';
  }

  const dimCount = analysis.dimensions.length;
  const latest = analysis.dimensions;

  // Find notable deviations (>1.5σ from baseline)
  const extremes = latest
    .filter(d => Math.abs(d.deviation) >= 1.5)
    .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));

  const phaseDesc: Record<string, string> = {
    'stable': 'Stable — writing behavior is consistent across recent sessions.',
    'shifting': 'Shifting — a consistent trend is emerging in at least one dimension.',
    'disrupted': 'Disrupted — sharp behavioral spike after stability. Something real just happened.',
    'insufficient': 'Insufficient data.',
  };

  const velocityDesc =
    analysis.velocity > 0.6 ? 'volatile — behavioral state changing rapidly'
    : analysis.velocity > 0.3 ? 'moderate — some session-to-session variation'
    : 'stable — behavior consistent across recent sessions';

  const entropyDesc =
    analysis.systemEntropy >= 0.85 ? 'HIGH — all dimensions similarly variable, behavior unpredictable'
    : analysis.systemEntropy <= 0.5 ? 'LOW — structured: some dimensions rigid, others volatile'
    : 'MODERATE — mixed structure';

  if (mode === 'observe') {
    const lines: string[] = [];
    lines.push('');
    lines.push(`=== BEHAVIORAL DYNAMICS (${dimCount}D PersDyn model, ${analysis.entryCount} entries) ===`);
    lines.push('');
    lines.push(`Phase: ${phaseDesc[analysis.phase]}`);
    lines.push(`Velocity: ${analysis.velocity.toFixed(2)} — ${velocityDesc}`);
    lines.push(`System entropy: ${analysis.systemEntropy.toFixed(2)} — ${entropyDesc}`);
    lines.push('');

    // Dimension states
    lines.push('Dimension states (current z-score, baseline, attractor force):');
    for (const d of latest) {
      const attractorLabel =
        d.attractorForce >= 0.7 ? 'rigid' :
        d.attractorForce >= 0.4 ? 'moderate' : 'malleable';
      const deviationLabel =
        Math.abs(d.deviation) >= 2.0 ? 'EXTREME' :
        Math.abs(d.deviation) >= 1.5 ? 'notable' :
        Math.abs(d.deviation) >= 1.0 ? 'mild' : 'normal';

      lines.push(
        `  ${d.dimension.padEnd(14)} current=${d.currentState > 0 ? '+' : ''}${d.currentState.toFixed(2)}  ` +
        `baseline=${d.baseline > 0 ? '+' : ''}${d.baseline.toFixed(2)}  ` +
        `variability=${d.variability.toFixed(2)}  ` +
        `attractor=${d.attractorForce.toFixed(2)}(${attractorLabel})  ` +
        `deviation=${d.deviation > 0 ? '+' : ''}${d.deviation.toFixed(1)}σ(${deviationLabel})`
      );
    }

    // Notable deviations
    if (extremes.length > 0) {
      lines.push('');
      lines.push('Notable deviations from baseline:');
      for (const e of extremes) {
        const dir = e.deviation > 0 ? 'above' : 'below';
        lines.push(`  - ${e.dimension} is ${Math.abs(e.deviation).toFixed(1)}σ ${dir} baseline`);
        if (e.attractorForce >= 0.7) {
          lines.push(`    → Rigid dimension — this deviation is unusual and likely to snap back`);
        } else if (e.attractorForce <= 0.3) {
          lines.push(`    → Malleable dimension — deviation may represent a genuine, persistent shift`);
        }
      }
    }

    // Coupling
    if (analysis.coupling.length > 0) {
      lines.push('');
      lines.push('Dimension coupling (empirically discovered — which dimensions influence each other for this person):');
      for (const c of analysis.coupling.slice(0, 8)) {
        const sign = c.direction > 0 ? '+' : '−';
        const lagLabel = c.lagSessions === 0 ? 'concurrent' : `${c.lagSessions}-entry lag`;
        lines.push(`  ${c.leader} → ${c.follower}  r=${sign}${c.correlation.toFixed(2)} (${lagLabel})`);
      }

      // Call out active coupling effects (leader currently deviated)
      const activeCouplings = analysis.coupling.filter(c => {
        const leaderDyn = latest.find(d => d.dimension === c.leader);
        return leaderDyn && Math.abs(leaderDyn.deviation) >= 1.0;
      });
      if (activeCouplings.length > 0) {
        lines.push('');
        lines.push('Active coupling predictions (leader dimension currently deviated):');
        for (const c of activeCouplings.slice(0, 4)) {
          const leaderDyn = latest.find(d => d.dimension === c.leader)!;
          const dir = c.direction > 0 ? 'same direction' : 'opposite direction';
          const lagLabel = c.lagSessions === 0 ? 'concurrently' : `in ~${c.lagSessions} entries`;
          lines.push(
            `  - ${c.leader} deviated ${leaderDyn.deviation > 0 ? '+' : ''}${leaderDyn.deviation.toFixed(1)}σ → ` +
            `expect ${c.follower} to respond ${dir} ${lagLabel} (r=${c.correlation.toFixed(2)})`
          );
        }
      }
    }

    // Attractor structure summary
    const rigid = latest.filter(d => d.attractorForce >= 0.7);
    const malleable = latest.filter(d => d.attractorForce <= 0.3);
    if (rigid.length > 0 || malleable.length > 0) {
      lines.push('');
      if (rigid.length > 0) {
        lines.push(`Rigid dimensions (deviations snap back fast): ${rigid.map(d => d.dimension).join(', ')}`);
      }
      if (malleable.length > 0) {
        lines.push(`Malleable dimensions (shifts tend to persist): ${malleable.map(d => d.dimension).join(', ')}`);
      }
    }

    return lines.join('\n');
  }

  // Compact mode for generate/reflect
  const dimStr = latest.map(d => {
    const arrow = Math.abs(d.deviation) >= 1.5 ? (d.deviation > 0 ? '++' : '--') :
                  Math.abs(d.deviation) >= 1.0 ? (d.deviation > 0 ? '+' : '-') : '=';
    return `${d.dimension.slice(0, 3)}=${d.currentState.toFixed(1)}${arrow}`;
  }).join(' ');

  const couplingStr = analysis.coupling.length > 0
    ? ` | coupling: ${analysis.coupling.slice(0, 3).map(c => {
        const sign = c.direction > 0 ? '+' : '-';
        return `${c.leader.slice(0,3)}→${c.follower.slice(0,3)}(${sign}${c.correlation.toFixed(2)},lag${c.lagSessions})`;
      }).join(' ')}`
    : '';

  return `Dynamics(${dimCount}D): phase=${analysis.phase} velocity=${analysis.velocity.toFixed(2)} entropy=${analysis.systemEntropy.toFixed(2)} | ${dimStr}${couplingStr}`;
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
async function computeCalibrationKTFloor(allSummaries: SessionSummaryInput[]): Promise<number> {
  const calSessions = await getCalibrationSessionsWithText();
  // Need at least 5 calibration sessions with decent length for a reliable floor
  const usable = calSessions.filter(s => s.wordCount >= 20);
  if (usable.length < 3) return 0; // insufficient data — fall back to no floor

  const scores: number[] = [];
  for (const cal of usable) {
    const result = await computeRawKTScore(cal, (cal as any).responseText, allSummaries);
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
async function computeRawKTScore(
  session: SessionSummaryInput,
  responseText: string,
  allSummaries: SessionSummaryInput[],
): Promise<{ rawScore: number; signals: string[] }> {
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

  // 5. Burst sequence consolidation (Baaijen & Galbraith 2012)
  // The KT signature: short fragmented bursts early → longer sustained bursts later
  // as thinking consolidates during writing.
  try {
    const bursts = await getBurstSequence(session.questionId);
    if (bursts.length >= 4) {
      const mid = Math.floor(bursts.length / 2);
      const firstHalfBursts = bursts.slice(0, mid);
      const secondHalfBursts = bursts.slice(mid);

      const firstHalfAvg = avg(firstHalfBursts.map(b => b.chars));
      const secondHalfAvg = avg(secondHalfBursts.map(b => b.chars));

      if (firstHalfAvg > 0) {
        const consolidationRatio = secondHalfAvg / firstHalfAvg;

        if (consolidationRatio > 1.2) {
          // Bursts got at least 20% longer in second half — consolidation signal
          const burstScore = Math.min(1, (consolidationRatio - 1) / 1.0);
          scoreSum += burstScore;
          componentCount++;

          if (consolidationRatio > 1.5) {
            signals.push(`strong burst consolidation (${consolidationRatio.toFixed(1)}x longer bursts in second half — Baaijen & Galbraith KT signature)`);
          } else {
            signals.push(`mild burst consolidation (${consolidationRatio.toFixed(1)}x longer bursts in second half)`);
          }
        } else if (consolidationRatio < 0.7) {
          // Reverse pattern: bursts got shorter — fragmentation, not consolidation
          // This is anti-KT signal, score 0 for this component
          scoreSum += 0;
          componentCount++;
          signals.push(`burst fragmentation (bursts got shorter in second half — opposite of KT signature)`);
        }
        // Between 0.7 and 1.2: no meaningful pattern, skip this component
      }
    }
  } catch {
    // getBurstSequence may fail if no burst data exists — not an error, just skip
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
export async function computeKnowledgeTransformScore(
  session: SessionSummaryInput,
  responseText: string,
  allSummaries: SessionSummaryInput[],
): Promise<KnowledgeTransformResult> {
  const { rawScore, signals } = await computeRawKTScore(session, responseText, allSummaries);
  const calibrationFloor = await computeCalibrationKTFloor(allSummaries);
  const aboveFloor = Math.max(0, rawScore - calibrationFloor);

  if (calibrationFloor > 0 && aboveFloor > 0.15) {
    signals.push(`${(aboveFloor * 100).toFixed(0)}% above calibration floor (neutral writing = ${(calibrationFloor * 100).toFixed(0)}%)`);
  }

  return { score: rawScore, calibrationFloor, aboveFloor, signals };
}

// ─── Prediction formatting — REMOVED 2026-04-16 ─────────────────
// formatOpenPredictions and formatPredictionTrackRecord removed with the
// prediction + theory machinery. Data archived under
// zz_archive_predictions_20260416 / zz_archive_theory_confidence_20260416.

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

