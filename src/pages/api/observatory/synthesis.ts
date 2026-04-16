/**
 * Observatory Synthesis API
 *
 * Computes plain-English narrative insights about the latest entry, sustained
 * trends, and discovered couplings — using only deterministic signals from
 * the live database. No LLM. Designer-facing only.
 *
 * Predictions / theories / suppressed questions were removed in the
 * 2026-04-16 interpretive-layer restructure; data is preserved under
 * zz_archive_*_20260416 tables but not referenced here.
 */
import type { APIRoute } from 'astro';
import db from '../../../lib/db.ts';

const BEHAVIORAL_DIMS = ['fluency', 'deliberation', 'revision', 'commitment', 'volatility', 'thermal', 'presence'] as const;
const SEMANTIC_DIMS = [
  'syntactic_complexity', 'interrogation', 'self_focus', 'uncertainty',
  'cognitive_processing',
  'nrc_anger', 'nrc_fear', 'nrc_joy', 'nrc_sadness', 'nrc_trust', 'nrc_anticipation',
] as const;

const DIM_PLAIN: Record<string, string> = {
  fluency: 'writing flow',
  deliberation: 'hesitation',
  revision: 'rewriting',
  commitment: 'commitment to what you wrote',
  volatility: 'behavioral instability',
  thermal: 'correction intensity',
  presence: 'focus',
  syntactic_complexity: 'sentence complexity',
  interrogation: 'questioning',
  self_focus: 'self-focus',
  uncertainty: 'hedging',
  cognitive_processing: 'reasoning language',
  nrc_anger: 'anger language',
  nrc_fear: 'fear language',
  nrc_joy: 'joy language',
  nrc_sadness: 'sadness language',
  nrc_trust: 'trust language',
  nrc_anticipation: 'anticipation language',
};

const DIM_HIGH: Record<string, string> = {
  fluency: 'wrote with unusually sustained flow',
  deliberation: 'paused and hesitated more than usual',
  revision: 'rewrote significantly more than normal',
  commitment: 'kept almost everything you typed',
  volatility: 'shifted sharply from your previous entry',
  thermal: 'corrected yourself with unusual intensity',
  presence: 'stayed deeply focused throughout',
  syntactic_complexity: 'wrote in unusually long, complex sentences',
  interrogation: 'asked an unusual number of questions',
  self_focus: 'used first-person language much more than usual',
  uncertainty: 'hedged unusually often',
  cognitive_processing: 'used reasoning words much more than usual',
  nrc_anger: 'used unusually strong anger language',
  nrc_fear: 'used unusually strong fear language',
  nrc_joy: 'used unusually strong joy language',
  nrc_sadness: 'used unusually strong sadness language',
  nrc_trust: 'used unusually strong trust language',
  nrc_anticipation: 'used unusually strong anticipation language',
};

const DIM_LOW: Record<string, string> = {
  fluency: 'wrote in shorter, more fragmented bursts',
  deliberation: 'dove in without much hesitation',
  revision: 'barely revised at all',
  commitment: 'deleted a lot of what you typed',
  volatility: 'was remarkably consistent with your previous entry',
  thermal: 'made very few corrections',
  presence: 'was more distracted than usual',
  syntactic_complexity: 'wrote in unusually short sentences',
  interrogation: 'asked far fewer questions than usual',
  self_focus: 'used first-person language unusually little',
  uncertainty: 'wrote with unusual certainty (low hedging)',
  cognitive_processing: 'used reasoning words unusually little',
  nrc_anger: 'used unusually little anger language',
  nrc_fear: 'used unusually little fear language',
  nrc_joy: 'used unusually little joy language',
  nrc_sadness: 'used unusually little sadness language',
  nrc_trust: 'used unusually little trust language',
  nrc_anticipation: 'used unusually little anticipation language',
};

interface Insight { text: string; space?: 'behavioral' | 'semantic'; dimension?: string; magnitude?: number; }
interface Arc { text: string; space: 'behavioral' | 'semantic'; dimension: string; direction: 'rising' | 'falling'; length: number; }
interface Discovery { text: string; evidence: string; strength: 'strong' | 'moderate'; source: 'behavioral' | 'semantic' | 'emotion-behavior'; }

