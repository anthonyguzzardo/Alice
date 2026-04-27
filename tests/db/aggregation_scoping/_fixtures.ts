/**
 * Two-subject fixture helpers for the aggregation scoping test suite
 * (migration 030 Step 6, see db/sql/migrations/030_STEP6_PLAN.md).
 *
 * Every test in this directory verifies that an aggregation site returns
 * within-subject results under a deliberately-mixed two-subject database.
 * The fixture pattern:
 *
 *   - subject_id 1 = "owner" with a CHARACTERISTIC PROFILE (low timing,
 *     short bursts, high mattr, owner-distinct vocabulary)
 *   - subject_id 999 = "other" with a DELIBERATELY-OFFSET PROFILE (10x
 *     timing, long bursts, low mattr, non-overlapping vocabulary)
 *
 * Offset means at the per-row level (e.g. ex_gaussian_mu = 100 vs 1000)
 * give every aggregation a chance to fail loudly: if a function pools the
 * two populations, the resulting mean is somewhere in between (e.g. 550)
 * — a value the assertions can detect that no correct within-subject
 * computation could ever produce.
 *
 * No table truncation is exposed here. Test files own their `beforeEach`
 * cleanup; this module only writes rows.
 */

import type { Sql } from 'postgres';

// ----------------------------------------------------------------------------
// Identity constants
// ----------------------------------------------------------------------------
//
// We deliberately use IDs OUTSIDE the production convention (owner = 1).
// The db test project shares one Postgres container across all test files
// and runs them in concurrent forks; subjectAuth.test.ts seeds an owner row
// at subject_id = 1 in beforeAll and depends on it surviving across its
// tests. Truncating tb_subjects (or inserting a row with id = 1) from this
// fixture would clobber that state. Using 1001/1002 lets the aggregation
// tests own their cleanup window without touching anyone else's rows.
//
// The function under test (updateProfile etc.) is generic — subject_id is
// passed as an argument, not hard-coded — so any positive integer works.

export const OWNER_ID = 1001;
export const OTHER_ID = 1002;

/** Tables this fixture writes to — used by callers' beforeEach for
 *  scoped cleanup via WHERE subject_id IN (...). */
export const FIXTURE_OWNED_SUBJECT_IDS = [OWNER_ID, OTHER_ID] as const;

// ----------------------------------------------------------------------------
// Profile constants — every value here is a measurable claim
// ----------------------------------------------------------------------------

export interface ProfileFixture {
  // Motor (tb_motor_signals)
  exGaussianMu: number;
  exGaussianSigma: number;
  exGaussianTau: number;
  digraphLatencyJson: Record<string, number>;
  ikiAutocorrelationJson: number[];
  holdFlightRankCorr: number;
  // Session summary (tb_session_summaries)
  totalDurationMs: number;
  wordCount: number;
  totalCharsTyped: number;
  firstKeystrokeMs: number;
  commitmentRatio: number;
  pauseCount: number;
  activeTypingMs: number;
  totalPauseMs: number;
  totalTabAwayMs: number;
  ikiMean: number;
  ikiStd: number;
  ikiSkewness: number;
  ikiKurtosis: number;
  holdTimeMean: number;
  holdTimeStd: number;
  holdTimeCv: number;
  flightTimeMean: number;
  flightTimeStd: number;
  pBurstCount: number;
  avgPBurstLength: number;
  smallDeletionCount: number;
  largeDeletionCount: number;
  largeDeletionChars: number;
  firstHalfDeletionChars: number;
  secondHalfDeletionChars: number;
  mattr: number;
  // Process (tb_process_signals)
  pauseWithinWord: number;
  pauseBetweenWord: number;
  pauseBetweenSentence: number;
  rBurstCount: number;
  iBurstCount: number;
  // Burst sequence shape — each session inserts these N rows
  burstCharCounts: number[];      // for tb_burst_sequences
  rburstDeletedCounts: number[];  // for tb_rburst_sequences
  rburstDurationMs: number;       // shared duration for r-bursts in this profile
  rburstIsLeadingEdge: boolean;   // shared flag for r-bursts in this profile
  // Language (tb_responses.text)
  // NB: each session gets a unique text but containing this signature word
  signatureWord: string;
  signatureTrigramPrefix: string; // a 2-char prefix unique to this profile
}

