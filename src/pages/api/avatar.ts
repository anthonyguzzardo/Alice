import type { APIRoute } from 'astro';
import sql from '../../lib/libDbPool.ts';
import { parseBody } from '../../lib/utlParseBody.ts';
import { createRequire } from 'node:module';

/**
 * Avatar text generation — Rust Markov chain + timing synthesis.
 *
 * Builds a word-level Markov chain from the journal corpus in native
 * Rust, seeds it with topic words, generates text following the person's
 * transition probabilities, and pairs each character with a delay from
 * their motor profile. No LLM. Pure math.
 */

// Load native Rust module (same pattern as libSignalsNative.ts)
let nativeModule: any = null;
try {
  const require = createRequire(import.meta.url);
  nativeModule = require('../../../src-rs/alice-signals.darwin-arm64.node');
} catch {
  // Rust engine not built; avatar unavailable
}

export const POST: APIRoute = async ({ request }) => {
  if (!nativeModule?.generateAvatar) {
    return new Response(JSON.stringify({ error: 'Rust engine not available. Run npm run build:rust.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await parseBody<{ topic: string; maxWords?: number }>(request);
  if (!body?.topic?.trim()) {
    return new Response(JSON.stringify({ error: 'Missing topic' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Fetch all response texts (journal + calibration)
  const textRows = await sql`
    SELECT r.text
    FROM tb_responses r
    JOIN tb_questions q ON r.question_id = q.question_id
    ORDER BY q.scheduled_for ASC
  ` as Array<{ text: string }>;

  if (textRows.length < 3) {
    return new Response(JSON.stringify({ error: 'Not enough data yet. Need at least 3 journal entries.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Fetch timing + revision profile
  const profileRows = await sql`
    SELECT digraph_aggregate_json,
           ex_gaussian_mu_mean, ex_gaussian_sigma_mean, ex_gaussian_tau_mean,
           burst_length_mean,
           pause_between_word_pct, pause_between_sent_pct,
           first_keystroke_mean,
           small_del_rate_mean, large_del_rate_mean,
           revision_timing_bias, r_burst_ratio_mean,
           session_count
    FROM tb_personal_profile
    LIMIT 1
  `;

  const p = profileRows[0] as any || {};

  // Build inputs for Rust
  const corpusJson = JSON.stringify(textRows.map(r => r.text));
  const profileJson = JSON.stringify({
    digraph: typeof p.digraph_aggregate_json === 'string'
      ? JSON.parse(p.digraph_aggregate_json)
      : p.digraph_aggregate_json || null,
    mu: p.ex_gaussian_mu_mean ?? null,
    sigma: p.ex_gaussian_sigma_mean ?? null,
    tau: p.ex_gaussian_tau_mean ?? null,
    burst_length: p.burst_length_mean ?? null,
    pause_between_pct: p.pause_between_word_pct ?? null,
    pause_sent_pct: p.pause_between_sent_pct ?? null,
    first_keystroke: p.first_keystroke_mean ?? null,
    small_del_rate: p.small_del_rate_mean ?? null,
    large_del_rate: p.large_del_rate_mean ?? null,
    revision_timing_bias: p.revision_timing_bias ?? null,
    r_burst_ratio: p.r_burst_ratio_mean ?? null,
  });

  const maxWords = body.maxWords ?? 150;

  // Call Rust
  const result = nativeModule.generateAvatar(
    corpusJson,
    body.topic.trim(),
    profileJson,
    maxWords,
  );

  return new Response(JSON.stringify({
    text: result.text,
    delays: result.delays,
    keystrokeStreamJson: result.keystrokeStreamJson,
    wordCount: result.wordCount,
    markovOrder: result.order,
    chainSize: result.chainSize,
    sessionCount: p.session_count ?? 0,
    corpusSize: textRows.length,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
