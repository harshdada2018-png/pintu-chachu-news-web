import { buildRobotsTxt } from '../cloudflare/seoHelper.js';

export async function onRequestGet({ request }) {
  const origin = new URL(request.url).origin;
  return new Response(buildRobotsTxt(origin), {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600'
    }
  });
}

