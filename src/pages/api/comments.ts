import type { APIRoute } from 'astro';
import { getCommentsForPaper, saveComment } from '../../lib/libDb.ts';
import { parseBody } from '../../lib/utlParseBody.ts';
import { logError } from '../../lib/utlErrorLog.ts';

export const GET: APIRoute = async ({ url }) => {
  const slug = url.searchParams.get('slug');
  if (!slug) {
    return new Response(JSON.stringify({ error: 'Missing slug' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const comments = await getCommentsForPaper(slug);
    return new Response(JSON.stringify(comments), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    logError('api.comments.get', err, { slug });
    return new Response(JSON.stringify({ error: 'Failed to load comments' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  const body = await parseBody<{ slug: string; authorName: string; commentText: string }>(request);
  if (!body) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const { slug, authorName, commentText } = body;

  if (!slug || !authorName?.trim() || !commentText?.trim()) {
    return new Response(JSON.stringify({ error: 'Missing slug, authorName, or commentText' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Basic length limits
  if (authorName.length > 100 || commentText.length > 5000) {
    return new Response(JSON.stringify({ error: 'Name or comment too long' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const id = await saveComment(slug, authorName.trim(), commentText.trim());
    return new Response(JSON.stringify({ ok: true, id }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    logError('api.comments.post', err, { slug });
    return new Response(JSON.stringify({ error: 'Failed to save comment' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
