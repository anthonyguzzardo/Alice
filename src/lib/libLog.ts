import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { marked } from 'marked';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.resolve(__dirname, '../../log');

export interface LogEntryMeta {
  title: string;
  slug: string;
  date: string;
  status: 'published' | 'draft';
  tags: string[];
  excerpt: string;
}

export interface LogEntry extends LogEntryMeta {
  html: string;
}

/** List all log entries with the given status, sorted by date descending. */
export function listLogEntries(status: 'published' | 'draft' | 'all' = 'published'): LogEntryMeta[] {
  if (!fs.existsSync(LOG_DIR)) return [];

  const files = fs.readdirSync(LOG_DIR).filter(f => f.endsWith('.md'));
  const entries: LogEntryMeta[] = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(LOG_DIR, file), 'utf-8');
    const { data, content } = matter(raw);
    if (!data.slug || !data.title) continue;
    if (status !== 'all' && data.status !== status) continue;

    // Extract excerpt: first non-empty paragraph from content
    const lines = content.split('\n').filter(l => l.trim().length > 0 && !l.startsWith('#'));
    const excerpt = lines[0]?.trim().slice(0, 200) || '';

    entries.push({
      title: data.title,
      slug: data.slug,
      date: String(data.date).slice(0, 10),
      status: data.status || 'draft',
      tags: Array.isArray(data.tags) ? data.tags : [],
      excerpt,
    });
  }

  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

/** Load a single log entry by slug, rendered to HTML. */
export function getLogEntry(slug: string): LogEntry | null {
  if (!fs.existsSync(LOG_DIR)) return null;

  const files = fs.readdirSync(LOG_DIR).filter(f => f.endsWith('.md'));

  for (const file of files) {
    const raw = fs.readFileSync(path.join(LOG_DIR, file), 'utf-8');
    const { data, content } = matter(raw);
    if (data.slug !== slug) continue;

    const html = marked.parse(content, { async: false }) as string;

    const lines = content.split('\n').filter(l => l.trim().length > 0 && !l.startsWith('#'));
    const excerpt = lines[0]?.trim().slice(0, 200) || '';

    return {
      title: data.title,
      slug: data.slug,
      date: String(data.date).slice(0, 10),
      status: data.status || 'draft',
      tags: Array.isArray(data.tags) ? data.tags : [],
      excerpt,
      html,
    };
  }

  return null;
}