/**
 * OWNER profile: short timing, compact bursts, owner-only vocabulary.
 * The numbers below are pinned by tests — change them and the assertions
 * in the test files break.
 */
export const OWNER_PROFILE: ProfileFixture = {
  exGaussianMu: 100,
  exGaussianSigma: 20,
  exGaussianTau: 50,
  // Bigrams pinned to characters that appear in the OWNER body text (built
  // from signatureWord 'alphabravo' + filler), and that do NOT appear
  // anywhere in the OTHER body text (built from 'zetafoxtrot' + filler).
  digraphLatencyJson: { al: 110, br: 95 },
  ikiAutocorrelationJson: [0.4, 0.2, 0.1],
  holdFlightRankCorr: 0.3,
  totalDurationMs: 60_000,
  wordCount: 50,
  totalCharsTyped: 250,
  firstKeystrokeMs: 800,
  commitmentRatio: 0.9,
  pauseCount: 5,
  activeTypingMs: 50_000,
  totalPauseMs: 8_000,
  totalTabAwayMs: 2_000,
  ikiMean: 100,
  ikiStd: 25,
  ikiSkewness: 0.2,
  ikiKurtosis: 3.0,
  holdTimeMean: 50,
  holdTimeStd: 10,
  holdTimeCv: 0.2,
  flightTimeMean: 50,
  flightTimeStd: 10,
  pBurstCount: 5,
  avgPBurstLength: 10,
  smallDeletionCount: 5,
  largeDeletionCount: 1,
  largeDeletionChars: 8,
  firstHalfDeletionChars: 2,   // owner revises early
  secondHalfDeletionChars: 6,
  mattr: 0.7,
  pauseWithinWord: 10,         // 10 / 16 = 0.625 within-pct
  pauseBetweenWord: 5,
  pauseBetweenSentence: 1,
  rBurstCount: 4,
  iBurstCount: 2,              // r/i ratio = 4/6 = 0.667
  burstCharCounts: [5, 5, 15, 15], // burst_consolidation = 15/5 = 3.0
  rburstDeletedCounts: [5, 5, 5, 5],
  rburstDurationMs: 200,
  rburstIsLeadingEdge: true,
  signatureWord: 'alphabravo',
  signatureTrigramPrefix: 'al',
};

/**
 * OTHER profile: 10x timing, long bursts, non-overlapping vocabulary.
 */
export const OTHER_PROFILE: ProfileFixture = {
  exGaussianMu: 1000,
  exGaussianSigma: 200,
  exGaussianTau: 500,
  // Bigrams unique to OTHER body text (from 'zetafoxtrot' + filler) and
  // absent from any owner text.
  digraphLatencyJson: { ze: 1100, ox: 950 },
  ikiAutocorrelationJson: [-0.4, -0.2, -0.1],
  holdFlightRankCorr: -0.3,
  totalDurationMs: 600_000,
  wordCount: 500,
  totalCharsTyped: 2_500,
  firstKeystrokeMs: 8_000,
  commitmentRatio: 0.4,
  pauseCount: 50,
  activeTypingMs: 500_000,
  totalPauseMs: 80_000,
  totalTabAwayMs: 20_000,
  ikiMean: 1000,
  ikiStd: 250,
  ikiSkewness: -0.2,
  ikiKurtosis: 5.0,
  holdTimeMean: 500,
  holdTimeStd: 100,
  holdTimeCv: 0.4,
  flightTimeMean: 500,
  flightTimeStd: 100,
  pBurstCount: 50,
  avgPBurstLength: 100,
  smallDeletionCount: 50,
  largeDeletionCount: 10,
  largeDeletionChars: 80,
  firstHalfDeletionChars: 60,  // other revises late — opposite signature
  secondHalfDeletionChars: 20,
  mattr: 0.4,
  pauseWithinWord: 1,          // 1 / 16 = 0.0625 within-pct (opposite of owner)
  pauseBetweenWord: 5,
  pauseBetweenSentence: 10,
  rBurstCount: 1,
  iBurstCount: 9,              // r/i ratio = 1/10 = 0.1 (opposite of owner)
  burstCharCounts: [100, 100, 50, 50], // burst_consolidation = 50/100 = 0.5
  rburstDeletedCounts: [50, 50, 50, 50],
  rburstDurationMs: 2_000,
  rburstIsLeadingEdge: false,
  signatureWord: 'zetafoxtrot',
  signatureTrigramPrefix: 'ze',
};

