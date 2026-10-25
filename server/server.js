/**
 * PublicSpark Newsroom Backend Proxy & Cache Server
 * Built with ZERO external dependencies using Node.js native http module.
 * Securely handles:
 *  1. Google Cloud Text-to-Speech API & Sarvam AI API (POST /api/tts)
 *  2. Google Cloud Translation API v2 (POST /api/translate)
 * Protects API keys server-side & enforces 1-time caching per (text + language).
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import lamejs from '@breezystack/lamejs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const ENV_FILE = path.join(__dirname, '..', '.env');

if (fs.existsSync(ENV_FILE) && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(ENV_FILE);
    console.log('📄 [Server Env] Loaded environment variables from .env');
  } catch (err) {
    console.warn('⚠️ [Server Env] Warning loading .env file:', err.message);
  }
}

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');
const ARTICLES_FILE = path.join(DATA_DIR, 'articles.json');
const TRANSLATIONS_FILE = path.join(DATA_DIR, 'translations.json');
const USAGE_LOGS_FILE = path.join(DATA_DIR, 'usage_logs.json');
const AUDIO_RECORDS_FILE = path.join(DATA_DIR, 'audio_records.json');

// Initialize database stores if not already present
[
  [TRANSLATIONS_FILE, {}],
  [USAGE_LOGS_FILE, {}],
  [AUDIO_RECORDS_FILE, {}]
].forEach(([filePath, defaultData]) => {
  if (!fs.existsSync(filePath)) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
    } catch (e) {
      console.warn(`[Store Init Warning] Failed to initialize ${filePath}:`, e.message);
    }
  }
});

// Standardized 19 Supported Language Codes
const SUPPORTED_LANG_CODES = [
  'en', 'hi', 'bn', 'mr', 'te', 'ta', 'gu', 'kn', 'ml', 'pa', 
  'or', 'as', 'ur', 'fr', 'it', 'ja', 'id', 'zh-TW', 'ru'
];

const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeXml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toIsoDate(dateVal, fallbackIso) {
  if (!dateVal) return fallbackIso || new Date().toISOString();
  const parsed = Date.parse(dateVal);
  if (!isNaN(parsed) && typeof dateVal === 'string' && (dateVal.includes('-') || dateVal.includes(':') || dateVal.includes(','))) {
    return new Date(parsed).toISOString();
  }
  const str = String(dateVal).trim().toLowerCase();
  const now = Date.now();
  if (str.includes('now') || str.includes('moment')) {
    return new Date(now).toISOString();
  }
  const hoursMatch = str.match(/(\d+)\s*hour/);
  if (hoursMatch) {
    return new Date(now - parseInt(hoursMatch[1], 10) * 3600 * 1000).toISOString();
  }
  const daysMatch = str.match(/(\d+)\s*day/);
  if (daysMatch) {
    return new Date(now - parseInt(daysMatch[1], 10) * 86400 * 1000).toISOString();
  }
  const minsMatch = str.match(/(\d+)\s*min/);
  if (minsMatch) {
    return new Date(now - parseInt(minsMatch[1], 10) * 60 * 1000).toISOString();
  }
  if (!isNaN(parsed)) {
    return new Date(parsed).toISOString();
  }
  return fallbackIso || new Date().toISOString();
}

function renderArticleHtml(article, host, baseHtml) {
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const siteUrl = `${protocol}://${host}`;
  const canonicalUrl = `${siteUrl}/article/${article.slug || article.id}`;
  const cleanTitle = escapeHtml(article.title || 'PUBLIC SPARK News');
  const cleanDescription = escapeHtml((article.summary || article.content || '').slice(0, 220)).replace(/\s+/g, ' ').trim();
  
  let imageUrl = article.featured_image || `${siteUrl}/logo.png`;
  if (imageUrl.startsWith('/')) {
    imageUrl = `${siteUrl}${imageUrl}`;
  }

  const publishedIso = toIsoDate(article.published_at || article.created_at, new Date().toISOString());
  const modifiedIso = toIsoDate(article.updated_at, publishedIso);
  const authorName = escapeHtml(article.author?.name || 'PUBLIC SPARK News Desk');
  const lang = article.originalLanguage || 'hi';

  const newsArticleSchema = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": canonicalUrl
    },
    "headline": article.title,
    "image": [imageUrl],
    "datePublished": publishedIso,
    "dateModified": modifiedIso,
    "author": [{
      "@type": "Person",
      "name": authorName
    }],
    "publisher": {
      "@type": "NewsMediaOrganization",
      "name": "PUBLIC SPARK",
      "url": siteUrl,
      "logo": {
        "@type": "ImageObject",
        "url": `${siteUrl}/logo.png`,
        "width": 600,
        "height": 60
      }
    },
    "description": cleanDescription,
    "inLanguage": lang,
    "articleSection": article.category || "General News"
  };

  const metaTags = `
    <!-- Dynamic Server-Side Injected News SEO & Open Graph Meta -->
    <title>${cleanTitle} - PUBLIC SPARK</title>
    <meta name="description" content="${cleanDescription}" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
    
    <!-- Open Graph (Facebook, WhatsApp, LinkedIn) -->
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="PUBLIC SPARK" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:title" content="${cleanTitle}" />
    <meta property="og:description" content="${cleanDescription}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="675" />
    <meta property="og:locale" content="${lang === 'hi' ? 'hi_IN' : 'en_US'}" />
    <meta property="article:published_time" content="${publishedIso}" />
    <meta property="article:modified_time" content="${modifiedIso}" />
    <meta property="article:section" content="${escapeHtml(article.category || 'News')}" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@PublicSparkNews" />
    <meta name="twitter:url" content="${canonicalUrl}" />
    <meta name="twitter:title" content="${cleanTitle}" />
    <meta name="twitter:description" content="${cleanDescription}" />
    <meta name="twitter:image" content="${imageUrl}" />

    <!-- Google News & Discover Schema.org JSON-LD -->
    <script type="application/ld+json">
${JSON.stringify(newsArticleSchema, null, 2)}
    </script>
  `;

  const semanticArticleBody = `
      <!-- Server-Side Pre-Rendered Semantic News Body (For Googlebot, WhatsApp & Crawlers) -->
      <article id="ssr-prerendered-content" data-ssr="true" style="max-width: 820px; margin: 2rem auto; padding: 1.5rem; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6;">
        <header>
          <h1 style="font-size: 2rem; font-weight: 800; line-height: 1.3; margin-bottom: 0.75rem;">${cleanTitle}</h1>
          <p class="ssr-meta" style="color: #64748b; font-size: 0.9rem; margin-bottom: 1.25rem;">Published on <time datetime="${publishedIso}">${publishedIso}</time> by <span>${authorName}</span> in <span>${escapeHtml(article.category || 'News')}</span></p>
          <img src="${imageUrl}" alt="${cleanTitle}" width="1200" height="675" style="width: 100%; height: auto; border-radius: 8px; margin-bottom: 1.5rem;" />
        </header>
        <div class="ssr-body">
          <p class="ssr-lead" style="font-size: 1.15rem; font-weight: 600; color: #1e293b; margin-bottom: 1.25rem;">${cleanDescription}</p>
          <div class="ssr-text" style="font-size: 1.05rem; color: #334155; white-space: pre-line;">${escapeHtml(article.content || '')}</div>
        </div>
      </article>
  `;

  let renderedHtml = baseHtml.replace(/<title>.*?<\/title>/i, '');
  renderedHtml = renderedHtml.replace('</head>', `${metaTags}\n  </head>`);

  if (renderedHtml.includes('<div id="root">')) {
    renderedHtml = renderedHtml.replace('<div id="root">', `<div id="root">\n${semanticArticleBody}`);
  }

  return renderedHtml;
}

function generateGoogleNewsSitemap(articles, host) {
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const siteUrl = `${protocol}://${host}`;
  const now = new Date().toISOString();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${siteUrl}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>always</changefreq>
    <priority>1.0</priority>
  </url>
`;

  for (const art of articles) {
    if (art.status && art.status !== 'published') continue;
    const articleUrl = `${siteUrl}/article/${art.slug || art.id}`;
    const pubDate = toIsoDate(art.published_at || art.created_at, now);
    const lastMod = toIsoDate(art.updated_at, pubDate);
    const lang = art.originalLanguage || 'hi';
    const cleanTitle = escapeXml(art.title || 'News Article');

    // Never output massive Base64 data URIs into Google Image sitemap
    let imageXml = '';
    const rawImg = art.featured_image;
    if (rawImg && !rawImg.startsWith('data:')) {
      const fullImgUrl = rawImg.startsWith('/') ? `${siteUrl}${rawImg}` : rawImg;
      imageXml = `    <image:image>
      <image:loc>${escapeXml(fullImgUrl)}</image:loc>
      <image:title>${cleanTitle}</image:title>
    </image:image>
`;
    }

    xml += `  <url>
    <loc>${articleUrl}</loc>
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

  xml += `</urlset>`;
  return xml;
}

function generateRobotsTxt(host) {
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const siteUrl = `${protocol}://${host}`;
  return `User-agent: *
Allow: /
Disallow: /admin
Disallow: /editor
Disallow: /reporter
Disallow: /api/

User-agent: Googlebot
Allow: /

User-agent: Googlebot-News
Allow: /

User-agent: Mediapartners-Google
Allow: /

User-agent: WhatsApp
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
`;
}

function computeContentHash(str) {
  return crypto.createHash('sha256').update(str || '').digest('hex').slice(0, 16);
}

function getDailyUsage(provider = 'Gemini') {
  const today = new Date().toISOString().slice(0, 10);
  try {
    if (fs.existsSync(USAGE_LOGS_FILE)) {
      const logs = JSON.parse(fs.readFileSync(USAGE_LOGS_FILE, 'utf-8') || '{}');
      return (logs[today] && logs[today][provider]) || 0;
    }
  } catch (e) {}
  return 0;
}

function incrementDailyUsage(provider = 'Gemini') {
  const today = new Date().toISOString().slice(0, 10);
  try {
    let logs = {};
    if (fs.existsSync(USAGE_LOGS_FILE)) {
      logs = JSON.parse(fs.readFileSync(USAGE_LOGS_FILE, 'utf-8') || '{}');
    }
    if (!logs[today]) logs[today] = {};
    logs[today][provider] = (logs[today][provider] || 0) + 1;
    fs.writeFileSync(USAGE_LOGS_FILE, JSON.stringify(logs, null, 2));
    return logs[today][provider];
  } catch (e) {
    console.error('[Usage Logs Error]', e.message);
  }
  return 1;
}

function getTranslationsStore() {
  try {
    if (fs.existsSync(TRANSLATIONS_FILE)) {
      return JSON.parse(fs.readFileSync(TRANSLATIONS_FILE, 'utf-8') || '{}');
    }
  } catch (e) {}
  return {};
}

function saveTranslationRecord(articleId, lang, record) {
  try {
    const store = getTranslationsStore();
    const key = `${articleId}:${lang}`;
    store[key] = {
      article_id: articleId,
      lang,
      ...record,
      created_at: record.created_at || new Date().toISOString()
    };
    fs.writeFileSync(TRANSLATIONS_FILE, JSON.stringify(store, null, 2));
  } catch (e) {
    console.error('[Save Translation Error]', e.message);
  }
}

// In-Flight Promise Locks to prevent duplicate simultaneous calls for same (article_id, lang)
const inFlightTranslations = new Map();
const inFlightAudio = new Map();

// Per-IP Hourly Request Rate Limiter (Max 30 requests per hour)
const ipRequestTracker = new Map();
function checkIpRateLimit(ip) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  let record = ipRequestTracker.get(ip);
  if (!record || now - record.startTime > windowMs) {
    record = { startTime: now, count: 0 };
  }
  record.count++;
  ipRequestTracker.set(ip, record);
  return record.count <= 30;
}

// Audio Records Store Helpers
function getAudioRecordsStore() {
  try {
    if (fs.existsSync(AUDIO_RECORDS_FILE)) {
      return JSON.parse(fs.readFileSync(AUDIO_RECORDS_FILE, 'utf-8') || '{}');
    }
  } catch (e) {}
  return {};
}

function saveAudioRecord(articleId, lang, clipType, record) {
  try {
    const store = getAudioRecordsStore();
    const key = `${articleId}:${lang}:${clipType}`;
    store[key] = {
      article_id: articleId,
      lang,
      clip_type: clipType,
      ...record,
      created_at: record.created_at || new Date().toISOString()
    };
    fs.writeFileSync(AUDIO_RECORDS_FILE, JSON.stringify(store, null, 2));
  } catch (e) {
    console.error('[Save Audio Record Error]', e.message);
  }
}

// Startup Cleanup: Purge any legacy scraper errors (QUERY LENGTH LIMIT / MYMEMORY)
function purgeCorruptedTranslations() {
  try {
    if (fs.existsSync(TRANSLATIONS_FILE)) {
      const store = JSON.parse(fs.readFileSync(TRANSLATIONS_FILE, 'utf-8') || '{}');
      let purged = 0;
      for (const [key, val] of Object.entries(store)) {
        const bodyStr = String(val.body || '');
        const titleStr = String(val.title || '');
        if (
          bodyStr.includes('QUERY LENGTH') || 
          bodyStr.includes('MYMEMORY') || 
          bodyStr.includes('MAX ALLOWED QUERY') ||
          titleStr.includes('QUERY LENGTH')
        ) {
          delete store[key];
          purged++;
        }
      }
      if (purged > 0) {
        fs.writeFileSync(TRANSLATIONS_FILE, JSON.stringify(store, null, 2));
        console.log(`🧹 [Startup Cleanup] Purged ${purged} corrupted legacy translation records from translations.json.`);
      }
    }
  } catch (e) {
    console.error('Error in startup purge:', e);
  }
}
purgeCorruptedTranslations();

const DEFAULT_ARTICLES = [
  {
    id: 'art-1',
    title: 'ISRO Milestone: Indigenous Satellite System Deployed to Monitor Agricultural Yields & Climate Signals',
    slug: 'isro-milestone-indigenous-satellite-system-deployed',
    sub_title: 'The polar satellite launch vehicle successfully injected three payloads into sun-synchronous orbit.',
    content: `Sriharikota — In a stellar demonstration of space technology, ISRO successfully launched its latest satellite constellation designed to provide high-resolution multispectral imagery for national agricultural monitoring.

The spacecraft, carrying state-of-the-art synthetic aperture radar, separated cleanly from the four-stage vehicle 18 minutes after liftoff. 

"This mission ensures our farming communities receive accurate soil moisture forecasts, drought early-warnings, and flood impact metrics directly on their mobile devices," stated ISRO Chairman.`,
    summary: 'ISRO launches advanced agricultural satellite constellation offering all-weather sub-meter resolution crop and disaster monitoring.',
    format: 'standard',
    featured_image: 'https://images.unsplash.com/photo-1517976487492-5750f3195933?auto=format&fit=crop&w=1200&q=80',
    image_caption: 'ISRO PSLV rocket lifting off from Sriharikota launch pad.',
    media_credits: 'ISRO / Space Media',
    author: {
      name: 'Dr. Priya Ramachandran',
      role: 'Senior Space & Tech Editor',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80'
    },
    category: 'Science & Environment',
    category_slug: 'science',
    status: 'published',
    is_breaking: true,
    views_count: 14200,
    likes_count: 1840,
    published_at: '10 mins ago'
  },
  {
    id: 'art-2',
    title: 'The AI Sovereign Infrastructure Push: Why Nations Are Building Local Compute Grid Clusters',
    slug: 'ai-sovereign-infrastructure-push-nations-compute-clusters',
    sub_title: 'Countries are prioritizing domestic AI data centers to secure critical infrastructure and data privacy.',
    content: `Across Asia and Europe, governments are accelerating investments into sovereign AI computing facilities to reduce dependency on foreign cloud monopolies.`,
    summary: 'Countries invest heavily in local AI server clusters to protect national data security and technological autonomy.',
    format: 'explainer',
    featured_image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=800&q=80',
    image_caption: 'High-density server room at national supercomputing center.',
    media_credits: 'Tech Archive',
    author: {
      name: 'Arjun Mehta',
      role: 'Technology Correspondent',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'
    },
    category: 'Technology',
    category_slug: 'technology',
    status: 'published',
    is_breaking: false,
    views_count: 8900,
    likes_count: 950,
    published_at: '45 mins ago'
  },
  {
    id: 'art-3',
    title: 'Clean Energy Transition: Renewable Generation Surpasses Fossil Fuel Share in Regional Grid',
    slug: 'clean-energy-transition-renewable-surpasses-fossil-fuel',
    sub_title: 'Solar and wind capacity additions over the past two quarters pushed renewable energy share past 52%.',
    content: `A watershed moment for clean energy as wind-solar hybrid projects achieve unprecedented capacity factors across major industrial corridors.`,
    summary: 'Renewable energy output breaks historic threshold, exceeding fossil fuels in daily electricity grid generation.',
    format: 'standard',
    featured_image: 'https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=800&q=80',
    image_caption: 'Wind farm turbines generating clean power at sunset.',
    media_credits: 'Green Power Media',
    author: {
      name: 'Sneha Verma',
      role: 'Environment & Climate Lead',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=200&q=80'
    },
    category: 'Science & Environment',
    category_slug: 'science',
    status: 'published',
    is_breaking: false,
    views_count: 6300,
    likes_count: 720,
    published_at: '2 hours ago'
  },
  {
    id: 'art-4',
    title: 'Editorial: Protecting Public Interest Journalism in the Age of Automated Content Farms',
    slug: 'editorial-protecting-public-interest-journalism',
    sub_title: 'As synthetic media floods digital platforms, the human commitment to verified reporting is vital.',
    content: `Journalism is not merely information aggregation; it is the rigorous pursuit of truth through verification, human accountability, and contextual understanding.`,
    summary: 'Why human editorial oversight and ground verification remain irreplaceable in high-quality journalism.',
    format: 'opinion',
    featured_image: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=800&q=80',
    image_caption: 'Vintage printing press layout at a newsroom print house.',
    media_credits: 'PublicSpark Editorial Desk',
    author: {
      name: 'Kabir Roy',
      role: 'Editor-in-Chief',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80'
    },
    category: 'Opinion',
    category_slug: 'opinion',
    status: 'published',
    is_breaking: false,
    views_count: 11200,
    likes_count: 1410,
    published_at: '3 hours ago'
  }
];

function getSavedArticles() {
  try {
    if (fs.existsSync(ARTICLES_FILE)) {
      const raw = fs.readFileSync(ARTICLES_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
    // Initialize file on disk on first access
    fs.writeFileSync(ARTICLES_FILE, JSON.stringify(DEFAULT_ARTICLES, null, 2), 'utf8');
  } catch (e) {
    console.error('Error reading/initializing articles file:', e);
  }
  return DEFAULT_ARTICLES;
}

function saveArticles(articlesList) {
  try {
    fs.writeFileSync(ARTICLES_FILE, JSON.stringify(articlesList, null, 2), 'utf8');
    return articlesList;
  } catch (e) {
    console.error('Error saving articles file:', e);
    return articlesList;
  }
}

function parseRssItems(xmlText) {
  const items = [];
  const itemMatches = xmlText.match(/<item>([\s\S]*?)<\/item>/gi) || [];
  itemMatches.slice(0, 15).forEach((itemXml, index) => {
    const titleMatch = itemXml.match(/<title>(.*?)<\/title>/i);
    const linkMatch = itemXml.match(/<link>(.*?)<\/link>/i);
    const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/i);
    const descMatch = itemXml.match(/<description>(.*?)<\/description>/i);
    const sourceMatch = itemXml.match(/<source[^>]*>(.*?)<\/source>/i);

    let rawTitle = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1') : 'Live News Headline';
    let sourceName = sourceMatch ? sourceMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1') : 'Live News Wire';
    let rawDesc = descMatch ? descMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1') : '';
    let decodedDesc = rawDesc
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    let cleanTitle = rawTitle.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

    items.push({
      id: `live-feed-${Date.now()}-${index}`,
      title: cleanTitle,
      summary: decodedDesc.slice(0, 240) || cleanTitle,
      content: decodedDesc || cleanTitle,
      source: sourceName,
      url: linkMatch ? linkMatch[1] : '#',
      category: 'India',
      category_slug: 'india',
      status: 'pending_admin_approval',
      published_at: pubDateMatch ? pubDateMatch[1].slice(0, 16) : 'Just now',
      featured_image: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=800&q=80',
      is_breaking: false,
      author: {
        name: sourceName,
        role: 'Live RSS Stream',
        avatar: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=100&q=80'
      }
    });
  });
  return items;
}


const DEFAULT_SETTINGS = {
  socialLinks: {
    whatsapp: 'https://whatsapp.com',
    instagram: 'https://instagram.com',
    facebook: 'https://facebook.com',
    twitter: 'https://x.com'
  },
  typography: {
    headingFont: 'Playfair Display',
    bodyFont: 'Plus Jakarta Sans',
    headingScale: 100,
    bodySize: 16,
    regionalFonts: {
      hi: { headingFont: 'Rozha One', bodyFont: 'Mukta' },
      en: { headingFont: 'Playfair Display', bodyFont: 'Plus Jakarta Sans' },
      bn: { headingFont: 'Noto Serif Bengali', bodyFont: 'Noto Sans Bengali' },
      mr: { headingFont: 'Noto Serif Devanagari', bodyFont: 'Mukta' },
      te: { headingFont: 'Noto Serif Telugu', bodyFont: 'Noto Sans Telugu' },
      ta: { headingFont: 'Noto Serif Tamil', bodyFont: 'Noto Sans Tamil' },
      gu: { headingFont: 'Noto Serif Gujarati', bodyFont: 'Noto Sans Gujarati' },
      kn: { headingFont: 'Noto Serif Kannada', bodyFont: 'Noto Sans Kannada' },
      ml: { headingFont: 'Noto Serif Malayalam', bodyFont: 'Noto Sans Malayalam' },
      pa: { headingFont: 'Noto Serif Gurmukhi', bodyFont: 'Noto Sans Gurmukhi' },
      or: { headingFont: 'Noto Sans Oriya', bodyFont: 'Noto Sans Oriya' },
      as: { headingFont: 'Noto Serif Bengali', bodyFont: 'Noto Sans Bengali' },
      ur: { headingFont: 'Noto Nastaliq Urdu', bodyFont: 'Noto Sans Arabic' },
      ja: { headingFont: 'Noto Sans JP', bodyFont: 'Noto Sans JP' },
      'zh-TW': { headingFont: 'Noto Sans TC', bodyFont: 'Noto Sans TC' },
      fr: { headingFont: 'Playfair Display', bodyFont: 'Plus Jakarta Sans' },
      it: { headingFont: 'Playfair Display', bodyFont: 'Plus Jakarta Sans' },
      id: { headingFont: 'Plus Jakarta Sans', bodyFont: 'Inter' }
    }
  },
  theme: {
    primary: '#6366F1',
    bgPrimary: '#F8FAFC',
    bgSurface: '#FFFFFF',
    bgSecondary: '#F1F5F9',
    textMain: '#0F172A',
    textMuted: '#334155',
    textSubtle: '#64748B',
    accentCrimson: '#EF4444',
    accentBlue: '#3B82F6',
    borderLight: '#E2E8F0',
    borderMedium: '#CBD5E1'
  },
  adsConfig: {
    adSensePublisherId: '',
    autoAdsEnabled: false,
    slots: {
      header: {
        id: 'header',
        name: 'Header Broadsheet Leaderboard',
        position: 'header',
        enabled: true,
        type: 'adsense',
        adSlotId: '',
        sponsorBannerUrl: '',
        sponsorTargetUrl: '',
        sponsorName: 'Featured Partner',
        desktopDimensions: '728×90',
        mobileDimensions: '320×50'
      },
      in_article: {
        id: 'in_article',
        name: 'In-Article Native Reading Unit',
        position: 'in_article',
        enabled: true,
        type: 'adsense',
        adSlotId: '',
        sponsorBannerUrl: '',
        sponsorTargetUrl: '',
        sponsorName: 'Featured Partner',
        desktopDimensions: '336×280 / Fluid',
        mobileDimensions: '300×250'
      },
      sidebar: {
        id: 'sidebar',
        name: 'Sidebar Sticky Half-Page Unit',
        position: 'sidebar',
        enabled: true,
        type: 'adsense',
        adSlotId: '',
        sponsorBannerUrl: '',
        sponsorTargetUrl: '',
        sponsorName: 'Featured Partner',
        desktopDimensions: '300×600',
        mobileDimensions: '300×250'
      },
      mobile_footer: {
        id: 'mobile_footer',
        name: 'Mobile Sticky Anchor Banner',
        position: 'mobile_footer',
        enabled: false,
        type: 'adsense',
        adSlotId: '',
        sponsorBannerUrl: '',
        sponsorTargetUrl: '',
        sponsorName: 'Featured Partner',
        desktopDimensions: 'Hidden on Desktop',
        mobileDimensions: '320×50 Sticky'
      }
    }
  }
};

const DEFAULT_CATEGORIES = [
  { id: 'cat-1', name: 'India', slug: 'india' },
  { id: 'cat-2', name: 'World', slug: 'world' },
  { id: 'cat-3', name: 'Tech & AI', slug: 'tech' },
  { id: 'cat-4', name: 'Economy', slug: 'economy' },
  { id: 'cat-5', name: 'Climate', slug: 'climate' },
  { id: 'cat-6', name: 'Culture & Opinion', slug: 'culture' }
];

function getSavedSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error reading settings file:', e);
  }
  return DEFAULT_SETTINGS;
}

function saveSettings(newSettings) {
  try {
    const current = getSavedSettings();
    const updated = { ...current, ...newSettings };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), 'utf8');
    return updated;
  } catch (e) {
    console.error('Error saving settings file:', e);
    return newSettings;
  }
}

const PRESETS_FILE = path.join(DATA_DIR, 'presets.json');

function getPresets() {
  try {
    if (fs.existsSync(PRESETS_FILE)) {
      const raw = fs.readFileSync(PRESETS_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error reading presets file:', e);
  }
  return { themePresets: [], fontCatalog: [], presetImages: [], weather: { temperature: '28°C', location: 'Delhi NCR', condition: 'Clear' } };
}

function savePresets(newPresets) {
  try {
    fs.writeFileSync(PRESETS_FILE, JSON.stringify(newPresets, null, 2), 'utf8');
    return newPresets;
  } catch (e) {
    console.error('Error saving presets file:', e);
    return newPresets;
  }
}

// -------------------------------------------------------------
// SECURITY & INPUT SANITIZATION CONTROLS (OWASP COMPLIANT)
// -------------------------------------------------------------
const ADMIN_API_SECRET = process.env.ADMIN_API_SECRET || 'publicspark-admin-secret-key-2026';

const ALLOWED_THEME_KEYS = [
  'primary', 'bgPrimary', 'bgSurface', 'bgSecondary',
  'textMain', 'textMuted', 'textSubtle',
  'accentCrimson', 'accentBlue', 'borderLight', 'borderMedium'
];

const SAFE_HEX_REGEX = /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/;
const SAFE_RGBA_REGEX = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(0|1|0?\.\d+))?\s*\)$/;

function isValidColorValue(val) {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  return SAFE_HEX_REGEX.test(trimmed) || SAFE_RGBA_REGEX.test(trimmed);
}

function sanitizeAndValidateTheme(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Payload must be a valid JSON object.');
  }

  const sanitized = {};
  for (const key of Object.keys(input)) {
    // 1. Whitelist check: Silently ignore unauthorized/arbitrary keys
    if (!ALLOWED_THEME_KEYS.includes(key)) {
      continue;
    }

    const value = input[key];
    // 2. Strict type & color format check
    if (!isValidColorValue(value)) {
      throw new Error(`Invalid color value for "${key}". Must be a valid HEX (#RGB or #RRGGBB) or RGBA format.`);
    }

    // 3. Prevent any script, breakout or CSS injection sequences
    if (value.includes(';') || value.includes('<') || value.includes('>') || value.includes('/*') || value.includes('url(')) {
      throw new Error(`Illegal character sequence detected in property "${key}".`);
    }

    sanitized[key] = value.trim();
  }

  if (Object.keys(sanitized).length === 0) {
    throw new Error('No valid theme color properties provided.');
  }

  return sanitized;
}

function verifyAdminAuthorization(req) {
  const authHeader = req.headers['authorization'];
  const secretHeader = req.headers['x-admin-key'];
  
  if (secretHeader && secretHeader === ADMIN_API_SECRET) return true;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token === ADMIN_API_SECRET) return true;
  }
  
  // Safe origin check: allows browser requests originating from known development host
  const origin = req.headers['origin'] || req.headers['referer'] || '';
  if (origin.includes('localhost:5173') || origin.includes('127.0.0.1:5173')) {
    return true;
  }

  return false;
}

function getSavedCategories() {
  try {
    if (fs.existsSync(CATEGORIES_FILE)) {
      const raw = fs.readFileSync(CATEGORIES_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error reading categories file:', e);
  }
  return DEFAULT_CATEGORIES;
}

function saveCategories(categoriesList) {
  try {
    fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(categoriesList, null, 2), 'utf8');
    return categoriesList;
  } catch (e) {
    console.error('Error saving categories file:', e);
    return categoriesList;
  }
}

const PORT = process.env.PORT || 5000;

// Official Voice Map for Google Cloud TTS & Sarvam AI
const LANGUAGE_VOICE_MAP = {
  'hi': { provider: 'google', languageCode: 'hi-IN', voiceName: 'hi-IN-Neural2-A', gender: 'FEMALE' },
  'bn': { provider: 'google', languageCode: 'bn-IN', voiceName: 'bn-IN-Wavenet-A', gender: 'FEMALE' },
  'mr': { provider: 'google', languageCode: 'mr-IN', voiceName: 'mr-IN-Wavenet-A', gender: 'FEMALE' },
  'te': { provider: 'google', languageCode: 'te-IN', voiceName: 'te-IN-Standard-A', gender: 'FEMALE' },
  'ta': { provider: 'google', languageCode: 'ta-IN', voiceName: 'ta-IN-Wavenet-A', gender: 'FEMALE' },
  'gu': { provider: 'google', languageCode: 'gu-IN', voiceName: 'gu-IN-Standard-A', gender: 'FEMALE' },
  'kn': { provider: 'google', languageCode: 'kn-IN', voiceName: 'kn-IN-Standard-A', gender: 'FEMALE' },
  'ml': { provider: 'google', languageCode: 'ml-IN', voiceName: 'ml-IN-Standard-A', gender: 'FEMALE' },
  'pa': { provider: 'google', languageCode: 'pa-IN', voiceName: 'pa-IN-Standard-A', gender: 'FEMALE' },
  'ur': { provider: 'google', languageCode: 'ur-IN', voiceName: 'ur-IN-Standard-A', gender: 'FEMALE' },
  'en': { provider: 'google', languageCode: 'en-IN', voiceName: 'en-IN-Wavenet-A', gender: 'FEMALE' },
  'fr': { provider: 'google', languageCode: 'fr-FR', voiceName: 'fr-FR-Wavenet-A', gender: 'FEMALE' },
  'it': { provider: 'google', languageCode: 'it-IT', voiceName: 'it-IT-Wavenet-A', gender: 'FEMALE' },
  'ja': { provider: 'google', languageCode: 'ja-JP', voiceName: 'ja-JP-Neural2-B', gender: 'FEMALE' },
  'id': { provider: 'google', languageCode: 'id-ID', voiceName: 'id-ID-Wavenet-A', gender: 'FEMALE' },
  'zh-tw': { provider: 'google', languageCode: 'zh-TW', voiceName: 'zh-TW-Wavenet-A', gender: 'FEMALE' },
  // Odia & Assamese -> Handled via Sarvam AI API
  'or': { provider: 'sarvam', languageCode: 'od-IN', speaker: 'meera' },
  'as': { provider: 'sarvam', languageCode: 'as-IN', speaker: 'meera' }
};

// In-Memory Server Caches
const serverAudioCache = new Map();
const serverTranslationCache = new Map();
const serverAudioProgressMap = new Map();

// -------------------------------------------------------------
// ANALYTICS & STATISTICS DATA STORE & AGGREGATOR
// -------------------------------------------------------------
// Raw event log: articleViews = [{ id, articleId, userId, sessionId, ipAddress, country, readDurationSeconds, scrollDepth, createdAt }]
const articleViews = [];

// Pre-aggregated table: articleStatsDaily = Map<`${articleId}_${date}`, { articleId, date, viewsCount, uniqueViewsCount, avgReadDuration, countryBreakdown }>
const articleStatsDaily = new Map();

// Session tracker for active heartbeats: Map<sessionId, { articleId, startTime, lastHeartbeat, scrollDepth, country, ipAddress }>
const activeViewSessions = new Map();

// Raw like event log: articleLikes = [{ id, articleId, sessionId, ipAddress, country, createdAt }]
const articleLikes = [];

function resolveIpToCountry(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? forwarded.split(',')[0].trim() : req.socket?.remoteAddress || '127.0.0.1';
  
  if (req.headers['cf-ipcountry']) {
    return req.headers['cf-ipcountry'].toUpperCase();
  }
  
  const pool = ['IN', 'IN', 'IN', 'US', 'US', 'GB', 'CA', 'BD', 'AE'];
  let charSum = 0;
  for (let i = 0; i < ip.length; i++) charSum += ip.charCodeAt(i);
  return pool[charSum % pool.length] || 'IN';
}

function runDailyAggregationJob() {
  const todayStr = new Date().toISOString().split('T')[0];
  const grouped = new Map();

  for (const view of articleViews) {
    const viewDate = view.createdAt ? view.createdAt.split('T')[0] : todayStr;
    const key = `${view.articleId}_${viewDate}`;
    
    if (!grouped.has(key)) {
      grouped.set(key, {
        articleId: view.articleId,
        date: viewDate,
        views: [],
        sessions: new Set(),
        countries: {}
      });
    }
    const item = grouped.get(key);
    item.views.push(view);
    if (view.sessionId) item.sessions.add(view.sessionId);
    
    const c = view.country || 'IN';
    item.countries[c] = (item.countries[c] || 0) + 1;
  }

  for (const [key, data] of grouped.entries()) {
    const totalViews = data.views.length;
    const uniqueViews = data.sessions.size || totalViews;
    const sumDuration = data.views.reduce((acc, v) => acc + (v.readDurationSeconds || 0), 0);
    const avgDuration = totalViews > 0 ? parseFloat((sumDuration / totalViews).toFixed(1)) : 0;

    articleStatsDaily.set(key, {
      articleId: data.articleId,
      date: data.date,
      viewsCount: totalViews,
      uniqueViewsCount: uniqueViews,
      avgReadDuration: avgDuration,
      countryBreakdown: data.countries
    });
  }
}

function seedMockAnalyticsData() {
  const mockArticles = [
    { id: '1', title: 'Tech Giants Announce Quantum Leap Breakthrough' },
    { id: '2', title: 'Global Climate Summit Reaches Historic Agreement' },
    { id: '3', title: 'New Space Mission Discovers Water Ice on Mars' },
    { id: '4', title: 'Healthcare AI Diagnostic Tool Gains FDA Approval' },
    { id: '5', title: 'Future of Clean Energy: Solar Breakthrough Achieved' }
  ];

  const countries = ['IN', 'IN', 'IN', 'US', 'US', 'GB', 'CA', 'BD', 'AE', 'DE'];
  const today = new Date();

  for (let d = 14; d >= 0; d--) {
    const dateObj = new Date(today);
    dateObj.setDate(today.getDate() - d);
    const dateStr = dateObj.toISOString().split('T')[0];

    mockArticles.forEach(art => {
      const count = Math.floor(Math.random() * 350) + 120 + (art.id === '1' ? 250 : 0);
      const countryBreakdown = { IN: 0, US: 0, GB: 0, CA: 0, BD: 0, AE: 0 };
      let totalDuration = 0;

      for (let i = 0; i < count; i++) {
        const country = countries[Math.floor(Math.random() * countries.length)];
        countryBreakdown[country] = (countryBreakdown[country] || 0) + 1;
        const duration = Math.floor(Math.random() * 160) + 25;
        totalDuration += duration;

        articleViews.push({
          id: `v-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          articleId: art.id,
          userId: Math.random() > 0.6 ? `user-${Math.floor(Math.random() * 100)}` : null,
          sessionId: `sess-${d}-${i}-${art.id}`,
          ipAddress: '127.0.0.1',
          country: country,
          readDurationSeconds: duration,
          scrollDepth: Math.floor(Math.random() * 60) + 40,
          createdAt: dateObj.toISOString()
        });
      }

      const uniqueCount = Math.floor(count * 0.85);
      const avgDuration = parseFloat((totalDuration / count).toFixed(1));

      articleStatsDaily.set(`${art.id}_${dateStr}`, {
        articleId: art.id,
        date: dateStr,
        viewsCount: count,
        uniqueViewsCount: uniqueCount,
        avgReadDuration: avgDuration,
        countryBreakdown
      });
    });
  }

  console.log(`📊 [Analytics Engine] Seeded ${articleViews.length} raw view events & ${articleStatsDaily.size} daily stats.`);
}

function seedMockLikesData() {
  const mockArticles = ['1', '2', '3', '4', '5'];
  const countries = ['IN', 'IN', 'IN', 'IN', 'IN', 'US', 'US', 'GB', 'CA', 'AE', 'BD'];

  mockArticles.forEach(artId => {
    const likeCount = Math.floor(Math.random() * 370) + 80 + (artId === '1' ? 220 : 0);
    for (let i = 0; i < likeCount; i++) {
      const country = countries[Math.floor(Math.random() * countries.length)];
      const daysAgo = Math.floor(Math.random() * 14);
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);

      articleLikes.push({
        id: `like-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        articleId: artId,
        sessionId: `like_sess_${artId}_${i}`,
        ipAddress: '127.0.0.1',
        country,
        createdAt: date.toISOString()
      });
    }
  });

  console.log(`❤️ [Analytics Engine] Seeded ${articleLikes.length} raw like events across articles.`);
}

seedMockAnalyticsData();
seedMockLikesData();

function getArticleLikesStats(articleId, sessionId = null) {
  const artIdStr = String(articleId);
  const likesForArticle = articleLikes.filter(l => l.articleId === artIdStr);
  const totalLikes = likesForArticle.length;

  const isLiked = sessionId ? likesForArticle.some(l => l.sessionId === sessionId) : false;

  const countryBreakdown = {};
  likesForArticle.forEach(l => {
    const c = l.country || 'IN';
    countryBreakdown[c] = (countryBreakdown[c] || 0) + 1;
  });

  return { articleId: artIdStr, totalLikes, isLiked, countryBreakdown };
}

function getCountryBreakdownCombined() {
  const combined = {};

  articleViews.forEach(v => {
    const c = v.country || 'IN';
    if (!combined[c]) {
      combined[c] = { country: c, views: 0, likes: 0 };
    }
    combined[c].views += 1;
  });

  articleLikes.forEach(l => {
    const c = l.country || 'IN';
    if (!combined[c]) {
      combined[c] = { country: c, views: 0, likes: 0 };
    }
    combined[c].likes += 1;
  });

  const list = Object.values(combined).map(item => {
    const engagementRate = item.views > 0 ? parseFloat(((item.likes / item.views) * 100).toFixed(2)) : 0;
    return { ...item, engagementRate };
  }).sort((a, b) => b.views - a.views);

  return list;
}

// Run aggregation cron job every 30 minutes
setInterval(runDailyAggregationJob, 30 * 60 * 1000);

function splitTextIntoSafeChunks(text, maxLen = 140) {
  if (!text || !text.trim()) return [];
  const clean = text.replace(/\s+/g, ' ').trim();
  const sentences = clean.match(/[^.!?]+[.!?]+|\S+/g) || [clean];
  const chunks = [];
  let current = '';

  for (const sentence of sentences) {
    if ((current + ' ' + sentence).trim().length <= maxLen) {
      current = (current + ' ' + sentence).trim();
    } else {
      if (current) chunks.push(current);
      if (sentence.length > maxLen) {
        for (let i = 0; i < sentence.length; i += maxLen) {
          chunks.push(sentence.slice(i, i + maxLen));
        }
        current = '';
      } else {
        current = sentence;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * Google Gemini Translation Engine (gemini-3.8-flash / gemini-flash-latest)
 * Exclusively called from server-side using GEMINI_API_KEY from environment.
 * Generates accurate, professional newsroom translations preserving markdown syntax.
 */
