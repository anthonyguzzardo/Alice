import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';

// Anchor on cwd, not import.meta.url. Post-Astro-build the bundled module
// lives in dist/server/chunks/, so `../..` would resolve to `dist/server`,
// where the docs/ tree is not copied. systemd sets WorkingDirectory=/opt/alice,
// dev runs from the project root, so cwd is correct in both modes.
const DOCS_DIR = path.resolve(process.cwd(), 'docs');

export interface Doc {
  slug: string;
  title: string;
  html: string;
}

/** Load a single doc by slug (filename without extension). */
export function getDoc(slug: string): Doc | null {
  const filePath = path.join(DOCS_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, 'utf-8');
  const html = marked.parse(raw, { async: false }) as string;

  // Extract title from first H1
  const titleMatch = raw.match(/^#\s+(.+)$/m);
  // titleMatch[1] is the (.+) capture group; defined whenever titleMatch itself is.
  const title = titleMatch ? titleMatch[1]! : slug;

  return { slug, title, html };
}
