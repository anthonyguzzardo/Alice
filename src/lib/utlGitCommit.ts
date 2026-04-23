/**
 * Git commit hash at process startup. Read once, cached for the lifetime
 * of the process. Used for contamination attestation on tb_responses.
 */
import { execSync } from 'node:child_process';

let cached: string | null = null;

export function getGitCommitHash(): string {
  if (cached) return cached;
  try {
    cached = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    cached = 'unknown';
  }
  return cached;
}