export const GET: APIRoute = async () => {
  try {
    // Behavioral states + dynamics
    const behavioralStates = db.prepare(`
      SELECT es.response_id, q.scheduled_for as date,
             es.fluency, es.deliberation, es.revision,
             es.commitment, es.volatility, es.thermal, es.presence, es.convergence
      FROM tb_entry_states es
      JOIN tb_responses r ON es.response_id = r.response_id
      JOIN tb_questions q ON r.question_id = q.question_id
      ORDER BY es.entry_state_id ASC
    `).all() as any[];

    const behavioralCount = behavioralStates.length;
    const behavioralDynamics = db.prepare(`
      SELECT dimension, baseline, variability, attractor_force, current_state, deviation
      FROM tb_trait_dynamics
      WHERE entry_count = ?
    `).all(behavioralCount) as any[];
    const behavioralDynMap = new Map(behavioralDynamics.map((d: any) => [d.dimension, d]));

    // Semantic states + dynamics
    const semanticStates = db.prepare(`
      SELECT response_id,
             syntactic_complexity, interrogation, self_focus, uncertainty,
             cognitive_processing,
             nrc_anger, nrc_fear, nrc_joy, nrc_sadness, nrc_trust, nrc_anticipation,
             convergence as semantic_convergence
      FROM tb_semantic_states
      ORDER BY semantic_state_id ASC
    `).all() as any[];

    const semanticCount = semanticStates.length;
    const semanticDynamics = db.prepare(`
      SELECT dimension, baseline, variability, attractor_force, current_state, deviation
      FROM tb_semantic_dynamics
      WHERE entry_count = ?
    `).all(semanticCount) as any[];
    const semanticDynMap = new Map(semanticDynamics.map((d: any) => [d.dimension, d]));

    // Couplings
    const behavioralCouplings = db.prepare(`
      SELECT leader, follower, lag_sessions, correlation, direction
      FROM tb_coupling_matrix
      WHERE entry_count = (SELECT MAX(entry_count) FROM tb_coupling_matrix)
      ORDER BY correlation DESC
    `).all() as any[];

    const semanticCouplings = db.prepare(`
      SELECT leader, follower, lag_sessions, correlation, direction
      FROM tb_semantic_coupling
      WHERE entry_count = (SELECT MAX(entry_count) FROM tb_semantic_coupling)
      ORDER BY correlation DESC
    `).all() as any[];

    const emotionCouplings = db.prepare(`
      SELECT emotion_dim, behavior_dim, lag_sessions, correlation, direction
      FROM tb_emotion_behavior_coupling
      WHERE entry_count = (SELECT MAX(entry_count) FROM tb_emotion_behavior_coupling)
      ORDER BY correlation DESC
    `).all() as any[];

    // ---- 1. RIGHT NOW: notable deviations on the latest entry ----
    const rightNow: Insight[] = [];

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
        const intensity = absD > 2 ? 'This is rare — ' : '';
        rightNow.push({
          text: `${intensity}You ${desc}. ${absD.toFixed(1)}σ from your behavioral baseline.`,
          space: 'behavioral',
          dimension: n.dim,
          magnitude: absD,
        });
      }

      if (latest.convergence > 0.7) {
        rightNow.push({ text: 'Multiple behavioral dimensions moved together — your process signature shifted as a whole.' });
      } else if (latest.convergence < 0.2 && behavioralStates.length > 5) {
        rightNow.push({ text: 'You wrote very close to your behavioral center today.' });
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
        const intensity = absD > 2 ? 'This is rare — ' : '';
        rightNow.push({
          text: `${intensity}You ${desc}. ${absD.toFixed(1)}σ from your semantic baseline.`,
          space: 'semantic',
          dimension: n.dim,
          magnitude: absD,
        });
      }
    }

    if (rightNow.length === 0) {
      rightNow.push({ text: 'Nothing unusual today. All dimensions within normal range.' });
    }

    // ---- 2. ARCS: sustained monotonic runs ----
    const arcs: Arc[] = [];
    function detectArcs(
      stateRows: any[],
      dims: ReadonlyArray<string>,
      space: 'behavioral' | 'semantic',
    ) {
      if (stateRows.length < 4) return;
      for (const dim of dims) {
        const values = stateRows.map(s => s[dim] as number);
        const last = values.length - 1;
        if (last < 1) continue;
        const direction = values[last] > values[last - 1] ? 'rising' : 'falling';
        let runLen = 1;
        for (let i = last; i > 0; i--) {
          if (direction === 'rising' && values[i] > values[i - 1]) runLen++;
          else if (direction === 'falling' && values[i] < values[i - 1]) runLen++;
          else break;
        }
        if (runLen >= 3) {
          const verb = direction === 'rising' ? 'climbing' : 'declining';
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

    // ---- 3. DISCOVERIES: top couplings ----
    const discoveries: Discovery[] = [];
    function pushCouplings(rows: any[], source: 'behavioral' | 'semantic', topN: number) {
      const sorted = [...rows].sort((a: any, b: any) => Math.abs(b.correlation) - Math.abs(a.correlation));
      for (const c of sorted.slice(0, topN)) {
        const absR = Math.abs(c.correlation);
        if (absR < 0.3) continue;
        const leader = DIM_PLAIN[c.leader] || c.leader;
        const follower = DIM_PLAIN[c.follower] || c.follower;
        const lagLabel = c.lag_sessions === 0 ? 'at the same time' : `${c.lag_sessions} session${c.lag_sessions > 1 ? 's' : ''} later`;
        const text = c.direction < 0
          ? `When your ${leader} increases, your ${follower} drops ${lagLabel}.`
          : `Your ${leader} and ${follower} move together ${lagLabel}.`;
        discoveries.push({
          text,
          evidence: `r=${c.direction > 0 ? '+' : '-'}${absR.toFixed(2)}`,
          strength: absR >= 0.5 ? 'strong' : 'moderate',
          source,
        });
      }
    }
    pushCouplings(behavioralCouplings, 'behavioral', 4);
    pushCouplings(semanticCouplings, 'semantic', 3);

    // Emotion → behavior cross-domain
    const sortedEmo = [...emotionCouplings].sort((a: any, b: any) => Math.abs(b.correlation) - Math.abs(a.correlation));
    for (const c of sortedEmo.slice(0, 3)) {
      const absR = Math.abs(c.correlation);
      if (absR < 0.3) continue;
      const EMO_PLAIN: Record<string, string> = {
        anger: 'anger language', fear: 'fear language', joy: 'joy language',
        sadness: 'sadness language', trust: 'trust language', anticipation: 'anticipation language',
        cognitive: 'reasoning language', hedging: 'hedging language', firstPerson: 'first-person pronouns',
      };
      const emotion = EMO_PLAIN[c.emotion_dim] || c.emotion_dim;
      const behavior = DIM_PLAIN[c.behavior_dim] || c.behavior_dim;
      const lagLabel = c.lag_sessions === 0 ? 'in the same session' : `${c.lag_sessions} session${c.lag_sessions > 1 ? 's' : ''} later`;
      const effect = c.direction > 0 ? 'increases' : 'drops';
      discoveries.push({
        text: `When ${emotion} increases in your writing, ${behavior} ${effect} ${lagLabel}.`,
        evidence: `r=${c.direction > 0 ? '+' : '-'}${absR.toFixed(2)}`,
        strength: absR >= 0.5 ? 'strong' : 'moderate',
        source: 'emotion-behavior',
      });
    }

    return new Response(JSON.stringify({
      rightNow,
      arcs,
      discoveries,
      behavioralCount,
      semanticCount,
      latestDate: behavioralStates.length > 0 ? behavioralStates[behavioralStates.length - 1].date : null,
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Synthesis error:', err?.message || err);
    return new Response(JSON.stringify({ error: 'Failed to synthesize', detail: err?.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
