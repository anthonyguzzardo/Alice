/**
 * subject-scope lint — Migration 030 Step 7
 *
 * Flags any SQL query in this codebase that references a subject-bearing
 * table without referencing `subject_id`.
 *
 * Why this lint exists
 * --------------------
 * Migration 030 added `subject_id INT NOT NULL` to every behavioral table.
 * The unification works only if every query at every site explicitly scopes
 * by subject_id. Step 6 verified the 17 known aggregation hotspots do this
 * correctly; Step 7 makes the discipline mechanical so future code can't
 * silently regress.
 *
 * The lint catches the SOURCE-LEVEL leak. Some sites have defense-in-depth
 * (correlated subqueries; downstream subject-scoped fetches) that mask a
 * missing scope today. The lint does not rely on downstream code happening
 * to compensate — it enforces the discipline at the query site so a future
 * change that removes the masking layer can't quietly turn the leak on.
 *
 * Scope of detection
 * ------------------
 * Walks every backtick-delimited template literal in the scanned files,
 * including those passed to `sql.unsafe(...)`. For each literal:
 *   1. Extract subject-bearing table names that appear in a SQL position
 *      (after FROM/JOIN/INTO/UPDATE/DELETE FROM).
 *   2. If at least one is referenced, the literal must contain `subject_id`
 *      somewhere — column, alias, comment, anywhere literal.
 *
 * Comment-based "subject_id appears in a comment" passes. That is by design:
 * a developer who comments `-- subject_id implied by JOIN ...` is making the
 * scope claim load-bearing in the source, which is what we want. Mismatches
 * between comment and code are caught by Step 6 hotspot tests, not here.
 *
 * Exemption mechanism
 * -------------------
 * Three layers, all comment-based and all requiring a `-- <reason>` clause:
 *
 *   1. File-level: `// alice-lint-disable-file subject-scope -- <reason>`
 *      anywhere in the file. Skips the whole file.
 *
 *   2. Range: `// alice-lint-disable subject-scope -- <reason>` opens a
 *      disabled region. `// alice-lint-enable subject-scope` closes it.
 *      Every SQL block between the markers is exempt. Use this when a
 *      single statement contains multiple SQL blocks (e.g. a ternary with
 *      a SQL fragment in each branch) and per-block markers would not chain.
 *
 *   3. Single-block: `// alice-lint-disable-next-query subject-scope -- <reason>`
 *      on a non-blank source line that immediately precedes the SQL block.
 *      Whitespace and other comments between the marker and the block are
 *      tolerated; intervening code is not.
 *
 * A bare disable without `-- <reason>` is itself ignored (the lint will
 * fire on whatever site the marker tried to silence). Reasons are not
 * validated for content — that's a code-review concern, not a lint one —
 * but they must be present so a grep finds every exemption with its
 * rationale in one read.
 *
 * Out of scope
 * ------------
 * This lint does NOT verify functional correctness (that subject_id is bound
 * to the right value, scoped on the right table, threaded through joins, or
 * applied to subqueries). Step 6 hotspot tests and human review own that.
 *
 * The lint is a syntactic backstop, not a measurement test. It catches the
 * class of mistake "developer forgot subject_id entirely"; it does not catch
 * "developer used the wrong subject_id."
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

// ----------------------------------------------------------------------------
// Subject-bearing tables (migration 030 Block 1, plus tb_signal_jobs from 027)
// ----------------------------------------------------------------------------
//
// Every table in this set carries `subject_id INT NOT NULL` after migration
// 030. Any query that touches one of these tables must reference subject_id.
//
// Source of truth: db/sql/migrations/030_unify_subject_id.sql, BLOCK 1.
// If the migration list changes, update this set in lockstep.

export const SUBJECT_BEARING_TABLES: ReadonlySet<string> = new Set([
  'tb_questions',
  'tb_responses',
  'tb_session_summaries',
  'tb_session_events',
  'tb_burst_sequences',
  'tb_rburst_sequences',
  'tb_session_metadata',
  'tb_dynamical_signals',
  'tb_motor_signals',
  'tb_semantic_signals',
  'tb_process_signals',
  'tb_cross_session_signals',
  'tb_calibration_baselines_history',
  'tb_entry_states',
  'tb_semantic_states',
  'tb_question_feedback',
  'tb_interaction_events',
  'tb_personal_profile',
  'tb_session_delta',
  'tb_reconstruction_residuals',
  'tb_session_integrity',
  'tb_semantic_baselines',
  'tb_semantic_trajectory',
  'tb_signal_jobs',
  'tb_embeddings',
  'tb_prompt_traces',
  'tb_reflections',
  'tb_semantic_dynamics',
  'tb_semantic_coupling',
  'tb_trait_dynamics',
  'tb_coupling_matrix',
  'tb_emotion_behavior_coupling',
]);

// ----------------------------------------------------------------------------
// Population-agnostic tables (no subject_id column by design)
// ----------------------------------------------------------------------------
//
// These tables intentionally lack a subject_id column. A query against one of
// them is automatically out of scope for this lint — there is nothing to
// reference. Listed here for documentation, not used in matching (anything
// not in SUBJECT_BEARING_TABLES is implicitly ignored).
//
// Source of truth: db/sql/migrations/030_unify_subject_id.sql, "NOT MODIFIED"
// header section.
export const POPULATION_AGNOSTIC_TABLES: ReadonlySet<string> = new Set([
  'tb_subjects',                    // identity table; subject_id IS the key
  'tb_subject_sessions',            // session token store, keyed by subject_id intrinsically
  'tb_question_corpus',             // shared corpus pool; no per-subject identity
  'tb_subscribers',                 // public-website mailing list
  'tb_paper_comments',              // public-website paper comments
  'tb_engine_provenance',           // (binary_sha256, cpu_model) keyed
  'tb_embedding_model_versions',    // static registry
]);

// ----------------------------------------------------------------------------
// Markers
// ----------------------------------------------------------------------------

const FILE_DISABLE_MARKER = 'alice-lint-disable-file subject-scope';
const NEXT_QUERY_DISABLE_MARKER = 'alice-lint-disable-next-query subject-scope';
const RANGE_DISABLE_MARKER = 'alice-lint-disable subject-scope';
const RANGE_ENABLE_MARKER = 'alice-lint-enable subject-scope';
const REASON_REQUIRED_PATTERN = /--\s*\S/;

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

export interface Violation {
  /** Path relative to the repo root. */
  file: string;
  /** 1-indexed line number where the offending template literal starts. */
  line: number;
  /** First subject-bearing table referenced in the literal (sorted). */
  table: string;
  /** All subject-bearing tables referenced in the literal (sorted). */
  tables: string[];
  /** First ~140 characters of the literal, whitespace collapsed. */
  snippet: string;
  /** Human-readable reason. */
  reason: string;
}