// ----------------------------------------------------------------------------
// Subject seeding
// ----------------------------------------------------------------------------

/**
 * Insert both subjects into tb_subjects. Idempotent in the sense that a
 * caller's TRUNCATE before-step already handles cleanup; this writes fresh
 * rows. Uses OVERRIDING SYSTEM VALUE because subject_id is GENERATED ALWAYS
 * and tests need stable, predictable IDs.
 */
export async function seedTwoSubjects(sql: Sql): Promise<void> {
  // Both subjects are non-owner. The "owner" name in OWNER_PROFILE refers
  // to the test role (the subject whose data the test queries), NOT the
  // production owner — that lives at subject_id = 1, owned by other test
  // files, and is intentionally untouched here. is_owner = FALSE on both
  // rows because the schema enforces a single-owner unique index.
  await sql`
    INSERT INTO tb_subjects (subject_id, username, password_hash, is_owner, must_reset_password, iana_timezone)
    OVERRIDING SYSTEM VALUE
    VALUES
      (${OWNER_ID}, ${`scoping-test-owner-${OWNER_ID}`}, 'placeholder-hash', FALSE, FALSE, 'UTC'),
      (${OTHER_ID}, ${`scoping-test-other-${OTHER_ID}`}, 'placeholder-hash', FALSE, FALSE, 'UTC')
  `;
}

// ----------------------------------------------------------------------------
// Session insertion
// ----------------------------------------------------------------------------

/**
 * Body text constructed from a profile's signatureWord. Keeps the trigram
 * prefix detectable while using filler that won't accidentally collide with
 * the other profile's signature.
 */
function makeBodyText(profile: ProfileFixture, sessionIndex: number): string {
  const w = profile.signatureWord;
  // Each session repeats the signature word enough to populate the trigram
  // model. Filler words avoid lexical overlap between profiles.
  return [
    `${w} ${w} ${w}`,
    `session number ${sessionIndex} contains ${w} repeated`,
    `${w} appears here too for vocabulary coverage`,
  ].join(' ');
}

interface InsertSessionOptions {
  subjectId: number;
  profile: ProfileFixture;
  scheduledFor: string; // 'YYYY-MM-DD'
  sessionIndex: number; // 0-based; used for distinguishing texts
  questionSourceId?: number; // default 1 (journal); 3 = calibration
  deviceType?: string;       // default 'test'; calibration baselines bin by this
}

/**
 * Insert a complete journal session for one subject: question, response,
 * session summary, motor signals, process signals, burst + r-burst
 * sequences. Returns the new question_id.
 *
 * One call = one session's worth of rows in every aggregation-relevant
 * table. Tests build fixtures by calling this N times per subject.
 */
