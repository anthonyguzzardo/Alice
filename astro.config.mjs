// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
  // Disable Astro's CSRF Origin check. The session cookie is SameSite=Lax,
  // which already blocks cross-origin POSTs from carrying the auth cookie.
  // Astro's default check rejects POSTs with no Content-Type (e.g. logout
  // fetches with no body) because the Node adapter sees the URL via
  // X-Forwarded-Proto-aware reverse proxy but Astro reconstructs scheme
  // from the Host header — schemes mismatch and the request is rejected.
  // Single-tenant app behind Caddy + Cloudflare; SameSite=Lax suffices.
  security: {
    checkOrigin: false,
  },
});
