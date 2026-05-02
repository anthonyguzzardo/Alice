import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { marked } from 'marked';

// Anchor on cwd. See libDocs.ts for the same fix and rationale: post-build
// the bundled module is in dist/server/chunks/, where the papers/ tree
// is not copied. systemd sets WorkingDirectory=/opt/alice, dev runs from
// the project root.
const PAPERS_DIR = path.resolve(process.cwd(), 'papers');

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Format a date in UTC to avoid timezone shift (YAML dates are midnight UTC). */
function formatDate(raw: unknown): string {
  if (raw instanceof Date) {
    return `${DAYS[raw.getUTCDay()]} ${MONTHS[raw.getUTCMonth()]} ${raw.getUTCDate()}`;
  }
  return String(raw).slice(0, 10);
}

export interface PaperMeta {
  title: string;
  slug: string;
  author: string;
  date: string;
  status: 'published' | 'draft';
  version: number;
  abstract: string;
}

export interface Paper extends PaperMeta {
  html: string;
}

/** List all papers with the given status, sorted by date descending. */
export function listPapers(status: 'published' | 'draft' | 'all' = 'published'): PaperMeta[] {
  const files = fs.readdirSync(PAPERS_DIR).filter(f => f.endsWith('.md'));
  const entries: { meta: PaperMeta; sortKey: string }[] = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(PAPERS_DIR, file), 'utf-8');
    const { data } = matter(raw);
    if (!data.slug || !data.title) continue;
    if (status !== 'all' && data.status !== status) continue;

    const sortKey = data.date instanceof Date
      ? data.date.toISOString().slice(0, 10)
      : String(data.date).slice(0, 10);

    entries.push({
      meta: {
        title: data.title,
        slug: data.slug,
        author: data.author || 'Anthony Guzzardo',
        date: formatDate(data.date),
        status: data.status || 'draft',
        version: data.version || 1,
        abstract: data.abstract || '',
      },
      sortKey,
    });
  }

  return entries
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey))
    .map(e => e.meta);
}

/** Load a single paper by slug, rendered to HTML. */
export function getPaper(slug: string): Paper | null {
  const files = fs.readdirSync(PAPERS_DIR).filter(f => f.endsWith('.md'));

  for (const file of files) {
    const raw = fs.readFileSync(path.join(PAPERS_DIR, file), 'utf-8');
    const { data, content } = matter(raw);
    if (data.slug !== slug) continue;

    let html = marked.parse(content, { async: false }) as string;

    // Wrap References and Appendix sections in collapsible <details>, collapsed by default
    html = html.replace(
      /(<h2[^>]*>(?:References|Appendix[^<]*)<\/h2>)([\s\S]*?)(?=<h2|$)/gi,
      (_, heading, body) => {
        const title = heading.replace(/<[^>]+>/g, '').trim();
        return `<details class="collapsible-section"><summary>${title}</summary>${body}</details>`;
      }
    );

    return {
      title: data.title,
      slug: data.slug,
      author: data.author || 'Anthony Guzzardo',
      date: formatDate(data.date),
      status: data.status || 'draft',
      version: data.version || 1,
      abstract: data.abstract || '',
      html,
    };
  }

  return null;
}