export async function insertJournalSession(
  sql: Sql,
  opts: InsertSessionOptions,
): Promise<number> {
  const { subjectId, profile, scheduledFor, sessionIndex } = opts;
  const sourceId = opts.questionSourceId ?? 1;
  const deviceType = opts.deviceType ?? 'test';
  const text = makeBodyText(profile, sessionIndex);

  // tb_questions. Calibration sessions (sourceId=3) have NULL scheduled_for in
  // production (they're triggered, not scheduled); we still pass scheduledFor
  // here for fixture predictability — the libCalibrationDrift baseline reads
  // tb_session_summaries directly and doesn't gate on scheduled_for.
  const [qRow] = await sql`
    INSERT INTO tb_questions (subject_id, text, question_source_id, scheduled_for)
    VALUES (${subjectId}, ${`q for ${profile.signatureWord} session ${sessionIndex}`}, ${sourceId}, ${scheduledFor})
    RETURNING question_id
  `;
  const questionId = (qRow as { question_id: number }).question_id;

  // tb_responses
  await sql`
    INSERT INTO tb_responses (subject_id, question_id, text)
    VALUES (${subjectId}, ${questionId}, ${text})
  `;

  // tb_session_summaries
  const p = profile;
  await sql`
    INSERT INTO tb_session_summaries (
      subject_id, question_id,
      first_keystroke_ms, total_duration_ms,
      total_chars_typed, final_char_count, commitment_ratio,
      pause_count, total_pause_ms, deletion_count, largest_deletion,
      total_chars_deleted, tab_away_count, total_tab_away_ms,
      word_count, sentence_count,
      small_deletion_count, large_deletion_count, large_deletion_chars,
      first_half_deletion_chars, second_half_deletion_chars,
      active_typing_ms, chars_per_minute,
      p_burst_count, avg_p_burst_length,
      inter_key_interval_mean, inter_key_interval_std,
      iki_skewness, iki_kurtosis,
      hold_time_mean, hold_time_std, hold_time_cv,
      flight_time_mean, flight_time_std,
      mattr,
      device_type, hour_of_day, day_of_week
    ) VALUES (
      ${subjectId}, ${questionId},
      ${p.firstKeystrokeMs}, ${p.totalDurationMs},
      ${p.totalCharsTyped}, ${p.totalCharsTyped}, ${p.commitmentRatio},
      ${p.pauseCount}, ${p.totalPauseMs}, ${p.smallDeletionCount + p.largeDeletionCount}, ${p.largeDeletionChars},
      ${p.largeDeletionChars + p.smallDeletionCount}, 0, ${p.totalTabAwayMs},
      ${p.wordCount}, 5,
      ${p.smallDeletionCount}, ${p.largeDeletionCount}, ${p.largeDeletionChars},
      ${p.firstHalfDeletionChars}, ${p.secondHalfDeletionChars},
      ${p.activeTypingMs}, ${(p.totalCharsTyped / (p.activeTypingMs / 60000))},
      ${p.pBurstCount}, ${p.avgPBurstLength},
      ${p.ikiMean}, ${p.ikiStd},
      ${p.ikiSkewness}, ${p.ikiKurtosis},
      ${p.holdTimeMean}, ${p.holdTimeStd}, ${p.holdTimeCv},
      ${p.flightTimeMean}, ${p.flightTimeStd},
      ${p.mattr},
      ${deviceType}, 12, 3
    )
  `;

  // tb_motor_signals
  await sql`
    INSERT INTO tb_motor_signals (
      subject_id, question_id,
      ex_gaussian_mu, ex_gaussian_sigma, ex_gaussian_tau,
      digraph_latency_json, iki_autocorrelation_json, hold_flight_rank_corr
    ) VALUES (
      ${subjectId}, ${questionId},
      ${p.exGaussianMu}, ${p.exGaussianSigma}, ${p.exGaussianTau},
      ${JSON.stringify(p.digraphLatencyJson)}::jsonb,
      ${JSON.stringify(p.ikiAutocorrelationJson)}::jsonb,
      ${p.holdFlightRankCorr}
    )
  `;

  // tb_process_signals
  await sql`
    INSERT INTO tb_process_signals (
      subject_id, question_id,
      pause_within_word, pause_between_word, pause_between_sentence,
      r_burst_count, i_burst_count
    ) VALUES (
      ${subjectId}, ${questionId},
      ${p.pauseWithinWord}, ${p.pauseBetweenWord}, ${p.pauseBetweenSentence},
      ${p.rBurstCount}, ${p.iBurstCount}
    )
  `;

  // tb_burst_sequences (one row per char count in profile.burstCharCounts)
  for (let i = 0; i < p.burstCharCounts.length; i++) {
    await sql`
      INSERT INTO tb_burst_sequences (
        subject_id, question_id, burst_index, burst_char_count,
        burst_duration_ms, burst_start_offset_ms
      ) VALUES (
        ${subjectId}, ${questionId}, ${i}, ${p.burstCharCounts[i]!},
        500, ${i * 1000}
      )
    `;
  }

  // tb_rburst_sequences
  for (let i = 0; i < p.rburstDeletedCounts.length; i++) {
    await sql`
      INSERT INTO tb_rburst_sequences (
        subject_id, question_id, burst_index, deleted_char_count, total_char_count,
        burst_duration_ms, burst_start_offset_ms, is_leading_edge
      ) VALUES (
        ${subjectId}, ${questionId}, ${i}, ${p.rburstDeletedCounts[i]!}, ${p.rburstDeletedCounts[i]! * 2},
        ${p.rburstDurationMs}, ${i * 2000}, ${p.rburstIsLeadingEdge}
      )
    `;
  }

  return questionId;
}

