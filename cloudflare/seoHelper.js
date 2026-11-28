/**
 * PublicSpark Newsroom - Cloudflare Pages SEO & XML Feed Helpers
 * Shared across sitemap.xml, news-sitemap.xml, rss.xml, feed.xml, and robots.txt.
 */

export function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function resolveArticleIso(art, fallbackIso = '2026-01-01T00:00:00.000Z') {
  const candidates = [art?.createdAt, art?.created_at, art?.publishDateISO, art?.publishedAt, art?.published_at];
  for (const raw of candidates) {
    if (!raw || typeof raw !== 'string') continue;
    if (raw.includes('-') || raw.includes('T') || raw.includes(':')) {
      const ms = Date.parse(raw);
      if (!Number.isNaN(ms)) return new Date(ms).toISOString();
    }
  }
  const idStr = String(art?.id || '');
  const epochMatch = idStr.match(/(1[5-9]\d{11})/);
  if (epochMatch) {
    const baseMs = Number(epochMatch[1]);
    const suffixMatch = idStr.match(/-(\d{1,3})$/);
    const offsetHours = suffixMatch ? Number(suffixMatch[1]) : 0;
    const ms = Math.min(baseMs, Date.now()) - offsetHours * 3600 * 1000;
    if (!Number.isNaN(ms)) return new Date(ms).toISOString();
  }
  return fallbackIso;
}

export function toIsoDate(val, fallbackIso = '2026-01-01T00:00:00.000Z') {
  if (!val) return fallbackIso;
  const parsed = Date.parse(val);
  return Number.isNaN(parsed) ? fallbackIso : new Date(parsed).toISOString();
}

export async function fetchPublishedArticlesFromD1(db, limit = 100) {
  if (!db) return [];
  try {
    const { results } = await db.prepare(
      "SELECT data_json FROM articles WHERE status = 'published' OR status IS NULL ORDER BY createdAt DESC LIMIT ?"
    ).bind(limit).all();
    return (results || []).map(r => JSON.parse(r.data_json));
  } catch (_e) {
    return [];
  }
}

export function buildSitemapXml(articles, origin, onlyRecent48h = false) {
  const now = new Date();
  const nowIso = now.toISOString();
  const cutoffMs = now.getTime() - 48 * 60 * 60 * 1000;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${escapeXml(origin)}/</loc>
    <lastmod>${nowIso}</lastmod>
    <changefreq>always</changefreq>
    <priority>1.0</priority>
  </url>
`;

  for (const art of articles) {
    const pubDate = resolveArticleIso(art);
    if (onlyRecent48h && new Date(pubDate).getTime() < cutoffMs) continue;

    const lastMod = toIsoDate(art.updatedAt || art.updated_at, pubDate);
    const articleUrl = `${origin}/article/${encodeURIComponent(art.slug || art.id)}`;
    const lang = escapeXml((art.originalLanguage || 'hi').toLowerCase());
    const cleanTitle = escapeXml(art.title || 'News Article');

    let imageXml = '';
    const rawImg = String(art.image || art.featured_image || '').trim();
    if (rawImg && !rawImg.startsWith('data:')) {
      const fullImgUrl = rawImg.startsWith('http') ? rawImg : `${origin}${rawImg.startsWith('/') ? '' : '/'}${rawImg}`;
      imageXml = `    <image:image>
      <image:loc>${escapeXml(fullImgUrl)}</image:loc>
      <image:title>${cleanTitle}</image:title>
    </image:image>
`;
    }

    xml += `  <url>
    <loc>${escapeXml(articleUrl)}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.9</priority>
    <news:news>
      <news:publication>
        <news:name>PUBLIC SPARK</news:name>
        <news:language>${lang}</news:language>
      </news:publication>
      <news:publication_date>${pubDate}</news:publication_date>
      <news:title>${cleanTitle}</news:title>
    </news:news>
${imageXml}  </url>
`;
  }

  xml += '</urlset>';
  return xml;
}

export function buildRssXml(articles, origin) {
  const items = articles.slice(0, 30);
  let itemsXml = '';
  for (const art of items) {
    const slugOrId = art.slug || art.id;
    const link = `${origin}/article/${encodeURIComponent(slugOrId)}`;
    const pubDate = new Date(resolveArticleIso(art)).toUTCString();
    const desc = escapeXml(String(art.summary || art.content || '').replace(/<[^>]+>/g, '').slice(0, 480));
    const title = escapeXml(art.title || 'Untitled');
    const category = escapeXml(art.category || 'News');
    const author = escapeXml(art.author || 'PublicSpark Desk');
    const rawImg = String(art.image || art.featured_image || '').trim();
    const imgUrl = rawImg && !rawImg.startsWith('data:')
      ? (rawImg.startsWith('http') ? rawImg : `${origin}${rawImg.startsWith('/') ? '' : '/'}${rawImg}`)
      : '';
    const mediaXml = imgUrl
      ? `      <media:content url="${escapeXml(imgUrl)}" medium="image" />\n      <media:thumbnail url="${escapeXml(imgUrl)}" />\n`
      : '';

    itemsXml += `    <item>
      <title>${title}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <category>${category}</category>
      <dc:creator>${author}</dc:creator>
      <description>${desc}</description>
${mediaXml}    </item>
`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>PUBLIC SPARK - Latest News</title>
    <link>${escapeXml(origin)}</link>
    <description>Independent Digital Newsroom - Breaking News, Fact-Checked Reports &amp; Regional Journalism</description>
    <language>hi-IN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <ttl>15</ttl>
    <atom:link href="${escapeXml(origin)}/rss.xml" rel="self" type="application/rss+xml" />
${itemsXml}  </channel>
</rss>`;
}

export function buildRobotsTxt(origin) {
  return `User-agent: *
Allow: /
Disallow: /admin
Disallow: /desk
Disallow: /developer
Disallow: /editor
Disallow: /reporter
Disallow: /login
Disallow: /api/

User-agent: Googlebot
Allow: /

User-agent: Googlebot-News
Allow: /

User-agent: Mediapartners-Google
Allow: /

User-agent: WhatsApp
Allow: /

Sitemap: ${origin}/sitemap.xml
Sitemap: ${origin}/news-sitemap.xml
Sitemap: ${origin}/rss.xml
`;
}

export function xmlResponse(xml) {
  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300'
    }
  });
}