export interface LintOptions {
  /**
   * Tables that MUST have `subject_id` referenced if mentioned. Defaults to
   * SUBJECT_BEARING_TABLES; tests override to inject a smaller set.
   */
  subjectBearingTables?: ReadonlySet<string>;
  /**
   * Repo root used to compute `Violation.file` (relative path). Defaults to
   * the current working directory.
   */
  repoRoot?: string;
}

/**
 * Lint a single source string. Returns zero or more violations.
 *
 * The `filePath` is used only to populate `Violation.file` and is otherwise
 * not read from disk — callers can lint synthetic content (test fixtures).
 */
export function lintSource(
  filePath: string,
  source: string,
  options: LintOptions = {},
): Violation[] {
  const subjectBearing = options.subjectBearingTables ?? SUBJECT_BEARING_TABLES;
  const repoRoot = options.repoRoot ?? process.cwd();
  const relPath = relative(repoRoot, filePath) || filePath;

  // File-level exemption: skip the whole file. The marker must include a
  // reason so grep finds a rationale at every disabled site.
  const fileDisableLine = findFileDisable(source);
  if (fileDisableLine !== null) {
    return [];
  }

  const disabledRanges = computeDisabledRanges(source);

  const violations: Violation[] = [];

  for (const literal of extractTemplateLiterals(source)) {
    const tables = findSubjectBearingTables(literal.content, subjectBearing);
    if (tables.length === 0) continue;

    if (offsetInDisabledRange(literal.startOffset, disabledRanges)) continue;
    if (hasInlineDisable(source, literal.startOffset)) continue;

    if (literal.content.includes('subject_id')) continue;

    violations.push({
      file: relPath,
      line: literal.line,
      table: tables[0]!,
      tables,
      snippet: collapseWhitespace(literal.content).slice(0, 140),
      reason: tables.length === 1
        ? `Query against ${tables[0]} does not reference subject_id`
        : `Query against ${tables.join(', ')} does not reference subject_id`,
    });
  }

  return violations;
}

