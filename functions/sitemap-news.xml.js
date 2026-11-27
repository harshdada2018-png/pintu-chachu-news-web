import { fetchPublishedArticlesFromD1, buildSitemapXml, xmlResponse } from '../cloudflare/seoHelper.js';

export async function onRequestGet({ request, env }) {
  const origin = new URL(request.url).origin;
  const articles = await fetchPublishedArticlesFromD1(env.DB, 100);
  return xmlResponse(buildSitemapXml(articles, origin, true));
}

