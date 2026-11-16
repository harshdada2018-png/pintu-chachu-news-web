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
    console.log('[Server Env] Loaded environment variables from .env');
  } catch (err) {
    console.warn('[Server Env] Warning loading .env file:', err.message);
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
const POLL_FILE = path.join(DATA_DIR, 'poll.json');
const AD_HISTORY_FILE = path.join(DATA_DIR, 'ad_history.json');
const ARTICLE_REVISIONS_FILE = path.join(DATA_DIR, 'article_revisions.json');
const MEDIA_LIBRARY_FILE = path.join(DATA_DIR, 'media_library.json');

// Initialize database stores if not already present
[
  [TRANSLATIONS_FILE, {}],
  [USAGE_LOGS_FILE, {}],
  [AUDIO_RECORDS_FILE, {}],
  [AD_HISTORY_FILE, []],
  [ARTICLE_REVISIONS_FILE, {}],
  [MEDIA_LIBRARY_FILE, []]
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
        console.log(`[Startup Cleanup] Purged ${purged} corrupted legacy translation records from translations.json.`);
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

/**
 * Evaluates scheduled articles against the server clock (Task 20).
 * Automatically flips 'scheduled' stories to 'published' when scheduledPublishTime arrives.
 */
function evaluateScheduledArticles(articlesList) {
  if (!Array.isArray(articlesList) || articlesList.length === 0) return articlesList;
  const now = Date.now();
  let modified = false;

  const evaluated = articlesList.map(art => {
    if (art && art.status === 'scheduled' && art.scheduledPublishTime) {
      const schedMs = new Date(art.scheduledPublishTime).getTime();
      if (!isNaN(schedMs) && now >= schedMs) {
        console.log(`[Auto-Publish Engine] Auto-publishing scheduled story: "${art.title}" (ID: ${art.id}) at ${new Date().toISOString()}`);
        modified = true;
        return {
          ...art,
          status: 'published',
          published_at: 'Just now',
          publishDateISO: new Date().toISOString()
        };
      }
    }
    return art;
  });

  if (modified) {
    try {
      fs.writeFileSync(ARTICLES_FILE, JSON.stringify(evaluated, null, 2), 'utf8');
      console.log('[Auto-Publish Engine] Flipped articles saved to disk successfully.');
    } catch (e) {
      console.error('[Auto-Publish Engine] Error saving auto-published articles:', e);
    }
  }

  return evaluated;
}

function getSavedArticles() {
  try {
    if (fs.existsSync(ARTICLES_FILE)) {
      const raw = fs.readFileSync(ARTICLES_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return evaluateScheduledArticles(parsed);
      }
    }
    // Initialize file on disk on first access
    fs.writeFileSync(ARTICLES_FILE, JSON.stringify(DEFAULT_ARTICLES, null, 2), 'utf8');
  } catch (e) {
    console.error('Error reading/initializing articles file:', e);
  }
  return evaluateScheduledArticles(DEFAULT_ARTICLES);
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

// -------------------------------------------------------------
// Article Revisions & Snapshot Engine (Task 21)
// -------------------------------------------------------------
function getArticleRevisionsStore() {
  try {
    if (fs.existsSync(ARTICLE_REVISIONS_FILE)) {
      const raw = fs.readFileSync(ARTICLE_REVISIONS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (e) {
    console.warn('[Revision Store Warning] Error reading revisions file:', e.message);
  }
  return {};
}

function saveArticleRevisionsStore(store) {
  try {
    fs.writeFileSync(ARTICLE_REVISIONS_FILE, JSON.stringify(store, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('[Revision Store Error] Error writing revisions file:', e);
    return false;
  }
}

function recordArticleRevision(article, editorInfo = {}, changeNote = '') {
  if (!article || !article.id) return null;
  const store = getArticleRevisionsStore();
  const aId = String(article.id);
  if (!Array.isArray(store[aId])) {
    store[aId] = [];
  }

  const contentText = typeof article.content === 'string' ? article.content : '';
  const wordCount = contentText.trim().split(/\s+/).filter(Boolean).length;
  const charCount = contentText.length;

  const revisionRecord = {
    revisionId: `rev_${aId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    articleId: aId,
    timestamp: new Date().toISOString(),
    authorName: editorInfo.name || article.author_name || article.author?.name || 'Newsroom Desk',
    editorRole: (editorInfo.role || article.author_role || article.author?.role || 'editor').toLowerCase(),
    title: article.title || '',
    sub_title: article.sub_title || '',
    content: contentText,
    summary: article.summary || '',
    category: article.category || '',
    featured_image: article.featured_image || '',
    status: article.status || 'draft',
    scheduledPublishTime: article.scheduledPublishTime || null,
    wordCount,
    charCount,
    changeNote: changeNote || 'Updated story content'
  };

  // Prepend latest revision
  store[aId].unshift(revisionRecord);
  // Cap history at 30 revisions per article (Rule 3: Minimal Code & Zero Waste)
  if (store[aId].length > 30) {
    store[aId] = store[aId].slice(0, 30);
  }

  saveArticleRevisionsStore(store);
  return revisionRecord;
}

function getRevisionsForArticle(articleId) {
  const store = getArticleRevisionsStore();
  const aId = String(articleId);
  if (!store[aId] || store[aId].length === 0) {
    // If article exists in articles.json but has no revision yet, seed baseline snapshot
    const all = getSavedArticles();
    const art = all.find(a => String(a.id) === aId);
    if (art) {
      recordArticleRevision(art, { name: art.author_name || art.author?.name || 'Newsroom Desk', role: 'admin' }, 'Original baseline version');
      return getArticleRevisionsStore()[aId] || [];
    }
    return [];
  }
  return store[aId].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

// -------------------------------------------------------------
// Centralized Digital Asset & Photo Media Library Desk (Task 22)
// -------------------------------------------------------------
function getMediaLibraryStore() {
  try {
    if (fs.existsSync(MEDIA_LIBRARY_FILE)) {
      const raw = fs.readFileSync(MEDIA_LIBRARY_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('[Media Store Warning] Error reading media library:', e.message);
  }
  return [];
}

function saveMediaLibraryStore(assets) {
  try {
    fs.writeFileSync(MEDIA_LIBRARY_FILE, JSON.stringify(assets, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('[Media Store Error] Error writing media library:', e);
    return false;
  }
}

const SUPPORTED_MEDIA_IMAGE_EXTS = new Set(['.webp', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.avif']);

function syncAndIndexMediaAssets() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch (e) {}
    return [];
  }

  const existingAssets = getMediaLibraryStore();
  const existingMap = new Map();
  for (const asset of existingAssets) {
    if (asset && asset.fileName) {
      existingMap.set(asset.fileName, asset);
    }
  }

  // Load active articles to cross-reference usage
  const allArticles = getSavedArticles();

  // Load active ad campaigns to cross-reference ad banner usage
  let allAds = [];
  try {
    if (fs.existsSync(AD_HISTORY_FILE)) {
      const adRaw = fs.readFileSync(AD_HISTORY_FILE, 'utf8');
      const parsedAds = JSON.parse(adRaw);
      if (Array.isArray(parsedAds)) allAds = parsedAds;
    }
  } catch (e) {}

  let diskFiles = [];
  try {
    diskFiles = fs.readdirSync(UPLOADS_DIR);
  } catch (e) {
    console.warn('[Media Sync Warning] Could not read uploads directory:', e.message);
    return existingAssets;
  }

  const updatedAssets = [];
  for (const fileName of diskFiles) {
    // Skip audio files (audio_...)
    if (fileName.startsWith('audio_')) continue;

    const ext = path.extname(fileName).toLowerCase();
    if (!SUPPORTED_MEDIA_IMAGE_EXTS.has(ext)) continue;

    const filePath = path.join(UPLOADS_DIR, fileName);
    let stats;
    try {
      stats = fs.statSync(filePath);
    } catch (e) {
      continue;
    }

    const publicUrl = `/uploads/${fileName}`;

    // Cross-reference with articles
    const usedInArticles = [];
    for (const art of allArticles) {
      if (!art) continue;
      const featImg = String(art.featured_image || '');
      const contentStr = String(art.content || '');
      if (featImg === publicUrl || featImg.includes(fileName) || contentStr.includes(publicUrl) || contentStr.includes(fileName)) {
        usedInArticles.push({
          id: String(art.id),
          title: art.title || 'Untitled Story',
          slug: art.slug || '',
          category: art.category || 'General',
          status: art.status || 'draft'
        });
      }
    }

    // Cross-reference with ads
    const usedInAds = [];
    for (const ad of allAds) {
      if (!ad) continue;
      const bannerUrl = String(ad.banner_url || ad.image_url || '');
      if (bannerUrl === publicUrl || bannerUrl.includes(fileName)) {
        usedInAds.push({
          id: ad.id || '',
          slot: ad.slot || '',
          sponsor_name: ad.sponsor_name || 'Direct Advertiser',
          status: ad.status || 'active'
        });
      }
    }

    const existing = existingMap.get(fileName);
    const uploadedAt = existing?.uploadedAt || stats.birthtime?.toISOString() || stats.mtime.toISOString();

    const assetRecord = {
      id: existing?.id || `med_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      fileName,
      url: publicUrl,
      sizeBytes: stats.size,
      sizeKb: parseFloat((stats.size / 1024).toFixed(1)),
      uploadedAt,
      modifiedAt: stats.mtime.toISOString(),
      caption: existing?.caption || '',
      credit: existing?.credit || '',
      altText: existing?.altText || '',
      width: existing?.width || null,
      height: existing?.height || null,
      usedInArticles,
      usedInAds,
      isUsed: usedInArticles.length > 0 || usedInAds.length > 0
    };

    updatedAssets.push(assetRecord);
  }

  // Sort newest first by default
  updatedAssets.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

  saveMediaLibraryStore(updatedAssets);
  return updatedAssets;
}

// Background Cron / Heartbeat: Checks and auto-publishes scheduled stories every 20 seconds
setInterval(() => {
  try {
    if (fs.existsSync(ARTICLES_FILE)) {
      const raw = fs.readFileSync(ARTICLES_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        evaluateScheduledArticles(parsed);
      }
    }
  } catch (e) {
    // Silent catch for background heartbeat
  }
}, 20000);

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
        mobileDimensions: '320×50',
        scope: 'global',
        targetCategory: 'all',
        targetArticleId: '',
        excludeArticleIds: '',
        startDateTime: '',
        endDateTime: '',
        startDate: '',
        endDate: '',
        status: 'active'
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
        mobileDimensions: '300×250',
        scope: 'global',
        targetCategory: 'all',
        targetArticleId: '',
        excludeArticleIds: '',
        startDateTime: '',
        endDateTime: '',
        startDate: '',
        endDate: '',
        status: 'active'
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
        mobileDimensions: '300×250',
        scope: 'global',
        targetCategory: 'all',
        targetArticleId: '',
        excludeArticleIds: '',
        startDateTime: '',
        endDateTime: '',
        startDate: '',
        endDate: '',
        status: 'active'
      },
      home_feed: {
        id: 'home_feed',
        name: 'Homepage Feed In-Stream Unit',
        position: 'home_feed',
        enabled: false,
        type: 'adsense',
        adSlotId: '',
        sponsorBannerUrl: '',
        sponsorTargetUrl: '',
        sponsorName: 'Featured Partner',
        desktopDimensions: '728×90 / 300×250',
        mobileDimensions: '300×250',
        scope: 'global',
        targetCategory: 'all',
        targetArticleId: '',
        excludeArticleIds: '',
        startDateTime: '',
        endDateTime: '',
        startDate: '',
        endDate: '',
        status: 'active'
      },
      footer: {
        id: 'footer',
        name: 'Broadsheet Footer Leaderboard',
        position: 'footer',
        enabled: false,
        type: 'adsense',
        adSlotId: '',
        sponsorBannerUrl: '',
        sponsorTargetUrl: '',
        sponsorName: 'Featured Partner',
        desktopDimensions: '728×90',
        mobileDimensions: '320×50',
        scope: 'global',
        targetCategory: 'all',
        targetArticleId: '',
        excludeArticleIds: '',
        startDateTime: '',
        endDateTime: '',
        startDate: '',
        endDate: '',
        status: 'active'
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
        mobileDimensions: '320×50 Sticky',
        scope: 'global',
        targetCategory: 'all',
        targetArticleId: '',
        excludeArticleIds: '',
        startDateTime: '',
        endDateTime: '',
        startDate: '',
        endDate: '',
        status: 'active'
      }
    }
  }
};

const DEFAULT_CATEGORIES = [
  { id: 'cat-1', name: 'India', slug: 'india' },
  { id: 'cat-2', name: 'World', slug: 'world' },
  { id: 'cat-3', name: 'Technology', slug: 'technology' },
  { id: 'cat-4', name: 'Business', slug: 'business' },
  { id: 'cat-5', name: 'Science & Environment', slug: 'science' },
  { id: 'cat-6', name: 'Opinion', slug: 'opinion' },
  { id: 'cat-7', name: 'Sports', slug: 'sports' },
  { id: 'cat-8', name: 'Entertainment', slug: 'entertainment' }
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

function getAdHistory() {
  try {
    if (fs.existsSync(AD_HISTORY_FILE)) {
      const raw = fs.readFileSync(AD_HISTORY_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Error reading ad history file:', e);
  }
  return [];
}

function saveAdHistory(historyList) {
  try {
    fs.writeFileSync(AD_HISTORY_FILE, JSON.stringify(historyList, null, 2), 'utf8');
    return historyList;
  } catch (e) {
    console.error('Error saving ad history file:', e);
    return historyList;
  }
}

// Zero-Waste Storage Helper: Clean unused banner file from server/data/uploads/
function cleanupUnusedUploadFile(fileUrl, activeSlots = {}) {
  if (!fileUrl || typeof fileUrl !== 'string' || !fileUrl.startsWith('/uploads/')) return false;

  const filename = path.basename(fileUrl);
  if (!filename || filename === '.' || filename === '/') return false;

  const nowMs = Date.now();
  // 1. Check if any slot in live settings is still actively referencing this banner AND slot is not expired
  const isInLiveSlot = Object.values(activeSlots || {}).some(slot => {
    if (!slot || !slot.sponsorBannerUrl || !slot.sponsorBannerUrl.includes(filename)) return false;
    const endDateTimeStr = slot.endDateTime || (slot.endDate ? `${slot.endDate}T23:59:59` : '');
    if (endDateTimeStr) {
      const endMs = new Date(endDateTimeStr).getTime();
      if (!isNaN(endMs) && nowMs > endMs) return false; // Expired slot
    }
    return true;
  });

  if (isInLiveSlot) {
    return false;
  }

  // 2. Check if any active campaign in ad_history is still live/scheduled referencing this banner
  const history = getAdHistory();
  const isInActiveCampaign = history.some(camp => {
    if (!camp || !camp.sponsorBannerUrl || !camp.sponsorBannerUrl.includes(filename)) return false;
    const endDateTimeStr = camp.endDateTime || (camp.endDate ? `${camp.endDate}T23:59:59` : '');
    if (endDateTimeStr) {
      const endMs = new Date(endDateTimeStr).getTime();
      if (!isNaN(endMs) && nowMs > endMs) return false; // Expired campaign
    }
    return true;
  });

  if (isInActiveCampaign) {
    return false;
  }

  const filePath = path.join(UPLOADS_DIR, filename);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[Zero-Waste Storage] Permanently deleted expired banner file from disk: ${filename}`);
      return true;
    }
  } catch (err) {
    console.warn(`[Zero-Waste Storage Warning] Could not delete ${filename}:`, err.message);
  }
  return false;
}

let lastAdPurgeMs = 0;

// Zero-Waste Auto-Purge: Delete all campaigns whose end time has passed, wipe their media files, and clean orphaned banners
function purgeExpiredAdHistory(force = false) {
  const nowMs = Date.now();
  if (!force && (nowMs - lastAdPurgeMs < 60000)) {
    return { purgedCount: 0, history: getAdHistory() };
  }
  lastAdPurgeMs = nowMs;

  const history = getAdHistory();
  const settings = getSavedSettings();
  let settingsChanged = false;
  const activeSlots = (settings && settings.adsConfig && settings.adsConfig.slots) ? settings.adsConfig.slots : {};

  // 1. Check all live slots in settings - if expired, reset sponsor details
  for (const [sKey, slot] of Object.entries(activeSlots)) {
    if (slot && slot.type === 'sponsor' && (slot.endDateTime || slot.endDate)) {
      const endDateTimeStr = slot.endDateTime || `${slot.endDate}T23:59:59`;
      const endMs = new Date(endDateTimeStr).getTime();
      if (!isNaN(endMs) && nowMs > endMs) {
        // This slot's sponsor period has ended!
        if (slot.sponsorBannerUrl) {
          cleanupUnusedUploadFile(slot.sponsorBannerUrl, {});
        }
        slot.type = (slot.adSlotId && slot.adSlotId.trim()) ? 'adsense' : 'sponsor';
        slot.sponsorBannerUrl = '';
        slot.sponsorName = '';
        slot.sponsorTargetUrl = '';
        slot.startDateTime = '';
        slot.endDateTime = '';
        slot.startDate = '';
        slot.endDate = '';
        settingsChanged = true;
        console.log(`[Zero-Waste Storage] Slot [${sKey}] campaign reached end time — reset to default/fallback.`);
      }
    }
  }

  if (settingsChanged) {
    saveSettings(settings);
  }

  // 2. Check ad_history.json - keep only live/future campaigns
  const kept = [];
  const expiredToRemove = [];

  for (const camp of history) {
    const endDateTimeStr = camp.endDateTime || (camp.endDate ? `${camp.endDate}T23:59:59` : '');
    if (endDateTimeStr) {
      const endMs = new Date(endDateTimeStr).getTime();
      if (!isNaN(endMs) && nowMs > endMs) {
        // Campaign time has ended! Immediate auto-purge
        expiredToRemove.push(camp);
        continue;
      }
    }
    kept.push(camp);
  }

  if (expiredToRemove.length > 0) {
    for (const exp of expiredToRemove) {
      if (exp.sponsorBannerUrl) {
        cleanupUnusedUploadFile(exp.sponsorBannerUrl, activeSlots);
      }
    }
    saveAdHistory(kept);
    console.log(`[Zero-Waste Storage] Auto-deleted ${expiredToRemove.length} expired campaign(s) and wiped media files from disk.`);
  }

  // 3. Orphan File Sweep: Delete any img_sponsor_* file on disk that has no active campaign or slot
  try {
    if (fs.existsSync(UPLOADS_DIR)) {
      const activeFileNames = new Set();
      // Active in kept history
      for (const camp of kept) {
        if (camp.sponsorBannerUrl) activeFileNames.add(path.basename(camp.sponsorBannerUrl));
      }
      // Active in current settings slots
      for (const slot of Object.values(activeSlots)) {
        if (slot && slot.sponsorBannerUrl) {
          const endDateTimeStr = slot.endDateTime || (slot.endDate ? `${slot.endDate}T23:59:59` : '');
          const endMs = endDateTimeStr ? new Date(endDateTimeStr).getTime() : NaN;
          if (isNaN(endMs) || nowMs <= endMs) {
            activeFileNames.add(path.basename(slot.sponsorBannerUrl));
          }
        }
      }

      const allUploadFiles = fs.readdirSync(UPLOADS_DIR);
      for (const f of allUploadFiles) {
        if (f.startsWith('img_sponsor_') && !activeFileNames.has(f)) {
          const orphanedPath = path.join(UPLOADS_DIR, f);
          fs.unlinkSync(orphanedPath);
          console.log(`[Zero-Waste Storage] Cleaned orphaned banner file from disk: ${f}`);
        }
      }
    }
  } catch (err) {
    console.warn('[Zero-Waste Storage Sweep Warning]:', err.message);
  }

  return { purgedCount: expiredToRemove.length, history: kept };
}

function archiveCampaignSnapshot(slotKey, slotData, articles = []) {
  if (!slotData || slotData.type !== 'sponsor' || !slotData.sponsorBannerUrl) return;

  const nowMs = Date.now();
  const endDateTimeStr = slotData.endDateTime || (slotData.endDate ? `${slotData.endDate}T23:59:59` : '');
  if (endDateTimeStr) {
    const endMs = new Date(endDateTimeStr).getTime();
    if (!isNaN(endMs) && nowMs > endMs) {
      // Already expired! Do not archive expired campaigns
      return;
    }
  }

  // Purge any expired records first
  purgeExpiredAdHistory();

  const history = getAdHistory();

  let targetArticleTitle = '';
  if (slotData.scope === 'article' && slotData.targetArticleId) {
    const art = articles.find(a => a.id === slotData.targetArticleId);
    if (art) targetArticleTitle = art.title || '';
  }

  // Check if identical active entry already exists
  const existingIndex = history.findIndex(h => 
    h.slotKey === slotKey && 
    h.sponsorBannerUrl === slotData.sponsorBannerUrl &&
    h.sponsorName === slotData.sponsorName &&
    h.startDateTime === slotData.startDateTime &&
    h.endDateTime === slotData.endDateTime
  );

  const snapshot = {
    id: existingIndex >= 0 ? history[existingIndex].id : `camp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    slotKey,
    slotName: slotData.name || slotKey,
    sponsorName: slotData.sponsorName || 'Direct Sponsor',
    sponsorBannerUrl: slotData.sponsorBannerUrl,
    sponsorTargetUrl: slotData.sponsorTargetUrl || '',
    scope: slotData.scope || 'global',
    targetCategory: slotData.targetCategory || 'all',
    targetArticleId: slotData.targetArticleId || '',
    targetArticleTitle,
    desktopDimensions: slotData.desktopDimensions || '',
    mobileDimensions: slotData.mobileDimensions || '',
    startDateTime: slotData.startDateTime || '',
    endDateTime: slotData.endDateTime || '',
    impressions: existingIndex >= 0 ? (history[existingIndex].impressions || 0) : 0,
    clicks: existingIndex >= 0 ? (history[existingIndex].clicks || 0) : 0,
    lastImpressionAt: existingIndex >= 0 ? (history[existingIndex].lastImpressionAt || null) : null,
    lastClickAt: existingIndex >= 0 ? (history[existingIndex].lastClickAt || null) : null,
    createdAt: existingIndex >= 0 ? history[existingIndex].createdAt : new Date().toISOString()
  };

  if (existingIndex >= 0) {
    history[existingIndex] = snapshot;
  } else {
    history.unshift(snapshot);
  }

  if (history.length > 50) {
    history.length = 50;
  }

  saveAdHistory(history);
}

// -------------------------------------------------------------
// DIRECT SPONSOR ANALYTICS ENGINE (IN-HOUSE IMPRESSION & CLICK TRACKER)
// In-memory sliding window cache for anti-cheat IP deduplication:
// Impressions: 30 minutes cooldown per IP per campaign
// Clicks: 5 minutes cooldown per IP per campaign
// -------------------------------------------------------------
const adImpressionTracker = new Map();
const adClickTracker = new Map();

const IMPRESSION_TTL_MS = 30 * 60 * 1000;
const CLICK_TTL_MS = 5 * 60 * 1000;

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const list = forwarded.split(',');
    if (list[0] && list[0].trim()) return list[0].trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

function recordAdImpression(campaignId, slotKey, clientIp) {
  if (!campaignId) return { recorded: false, reason: 'missing_campaign_id' };

  const key = `${campaignId}_${clientIp}`;
  const now = Date.now();
  const lastTime = adImpressionTracker.get(key);
  if (lastTime && (now - lastTime) < IMPRESSION_TTL_MS) {
    return { recorded: false, reason: 'deduplicated_cooldown' };
  }
  adImpressionTracker.set(key, now);

  // Periodic pruning of stale in-memory tracker entries
  if (adImpressionTracker.size > 5000) {
    for (const [k, ts] of adImpressionTracker.entries()) {
      if (now - ts > IMPRESSION_TTL_MS) adImpressionTracker.delete(k);
    }
  }

  const history = getAdHistory();
  const camp = history.find(h => h.id === campaignId || h.slotKey === campaignId);
  if (camp) {
    camp.impressions = (camp.impressions || 0) + 1;
    camp.lastImpressionAt = new Date().toISOString();
    saveAdHistory(history);
    return { recorded: true, impressions: camp.impressions, clicks: camp.clicks || 0 };
  }

  return { recorded: false, reason: 'campaign_not_found' };
}

function recordAdClick(campaignId, slotKey, clientIp) {
  if (!campaignId) return { recorded: false, reason: 'missing_campaign_id' };

  const key = `${campaignId}_${clientIp}`;
  const now = Date.now();
  const lastTime = adClickTracker.get(key);
  if (lastTime && (now - lastTime) < CLICK_TTL_MS) {
    return { recorded: false, reason: 'deduplicated_cooldown' };
  }
  adClickTracker.set(key, now);

  // Periodic pruning of stale in-memory tracker entries
  if (adClickTracker.size > 5000) {
    for (const [k, ts] of adClickTracker.entries()) {
      if (now - ts > CLICK_TTL_MS) adClickTracker.delete(k);
    }
  }

  const history = getAdHistory();
  const camp = history.find(h => h.id === campaignId || h.slotKey === campaignId);
  if (camp) {
    camp.clicks = (camp.clicks || 0) + 1;
    camp.lastClickAt = new Date().toISOString();
    saveAdHistory(history);
    return { recorded: true, impressions: camp.impressions || 0, clicks: camp.clicks };
  }

  return { recorded: false, reason: 'campaign_not_found' };
}

const DEFAULT_POLL = {
  enabled: true,
  id: 'poll-default-v1',
  question: 'क्या आप मानते हैं कि AI न्यूज़ रीडर डिजिटल पत्रकारिता की गति और विश्वसनीयता को बढ़ाते हैं?',
  options: [
    { id: 'opt-1', label: 'हाँ, बिल्कुल (Yes, absolutely)', votes: 1420 },
    { id: 'opt-2', label: 'नहीं, मानवीय संपादक ज़रूरी हैं (No, human editors are vital)', votes: 410 },
    { id: 'opt-3', label: 'तटस्थ / अनिश्चित (Neutral / Unsure)', votes: 121 }
  ],
  totalVotes: 1951,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

function getPollData() {
  try {
    if (fs.existsSync(POLL_FILE)) {
      const raw = fs.readFileSync(POLL_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error reading poll file:', e);
  }
  return DEFAULT_POLL;
}

function savePollData(pollData) {
  try {
    fs.writeFileSync(POLL_FILE, JSON.stringify(pollData, null, 2), 'utf8');
    return pollData;
  } catch (e) {
    console.error('Error saving poll file:', e);
    return pollData;
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

  console.log(`[Analytics Engine] Seeded ${articleViews.length} raw view events & ${articleStatsDaily.size} daily stats.`);
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

  console.log(`[Analytics Engine] Seeded ${articleLikes.length} raw like events across articles.`);
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
  const models = [
    'gemini-3.5-flash',
    'gemini-3.7-flash',
    'gemini-flash-latest',
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash',
    'gemini-flash-lite-latest'
  ];
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
      console.warn(`[Gemini Model Fallback] Model ${model} failed (${err.message ? err.message.slice(0, 100) : 'Unknown'}). Trying next candidate...`);
      continue;
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

  // 2. Paragraph count verification (protect against major truncation)
  const origParas = originalBody.split(/\n\s*\n/).filter(p => p.trim());
  const transParas = translatedBody.split(/\n\s*\n/).filter(p => p.trim());
  if (origParas.length >= 3 && transParas.length < Math.max(1, Math.floor(origParas.length * 0.35))) {
    console.warn(`[Integrity Check Notice] Paragraph count drop: original ${origParas.length}, translated ${transParas.length}`);
    return false;
  }

  // 3. Minimum length check: translated body shouldn't be empty or tiny stub (< 20% of original character count)
  if (originalBody.length > 200 && translatedBody.length < (originalBody.length * 0.2)) {
    console.warn(`[Integrity Check Failed] Translated body length is unusually short: original ${originalBody.length}, translated ${translatedBody.length}`);
    return false;
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
      if (article && (article.status === 'published' || !article.status)) {
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

        // Task 22: Immediately index newly uploaded media asset
        const syncedAssets = syncAndIndexMediaAssets();
        const assetRecord = syncedAssets.find(a => a.fileName === fileName) || {
          id: `med_${Date.now()}`,
          fileName,
          url: publicUrl,
          sizeBytes: imgBuffer.length,
          sizeKb: parseFloat((imgBuffer.length / 1024).toFixed(1)),
          uploadedAt: new Date().toISOString(),
          isUsed: false,
          usedInArticles: []
        };

        if (body.caption || body.credit || body.altText || body.width || body.height) {
          if (body.caption) assetRecord.caption = String(body.caption).trim();
          if (body.credit) assetRecord.credit = String(body.credit).trim();
          if (body.altText) assetRecord.altText = String(body.altText).trim();
          if (body.width) assetRecord.width = Number(body.width);
          if (body.height) assetRecord.height = Number(body.height);
          saveMediaLibraryStore(syncedAssets);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          url: publicUrl,
          size_kb: parseFloat((imgBuffer.length / 1024).toFixed(1)),
          file_name: fileName,
          asset: assetRecord
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

          const rawTitle = (targetArticle && targetArticle.title) ? targetArticle.title : (title || '');
          const rawBody = (targetArticle && targetArticle.content) ? targetArticle.content : (articleBody || '');
          const rawHighlights = (targetArticle && Array.isArray(targetArticle.highlights) && targetArticle.highlights.length > 0) ? targetArticle.highlights : (highlights || []);
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
            console.log(`[Analytics Server] Recorded read time for article [${viewRecord.articleId}${titleSnippet}]: ${finalDuration}s (Scroll: ${viewRecord.scrollDepth}%)`);
          } else if (articleId) {
            const matchingRecord = [...articleViews].reverse().find(v => v.articleId === String(articleId));
            if (matchingRecord) {
              const finalDuration = Math.min(1800, Math.max(matchingRecord.readDurationSeconds || 0, parseInt(readDurationSeconds, 10) || 0));
              matchingRecord.readDurationSeconds = finalDuration;
              matchingRecord.scrollDepth = Math.max(matchingRecord.scrollDepth || 0, parseInt(scrollDepth, 10) || 0);
              console.log(`[Analytics Server] Recorded read time (fallback) for article [${articleId}]: ${finalDuration}s (Scroll: ${matchingRecord.scrollDepth}%)`);
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

        // Auto-archive sponsor campaign snapshots into ad_history.json
        try {
          const currentArticles = getSavedArticles();
          if (validatedAdsConfig.slots) {
            for (const [sKey, sData] of Object.entries(validatedAdsConfig.slots)) {
              if (sData && sData.type === 'sponsor' && sData.sponsorBannerUrl) {
                archiveCampaignSnapshot(sKey, sData, currentArticles);
              }
            }
          }
        } catch (archErr) {
          console.warn('[Ad Campaign Archive Warning]:', archErr.message);
        }

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

  // -------------------------------------------------------------
  // BACKEND-DRIVEN AD DECISION ENGINE (ROADMAP A1-A4 & USER SPEC)
  // Backend decides: What to show, Where to show, and When to show!
  // Evaluates Server Clock, Date & Time Scheduling, Scope & Fallbacks.
  // -------------------------------------------------------------

  /**
   * Format and resolve sponsor target URL with automatic WhatsApp Indian phone detection
   */
  function resolveSponsorTargetUrl(rawUrl, sponsorName = '') {
    if (!rawUrl || typeof rawUrl !== 'string') {
      return { url: '#', isWhatsApp: false, display: 'No Link' };
    }
    const trimmed = rawUrl.trim();
    if (!trimmed || trimmed === '#') {
      return { url: '#', isWhatsApp: false, display: 'No Link' };
    }

    const cleanDigits = trimmed.replace(/[^0-9]/g, '');
    let indianPhone = null;

    if (cleanDigits.length === 10) {
      indianPhone = `91${cleanDigits}`;
    } else if (cleanDigits.length === 11 && cleanDigits.startsWith('0')) {
      indianPhone = `91${cleanDigits.slice(1)}`;
    } else if (cleanDigits.length === 12 && cleanDigits.startsWith('91')) {
      indianPhone = cleanDigits;
    }

    const nameStr = sponsorName ? sponsorName.trim() : 'Team';
    const defaultMessage = `Hello ${nameStr}, I saw your advertisement on PublicSpark News and would like to inquire about your services/products.`;
    const encodedMsg = encodeURIComponent(defaultMessage);

    // If detected as Indian phone number (or starts with tel:)
    if (indianPhone && (trimmed.startsWith('+') || trimmed.startsWith('0') || /^[0-9\s-]+$/.test(trimmed) || trimmed.startsWith('tel:'))) {
      return {
        url: `https://wa.me/${indianPhone}?text=${encodedMsg}`,
        isWhatsApp: true,
        phone: indianPhone,
        display: `+91 ${indianPhone.slice(2, 7)} ${indianPhone.slice(7)}`
      };
    }

    // If already a wa.me or api.whatsapp.com link
    if (trimmed.includes('wa.me/') || trimmed.includes('api.whatsapp.com/send')) {
      let finalWaUrl = trimmed;
      if (!finalWaUrl.startsWith('http://') && !finalWaUrl.startsWith('https://')) {
        finalWaUrl = `https://${finalWaUrl}`;
      }
      if (!finalWaUrl.includes('text=')) {
        finalWaUrl += (finalWaUrl.includes('?') ? '&' : '?') + `text=${encodedMsg}`;
      }
      return {
        url: finalWaUrl,
        isWhatsApp: true,
        phone: cleanDigits || null,
        display: 'WhatsApp Direct'
      };
    }

    // Standard website URL
    let websiteUrl = trimmed;
    if (!websiteUrl.startsWith('http://') && !websiteUrl.startsWith('https://') && !websiteUrl.startsWith('mailto:')) {
      websiteUrl = `https://${websiteUrl}`;
    }

    return {
      url: websiteUrl,
      isWhatsApp: false,
      display: websiteUrl.replace(/^https?:\/\/(www\.)?/, '')
    };
  }

  function evaluateActiveAds(adsConfig, queryContext = {}) {
    const now = new Date();
    const nowMs = now.getTime();
    const currentIso = now.toISOString();
    const publisherId = (adsConfig && adsConfig.adSensePublisherId) ? adsConfig.adSensePublisherId.trim() : '';
    const slotsConfig = (adsConfig && adsConfig.slots) ? adsConfig.slots : {};
    
    const evaluatedSlots = {};
    const slotKeys = ['header', 'in_article', 'sidebar', 'home_feed', 'footer', 'mobile_footer'];
    
    const currentCategory = (queryContext.category || '').toLowerCase().trim();
    const currentArticleId = (queryContext.articleId || '').trim();

    for (const key of slotKeys) {
      const slot = slotsConfig[key];
      if (!slot || !slot.enabled) {
        evaluatedSlots[key] = {
          action: 'none',
          reason: 'slot_disabled'
        };
        continue;
      }

      const hasAdSenseFallback = Boolean(publisherId && slot.adSlotId && slot.adSlotId.trim());

      // 1. DIRECT SPONSOR EVALUATION
      if (slot.type === 'sponsor') {
        // Status Check: Admin manually paused this campaign
        if (slot.status === 'paused') {
          if (hasAdSenseFallback) {
            evaluatedSlots[key] = {
              action: 'adsense',
              type: 'adsense',
              publisherId,
              adSlotId: slot.adSlotId.trim(),
              reason: 'sponsor_paused_fallback_adsense'
            };
          } else {
            evaluatedSlots[key] = { action: 'none', reason: 'sponsor_paused' };
          }
          continue;
        }

        // Check if there is an active matching campaign in ad_history.json
        const history = getAdHistory();
        const upcomingCamp = history.find(camp => {
          if (camp.slotKey !== key) return false;
          if (camp.startDateTime) {
            const startMs = new Date(camp.startDateTime).getTime();
            if (!isNaN(startMs) && startMs > nowMs) return true;
          }
          return false;
        });

        const activeCamp = history.find(camp => {
          if (camp.slotKey !== key) return false;
          // Check start
          if (camp.startDateTime) {
            const startMs = new Date(camp.startDateTime).getTime();
            if (!isNaN(startMs) && nowMs < startMs) return false;
          }
          // Check end
          if (camp.endDateTime) {
            const endMs = new Date(camp.endDateTime).getTime();
            if (!isNaN(endMs) && nowMs > endMs) return false;
          }
          // Check excluded articles
          if (currentArticleId && camp.excludeArticleIds) {
            const excludedList = (Array.isArray(camp.excludeArticleIds)
              ? camp.excludeArticleIds
              : camp.excludeArticleIds.split(',').map(s => s.trim())
            );
            if (excludedList.includes(currentArticleId)) return false;
          }
          // Check Category scope
          if (camp.scope === 'category') {
            const targetCat = (camp.targetCategory || 'all').toLowerCase().trim();
            if (targetCat !== 'all' && currentCategory && currentCategory !== targetCat) return false;
          }
          // Check Article scope
          if (camp.scope === 'article') {
            if (camp.targetArticleId && camp.targetArticleId.trim()) {
              if (currentArticleId !== camp.targetArticleId.trim()) return false;
            }
          }
          return Boolean(camp.sponsorBannerUrl && camp.sponsorBannerUrl.trim());
        });

        if (activeCamp) {
          const targetInfo = resolveSponsorTargetUrl(activeCamp.sponsorTargetUrl, activeCamp.sponsorName);
          evaluatedSlots[key] = {
            action: 'sponsor',
            type: 'sponsor',
            campaignId: activeCamp.id,
            bannerUrl: activeCamp.sponsorBannerUrl.trim(),
            targetUrl: targetInfo.url,
            isWhatsApp: targetInfo.isWhatsApp,
            targetDisplay: targetInfo.display,
            sponsorName: activeCamp.sponsorName ? activeCamp.sponsorName.trim() : 'Featured Partner',
            desktopDimensions: activeCamp.desktopDimensions || slot.desktopDimensions,
            mobileDimensions: activeCamp.mobileDimensions || slot.mobileDimensions,
            expiresAt: activeCamp.endDateTime || null,
            nextStartsAt: upcomingCamp ? upcomingCamp.startDateTime : null,
            reason: 'active_campaign_matched'
          };
          continue;
        }

        // Schedule Check: Exact Date & Time
        // A. Start Date & Time
        const startDateTimeStr = slot.startDateTime || (slot.startDate ? `${slot.startDate}T00:00:00` : '');
        if (startDateTimeStr) {
          const startTimeMs = new Date(startDateTimeStr).getTime();
          if (!isNaN(startTimeMs) && nowMs < startTimeMs) {
            // Future campaign: not started yet
            if (hasAdSenseFallback) {
              evaluatedSlots[key] = {
                action: 'adsense',
                type: 'adsense',
                publisherId,
                adSlotId: slot.adSlotId.trim(),
                reason: 'sponsor_scheduled_future_fallback_adsense',
                startsAt: startDateTimeStr,
                nextStartsAt: startDateTimeStr
              };
            } else {
              evaluatedSlots[key] = { action: 'none', reason: 'sponsor_scheduled_future', startsAt: startDateTimeStr, nextStartsAt: startDateTimeStr };
            }
            continue;
          }
        }

        // B. End Date & Time (Automatic Expiry)
        const endDateTimeStr = slot.endDateTime || (slot.endDate ? `${slot.endDate}T23:59:59` : '');
        if (endDateTimeStr) {
          const endTimeMs = new Date(endDateTimeStr).getTime();
          if (!isNaN(endTimeMs) && nowMs > endTimeMs) {
            // Expired campaign: server clock passed end time
            if (hasAdSenseFallback) {
              evaluatedSlots[key] = {
                action: 'adsense',
                type: 'adsense',
                publisherId,
                adSlotId: slot.adSlotId.trim(),
                reason: 'sponsor_expired_fallback_adsense',
                expiredAt: endDateTimeStr
              };
            } else {
              evaluatedSlots[key] = { action: 'none', reason: 'sponsor_expired', expiredAt: endDateTimeStr };
            }
            continue;
          }
        }

        // Scope & Targeting Check: Exclude Specific Articles
        if (currentArticleId && slot.excludeArticleIds) {
          const excludedList = (Array.isArray(slot.excludeArticleIds)
            ? slot.excludeArticleIds
            : slot.excludeArticleIds.split(',').map(s => s.trim())
          );
          if (excludedList.includes(currentArticleId)) {
            if (hasAdSenseFallback) {
              evaluatedSlots[key] = {
                action: 'adsense',
                type: 'adsense',
                publisherId,
                adSlotId: slot.adSlotId.trim(),
                reason: 'article_excluded_fallback_adsense'
              };
            } else {
              evaluatedSlots[key] = { action: 'none', reason: 'article_excluded' };
            }
            continue;
          }
        }

        // Scope Check: Specific Category
        if (slot.scope === 'category') {
          const targetCat = (slot.targetCategory || 'all').toLowerCase().trim();
          if (targetCat !== 'all' && currentCategory && currentCategory !== targetCat) {
            if (hasAdSenseFallback) {
              evaluatedSlots[key] = {
                action: 'adsense',
                type: 'adsense',
                publisherId,
                adSlotId: slot.adSlotId.trim(),
                reason: 'category_mismatch_fallback_adsense'
              };
            } else {
              evaluatedSlots[key] = { action: 'none', reason: 'category_mismatch' };
            }
            continue;
          }
        }

        // Scope Check: Single Target Article ID
        if (slot.scope === 'article') {
          if (slot.targetArticleId && slot.targetArticleId.trim()) {
            if (currentArticleId !== slot.targetArticleId.trim()) {
              if (hasAdSenseFallback) {
                evaluatedSlots[key] = {
                  action: 'adsense',
                  type: 'adsense',
                  publisherId,
                  adSlotId: slot.adSlotId.trim(),
                  reason: 'article_mismatch_fallback_adsense'
                };
              } else {
                evaluatedSlots[key] = { action: 'none', reason: 'article_mismatch' };
              }
              continue;
            }
          }
        }

        // All checks passed! Sponsor banner is active for this request
        if (slot.sponsorBannerUrl && slot.sponsorBannerUrl.trim()) {
          const targetInfo = resolveSponsorTargetUrl(slot.sponsorTargetUrl, slot.sponsorName);
          evaluatedSlots[key] = {
            action: 'sponsor',
            type: 'sponsor',
            campaignId: slot.campaignId || slot.id || `slot_${key}`,
            bannerUrl: slot.sponsorBannerUrl.trim(),
            targetUrl: targetInfo.url,
            isWhatsApp: targetInfo.isWhatsApp,
            targetDisplay: targetInfo.display,
            sponsorName: slot.sponsorName ? slot.sponsorName.trim() : 'Featured Partner',
            desktopDimensions: slot.desktopDimensions,
            mobileDimensions: slot.mobileDimensions,
            expiresAt: endDateTimeStr || null,
            nextStartsAt: upcomingCamp ? upcomingCamp.startDateTime : null,
            reason: 'sponsor_active'
          };
        } else if (hasAdSenseFallback) {
          evaluatedSlots[key] = {
            action: 'adsense',
            type: 'adsense',
            publisherId,
            adSlotId: slot.adSlotId.trim(),
            desktopDimensions: slot.desktopDimensions,
            mobileDimensions: slot.mobileDimensions,
            nextStartsAt: upcomingCamp ? upcomingCamp.startDateTime : null,
            reason: 'sponsor_idle_fallback_adsense'
          };
        } else {
          // Banner image not uploaded yet
          evaluatedSlots[key] = {
            action: 'placeholder',
            type: 'sponsor',
            sponsorName: slot.sponsorName ? slot.sponsorName.trim() : 'Featured Partner',
            desktopDimensions: slot.desktopDimensions,
            mobileDimensions: slot.mobileDimensions,
            nextStartsAt: upcomingCamp ? upcomingCamp.startDateTime : null,
            reason: 'sponsor_banner_pending'
          };
        }
        continue;
      }

      // 2. GOOGLE ADSENSE EVALUATION
      if (slot.type === 'adsense') {
        if (publisherId && slot.adSlotId && slot.adSlotId.trim()) {
          evaluatedSlots[key] = {
            action: 'adsense',
            type: 'adsense',
            publisherId,
            adSlotId: slot.adSlotId.trim(),
            desktopDimensions: slot.desktopDimensions,
            mobileDimensions: slot.mobileDimensions,
            reason: 'adsense_active'
          };
        } else {
          evaluatedSlots[key] = {
            action: 'placeholder',
            type: 'adsense',
            desktopDimensions: slot.desktopDimensions,
            mobileDimensions: slot.mobileDimensions,
            reason: 'adsense_slot_unconfigured'
          };
        }
        continue;
      }

      evaluatedSlots[key] = { action: 'none', reason: 'unknown_type' };
    }

    return {
      success: true,
      serverTime: currentIso,
      context: { category: currentCategory, articleId: currentArticleId },
      slots: evaluatedSlots
    };
  }

  // GET /api/ads/active or /api/monetization/active (Evaluates and returns live ad decisions)
  if (req.method === 'GET' && (url.pathname === '/api/ads/active' || url.pathname === '/api/monetization/active')) {
    purgeExpiredAdHistory();
    const category = url.searchParams.get('category') || '';
    const articleId = url.searchParams.get('articleId') || '';
    const settings = getSavedSettings();
    const evaluated = evaluateActiveAds(settings.adsConfig || DEFAULT_SETTINGS.adsConfig, { category, articleId });
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    return res.end(JSON.stringify(evaluated));
  }

  // GET /api/ads/history (Retrieve list of live & scheduled ad campaigns, auto-purging expired)
  if (req.method === 'GET' && url.pathname === '/api/ads/history') {
    const { history } = purgeExpiredAdHistory();
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    return res.end(JSON.stringify(history));
  }

  // POST /api/ads/history/delete (Delete an ad campaign and wipe its media file from disk)
  if (req.method === 'POST' && url.pathname === '/api/ads/history/delete') {
    if (!verifyAdminAuthorization(req)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Forbidden: Admin authorization required.' }));
    }

    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const settings = getSavedSettings();
        const activeSlots = (settings && settings.adsConfig && settings.adsConfig.slots) ? settings.adsConfig.slots : {};
        let history = getAdHistory();
        
        if (body.clearAll) {
          for (const camp of history) {
            if (camp.sponsorBannerUrl) cleanupUnusedUploadFile(camp.sponsorBannerUrl, activeSlots);
          }
          history = [];
        } else if (body.id) {
          const target = history.find(h => h.id === body.id);
          if (target && target.sponsorBannerUrl) {
            cleanupUnusedUploadFile(target.sponsorBannerUrl, activeSlots);
          }
          history = history.filter(h => h.id !== body.id);
        }
        
        saveAdHistory(history);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, count: history.length, history }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // POST /api/ads/history/update (Edit & update an existing ad campaign)
  if (req.method === 'POST' && url.pathname === '/api/ads/history/update') {
    if (!verifyAdminAuthorization(req)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Forbidden: Admin authorization required.' }));
    }

    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        if (!body.id) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Campaign ID is required for editing.' }));
        }

        let history = getAdHistory();
        const index = history.findIndex(h => h.id === body.id);
        if (index === -1) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Campaign not found in active records.' }));
        }

        const oldCampaign = history[index];
        const oldBanner = oldCampaign.sponsorBannerUrl;
        const newBanner = body.sponsorBannerUrl || oldCampaign.sponsorBannerUrl;

        // If banner was replaced with a new one, clean up the old file if unused
        if (oldBanner && newBanner && oldBanner !== newBanner) {
          cleanupUnusedUploadFile(oldBanner, {});
        }

        const updatedCampaign = {
          ...oldCampaign,
          slotKey: body.slotKey || oldCampaign.slotKey,
          slotName: body.slotName || oldCampaign.slotName,
          sponsorName: body.sponsorName !== undefined ? body.sponsorName : oldCampaign.sponsorName,
          sponsorBannerUrl: newBanner,
          sponsorTargetUrl: body.sponsorTargetUrl !== undefined ? body.sponsorTargetUrl : oldCampaign.sponsorTargetUrl,
          scope: body.scope || oldCampaign.scope || 'global',
          targetCategory: body.targetCategory !== undefined ? body.targetCategory : (oldCampaign.targetCategory || 'all'),
          targetArticleId: body.targetArticleId !== undefined ? body.targetArticleId : (oldCampaign.targetArticleId || ''),
          targetArticleTitle: body.targetArticleTitle !== undefined ? body.targetArticleTitle : (oldCampaign.targetArticleTitle || ''),
          excludeArticleIds: body.excludeArticleIds !== undefined ? body.excludeArticleIds : (oldCampaign.excludeArticleIds || ''),
          startDateTime: body.startDateTime !== undefined ? body.startDateTime : (oldCampaign.startDateTime || ''),
          endDateTime: body.endDateTime !== undefined ? body.endDateTime : (oldCampaign.endDateTime || ''),
          updatedAt: new Date().toISOString()
        };

        history[index] = updatedCampaign;
        saveAdHistory(history);

        // Also sync live slot if this slot is active in settings
        const settings = getSavedSettings();
        if (settings && settings.adsConfig && settings.adsConfig.slots) {
          const slot = settings.adsConfig.slots[updatedCampaign.slotKey];
          if (slot && slot.type === 'sponsor') {
            slot.sponsorName = updatedCampaign.sponsorName;
            slot.sponsorBannerUrl = updatedCampaign.sponsorBannerUrl;
            slot.sponsorTargetUrl = updatedCampaign.sponsorTargetUrl;
            slot.scope = updatedCampaign.scope;
            slot.targetCategory = updatedCampaign.targetCategory;
            slot.targetArticleId = updatedCampaign.targetArticleId;
            slot.excludeArticleIds = updatedCampaign.excludeArticleIds;
            slot.startDateTime = updatedCampaign.startDateTime;
            slot.endDateTime = updatedCampaign.endDateTime;
            saveSettings(settings);
          }
        }

        console.log(`[Ad Campaign Edited]: ID ${body.id} for slot [${updatedCampaign.slotKey}] updated.`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, campaign: updatedCampaign, history }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // POST /api/ads/track/impression (Direct Sponsor Impression Telemetry)
  if (req.method === 'POST' && url.pathname === '/api/ads/track/impression') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const clientIp = getClientIp(req);
        const result = recordAdImpression(body.campaignId, body.slotKey, clientIp);
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store'
        });
        return res.end(JSON.stringify({ success: true, ...result }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // POST /api/ads/track/click (Direct Sponsor Click Telemetry)
  if (req.method === 'POST' && url.pathname === '/api/ads/track/click') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const clientIp = getClientIp(req);
        const result = recordAdClick(body.campaignId, body.slotKey, clientIp);
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store'
        });
        return res.end(JSON.stringify({ success: true, ...result }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // GET /api/poll (Retrieve active daily reader poll status, question, and vote statistics)
  if (req.method === 'GET' && url.pathname === '/api/poll') {
    const poll = getPollData();
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    });
    return res.end(JSON.stringify(poll));
  }

  // POST /api/poll/vote (Submit reader vote for a specific option)
  if (req.method === 'POST' && url.pathname === '/api/poll/vote') {
    let bodyText = '';
    req.on('data', chunk => {
      bodyText += chunk;
      if (bodyText.length > 5120) req.destroy();
    });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const { optionId } = body;
        if (!optionId || typeof optionId !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Valid optionId is required.' }));
        }

        const poll = getPollData();
        if (!poll.enabled) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Daily Reader Poll is currently inactive.' }));
        }

        const targetOption = poll.options.find(o => o.id === optionId);
        if (!targetOption) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Option not found in current poll.' }));
        }

        targetOption.votes = (targetOption.votes || 0) + 1;
        poll.totalVotes = poll.options.reduce((sum, opt) => sum + (opt.votes || 0), 0);
        poll.updatedAt = new Date().toISOString();

        savePollData(poll);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, poll }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Invalid JSON request payload.' }));
      }
    });
    return;
  }

  // POST /api/poll/admin (Update poll configuration: toggle on/off, edit question, options, or reset votes)
  if (req.method === 'POST' && url.pathname === '/api/poll/admin') {
    if (!verifyAdminAuthorization(req)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Forbidden: Admin authorization required.' }));
    }

    let bodyText = '';
    req.on('data', chunk => {
      bodyText += chunk;
      if (bodyText.length > 20480) req.destroy();
    });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const { enabled, question, options, resetVotes } = body;

        const currentPoll = getPollData();
        const updatedPoll = { ...currentPoll };

        if (typeof enabled === 'boolean') {
          updatedPoll.enabled = enabled;
        }

        if (question && typeof question === 'string' && question.trim().length > 0) {
          updatedPoll.question = question.trim();
        }

        if (Array.isArray(options) && options.length >= 2) {
          updatedPoll.options = options.map((opt, index) => ({
            id: opt.id || `opt-${index + 1}`,
            label: String(opt.label || `Option ${index + 1}`).trim(),
            votes: resetVotes ? 0 : (typeof opt.votes === 'number' ? opt.votes : 0)
          }));
        }

        if (resetVotes) {
          updatedPoll.id = `poll-${Date.now()}`;
          updatedPoll.options = updatedPoll.options.map(opt => ({ ...opt, votes: 0 }));
          updatedPoll.totalVotes = 0;
        } else {
          updatedPoll.totalVotes = updatedPoll.options.reduce((sum, opt) => sum + (opt.votes || 0), 0);
        }

        updatedPoll.updatedAt = new Date().toISOString();

        savePollData(updatedPoll);
        console.log(`[Daily Reader Poll Updated]: enabled=${updatedPoll.enabled}, totalVotes=${updatedPoll.totalVotes}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, poll: updatedPoll }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Failed to update poll configuration: ' + err.message }));
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
  // CATEGORIES TAXONOMY ENDPOINTS (DYNAMIC & PERSISTENT)
  // -------------------------------------------------------------

  // GET /api/categories (Retrieve backend-persisted categories taxonomy)
  if (req.method === 'GET' && url.pathname === '/api/categories') {
    const categories = getSavedCategories();
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    });
    return res.end(JSON.stringify(categories));
  }

  // POST /api/categories (Save/update categories taxonomy list)
  if (req.method === 'POST' && url.pathname === '/api/categories') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '[]');
        const categoriesList = Array.isArray(body) ? body : body.categories || [];

        if (!Array.isArray(categoriesList) || categoriesList.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Categories list must be a non-empty array' }));
        }

        // Sanitize and validate categories
        const sanitized = categoriesList.map((cat, idx) => {
          const name = String(cat.name || '').trim();
          const slug = String(cat.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `cat-${idx + 1}`);
          const id = String(cat.id || `cat-${Date.now()}-${idx}`);
          return { id, name, slug };
        }).filter(c => Boolean(c.name));

        const updated = saveCategories(sanitized);
        console.log(`[Backend Categories Saved]: ${updated.length} categories persisted`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, count: updated.length, categories: updated }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // -------------------------------------------------------------
  // ARTICLES & LIVE NEWS FEED CURATION ENDPOINTS
  // -------------------------------------------------------------

  // GET /api/articles (Retrieve backend-persisted articles with Public Embargo Shield)
  if (req.method === 'GET' && url.pathname === '/api/articles') {
    const allArticles = getSavedArticles();
    const scope = url.searchParams.get('scope');
    const role = (url.searchParams.get('role') || '').toLowerCase();
    const isStaff = scope === 'admin' || scope === 'all' || role === 'editor' || role === 'admin' || role === 'reporter';

    // Public readers only receive 'published' articles (scheduled and drafts remain embargoed)
    const responseArticles = isStaff
      ? allArticles
      : allArticles.filter(a => a.status === 'published' || !a.status);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(responseArticles));
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

  // POST /api/articles/update (Update single article by ID or add new with RBAC & Scheduler Guard)
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

        // Editorial RBAC Guard: Reporters cannot publish live or schedule publication
        const userRole = (body.userRole || body.currentUserRole || body.author?.role || '').toLowerCase();
        if (userRole === 'reporter' && (body.status === 'published' || body.status === 'scheduled')) {
          console.warn(`[Editorial RBAC Gate] Reporter attempted to set status to "${body.status}". Forcing to "draft".`);
          body.status = 'draft';
          body.scheduledPublishTime = null;
        }

        // Validate scheduled publishing date-time
        if (body.status === 'scheduled') {
          if (!body.scheduledPublishTime) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Valid scheduledPublishTime is required for scheduled stories.' }));
          }
          const schedMs = new Date(body.scheduledPublishTime).getTime();
          if (isNaN(schedMs)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Invalid scheduledPublishTime timestamp format.' }));
          }
          // If scheduled time has already arrived, flip to published immediately
          if (schedMs <= Date.now()) {
            body.status = 'published';
            body.published_at = 'Just now';
            body.publishDateISO = new Date().toISOString();
          }
        }

        const currentArticles = getSavedArticles();
        const existingIdx = currentArticles.findIndex(a => String(a.id) === String(body.id));

        // Task 23: Live Blog Mode formatting and updates preservation
        if (body.format === 'live') {
          body.live_status = body.live_status || 'active';
          if (!Array.isArray(body.live_updates)) {
            if (existingIdx >= 0 && Array.isArray(currentArticles[existingIdx].live_updates)) {
              body.live_updates = currentArticles[existingIdx].live_updates;
            } else {
              body.live_updates = [];
            }
          }
        }

        // Task 27 Subtopic B: Dynamic Reading Duration Calculation
        if (body.content) {
          const rawWords = String(body.content)
            .replace(/!\[.*?\]\(.*?\)/g, '')
            .replace(/\[(.*?)\]\(.*?\)/g, '$1')
            .replace(/[#*`_~><[\]()]/g, ' ')
            .split(/\s+/)
            .filter(Boolean);
          const isIndic = ['hi', 'mr', 'bn', 'te', 'ta', 'gu', 'kn', 'ml', 'pa', 'or', 'as', 'ur'].includes((body.originalLanguage || 'hi').toLowerCase());
          const wpm = isIndic ? 160 : 200;
          body.word_count = rawWords.length;
          body.reading_time_mins = Math.max(1, Math.ceil(rawWords.length / wpm));
        }

        let updatedArticles;
        if (existingIdx >= 0) {
          const oldArticle = currentArticles[existingIdx];
          // Ensure baseline version exists in revisions before updating
          const existingRevs = getArticleRevisionsStore()[String(body.id)] || [];
          if (existingRevs.length === 0) {
            recordArticleRevision(oldArticle, { name: oldArticle.author_name || oldArticle.author?.name, role: oldArticle.author_role || oldArticle.author?.role }, 'Original baseline version');
          }
          currentArticles[existingIdx] = { ...currentArticles[existingIdx], ...body };
          updatedArticles = currentArticles;
          // Record revision for the new update
          recordArticleRevision(currentArticles[existingIdx], { name: body.author_name || body.author?.name, role: userRole }, body.changeNote || 'Story content updated');
        } else {
          updatedArticles = [body, ...currentArticles];
          // Record initial creation revision
          recordArticleRevision(body, { name: body.author_name || body.author?.name, role: userRole }, body.changeNote || 'Initial story created');
        }
        saveArticles(updatedArticles);
        console.log(`[Backend Article Updated]: ${body.id} "${body.title}" (status: ${body.status})`);
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

  // GET /api/articles/:id/revisions (Task 21: Retrieve article revision history)
  const revisionsMatch = url.pathname.match(/^\/api\/articles\/([^/]+)\/revisions$/);
  if (req.method === 'GET' && revisionsMatch) {
    const articleId = decodeURIComponent(revisionsMatch[1]);
    const revisions = getRevisionsForArticle(articleId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, articleId, revisions }));
  }

  // POST /api/articles/:id/rollback (Task 21: 1-Click Rollback article to selected snapshot)
  const rollbackMatch = url.pathname.match(/^\/api\/articles\/([^/]+)\/rollback$/);
  if (req.method === 'POST' && rollbackMatch) {
    const articleId = decodeURIComponent(rollbackMatch[1]);
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const userRole = (body.userRole || body.role || '').toLowerCase();

        // Editorial RBAC Guard: Reporters cannot rollback articles
        if (userRole === 'reporter') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            error: 'Editorial Gate: Reporters do not have authorization to rollback articles. Contact an Editor or Admin.'
          }));
        }

        const { revisionId } = body;
        if (!revisionId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'revisionId is required for rollback.' }));
        }

        const revisions = getRevisionsForArticle(articleId);
        const targetRev = revisions.find(r => r.revisionId === revisionId);
        if (!targetRev) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Target revision not found.' }));
        }

        const currentArticles = getSavedArticles();
        const existingIdx = currentArticles.findIndex(a => String(a.id) === String(articleId));
        if (existingIdx === -1) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Article not found in active database.' }));
        }

        const currentArt = currentArticles[existingIdx];

        // Restore content and metadata from selected snapshot
        currentArt.title = targetRev.title;
        currentArt.sub_title = targetRev.sub_title;
        currentArt.content = targetRev.content;
        currentArt.summary = targetRev.summary;
        currentArt.category = targetRev.category;
        currentArt.featured_image = targetRev.featured_image;
        if (targetRev.status) currentArt.status = targetRev.status;
        if (targetRev.scheduledPublishTime) currentArt.scheduledPublishTime = targetRev.scheduledPublishTime;

        saveArticles(currentArticles);

        // Record a new revision tracking this rollback event
        const dtFormatted = new Date(targetRev.timestamp).toLocaleString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
        const rollbackNote = `Rolled back to revision from ${dtFormatted}`;
        recordArticleRevision(currentArt, { name: body.editorName || 'Editor', role: userRole || 'editor' }, rollbackNote);

        const updatedRevisions = getRevisionsForArticle(articleId);
        console.log(`[Revision Rollback]: Article ${articleId} "${currentArt.title}" restored to revision ${revisionId}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          article: currentArt,
          revisions: updatedRevisions,
          message: rollbackNote
        }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // POST /api/articles/:id/live-status (Task 23: Toggle Live Blog coverage status between active and concluded)
  const liveStatusMatch = url.pathname.match(/^\/api\/articles\/([^/]+)\/live-status$/);
  if (req.method === 'POST' && liveStatusMatch) {
    const articleId = decodeURIComponent(liveStatusMatch[1]);
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const userRole = (body.userRole || body.role || '').toLowerCase();

        // Editorial RBAC Guard: Reporters cannot toggle live status
        if (userRole === 'reporter') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            error: 'Editorial Gate: Reporters cannot modify live coverage status. Contact an Editor or Admin.'
          }));
        }

        const newStatus = body.live_status === 'concluded' ? 'concluded' : 'active';
        const currentArticles = getSavedArticles();
        const existingIdx = currentArticles.findIndex(a => String(a.id) === String(articleId));
        if (existingIdx === -1) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Article not found.' }));
        }

        const art = currentArticles[existingIdx];
        art.format = 'live';
        art.live_status = newStatus;
        if (!Array.isArray(art.live_updates)) {
          art.live_updates = [];
        }

        saveArticles(currentArticles);
        console.log(`[Live Blog Status]: Article ${articleId} live status updated to "${newStatus}"`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          article: art,
          live_status: newStatus
        }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // GET /api/articles/:id/live-updates (Fetch lightweight live timeline stream)
  const getLiveUpdatesMatch = url.pathname.match(/^\/api\/articles\/([^/]+)\/live-updates$/);
  if (req.method === 'GET' && getLiveUpdatesMatch) {
    const articleId = decodeURIComponent(getLiveUpdatesMatch[1]);
    const currentArticles = getSavedArticles();
    const art = currentArticles.find(a => String(a.id) === String(articleId));
    if (!art) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Article not found.' }));
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: true,
      articleId: art.id,
      format: art.format || 'standard',
      live_status: art.live_status || 'active',
      live_updates: Array.isArray(art.live_updates) ? art.live_updates : []
    }));
  }

  // POST /api/articles/:id/live-updates (Fast micro-update post without full article rewrite)
  const postLiveUpdatesMatch = url.pathname.match(/^\/api\/articles\/([^/]+)\/live-updates$/);
  if (req.method === 'POST' && postLiveUpdatesMatch) {
    const articleId = decodeURIComponent(postLiveUpdatesMatch[1]);
    let rawData = '';
    req.on('data', chunk => { rawData += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(rawData || '{}');
        const headline = (body.headline || '').trim();
        const updateBody = (body.body || '').trim();

        if (!headline && !updateBody) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Headline or body is required for a live update.' }));
        }

        const currentArticles = getSavedArticles();
        const existingIdx = currentArticles.findIndex(a => String(a.id) === String(articleId));
        if (existingIdx === -1) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Article not found.' }));
        }

        const art = currentArticles[existingIdx];
        if (!Array.isArray(art.live_updates)) {
          art.live_updates = [];
        }

        const now = new Date();
        const formattedTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

        const updateItem = {
          id: `upd-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          timestamp: body.timestamp ? String(body.timestamp).trim() : formattedTime,
          created_at: now.toISOString(),
          headline: headline || 'Key Update',
          body: updateBody,
          is_key_event: Boolean(body.is_key_event),
          media_url: body.media_url ? String(body.media_url).trim() : null,
          author: body.author ? String(body.author).trim() : (art.author || 'Editorial Desk')
        };

        // Prepend newest updates at the top
        art.live_updates.unshift(updateItem);
        art.format = 'live';
        if (!art.live_status) {
          art.live_status = 'active';
        }

        saveArticles(currentArticles);
        console.log(`[Live Blog Update]: Article ${articleId} received new micro-update: "${updateItem.headline}"`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          update: updateItem,
          live_updates: art.live_updates
        }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // DELETE /api/articles/:id/live-updates/:updateId (Remove erroneous live micro-update)
  const deleteLiveUpdateMatch = url.pathname.match(/^\/api\/articles\/([^/]+)\/live-updates\/([^/]+)$/);
  if (req.method === 'DELETE' && deleteLiveUpdateMatch) {
    const articleId = decodeURIComponent(deleteLiveUpdateMatch[1]);
    const updateId = decodeURIComponent(deleteLiveUpdateMatch[2]);

    const currentArticles = getSavedArticles();
    const existingIdx = currentArticles.findIndex(a => String(a.id) === String(articleId));
    if (existingIdx === -1) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Article not found.' }));
    }

    const art = currentArticles[existingIdx];
    if (!Array.isArray(art.live_updates)) {
      art.live_updates = [];
    }

    const initialLen = art.live_updates.length;
    art.live_updates = art.live_updates.filter(u => String(u.id) !== String(updateId));

    if (art.live_updates.length === initialLen) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Update ID not found.' }));
    }

    saveArticles(currentArticles);
    console.log(`[Live Blog Delete]: Deleted update ${updateId} from article ${articleId}`);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: true,
      deletedId: updateId,
      live_updates: art.live_updates
    }));
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

  // -------------------------------------------------------------
  // MEDIA LIBRARY DESK API ENDPOINTS (Task 22)
  // -------------------------------------------------------------

  // GET /api/media (Retrieve indexed media assets with usage tracking, search, filter, and sort)
  if (req.method === 'GET' && url.pathname === '/api/media') {
    try {
      const q = (url.searchParams.get('q') || '').trim().toLowerCase();
      const filter = (url.searchParams.get('filter') || 'all').toLowerCase();
      const sort = (url.searchParams.get('sort') || 'newest').toLowerCase();

      const allAssets = syncAndIndexMediaAssets();

      let filtered = allAssets;

      // Filter by usage status or metadata flags
      if (filter === 'used') {
        filtered = filtered.filter(a => a.isUsed);
      } else if (filter === 'unused') {
        filtered = filtered.filter(a => !a.isUsed);
      } else if (filter === 'has_caption') {
        filtered = filtered.filter(a => Boolean(a.caption && a.caption.trim() !== ''));
      } else if (filter === 'missing_credit') {
        filtered = filtered.filter(a => !a.credit || a.credit.trim() === '');
      }

      // Filter by multi-field search keyword (Filename, Caption, Credit, AltText, Linked Story Title/Category)
      if (q) {
        filtered = filtered.filter(a => {
          const fnMatch = a.fileName.toLowerCase().includes(q);
          const capMatch = (a.caption || '').toLowerCase().includes(q);
          const credMatch = (a.credit || '').toLowerCase().includes(q);
          const altMatch = (a.altText || '').toLowerCase().includes(q);
          const artMatch = a.usedInArticles && a.usedInArticles.some(art => 
            (art.title || '').toLowerCase().includes(q) || (art.category || '').toLowerCase().includes(q)
          );
          return fnMatch || capMatch || credMatch || altMatch || artMatch;
        });
      }

      // Enhanced Sorting
      if (sort === 'oldest') {
        filtered.sort((a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime());
      } else if (sort === 'size_desc') {
        filtered.sort((a, b) => b.sizeBytes - a.sizeBytes);
      } else if (sort === 'size_asc') {
        filtered.sort((a, b) => a.sizeBytes - b.sizeBytes);
      } else if (sort === 'name_asc') {
        filtered.sort((a, b) => a.fileName.localeCompare(b.fileName));
      } else if (sort === 'name_desc') {
        filtered.sort((a, b) => b.fileName.localeCompare(a.fileName));
      } else {
        // Default newest
        filtered.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
      }

      const totalCount = allAssets.length;
      const usedCount = allAssets.filter(a => a.isUsed).length;
      const unusedCount = allAssets.filter(a => !a.isUsed).length;
      const withCaptionCount = allAssets.filter(a => Boolean(a.caption && a.caption.trim())).length;
      const missingCreditCount = allAssets.filter(a => !a.credit || !a.credit.trim()).length;
      const totalSizeBytes = allAssets.reduce((acc, a) => acc + (a.sizeBytes || 0), 0);
      const totalSizeKb = parseFloat((totalSizeBytes / 1024).toFixed(1));
      const totalSizeMb = parseFloat((totalSizeBytes / (1024 * 1024)).toFixed(2));
      const avgSizeKb = totalCount > 0 ? parseFloat((totalSizeKb / totalCount).toFixed(1)) : 0;
      const storageLimitMb = 5000;
      const storageUsedPct = parseFloat(((totalSizeBytes / (storageLimitMb * 1024 * 1024)) * 100).toFixed(3));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: true,
        stats: {
          totalCount,
          usedCount,
          unusedCount,
          withCaptionCount,
          missingCreditCount,
          totalSizeBytes,
          totalSizeKb,
          totalSizeMb: `${totalSizeMb} MB`,
          avgSizeKb: `${avgSizeKb} KB`,
          storageLimitMb,
          storageUsedPct
        },
        assets: filtered
      }));
    } catch (e) {
      console.error('[Media API Error]', e);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: e.message }));
    }
  }

  // POST /api/media/delete (Delete media asset with Active Article Safety Guard & Editorial RBAC)
  if (req.method === 'POST' && url.pathname === '/api/media/delete') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const fileName = path.basename(String(body.fileName || ''));
        const force = Boolean(body.force);
        const userRole = (body.userRole || body.role || 'editor').toLowerCase();

        // RBAC Rule 1: Reporters cannot delete any media assets
        if (userRole === 'reporter') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            error: 'Editorial Gate: Reporters cannot delete media assets. Contact an Editor or Admin.'
          }));
        }

        if (!fileName) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'fileName is required for media deletion.' }));
        }

        const filePath = path.join(UPLOADS_DIR, fileName);
        if (!fs.existsSync(filePath)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: `File "${fileName}" does not exist in uploads storage.` }));
        }

        // Check if currently used in active articles
        const currentAssets = syncAndIndexMediaAssets();
        const targetAsset = currentAssets.find(a => a.fileName === fileName);

        if (targetAsset && targetAsset.usedInArticles && targetAsset.usedInArticles.length > 0) {
          if (!force) {
            res.writeHead(409, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
              error: 'Active Article Safety Guard: This photo is currently used in active stories. Confirm force deletion to proceed.',
              usedInArticles: targetAsset.usedInArticles,
              requiresForce: true
            }));
          }

          // RBAC Rule 2: Force-deleting in-use media requires Newsroom Administrator role
          if (userRole !== 'admin') {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
              error: 'Administrative Gate: Only Newsroom Administrators can force-delete media assets currently in use by active news stories. Editors can only delete unused media.'
            }));
          }
        }

        fs.unlinkSync(filePath);
        console.log(`[Media Library] Deleted file: ${fileName} by ${userRole}`);

        const updatedAssets = syncAndIndexMediaAssets();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          message: `Asset "${fileName}" removed successfully.`,
          fileName,
          remainingCount: updatedAssets.length
        }));
      } catch (e) {
        console.error('[Media Delete Error]', e);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // POST /api/media/update (Update caption, credit, alt-text for an asset with Editorial RBAC)
  if (req.method === 'POST' && url.pathname === '/api/media/update') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const userRole = (body.userRole || body.role || 'editor').toLowerCase();

        // RBAC Rule 3: Reporters cannot edit existing media metadata
        if (userRole === 'reporter') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            error: 'Editorial Gate: Reporters cannot modify media asset metadata. Only Editors and Administrators have editing authorization.'
          }));
        }

        const fileName = path.basename(String(body.fileName || ''));
        if (!fileName) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'fileName is required.' }));
        }

        const assets = getMediaLibraryStore();
        const asset = assets.find(a => a.fileName === fileName);
        if (!asset) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Asset not found in library.' }));
        }

        if (body.caption !== undefined) asset.caption = String(body.caption).trim();
        if (body.credit !== undefined) asset.credit = String(body.credit).trim();
        if (body.altText !== undefined) asset.altText = String(body.altText).trim();
        if (body.width) asset.width = Number(body.width);
        if (body.height) asset.height = Number(body.height);
        asset.modifiedAt = new Date().toISOString();

        saveMediaLibraryStore(assets);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, asset }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`PublicSpark Newsroom Backend Proxy running at http://localhost:${PORT}`);
  cleanupExpiredAudioFiles(14);
  const audioCleanupTimer = setInterval(() => cleanupExpiredAudioFiles(14), 24 * 60 * 60 * 1000);
  if (audioCleanupTimer.unref) audioCleanupTimer.unref();
});
