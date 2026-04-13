/**
 * Canonical Signal Registry
 *
 * The single source of truth for every deterministic, code-computable signal
 * that predictions can reference. This breaks the circular self-evaluation loop
 * by giving the LLM a fixed vocabulary of measurable outcomes — predictions
 * referencing these signals are graded by code, not by the LLM.
 *
 * Research basis:
 *   - Shumailov et al (Nature 2024): Self-consuming loops degrade without
 *     deterministic ground truth anchors.
 *   - Panickssery & Bowman (NeurIPS 2024): LLMs favor own outputs via
 *     perplexity familiarity. Code grading eliminates self-preference bias.
 *   - Gerstgrasser et al (MIT/Stanford 2024): Model collapse avoidable
 *     if real data accumulates alongside synthetic assessments.
 *
 * Three signal sources:
 *   session  — SessionSummaryInput (per-entry keystroke + linguistic data)
 *   delta    — SessionDeltaRow (same-day calibration vs journal shift)
 *   dynamics — DynamicsAnalysis (8D PersDyn behavioral model)
 */

import { STATE_DIMENSIONS } from './alice-negative/state-engine.ts';

// ─── Types ──────────────────────────────────────────────────────────

export type SignalSource = 'session' | 'delta' | 'dynamics';

export interface SignalDefinition {
  name: string;
  source: SignalSource;
  field: string;
  unit: string;
  description: string;
  nullable: boolean;
}

// ─── Registry ───────────────────────────────────────────────────────