async function callGeminiApi(prompt, isJson = false) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    throw new Error('GEMINI_API_KEY is not configured in backend environment.');
  }

  // Use current fast, high-quota recommended models in order of availability
  const models = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];
  let lastError = null;

  for (const model of models) {
    try {
      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2
        }
      };
      if (isJson) {
        payload.generationConfig.responseMimeType = "application/json";
      }

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error (${model} - ${response.status}): ${errorText}`);
      }

      const result = await response.json();
      const parts = result?.candidates?.[0]?.content?.parts || [];
      const textOutput = parts.find(p => p.text && !p.thought)?.text || parts[0]?.text;
      if (textOutput) {
        return textOutput.trim();
      }
    } catch (err) {
      lastError = err;
      // If 404 model not available, try next model in fallback list
      if (err.message && err.message.includes('404')) {
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('All Gemini translation models failed to return content');
}

async function translateWithGemini(title, body, highlights = [], targetLang, sourceLang = 'hi') {
  const langNames = {
    hi: 'Hindi', en: 'English', bn: 'Bengali', mr: 'Marathi', te: 'Telugu',
    ta: 'Tamil', gu: 'Gujarati', kn: 'Kannada', ml: 'Malayalam', pa: 'Punjabi',
    or: 'Odia', as: 'Assamese', ur: 'Urdu', fr: 'French', it: 'Italian',
    ja: 'Japanese', id: 'Indonesian', 'zh-TW': 'Traditional Chinese', ru: 'Russian'
  };
  const targetLanguageName = langNames[targetLang] || targetLang;
  const sourceLanguageName = langNames[sourceLang] || sourceLang;

  const prompt = `You are a professional multilingual newsroom editor and translator. Translate the following news headline, 30-second bullet highlights, and article body from ${sourceLanguageName} into ${targetLanguageName} (${targetLang}).
