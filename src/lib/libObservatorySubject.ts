/**
 * Observatory subject-scope resolver.
 *
 * Reads `?subjectId=N` from a request URL, validates it against tb_subjects
 * (must exist and be active), and returns the resolved id. Falls back to
 * OWNER_SUBJECT_ID when the param is absent. Throws BadSubjectError on a
 * malformed or unknown id; handlers translate it to a 400/404 via
 * badSubjectResponse().
 *
 * Used by every /api/observatory/* handler so the operator can toggle the
 * observatory's lens to any provisioned subject. Authorization is upstream:
 * /observatory/* and /api/observatory/* are gated by Caddy basic-auth on
 * fweeo.com. This helper validates the requested id only — it does not
 * decide who is allowed to ask.
 */
import { OWNER_SUBJECT_ID } from './libDb.ts';
import { getSubjectById } from './libSubject.ts';

export class BadSubjectError extends Error {
  readonly status: 400 | 404;
  constructor(status: 400 | 404, message: string) {
    super(message);
    this.status = status;
    this.name = 'BadSubjectError';
  }
}

export async function resolveObservatorySubjectId(request: Request): Promise<number> {
  const raw = new URL(request.url).searchParams.get('subjectId');
  if (raw == null || raw === '') return OWNER_SUBJECT_ID;
  const trimmed = raw.trim();
  const n = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(n) || n <= 0 || String(n) !== trimmed) {
    throw new BadSubjectError(400, `invalid subjectId: ${raw}`);
  }
  const subject = await getSubjectById(n);
  if (!subject) throw new BadSubjectError(404, `subject ${n} not found`);
  if (!subject.is_active) throw new BadSubjectError(404, `subject ${n} is inactive`);
  return n;
}

export function badSubjectResponse(err: unknown): Response | null {
  if (err instanceof BadSubjectError) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: err.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return null;
}
