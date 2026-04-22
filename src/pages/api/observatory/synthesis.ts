/**
 * Observatory Synthesis API
 *
 * Computes plain-English signal-translation insights about the latest entry,
 * sustained trends, and discovered couplings — using only deterministic
 * signals from the live database. No LLM. Designer-facing only.
 *
 * NARRATION RULES: This file describes signals, not the writer.
 * All copy comes from the vocabulary dictionary in observatory-vocabulary.ts.
 * See notes/observatory-narration-rules.md for the full constraint spec.
 *
 * Predictions / theories / suppressed questions were removed in the
 * 2026-04-16 interpretive-layer restructure; data is preserved under
 * zz_archive_*_20260416 tables but not referenced here.
 */
import type { APIRoute } from 'astro';
import sql from '../../../lib/libDb.ts';
import { logError } from '../../../lib/utlErrorLog.ts';
import {
  DIM_PLAIN, DIM_HIGH, DIM_LOW, EMO_PLAIN, TREND_VERB,
  CONVERGENCE_HIGH, CONVERGENCE_LOW, RARE_PREFIX,
  LOW_N_DEVIATIONS, LOW_N_TRENDS,
  MIN_N_DEVIATIONS, MIN_N_TRENDS,
} from '../../../lib/libObservatoryVocabulary.ts';
import { criticalR } from '../../../lib/utlCriticalR.ts';
import { computeCouplingStability } from '../../../lib/libCouplingStability.ts';

const BEHAVIORAL_DIMS = ['fluency', 'deliberation', 'revision', 'commitment', 'volatility', 'thermal', 'presence'] as const;
const SEMANTIC_DIMS = [
  'syntactic_complexity', 'interrogation', 'self_focus', 'uncertainty',
  'cognitive_processing',
  'nrc_anger', 'nrc_fear', 'nrc_joy', 'nrc_sadness', 'nrc_trust', 'nrc_anticipation',
] as const;

interface Insight { text: string; space?: 'behavioral' | 'semantic'; dimension?: string; magnitude?: number; }
interface Arc { text: string; space: 'behavioral' | 'semantic'; dimension: string; direction: 'rising' | 'falling'; length: number; }
interface Discovery { text: string; evidence: string; strength: 'established' | 'provisional'; source: 'behavioral' | 'semantic' | 'emotion-behavior'; }

