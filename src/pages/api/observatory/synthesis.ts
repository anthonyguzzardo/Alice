/**
 * Observatory Synthesis API
 *
 * PURPOSE: Compute narrative insights from behavioral data.
 * Instead of returning raw states/couplings for the client to interpret,
 * this endpoint finds what's interesting and says it in words.
 *
 * Returns:
 *   - rightNow: what's unusual about the latest entry
 *   - arcs: sustained trends (monotonic runs, drift from baseline)
 *   - movements: recent prediction resolutions and theory shifts
 *   - discoveries: top behavioral couplings in plain English
 */
import type { APIRoute } from 'astro';
import simDb from '../../../lib/sim-db.ts';

const DIMS = ['fluency', 'deliberation', 'revision', 'expression', 'commitment', 'volatility', 'thermal', 'presence'] as const;

const DIM_PLAIN: Record<string, string> = {
  fluency: 'writing flow',
  deliberation: 'hesitation',
  revision: 'rewriting',
  expression: 'stylistic departure',
  commitment: 'commitment to what you wrote',
  volatility: 'behavioral instability',
  thermal: 'correction intensity',
  presence: 'focus',
};

const DIM_HIGH: Record<string, string> = {
  fluency: 'wrote with unusually sustained flow',
  deliberation: 'paused and hesitated more than usual',
  revision: 'rewrote significantly more than normal',
  expression: 'departed from your typical style',
  commitment: 'kept almost everything you typed',
  volatility: 'shifted sharply from your previous entry',
  thermal: 'corrected yourself with unusual intensity',
  presence: 'stayed deeply focused throughout',
};

const DIM_LOW: Record<string, string> = {
  fluency: 'wrote in shorter, more fragmented bursts',
  deliberation: 'dove in without much hesitation',
  revision: 'barely revised at all',
  expression: 'wrote very close to your usual style',
  commitment: 'deleted a lot of what you typed',
  volatility: 'was remarkably consistent with your previous entry',
  thermal: 'made very few corrections',
  presence: 'was more distracted than usual',
};

interface Insight {
  text: string;
  dimension?: string;
  magnitude?: number;
}

interface Arc {
  text: string;
  dimension: string;
  direction: 'rising' | 'falling';
  length: number;
}

interface Movement {
  type: 'confirmed' | 'falsified' | 'theory_established' | 'theory_retired';
  text: string;
  date: string;
}

interface Discovery {
  text: string;
  evidence: string;
  strength: 'strong' | 'moderate';
}