const SESSION_SIGNALS: Record<string, SignalDefinition> = {
  // Timing
  'session.firstKeystrokeMs':       { name: 'session.firstKeystrokeMs',       source: 'session', field: 'firstKeystrokeMs',       unit: 'ms',          description: 'Delay from page open to first keystroke',                nullable: true },
  'session.totalDurationMs':        { name: 'session.totalDurationMs',        source: 'session', field: 'totalDurationMs',        unit: 'ms',          description: 'Total session duration',                                 nullable: true },
  'session.activeTypingMs':         { name: 'session.activeTypingMs',         source: 'session', field: 'activeTypingMs',         unit: 'ms',          description: 'Duration minus pauses and tab-aways',                    nullable: true },

  // Production
  'session.totalCharsTyped':        { name: 'session.totalCharsTyped',        source: 'session', field: 'totalCharsTyped',        unit: 'chars',       description: 'All characters typed including deleted',                  nullable: false },
  'session.finalCharCount':         { name: 'session.finalCharCount',         source: 'session', field: 'finalCharCount',         unit: 'chars',       description: 'Length of submitted text',                                nullable: false },
  'session.commitmentRatio':        { name: 'session.commitmentRatio',        source: 'session', field: 'commitmentRatio',        unit: 'ratio 0-1',   description: 'Fraction of typed text kept (finalCharCount/totalCharsTyped)', nullable: true },
  'session.charsPerMinute':         { name: 'session.charsPerMinute',         source: 'session', field: 'charsPerMinute',         unit: 'cpm',         description: 'Active typing speed',                                    nullable: true },
  'session.wordCount':              { name: 'session.wordCount',              source: 'session', field: 'wordCount',              unit: 'words',       description: 'Words in final submission',                               nullable: false },
  'session.sentenceCount':          { name: 'session.sentenceCount',          source: 'session', field: 'sentenceCount',          unit: 'sentences',   description: 'Sentences in final submission',                           nullable: false },

  // Pauses & engagement
  'session.pauseCount':             { name: 'session.pauseCount',             source: 'session', field: 'pauseCount',             unit: 'count',       description: 'Number of 30s+ pauses',                                  nullable: false },
  'session.totalPauseMs':           { name: 'session.totalPauseMs',           source: 'session', field: 'totalPauseMs',           unit: 'ms',          description: 'Cumulative pause time',                                  nullable: false },
  'session.tabAwayCount':           { name: 'session.tabAwayCount',           source: 'session', field: 'tabAwayCount',           unit: 'count',       description: 'Times user left the page',                                nullable: false },
  'session.totalTabAwayMs':         { name: 'session.totalTabAwayMs',         source: 'session', field: 'totalTabAwayMs',         unit: 'ms',          description: 'Cumulative tab-away time',                                nullable: false },

  // Deletion decomposition (Faigley & Witte 1981)
  'session.deletionCount':          { name: 'session.deletionCount',          source: 'session', field: 'deletionCount',          unit: 'count',       description: 'Total deletion events',                                   nullable: false },
  'session.totalCharsDeleted':      { name: 'session.totalCharsDeleted',      source: 'session', field: 'totalCharsDeleted',      unit: 'chars',       description: 'Total characters removed',                                nullable: false },
  'session.largestDeletion':        { name: 'session.largestDeletion',        source: 'session', field: 'largestDeletion',        unit: 'chars',       description: 'Max chars in one deletion burst',                         nullable: false },
  'session.smallDeletionCount':     { name: 'session.smallDeletionCount',     source: 'session', field: 'smallDeletionCount',     unit: 'count',       description: 'Corrections <10 chars (noise)',                           nullable: true },
  'session.largeDeletionCount':     { name: 'session.largeDeletionCount',     source: 'session', field: 'largeDeletionCount',     unit: 'count',       description: 'Substantive deletions >=10 chars (signal)',               nullable: true },
  'session.largeDeletionChars':     { name: 'session.largeDeletionChars',     source: 'session', field: 'largeDeletionChars',     unit: 'chars',       description: 'Total chars in substantive deletions',                    nullable: true },
  'session.firstHalfDeletionChars': { name: 'session.firstHalfDeletionChars', source: 'session', field: 'firstHalfDeletionChars', unit: 'chars',       description: 'Large deletion chars in first half of session',           nullable: true },
  'session.secondHalfDeletionChars':{ name: 'session.secondHalfDeletionChars',source: 'session', field: 'secondHalfDeletionChars',unit: 'chars',       description: 'Large deletion chars in second half of session',          nullable: true },

  // P-bursts (Chenoweth & Hayes 2001)
  'session.pBurstCount':            { name: 'session.pBurstCount',            source: 'session', field: 'pBurstCount',            unit: 'count',       description: 'Number of 2s-bounded production bursts',                  nullable: true },
  'session.avgPBurstLength':        { name: 'session.avgPBurstLength',        source: 'session', field: 'avgPBurstLength',        unit: 'chars',       description: 'Mean P-burst length (longer = more fluent)',              nullable: true },

  // Keystroke intervals (Epp et al 2011)
  'session.interKeyIntervalMean':   { name: 'session.interKeyIntervalMean',   source: 'session', field: 'interKeyIntervalMean',   unit: 'ms',          description: 'Mean inter-keystroke interval',                           nullable: true },
  'session.interKeyIntervalStd':    { name: 'session.interKeyIntervalStd',    source: 'session', field: 'interKeyIntervalStd',    unit: 'ms',          description: 'Std dev of inter-keystroke intervals',                    nullable: true },

  // Revision topology (Leijten & Van Waes 2013)
  'session.revisionChainCount':     { name: 'session.revisionChainCount',     source: 'session', field: 'revisionChainCount',     unit: 'count',       description: 'Sequential deletion chains',                              nullable: true },
  'session.revisionChainAvgLength': { name: 'session.revisionChainAvgLength', source: 'session', field: 'revisionChainAvgLength', unit: 'keystrokes',  description: 'Avg keystrokes per revision chain',                       nullable: true },

  // Re-engagement (Czerwinski et al 2004)
  'session.scrollBackCount':        { name: 'session.scrollBackCount',        source: 'session', field: 'scrollBackCount',        unit: 'count',       description: 'Times user scrolled back in own text',                    nullable: true },
  'session.questionRereadCount':    { name: 'session.questionRereadCount',    source: 'session', field: 'questionRereadCount',    unit: 'count',       description: 'Times user re-read the question prompt',                  nullable: true },

  // NRC emotion densities (Mohammad & Turney 2013)
  'session.nrcAngerDensity':        { name: 'session.nrcAngerDensity',        source: 'session', field: 'nrcAngerDensity',        unit: 'density 0-1', description: 'Anger word density (NRC lexicon)',                        nullable: true },
  'session.nrcFearDensity':         { name: 'session.nrcFearDensity',         source: 'session', field: 'nrcFearDensity',         unit: 'density 0-1', description: 'Fear word density (NRC lexicon)',                         nullable: true },
  'session.nrcJoyDensity':          { name: 'session.nrcJoyDensity',          source: 'session', field: 'nrcJoyDensity',          unit: 'density 0-1', description: 'Joy word density (NRC lexicon)',                          nullable: true },
  'session.nrcSadnessDensity':      { name: 'session.nrcSadnessDensity',      source: 'session', field: 'nrcSadnessDensity',      unit: 'density 0-1', description: 'Sadness word density (NRC lexicon)',                      nullable: true },
  'session.nrcTrustDensity':        { name: 'session.nrcTrustDensity',        source: 'session', field: 'nrcTrustDensity',        unit: 'density 0-1', description: 'Trust word density (NRC lexicon)',                        nullable: true },
  'session.nrcAnticipationDensity': { name: 'session.nrcAnticipationDensity', source: 'session', field: 'nrcAnticipationDensity', unit: 'density 0-1', description: 'Anticipation word density (NRC lexicon)',                 nullable: true },

  // Pennebaker densities
  'session.cognitiveDensity':       { name: 'session.cognitiveDensity',       source: 'session', field: 'cognitiveDensity',       unit: 'density 0-1', description: 'Cognitive mechanism word density (think, realize, because)', nullable: true },
  'session.hedgingDensity':         { name: 'session.hedgingDensity',         source: 'session', field: 'hedgingDensity',         unit: 'density 0-1', description: 'Hedging/uncertainty word density (maybe, perhaps, might)',   nullable: true },
  'session.firstPersonDensity':     { name: 'session.firstPersonDensity',     source: 'session', field: 'firstPersonDensity',     unit: 'density 0-1', description: 'First-person pronoun density (I, me, my)',                 nullable: true },
};