// ----------------------------------------------------------------------------
// Two-subject convenience
// ----------------------------------------------------------------------------

export interface TwoSubjectFixture {
  ownerQuestionIds: number[];
  otherQuestionIds: number[];
  /** The most recent owner journal question — typically passed as the
   *  trigger argument to the function under test. */
  ownerLatestQuestionId: number;
}

interface InsertCalibrationOptions {
  subjectId: number;
  profile: ProfileFixture;
  count: number;            // how many calibration sessions to insert
  startIndex?: number;      // for distinct dates across multiple calls
  deviceType?: string;      // default 'test'
  startDate?: string;       // 'YYYY-MM-DD'; default '2026-02-01'
}

/**
 * Insert N calibration sessions for a subject. Calibration shares the same
 * row shape as journal (tb_session_summaries fields) — what distinguishes
 * them in the schema is question_source_id = 3.
 *
 * Returns the inserted question IDs.
 */
export async function insertCalibrationSessions(
  sql: Sql,
  opts: InsertCalibrationOptions,
): Promise<number[]> {
  const startIndex = opts.startIndex ?? 0;
  const deviceType = opts.deviceType ?? 'test';
  const startDate = opts.startDate ?? '2026-02-01';
  const startDay = parseInt(startDate.slice(8, 10), 10);
  const month = startDate.slice(0, 7);
  const ids: number[] = [];
  for (let i = 0; i < opts.count; i++) {
    const date = `${month}-${String(startDay + startIndex + i).padStart(2, '0')}`;
    ids.push(await insertJournalSession(sql, {
      subjectId: opts.subjectId,
      profile: opts.profile,
      scheduledFor: date,
      sessionIndex: startIndex + i,
      questionSourceId: 3,
      deviceType,
    }));
  }
  return ids;
}

/**
 * Seed both subjects + insert N journal sessions per subject, alternating
 * dates so neither subject's "most recent session" is ambiguous. Returns
 * the relevant question IDs for assertions.
 *
 * Default N=5 produces enough rows for every aggregation in libProfile to
 * compute. Tests that need different shapes can call insertJournalSession
 * directly.
 */
export async function seedTwoSubjectFingerprintFixture(
  sql: Sql,
  sessionsPerSubject: number = 5,
): Promise<TwoSubjectFixture> {
  await seedTwoSubjects(sql);

  const ownerQuestionIds: number[] = [];
  const otherQuestionIds: number[] = [];

  // Alternating dates: owner Jan 1, other Jan 2, owner Jan 3, other Jan 4, ...
  // Distinct dates per subject so tb_questions UNIQUE (subject_id, scheduled_for)
  // is satisfied. The two subjects can share dates because the constraint is
  // composite — but we keep them disjoint for clarity in test output.
  for (let i = 0; i < sessionsPerSubject; i++) {
    const ownerDate = `2026-01-${String(i * 2 + 1).padStart(2, '0')}`;
    const otherDate = `2026-01-${String(i * 2 + 2).padStart(2, '0')}`;

    ownerQuestionIds.push(await insertJournalSession(sql, {
      subjectId: OWNER_ID,
      profile: OWNER_PROFILE,
      scheduledFor: ownerDate,
      sessionIndex: i,
    }));

    otherQuestionIds.push(await insertJournalSession(sql, {
      subjectId: OTHER_ID,
      profile: OTHER_PROFILE,
      scheduledFor: otherDate,
      sessionIndex: i,
    }));
  }

  return {
    ownerQuestionIds,
    otherQuestionIds,
    ownerLatestQuestionId: ownerQuestionIds[ownerQuestionIds.length - 1]!,
  };
}