/**
 * Walk the given files (or directories) and lint each .ts file. Skips
 * .d.ts, anything under node_modules, anything under tests/, scripts/archive,
 * and src-rs. Returns violations across all files, sorted by file then line.
 */
export function lintCodebase(
  paths: string[],
  options: LintOptions = {},
): Violation[] {
  const repoRoot = options.repoRoot ?? process.cwd();
  const tsFiles: string[] = [];
  for (const p of paths) {
    collectTsFiles(resolve(repoRoot, p), tsFiles);
  }
  tsFiles.sort();

  const violations: Violation[] = [];
  for (const file of tsFiles) {
    const source = readFileSync(file, 'utf-8');
    violations.push(...lintSource(file, source, { ...options, repoRoot }));
  }
  return violations;
}

// ----------------------------------------------------------------------------
// File walk
// ----------------------------------------------------------------------------

const SKIP_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  'dist',
  '.astro',
  'target',          // Rust build dir
  'archive',         // scripts/archive/* per migration 030 §8
]);

function collectTsFiles(absPath: string, out: string[]): void {
  let st;
  try {
    st = statSync(absPath);
  } catch {
    return;
  }
  if (st.isFile()) {
    if (absPath.endsWith('.ts') && !absPath.endsWith('.d.ts')) {
      out.push(absPath);
    }
    return;
  }
  if (!st.isDirectory()) return;
  for (const entry of readdirSync(absPath)) {
    if (SKIP_DIR_NAMES.has(entry)) continue;
    collectTsFiles(join(absPath, entry), out);
  }
}

// ----------------------------------------------------------------------------
// Template literal extraction (state machine over comments and strings)
// ----------------------------------------------------------------------------

interface ExtractedLiteral {
  /** Offset of the opening backtick. */
  startOffset: number;
  /** 1-indexed source line of the opening backtick. */
  line: number;
  /** Concatenated text content of the literal, with `${...}` placeholders
   *  preserved verbatim (so subject_id references inside placeholders count). */
  content: string;
}

function extractTemplateLiterals(source: string): ExtractedLiteral[] {
  const out: ExtractedLiteral[] = [];
  const len = source.length;
  let i = 0;
  let line = 1;

  while (i < len) {
    const ch = source[i]!;

    // Newline tracking
    if (ch === '\n') {
      line++;
      i++;
      continue;
    }

    // Line comment — skip to end of line
    if (ch === '/' && source[i + 1] === '/') {
      while (i < len && source[i] !== '\n') i++;
      continue;
    }

    // Block comment — skip to */
    if (ch === '/' && source[i + 1] === '*') {
      i += 2;
      while (i < len && !(source[i] === '*' && source[i + 1] === '/')) {
        if (source[i] === '\n') line++;
        i++;
      }
      i += 2;
      continue;
    }

    // Single-quoted string
    if (ch === "'") {
      i++;
      while (i < len && source[i] !== "'") {
        if (source[i] === '\\' && i + 1 < len) i += 2;
        else {
          if (source[i] === '\n') line++;
          i++;
        }
      }
      i++;
      continue;
    }

    // Double-quoted string
    if (ch === '"') {
      i++;
      while (i < len && source[i] !== '"') {
        if (source[i] === '\\' && i + 1 < len) i += 2;
        else {
          if (source[i] === '\n') line++;
          i++;
        }
      }
      i++;
      continue;
    }

    // Template literal
    if (ch === '`') {
      const startOffset = i;
      const startLine = line;
      i++;
      const parsed = parseTemplate(source, i);
      out.push({ startOffset, line: startLine, content: parsed.text });
      // Advance line counter to reflect newlines inside the literal (parsed
      // already consumed up to and including the closing backtick).
      const consumed = source.slice(startOffset, parsed.endOffset);
      const nlCount = (consumed.match(/\n/g) || []).length;
      line += nlCount;
      i = parsed.endOffset;
      continue;
    }

    i++;
  }

  return out;
}