const DELTA_SIGNALS: Record<string, SignalDefinition> = {
  'delta.firstPerson':             { name: 'delta.firstPerson',             source: 'delta', field: 'deltaFirstPerson',         unit: 'density diff', description: 'First-person density shift (journal minus calibration)',   nullable: true },
  'delta.cognitive':               { name: 'delta.cognitive',               source: 'delta', field: 'deltaCognitive',           unit: 'density diff', description: 'Cognitive density shift',                                  nullable: true },
  'delta.hedging':                 { name: 'delta.hedging',                 source: 'delta', field: 'deltaHedging',             unit: 'density diff', description: 'Hedging density shift',                                    nullable: true },
  'delta.charsPerMinute':          { name: 'delta.charsPerMinute',          source: 'delta', field: 'deltaCharsPerMinute',      unit: 'cpm diff',     description: 'Typing speed shift',                                       nullable: true },
  'delta.commitment':              { name: 'delta.commitment',              source: 'delta', field: 'deltaCommitment',          unit: 'ratio diff',   description: 'Commitment ratio shift',                                   nullable: true },
  'delta.largeDeletionCount':      { name: 'delta.largeDeletionCount',      source: 'delta', field: 'deltaLargeDeletionCount',  unit: 'count diff',   description: 'Large deletion count shift',                               nullable: true },
  'delta.interKeyIntervalMean':    { name: 'delta.interKeyIntervalMean',    source: 'delta', field: 'deltaInterKeyIntervalMean',unit: 'ms diff',      description: 'Keystroke interval shift',                                 nullable: true },
  'delta.avgPBurstLength':         { name: 'delta.avgPBurstLength',         source: 'delta', field: 'deltaAvgPBurstLength',     unit: 'chars diff',   description: 'P-burst length shift',                                     nullable: true },
  'delta.magnitude':               { name: 'delta.magnitude',               source: 'delta', field: 'deltaMagnitude',           unit: 'RMS z-score',  description: 'Overall behavioral displacement magnitude',                nullable: true },
};