/**
 * Tables this fixture writes to. Tests' beforeEach should DELETE rows for
 * the test-owned subject IDs (FIXTURE_OWNED_SUBJECT_IDS) from each, in the
 * order listed here. We do NOT TRUNCATE these — db tests share a Postgres
 * container across forks, and TRUNCATE would clobber state owned by other
 * concurrently-running test files (notably the owner row in tb_subjects
 * that subjectAuth.test.ts depends on).
 *
 * Order: tb_subjects last because it doesn't enforce physical FKs to the
 * other rows, but conventional cleanup goes children → parent.
 */
export const FIXTURE_TABLES = [
  'tb_reconstruction_residuals',
  'tb_calibration_baselines_history',
  'tb_session_integrity',
  'tb_personal_profile',
  'tb_rburst_sequences',
  'tb_burst_sequences',
  'tb_process_signals',
  'tb_motor_signals',
  'tb_semantic_trajectory',
  'tb_semantic_baselines',
  'tb_embeddings',
  'tb_semantic_signals',
  'tb_session_summaries',
  'tb_responses',
  'tb_questions',
  'tb_subjects',
] as const;

/** Run scoped DELETE for each FIXTURE_TABLES entry. Idempotent and
 *  safe to call before fresh fixture setup. */
export async function cleanupFixtureRows(sql: Sql): Promise<void> {
  const ids = FIXTURE_OWNED_SUBJECT_IDS;
  for (const table of FIXTURE_TABLES) {
    await sql.unsafe(
      `DELETE FROM ${table} WHERE subject_id = ANY($1::int[])`,
      [ids as unknown as number[]],
    );
  }
}

// ----------------------------------------------------------------------------
// tb_personal_profile direct-write helper (hotspot D and beyond)
// ----------------------------------------------------------------------------

/**
 * Insert a tb_personal_profile row for the given subject directly, using
 * the distinguishable values from a ProfileFixture. Used by hotspot D
 * (libReconstruction reads tb_personal_profile to seed the avatar timing
 * model) and any later hotspot that depends on a populated profile row.
 *
 * We INSERT directly rather than calling libProfile.updateProfile() to
 * avoid coupling tests to libProfile's correctness — that's hotspot C's
 * job, and a circular test dependency would mask bugs in either.
 *
 * lastQuestionId pins the profile to a specific session for traceability;
 * tests typically pass the latest journal session for the subject.
 */
export async function insertPersonalProfileRow(
  sql: Sql,
  subjectId: number,
  profile: ProfileFixture,
  lastQuestionId: number,
): Promise<void> {
  await sql`
    INSERT INTO tb_personal_profile (
      subject_id, session_count, last_question_id,
      digraph_aggregate_json,
      ex_gaussian_mu_mean, ex_gaussian_sigma_mean, ex_gaussian_tau_mean,
      iki_mean_mean, iki_std_mean,
      hold_time_mean_mean, hold_time_mean_std,
      flight_time_mean_mean, flight_time_mean_std,
      hold_time_cv_mean,
      burst_length_mean,
      pause_within_word_pct, pause_between_word_pct, pause_between_sent_pct,
      first_keystroke_mean,
      r_burst_ratio_mean,
      rburst_consolidation, rburst_mean_size, rburst_mean_duration, rburst_leading_edge_pct,
      iki_autocorrelation_lag1_mean, hold_flight_rank_correlation,
      mattr_mean
    ) VALUES (
      ${subjectId}, 5, ${lastQuestionId},
      ${JSON.stringify(profile.digraphLatencyJson)}::jsonb,
      ${profile.exGaussianMu}, ${profile.exGaussianSigma}, ${profile.exGaussianTau},
      ${profile.ikiMean}, ${profile.ikiStd},
      ${profile.holdTimeMean}, ${profile.holdTimeStd},
      ${profile.flightTimeMean}, ${profile.flightTimeStd},
      ${profile.holdTimeCv},
      ${profile.avgPBurstLength},
      0.625, 0.3, 0.075,
      ${profile.firstKeystrokeMs},
      ${profile.rBurstCount / (profile.rBurstCount + profile.iBurstCount)},
      1.0, ${profile.rburstDeletedCounts[0] ?? 5}, ${profile.rburstDurationMs}, ${profile.rburstIsLeadingEdge ? 1.0 : 0.0},
      ${profile.ikiAutocorrelationJson[0] ?? 0},
      ${profile.holdFlightRankCorr},
      ${profile.mattr}
    )
  `;
}