interface ParseResult {
  text: string;
  endOffset: number;
}

/**
 * Parse a template literal body starting at `start` (one past the opening
 * backtick). Returns the body text (with `${...}` placeholders rendered as
 * `${...content...}` literally — placeholder source is part of `content` for
 * the purposes of detecting `subject_id`). Handles nested templates inside
 * placeholder expressions.
 */
function parseTemplate(source: string, start: number): ParseResult {
  const len = source.length;
  let i = start;
  let text = '';

  while (i < len) {
    const ch = source[i]!;

    if (ch === '`') {
      return { text, endOffset: i + 1 };
    }

    if (ch === '\\' && i + 1 < len) {
      // Preserve the escaped character so subject_id-like content is still
      // visible (an escaped backtick or dollar-sign is not interesting here).
      text += source[i + 1];
      i += 2;
      continue;
    }

    if (ch === '$' && source[i + 1] === '{') {
      // Placeholder expression — consume until matching '}', handling nested
      // braces, strings, and template literals.
      text += '${';
      i += 2;
      let depth = 1;
      while (i < len && depth > 0) {
        const c = source[i]!;
        if (c === '{') {
          depth++;
          text += c;
          i++;
        } else if (c === '}') {
          depth--;
          if (depth === 0) {
            text += '}';
            i++;
            break;
          }
          text += c;
          i++;
        } else if (c === '`') {
          // Nested template — recurse, capturing its body for subject_id
          // detection (a nested template's content can be the load-bearing
          // SQL).
          const nested = parseTemplate(source, i + 1);
          text += '`' + nested.text + '`';
          i = nested.endOffset;
        } else if (c === "'" || c === '"') {
          // Quoted string inside placeholder — consume verbatim.
          const quote = c;
          text += c;
          i++;
          while (i < len && source[i] !== quote) {
            if (source[i] === '\\' && i + 1 < len) {
              text += source[i]! + source[i + 1]!;
              i += 2;
            } else {
              text += source[i]!;
              i++;
            }
          }
          if (i < len) {
            text += source[i]!;
            i++;
          }
        } else {
          text += c;
          i++;
        }
      }
      continue;
    }

    text += ch;
    i++;
  }

  // Unterminated template literal — return what we have. The parser is
  // best-effort; an unterminated literal indicates a syntax error in the
  // source that tsc will catch.
  return { text, endOffset: len };
}

// ----------------------------------------------------------------------------
// SQL analysis
// ----------------------------------------------------------------------------

const TABLE_KEYWORD_PATTERN =
  /\b(?:FROM|JOIN|INTO|UPDATE|TABLE|TRUNCATE)\s+(?:ONLY\s+)?(?:[a-zA-Z_][\w]*\.)?(tb_[a-zA-Z0-9_]+)/gi;

function findSubjectBearingTables(
  content: string,
  subjectBearing: ReadonlySet<string>,
): string[] {
  const found = new Set<string>();
  for (const match of content.matchAll(TABLE_KEYWORD_PATTERN)) {
    const table = match[1]!;
    if (subjectBearing.has(table)) {
      found.add(table);
    }
  }
  return [...found].sort();
}

function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