// Dynamics top-level signals
const DYNAMICS_TOPLEVEL: Record<string, SignalDefinition> = {
  'dynamics.velocity':       { name: 'dynamics.velocity',       source: 'dynamics', field: 'velocity',       unit: 'norm 0-1',     description: 'Rate of movement through 8D behavioral space',      nullable: true },
  'dynamics.systemEntropy':  { name: 'dynamics.systemEntropy',  source: 'dynamics', field: 'systemEntropy',  unit: 'bits',         description: 'Shannon entropy of behavioral variabilities',       nullable: true },
};

// Dynamics per-dimension signals (programmatically generated)
const DYNAMICS_DIMENSION_PARAMS = ['baseline', 'variability', 'attractorForce', 'currentState', 'deviation'] as const;

const DYNAMICS_PER_DIM: Record<string, SignalDefinition> = {};
for (const dim of STATE_DIMENSIONS) {
  for (const param of DYNAMICS_DIMENSION_PARAMS) {
    const name = `dynamics.${dim}.${param}`;
    const descriptions: Record<string, string> = {
      baseline: `Rolling mean of ${dim} dimension`,
      variability: `Rolling std dev of ${dim} dimension`,
      attractorForce: `How quickly ${dim} deviations snap back (0=malleable, 1=rigid)`,
      currentState: `Latest z-score of ${dim} dimension`,
      deviation: `Current ${dim} deviation in std units from baseline`,
    };
    DYNAMICS_PER_DIM[name] = {
      name,
      source: 'dynamics',
      field: `${dim}.${param}`,
      unit: param === 'attractorForce' ? 'force 0-1' : 'z-score',
      description: descriptions[param],
      nullable: true,
    };
  }
}

/** Complete signal registry — every gradeable signal in one place */
export const SIGNAL_REGISTRY: Record<string, SignalDefinition> = {
  ...SESSION_SIGNALS,
  ...DELTA_SIGNALS,
  ...DYNAMICS_TOPLEVEL,
  ...DYNAMICS_PER_DIM,
};

/** Check if a signal name exists in the registry */
export function isValidSignal(name: string): boolean {
  return name in SIGNAL_REGISTRY;
}

/**
 * Format the signal catalog for LLM prompt injection.
 * Groups by source for readability. The LLM uses this to know
 * which signal names are valid when constructing structured criteria.
 */
export function getSignalCatalog(): string {
  const lines: string[] = [
    '=== SIGNAL CATALOG (valid signal names for structured prediction criteria) ===',
    '',
    'Use these exact signal names in your STRUCTURED_CRITERIA JSON.',
    'Every signal is deterministic and code-computed — predictions referencing',
    'these signals are graded by code, not by AI.',
    '',
  ];

  const bySource = new Map<SignalSource, SignalDefinition[]>();
  for (const sig of Object.values(SIGNAL_REGISTRY)) {
    if (!bySource.has(sig.source)) bySource.set(sig.source, []);
    bySource.get(sig.source)!.push(sig);
  }

  const sourceLabels: Record<SignalSource, string> = {
    session: 'SESSION (per-entry keystroke + linguistic data)',
    delta: 'DELTA (same-day calibration vs journal shift)',
    dynamics: 'DYNAMICS (8D PersDyn behavioral model)',
  };

  for (const [source, sigs] of bySource) {
    lines.push(`--- ${sourceLabels[source]} ---`);
    // For dynamics per-dimension, summarize instead of listing all 40
    if (source === 'dynamics') {
      const topLevel = sigs.filter(s => !s.field.includes('.'));
      const perDim = sigs.filter(s => s.field.includes('.'));
      for (const s of topLevel) {
        lines.push(`  ${s.name} (${s.unit}) — ${s.description}`);
      }
      if (perDim.length > 0) {
        lines.push(`  dynamics.{dim}.{param} — Per-dimension dynamics`);
        lines.push(`    Dimensions: ${STATE_DIMENSIONS.join(', ')}`);
        lines.push(`    Parameters: ${DYNAMICS_DIMENSION_PARAMS.join(', ')}`);
        lines.push(`    Example: dynamics.fluency.deviation, dynamics.revision.attractorForce`);
      }
    } else {
      for (const s of sigs) {
        lines.push(`  ${s.name} (${s.unit}) — ${s.description}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}