// ----------------------------------------------------------------------------
// Hotspot F helpers — semantic baselines, embeddings, semantic-signal rows
// ----------------------------------------------------------------------------

/**
 * Pre-insert a tb_semantic_baselines row for a subject + signal_name.
 * Used to seed F1 (getBaseline contamination source) and F2 (pre-existing
 * row to demonstrate ON CONFLICT target correctness).
 */
export async function insertSemanticBaselineSeed(
  sql: Sql,
  subjectId: number,
  signalName: string,
  sessionCount: number,
  runningMean: number,
  runningM2: number,
  lastQuestionId: number | null = null,
): Promise<void> {
  await sql`
    INSERT INTO tb_semantic_baselines (
      subject_id, signal_name, running_mean, running_m2, session_count,
      last_question_id, dttm_modified_utc, modified_by
    ) VALUES (
      ${subjectId}, ${signalName}, ${runningMean}, ${runningM2}, ${sessionCount},
      ${lastQuestionId}, CURRENT_TIMESTAMP, 'fixture'
    )
  `;
}

/**
 * Pre-insert a tb_semantic_signals row keyed by question_id. Used to
 * provide signal values for the test-current session and for prior
 * topic-matched neighbors. Defaults all signals to null except the
 * fields specified in `values`.
 */
export async function insertSemanticSignalsRow(
  sql: Sql,
  subjectId: number,
  questionId: number,
  values: Partial<Record<string, number | null>>,
): Promise<void> {
  // Build column / value lists dynamically. Keys are snake_case schema cols.
  const cols = ['subject_id', 'question_id', ...Object.keys(values)];
  const colList = cols.join(', ');
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
  const params = [subjectId, questionId, ...Object.values(values)];
  await sql.unsafe(
    `INSERT INTO tb_semantic_signals (${colList}) VALUES (${placeholders})`,
    params as unknown[] as never[],
  );
}

/**
 * Pre-insert a tb_embeddings row pointing at a tb_responses row. The
 * `vector` is a fixed-length number[] (vector(512) per the schema). To
 * keep test fixtures readable, callers typically construct a 512-dim
 * vector with a few non-zero leading entries; the function pads the
 * rest with zeros.
 */
export async function insertEmbeddingRow(
  sql: Sql,
  subjectId: number,
  sourceRecordId: number,        // typically a response_id
  vectorPrefix: number[],        // first N dims; rest padded to 512 with 0
  options: {
    embeddingSourceId?: number;  // default 1 (response)
    embeddedText?: string;
    sourceDate?: string | null;
    modelName?: string;
  } = {},
): Promise<void> {
  const padded = [...vectorPrefix];
  while (padded.length < 512) padded.push(0);
  const vectorString = `[${padded.join(',')}]`;
  await sql`
    INSERT INTO tb_embeddings (
      subject_id, embedding_source_id, source_record_id, embedded_text,
      source_date, model_name, embedding
    ) VALUES (
      ${subjectId},
      ${options.embeddingSourceId ?? 1},
      ${sourceRecordId},
      ${options.embeddedText ?? 'fixture'},
      ${options.sourceDate ?? null},
      ${options.modelName ?? 'fixture-model'},
      ${vectorString}::vector
    )
  `;
}