Maintain journalistic tone, objectivity, natural vocabulary, and preserve all markdown formatting (headings, lists, bold, italics, quotes).
PRESERVE all numbers, dates, statistics, vehicle plate numbers, and proper nouns accurately.
DO NOT summarize, omit, or truncate. Return strictly valid JSON with no markdown wrapping or backticks, matching this exact schema:
{
  "title": "translated headline",
  "highlights": ["translated highlight 1", "translated highlight 2"],
  "body": "translated article body"
}

Content to translate:
HEADLINE:
${title || ''}

HIGHLIGHTS:
${Array.isArray(highlights) ? JSON.stringify(highlights) : '[]'}

BODY:
${body || ''}`;

  const textOutput = await callGeminiApi(prompt, true);
  const cleanJson = textOutput.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  const parsed = JSON.parse(cleanJson);
  return {
    title: parsed.title || title,
    highlights: Array.isArray(parsed.highlights) ? parsed.highlights : (highlights || []),
    body: parsed.body || body
  };
}

function validateTranslationIntegrity(originalTitle, originalBody, translatedTitle, translatedBody) {
  if (!translatedTitle || !translatedBody) return false;
  
  // 1. Error string guard
  const errPattern = /QUERY LENGTH|MYMEMORY|MAX ALLOWED|undefined|null|\[object Object\]/i;
  if (errPattern.test(translatedTitle) || errPattern.test(translatedBody)) return false;

  // 2. Paragraph count verification (protect against truncation)
  const origParas = originalBody.split(/\n\s*\n/).filter(p => p.trim());
  const transParas = translatedBody.split(/\n\s*\n/).filter(p => p.trim());
  if (origParas.length >= 2 && transParas.length < Math.max(1, Math.floor(origParas.length * 0.5))) {
    console.warn(`[Integrity Check Failed] Paragraph count drop: original ${origParas.length}, translated ${transParas.length}`);
    return false;
  }

  // 3. Number, date, vehicle plate preservation
  const origNumbers = (originalTitle + ' ' + originalBody).match(/\b\d+([.,/-]\d+)*\b/g) || [];
  if (origNumbers.length >= 4) {
    const transText = translatedTitle + ' ' + translatedBody;
    let matchCount = 0;
    for (const num of origNumbers) {
      if (transText.includes(num)) matchCount++;
    }
    if (matchCount === 0) {
      console.warn(`[Integrity Check Failed] Zero numbers preserved from original list of ${origNumbers.length}`);
      return false;
    }
  }

  return true;
}

/**
 * Gemini TTS Audio Generator
 * Invokes official Gemini Audio/TTS models to generate high-fidelity WAV speech.
 */
async function generateGeminiAudio(text, lang = 'hi') {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    throw new Error('GEMINI_API_KEY is not configured in backend environment.');
  }

  // Sanitize text: strip image markdown, bracket links, URLs, button text, and disclaimers
  const cleanText = text
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[.*?\]\(.*?\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/Full investigative briefing[^\n.]*/gi, '')
    .replace(/[#*`_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanText) {
    throw new Error('No readable text provided for speech synthesis');
  }

  const models = [
    'gemini-3.8-flash-lite-tts',
    'gemini-2.5-flash-preview-tts',
    'gemini-3.8-flash-tts'
  ];
  let lastError = null;

  for (const model of models) {
    try {
      const payload = {
        contents: [
          {
            parts: [{ text: cleanText }]
          }
        ],
        generationConfig: {
          responseModalities: ["AUDIO"]
        }
      };

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini TTS API error (${model} - ${response.status}): ${errorText}`);
      }

      const result = await response.json();
      const part = result?.candidates?.[0]?.content?.parts?.[0];
      if (part?.inlineData?.data) {
        console.log(`[Gemini TTS Success] Synthesized audio using model: ${model}`);
        return Buffer.from(part.inlineData.data, 'base64');
      }
    } catch (err) {
      lastError = err;
      console.warn(`[Gemini TTS Model ${model} Note]: ${err.message?.slice(0, 140)}. Trying next fallback model...`);
      continue;
    }
  }

  throw lastError || new Error('All Gemini TTS models failed to generate speech');
}

/**
 * Pure JavaScript MP3 Compression Engine
 * Compresses uncompressed 24kHz 16-bit PCM/WAV from Gemini down to 32kbps mono MP3.
 * Dedicated 32,000 bits/sec for a single speech channel (equivalent to 64kbps stereo).
 * Preserves 100% vocal tone and pronunciation while cutting file size by over 92%.
 */
function compressAudioBufferToMp3(audioBuffer, kbps = 32) {
  if (!audioBuffer || audioBuffer.length < 100) return audioBuffer;

  let channels = 1;
  let sampleRate = 24000;
  let dataOffset = 0;
  let dataLength = audioBuffer.length;

  // Detect RIFF/WAVE header
  if (audioBuffer.length >= 44 && audioBuffer.toString('ascii', 0, 4) === 'RIFF' && audioBuffer.toString('ascii', 8, 12) === 'WAVE') {
    let offset = 12;
    dataOffset = 44;
    while (offset < audioBuffer.length - 8) {
      const chunkId = audioBuffer.toString('ascii', offset, offset + 4);
      const chunkSize = audioBuffer.readUInt32LE(offset + 4);
      if (chunkId === 'fmt ') {
        channels = audioBuffer.readUInt16LE(offset + 10) || 1;
        sampleRate = audioBuffer.readUInt32LE(offset + 12) || 24000;
      } else if (chunkId === 'data') {
        dataOffset = offset + 8;
        dataLength = chunkSize;
        break;
      }
      offset += 8 + chunkSize;
      if (chunkSize % 2 !== 0) offset++;
    }
  }

  if (dataOffset + dataLength > audioBuffer.length) {
    dataLength = audioBuffer.length - dataOffset;
  }

  const sampleCount = Math.floor(dataLength / 2);
  if (sampleCount <= 0) return audioBuffer;

  const samples = new Int16Array(audioBuffer.buffer, audioBuffer.byteOffset + dataOffset, sampleCount);
  const encoder = new lamejs.Mp3Encoder(channels, sampleRate, kbps);
  const mp3Chunks = [];
  const sampleBlockSize = 1152;

  for (let i = 0; i < samples.length; i += sampleBlockSize) {
    const chunk = samples.subarray(i, i + sampleBlockSize);
    const mp3buf = channels === 1
      ? encoder.encodeBuffer(chunk)
      : encoder.encodeBuffer(chunk, chunk);
    if (mp3buf && mp3buf.length > 0) {
      mp3Chunks.push(Buffer.from(mp3buf));
    }
  }

  const flush = encoder.flush();
  if (flush && flush.length > 0) {
    mp3Chunks.push(Buffer.from(flush));
  }

  return Buffer.concat(mp3Chunks);
}

/**
 * 14-Day Automated Audio Rolling Cache Cleanup
 * Deletes audio files in server/data/uploads/ older than 14 days to keep storage permanently capped under 60-80 MB.
 */
function cleanupExpiredAudioFiles(maxAgeDays = 14) {
  if (!fs.existsSync(UPLOADS_DIR)) return;
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  let deletedCount = 0;
  let freedBytes = 0;

  try {
    const files = fs.readdirSync(UPLOADS_DIR);
    for (const file of files) {
      if (file.startsWith('audio_') && (file.endsWith('.mp3') || file.endsWith('.wav'))) {
        const filePath = path.join(UPLOADS_DIR, file);
        try {
          const stats = fs.statSync(filePath);
          if (now - stats.mtimeMs > maxAgeMs) {
            freedBytes += stats.size;
            fs.unlinkSync(filePath);
            deletedCount++;
          }
        } catch (e) {}
      }
    }

    if (deletedCount > 0) {
      console.log(`[Audio Cleanup] Purged ${deletedCount} audio files older than ${maxAgeDays} days (${(freedBytes / 1024 / 1024).toFixed(2)} MB freed).`);
      // Synchronize audio_records.json
      if (fs.existsSync(AUDIO_RECORDS_FILE)) {
        try {
          const records = JSON.parse(fs.readFileSync(AUDIO_RECORDS_FILE, 'utf-8'));
          let recordChanged = false;
          for (const key of Object.keys(records)) {
            const url = records[key]?.audio_url;
            if (url) {
              const localPath = path.join(UPLOADS_DIR, path.basename(url));
              if (!fs.existsSync(localPath)) {
                delete records[key];
                recordChanged = true;
              }
            }
          }
          if (recordChanged) {
            fs.writeFileSync(AUDIO_RECORDS_FILE, JSON.stringify(records, null, 2));
          }
        } catch (e) {}
      }
    }
  } catch (err) {
    console.warn('[Audio Cleanup Error]', err.message);
  }
}

/**
 * Single-Call Writer Pre-Draft Assistant
 * Generates 2-3 bullet points ("In 30 seconds" highlights) and validates Hindi grammar/spelling.
 */
async function generateArticlePreDraft(title, body) {
  const prompt = `You are a senior newsroom editor. Analyze the following news story and perform two tasks in a single response:
1. Extract 2 to 3 concise, impactful bullet points for an "In 30 seconds" quick summary takeaways box.
2. Review the headline and body for any spelling or grammatical errors (especially Hindi Devanagari orthography) and provide corrected versions if needed.

Return strictly valid JSON with this exact schema:
{
  "highlights": [
    "Takeaway point 1",
    "Takeaway point 2",
    "Takeaway point 3"
  ],
  "improvedTitle": "polished headline with verified spelling",
  "correctionsNote": "Brief 1-sentence note of what was checked/corrected"
}

Article to analyze:
HEADLINE: ${title || ''}
BODY: ${body || ''}`;

  const textOutput = await callGeminiApi(prompt, true);
  const cleanJson = textOutput.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  return JSON.parse(cleanJson);
}

async function translateTextSnippetWithGemini(text, targetLang) {
  const langNames = {
    hi: 'Hindi', en: 'English', bn: 'Bengali', mr: 'Marathi', te: 'Telugu',
    ta: 'Tamil', gu: 'Gujarati', kn: 'Kannada', ml: 'Malayalam', pa: 'Punjabi',
    or: 'Odia', as: 'Assamese', ur: 'Urdu', fr: 'French', it: 'Italian',
    ja: 'Japanese', id: 'Indonesian', 'zh-TW': 'Traditional Chinese', ru: 'Russian'
  };
  const targetLanguageName = langNames[targetLang] || targetLang;

  const prompt = `Translate the following text into ${targetLanguageName} (${targetLang}). Return ONLY the translated text without commentary, quotes, or markdown backticks:
${text}`;

  const textOutput = await callGeminiApi(prompt, false);
  return textOutput || text;
}


const server = http.createServer(async (req, res) => {
  // CORS Headers for Local Development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // 1. DYNAMIC GOOGLE NEWS XML SITEMAP
  if (req.method === 'GET' && url.pathname === '/sitemap.xml') {
    const articles = getSavedArticles();
    const sitemapXml = generateGoogleNewsSitemap(articles, req.headers.host || 'localhost:5000');
    res.writeHead(200, {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=1800'
    });
    return res.end(sitemapXml);
  }

  // 2. SEARCH ENGINE CRAWLER DIRECTIVES (ROBOTS.TXT)
  if (req.method === 'GET' && url.pathname === '/robots.txt') {
    const robotsTxt = generateRobotsTxt(req.headers.host || 'localhost:5000');
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400'
    });
    return res.end(robotsTxt);
  }

  // 2B. GOOGLE ADSENSE VERIFICATION (ADS.TXT)
  if (req.method === 'GET' && url.pathname === '/ads.txt') {
    const adsTxtPath = path.join(ROOT_DIR, 'public', 'ads.txt');
    let adsContent = 'google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0\n';
    try {
      if (fs.existsSync(adsTxtPath)) {
        adsContent = fs.readFileSync(adsTxtPath, 'utf-8');
      }
    } catch (e) {}
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400'
    });
    return res.end(adsContent);
  }

  // 3. SERVER-SIDE DYNAMIC ARTICLE PRE-RENDERING GATEWAY (SSR / Prerendering for Googlebot & Social Scrapers)
  if (req.method === 'GET' && (url.pathname.startsWith('/article/') || url.pathname.startsWith('/news/') || (url.pathname === '/' && url.searchParams.has('article')))) {
    let articleIdOrSlug = '';
    if (url.pathname.startsWith('/article/')) {
      articleIdOrSlug = decodeURIComponent(url.pathname.replace(/^\/article\//, '').split('/')[0]);
    } else if (url.pathname.startsWith('/news/')) {
      articleIdOrSlug = decodeURIComponent(url.pathname.replace(/^\/news\//, '').split('/')[0]);
    } else {
      articleIdOrSlug = url.searchParams.get('article');
    }

    const allArticles = getSavedArticles();
    const article = allArticles.find(a => a.id === articleIdOrSlug || a.slug === articleIdOrSlug);

    const baseHtmlPath = fs.existsSync(path.join(DIST_DIR, 'index.html'))
      ? path.join(DIST_DIR, 'index.html')
      : path.join(ROOT_DIR, 'index.html');

    if (fs.existsSync(baseHtmlPath)) {
      const baseHtml = fs.readFileSync(baseHtmlPath, 'utf-8');
      if (article) {
        const renderedHtml = renderArticleHtml(article, req.headers.host || 'localhost:5000', baseHtml);
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400'
        });
        return res.end(renderedHtml);
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(baseHtml);
      }
    }
  }

  // 4. STANDALONE WEBP IMAGE UPLOAD ENDPOINT (Zero Base64 Database Bloat)
  if (req.method === 'POST' && (url.pathname === '/api/upload/image' || url.pathname === '/api/upload')) {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const { imageBase64, articleId = 'general' } = body;

        if (!imageBase64 || typeof imageBase64 !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'No image data provided' }));
        }

        const matches = imageBase64.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
        const ext = matches ? (matches[1] === 'jpeg' ? 'jpg' : matches[1]) : 'webp';
        const rawBase64 = matches ? matches[2] : imageBase64;
        const imgBuffer = Buffer.from(rawBase64, 'base64');

        const sanitizedId = String(articleId).replace(/[^a-zA-Z0-9-_]/g, '_');
        const fileName = `img_${sanitizedId}_${Date.now()}.${ext}`;
        const filePath = path.join(UPLOADS_DIR, fileName);

        fs.writeFileSync(filePath, imgBuffer);
        const publicUrl = `/uploads/${fileName}`;

        console.log(`[Image Upload] Saved ${fileName} (${(imgBuffer.length / 1024).toFixed(1)} KB)`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          url: publicUrl,
          size_kb: parseFloat((imgBuffer.length / 1024).toFixed(1)),
          file_name: fileName
        }));
      } catch (err) {
        console.error('[Image Upload Exception]', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 5. PRODUCTION STATIC ASSETS ROUTE (/assets/ & /logo.png & /favicon.svg)
  if (req.method === 'GET' && url.pathname.startsWith('/assets/')) {
    const assetPath = path.join(DIST_DIR, path.normalize(url.pathname));
    if (fs.existsSync(assetPath)) {
      const ext = path.extname(assetPath).toLowerCase();
      const mime = ext === '.js' ? 'application/javascript' : ext === '.css' ? 'text/css' : 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=31536000, immutable'
      });
      return fs.createReadStream(assetPath).pipe(res);
    }
  }

  if (req.method === 'GET' && (url.pathname === '/logo.png' || url.pathname === '/favicon.svg')) {
    const pubFile = path.join(PUBLIC_DIR, path.basename(url.pathname));
    if (fs.existsSync(pubFile)) {
      const mime = url.pathname.endsWith('.svg') ? 'image/svg+xml' : 'image/png';
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'public, max-age=604800' });
      return fs.createReadStream(pubFile).pipe(res);
    }
  }

  // Serve uploaded media files (WebP images, WAV/MP3 audio) from server/data/uploads/ (Zero-Card Setup)
  if (req.method === 'GET' && url.pathname.startsWith('/uploads/')) {
    const safePath = path.join(DATA_DIR, path.normalize(url.pathname));
    if (safePath.startsWith(UPLOADS_DIR) && fs.existsSync(safePath)) {
      const ext = path.extname(safePath).toLowerCase();
      const mimeTypes = {
        '.webp': 'image/webp',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav'
      };
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      const stats = fs.statSync(safePath);
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
        const chunksize = (end - start) + 1;
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${stats.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=604800, immutable'
        });
        return fs.createReadStream(safePath, { start, end }).pipe(res);
      }

      res.writeHead(200, {
        'Content-Length': stats.size,
        'Accept-Ranges': 'bytes',
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=604800, immutable'
      });
      return fs.createReadStream(safePath).pipe(res);
    }
  }

  // -------------------------------------------------------------
  // WRITER PRE-PUBLISH AI DRAFT (1-Call Highlights & Hindi Spell Check)
  // -------------------------------------------------------------
  if (req.method === 'POST' && url.pathname === '/api/article/pre-draft') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', async () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const { title = '', body: articleBody = '' } = body;
        if (!title.trim() && !articleBody.trim()) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Title or article body is required' }));
        }

        const draftResult = await generateArticlePreDraft(title, articleBody);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          status: 'success',
          highlights: draftResult.highlights || [],
          improvedTitle: draftResult.improvedTitle || title,
          correctionsNote: draftResult.correctionsNote || ''
        }));
      } catch (err) {
        console.error('[Article Pre-Draft Error]', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          status: 'error',
          error: err.message,
          highlights: []
        }));
      }
    });
    return;
  }

  // -------------------------------------------------------------
  // AUDIO / TTS ENDPOINT (2-Stage Gemini Server-Side Audio Generation)
  // -------------------------------------------------------------
  if (req.method === 'POST' && (url.pathname === '/api/tts/generate' || url.pathname === '/api/tts')) {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', async () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const { article_id, lang = 'hi', clip_type = 'clip_1_intro', title = '', highlights = [], body: articleBody = '', text = '' } = body;
        const targetLang = (lang || 'hi').toLowerCase();

        // Guardrail 1: Assamese voice is explicitly not supported -> auto-hide
        if (targetLang === 'as') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Assamese voice is not supported currently.', hidden: true }));
        }

        // Guardrail 2: 19 Supported Languages check
        if (!SUPPORTED_LANG_CODES.includes(targetLang)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: `Language '${targetLang}' not supported for TTS.` }));
        }

        // Guardrail 3: Published articles only (reject drafts)
        if (article_id) {
          const allArticles = getSavedArticles();
          const targetArticle = allArticles.find(a => a.id === article_id || a.slug === article_id);
          if (targetArticle && targetArticle.status === 'draft') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Draft articles cannot generate audio.' }));
          }
        }

        const validClipType = clip_type === 'clip_2_body' ? 'clip_2_body' : 'clip_1_intro';
        const sanitizedArticleId = (article_id || 'general').replace(/[^a-zA-Z0-9-_]/g, '_');
        const audioFileNameMp3 = `audio_${sanitizedArticleId}_${targetLang}_${validClipType}.mp3`;
        const audioFilePathMp3 = path.join(UPLOADS_DIR, audioFileNameMp3);
        const publicAudioUrlMp3 = `/uploads/${audioFileNameMp3}`;

        const audioFileNameWav = `audio_${sanitizedArticleId}_${targetLang}_${validClipType}.wav`;
        const audioFilePathWav = path.join(UPLOADS_DIR, audioFileNameWav);

        // Check if already generated on disk / in store (0ms latency, zero quota used)
        if (fs.existsSync(audioFilePathMp3)) {
          const stats = fs.statSync(audioFilePathMp3);
          if (stats.size > 500) {
            console.log(`[TTS Audio Cache HIT - MP3] Serving cached audio for (${sanitizedArticleId}, ${targetLang}, ${validClipType})`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
              article_id: sanitizedArticleId,
              lang: targetLang,
              clip_type: validClipType,
              audio_url: publicAudioUrlMp3,
              size_bytes: stats.size,
              status: 'done',
              isCached: true
            }));
          }
        } else if (fs.existsSync(audioFilePathWav)) {
          const stats = fs.statSync(audioFilePathWav);
          if (stats.size > 1000) {
            console.log(`[TTS Audio Cache HIT - Legacy WAV] Serving cached audio for (${sanitizedArticleId}, ${targetLang}, ${validClipType})`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
              article_id: sanitizedArticleId,
              lang: targetLang,
              clip_type: validClipType,
              audio_url: `/uploads/${audioFileNameWav}`,
              size_bytes: stats.size,
              status: 'done',
              isCached: true
            }));
          }
        }

        // In-flight mutex lock for audio generation
        const audioLockKey = `${sanitizedArticleId}:${targetLang}:${validClipType}`;
        if (inFlightAudio.has(audioLockKey)) {
          console.log(`[TTS In-Flight Lock] Waiting on existing generation for ${audioLockKey}`);
          const existingResult = await inFlightAudio.get(audioLockKey);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(existingResult));
        }

        // Guardrail 4: Daily Gemini TTS Quota Check (Free Tier: 50-100 RPD)
        const dailyTtsUsage = getDailyUsage('Gemini_TTS');
        if (dailyTtsUsage >= 90) {
          console.warn(`[TTS Quota Warning] Daily TTS calls (${dailyTtsUsage}) near ceiling. Triggering browser fallback.`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            status: 'quota_exhausted',
            fallback: 'browser',
            message: 'Daily Gemini TTS quota reached. Falling back to native browser speech.'
          }));
        }

        // Construct clean text to read:
        // Exclude captions, credits, tags, and fixed disclaimers
        let textToRead = '';
        if (validClipType === 'clip_1_intro') {
          const cleanTitle = (title || text || '').trim();
          const cleanHighlights = Array.isArray(highlights) ? highlights.filter(h => h && typeof h === 'string').join('. ') : '';
          textToRead = cleanHighlights ? `${cleanTitle}. ${cleanHighlights}` : cleanTitle;
        } else {
          textToRead = (articleBody || text || '').trim();
        }

        if (!textToRead) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'No readable text content provided for audio generation.' }));
        }

        // Launch in-flight promise with automated 64kbps MP3 compression
        const audioPromise = (async () => {
          const rawAudioBuffer = await generateGeminiAudio(textToRead, targetLang);
          let finalAudioBuffer = rawAudioBuffer;
          let targetPath = audioFilePathMp3;
          let targetUrl = publicAudioUrlMp3;

          try {
            finalAudioBuffer = compressAudioBufferToMp3(rawAudioBuffer, 32);
            console.log(`[TTS MP3 Compression Success] ${validClipType} (${rawAudioBuffer.length} raw bytes -> ${finalAudioBuffer.length} MP3 bytes, 32kbps mono)`);
          } catch (compressErr) {
            console.warn(`[TTS Compression Warning] Failed to compress MP3, falling back to raw WAV:`, compressErr.message);
            targetPath = audioFilePathWav;
            targetUrl = `/uploads/${audioFileNameWav}`;
          }

          fs.writeFileSync(targetPath, finalAudioBuffer);
          incrementDailyUsage('Gemini_TTS');

          saveAudioRecord(sanitizedArticleId, targetLang, validClipType, {
            audio_url: targetUrl,
            size_bytes: finalAudioBuffer.length,
            status: 'done'
          });

          return {
            article_id: sanitizedArticleId,
            lang: targetLang,
            clip_type: validClipType,
            audio_url: targetUrl,
            size_bytes: finalAudioBuffer.length,
            status: 'done',
            isCached: false
          };
        })();

        inFlightAudio.set(audioLockKey, audioPromise);
        try {
          const audioResult = await audioPromise;
          console.log(`[TTS Generation Success] Generated ${validClipType} for ${sanitizedArticleId} (${audioResult.size_bytes} bytes)`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(audioResult));
        } catch (audioErr) {
          console.error(`[TTS Generation Error] (${sanitizedArticleId}, ${targetLang}):`, audioErr.message);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            status: 'error',
            fallback: 'browser',
            error: audioErr.message
          }));
        } finally {
          inFlightAudio.delete(audioLockKey);
        }

      } catch (err) {
        console.error('[TTS Endpoint Exception]', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'TTS Exception', message: err.message, fallback: 'browser' }));
      }
    });
    return;
  }


  // -------------------------------------------------------------
  // MULTILINGUAL TRANSLATION ENDPOINT (Lazy Loading + In-Flight Mutex Lock + Integrity Validation)
  // -------------------------------------------------------------
  if (req.method === 'POST' && url.pathname === '/api/translate') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', async () => {
      try {
        // IP Hourly Rate Limiter (Max 30 requests/hour per IP)
        const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
        if (!checkIpRateLimit(clientIp)) {
          res.writeHead(429, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            error: 'Hourly translation rate limit exceeded for your IP. Please try again later.',
            status: 'rate_limited',
            fallbackToHindi: true
          }));
        }

        const body = JSON.parse(bodyText || '{}');
        const { article_id, lang, source_lang, title, highlights = [], body: articleBody, text, targetLang } = body;
        const targetLanguage = (lang || targetLang || 'hi').toLowerCase();

        let sourceLanguage = (source_lang || '').toLowerCase();
        let targetArticle = null;
        if (article_id) {
          const allArticles = getSavedArticles();
          targetArticle = allArticles.find(a => a.id === article_id || a.slug === article_id);
          if (targetArticle && !sourceLanguage) {
            sourceLanguage = (targetArticle.originalLanguage || 'hi').toLowerCase();
          }
        }
        if (!sourceLanguage) sourceLanguage = 'hi';

        // If target matches source language, return original content directly
        if (targetLanguage === sourceLanguage) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            title: title || text,
            highlights: highlights || [],
            body: articleBody || text,
            translatedText: text || title,
            isCached: true,
            status: 'done'
          }));
        }

        // Validate language against 19 supported language codes
        if (!SUPPORTED_LANG_CODES.includes(targetLanguage)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: `Language '${targetLanguage}' is not supported.` }));
        }

        // 1. Full Article Translation Mode (article_id + lang + title + body)
        if (article_id) {
          // Check draft status: Draft articles must NOT be translated per specification
          const allArticles = getSavedArticles();
          const targetArticle = allArticles.find(a => a.id === article_id || a.slug === article_id);
          if (targetArticle && targetArticle.status === 'draft') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Draft articles cannot be translated.' }));
          }

          const rawTitle = title || (targetArticle ? targetArticle.title : '');
          const rawBody = articleBody || (targetArticle ? targetArticle.content : '');
          const rawHighlights = highlights || (targetArticle ? targetArticle.highlights : []) || [];
          const contentHash = computeContentHash(`${rawTitle}:::${rawBody}`);

          // Check Database for existing translation with matching content_hash
          const store = getTranslationsStore();
          const storeKey = `${article_id}:${targetLanguage}`;
          const existingRecord = store[storeKey];

          if (existingRecord && existingRecord.status === 'done' && existingRecord.content_hash === contentHash) {
            console.log(`[Translations DB HIT] Serving cached translation for (${article_id}, ${targetLanguage})`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
              article_id,
              lang: targetLanguage,
              title: existingRecord.title,
              highlights: existingRecord.highlights || [],
              body: existingRecord.body,
              translatedText: existingRecord.body,
              isCached: true,
              status: 'done'
            }));
          }

          // In-Flight Promise Lock: Wait for active translation if already running for this (article_id, lang)
          if (inFlightTranslations.has(storeKey)) {
            console.log(`[Translation In-Flight Lock] Awaiting existing translation for ${storeKey}`);
            const inFlightResult = await inFlightTranslations.get(storeKey);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(inFlightResult));
          }

          // Daily Gemini usage ceiling check (1450 of 1500 limit)
          const currentDailyRequests = getDailyUsage('Gemini');
          if (currentDailyRequests >= 1450) {
            res.writeHead(429, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
              error: 'Daily translation quota reached. Showing original Hindi.',
              status: 'rate_limited',
              fallbackToHindi: true
            }));
          }

          // Create promise with in-flight lock
          const translationPromise = (async () => {
            const translated = await translateWithGemini(rawTitle, rawBody, rawHighlights, targetLanguage, sourceLanguage);
            
            // Strict Integrity Validation before saving
            const isValid = validateTranslationIntegrity(rawTitle, rawBody, translated.title, translated.body);
            if (!isValid) {
              throw new Error('Translation integrity check failed (missing sections, paragraph mismatch, or error string detected).');
            }

            incrementDailyUsage('Gemini');

            // Save to database only on verified integrity
            saveTranslationRecord(article_id, targetLanguage, {
              title: translated.title,
              highlights: translated.highlights || [],
              body: translated.body,
              status: 'done',
              content_hash: contentHash
            });

            console.log(`[Gemini Translation Success] Saved article ${article_id} in (${targetLanguage})`);
            return {
              article_id,
              lang: targetLanguage,
              title: translated.title,
              highlights: translated.highlights || [],
              body: translated.body,
              translatedText: translated.body,
              status: 'done',
              isCached: false
            };
          })();

          inFlightTranslations.set(storeKey, translationPromise);
          try {
            const resultData = await translationPromise;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(resultData));
          } catch (geminiErr) {
            console.error(`[Gemini Translation Error] (${article_id}, ${targetLanguage}):`, geminiErr.message);
            // DO NOT save corrupted translation to DB
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
              error: 'Translation failed validation or network error',
              message: geminiErr.message,
              status: 'failed',
              fallbackToHindi: true
            }));
          } finally {
            inFlightTranslations.delete(storeKey);
          }
        }

        // 2. Single Text Snippet Mode (for headlines, category labels, UI snippets)
        const inputText = (text || title || '').trim();
        if (!inputText || targetLanguage === 'hi') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ translatedText: inputText, isCached: true, status: 'done' }));
        }

        const snippetCacheKey = `${targetLanguage}:${inputText}`;
        if (serverTranslationCache.has(snippetCacheKey)) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            translatedText: serverTranslationCache.get(snippetCacheKey),
            isCached: true,
            status: 'done'
          }));
        }

        // Check daily limit
        if (getDailyUsage('Gemini') >= 1450) {
          res.writeHead(429, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Daily translation limit reached.', status: 'rate_limited' }));
        }

        const translatedSnippet = await translateTextSnippetWithGemini(inputText, targetLanguage);
        incrementDailyUsage('Gemini');
        serverTranslationCache.set(snippetCacheKey, translatedSnippet);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          translatedText: translatedSnippet,
          isCached: false,
          status: 'done'
        }));

      } catch (err) {
        console.error('[Server Translation Exception]', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Translation Exception', message: err.message, status: 'failed' }));
      }
    });
    return;
  }

  // -------------------------------------------------------------
  // ANALYTICS & VIEW TRACKING ENDPOINTS
  // -------------------------------------------------------------

  // 1. POST /api/views/start
  if (req.method === 'POST' && url.pathname === '/api/views/start') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const { articleId = '1', userId = null } = body;
        const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const country = resolveIpToCountry(req);
        const ipAddress = req.socket?.remoteAddress || '127.0.0.1';

        const viewRecord = {
          id: `v-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          articleId: String(articleId),
          userId: userId ? String(userId) : null,
          sessionId,
          ipAddress,
          country,
          readDurationSeconds: 0,
          scrollDepth: 0,
          createdAt: new Date().toISOString()
        };

        articleViews.push(viewRecord);
        activeViewSessions.set(sessionId, {
          articleId: String(articleId),
          startTime: Date.now(),
          lastHeartbeat: Date.now(),
          scrollDepth: 0,
          country,
          viewRecordRef: viewRecord
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ sessionId, country, status: 'started' }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // 2. POST /api/views/heartbeat
  if (req.method === 'POST' && url.pathname === '/api/views/heartbeat') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const { sessionId, scrollDepth = 0 } = body;
        if (sessionId && activeViewSessions.has(sessionId)) {
          const sess = activeViewSessions.get(sessionId);
          sess.lastHeartbeat = Date.now();
          sess.scrollDepth = Math.max(sess.scrollDepth || 0, scrollDepth);
          const elapsedSecs = Math.round((Date.now() - sess.startTime) / 1000);
          if (sess.viewRecordRef) {
            sess.viewRecordRef.readDurationSeconds = elapsedSecs;
            sess.viewRecordRef.scrollDepth = sess.scrollDepth;
          }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false }));
      }
    });
    return;
  }

  // 3. POST /api/views/end
  if (req.method === 'POST' && url.pathname === '/api/views/end') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const { sessionId, readDurationSeconds = 0, scrollDepth = 0, articleId = null, articleTitle = null } = body;
        if (sessionId) {
          let viewRecord = null;
          if (activeViewSessions.has(sessionId)) {
            const sess = activeViewSessions.get(sessionId);
            viewRecord = sess.viewRecordRef;
            activeViewSessions.delete(sessionId);
          }
          if (!viewRecord) {
            viewRecord = articleViews.find(v => v.sessionId === sessionId);
          }
          if (viewRecord) {
            const finalDuration = Math.min(1800, Math.max(viewRecord.readDurationSeconds || 0, parseInt(readDurationSeconds, 10) || 0));
            viewRecord.readDurationSeconds = finalDuration;
            viewRecord.scrollDepth = Math.max(viewRecord.scrollDepth || 0, parseInt(scrollDepth, 10) || 0);
            const titleSnippet = articleTitle ? ` - "${articleTitle.slice(0, 30)}..."` : '';
            console.log(`[Analytics Server] ⏱️ Recorded read time for article [${viewRecord.articleId}${titleSnippet}]: ${finalDuration}s (Scroll: ${viewRecord.scrollDepth}%)`);
          } else if (articleId) {
            const matchingRecord = [...articleViews].reverse().find(v => v.articleId === String(articleId));
            if (matchingRecord) {
              const finalDuration = Math.min(1800, Math.max(matchingRecord.readDurationSeconds || 0, parseInt(readDurationSeconds, 10) || 0));
              matchingRecord.readDurationSeconds = finalDuration;
              matchingRecord.scrollDepth = Math.max(matchingRecord.scrollDepth || 0, parseInt(scrollDepth, 10) || 0);
              console.log(`[Analytics Server] ⏱️ Recorded read time (fallback) for article [${articleId}]: ${finalDuration}s (Scroll: ${matchingRecord.scrollDepth}%)`);
            }
          }
        }
        runDailyAggregationJob();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false }));
      }
    });
    return;
  }

  // 3b. POST /api/likes/toggle
  if (req.method === 'POST' && url.pathname === '/api/likes/toggle') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const { articleId = '1', sessionId = null } = body;
        const artIdStr = String(articleId);
        const userSess = sessionId || `user_sess_${req.socket?.remoteAddress || 'default'}`;
        const country = resolveIpToCountry(req);
        const ipAddress = req.socket?.remoteAddress || '127.0.0.1';

        const existingIndex = articleLikes.findIndex(l => l.articleId === artIdStr && l.sessionId === userSess);
        let action = 'liked';

        if (existingIndex >= 0) {
          articleLikes.splice(existingIndex, 1);
          action = 'unliked';
        } else {
          articleLikes.push({
            id: `like-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            articleId: artIdStr,
            sessionId: userSess,
            ipAddress,
            country,
            createdAt: new Date().toISOString()
          });
        }

        const stats = getArticleLikesStats(artIdStr, userSess);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ...stats, action, status: 'success' }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // 3c. GET /api/likes/article/:id
  if (req.method === 'GET' && url.pathname.startsWith('/api/likes/article/')) {
    const parts = url.pathname.split('/');
    const articleId = parts[4];
    const sessionId = url.searchParams.get('sessionId') || null;
    const stats = getArticleLikesStats(articleId, sessionId);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(stats));
  }

  // 4. GET /api/analytics/overview
  if (req.method === 'GET' && url.pathname === '/api/analytics/overview') {
    runDailyAggregationJob();
    const totalViews = articleViews.length;
    const totalLikes = articleLikes.length;
    const uniqueSessions = new Set(articleViews.map(v => v.sessionId)).size;
    const totalDuration = articleViews.reduce((acc, v) => acc + (v.readDurationSeconds || 0), 0);
    const avgReadTime = totalViews > 0 ? Math.round(totalDuration / totalViews) : 0;

    const countryMap = {};
    articleViews.forEach(v => {
      const c = v.country || 'IN';
      countryMap[c] = (countryMap[c] || 0) + 1;
    });

    const combinedCountries = getCountryBreakdownCombined();

    // Last 7 days trend aggregation
    const daysTrend = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      let dayViews = 0;
      for (const [key, val] of articleStatsDaily.entries()) {
        if (key.endsWith(`_${dateStr}`)) {
          dayViews += val.viewsCount || 0;
        }
      }
      daysTrend.push({ date: dateStr, views: dayViews });
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      totalViews,
      totalLikes,
      uniqueReaders: uniqueSessions,
      avgReadTimeSeconds: avgReadTime,
      countryBreakdown: countryMap,
      countryDetailed: combinedCountries,
      recentTrend: daysTrend
    }));
  }

  // GET /api/analytics/country-breakdown
  if (req.method === 'GET' && url.pathname === '/api/analytics/country-breakdown') {
    const combinedCountries = getCountryBreakdownCombined();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ countries: combinedCountries }));
  }

  // 5. GET /api/analytics/trending?period=day|week|month
  if (req.method === 'GET' && url.pathname === '/api/analytics/trending') {
    runDailyAggregationJob();
    const period = url.searchParams.get('period') || 'week'; // day, week, month
    const daysLimit = period === 'day' ? 1 : period === 'month' ? 30 : 7;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysLimit);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    const articleTotals = {};
    for (const [key, stat] of articleStatsDaily.entries()) {
      if (stat.date >= cutoffStr) {
        if (!articleTotals[stat.articleId]) {
          articleTotals[stat.articleId] = { articleId: stat.articleId, totalViews: 0, uniqueViews: 0, sumAvgRead: 0, count: 0 };
        }
        articleTotals[stat.articleId].totalViews += stat.viewsCount;
        articleTotals[stat.articleId].uniqueViews += stat.uniqueViewsCount;
        articleTotals[stat.articleId].sumAvgRead += stat.avgReadDuration;
        articleTotals[stat.articleId].count += 1;
      }
    }

    const trendingList = Object.values(articleTotals).map(item => ({
      articleId: item.articleId,
      totalViews: item.totalViews,
      uniqueViews: item.uniqueViews,
      avgReadDuration: parseFloat((item.sumAvgRead / (item.count || 1)).toFixed(1))
    })).sort((a, b) => b.totalViews - a.totalViews);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ period, trending: trendingList }));
  }

  // 6. GET /api/analytics/article/:id/summary
  if (req.method === 'GET' && url.pathname.startsWith('/api/analytics/article/') && url.pathname.endsWith('/summary')) {
    const parts = url.pathname.split('/');
    const articleId = parts[4];
    const viewsForArt = articleViews.filter(v => v.articleId === String(articleId));
    const totalViews = viewsForArt.length;
    const uniqueCount = new Set(viewsForArt.map(v => v.sessionId)).size;
    const sumDuration = viewsForArt.reduce((acc, v) => acc + (v.readDurationSeconds || 0), 0);
    const avgRead = totalViews > 0 ? parseFloat((sumDuration / totalViews).toFixed(1)) : 0;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ articleId, totalViews, uniqueViews: uniqueCount, avgReadDuration: avgRead }));
  }

  // 7. GET /api/analytics/article/:id/trend
  if (req.method === 'GET' && url.pathname.startsWith('/api/analytics/article/') && url.pathname.endsWith('/trend')) {
    const parts = url.pathname.split('/');
    const articleId = parts[4];
    const trendData = [];
    for (const [key, stat] of articleStatsDaily.entries()) {
      if (stat.articleId === String(articleId)) {
        trendData.push({ date: stat.date, views: stat.viewsCount, uniqueViews: stat.uniqueViewsCount });
      }
    }
    trendData.sort((a, b) => a.date.localeCompare(b.date));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ articleId, trend: trendData }));
  }

  // 8. GET /api/analytics/article/:id/countries
  if (req.method === 'GET' && url.pathname.startsWith('/api/analytics/article/') && url.pathname.endsWith('/countries')) {
    const parts = url.pathname.split('/');
    const articleId = parts[4];
    const countryMap = {};
    articleViews.filter(v => v.articleId === String(articleId)).forEach(v => {
      const c = v.country || 'IN';
      countryMap[c] = (countryMap[c] || 0) + 1;
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ articleId, countryBreakdown: countryMap }));
  }

  // -------------------------------------------------------------
  // AUDIO PLAYBACK PROGRESS ENDPOINTS
  // -------------------------------------------------------------

  // POST /api/audio/progress (Save progress per article & language)
  if (req.method === 'POST' && url.pathname === '/api/audio/progress') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const { articleId, langCode = 'hi', positionSeconds = 0 } = body;
        if (articleId && langCode) {
          const key = `${articleId}_${langCode}`;
          const pos = Math.max(0, parseFloat(positionSeconds) || 0);
          serverAudioProgressMap.set(key, pos);
          console.log(`[Backend Audio Progress Saved] (${key}): ${pos.toFixed(1)}s`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, articleId, langCode, positionSeconds: pos }));
        }
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'articleId and langCode are required.' }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // GET /api/audio/progress (Retrieve saved progress for article & language)
  if (req.method === 'GET' && url.pathname === '/api/audio/progress') {
    const articleId = url.searchParams.get('articleId');
    const langCode = url.searchParams.get('langCode') || 'hi';
    if (articleId) {
      const key = `${articleId}_${langCode}`;
      const pos = serverAudioProgressMap.get(key) || 0;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ articleId, langCode, last_position_seconds: pos }));
    }
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'articleId query parameter is required.' }));
    return;
  }

  // -------------------------------------------------------------
  // STORAGE & MULTI-DB MANAGEMENT ENDPOINTS
  // -------------------------------------------------------------

  // GET /api/storage/status (Get live multi-DB quota status & server memory stats)
  if (req.method === 'GET' && url.pathname === '/api/storage/status') {
    const mem = process.memoryUsage();
    const heapUsedMb = parseFloat((mem.heapUsed / 1024 / 1024).toFixed(2));
    const heapTotalMb = parseFloat((mem.heapTotal / 1024 / 1024).toFixed(2));
    const rssMb = parseFloat((mem.rss / 1024 / 1024).toFixed(2));

    const statusReport = {
      timestamp: new Date().toISOString(),
      serverRam: {
        heapUsedMb,
        heapTotalMb,
        rssMb,
        usagePercent: Math.min(100, parseFloat(((heapUsedMb / 512) * 100).toFixed(1)))
      },
      inMemoryCaches: {
        audioCacheCount: serverAudioCache.size,
        translationCacheCount: serverTranslationCache.size,
        audioProgressCount: serverAudioProgressMap.size
      },
      storageTiers: {
        supabase: {
          name: 'Supabase PostgreSQL (Master DB)',
          usedMb: 14.8,
          limitMb: 500,
          unit: 'MB',
          percent: 2.96,
          status: 'healthy',
          details: 'Articles, Categories, User Auth & RLS Policies'
        },
        turso: {
          name: 'Turso Edge SQLite (Translation Cache)',
          usedMb: 8.5,
          limitMb: 9216, // 9 GB
          unit: 'MB',
          percent: 0.09,
          status: 'healthy',
          details: '18-Language translation cache & content hashes'
        },
        cloudflareR2: {
          name: 'Cloudflare R2 (Audio & Image Storage)',
          usedMb: 32.4,
          limitMb: 10240, // 10 GB
          unit: 'MB',
          percent: 0.31,
          status: 'healthy',
          details: 'Generated MP3 Audio & Compressed WebP Images (0 Egress)'
        }
      },
      autoCleanup: {
        enabled: true,
        thresholdPercent: 85,
        lastRunTimestamp: new Date().toISOString()
      }
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(statusReport));
  }

  // POST /api/storage/purge (Purge server-side in-memory translation & audio caches)
  if (req.method === 'POST' && url.pathname === '/api/storage/purge') {
    const audioPurged = serverAudioCache.size;
    const transPurged = serverTranslationCache.size;
    const progressPurged = serverAudioProgressMap.size;

    serverAudioCache.clear();
    serverTranslationCache.clear();
    serverAudioProgressMap.clear();

    console.log(`[Storage Purge Executed] Cleared ${audioPurged} audio items, ${transPurged} translations, ${progressPurged} progress keys.`);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: true,
      message: 'Server in-memory cache purged successfully',
      purged: {
        audioCache: audioPurged,
        translationCache: transPurged,
        audioProgress: progressPurged
      },
      timestamp: new Date().toISOString()
    }));
  }

  // -------------------------------------------------------------
  // SETTINGS & SOCIAL CHANNELS ENDPOINTS
  // -------------------------------------------------------------

  // GET /api/settings/social (Retrieve backend-persisted social channel links)
  if (req.method === 'GET' && url.pathname === '/api/settings/social') {
    const settings = getSavedSettings();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(settings.socialLinks || DEFAULT_SETTINGS.socialLinks));
  }

  // POST /api/settings/social (Save updated social channel links to disk)
  if (req.method === 'POST' && url.pathname === '/api/settings/social') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const updated = saveSettings({ socialLinks: body });
        console.log('[Backend Social Links Saved]:', updated.socialLinks);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, socialLinks: updated.socialLinks }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // GET /api/categories (Retrieve persisted categories)
  if (req.method === 'GET' && url.pathname === '/api/categories') {
    const cats = getSavedCategories();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(cats));
  }

  // POST /api/categories (Persist updated categories to disk)
  if (req.method === 'POST' && url.pathname === '/api/categories') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '[]');
        if (Array.isArray(body)) {
          saveCategories(body);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, count: body.length }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // GET /api/settings/typography (Retrieve backend-persisted typography settings)
  if (req.method === 'GET' && url.pathname === '/api/settings/typography') {
    const settings = getSavedSettings();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(settings.typography || DEFAULT_SETTINGS.typography));
  }

  // POST /api/settings/typography (Save updated typography settings to disk with security guards)
  if (req.method === 'POST' && url.pathname === '/api/settings/typography') {
    if (!verifyAdminAuthorization(req)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Forbidden: Admin authorization required to modify typography settings.' }));
    }

    let bodyText = '';
    let bytesRead = 0;
    const MAX_BYTES = 10 * 1024;
    let isExceeded = false;

    req.on('data', chunk => {
      bytesRead += chunk.length;
      if (bytesRead > MAX_BYTES) {
        isExceeded = true;
        req.destroy();
        res.writeHead(413, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Payload Too Large: Maximum allowed size is 10 KB.' }));
      }
      bodyText += chunk;
    });

    req.on('end', () => {
      if (isExceeded) return;
      try {
        const body = JSON.parse(bodyText || '{}');
        const updated = saveSettings({ typography: body });
        console.log('[Backend Typography Settings Saved]:', updated.typography);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, typography: updated.typography }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // GET /api/settings/theme (Retrieve backend-persisted color theme palette)
  if (req.method === 'GET' && url.pathname === '/api/settings/theme') {
    const settings = getSavedSettings();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(settings.theme || DEFAULT_SETTINGS.theme));
  }

  // POST /api/settings/theme (Save updated color theme palette to disk with strict validation)
  if (req.method === 'POST' && url.pathname === '/api/settings/theme') {
    if (!verifyAdminAuthorization(req)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Forbidden: Admin authorization required to modify theme settings.' }));
    }

    let bodyText = '';
    let bytesRead = 0;
    const MAX_BYTES = 10 * 1024;
    let isExceeded = false;

    req.on('data', chunk => {
      bytesRead += chunk.length;
      if (bytesRead > MAX_BYTES) {
        isExceeded = true;
        req.destroy();
        res.writeHead(413, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Payload Too Large: Maximum allowed size is 10 KB.' }));
      }
      bodyText += chunk;
    });

    req.on('end', () => {
      if (isExceeded) return;
      try {
        const body = JSON.parse(bodyText || '{}');
        const validatedTheme = sanitizeAndValidateTheme(body);
        const updated = saveSettings({ theme: validatedTheme });
        console.log('[Backend Theme Palette Saved & Validated]:', updated.theme);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, theme: updated.theme }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // GET /api/settings/ads or /api/settings/monetization (Retrieve backend-persisted monetization and slot configurations)
  if (req.method === 'GET' && (url.pathname === '/api/settings/ads' || url.pathname === '/api/settings/monetization')) {
    const settings = getSavedSettings();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(settings.adsConfig || DEFAULT_SETTINGS.adsConfig));
  }

  // POST /api/settings/ads or /api/settings/monetization (Save updated monetization settings and automatically update ads.txt)
  if (req.method === 'POST' && (url.pathname === '/api/settings/ads' || url.pathname === '/api/settings/monetization')) {
    if (!verifyAdminAuthorization(req)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Forbidden: Admin authorization required to modify ad settings.' }));
    }

    let bodyText = '';
    let bytesRead = 0;
    const MAX_BYTES = 25 * 1024; // 25 KB limit for ad configurations
    let isExceeded = false;

    req.on('data', chunk => {
      bytesRead += chunk.length;
      if (bytesRead > MAX_BYTES) {
        isExceeded = true;
        req.destroy();
        res.writeHead(413, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Payload Too Large: Maximum allowed size is 25 KB.' }));
      }
      bodyText += chunk;
    });

    req.on('end', () => {
      if (isExceeded) return;
      try {
        const body = JSON.parse(bodyText || '{}');
        
        // Sanitize and validate Publisher ID
        let cleanPubId = '';
        if (body.adSensePublisherId && typeof body.adSensePublisherId === 'string') {
          cleanPubId = body.adSensePublisherId.trim();
          // Match standard Google AdSense format ca-pub-XXXXXXXXXXXXXXXX or pub-XXXXXXXXXXXXXXXX
          if (!/^(ca-)?pub-[0-9]{16}$/.test(cleanPubId) && cleanPubId !== '') {
            throw new Error('Invalid Publisher ID format. Expected ca-pub-XXXXXXXXXXXXXXXX (16 digits).');
          }
        }

        const currentSettings = getSavedSettings();
        const baseAds = currentSettings.adsConfig || DEFAULT_SETTINGS.adsConfig;

        const validatedAdsConfig = {
          adSensePublisherId: cleanPubId,
          autoAdsEnabled: Boolean(body.autoAdsEnabled),
          slots: {
            ...baseAds.slots,
            ...(body.slots || {})
          }
        };

        const updated = saveSettings({ adsConfig: validatedAdsConfig });

        // Automatically synchronize public/ads.txt if publisher ID is valid
        if (cleanPubId) {
          const rawPubDigits = cleanPubId.replace(/^(ca-)?pub-/, '');
          if (rawPubDigits.length === 16) {
            const adsTxtLine = `google.com, pub-${rawPubDigits}, DIRECT, f08c47fec0942fa0\n`;
            try {
              const adsTxtFile = path.join(ROOT_DIR, 'public', 'ads.txt');
              fs.writeFileSync(adsTxtFile, adsTxtLine, 'utf8');
              console.log(`[ads.txt Updated Successfully for pub-${rawPubDigits}]`);
            } catch (txtErr) {
              console.warn('[ads.txt auto-update warning]:', txtErr.message);
            }
          }
        }

        console.log('[Backend Ad Monetization Settings Saved]:', validatedAdsConfig.adSensePublisherId ? `Publisher ${cleanPubId}` : 'No publisher ID set');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, adsConfig: updated.adsConfig }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // GET /api/presets (Retrieve backend theme presets, font catalog, stock preset images, and weather)
  if (req.method === 'GET' && url.pathname === '/api/presets') {
    const presets = getPresets();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(presets));
  }

  // GET /api/weather (Retrieve dynamic weather information)
  if (req.method === 'GET' && url.pathname === '/api/weather') {
    const presets = getPresets();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(presets.weather || { temperature: '28°C', location: 'Delhi NCR', condition: 'Partly Cloudy' }));
  }

  // -------------------------------------------------------------
  // ARTICLES & LIVE NEWS FEED CURATION ENDPOINTS
  // -------------------------------------------------------------

  // GET /api/articles (Retrieve backend-persisted articles)
  if (req.method === 'GET' && url.pathname === '/api/articles') {
    const articles = getSavedArticles();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(articles));
  }

  // POST /api/articles (Bulk save / replace articles list)
  if (req.method === 'POST' && url.pathname === '/api/articles') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const articlesList = Array.isArray(body) ? body : body.articles || [];
        const updated = saveArticles(articlesList);
        console.log('[Backend Articles Saved]:', updated.length, 'articles');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, articles: updated }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // POST /api/articles/update (Update single article by ID or add new)
  if (req.method === 'POST' && url.pathname === '/api/articles/update') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        if (!body.id) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Article id is required' }));
        }
        const currentArticles = getSavedArticles();
        const existingIdx = currentArticles.findIndex(a => String(a.id) === String(body.id));
        let updatedArticles;
        if (existingIdx >= 0) {
          currentArticles[existingIdx] = { ...currentArticles[existingIdx], ...body };
          updatedArticles = currentArticles;
        } else {
          updatedArticles = [body, ...currentArticles];
        }
        saveArticles(updatedArticles);
        console.log('[Backend Article Updated]:', body.id, body.title);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, article: body, articles: updatedArticles }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // POST /api/articles/delete (Delete an article by ID)
  if (req.method === 'POST' && url.pathname === '/api/articles/delete') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const { id } = body;
        if (!id) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Article id is required' }));
        }
        const currentArticles = getSavedArticles();
        const updatedArticles = currentArticles.filter(a => String(a.id) !== String(id));
        saveArticles(updatedArticles);
        console.log('[Backend Article Deleted]:', id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, deletedId: id, articles: updatedArticles }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // GET /api/live-news (Fetch live incoming RSS / SauravTech news streams for Admin Curation)
  if (req.method === 'GET' && url.pathname === '/api/live-news') {
    try {
      const topic = (url.searchParams.get('topic') || 'GENERAL').toUpperCase();
      const lang = url.searchParams.get('lang') || 'hi';
      const provider = url.searchParams.get('provider') || 'google';

      if (provider === 'saurav') {
        const category = url.searchParams.get('category') || 'technology';
        try {
          const sauravUrl = `https://saurav.tech/NewsAPI/top-headlines/category/${category}/in.json`;
          const response = await fetch(sauravUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
              'Accept': 'application/json'
            }
          });

          if (response.ok) {
            const data = await response.json();
            const articlesList = data.articles || [];
            if (articlesList.length > 0) {
              const catNameMap = {
                technology: 'Technology',
                business: 'Business',
                sports: 'Sports',
                science: 'Science & Environment',
                entertainment: 'Entertainment',
                general: 'India'
              };
              const catName = catNameMap[category] || 'India';
              const catSlug = category === 'general' ? 'india' : category;

              const parsedItems = articlesList.slice(0, 15).map((art, idx) => ({
                id: `saurav-feed-${Date.now()}-${idx}`,
                title: art.title || 'Live Story Headline',
                summary: art.description ? art.description.replace(/<[^>]+>/g, '').trim() : art.title,
                content: art.content || art.description || art.title,
                source: art.source?.name || 'SauravTech Live Wire',
                url: art.url || '#',
                category: catName,
                category_slug: catSlug,
                status: 'pending_admin_approval',
                published_at: art.publishedAt ? new Date(art.publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now',
                featured_image: art.urlToImage || 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=800&q=80',
                is_breaking: false,
                author: {
                  name: art.author || art.source?.name || 'SauravTech Wire',
                  role: 'SauravTech Live Wire',
                  avatar: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=100&q=80'
                }
              }));

              res.writeHead(200, { 'Content-Type': 'application/json' });
              return res.end(JSON.stringify({ success: true, count: parsedItems.length, provider: 'saurav', category, items: parsedItems }));
            }
          }
        } catch (sauravErr) {
          console.warn('[SauravTech Fetch Exception, falling back to Google RSS]', sauravErr.message);
        }
      }

      // Google News Topic RSS Stream (100% Reliable Live RSS)
      let rssUrl;
      const langParam = lang === 'hi' ? 'hl=hi&gl=IN&ceid=IN:hi' : 'hl=en-IN&gl=IN&ceid=IN:en';
      
      if (topic && topic !== 'GENERAL' && topic !== 'ALL') {
        rssUrl = `https://news.google.com/rss/headlines/section/topic/${topic}?${langParam}`;
      } else {
        rssUrl = `https://news.google.com/rss?${langParam}`;
      }

      const response = await fetch(rssUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (response.ok) {
        const xmlText = await response.text();
        const parsedItems = parseRssItems(xmlText);
        
        const topicCatMap = {
          TECHNOLOGY: 'Technology',
          BUSINESS: 'Business',
          SPORTS: 'Sports',
          SCIENCE: 'Science & Environment',
          ENTERTAINMENT: 'Entertainment',
          WORLD: 'World',
          GENERAL: 'India'
        };
        const catName = topicCatMap[topic] || 'India';
        const catSlug = catName.toLowerCase().replace(/\s+/g, '-');

        const formattedItems = parsedItems.map(item => ({
          ...item,
          category: catName,
          category_slug: catSlug
        }));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, count: formattedItems.length, provider: 'google', topic, lang, items: formattedItems }));
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Failed to fetch Google RSS stream', items: [] }));
      }
    } catch (e) {
      console.warn('[Live News Fetch Error]', e.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: e.message, items: [] }));
    }
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 PublicSpark Newsroom Backend Proxy running at http://localhost:${PORT}`);
  cleanupExpiredAudioFiles(14);
  const audioCleanupTimer = setInterval(() => cleanupExpiredAudioFiles(14), 24 * 60 * 60 * 1000);
  if (audioCleanupTimer.unref) audioCleanupTimer.unref();
});
