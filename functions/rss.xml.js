import { fetchPublishedArticlesFromD1, buildRssXml, xmlResponse } from '../cloudflare/seoHelper.js';

export async function onRequestGet({ request, env }) {
  const origin = new URL(request.url).origin;
  const articles = await fetchPublishedArticlesFromD1(env.DB, 50);
  return xmlResponse(buildRssXml(articles, origin));
}