export const GET: APIRoute = async () => {
  try {
    // Behavioral states + dynamics
    const behavioralStates = await sql`
      SELECT es.response_id, q.scheduled_for as date,
             es.fluency, es.deliberation, es.revision,
             es.commitment, es.volatility, es.thermal, es.presence, es.convergence
      FROM tb_entry_states es
      JOIN tb_responses r ON es.response_id = r.response_id
      JOIN tb_questions q ON r.question_id = q.question_id
      ORDER BY es.entry_state_id ASC
    ` as any[];

    const behavioralCount = behavioralStates.length;
    const behavioralDynamics = await sql`
      SELECT dimension, baseline, variability, attractor_force, current_state, deviation
      FROM tb_trait_dynamics
      WHERE entry_count = ${behavioralCount}
    ` as any[];
    const behavioralDynMap = new Map(behavioralDynamics.map((d: any) => [d.dimension, d]));

    // Semantic states + dynamics
    const semanticStates = await sql`
      SELECT response_id,
             syntactic_complexity, interrogation, self_focus, uncertainty,
             cognitive_processing,
             nrc_anger, nrc_fear, nrc_joy, nrc_sadness, nrc_trust, nrc_anticipation,
             convergence as semantic_convergence
      FROM tb_semantic_states
      ORDER BY semantic_state_id ASC
    ` as any[];

    const semanticCount = semanticStates.length;
    const semanticDynamics = await sql`
      SELECT dimension, baseline, variability, attractor_force, current_state, deviation
      FROM tb_semantic_dynamics
      WHERE entry_count = ${semanticCount}
    ` as any[];
    const semanticDynMap = new Map(semanticDynamics.map((d: any) => [d.dimension, d]));

    // Couplings
    const behavioralCouplings = await sql`
      SELECT leader, follower, lag_sessions, correlation, direction
      FROM tb_coupling_matrix
      WHERE entry_count = (SELECT MAX(entry_count) FROM tb_coupling_matrix)
      ORDER BY correlation DESC
    ` as any[];

    const semanticCouplings = await sql`
      SELECT leader, follower, lag_sessions, correlation, direction
      FROM tb_semantic_coupling
      WHERE entry_count = (SELECT MAX(entry_count) FROM tb_semantic_coupling)
      ORDER BY correlation DESC
    ` as any[];

    const emotionCouplings = await sql`
      SELECT emotion_dim, behavior_dim, lag_sessions, correlation, direction
      FROM tb_emotion_behavior_coupling
      WHERE entry_count = (SELECT MAX(entry_count) FROM tb_emotion_behavior_coupling)
      ORDER BY correlation DESC
    ` as any[];

    // ---- 1. RIGHT NOW: notable deviations on the latest entry ----
    const rightNow: Insight[] = [];
    const totalEntries = Math.max(behavioralCount, semanticCount);

    if (totalEntries < MIN_N_DEVIATIONS) {
      rightNow.push({ text: LOW_N_DEVIATIONS(totalEntries) });
    } else {
      if (behavioralStates.length > 0) {
        const latest = behavioralStates[behavioralStates.length - 1];
        const notable = BEHAVIORAL_DIMS
          .map(dim => {
            const dyn = behavioralDynMap.get(dim);
            const deviation = dyn ? dyn.deviation : latest[dim];
            return { dim, deviation };
          })
          .filter(d => Math.abs(d.deviation) > 1)
          .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));

        for (const n of notable.slice(0, 3)) {
          const absD = Math.abs(n.deviation);
          const desc = n.deviation > 0 ? DIM_HIGH[n.dim] : DIM_LOW[n.dim];
          const intensity = absD > 2 ? RARE_PREFIX : '';
          rightNow.push({
            text: `${intensity}${capitalize(desc)}. ${absD.toFixed(1)}σ from behavioral baseline.`,
            space: 'behavioral',
            dimension: n.dim,
            magnitude: absD,
          });
        }

        if (latest.convergence > 0.7) {
          rightNow.push({ text: CONVERGENCE_HIGH });
        } else if (latest.convergence < 0.2 && behavioralStates.length > 5) {
          rightNow.push({ text: CONVERGENCE_LOW });
        }
      }

      if (semanticStates.length > 0) {
        const latestSem = semanticStates[semanticStates.length - 1];
        const notableSem = SEMANTIC_DIMS
          .map(dim => {
            const dyn = semanticDynMap.get(dim);
            const deviation = dyn ? dyn.deviation : latestSem[dim];
            return { dim, deviation };
          })
          .filter(d => Math.abs(d.deviation) > 1)
          .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));

        for (const n of notableSem.slice(0, 2)) {
          const absD = Math.abs(n.deviation);
          const desc = n.deviation > 0 ? DIM_HIGH[n.dim] : DIM_LOW[n.dim];
          const intensity = absD > 2 ? RARE_PREFIX : '';
          rightNow.push({
            text: `${intensity}${capitalize(desc)}. ${absD.toFixed(1)}σ from semantic baseline.`,
            space: 'semantic',
            dimension: n.dim,
            magnitude: absD,
          });
        }
      }

      if (rightNow.length === 0) {
        rightNow.push({ text: 'All dimensions within normal range on latest entry.' });
      }
    }

    // ---- 2. ARCS: sustained monotonic runs ----
    const arcs: Arc[] = [];
    if (totalEntries < MIN_N_TRENDS) {
      // Not enough data — arcs array stays empty; the frontend already
      // handles empty arcs with "no sustained trends yet" messaging.
      // We'll add a lowN flag so the frontend can show the threshold notice.
    } else {
      function detectArcs(
        stateRows: any[],
        dims: ReadonlyArray<string>,
        space: 'behavioral' | 'semantic',
      ) {
        for (const dim of dims) {
          const values = stateRows.map(s => s[dim] as number);
          const last = values.length - 1;
          if (last < 1) continue;
          const direction: 'rising' | 'falling' = values[last] > values[last - 1] ? 'rising' : 'falling';
          let runLen = 1;
          for (let i = last; i > 0; i--) {
            if (direction === 'rising' && values[i] > values[i - 1]) runLen++;
            else if (direction === 'falling' && values[i] < values[i - 1]) runLen++;
            else break;
          }
          if (runLen >= 3) {
            const verb = TREND_VERB[direction];
            const plain = DIM_PLAIN[dim] ?? dim;
            arcs.push({
              text: `${capitalize(plain)} (${space}) has been ${verb} for ${runLen} straight sessions.`,
              space,
              dimension: dim,
              direction,
              length: runLen,
            });
          }
        }
      }
      detectArcs(behavioralStates, BEHAVIORAL_DIMS, 'behavioral');
      detectArcs(semanticStates, SEMANTIC_DIMS, 'semantic');
      arcs.sort((a, b) => b.length - a.length);
      arcs.splice(5);
    }

    // ---- 3. DISCOVERIES: top couplings ----
    // Dynamic critical-r gate: only show correlations that would be
    // significant at alpha=0.05 (two-tailed) given current sample size,
    // floored at 0.3 to suppress low-variance noise at large n.
    const discoveries: Discovery[] = [];

    // Load stability data for emotion-behavior badge resolution.
    // Behavioral-only and semantic-only couplings have no stability
    // analysis and default to 'provisional'.
    //
    // KNOWN LIMITATION: libCouplingStability only analyzes emotion->behavior
    // cross-domain pairs. Same-domain (behavioral-only, semantic-only)
    // couplings can never reach 'established' under this design. Phase-two
    // follow-up: extend stability system to same-domain pairs. See
    // GOTCHAS.md "Discovery badges: same-domain couplings capped at
    // provisional" and INC-008 in METHODS_PROVENANCE.md.
    let stableEmoKeys: Set<string>;
    try {
      const stability = await computeCouplingStability();
      stableEmoKeys = new Set(
        stability.stablePairs.map(p => `${p.emotionDim}|${p.behaviorDim}`),
      );
    } catch {
      stableEmoKeys = new Set();
    }

    function lagLabel(lag: number): string {
      return lag === 0 ? 'at the same time' : `${lag} session${lag > 1 ? 's' : ''} later`;
    }
    function pushCouplings(rows: any[], source: 'behavioral' | 'semantic', topN: number, n: number) {
      const rCrit = Math.max(criticalR(n), 0.3);
      const sorted = [...rows].sort((a: any, b: any) => Math.abs(b.correlation) - Math.abs(a.correlation));
      for (const c of sorted.slice(0, topN)) {
        const absR = Math.abs(c.correlation);
        if (absR < rCrit) continue;
        const leader = DIM_PLAIN[c.leader] || c.leader;
        const follower = DIM_PLAIN[c.follower] || c.follower;
        const text = c.direction < 0
          ? `When ${leader} increases, ${follower} drops ${lagLabel(c.lag_sessions)}.`
          : `${capitalize(leader)} and ${follower} move together ${lagLabel(c.lag_sessions)}.`;
        discoveries.push({
          text,
          evidence: `r=${c.direction > 0 ? '+' : '-'}${absR.toFixed(2)}`,
          strength: 'provisional',
          source,
        });
      }
    }
    pushCouplings(behavioralCouplings, 'behavioral', 4, behavioralCount);
    pushCouplings(semanticCouplings, 'semantic', 3, semanticCount);

    // Emotion -> behavior cross-domain
    const emoCouplingN = Math.min(behavioralCount, semanticCount);
    const emoRCrit = Math.max(criticalR(emoCouplingN), 0.3);
    const sortedEmo = [...emotionCouplings].sort((a: any, b: any) => Math.abs(b.correlation) - Math.abs(a.correlation));
    for (const c of sortedEmo.slice(0, 3)) {
      const absR = Math.abs(c.correlation);
      if (absR < emoRCrit) continue;
      const emotion = EMO_PLAIN[c.emotion_dim] || c.emotion_dim;
      const behavior = DIM_PLAIN[c.behavior_dim] || c.behavior_dim;
      const effect = c.direction > 0 ? 'increases' : 'drops';
      const isStable = stableEmoKeys.has(`${c.emotion_dim}|${c.behavior_dim}`);
      discoveries.push({
        text: `When ${emotion} increases, ${behavior} ${effect} ${lagLabel(c.lag_sessions)}.`,
        evidence: `r=${c.direction > 0 ? '+' : '-'}${absR.toFixed(2)}`,
        strength: isStable ? 'established' : 'provisional',
        source: 'emotion-behavior',
      });
    }

    return new Response(JSON.stringify({
      rightNow,
      arcs,
      arcsLowN: totalEntries < MIN_N_TRENDS ? LOW_N_TRENDS(totalEntries) : null,
      discoveries,
      behavioralCount,
      semanticCount,
      latestDate: behavioralStates.length > 0 ? behavioralStates[behavioralStates.length - 1].date : null,
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    logError('api.observatory.synthesis', err);
    return new Response(JSON.stringify({ error: 'Failed to synthesize' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