export const GET: APIRoute = async () => {
  try {
    // ---- Fetch all data ----
    const states = simDb.prepare(`
      SELECT es.response_id, q.scheduled_for as date, q.text as question,
             es.fluency, es.deliberation, es.revision, es.expression,
             es.commitment, es.volatility, es.thermal, es.presence, es.convergence
      FROM tb_entry_states es
      JOIN tb_responses r ON es.response_id = r.response_id
      JOIN tb_questions q ON r.question_id = q.question_id
      ORDER BY es.entry_state_id ASC
    `).all() as any[];

    const entryCount = states.length;

    const dynamics = simDb.prepare(`
      SELECT dimension, baseline, variability, attractor_force, current_state, deviation
      FROM tb_trait_dynamics
      WHERE entry_count = ?
    `).all(entryCount) as any[];

    const couplings = simDb.prepare(`
      SELECT leader, follower, lag_sessions, correlation, direction
      FROM tb_coupling_matrix
      WHERE entry_count = ?
      ORDER BY correlation DESC
    `).all(entryCount) as any[];

    const emotionCouplings = simDb.prepare(`
      SELECT emotion_dim, behavior_dim, lag_sessions, correlation, direction
      FROM tb_emotion_behavior_coupling
      WHERE entry_count = ?
      ORDER BY correlation DESC
    `).all(entryCount) as any[];

    // Theories + graded predictions archived 2026-04-16; synthesis no longer
    // references them. Data preserved under zz_archive_*_20260416.
    const theories: any[] = [];
    const gradedPredictions: any[] = [];

    // ---- 1. RIGHT NOW: what's unusual about the latest entry ----
    const rightNow: Insight[] = [];
    if (states.length > 0) {
      const latest = states[states.length - 1];
      const dynMap = new Map(dynamics.map((d: any) => [d.dimension, d]));

      // Find dimensions with |deviation| > 1σ, sorted by magnitude
      const notable = DIMS
        .map(dim => {
          const dyn = dynMap.get(dim);
          const deviation = dyn ? dyn.deviation : latest[dim];
          return { dim, value: latest[dim] as number, deviation: deviation as number };
        })
        .filter(d => Math.abs(d.deviation) > 1)
        .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));

      for (const n of notable.slice(0, 3)) {
        const absD = Math.abs(n.deviation);
        const desc = n.deviation > 0 ? DIM_HIGH[n.dim] : DIM_LOW[n.dim];
        const intensity = absD > 2 ? 'This is rare — ' : '';
        rightNow.push({
          text: `${intensity}You ${desc}. ${absD.toFixed(1)}σ from your baseline.`,
          dimension: n.dim,
          magnitude: absD,
        });
      }

      // Convergence insight
      if (latest.convergence > 0.7) {
        rightNow.push({
          text: 'Multiple dimensions moved together — your behavioral signature shifted as a whole, not just one trait.',
        });
      } else if (latest.convergence < 0.2 && states.length > 5) {
        rightNow.push({
          text: 'You wrote very close to your personal center today. All dimensions near baseline.',
        });
      }

      if (rightNow.length === 0) {
        rightNow.push({ text: 'Nothing unusual today. All dimensions within normal range.' });
      }
    }

    // ---- 2. ARCS: sustained trends ----
    const arcs: Arc[] = [];
    if (states.length >= 4) {
      for (const dim of DIMS) {
        const values = states.map(s => s[dim] as number);
        // Find current monotonic run from the end
        let runLen = 1;
        const last = values.length - 1;
        const direction = values[last] > values[last - 1] ? 'rising' : 'falling';
        for (let i = last; i > 0; i--) {
          if (direction === 'rising' && values[i] > values[i - 1]) {
            runLen++;
          } else if (direction === 'falling' && values[i] < values[i - 1]) {
            runLen++;
          } else {
            break;
          }
        }

        if (runLen >= 3) {
          // Check if this is the longest run in history for this dimension
          let longestRun = 0;
          let currentRun = 1;
          for (let i = 1; i < values.length; i++) {
            const dir = values[i] > values[i - 1] ? 'rising' : 'falling';
            if ((dir === 'rising' && values[i] > values[i - 1]) ||
                (dir === 'falling' && values[i] < values[i - 1])) {
              // Check same direction as previous step
              const prevDir = i > 1 ? (values[i - 1] > values[i - 2] ? 'rising' : 'falling') : dir;
              if (dir === prevDir) {
                currentRun++;
              } else {
                currentRun = 2;
              }
            } else {
              currentRun = 1;
            }
            longestRun = Math.max(longestRun, currentRun);
          }

          const plain = DIM_PLAIN[dim];
          const isRecord = runLen >= longestRun;
          const qualifier = isRecord ? ' — the longest sustained move in your history' : '';
          const verb = direction === 'rising' ? 'climbing' : 'declining';

          arcs.push({
            text: `${capitalize(plain)} has been ${verb} for ${runLen} straight sessions${qualifier}.`,
            dimension: dim,
            direction,
            length: runLen,
          });
        }
      }

      // Sort by run length, keep top 3
      arcs.sort((a, b) => b.length - a.length);
      arcs.splice(3);
    }

    // ---- 3. MOVEMENTS: recent prediction/theory activity ----
    const movements: Movement[] = [];

    // Recent predictions (last 5 graded)
    for (const p of gradedPredictions.slice(0, 5)) {
      const verb = p.status === 'confirmed' ? 'held up' : 'didn\'t hold';
      const date = p.dttm_graded_utc?.slice(0, 10) || 'unknown';
      movements.push({
        type: p.status,
        text: `"${truncate(p.hypothesis, 100)}" — ${verb}.${p.grade_rationale ? ' ' + truncate(p.grade_rationale, 80) : ''}`,
        date,
      });
    }

    // Theory status changes
    for (const t of theories) {
      if (t.status === 'established' || t.status === 'retired') {
        const posteriorMean = t.alpha / (t.alpha + t.beta);
        const parts = t.theory_key.split(':');
        const name = parts.length === 2 ? parts[1].replace(/_/g, ' ') : t.theory_key.replace(/_/g, ' ');
        const verb = t.status === 'established' ? 'has enough evidence to stand' : 'was retired';
        movements.push({
          type: t.status === 'established' ? 'theory_established' : 'theory_retired',
          text: `Theory "${name}" ${verb}. ${t.total_predictions} predictions, posterior ${(posteriorMean * 100).toFixed(0)}%.`,
          date: '',
        });
      }
    }

    // ---- 4. DISCOVERIES: top couplings in plain English ----
    const discoveries: Discovery[] = [];
    const sortedCouplings = [...couplings].sort((a: any, b: any) => Math.abs(b.correlation) - Math.abs(a.correlation));

    for (const c of sortedCouplings.slice(0, 4)) {
      const absR = Math.abs(c.correlation);
      if (absR < 0.3) continue;

      const leader = DIM_PLAIN[c.leader] || c.leader;
      const follower = DIM_PLAIN[c.follower] || c.follower;
      const lagLabel = c.lag_sessions === 0 ? 'at the same time' : `${c.lag_sessions} session${c.lag_sessions > 1 ? 's' : ''} later`;

      let text: string;
      if (c.direction < 0) {
        text = `When your ${leader} increases, your ${follower} drops ${lagLabel}.`;
      } else {
        text = `Your ${leader} and ${follower} move together ${lagLabel}.`;
      }

      discoveries.push({
        text,
        evidence: `r=${c.direction > 0 ? '+' : '-'}${absR.toFixed(2)}`,
        strength: absR >= 0.5 ? 'strong' : 'moderate',
      });
    }

    // Top emotion coupling
    const sortedEmotion = [...emotionCouplings].sort((a: any, b: any) => Math.abs(b.correlation) - Math.abs(a.correlation));
    for (const c of sortedEmotion.slice(0, 2)) {
      const absR = Math.abs(c.correlation);
      if (absR < 0.3) continue;

      const EMOTION_PLAIN: Record<string, string> = {
        anger: 'anger language', fear: 'fear language', joy: 'joy language',
        sadness: 'sadness language', trust: 'trust language', anticipation: 'anticipation language',
        cognitive: 'reasoning language', hedging: 'hedging language', firstPerson: 'first-person pronouns',
      };
      const emotion = EMOTION_PLAIN[c.emotion_dim] || c.emotion_dim;
      const behavior = DIM_PLAIN[c.behavior_dim] || c.behavior_dim;
      const lagLabel = c.lag_sessions === 0 ? 'in the same session' : `${c.lag_sessions} session${c.lag_sessions > 1 ? 's' : ''} later`;
      const effect = c.direction > 0 ? 'increases' : 'drops';

      discoveries.push({
        text: `When ${emotion} increases in your writing, ${behavior} ${effect} ${lagLabel}.`,
        evidence: `r=${c.direction > 0 ? '+' : '-'}${absR.toFixed(2)}`,
        strength: absR >= 0.5 ? 'strong' : 'moderate',
      });
    }

    return new Response(JSON.stringify({
      rightNow,
      arcs,
      movements,
      discoveries,
      entryCount,
      latestDate: states.length > 0 ? states[states.length - 1].date : null,
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

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '\u2026' : s;
}
