import type { APIRoute } from 'astro';
import { getCommentsForPaper, saveComment } from '../../lib/db.ts';

export const GET: APIRoute = async ({ url }) => {
  const slug = url.searchParams.get('slug');
  if (!slug) {
    return new Response(JSON.stringify({ error: 'Missing slug' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const comments = await getCommentsForPaper(slug);
  return new Response(JSON.stringify(comments), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
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

  const id = await saveComment(slug, authorName.trim(), commentText.trim());
  return new Response(JSON.stringify({ ok: true, id }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