// ----------------------------------------------------------------------------
// Exemption marker detection
// ----------------------------------------------------------------------------

/**
 * Find the position of a file-level disable marker, if any. Returns the
 * 0-indexed line number of the marker, or null.
 *
 * The marker must include a `-- <reason>` clause; bare markers are ignored
 * (the lint will then fire on whatever site they were trying to silence,
 * which is the intended escalation).
 */
function findFileDisable(source: string): number | null {
  // Use line-by-line scan rather than match the whole source so we don't
  // confuse the file-level marker with the range-level marker (which is a
  // prefix of the file-level marker text).
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.includes(FILE_DISABLE_MARKER) && REASON_REQUIRED_PATTERN.test(line)) {
      return i;
    }
  }
  return null;
}

interface DisabledRange {
  start: number; // inclusive byte offset
  end: number;   // exclusive byte offset
}

/**
 * Walk the source by line and produce the list of (start, end) offset ranges
 * inside which template literals should be exempted from the lint. A range
 * opens on a line containing `RANGE_DISABLE_MARKER` (with reason) and closes
 * on the next `RANGE_ENABLE_MARKER`. An open range without an enable closes
 * at end of file.
 *
 * The implementation tracks line-start offsets so the returned ranges are
 * comparable to template literal `startOffset` values directly.
 */
function computeDisabledRanges(source: string): DisabledRange[] {
  const ranges: DisabledRange[] = [];
  let openStart: number | null = null;
  let i = 0;
  let lineStart = 0;
  while (i <= source.length) {
    const ch = i < source.length ? source[i]! : '\n';
    if (ch === '\n' || i === source.length) {
      const line = source.slice(lineStart, i);
      // Check for opening marker. Range marker is a prefix of file marker;
      // the file-level marker is handled separately and exits early.
      if (openStart === null
          && line.includes(RANGE_DISABLE_MARKER)
          && !line.includes(FILE_DISABLE_MARKER)
          && !line.includes(NEXT_QUERY_DISABLE_MARKER)
          && REASON_REQUIRED_PATTERN.test(line)) {
        openStart = i + 1; // start at the next line
      } else if (openStart !== null && line.includes(RANGE_ENABLE_MARKER)) {
        // Range closes at the start of the enable line so any blocks on
        // that line itself are NOT exempt.
        ranges.push({ start: openStart, end: lineStart });
        openStart = null;
      }
      lineStart = i + 1;
    }
    i++;
  }
  if (openStart !== null) {
    ranges.push({ start: openStart, end: source.length });
  }
  return ranges;
}

function offsetInDisabledRange(offset: number, ranges: DisabledRange[]): boolean {
  for (const r of ranges) {
    if (offset >= r.start && offset < r.end) return true;
  }
  return false;
}

/**
 * Check if the immediately-preceding source lines contain a block-level
 * disable marker. Whitespace-only lines between the marker and the SQL block
 * are tolerated; any non-comment, non-blank line breaks the chain.
 *
 * The marker must include a `-- <reason>` clause.
 */
function hasInlineDisable(source: string, blockStartOffset: number): boolean {
  // Walk lines backwards from the line containing blockStartOffset.
  const before = source.slice(0, blockStartOffset);
  const lines = before.split('\n');
  // The current line (where the block starts) is lines[lines.length - 1].
  // Look at preceding lines.
  for (let i = lines.length - 2; i >= 0; i--) {
    const line = lines[i]!.trim();
    if (line === '') continue;            // skip blank
    if (line.startsWith('//')) {
      if (line.includes(NEXT_QUERY_DISABLE_MARKER) &&
          REASON_REQUIRED_PATTERN.test(line)) {
        return true;
      }
      // Other comment lines don't break the chain — the marker can sit
      // above another comment (e.g. a function docstring).
      continue;
    }
    if (line.startsWith('*') || line.startsWith('/*') || line.endsWith('*/')) {
      // Block-comment fragment — also doesn't break the chain.
      continue;
    }
    // Anything else is real code; chain broken.
    return false;
  }
  return false;
}
