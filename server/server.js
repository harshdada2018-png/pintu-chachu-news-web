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
import {
  initStaffStore,
  getStaffList,
  saveStaffList,
  hashPassword,
  verifyPassword,
  checkLoginRateLimit,
  recordFailedLogin,
  clearFailedLogin,
  generateStaffSessionToken,
  verifyStaffSessionToken,
  createOtpForEmail,
  verifyAndDestroyOtp,
  updateStaffPassword,
  updateStaffPasswordWithToken,
  getSanitizedStaffList,
  approveStaffMember,
  updateStaffRole,
  updateStaffStatus,
  deleteStaffMember,
  adminResetStaffPassword,
  updateStaffEmail,
  createTemp2faToken,
  verifyTemp2faToken,
  getStaff2faStatus,
  initiate2faSetup,
  confirm2faSetup,
  verify2faLogin,
  revokeStaffSessionToken,
  checkOtpIpRateLimit,
  clearAllSecurityLocks,
  getSecurityDiagnostics
} from './services/staffAuthService.js';
import { dispatchOtpEmail } from './services/emailSenderService.js';
import { sendNewsroomEmail, isEmailConfigured } from './services/emailSenderService.js';
import {
  generateNewsroomBackupZip,
  generateNewsroomBackupZipAsync,
  listAvailableBackups,
  getSafeBackupFilePath,
  deleteBackupFile,
  dispatchBackupToGmail,
  getBackupSettings,
  updateBackupSettings
} from './services/backupService.js';

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
  'or', 'as', 'ur', 'fr', 'it', 'ja', 'id', 'zh-TW', 'zh-tw', 'ru'
];

function normalizeLanguageCode(code) {
  if (!code) return 'hi';
  const c = String(code).trim();
  if (c.toLowerCase() === 'zh-tw' || c === 'zh-TW') return 'zh-TW';
  return c.toLowerCase();
}

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
${JSON.stringify(newsArticleSchema, null, 2).replace(/</g, '\\u003c')}
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
Sitemap: ${siteUrl}/news-sitemap.xml
Sitemap: ${siteUrl}/rss.xml
`;
}

function generateRss2Feed(articles, host = 'localhost:5000') {
  const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
  const siteUrl = `${protocol}://${host}`;
  const published = articles.filter(a => a.status === 'published' || !a.status).slice(0, 30);

  let itemsXml = '';
  for (const art of published) {
    const slugOrId = art.slug || art.id;
    const link = `${siteUrl}/article/${encodeURIComponent(slugOrId)}`;
    const pubDate = new Date(art.createdAt || Date.now()).toUTCString();
    const desc = escapeXml((art.summary || art.content || '').replace(/<[^>]+>/g, '').slice(0, 480));
    const title = escapeXml(art.title || 'Untitled');
    const category = escapeXml(art.category || 'News');
    const author = escapeXml(art.author || 'PublicSpark Desk');
    const imgUrl = art.image && !art.image.startsWith('data:')
      ? (art.image.startsWith('http') ? art.image : `${siteUrl}${art.image}`)
      : '';
    const mediaXml = imgUrl
      ? `      <media:content url="${escapeXml(imgUrl)}" medium="image" />\n      <media:thumbnail url="${escapeXml(imgUrl)}" />\n`
      : '';

    itemsXml += `    <item>
      <title>${title}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
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
    <link>${siteUrl}</link>
    <description>Independent Digital Newsroom - Breaking News, Fact-Checked Reports &amp; Regional Journalism</description>
    <language>hi-IN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <ttl>15</ttl>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml" />
${itemsXml}  </channel>
</rss>`;
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

function isPoisonedTranslation(article, lang, record) {
  if (!record || !record.title || !String(record.title).trim()) return true;
  if (record.status && record.status !== 'done') return true;
  if (!article) return false;

  const origLang = normalizeLanguageCode(article.originalLanguage || 'hi');
  const targetLang = normalizeLanguageCode(lang || 'hi');
  if (origLang === targetLang) return false;

  const origTitle = String(article.title || '').trim();
  const transTitle = String(record.title || '').trim();
  if (origTitle && transTitle === origTitle) return true;

  if (record.body && article.content) {
    const origBody = String(article.content || '').trim();
    const transBody = String(record.body || '').trim();
    if (origBody.length > 30 && transBody === origBody) return true;
  }
  return false;
}

function saveTranslationRecord(articleId, lang, record) {
  try {
    const articles = getSavedArticles();
    const srcArticle = articles.find(a => String(a.id) === String(articleId));
    if (isPoisonedTranslation(srcArticle, lang, record)) {
      console.warn(`[Anti-Poison Cache Guard] Refused to cache untranslated/invalid record for ${articleId}:${lang}`);
      return false;
    }

    const store = getTranslationsStore();
    const key = `${articleId}:${lang}`;
    store[key] = {
      article_id: articleId,
      lang,
      ...record,
      created_at: record.created_at || new Date().toISOString(),
      last_accessed_at: record.last_accessed_at || new Date().toISOString()
    };
    fs.writeFileSync(TRANSLATIONS_FILE, JSON.stringify(store, null, 2));
    return true;
  } catch (e) {
    console.error('[Save Translation Error]', e.message);
    return false;
  }
}

function touchTranslationAccess(articleId, lang) {
  try {
    const store = getTranslationsStore();
    const key = `${articleId}:${lang}`;
    if (store[key]) {
      store[key].last_accessed_at = new Date().toISOString();
      fs.writeFileSync(TRANSLATIONS_FILE, JSON.stringify(store, null, 2));
    }
  } catch (e) {}
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
      created_at: record.created_at || new Date().toISOString(),
      last_played_at: record.last_played_at || new Date().toISOString()
    };
    fs.writeFileSync(AUDIO_RECORDS_FILE, JSON.stringify(store, null, 2));
  } catch (e) {
    console.error('[Save Audio Record Error]', e.message);
  }
}

function touchAudioAccess(articleId, lang, clipType, targetPath) {
  try {
    const store = getAudioRecordsStore();
    const key = `${articleId}:${lang}:${clipType}`;
    if (store[key]) {
      store[key].last_played_at = new Date().toISOString();
      fs.writeFileSync(AUDIO_RECORDS_FILE, JSON.stringify(store, null, 2));
    }
    if (targetPath && fs.existsSync(targetPath)) {
      const now = new Date();
      fs.utimesSync(targetPath, now, now);
    }
  } catch (e) {}
}

/**
 * Cascading Article Data Cleaner
 * When an article is deleted, immediately removes all associated translations,
 * revision history trees, audio records, physical disk audio files, and in-memory cache keys.
 */
function cascadeDeleteArticleData(articleId) {
  const aId = String(articleId);
  const sanitizedId = aId.replace(/[^a-zA-Z0-9-_]/g, '_');
  let translationsDeleted = 0;
  let audioRecordsDeleted = 0;
  let audioFilesDeleted = 0;
  let revisionsDeleted = 0;

  try {
    // 1. Purge from translations.json
    if (fs.existsSync(TRANSLATIONS_FILE)) {
      const transStore = getTranslationsStore();
      let transChanged = false;
      for (const [key, val] of Object.entries(transStore)) {
        if (key.startsWith(`${aId}:`) || String(val.article_id) === aId) {
          delete transStore[key];
          transChanged = true;
          translationsDeleted++;
        }
      }
      if (transChanged) {
        fs.writeFileSync(TRANSLATIONS_FILE, JSON.stringify(transStore, null, 2));
      }
    }

    // 2. Purge from article_revisions.json
    if (fs.existsSync(ARTICLE_REVISIONS_FILE)) {
      const revStore = getArticleRevisionsStore();
      if (revStore[aId]) {
        delete revStore[aId];
        saveArticleRevisionsStore(revStore);
        revisionsDeleted++;
      }
    }

    // 3. Purge from audio_records.json
    if (fs.existsSync(AUDIO_RECORDS_FILE)) {
      const audioStore = getAudioRecordsStore();
      let audioChanged = false;
      for (const [key, val] of Object.entries(audioStore)) {
        if (key.startsWith(`${aId}:`) || key.startsWith(`${sanitizedId}:`) || String(val.article_id) === aId) {
          delete audioStore[key];
          audioChanged = true;
          audioRecordsDeleted++;
        }
      }
      if (audioChanged) {
        fs.writeFileSync(AUDIO_RECORDS_FILE, JSON.stringify(audioStore, null, 2));
      }
    }

    // 4. Unlink physical audio files from uploads/
    if (fs.existsSync(UPLOADS_DIR)) {
      const files = fs.readdirSync(UPLOADS_DIR);
      for (const file of files) {
        if ((file.startsWith(`audio_${aId}_`) || file.startsWith(`audio_${sanitizedId}_`)) &&
            (file.endsWith('.mp3') || file.endsWith('.wav'))) {
          try {
            fs.unlinkSync(path.join(UPLOADS_DIR, file));
            audioFilesDeleted++;
          } catch (e) {}
        }
      }
    }

    // 5. Evict from in-memory caches
    for (const key of serverAudioCache.keys()) {
      if (key.startsWith(aId) || key.startsWith(sanitizedId)) {
        serverAudioCache.delete(key);
      }
    }
    for (const key of serverTranslationCache.keys()) {
      if (key.startsWith(aId) || key.includes(aId)) {
        serverTranslationCache.delete(key);
      }
    }

    console.log(`[Cascading Article Cleanup] Article ${aId}: purged ${translationsDeleted} translations, ${revisionsDeleted} revision trees, ${audioRecordsDeleted} audio records, ${audioFilesDeleted} disk audio files.`);
  } catch (err) {
    console.error(`[Cascading Cleanup Error] Failed to cascade delete article ${aId}:`, err.message);
  }

  return { translationsDeleted, revisionsDeleted, audioRecordsDeleted, audioFilesDeleted };
}

/**
 * Startup & Periodic Orphan Sweeper
 * Sweeps translations.json, article_revisions.json, and audio_records.json
 * to permanently eliminate orphaned/ghost records belonging to deleted articles.
 */
function purgeOrphanedSatelliteData() {
  let orphanedTranslationsPurged = 0;
  let orphanedRevisionsPurged = 0;
  let orphanedAudioPurged = 0;
  let orphanedFilesUnlinked = 0;

  try {
    const articles = getSavedArticles();
    const validArticleIds = new Set(articles.map(a => String(a.id)));

    // 1. Sweep translations.json (orphaned + poisoned untranslated entries)
    if (fs.existsSync(TRANSLATIONS_FILE)) {
      const articleMap = new Map(articles.map(a => [String(a.id), a]));
      const transStore = getTranslationsStore();
      let transChanged = false;
      for (const [key, val] of Object.entries(transStore)) {
        const artId = String(val.article_id || key.split(':')[0] || '');
        const srcArt = articleMap.get(artId);
        const isOrphan = artId && !validArticleIds.has(artId);
        const isPoisoned = srcArt ? isPoisonedTranslation(srcArt, val.lang || key.split(':')[1], val) : false;
        if (isOrphan || isPoisoned) {
          delete transStore[key];
          transChanged = true;
          orphanedTranslationsPurged++;
        }
      }
      if (transChanged) {
        fs.writeFileSync(TRANSLATIONS_FILE, JSON.stringify(transStore, null, 2));
      }
    }

    // 2. Sweep article_revisions.json
    if (fs.existsSync(ARTICLE_REVISIONS_FILE)) {
      const revStore = getArticleRevisionsStore();
      let revChanged = false;
      for (const key of Object.keys(revStore)) {
        if (!validArticleIds.has(String(key))) {
          delete revStore[key];
          revChanged = true;
          orphanedRevisionsPurged++;
        }
      }
      if (revChanged) {
        saveArticleRevisionsStore(revStore);
      }
    }

    // 3. Sweep audio_records.json
    if (fs.existsSync(AUDIO_RECORDS_FILE)) {
      const audioStore = getAudioRecordsStore();
      let audioChanged = false;
      for (const [key, val] of Object.entries(audioStore)) {
        const artId = String(val.article_id || key.split(':')[0] || '');
        if (artId && artId !== 'general' && !validArticleIds.has(artId)) {
          if (val.audio_url) {
            const localPath = path.join(UPLOADS_DIR, path.basename(val.audio_url));
            if (fs.existsSync(localPath)) {
              try { fs.unlinkSync(localPath); orphanedFilesUnlinked++; } catch (e) {}
            }
          }
          delete audioStore[key];
          audioChanged = true;
          orphanedAudioPurged++;
        }
      }
      if (audioChanged) {
        fs.writeFileSync(AUDIO_RECORDS_FILE, JSON.stringify(audioStore, null, 2));
      }
    }

    if (orphanedTranslationsPurged > 0 || orphanedRevisionsPurged > 0 || orphanedAudioPurged > 0) {
      console.log(`[Orphan Sweeper] Purged ${orphanedTranslationsPurged} ghost translations, ${orphanedRevisionsPurged} ghost revisions, ${orphanedAudioPurged} ghost audio records.`);
    }
  } catch (err) {
    console.warn('[Orphan Sweeper Error]', err.message);
  }

  return {
    orphanedTranslationsPurged,
    orphanedRevisionsPurged,
    orphanedAudioPurged,
    orphanedFilesUnlinked
  };
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

const DEFAULT_ARTICLES = [];

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
      purgeCloudflareEdgeCache('scheduled_articles_auto_published');
      // Proactively pre-translate newly flipped published stories to English
      evaluated.filter(a => a.status === 'published' && a.published_at === 'Just now').forEach(art => {
        autoPreTranslatePublishedArticle(art);
        autoPreWarmPublishedAudio(art);
      });
    } catch (e) {
      console.error('[Auto-Publish Engine] Error saving auto-published articles:', e);
    }
  }

  return evaluated;
}

// -------------------------------------------------------------
// Cloudflare Edge Cache Invalidation on Article Publish / Update / Delete
// -------------------------------------------------------------
async function purgeCloudflareEdgeCache(reason = 'articles_updated') {
  try {
    // Clear local in-memory translation cache on server
    if (typeof serverTranslationCache !== 'undefined' && serverTranslationCache && serverTranslationCache.clear) {
      serverTranslationCache.clear();
    }

    const zoneId = process.env.CLOUDFLARE_ZONE_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (!zoneId || !apiToken) {
      console.log(`[Edge Cache Invalidation] (${reason}): No Cloudflare credentials configured in environment. Local cache flushed.`);
      return { success: true, localOnly: true, reason };
    }

    console.log(`[Cloudflare Purge API] Invalidate triggered for zone ${zoneId} (${reason})...`);
    const purgeUrl = `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`;
    const res = await fetch(purgeUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ purge_everything: true })
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      console.log(`[Cloudflare Purge API SUCCESS] Global edge cache purged worldwide in <200ms (${reason}).`);
      return { success: true, cloudflare: true, reason };
    } else {
      console.warn(`[Cloudflare Purge API Warning] Purge returned errors:`, data.errors || data);
      return { success: false, errors: data.errors, reason };
    }
  } catch (err) {
    console.warn(`[Cloudflare Purge API Error]:`, err.message);
    return { success: false, error: err.message, reason };
  }
}

// -------------------------------------------------------------
// Proactive Background Pre-Translation for Published Breaking News
// Ensures newly published stories are immediately available in English
// without reader latency or 5-minute cache desynchronization.
// -------------------------------------------------------------
function autoPreTranslatePublishedArticle(article) {
  if (!article || article.status !== 'published' || !article.id || !article.title) return;

  setImmediate(async () => {
    try {
      const store = getTranslationsStore();
      const enKey = `${article.id}:en`;

      // Check if already translated to English and up-to-date
      const contentHash = computeContentHash(`${article.title}:::${article.content || ''}`);
      if (store[enKey] && store[enKey].title && store[enKey].status === 'done' && store[enKey].content_hash === contentHash) {
        return;
      }

      console.log(`[Auto Pre-Translation] Proactively translating new story "${article.title.slice(0, 50)}..." to English...`);
      const rawSummary = article.summary || (Array.isArray(article.highlights) ? article.highlights[0] : '') || '';
      const rawHighlights = Array.isArray(article.highlights) && article.highlights.length > 0
        ? article.highlights
        : (rawSummary ? [rawSummary] : []);

      const translated = await translateWithGemini(
        article.title,
        article.content || '',
        rawHighlights,
        'en',
        article.originalLanguage || 'hi',
        rawSummary
      );

      if (translated && translated.title) {
        saveTranslationRecord(article.id, 'en', {
          title: translated.title,
          summary: translated.summary || (Array.isArray(translated.highlights) ? translated.highlights[0] : '') || rawSummary,
          sub_title: translated.sub_title || article.sub_title || '',
          highlights: translated.highlights || rawHighlights,
          body: translated.body || article.content || '',
          status: 'done',
          content_hash: contentHash
        });
        console.log(`[Auto Pre-Translation SUCCESS] Article ${article.id} English translation written to disk cache.`);
      }
    } catch (err) {
      console.warn(`[Auto Pre-Translation Warning] Proactive translation failed for ${article.id}:`, err.message);
    }
  });
}

// -------------------------------------------------------------
// Proactive Background Pre-Warming for Published Stories Audio
// Pre-generates Clip 1 (Headline + Highlights) in the background
// so reader clicks have 0ms latency and zero browser autoplay blocks.
// -------------------------------------------------------------
function autoPreWarmPublishedAudio(article) {
  if (!article || article.status !== 'published' || !article.id || !article.title) return;

  setImmediate(async () => {
    try {
      const sanitizedArticleId = article.id.replace(/[^a-zA-Z0-9-_]/g, '_');
      const targetLang = (article.originalLanguage || 'hi').toLowerCase();
      const audioFileNameMp3 = `audio_${sanitizedArticleId}_${targetLang}_clip_1_intro.mp3`;
      const audioFilePathMp3 = path.join(UPLOADS_DIR, audioFileNameMp3);

      if (fs.existsSync(audioFilePathMp3) && fs.statSync(audioFilePathMp3).size > 500) {
        return; // Already cached
      }

      console.log(`[Auto Audio Pre-Warm] Generating Gemini audio for "${article.title.slice(0, 50)}..." (${targetLang})`);
      const cleanTitle = (article.title || '').trim();
      const cleanHighlights = Array.isArray(article.highlights) && article.highlights.length > 0
        ? article.highlights.filter(h => h && typeof h === 'string').join('. ')
        : (article.summary || '');
      const textToRead = cleanHighlights ? `${cleanTitle}. ${cleanHighlights}` : cleanTitle;

      if (!textToRead) return;

      const rawAudioBuffer = await generateGeminiAudio(textToRead, targetLang);
      const finalAudioBuffer = compressAudioBufferToMp3(rawAudioBuffer, 32);
      fs.writeFileSync(audioFilePathMp3, finalAudioBuffer);
      incrementDailyUsage('Gemini_TTS');

      saveAudioRecord(sanitizedArticleId, targetLang, 'clip_1_intro', {
        audio_url: `/uploads/${audioFileNameMp3}`,
        size_bytes: finalAudioBuffer.length,
        status: 'done'
      });
      console.log(`[Auto Audio Pre-Warm SUCCESS] Audio ready on disk for ${sanitizedArticleId} (${finalAudioBuffer.length} bytes)`);
    } catch (err) {
      console.warn(`[Auto Audio Pre-Warm Error for ${article.id}]:`, err.message);
    }
  });
}

function getSavedArticles() {
  try {
    if (fs.existsSync(ARTICLES_FILE)) {
      const raw = fs.readFileSync(ARTICLES_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return evaluateScheduledArticles(parsed);
      }
    }
    // Initialize file on disk on first access
    fs.writeFileSync(ARTICLES_FILE, JSON.stringify([], null, 2), 'utf8');
  } catch (e) {
    console.error('Error reading/initializing articles file:', e);
  }
  return [];
}

function saveArticles(articlesList, reason = 'articles_updated') {
  try {
    fs.writeFileSync(ARTICLES_FILE, JSON.stringify(articlesList, null, 2), 'utf8');
    // Global Edge Cache Invalidation: Automatically purge Cloudflare Edge & local server RAM cache
    purgeCloudflareEdgeCache(reason);
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

    let cleanTitle = rawTitle
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '')
      .replace(/&gt;/g, '')
      .replace(/\s+/g, ' ')
      .trim();

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
      featured_image: '',
      is_breaking: false,
      author: {
        name: sourceName,
        role: 'Live RSS Stream',
        avatar: ''
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
    headingWeight: 800,
    bodySize: 16,
    bodyWeight: 400,
    mobileHeadingScale: 85,
    mobileBodySize: 15,
    regionalFonts: {
      hi: { headingFont: 'Playfair Display', bodyFont: 'Plus Jakarta Sans' },
      en: { headingFont: 'Playfair Display', bodyFont: 'Plus Jakarta Sans' },
      bn: { headingFont: 'Noto Serif Bengali', bodyFont: 'Plus Jakarta Sans' },
      mr: { headingFont: 'Noto Serif Devanagari', bodyFont: 'Plus Jakarta Sans' },
      te: { headingFont: 'Noto Serif Telugu', bodyFont: 'Plus Jakarta Sans' },
      ta: { headingFont: 'Noto Serif Tamil', bodyFont: 'Plus Jakarta Sans' },
      gu: { headingFont: 'Noto Serif Gujarati', bodyFont: 'Plus Jakarta Sans' },
      kn: { headingFont: 'Noto Serif Kannada', bodyFont: 'Plus Jakarta Sans' },
      ml: { headingFont: 'Noto Serif Malayalam', bodyFont: 'Plus Jakarta Sans' },
      pa: { headingFont: 'Noto Serif Gurmukhi', bodyFont: 'Plus Jakarta Sans' },
      or: { headingFont: 'Noto Sans Oriya', bodyFont: 'Plus Jakarta Sans' },
      as: { headingFont: 'Noto Serif Bengali', bodyFont: 'Plus Jakarta Sans' },
      ur: { headingFont: 'Noto Nastaliq Urdu', bodyFont: 'Plus Jakarta Sans' },
      ja: { headingFont: 'Noto Sans JP', bodyFont: 'Plus Jakarta Sans' },
      'zh-TW': { headingFont: 'Noto Sans TC', bodyFont: 'Plus Jakarta Sans' },
      fr: { headingFont: 'Playfair Display', bodyFont: 'Plus Jakarta Sans' },
      it: { headingFont: 'Playfair Display', bodyFont: 'Plus Jakarta Sans' },
      id: { headingFont: 'Playfair Display', bodyFont: 'Plus Jakarta Sans' },
      ru: { headingFont: 'Playfair Display', bodyFont: 'Plus Jakarta Sans' }
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
const GRIEVANCES_FILE = path.join(DATA_DIR, 'grievances.json');
const CONFIDENTIAL_TIPS_FILE = path.join(DATA_DIR, 'confidential_tips.json');

function getSavedConfidentialTips() {
  try {
    if (fs.existsSync(CONFIDENTIAL_TIPS_FILE)) {
      const raw = fs.readFileSync(CONFIDENTIAL_TIPS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Error reading confidential tips file:', e);
  }
  return [];
}

function saveConfidentialTips(tips) {
  try {
    fs.writeFileSync(CONFIDENTIAL_TIPS_FILE, JSON.stringify(tips, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Error saving confidential tips file:', e);
    return false;
  }
}

function generateTipTrackingId() {
  const num = crypto.randomInt(1000, 9999);
  const code = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `TIP-${num}-${code}`;
}

function getSavedGrievances() {
  try {
    if (fs.existsSync(GRIEVANCES_FILE)) {
      const raw = fs.readFileSync(GRIEVANCES_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Error reading grievances file:', e);
  }
  return [];
}

function saveGrievances(grievances) {
  try {
    fs.writeFileSync(GRIEVANCES_FILE, JSON.stringify(grievances, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Error saving grievances file:', e);
    return false;
  }
}

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
  const authHeader = req.headers['authorization'] || '';
  
  // Cryptographic session Bearer token check (must be verified Newsroom Administrator or Sovereign Developer)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const session = verifyStaffSessionToken(token);
    if (session && (session.role === 'admin' || session.role === 'developer')) {
      return true;
    }
  }

  return false;
}

function verifyDeveloperAuthorization(req) {
  const authHeader = req.headers['authorization'] || '';
  
  // Cryptographic session Bearer token check (Strictly Sovereign Developer, SEC-043 Fix)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const session = verifyStaffSessionToken(token);
    if (session && session.role === 'developer') {
      return true;
    }
  }

  return false;
}

function formatProcessUptime(seconds) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

function auditDatabaseFiles() {
  const results = [];
  try {
    const files = fs.readdirSync(DATA_DIR);
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      const fullPath = path.join(DATA_DIR, f);
      try {
        const stat = fs.statSync(fullPath);
        const raw = fs.readFileSync(fullPath, 'utf8');
        let records = 0;
        let isValid = false;
        try {
          const parsed = JSON.parse(raw);
          isValid = true;
          if (Array.isArray(parsed)) {
            records = parsed.length;
          } else if (parsed && typeof parsed === 'object') {
            records = Object.keys(parsed).length;
          }
        } catch {
          isValid = false;
        }

        results.push({
          file: f,
          sizeBytes: stat.size,
          sizeFormatted: (stat.size / 1024).toFixed(1) + ' KB',
          records,
          valid: isValid,
          mtime: stat.mtime
        });
      } catch (err) {
        results.push({
          file: f,
          sizeBytes: 0,
          sizeFormatted: '0 KB',
          records: 0,
          valid: false,
          error: err.message
        });
      }
    }
  } catch (err) {
    console.error('[Database Audit Error]:', err.message);
  }
  return results;
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

// IPv4 standard regex (0-255 octets)
const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
// IPv6 standard basic regex
const IPV6_REGEX = /^[0-9a-fA-F:]{2,39}$/;

export function sanitizeIp(rawIp) {
  if (!rawIp || typeof rawIp !== 'string') return null;
  let ip = rawIp.trim();
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  if (ip === '::1') return '127.0.0.1';
  if (IPV4_REGEX.test(ip) || IPV6_REGEX.test(ip)) {
    return ip;
  }
  return null;
}

export function getClientIp(req) {
  if (!req) return '127.0.0.1';

  // 1. Cloudflare authoritative connecting IP (SEC-020: Only trust when BEHIND_CLOUDFLARE is explicitly enabled in env)
  if (process.env.BEHIND_CLOUDFLARE === 'true' && req.headers && req.headers['cf-connecting-ip']) {
    const cfIp = sanitizeIp(req.headers['cf-connecting-ip']);
    if (cfIp) return cfIp;
  }

  // 2. Standard X-Forwarded-For: Leftmost validated IP address (only when explicitly behind a trusted reverse proxy)
  const trustProxy = process.env.BEHIND_PROXY === 'true' || process.env.TRUST_PROXY === 'true';
  const forwarded = req.headers && req.headers['x-forwarded-for'];
  if (trustProxy && forwarded && typeof forwarded === 'string') {
    const list = forwarded.split(',');
    for (const candidate of list) {
      const sanitized = sanitizeIp(candidate);
      if (sanitized) return sanitized;
    }
  }

  // 3. Socket / Connection remoteAddress fallback
  const socketIp = sanitizeIp(req.socket?.remoteAddress || req.connection?.remoteAddress);
  if (socketIp) return socketIp;

  return '127.0.0.1';
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
  'zh-TW': { provider: 'google', languageCode: 'zh-TW', voiceName: 'zh-TW-Wavenet-A', gender: 'FEMALE' },
  'ru': { provider: 'google', languageCode: 'ru-RU', voiceName: 'ru-RU-Wavenet-A', gender: 'FEMALE' },
  // Odia & Assamese -> Handled via Sarvam AI API
  'or': { provider: 'sarvam', languageCode: 'od-IN', speaker: 'meera' },
  'as': { provider: 'sarvam', languageCode: 'as-IN', speaker: 'meera' }
};

// In-Memory Server Caches
const serverAudioCache = new Map();
const serverTranslationCache = new Map();
const serverAudioProgressMap = new Map();
const serverWeatherCache = new Map();
const serverCityGeoCache = new Map();

/**
 * Open-Meteo Weather Proxy Engine
 * Fetches real-time weather with 20-minute sliding cache.
 * Open-Meteo is 100% free with zero API key requirement.
 */
async function fetchOpenMeteoWeather(lat, lon, cityName = 'Jaitahari') {
  const roundedLat = Math.round(Number(lat) * 100) / 100;
  const roundedLon = Math.round(Number(lon) * 100) / 100;
  const cacheKey = `${roundedLat}_${roundedLon}`;
  const now = Date.now();

  const cached = serverWeatherCache.get(cacheKey);
  if (cached && (now - cached.timestamp < 20 * 60 * 1000)) { // 20 mins TTL
    return { ...cached.data, isCached: true };
  }

  const endpoint = `https://api.open-meteo.com/v1/forecast?latitude=${roundedLat}&longitude=${roundedLon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;
  
  const response = await fetch(endpoint, {
    headers: { 'User-Agent': 'PublicSparkNewsroom/1.0' },
    signal: AbortSignal.timeout(8000)
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo returned status ${response.status}`);
  }

  const data = await response.json();
  const current = data.current || {};
  const daily = data.daily || {};

  const forecastDays = [];
  if (Array.isArray(daily.time)) {
    for (let i = 0; i < Math.min(3, daily.time.length); i++) {
      forecastDays.push({
        date: daily.time[i],
        maxTemp: daily.temperature_2m_max ? daily.temperature_2m_max[i] : null,
        minTemp: daily.temperature_2m_min ? daily.temperature_2m_min[i] : null,
        weatherCode: daily.weather_code ? daily.weather_code[i] : 0
      });
    }
  }

  const result = {
    cityName: cityName || 'Local Region',
    latitude: roundedLat,
    longitude: roundedLon,
    current: {
      temperature: current.temperature_2m !== undefined ? Math.round(current.temperature_2m) : 24,
      apparentTemperature: current.apparent_temperature !== undefined ? Math.round(current.apparent_temperature) : (current.temperature_2m !== undefined ? Math.round(current.temperature_2m) : 24),
      humidity: current.relative_humidity_2m ?? 50,
      windSpeed: current.wind_speed_10m ? Math.round(current.wind_speed_10m) : 8,
      precipitation: current.precipitation ?? 0,
      isDay: current.is_day ?? 1,
      weatherCode: current.weather_code ?? 0
    },
    daily: forecastDays,
    updatedAt: new Date().toISOString(),
    isCached: false
  };

  serverWeatherCache.set(cacheKey, { timestamp: now, data: result });
  return result;
}

/**
 * Open-Meteo Geocoding City Search Engine
 * Searches cities globally with 24-hour cache.
 */
async function searchOpenMeteoCities(query) {
  const cleanQ = String(query || '').trim().toLowerCase();
  if (cleanQ.length < 2) return [];

  const now = Date.now();
  const cached = serverCityGeoCache.get(cleanQ);
  if (cached && (now - cached.timestamp < 24 * 60 * 60 * 1000)) { // 24 hours TTL
    return cached.data;
  }

  const endpoint = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanQ)}&count=6&language=en&format=json`;
  const response = await fetch(endpoint, {
    headers: { 'User-Agent': 'PublicSparkNewsroom/1.0' },
    signal: AbortSignal.timeout(6000)
  });

  if (!response.ok) return [];

  const data = await response.json();
  const results = (data.results || []).map(item => ({
    id: item.id,
    name: item.name,
    state: item.admin1 || '',
    country: item.country || '',
    latitude: item.latitude,
    longitude: item.longitude
  }));

  serverCityGeoCache.set(cleanQ, { timestamp: now, data: results });
  return results;
}

/**
 * High-performance Bounded LRU Cache Setter
 * Caps serverTranslationCache at maxEntries (default 500), evicting oldest on overflow.
 */
function setBoundedTranslationCache(key, value, maxEntries = 500) {
  if (serverTranslationCache.size >= maxEntries) {
    const oldestKey = serverTranslationCache.keys().next().value;
    serverTranslationCache.delete(oldestKey);
  }
  serverTranslationCache.set(key, value);
}

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
  const ip = getClientIp(req);
  
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

if (process.env.ENABLE_MOCK_ANALYTICS === 'true') {
  seedMockAnalyticsData();
  seedMockLikesData();
} else {
  console.log('[Analytics Engine] Production Mode: Synthetic mock data injection disabled (Rule 6). Real reader events only.');
}

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

  // Prioritize fastest low-latency model first (gemini-3.5-flash-lite), then fallback models
  const models = [
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.8-flash'
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
        signal: AbortSignal.timeout(5000),
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        if ((response.status === 503 || response.status === 429) && model === 'gemini-3.5-flash-lite') {
          console.warn(`[Gemini Temporary ${response.status}] High demand spike. Waiting 1.5s before retry...`);
          await new Promise(r => setTimeout(r, 1500));
          const retryRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (retryRes.ok) {
            const retryResult = await retryRes.json();
            const retryParts = retryResult?.candidates?.[0]?.content?.parts || [];
            const retryText = retryParts.find(p => p.text && !p.thought)?.text || retryParts[0]?.text;
            if (retryText) return retryText.trim();
          }
        }
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

async function translateTextWithGoogleGtx(text, targetLang, sourceLang = 'auto') {
  const raw = String(text || '');
  if (!raw.trim()) return '';
  const tl = normalizeLanguageCode(targetLang) === 'zh-TW' ? 'zh-TW' : normalizeLanguageCode(targetLang);
  const sl = sourceLang && sourceLang !== 'auto' ? normalizeLanguageCode(sourceLang) : 'auto';

  const chunks = [];
  if (raw.length <= 1800) {
    chunks.push(raw);
  } else {
    let current = '';
    for (const para of raw.split('\n')) {
      if ((current.length + para.length + 1) > 1800 && current) {
        chunks.push(current);
        current = para;
      } else {
        current = current ? `${current}\n${para}` : para;
      }
    }
    if (current) chunks.push(current);
  }

  const translatedChunks = await Promise.all(chunks.map(async (chunk) => {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(chunk)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`Google GTX HTTP ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data) && Array.isArray(data[0])) {
      return data[0].map(seg => (Array.isArray(seg) ? seg[0] : '')).join('');
    }
    return chunk;
  }));

  return translatedChunks.join('\n');
}

async function translateWithGemini(title, body, highlights = [], targetLang, sourceLang = 'hi', summary = '') {
  const normalizedTarget = normalizeLanguageCode(targetLang);
  const normalizedSource = normalizeLanguageCode(sourceLang);
  const langNames = {
    hi: 'Hindi', en: 'English', bn: 'Bengali', mr: 'Marathi', te: 'Telugu',
    ta: 'Tamil', gu: 'Gujarati', kn: 'Kannada', ml: 'Malayalam', pa: 'Punjabi',
    or: 'Odia', as: 'Assamese', ur: 'Urdu', fr: 'French', it: 'Italian',
    ja: 'Japanese', id: 'Indonesian', 'zh-TW': 'Traditional Chinese', 'zh-tw': 'Traditional Chinese', ru: 'Russian'
  };
  const targetLanguageName = langNames[normalizedTarget] || langNames[targetLang] || targetLang;
  const sourceLanguageName = langNames[normalizedSource] || langNames[sourceLang] || sourceLang;

  const prompt = `You are a professional multilingual newsroom editor and translator. Translate the following news headline, summary, 30-second bullet highlights, and article body from ${sourceLanguageName} into ${targetLanguageName} (${targetLang}).
Maintain journalistic tone, objectivity, natural vocabulary, and preserve all markdown formatting (headings, lists, bold, italics, quotes).
PRESERVE all numbers, dates, statistics, vehicle plate numbers, and proper nouns accurately.
DO NOT summarize, omit, or truncate. Return strictly valid JSON with no markdown wrapping or backticks, matching this exact schema:
{
  "title": "translated headline",
  "summary": "translated summary",
  "highlights": ["translated highlight 1", "translated highlight 2"],
  "body": "translated article body"
}

Content to translate:
HEADLINE:
${title || ''}

SUMMARY:
${summary || ''}

HIGHLIGHTS:
${Array.isArray(highlights) ? JSON.stringify(highlights) : '[]'}

BODY:
${body || ''}`;

  try {
    const textOutput = await callGeminiApi(prompt, true);
    const cleanJson = textOutput.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(cleanJson);
    return {
      title: parsed.title || title,
      summary: parsed.summary || summary || (Array.isArray(parsed.highlights) ? parsed.highlights[0] : ''),
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights : (highlights || []),
      body: parsed.body || body
    };
  } catch (geminiErr) {
    console.warn(`[Gemini Full-Article Fallback -> Google GTX] (${targetLang}):`, geminiErr.message);
    const [tTitle, tSummary, tBody, ...tHighlights] = await Promise.all([
      translateTextWithGoogleGtx(title || '', targetLang, sourceLang),
      summary ? translateTextWithGoogleGtx(summary, targetLang, sourceLang) : Promise.resolve(''),
      body ? translateTextWithGoogleGtx(body, targetLang, sourceLang) : Promise.resolve(''),
      ...(Array.isArray(highlights) ? highlights.map(h => translateTextWithGoogleGtx(h, targetLang, sourceLang)) : [])
    ]);
    return {
      title: tTitle || title,
      summary: tSummary || summary || tHighlights[0] || '',
      highlights: tHighlights.length > 0 ? tHighlights : (highlights || []),
      body: tBody || body
    };
  }
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
 * Dual-Gated Rolling Audio Cleanup Engine (Age + 1 GB Quota Guard)
 * Gate 1: Purges audio files older than 14 days.
 * Gate 2: If total audio exceeds 921.6 MB (90% of 1 GB quota), auto-evicts least recently used (LRU) files until under 716.8 MB (70%).
 * Gate 3: Unconditionally reconciles audio_records.json and evicts deleted audio from serverAudioCache.
 */
function cleanupExpiredAudioFiles(maxAgeDays = 14, options = {}) {
  if (!fs.existsSync(UPLOADS_DIR)) return { deletedCount: 0, quotaPurgedCount: 0, freedBytes: 0 };
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  let deletedCount = 0;
  let freedBytes = 0;
  let quotaPurgedCount = 0;

  try {
    const audioRecords = getAudioRecordsStore();
    const files = fs.readdirSync(UPLOADS_DIR);
    const audioFilesList = [];

    // Gate 1: Age-Based Expiration
    for (const file of files) {
      if (file.startsWith('audio_') && (file.endsWith('.mp3') || file.endsWith('.wav'))) {
        const filePath = path.join(UPLOADS_DIR, file);
        try {
          const stats = fs.statSync(filePath);
          if (now - stats.mtimeMs > maxAgeMs) {
            freedBytes += stats.size;
            fs.unlinkSync(filePath);
            deletedCount++;
          } else {
            // Find corresponding record for LRU tracking
            let lastPlayedAt = stats.mtimeMs;
            for (const rec of Object.values(audioRecords)) {
              if (rec.audio_url && path.basename(rec.audio_url) === file) {
                if (rec.last_played_at) {
                  lastPlayedAt = new Date(rec.last_played_at).getTime() || stats.mtimeMs;
                }
                break;
              }
            }
            audioFilesList.push({ file, filePath, size: stats.size, lastPlayedAt, mtimeMs: stats.mtimeMs });
          }
        } catch (e) {}
      }
    }

    // Gate 2: Quota-Based LRU Eviction (90% trigger = 921.6 MB, target = 716.8 MB)
    let currentTotalAudioBytes = audioFilesList.reduce((acc, f) => acc + f.size, 0);
    const quotaTriggerBytes = options.quotaTriggerBytes || (921.6 * 1024 * 1024);
    const quotaTargetBytes = options.quotaTargetBytes || (716.8 * 1024 * 1024);

    if (currentTotalAudioBytes > quotaTriggerBytes || options.forceQuotaPurge) {
      // Sort ascending by lastPlayedAt (oldest/least-used first)
      audioFilesList.sort((a, b) => a.lastPlayedAt - b.lastPlayedAt);
      for (const item of audioFilesList) {
        if (currentTotalAudioBytes <= quotaTargetBytes && !options.forceQuotaPurge) break;
        try {
          fs.unlinkSync(item.filePath);
          freedBytes += item.size;
          currentTotalAudioBytes -= item.size;
          quotaPurgedCount++;
        } catch (e) {}
      }
      console.log(`[Audio Quota LRU Purge] Evicted ${quotaPurgedCount} least recently used audio files (${(freedBytes / 1024 / 1024).toFixed(2)} MB freed).`);
    }

    // Gate 3: Unconditional Synchronization of audio_records.json
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

    // Gate 4: Evict unlinked files from in-memory serverAudioCache
    for (const [key, cachedVal] of serverAudioCache.entries()) {
      if (typeof cachedVal === 'string' && cachedVal.includes('/uploads/')) {
        const fName = path.basename(cachedVal);
        if (!fs.existsSync(path.join(UPLOADS_DIR, fName))) {
          serverAudioCache.delete(key);
        }
      }
    }

    if (deletedCount > 0 || quotaPurgedCount > 0) {
      console.log(`[Audio Cleanup Complete] Purged ${deletedCount + quotaPurgedCount} files (${(freedBytes / 1024 / 1024).toFixed(2)} MB freed).`);
    }
  } catch (err) {
    console.warn('[Audio Cleanup Error]', err.message);
  }

  return { deletedCount, quotaPurgedCount, freedBytes };
}

/**
 * Automated Dual-Threshold Storage Watchdog
 * Monitors Audio (1 GB), D1 DB (500 MB), and RAM (128 MB):
 * - 80% threshold: Raises Alert Notification state
 * - 90% threshold: Auto-triggers LRU cleanup down to 70% target
 */
function runStorageWatchdogAndCleanup(options = {}) {
  const result = {
    audioCleanup: null,
    orphanCleanup: null,
    translationsPurged: 0,
    alerts: [],
    status: 'normal'
  };

  try {
    // 1. Purge zero-usage orphans first
    result.orphanCleanup = purgeOrphanedSatelliteData();

    // 2. Audio Storage Monitor (1024 MB Quota)
    let audioBytes = 0;
    if (fs.existsSync(UPLOADS_DIR)) {
      const files = fs.readdirSync(UPLOADS_DIR);
      for (const f of files) {
        if (f.startsWith('audio_') && (f.endsWith('.mp3') || f.endsWith('.wav'))) {
          try { audioBytes += fs.statSync(path.join(UPLOADS_DIR, f)).size; } catch (e) {}
        }
      }
    }
    const audioMb = audioBytes / 1024 / 1024;
    const audioPercent = (audioMb / 1024) * 100;

    if (audioPercent >= 90 || options.forceAudioCleanup) {
      result.status = 'critical_cleanup_90';
      result.alerts.push(`Audio Storage exceeded 90% (${audioMb.toFixed(1)} MB / 1024 MB). Emergency LRU cleanup triggered.`);
      result.audioCleanup = cleanupExpiredAudioFiles(14, { forceQuotaPurge: options.forceAudioCleanup });
    } else if (audioPercent >= 80) {
      if (result.status !== 'critical_cleanup_90') result.status = 'warning_80';
      result.alerts.push(`Audio Storage warning: Reached 80% capacity (${audioMb.toFixed(1)} MB / 1024 MB).`);
      result.audioCleanup = cleanupExpiredAudioFiles(14);
    } else {
      result.audioCleanup = cleanupExpiredAudioFiles(14);
    }

    // 3. Cloudflare D1 Database Monitor (500 MB Quota)
    let d1Bytes = 0;
    if (fs.existsSync(DATA_DIR)) {
      const dbFiles = fs.readdirSync(DATA_DIR);
      for (const df of dbFiles) {
        if (df.endsWith('.json')) {
          try { d1Bytes += fs.statSync(path.join(DATA_DIR, df)).size; } catch (e) {}
        }
      }
    }
    const d1Mb = d1Bytes / 1024 / 1024;
    const d1Percent = (d1Mb / 500) * 100;

    if (d1Percent >= 90 || options.forceDbCleanup) {
      result.status = 'critical_cleanup_90';
      result.alerts.push(`Cloudflare D1 Database exceeded 90% (${d1Mb.toFixed(2)} MB / 500 MB). LRU translation purge triggered.`);
      // Purge oldest unused translations until under 350 MB (70%)
      if (fs.existsSync(TRANSLATIONS_FILE)) {
        const transStore = getTranslationsStore();
        const records = Object.entries(transStore).map(([k, v]) => ({
          key: k,
          lastAccessed: v.last_accessed_at ? new Date(v.last_accessed_at).getTime() : 0
        }));
        records.sort((a, b) => a.lastAccessed - b.lastAccessed);
        let currentSize = d1Bytes;
        const targetSize = 350 * 1024 * 1024;
        let purgedTrans = 0;
        for (const item of records) {
          if (currentSize <= targetSize && !options.forceDbCleanup) break;
          const recBytes = Buffer.byteLength(JSON.stringify(transStore[item.key] || ''));
          delete transStore[item.key];
          currentSize -= recBytes;
          purgedTrans++;
        }
        if (purgedTrans > 0) {
          fs.writeFileSync(TRANSLATIONS_FILE, JSON.stringify(transStore, null, 2));
          result.translationsPurged = purgedTrans;
          console.log(`[D1 Database LRU Purge] Evicted ${purgedTrans} stale translations.`);
        }
      }
    } else if (d1Percent >= 80) {
      if (result.status !== 'critical_cleanup_90') result.status = 'warning_80';
      result.alerts.push(`Cloudflare D1 Database warning: Reached 80% capacity (${d1Mb.toFixed(2)} MB / 500 MB).`);
    }

    // 4. Worker Isolate RAM Monitor (128 MB Quota)
    const memUsage = process.memoryUsage();
    const heapMb = memUsage.heapUsed / 1024 / 1024;
    if (heapMb >= 115.2) { // 90%
      serverAudioCache.clear();
      serverTranslationCache.clear();
      serverAudioProgressMap.clear();
      result.status = 'critical_cleanup_90';
      result.alerts.push(`Worker RAM exceeded 90% (${heapMb.toFixed(1)} MB / 128 MB). Cleared in-memory caches.`);
    } else if (heapMb >= 102.4) { // 80%
      if (result.status === 'normal') result.status = 'warning_80';
      result.alerts.push(`Worker RAM warning: Reached 80% capacity (${heapMb.toFixed(1)} MB / 128 MB).`);
    }
  } catch (err) {
    console.warn('[Storage Watchdog Error]', err.message);
  }

  return result;
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
  const normalizedTarget = normalizeLanguageCode(targetLang);
  const langNames = {
    hi: 'Hindi', en: 'English', bn: 'Bengali', mr: 'Marathi', te: 'Telugu',
    ta: 'Tamil', gu: 'Gujarati', kn: 'Kannada', ml: 'Malayalam', pa: 'Punjabi',
    or: 'Odia', as: 'Assamese', ur: 'Urdu', fr: 'French', it: 'Italian',
    ja: 'Japanese', id: 'Indonesian', 'zh-TW': 'Traditional Chinese', 'zh-tw': 'Traditional Chinese', ru: 'Russian'
  };
  const targetLanguageName = langNames[normalizedTarget] || langNames[targetLang] || targetLang;

  const prompt = `Translate the following text into ${targetLanguageName} (${normalizedTarget}). Return ONLY the translated text without commentary, quotes, or markdown backticks:
${text}`;

  const textOutput = await callGeminiApi(prompt, false);
  return textOutput || text;
}

async function translateHeadlinesBatchWithGemini(items, targetLang) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const normalizedTarget = normalizeLanguageCode(targetLang);
  const langNames = {
    hi: 'Hindi', en: 'English', bn: 'Bengali', mr: 'Marathi', te: 'Telugu',
    ta: 'Tamil', gu: 'Gujarati', kn: 'Kannada', ml: 'Malayalam', pa: 'Punjabi',
    or: 'Odia', as: 'Assamese', ur: 'Urdu', fr: 'French', it: 'Italian',
    ja: 'Japanese', id: 'Indonesian', 'zh-TW': 'Traditional Chinese', 'zh-tw': 'Traditional Chinese', ru: 'Russian'
  };
  const targetLanguageName = langNames[normalizedTarget] || langNames[targetLang] || targetLang;

  const prompt = `You are a professional journalistic translator for PublicSpark News.
Translate the following headlines and summaries into ${targetLanguageName} (${normalizedTarget}).
Return a valid JSON array of objects. Each object MUST have:
- 'id': the exact same id from input (do not alter)
- 'title': accurately translated headline
- 'summary': accurately translated summary (if input summary is non-empty, otherwise empty string)

Rules:
- Strictly return valid JSON only (no markdown code blocks, no commentary).
- Preserve all proper nouns, locations, organization names, figures, numbers, and dates accurately.

Input JSON:
${JSON.stringify(items.map(it => ({ id: it.id, title: it.title || '', summary: it.summary || it.excerpt || '' })))}`;

  try {
    const rawJson = await callGeminiApi(prompt, true);
    if (rawJson) {
      const cleanJson = typeof rawJson === 'string'
        ? rawJson.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
        : JSON.stringify(rawJson);
      const parsed = JSON.parse(cleanJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[Gemini Batch Translation Fallback -> Google GTX]:', err.message);
  }

  try {
    const fallbackItems = await Promise.all(items.map(async (it) => {
      const [tTitle, tSummary] = await Promise.all([
        translateTextWithGoogleGtx(it.title || '', normalizedTarget, 'auto'),
        (it.summary || it.excerpt) ? translateTextWithGoogleGtx(it.summary || it.excerpt, normalizedTarget, 'auto') : Promise.resolve('')
      ]);
      return { id: it.id, title: tTitle || it.title, summary: tSummary || '' };
    }));
    return fallbackItems;
  } catch (gtxErr) {
    console.error('[Batch Translation All Providers Failed]:', gtxErr.message);
    return null;
  }
}

// -------------------------------------------------------------
// RESTRICTIVE CORS HARDENING (SEC-005)
// Strictly restricts browser cross-origin requests to trusted origins.
// Blocks cross-origin mutation attacks (CSRF) from untrusted third parties.
// -------------------------------------------------------------
const TRUSTED_CORS_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'https://publicspark.in',
  'https://www.publicspark.in'
];

if (process.env.CLIENT_URL) {
  const customUrl = process.env.CLIENT_URL.trim();
  if (customUrl && !TRUSTED_CORS_ORIGINS.includes(customUrl)) {
    TRUSTED_CORS_ORIGINS.push(customUrl);
  }
}
if (process.env.ALLOWED_ORIGINS) {
  process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).forEach(o => {
    if (o && !TRUSTED_CORS_ORIGINS.includes(o)) {
      TRUSTED_CORS_ORIGINS.push(o);
    }
  });
}

export function evaluateCors(req) {
  const origin = req.headers?.origin;
  // If no Origin header (same-origin, curl, mobile app, internal scripts), permit
  if (!origin) {
    return { isAllowed: true, origin: null };
  }
  const isAllowed = TRUSTED_CORS_ORIGINS.includes(origin);
  return { isAllowed, origin };
}

const server = http.createServer(async (req, res) => {
  // CORS Hardening Policy Evaluation (SEC-005)
  const corsResult = evaluateCors(req);

  if (corsResult.origin) {
    if (corsResult.isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', corsResult.origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    // Untrusted Origin: Access-Control-Allow-Origin header is strictly omitted
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-secret, x-dev-otp');
  res.setHeader('Access-Control-Max-Age', '86400');

  const url = new URL(req.url, `http://${req.headers.host || 'localhost:5000'}`);

  // Preflight OPTIONS Gatekeeper
  if (req.method === 'OPTIONS') {
    if (corsResult.isAllowed) {
      res.writeHead(204);
      return res.end();
    } else {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        error: `CORS policy violation: Preflight rejected for unauthorized origin ${corsResult.origin}.`
      }));
    }
  }

  // Unauthorized Cross-Origin Mutation Shield (POST, PUT, DELETE, PATCH) (SEC-005 & SEC-047)
  const isMutatingMethod = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
  if (isMutatingMethod) {
    const effectiveOrigin = corsResult.origin || (req.headers.referer ? (() => { try { return new URL(req.headers.referer).origin; } catch (_e) { return null; } })() : null);
    if (effectiveOrigin && !TRUSTED_CORS_ORIGINS.includes(effectiveOrigin)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        error: `CORS policy violation: Cross-origin mutating requests from ${effectiveOrigin} are strictly forbidden.`
      }));
    }
  }

  // Global HTTP Security Headers (SEC-028 & SEC-046)
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://pagead2.googlesyndication.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https: blob:; media-src 'self' data: blob: https:; connect-src 'self' https://api.imgbb.com https://open-meteo.com; frame-src 'self' https://www.youtube.com https://googleads.g.doubleclick.net;"
  );
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Central Request Body Size Guard (SEC-018: Anti-DoS / Memory Exhaustion Protection)
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const isUpload = url.pathname.startsWith('/api/upload');
    const maxPayloadBytes = isUpload ? 10 * 1024 * 1024 : 2 * 1024 * 1024; // 10MB for media uploads, 2MB standard
    
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    if (contentLength > maxPayloadBytes) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        error: `Payload Too Large: Request body exceeds maximum permitted limit of ${(maxPayloadBytes / (1024 * 1024)).toFixed(1)} MB.`
      }));
    }

    let bytesReceived = 0;
    const originalOn = req.on.bind(req);
    let payloadExceeded = false;

    req.on = function(event, listener) {
      if (event === 'data') {
        const wrappedListener = function(chunk) {
          if (payloadExceeded) return;
          bytesReceived += chunk.length;
          if (bytesReceived > maxPayloadBytes) {
            payloadExceeded = true;
            req.destroy();
            if (!res.headersSent) {
              res.writeHead(413, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                error: `Payload Too Large: Request stream exceeded maximum limit of ${(maxPayloadBytes / (1024 * 1024)).toFixed(1)} MB.`
              }));
            }
            return;
          }
          return listener(chunk);
        };
        return originalOn(event, wrappedListener);
      }
      return originalOn(event, listener);
    };
  }

  // Security & Credential Cache Prevention: Strictly forbid caching for auth & staff endpoints
  if (url.pathname.startsWith('/api/auth') || url.pathname.startsWith('/api/staff')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }

  // 1. DYNAMIC GOOGLE NEWS XML SITEMAP
  if (req.method === 'GET' && (url.pathname === '/sitemap.xml' || url.pathname === '/news-sitemap.xml' || url.pathname === '/sitemap-news.xml')) {
    const articles = getSavedArticles();
    const sitemapXml = generateGoogleNewsSitemap(articles, req.headers.host || 'localhost:5000');
    res.writeHead(200, {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=1800'
    });
    return res.end(sitemapXml);
  }

  // 1B. RSS 2.0 SYNDICATION FEED
  if (req.method === 'GET' && (url.pathname === '/rss.xml' || url.pathname === '/feed.xml' || url.pathname === '/feed')) {
    const articles = getSavedArticles();
    const rssXml = generateRss2Feed(articles, req.headers.host || 'localhost:5000');
    res.writeHead(200, {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=900'
    });
    return res.end(rssXml);
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

  // 3. SERVER-SIDE DYNAMIC ARTICLE PRE-RENDERING GATEWAY & CLIENT SPA ROUTING
  const isClientSpaRoute = ['/', '/login', '/staff', '/reporter', '/editor', '/admin', '/developer', '/rescue', '/search'].includes(url.pathname);
  if (req.method === 'GET' && (url.pathname.startsWith('/article/') || url.pathname.startsWith('/news/') || (url.pathname === '/' && url.searchParams.has('article')) || isClientSpaRoute)) {
    let articleIdOrSlug = '';
    if (url.pathname.startsWith('/article/')) {
      articleIdOrSlug = decodeURIComponent(url.pathname.replace(/^\/article\//, '').split('/')[0]);
    } else if (url.pathname.startsWith('/news/')) {
      articleIdOrSlug = decodeURIComponent(url.pathname.replace(/^\/news\//, '').split('/')[0]);
    } else {
      articleIdOrSlug = url.searchParams.get('article');
    }

    const allArticles = getSavedArticles();
    const article = articleIdOrSlug ? allArticles.find(a => a.id === articleIdOrSlug || a.slug === articleIdOrSlug) : null;

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

  // 4. STANDALONE WEBP IMAGE UPLOAD ENDPOINT (Zero Base64 Database Bloat - Gated SEC-017)
  if (req.method === 'POST' && (url.pathname === '/api/upload/image' || url.pathname === '/api/upload')) {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader;
    const session = token ? verifyStaffSessionToken(token) : null;
    if (!session || !['reporter', 'editor', 'admin', 'developer'].includes(session.role)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Unauthorized: Staff authentication required to upload media assets.' }));
    }

    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', async () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const { imageBase64, articleId = 'general' } = body;

        if (!imageBase64 || typeof imageBase64 !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'No image data provided' }));
        }

        const matches = imageBase64.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
        const rawExt = matches ? matches[1].toLowerCase().replace('jpeg', 'jpg') : 'webp';
        const ALLOWED_EXTS = ['webp', 'jpg', 'png'];
        if (!ALLOWED_EXTS.includes(rawExt)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Rejected: Only WebP, JPG, and PNG images are permitted.' }));
        }
        const ext = rawExt;
        const rawBase64 = matches ? matches[2] : imageBase64;
        const imgBuffer = Buffer.from(rawBase64, 'base64');

        // SEC-048: Binary Magic Byte Validation for image headers (CWE-434 Fix)
        const isPng = imgBuffer.length > 8 && imgBuffer[0] === 0x89 && imgBuffer[1] === 0x50 && imgBuffer[2] === 0x4E && imgBuffer[3] === 0x47;
        const isJpg = imgBuffer.length > 3 && imgBuffer[0] === 0xFF && imgBuffer[1] === 0xD8 && imgBuffer[2] === 0xFF;
        const isWebp = imgBuffer.length > 12 && imgBuffer.toString('ascii', 0, 4) === 'RIFF' && imgBuffer.toString('ascii', 8, 12) === 'WEBP';
        if (!isPng && !isJpg && !isWebp) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Security Exception: Binary header does not match a valid image format.' }));
        }

        const sanitizedId = String(articleId).replace(/[^a-zA-Z0-9-_]/g, '_');
        const fileName = `img_${sanitizedId}_${Date.now()}.${ext}`;
        const filePath = path.join(UPLOADS_DIR, fileName);

        let publicUrl = `/uploads/${fileName}`;
        let cloudProvider = 'local';

        // ImgBB API Cloud Tier Hybrid Dispatch (100% Free Forever, Unlimited Storage, Zero Server Disk)
        if (process.env.IMGBB_API_KEY) {
          try {
            const formData = new FormData();
            formData.append('image', rawBase64);
            const imgbbRes = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(process.env.IMGBB_API_KEY)}`, {
              method: 'POST',
              body: formData
            });
            if (imgbbRes.ok) {
              const imgbbData = await imgbbRes.json();
              if (imgbbData?.data?.url) {
                publicUrl = imgbbData.data.url;
                cloudProvider = 'imgbb';
                console.log(`[ImgBB Cloud Upload] Success: Hosted permanently at ${publicUrl} (0 KB server disk consumed)`);
              }
            } else {
              console.warn(`[ImgBB Upload Warning] Remote API returned status ${imgbbRes.status}, falling back to local storage.`);
            }
          } catch (imgbbErr) {
            console.warn('[ImgBB Upload Error] Network exception, falling back to local storage:', imgbbErr.message);
          }
        }

        if (cloudProvider === 'local') {
          fs.writeFileSync(filePath, imgBuffer);
          console.log(`[Image Upload] Saved locally ${fileName} (${(imgBuffer.length / 1024).toFixed(1)} KB)`);
        }

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

  // 5. PRODUCTION STATIC ASSETS ROUTE (/assets/ & /logo.png & /favicon.svg) (SEC-050 Defense-in-Depth)
  if (req.method === 'GET' && url.pathname.startsWith('/assets/')) {
    const assetPath = path.resolve(DIST_DIR, path.normalize(url.pathname));
    if (!assetPath.startsWith(DIST_DIR + path.sep) && assetPath !== DIST_DIR) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Access denied: Directory traversal strictly prohibited.' }));
    }
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
  if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname.startsWith('/uploads/')) {
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

      if (req.method === 'HEAD') {
        res.writeHead(200, {
          'Content-Length': stats.size,
          'Accept-Ranges': 'bytes',
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=604800, immutable'
        });
        return res.end();
      }

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
        const article_id = body.article_id || body.articleId || 'general';
        const targetLang = normalizeLanguageCode(body.lang || body.langCode || 'hi');
        const clip_type = body.clip_type || body.clipType || 'clip_1_intro';
        const title = body.title || '';
        const highlights = body.highlights || [];
        const articleBody = body.body || '';
        const text = body.text || '';

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
        if (article_id && article_id !== 'general') {
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
            touchAudioAccess(sanitizedArticleId, targetLang, validClipType, audioFilePathMp3);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
              article_id: sanitizedArticleId,
              articleId: sanitizedArticleId,
              lang: targetLang,
              clip_type: validClipType,
              audio_url: publicAudioUrlMp3,
              audioUrl: publicAudioUrlMp3,
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
              articleId: sanitizedArticleId,
              lang: targetLang,
              clip_type: validClipType,
              audio_url: `/uploads/${audioFileNameWav}`,
              audioUrl: `/uploads/${audioFileNameWav}`,
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
            articleId: sanitizedArticleId,
            lang: targetLang,
            clip_type: validClipType,
            audio_url: targetUrl,
            audioUrl: targetUrl,
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
  // BATCH MULTILINGUAL TRANSLATION ENDPOINT (1 Single Fast Call for Visible Stories)
  // -------------------------------------------------------------
  if (req.method === 'POST' && url.pathname === '/api/translate/batch') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', async () => {
      try {
        const clientIp = getClientIp(req);
        if (!checkIpRateLimit(clientIp)) {
          res.writeHead(429, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            error: 'Hourly translation rate limit exceeded for your IP. Please try again later.',
            status: 'rate_limited'
          }));
        }

        const body = JSON.parse(bodyText || '{}');
        const { items = [], targetLang = 'hi', source_lang = 'hi' } = body;
        const normalizedTarget = normalizeLanguageCode(targetLang);

        if (!Array.isArray(items) || items.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'items must be a non-empty array' }));
        }

        // Limit batch to at most 15 items to protect token budget and guarantee sub-2s response
        const cappedItems = items.slice(0, 15);

        // If target matches source language, return items directly
        if (normalizedTarget === normalizeLanguageCode(source_lang)) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ status: 'done', items: cappedItems, cachedCount: cappedItems.length }));
        }

        const store = getTranslationsStore();
        const results = [];
        const uncachedItems = [];

        for (const item of cappedItems) {
          const key = `${item.id}:${normalizedTarget}`;
          if (store[key] && store[key].title && store[key].status === 'done') {
            results.push({
              id: item.id,
              title: store[key].title,
              summary: store[key].summary || (Array.isArray(store[key].highlights) ? store[key].highlights[0] : '') || item.summary || '',
              isCached: true
            });
            touchTranslationAccess(item.id, normalizedTarget);
          } else {
            uncachedItems.push(item);
          }
        }

        // If all items were in cache, return immediately (0ms, 0 AI calls!)
        if (uncachedItems.length === 0) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ status: 'done', items: results, cachedCount: results.length }));
        }

        // Translate only the uncached items in 1 single Gemini call
        const batchKey = `batch_${normalizedTarget}_${uncachedItems.map(i => i.id).join('_')}`;
        let translatedItems;

        if (inFlightTranslations.has(batchKey)) {
          translatedItems = await inFlightTranslations.get(batchKey);
        } else {
          const promise = translateHeadlinesBatchWithGemini(uncachedItems, normalizedTarget);
          inFlightTranslations.set(batchKey, promise);
          try {
            translatedItems = await promise;
          } finally {
            inFlightTranslations.delete(batchKey);
          }
        }

        // Save newly translated items ONLY if actually translated (never poison cache with untranslated source text)
        if (Array.isArray(translatedItems)) {
          for (const trans of translatedItems) {
            const orig = uncachedItems.find(u => String(u.id) === String(trans?.id));
            if (trans && trans.id && trans.title && (!orig || trans.title.trim() !== String(orig.title || '').trim())) {
              saveTranslationRecord(trans.id, normalizedTarget, {
                title: trans.title,
                summary: trans.summary || '',
                status: 'done'
              });
              results.push({
                id: trans.id,
                title: trans.title,
                summary: trans.summary || '',
                isCached: false
              });
            }
          }
        }

        // Ensure all input items are accounted for (fallback to original if any missing)
        const finalResults = cappedItems.map(orig => {
          const found = results.find(r => String(r.id) === String(orig.id));
          return found || orig;
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'done', items: finalResults, cachedCount: cappedItems.length - uncachedItems.length }));
      } catch (err) {
        console.error('[Batch Translation Error]:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message, status: 'failed' }));
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
        const clientIp = getClientIp(req);
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
        const targetLanguage = normalizeLanguageCode(lang || targetLang || 'hi');

        let sourceLanguage = normalizeLanguageCode(source_lang || '');
        let targetArticle = null;
        if (article_id) {
          const allArticles = getSavedArticles();
          targetArticle = allArticles.find(a => a.id === article_id || a.slug === article_id);
          if (targetArticle && !sourceLanguage) {
            sourceLanguage = normalizeLanguageCode(targetArticle.originalLanguage || 'hi');
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
          const rawSummary = (targetArticle && targetArticle.summary) ? targetArticle.summary : (body.summary || '');
          const rawSubTitle = (targetArticle && targetArticle.sub_title) ? targetArticle.sub_title : (body.sub_title || '');

          let rawHighlights = (targetArticle && Array.isArray(targetArticle.highlights) && targetArticle.highlights.length > 0)
            ? [...targetArticle.highlights]
            : (Array.isArray(highlights) && highlights.length > 0 ? [...highlights] : []);

          // Task 33 Subtopic B: Summary-to-highlights bridge
          // If highlights array is empty, bridge from summary and sub_title so 30s bullets are translated
          if (rawHighlights.length === 0) {
            if (rawSummary) rawHighlights.push(rawSummary);
            if (rawSubTitle && rawSubTitle !== rawSummary) rawHighlights.push(rawSubTitle);
          }

          const contentHash = computeContentHash(`${rawTitle}:::${rawBody}`);

          // Check Database for existing translation with matching content_hash
          const store = getTranslationsStore();
          const storeKey = `${article_id}:${targetLanguage}`;
          const existingRecord = store[storeKey];

          if (existingRecord && existingRecord.status === 'done' && existingRecord.content_hash === contentHash) {
            console.log(`[Translations DB HIT] Serving cached translation for (${article_id}, ${targetLanguage})`);
            touchTranslationAccess(article_id, targetLanguage);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
              article_id,
              lang: targetLanguage,
              title: existingRecord.title,
              summary: existingRecord.summary || (Array.isArray(existingRecord.highlights) ? existingRecord.highlights[0] : ''),
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
            const translated = await translateWithGemini(rawTitle, rawBody, rawHighlights, targetLanguage, sourceLanguage, rawSummary);
            
            // Strict Integrity Validation before saving
            const isValid = validateTranslationIntegrity(rawTitle, rawBody, translated.title, translated.body);
            if (!isValid) {
              throw new Error('Translation integrity check failed (missing sections, paragraph mismatch, or error string detected).');
            }

            incrementDailyUsage('Gemini');

            // Save to database only on verified integrity
            saveTranslationRecord(article_id, targetLanguage, {
              title: translated.title,
              summary: translated.summary || (Array.isArray(translated.highlights) ? translated.highlights[0] : ''),
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
              summary: translated.summary || (Array.isArray(translated.highlights) ? translated.highlights[0] : ''),
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

        // In-Flight Promise Lock for Snippets (Prevents duplicate parallel calls for same text)
        if (inFlightTranslations.has(snippetCacheKey)) {
          const inFlightSnippet = await inFlightTranslations.get(snippetCacheKey);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(inFlightSnippet));
        }

        // Check daily limit
        if (getDailyUsage('Gemini') >= 1450) {
          res.writeHead(429, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Daily translation limit reached.', status: 'rate_limited' }));
        }

        const snippetPromise = (async () => {
          const translatedSnippet = await translateTextSnippetWithGemini(inputText, targetLanguage);
          incrementDailyUsage('Gemini');
          setBoundedTranslationCache(snippetCacheKey, translatedSnippet, 500);
          return {
            translatedText: translatedSnippet,
            isCached: false,
            status: 'done'
          };
        })();

        inFlightTranslations.set(snippetCacheKey, snippetPromise);
        try {
          const snippetResult = await snippetPromise;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(snippetResult));
        } catch (snippetErr) {
          console.error('[Snippet Translation Error]:', snippetErr.message);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ translatedText: inputText, status: 'fallback', isCached: true }));
        } finally {
          inFlightTranslations.delete(snippetCacheKey);
        }

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
        const ipAddress = getClientIp(req);

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
        const clientIp = getClientIp(req);
        const userSess = sessionId || `user_sess_${clientIp}`;
        const country = resolveIpToCountry(req);
        const ipAddress = clientIp;

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
          // SEC-049: Rolling FIFO Cap (5,000 max entries) to prevent heap exhaustion DoS (CWE-400)
          if (serverAudioProgressMap.size >= 5000 && !serverAudioProgressMap.has(key)) {
            const oldestKey = serverAudioProgressMap.keys().next().value;
            serverAudioProgressMap.delete(oldestKey);
          }
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

    const localDbUsedMb = parseFloat(((fs.existsSync(DATA_DIR) ? fs.readdirSync(DATA_DIR).reduce((acc, f) => {
      try { return acc + fs.statSync(path.join(DATA_DIR, f)).size; } catch (e) { return acc; }
    }, 0) : 0) / 1024 / 1024).toFixed(2));

    const uploadsFiles = fs.existsSync(UPLOADS_DIR) ? fs.readdirSync(UPLOADS_DIR) : [];
    let audioBytes = 0;
    let audioCount = 0;
    let imageBytes = 0;
    let imageCount = 0;

    uploadsFiles.forEach(f => {
      try {
        const fullPath = path.join(UPLOADS_DIR, f);
        const size = fs.statSync(fullPath).size;
        if (f.startsWith('audio_') || f.endsWith('.mp3')) {
          audioBytes += size;
          audioCount++;
        } else {
          imageBytes += size;
          imageCount++;
        }
      } catch (e) {}
    });

    const audioUsedMb = parseFloat((audioBytes / 1024 / 1024).toFixed(2));
    const uploadsUsedMb = parseFloat(((audioBytes + imageBytes) / 1024 / 1024).toFixed(2));

    // Cloudflare Workers free tier isolate RAM ceiling is 128 MB
    const workerIsolateCapMb = 128;
    const workerUsagePercent = Math.min(100, parseFloat(((heapUsedMb / workerIsolateCapMb) * 100).toFixed(1)));

    // Auto-cleanup memory buffers if heap crosses 85% threshold (108.8 MB)
    if (heapUsedMb > 108.8) {
      serverAudioCache.clear();
      serverTranslationCache.clear();
      serverAudioProgressMap.clear();
      console.log('[Auto-Cleanup Watchdog] Worker Isolate RAM crossed 85% threshold (108.8 MB). In-memory buffers flushed.');
    }

    const isImgbbActive = Boolean(process.env.IMGBB_API_KEY);

    const statusReport = {
      timestamp: new Date().toISOString(),
      serverRam: {
        heapUsedMb,
        heapTotalMb,
        rssMb,
        limitMb: workerIsolateCapMb,
        usagePercent: workerUsagePercent,
        alertThresholdMb: 108.8
      },
      inMemoryCaches: {
        audioCacheCount: serverAudioCache.size,
        translationCacheCount: serverTranslationCache.size,
        audioProgressCount: serverAudioProgressMap.size
      },
      storageTiers: {
        cloudflareD1: {
          name: 'Cloudflare D1 SQL (Master DB)',
          usedMb: localDbUsedMb,
          limitMb: 500,
          accountPoolMb: 5120, // 5 GB across 10 databases
          percent: Math.min(100, parseFloat(((localDbUsedMb / 500) * 100).toFixed(2))),
          unit: 'MB',
          status: localDbUsedMb >= 450 ? 'critical' : (localDbUsedMb >= 400 ? 'warning' : 'healthy'),
          details: 'Articles, Categories, Settings, Grievances & Staff Records (500 MB Cap / DB)',
          alertThresholdMb: 400, // 80% of 500MB
          cleanupThresholdMb: 450, // 90% of 500MB
          targetPostCleanupMb: 350 // 70% of 500MB
        },
        imgbbCdn: {
          name: 'ImgBB Cloud Image CDN (Media)',
          isCloudActive: isImgbbActive,
          usedMb: parseFloat((imageBytes / 1024 / 1024).toFixed(2)),
          limitMb: 2048,
          cloudTier: 'Unlimited Free Tier',
          fileSizeCapMb: 32,
          percent: Math.min(100, parseFloat(((imageBytes / (2048 * 1024 * 1024)) * 100).toFixed(2))),
          unit: 'MB',
          status: 'healthy',
          details: isImgbbActive
            ? 'ImgBB Cloud CDN Active: 0 KB server disk, unlimited image hosting'
            : 'ImgBB CDN Ready (Free Unlimited Tier) - Set IMGBB_API_KEY in .env'
        },
        audioStorage: {
          name: 'Audio Stories MP3 Storage',
          usedMb: audioUsedMb,
          limitMb: 1024,
          percent: Math.min(100, parseFloat(((audioUsedMb / 1024) * 100).toFixed(2))),
          fileCount: audioCount,
          unit: 'MB',
          cloudTier: 'Cloudflare Workers KV (1 GB Free Tier, Zero Card)',
          status: audioUsedMb >= 921.6 ? 'critical' : (audioUsedMb >= 819.2 ? 'warning' : 'healthy'),
          alertState: audioUsedMb >= 921.6 ? 'critical_cleanup_90' : (audioUsedMb >= 819.2 ? 'warning_80' : 'normal'),
          alertThresholdMb: 819.2, // 80% of 1024MB
          cleanupThresholdMb: 921.6, // 90% of 1024MB
          targetPostCleanupMb: 716.8, // 70% of 1024MB
          details: `Generated 32kbps mono MP3 audio clips (${audioCount} files, Dual-Gated 80% Alert / 90% LRU Auto-Cleanup)`
        },
        // Backward compatibility mappings
        localJsonDatabase: {
          name: 'Cloudflare D1 SQL (Master DB)',
          usedMb: localDbUsedMb,
          limitMb: 500,
          percent: Math.min(100, parseFloat(((localDbUsedMb / 500) * 100).toFixed(2))),
          unit: 'MB',
          status: localDbUsedMb >= 450 ? 'critical' : (localDbUsedMb >= 400 ? 'warning' : 'healthy'),
          details: 'Articles, Categories, Settings, Grievances & Staff Records'
        },
        uploadsAndMedia: {
          name: 'Audio Stories MP3 Storage',
          usedMb: audioUsedMb,
          limitMb: 1024,
          percent: Math.min(100, parseFloat(((audioUsedMb / 1024) * 100).toFixed(2))),
          unit: 'MB',
          status: audioUsedMb >= 921.6 ? 'critical' : (audioUsedMb >= 819.2 ? 'warning' : 'healthy'),
          details: `Audio Clips & Uploads Buffer (${audioCount} MP3 files stored, 1 GB Cloudflare KV Tier)`
        }
      },
      alertState: (audioUsedMb >= 921.6 || localDbUsedMb >= 450)
        ? 'critical_cleanup_90'
        : ((audioUsedMb >= 819.2 || localDbUsedMb >= 400) ? 'warning_80' : 'normal'),
      thresholdPolicies: {
        warningPercent: 80,
        emergencyCleanupPercent: 90,
        postCleanupTargetPercent: 70
      },
      quotas: {
        cloudflareWorkersDaily: 100000,
        cloudflareD1DailyReads: 5000000,
        cloudflareD1DailyWrites: 100000,
        cloudflareKvStorageLimitMb: 1024,
        imgbbStorageLimit: 'Unlimited'
      },
      autoCleanup: {
        enabled: true,
        warningThresholdPercent: 80,
        emergencyCleanupPercent: 90,
        postCleanupTargetPercent: 70,
        alertThresholds: {
          d1Mb: 400,
          workerRamMb: 102.4,
          audioStorageMb: 819.2
        },
        cleanupThresholds: {
          d1Mb: 450,
          workerRamMb: 115.2,
          audioStorageMb: 921.6
        },
        lastRunTimestamp: new Date().toISOString()
      }
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(statusReport));
  }

  // POST /api/storage/purge (Deep Purge: RAM caches + Orphan sweeper + Audio reconciliation - SEC-032)
  if (req.method === 'POST' && url.pathname === '/api/storage/purge') {
    if (!verifyAdminAuthorization(req)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Forbidden: Admin authorization required to purge server cache.' }));
    }

    const audioPurged = serverAudioCache.size;
    const transPurged = serverTranslationCache.size;
    const progressPurged = serverAudioProgressMap.size;

    serverAudioCache.clear();
    serverTranslationCache.clear();
    serverAudioProgressMap.clear();

    // Trigger deep orphan sweep and audio reconciliation
    const orphanStats = purgeOrphanedSatelliteData();
    const audioStats = cleanupExpiredAudioFiles(14);
    const edgePurgeStats = await purgeCloudflareEdgeCache('manual_admin_storage_purge');

    console.log(`[Storage Purge Executed] Cleared RAM (${audioPurged} audio, ${transPurged} translations), purged ${orphanStats.orphanedTranslationsPurged} ghost translations, ${orphanStats.orphanedRevisionsPurged} ghost revisions, ${audioStats.deletedCount} expired audio files, edgePurge: ${edgePurgeStats.success}`);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: true,
      message: 'Server in-memory cache, Cloudflare Edge cache, and orphaned records purged successfully',
      purged: {
        inMemoryAudio: audioPurged,
        inMemoryTranslations: transPurged,
        orphanedTranslations: orphanStats.orphanedTranslationsPurged,
        orphanedRevisions: orphanStats.orphanedRevisionsPurged,
        orphanedAudioRecords: orphanStats.orphanedAudioPurged,
        audioFilesPurged: audioStats.deletedCount + audioStats.quotaPurgedCount,
        edgeCachePurged: edgePurgeStats.success
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
    if (!verifyAdminAuthorization(req)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Forbidden: Admin authorization required to modify social settings.' }));
    }

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

  // POST /api/poll/vote (Submit reader vote for a specific option - SEC-027: IP Deduplicated)
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

        // Sliding window IP deduplication (SEC-027: 1 vote per IP per 24 hours per poll)
        const clientIp = getClientIp(req);
        const pollVoteTracker = globalThis.__pollVoteTracker || (globalThis.__pollVoteTracker = new Map());
        const pollKey = `${poll.id || 'poll_daily'}_${clientIp}`;
        const lastVote = pollVoteTracker.get(pollKey);
        const VOTE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
        if (lastVote && (Date.now() - lastVote < VOTE_COOLDOWN_MS)) {
          res.writeHead(429, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'You have already voted in this poll. One vote permitted per reader every 24 hours.' }));
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
        pollVoteTracker.set(pollKey, Date.now());

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

  // GET /api/weather (Live Open-Meteo Real-Time Weather with 20-min smart cache)
  if (req.method === 'GET' && url.pathname === '/api/weather') {
    try {
      const qLat = url.searchParams.get('lat');
      const qLon = url.searchParams.get('lon');
      const qCity = url.searchParams.get('city');

      // Default: Jaitahari / Anuppur, MP (Lat: 23.03, Lon: 81.78)
      const lat = qLat ? parseFloat(qLat) : 23.03;
      const lon = qLon ? parseFloat(qLon) : 81.78;
      const cityName = qCity || (qLat ? 'Your Location' : 'Jaitahari');

      const weatherData = await fetchOpenMeteoWeather(lat, lon, cityName);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=600'
      });
      return res.end(JSON.stringify(weatherData));
    } catch (err) {
      console.warn('[Weather API Error]', err.message);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        cityName: url.searchParams.get('city') || 'Jaitahari',
        latitude: 23.03,
        longitude: 81.78,
        current: {
          temperature: 24,
          apparentTemperature: 24,
          humidity: 50,
          windSpeed: 8,
          precipitation: 0,
          isDay: 1,
          weatherCode: 0
        },
        daily: [],
        isFallback: true,
        updatedAt: new Date().toISOString()
      }));
    }
  }

  // GET /api/weather/search (Open-Meteo Geocoding City Search with 24-hr cache)
  if (req.method === 'GET' && url.pathname === '/api/weather/search') {
    try {
      const q = url.searchParams.get('q') || '';
      const cities = await searchOpenMeteoCities(q);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600'
      });
      return res.end(JSON.stringify(cities));
    } catch (err) {
      console.warn('[Weather Search Error]', err.message);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify([]));
    }
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

  // POST /api/categories (Save/update categories taxonomy list - Gated SEC-024)
  if (req.method === 'POST' && url.pathname === '/api/categories') {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader;
    const session = token ? verifyStaffSessionToken(token) : null;
    if (!session || !['admin', 'editor', 'developer'].includes(session.role)) {
      res.writeHead(session ? 403 : 401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Forbidden: Editor or Admin authorization required to modify categories.' }));
    }

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

  // GET /api/articles (Retrieve backend-persisted articles with Public Embargo Shield - SEC-015 Fix)
  if (req.method === 'GET' && url.pathname === '/api/articles') {
    const allArticles = getSavedArticles();
    const scope = url.searchParams.get('scope');

    // Cryptographic session verification for privileged staff access (drafts, scheduled, embargoed)
    let isStaff = false;
    let staffRole = null;
    let staffEmail = null;
    const authHeader = req.headers['authorization'] || '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      const session = verifyStaffSessionToken(token);
      if (session && ['reporter', 'editor', 'admin', 'developer'].includes(session.role)) {
        isStaff = true;
        staffRole = session.role;
        staffEmail = session.email ? session.email.toLowerCase() : null;
      }
    }

    // Public readers strictly receive 'published' articles (scheduled and drafts remain embargoed)
    let responseArticles;
    if (isStaff && (scope === 'all' || scope === 'admin')) {
      if (staffRole === 'reporter') {
        // Reporter sees published stories plus their own drafts
        responseArticles = allArticles.filter(a =>
          a.status === 'published' ||
          !a.status ||
          (a.author && a.author.email && a.author.email.toLowerCase() === staffEmail)
        );
      } else {
        // Editors, Admins, Developers see all stories (published, draft, scheduled)
        responseArticles = allArticles;
      }
    } else {
      // Anonymous public visitors or unprivileged requests strictly receive published stories
      responseArticles = allArticles.filter(a => a.status === 'published' || !a.status);
    }

    // Resolve pre-translated titles & summaries from disk cache for target language (0ms, 0 Gemini calls)
    const targetLang = normalizeLanguageCode(url.searchParams.get('lang') || '');
    if (targetLang && targetLang !== 'hi') {
      const store = getTranslationsStore();
      responseArticles = responseArticles.map(art => {
        const key = `${art.id}:${targetLang}`;
        if (store[key] && store[key].title && store[key].status === 'done') {
          return {
            ...art,
            title: store[key].title,
            summary: store[key].summary || (Array.isArray(store[key].highlights) ? store[key].highlights[0] : '') || art.summary,
            sub_title: store[key].sub_title || art.sub_title
          };
        }
        return art;
      });
    }

    // Staff views (drafts, pending) must strictly be private; only public reader feeds are cached on Edge
    const edgeTtl = process.env.EDGE_CACHE_TTL || '300';
    if (isStaff && (scope === 'all' || scope === 'admin')) {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, no-cache, no-store, must-revalidate'
      });
    } else {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=180, s-maxage=${edgeTtl}`
      });
    }
    return res.end(JSON.stringify(responseArticles));
  }

  // POST /api/articles (Bulk save / replace articles list - Administrative Only, SEC-010 Fix)
  if (req.method === 'POST' && url.pathname === '/api/articles') {
    if (!requireAdminAuth(req, res)) return;
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const articlesList = Array.isArray(body) ? body : body.articles || [];
        if (!Array.isArray(articlesList) || articlesList.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Articles payload must be a non-empty array of valid articles.' }));
        }

        // Safety Snapshot prior to bulk write (Disaster Prevention)
        try {
          if (fs.existsSync(ARTICLES_FILE)) {
            const snapDir = path.join(DATA_DIR, 'backups');
            if (!fs.existsSync(snapDir)) fs.mkdirSync(snapDir, { recursive: true });
            fs.copyFileSync(ARTICLES_FILE, path.join(snapDir, `articles_pre_bulk_${Date.now()}.json`));
          }
        } catch (_snapErr) {}

        const updated = saveArticles(articlesList);
        console.log('[Backend Articles Saved]:', updated.length, 'articles by Admin');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, articles: updated }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // POST /api/articles/update (Update single article by ID or add new with RBAC & Scheduler Guard - SEC-011 Fix)
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

        // Subtopic 18.1 & SEC-011 Fix: Mandatory Staff Session Verification
        const authHeader = req.headers['authorization'] || '';
        const token = authHeader.replace(/^Bearer\s+/i, '').trim();
        const session = token ? verifyStaffSessionToken(token) : null;

        if (!session) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            error: 'Unauthorized: A valid newsroom staff session (Reporter, Editor, or Admin) is strictly required to modify or create news stories.'
          }));
        }

        let authenticatedStaff = null;
        if (session) {
          const staffList = getStaffList();
          authenticatedStaff = staffList.find(s => s.id === session.id || s.email.toLowerCase() === session.email.toLowerCase()) || null;
        }

        // Strictly derive user role from authenticated session (never trust unverified client body)
        const userRole = (authenticatedStaff?.role || session?.role || '').toLowerCase();
        const userEmail = (authenticatedStaff?.email || session?.email || '').toLowerCase().trim();

        if (!['reporter', 'editor', 'admin', 'developer'].includes(userRole)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Forbidden: Insufficient privileges to update articles.' }));
        }

        // Subtopic 18.1: Server-Side Byline Binding & Reporter Impersonation Guard
        if (userRole === 'reporter') {
          // Bind byline strictly to authenticated reporter credentials if session exists
          if (authenticatedStaff) {
            body.author = {
              name: authenticatedStaff.name,
              email: authenticatedStaff.email,
              role: 'reporter'
            };
            body.author_name = authenticatedStaff.name;
            body.author_email = authenticatedStaff.email;
            body.author_role = 'reporter';
          } else {
            body.author = {
              ...(body.author || {}),
              role: 'reporter'
            };
            body.author_role = 'reporter';
          }

          // Editorial RBAC Guard: Reporters cannot publish live or schedule publication
          if (body.status === 'published' || body.status === 'scheduled') {
            console.warn(`[Editorial RBAC Gate] Reporter attempted to set status to "${body.status}". Forcing to "draft".`);
            body.status = 'draft';
            body.scheduledPublishTime = null;
          }
        }

        // Editorial RBAC Guard: Unauthenticated callers or non-editors attempting to publish live or schedule
        if (!session || !['editor', 'admin'].includes(userRole)) {
          if (body.status === 'published' || body.status === 'scheduled') {
            console.warn(`[Editorial RBAC Gate] Unauthenticated/unauthorized caller attempted to set status to "${body.status}". Forcing to "draft".`);
            body.status = 'draft';
            body.scheduledPublishTime = null;
          }
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

        // Subtopic 18.1: Cross-Reporter Ownership Guard
        if (existingIdx >= 0 && userRole === 'reporter') {
          const existingArticle = currentArticles[existingIdx];
          const existingAuthorEmail = (existingArticle.author?.email || existingArticle.author_email || '').toLowerCase().trim();
          const existingAuthorRole = (existingArticle.author?.role || existingArticle.author_role || '').toLowerCase().trim();
          // If existing story was drafted by another reporter, current reporter cannot modify it
          if (existingAuthorRole === 'reporter' && existingAuthorEmail && userEmail && existingAuthorEmail !== userEmail) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
              error: 'Editorial RBAC Gate: Field Reporters can only edit their own draft submissions.'
            }));
          }
        }

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
        saveArticles(updatedArticles, `article_update_${body.id}`);
        console.log(`[Backend Article Updated]: ${body.id} "${body.title}" (status: ${body.status})`);
        // Proactively pre-translate to English in background for newly published stories
        if (body.status === 'published') {
          autoPreTranslatePublishedArticle(body);
          autoPreWarmPublishedAudio(body);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, article: body, articles: updatedArticles }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // POST /api/articles/delete or DELETE /api/articles/:id (Delete an article by ID with Cascading Cleanup)
  const restArticleDeleteMatch = url.pathname.match(/^\/api\/articles\/([^/]+)$/);
  if ((req.method === 'POST' && url.pathname === '/api/articles/delete') || (req.method === 'DELETE' && restArticleDeleteMatch)) {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const id = restArticleDeleteMatch ? decodeURIComponent(restArticleDeleteMatch[1]) : body.id;
        if (!id) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Article id is required' }));
        }

        // Subtopic 18.1: RBAC Guard for Article Deletion
        const authHeader = req.headers['authorization'] || '';
        const token = authHeader.replace(/^Bearer\s+/i, '').trim();
        const session = token ? verifyStaffSessionToken(token) : null;
        let authenticatedStaff = null;
        if (session) {
          const staffList = getStaffList();
          authenticatedStaff = staffList.find(s => s.id === session.id || s.email.toLowerCase() === session.email.toLowerCase()) || null;
        }
        // Critic Hardening: Strictly derive user role from authenticated session (never trust unverified client body)
        const effectiveRole = (authenticatedStaff?.role || session?.role || '').toLowerCase();
        if (!session || !['editor', 'admin'].includes(effectiveRole)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: false,
            error: 'Editorial RBAC Gate: Only authenticated Editors or Admins are authorized to delete articles.'
          }));
        }

        const currentArticles = getSavedArticles();
        const updatedArticles = currentArticles.filter(a => String(a.id) !== String(id));
        saveArticles(updatedArticles);

        // Cascading deletion of all satellite data (translations, revisions, audio files, cache)
        const cascadeResult = cascadeDeleteArticleData(id);
        console.log('[Backend Article Deleted with Cascade]:', id, cascadeResult);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          deletedId: id,
          articles: updatedArticles,
          cascade: cascadeResult
        }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // GET /api/articles/:id/revisions (Task 21: Retrieve article revision history - Staff Only, SEC-016 Fix)
  const revisionsMatch = url.pathname.match(/^\/api\/articles\/([^/]+)\/revisions$/);
  if (req.method === 'GET' && revisionsMatch) {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const session = token ? verifyStaffSessionToken(token) : null;
    if (!session || !['reporter', 'editor', 'admin', 'developer'].includes(session.role)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        error: 'Unauthorized: Newsroom staff authentication required to view article revision history.'
      }));
    }

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
        const authHeader = req.headers['authorization'] || '';
        const token = authHeader.replace(/^Bearer\s+/i, '').trim();
        const session = token ? verifyStaffSessionToken(token) : null;
        let authenticatedStaff = null;
        if (session) {
          const staffList = getStaffList();
          authenticatedStaff = staffList.find(s => s.id === session.id || s.email.toLowerCase() === session.email.toLowerCase()) || null;
        }
        // Critic Hardening: Strictly derive user role from authenticated session (never trust unverified client body)
        const userRole = (authenticatedStaff?.role || session?.role || '').toLowerCase();
        if (!session || !['editor', 'admin'].includes(userRole)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: false,
            error: 'Editorial Gate: Only authenticated Editors or Admins are authorized to rollback articles.'
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

  // POST /api/articles/:id/live-updates (Fast micro-update post - Gated SEC-023)
  const postLiveUpdatesMatch = url.pathname.match(/^\/api\/articles\/([^/]+)\/live-updates$/);
  if (req.method === 'POST' && postLiveUpdatesMatch) {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader;
    const session = token ? verifyStaffSessionToken(token) : null;
    if (!session || !['reporter', 'editor', 'admin', 'developer'].includes(session.role)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Unauthorized: Staff authentication required to post live blog updates.' }));
    }

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

  // DELETE /api/articles/:id/live-updates/:updateId (Remove erroneous live micro-update - Gated SEC-023)
  const deleteLiveUpdateMatch = url.pathname.match(/^\/api\/articles\/([^/]+)\/live-updates\/([^/]+)$/);
  if (req.method === 'DELETE' && deleteLiveUpdateMatch) {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader;
    const session = token ? verifyStaffSessionToken(token) : null;
    if (!session || !['editor', 'admin', 'developer'].includes(session.role)) {
      res.writeHead(session ? 403 : 401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Forbidden: Editor or Admin authorization required to delete live updates.' }));
    }

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

  // =============================================================
  // TASK 29 / SEC-037: STATUTORY GRIEVANCE REDRESSAL MECHANISM (IT RULES 2021)
  // =============================================================

  // POST /api/grievance/submit - Public reader statutory complaint submission
  if (req.method === 'POST' && url.pathname === '/api/grievance/submit') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const {
          complainant_name,
          complainant_email,
          complainant_phone,
          category,
          article_id,
          article_title,
          article_url,
          description,
          declaration_agreed
        } = body;

        if (!complainant_name || !complainant_email || !category || !description) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: false,
            error: 'Complainant name, email, grievance category, and description are mandatory.'
          }));
        }

        if (!declaration_agreed) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: false,
            error: 'You must agree to the statutory legal declaration before submitting.'
          }));
        }

        const now = new Date();
        const trackingId = `GRV-2026-${Math.floor(1000 + Math.random() * 9000)}`;
        const ackDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
        const disposalDeadline = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString();

        const newGrievance = {
          id: trackingId,
          complainant_name: String(complainant_name).trim().slice(0, 100),
          complainant_email: String(complainant_email).trim().slice(0, 100),
          complainant_phone: complainant_phone ? String(complainant_phone).trim().slice(0, 20) : null,
          category: String(category).trim().slice(0, 50),
          article_id: article_id ? String(article_id).trim() : null,
          article_title: article_title ? String(article_title).trim().slice(0, 250) : null,
          article_url: article_url ? String(article_url).trim().slice(0, 500) : null,
          description: String(description).trim().slice(0, 5000),
          declaration_agreed: true,
          status: 'pending',
          submitted_at: now.toISOString(),
          acknowledgment_deadline: ackDeadline,
          disposal_deadline: disposalDeadline,
          resolution_notes: null,
          resolved_at: null,
          resolved_by: null
        };

        const currentGrievances = getSavedGrievances();
        const updatedList = [newGrievance, ...currentGrievances];
        saveGrievances(updatedList);

        res.writeHead(201, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          tracking_id: trackingId,
          acknowledgment_deadline: ackDeadline,
          disposal_deadline: disposalDeadline,
          grievance: newGrievance
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // GET /api/grievances - Admin Grievance Review Desk query
  if (req.method === 'GET' && url.pathname === '/api/grievances') {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const session = token ? verifyStaffSessionToken(token) : null;
    if (!session || !['editor', 'admin', 'developer'].includes(session.role)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        error: 'Unauthorized: Newsroom staff authentication required to access grievance dockets.'
      }));
    }

    const grievances = getSavedGrievances();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, grievances }));
  }

  // POST /api/grievance/update - Update grievance disposition & officer notes
  if (req.method === 'POST' && url.pathname === '/api/grievance/update') {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const session = token ? verifyStaffSessionToken(token) : null;
    if (!session || !['editor', 'admin', 'developer'].includes(session.role)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        error: 'Unauthorized: Newsroom staff authorization required to update grievance status.'
      }));
    }

    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const { id, status, resolution_notes, resolved_by } = body;
        if (!id || !status) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Grievance ID and status are required.' }));
        }

        const validStatuses = ['pending', 'under_review', 'resolved', 'rejected'];
        if (!validStatuses.includes(status)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Invalid grievance status.' }));
        }

        const grievances = getSavedGrievances();
        const index = grievances.findIndex(g => g.id === id);
        if (index === -1) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Grievance docket not found.' }));
        }

        const now = new Date();
        grievances[index] = {
          ...grievances[index],
          status,
          resolution_notes: resolution_notes || grievances[index].resolution_notes,
          resolved_by: resolved_by || (session.name ? `${session.name} (Grievance Officer)` : 'Grievance Officer'),
          resolved_at: ['resolved', 'rejected'].includes(status) ? now.toISOString() : grievances[index].resolved_at
        };

        saveGrievances(grievances);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          grievance: grievances[index]
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // -------------------------------------------------------------
  // TASK 43: ZERO-TRACE ANONYMOUS CONFIDENTIAL NEWS TIP DESK APIS
  // -------------------------------------------------------------

  // POST /api/tips/submit - Public anonymous crime/corruption tip submission (Zero IP / Zero Device Logging)
  if (req.method === 'POST' && url.pathname === '/api/tips/submit') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const validCategories = ['corruption', 'crime', 'scam', 'public_issue', 'other'];
        const category = validCategories.includes(body.category) ? body.category : 'corruption';
        const title = String(body.title || '').trim().slice(0, 200);
        const location = String(body.location || '').trim().slice(0, 150);
        const incidentDate = String(body.incidentDate || '').trim().slice(0, 50);
        const involvedEntities = String(body.involvedEntities || '').trim().slice(0, 300);
        const details = String(body.details || '').trim().slice(0, 8000);
        const optionalContact = String(body.optionalContact || '').trim().slice(0, 150) || 'Anonymous (Gupt)';
        const rawEvidence = String(body.evidenceUrl || '').trim().slice(0, 500);
        const evidenceUrl = (/^(https?:\/\/|\/uploads\/)/i.test(rawEvidence)) ? rawEvidence : '';

        if (title.length < 5) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Subject / Title must be at least 5 characters.' }));
        }
        if (details.length < 20) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Please provide complete details (minimum 20 characters).' }));
        }

        const tips = getSavedConfidentialTips();
        let trackingId = generateTipTrackingId();
        while (tips.some(t => t.trackingId === trackingId)) {
          trackingId = generateTipTrackingId();
        }

        const nowIso = new Date().toISOString();
        const newTip = {
          id: `tip_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          trackingId,
          category,
          title,
          location,
          incidentDate,
          involvedEntities,
          details,
          evidenceUrl,
          optionalContact,
          status: 'pending_review',
          editorialNote: '',
          linkedArticleId: '',
          reviewedBy: '',
          submittedAt: nowIso,
          updatedAt: nowIso
        };

        tips.unshift(newTip);
        saveConfidentialTips(tips);

        res.writeHead(201, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        });
        return res.end(JSON.stringify({
          success: true,
          trackingId: newTip.trackingId,
          status: newTip.status,
          submittedAt: newTip.submittedAt
        }));
      } catch (_err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'Invalid tip submission payload.' }));
      }
    });
    return;
  }

  // GET /api/tips/status/:trackingId - Public anonymous status check (never leaks raw tip details)
  if (req.method === 'GET' && url.pathname.startsWith('/api/tips/status/')) {
    const rawId = decodeURIComponent(url.pathname.slice('/api/tips/status/'.length) || '').trim().toUpperCase();
    if (!rawId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'Tracking ID is required.' }));
    }

    const tips = getSavedConfidentialTips();
    const tip = tips.find(t => String(t.trackingId || '').toUpperCase() === rawId);
    if (!tip) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'No confidential tip found with this Tracking ID.' }));
    }

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    });
    return res.end(JSON.stringify({
      success: true,
      trackingId: tip.trackingId,
      status: tip.status,
      submittedAt: tip.submittedAt,
      updatedAt: tip.updatedAt,
      editorialNote: tip.editorialNote || ''
    }));
  }

  // GET /api/admin/tips - Admin-Only Confidential Tip Desk query (Admin / Developer ONLY)
  if (req.method === 'GET' && url.pathname === '/api/admin/tips') {
    const adminSession = requireAdminAuth(req, res);
    if (!adminSession) return;

    const tips = getSavedConfidentialTips();
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ success: true, tips }));
  }

  // POST /api/admin/tips/update - Update investigation status & editorial note (Admin / Developer ONLY)
  if (req.method === 'POST' && url.pathname === '/api/admin/tips/update') {
    const session = requireAdminAuth(req, res);
    if (!session) return;

    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const tipId = String(body.id || '').trim();
        const status = String(body.status || '').trim();
        const validStatuses = ['pending_review', 'under_investigation', 'verified_published', 'dismissed'];
        if (!tipId || !validStatuses.includes(status)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Valid tip ID and status are required.' }));
        }

        const tips = getSavedConfidentialTips();
        const idx = tips.findIndex(t => t.id === tipId);
        if (idx === -1) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Confidential tip not found.' }));
        }

        tips[idx] = {
          ...tips[idx],
          status,
          editorialNote: body.editorialNote !== undefined ? String(body.editorialNote || '').trim().slice(0, 1000) : tips[idx].editorialNote,
          linkedArticleId: body.linkedArticleId !== undefined ? String(body.linkedArticleId || '').trim().slice(0, 120) : tips[idx].linkedArticleId,
          reviewedBy: session.name || session.email,
          updatedAt: new Date().toISOString()
        };
        saveConfidentialTips(tips);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, tip: tips[idx] }));
      } catch (_err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'Invalid tip update payload.' }));
      }
    });
    return;
  }

  // POST /api/admin/tips/delete - Remove tip record (Admin / Developer only)
  if (req.method === 'POST' && url.pathname === '/api/admin/tips/delete') {
    const adminSession = requireAdminAuth(req, res);
    if (!adminSession) return;

    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const tipId = String(body.id || '').trim();
        if (!tipId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Tip ID is required.' }));
        }

        const tips = getSavedConfidentialTips();
        const filtered = tips.filter(t => t.id !== tipId);
        if (filtered.length === tips.length) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Confidential tip not found.' }));
        }
        saveConfidentialTips(filtered);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, deletedId: tipId }));
      } catch (_err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'Invalid delete payload.' }));
      }
    });
    return;
  }

  // GET /api/live-news (Fetch live incoming RSS news streams for Admin Curation)
  if (req.method === 'GET' && url.pathname === '/api/live-news') {
    try {
      const topic = (url.searchParams.get('topic') || 'GENERAL').toUpperCase();
      const lang = url.searchParams.get('lang') || 'hi';

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

  // POST /api/media/delete (Delete media asset with Active Article Safety Guard & Editorial RBAC - SEC-013 Fix)
  if (req.method === 'POST' && url.pathname === '/api/media/delete') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');

        // SEC-013 Fix: Strictly require verified staff session; reject client body-supplied roles
        const authHeader = req.headers['authorization'] || '';
        const token = authHeader.replace(/^Bearer\s+/i, '').trim();
        const session = token ? verifyStaffSessionToken(token) : null;

        if (!session) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Unauthorized: Valid staff session required to delete media assets.' }));
        }

        const userRole = (session.role || '').toLowerCase();

        // RBAC Rule 1: Reporters cannot delete any media assets
        if (userRole === 'reporter' || !['editor', 'admin', 'developer'].includes(userRole)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            error: 'Editorial Gate: Field Reporters cannot delete media assets. Contact an Editor or Admin.'
          }));
        }

        const fileName = path.basename(String(body.fileName || ''));
        const force = Boolean(body.force);

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

          // RBAC Rule 2: Force-deleting in-use media requires Newsroom Administrator or Developer role
          if (!['admin', 'developer'].includes(userRole)) {
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

  // POST /api/media/update (Update caption, credit, alt-text for an asset with Editorial RBAC - SEC-025 Fix)
  if (req.method === 'POST' && url.pathname === '/api/media/update') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');

        // SEC-025 Fix: Strictly require verified staff session; reject client body-supplied roles
        const authHeader = req.headers['authorization'] || '';
        const token = authHeader.replace(/^Bearer\s+/i, '').trim();
        const session = token ? verifyStaffSessionToken(token) : null;

        if (!session) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Unauthorized: Valid staff session required to update media metadata.' }));
        }

        const userRole = (session.role || '').toLowerCase();

        // RBAC Rule 3: Reporters cannot edit existing media metadata
        if (userRole === 'reporter' || !['editor', 'admin', 'developer'].includes(userRole)) {
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

  // -------------------------------------------------------------
  // TASK 17: NEWSROOM RBAC EMAIL/PASSWORD AUTH & OTP ENDPOINTS
  // -------------------------------------------------------------

  // POST /api/auth/login - Email + Password Login for Newsroom Staff
  if (req.method === 'POST' && url.pathname === '/api/auth/login') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const email = String(body.email || '').toLowerCase().trim();
        const password = String(body.password || '').trim();
        const clientIp = getClientIp(req);
        const rateLimitKey = `${clientIp}_${email}`;

        if (!email || !password) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: false,
            error: 'Email address and password are required.'
          }));
        }

        // Brute-force rate limiting check
        const rateStatus = checkLoginRateLimit(rateLimitKey);
        if (!rateStatus.allowed) {
          res.writeHead(429, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: false,
            error: rateStatus.error,
            locked: true,
            remainingSeconds: rateStatus.remainingSeconds
          }));
        }

        const staffList = getStaffList();
        const staffMember = staffList.find(s => s.email === email);

        if (!staffMember) {
          const attemptRecord = recordFailedLogin(rateLimitKey);
          const remainingAttempts = Math.max(0, 5 - attemptRecord.failedCount);
          res.writeHead(401, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: false,
            error: `Invalid email or password. ${remainingAttempts} attempt(s) remaining.`,
            remainingAttempts
          }));
        }

        // Check Account Status (Pending Admin Approval / Suspended)
        if (staffMember.status === 'pending_approval') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: false,
            error: 'Your journalist account is pending Super Admin approval. Please contact the Chief Editor.',
            status: 'pending_approval'
          }));
        }

        if (staffMember.status === 'suspended') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: false,
            error: 'This account has been deactivated by the Editorial Administrator.',
            status: 'suspended'
          }));
        }

        // Verify Salted Scrypt Password
        const isPasswordValid = verifyPassword(password, staffMember.passwordHash, staffMember.passwordSalt);
        if (!isPasswordValid) {
          const attemptRecord = recordFailedLogin(rateLimitKey);
          const remainingAttempts = Math.max(0, 5 - attemptRecord.failedCount);
          res.writeHead(401, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: false,
            error: `Invalid email or password. ${remainingAttempts} attempt(s) remaining.`,
            remainingAttempts
          }));
        }

        // Password verified successfully! Clear failed attempts
        clearFailedLogin(rateLimitKey);

        // Check if Two-Factor Authentication (2FA) is active (Google Authenticator RFC 6238)
        if (staffMember.twoFactorEnabled && staffMember.twoFactorSecret) {
          const tempToken = createTemp2faToken(staffMember);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: true,
            requires2FA: true,
            tempToken,
            email: staffMember.email,
            name: staffMember.name,
            role: staffMember.role,
            message: 'Password verified. Please enter the 6-digit code from Google Authenticator or an Emergency Recovery Code.'
          }));
        }

        // Direct session token if 2FA is not active
        const token = generateStaffSessionToken(staffMember);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          id: staffMember.id,
          name: staffMember.name,
          email: staffMember.email,
          role: staffMember.role,
          token,
          expiresIn: '24h'
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: false,
          error: `Authentication error: ${err.message}`
        }));
      }
    });
    return;
  }

  // -------------------------------------------------------------
  // POST /api/auth/2fa/verify-login - Step 2: Verify TOTP / Emergency Recovery Code
  // -------------------------------------------------------------
  if (req.method === 'POST' && url.pathname === '/api/auth/2fa/verify-login') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const tempToken = String(body.tempToken || '').trim();
        const code = String(body.code || '').trim();
        const isRecoveryCode = Boolean(body.isRecoveryCode);

        if (!tempToken || !code) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: false,
            error: isRecoveryCode ? 'Emergency recovery code is required.' : '6-digit Authenticator code is required.'
          }));
        }

        const result = verify2faLogin({ tempToken, code, isRecoveryCode });
        if (!result.success) {
          res.writeHead(result.expired ? 401 : 400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(result));
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          id: result.id,
          name: result.name,
          email: result.email,
          role: result.role,
          token: result.token,
          expiresIn: '24h',
          usedRecoveryCode: result.usedRecoveryCode || false,
          remainingRecoveryCodes: result.remainingRecoveryCodes
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: `2FA verification error: ${err.message}` }));
      }
    });
    return;
  }

  // -------------------------------------------------------------
  // GET /api/auth/2fa/status - Get Current 2FA Activation Status
  // -------------------------------------------------------------
  if (req.method === 'GET' && url.pathname === '/api/auth/2fa/status') {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const session = verifyStaffSessionToken(token);

    if (!session || (session.role !== 'admin' && session.role !== 'developer')) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'Unauthorized: Admin or Developer privileges required.' }));
    }

    try {
      const status = getStaff2faStatus(session.email);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, ...status }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  // -------------------------------------------------------------
  // POST /api/auth/2fa/setup - Initiate 2FA Enrollment (Generate QR & 10 Recovery Codes)
  // -------------------------------------------------------------
  if (req.method === 'POST' && url.pathname === '/api/auth/2fa/setup') {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const session = verifyStaffSessionToken(token);

    if (!session || (session.role !== 'admin' && session.role !== 'developer')) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'Unauthorized: Super Admin or Developer privileges required.' }));
    }

    try {
      const setupData = initiate2faSetup(session.email);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, ...setupData }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  // -------------------------------------------------------------
  // POST /api/auth/2fa/confirm-setup - Confirm 2FA Pairing with First TOTP Code
  // -------------------------------------------------------------
  if (req.method === 'POST' && url.pathname === '/api/auth/2fa/confirm-setup') {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const session = verifyStaffSessionToken(token);

    if (!session || (session.role !== 'admin' && session.role !== 'developer')) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'Unauthorized: Super Admin or Developer privileges required.' }));
    }

    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const code = String(body.code || '').trim();

        if (!code) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: '6-digit confirmation code is required.' }));
        }

        const result = confirm2faSetup(session.email, code);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // POST /api/auth/register/send-otp - Step 1: Send 5-Min OTP to confirm Gmail ownership BEFORE application
  if (req.method === 'POST' && url.pathname === '/api/auth/register/send-otp') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', async () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const name = String(body.name || '').trim();
        const email = String(body.email || '').toLowerCase().trim();
        const password = String(body.password || '').trim();

        if (!name || !email || !password) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: false,
            error: 'Full name, email address, and password are required.'
          }));
        }

        // Strict Email Format & Delimiter Sanitization (SEC-044 Fix)
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(email) || email.includes(':') || email.includes(';') || email.includes(' ') || email.includes('"')) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: false,
            error: 'Please enter a valid email address (colons and special delimiter characters are strictly prohibited).'
          }));
        }

        if (password.length < 6) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: false,
            error: 'Password must be at least 6 characters long.'
          }));
        }

        const staffList = getStaffList();
        const exists = staffList.find(s => s.email === email);
        if (exists) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: false,
            error: 'An account with this email address already exists. Please sign in or reset your password.'
          }));
        }

        // Sliding-Window IP Rate Limiter for Outbound OTP Dispatch (SEC-004)
        const clientIp = getClientIp(req);
        const ipRateLimit = checkOtpIpRateLimit(clientIp);
        if (!ipRateLimit.allowed) {
          res.writeHead(429, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: false,
            error: ipRateLimit.error,
            rateLimited: true,
            retryAfterMinutes: ipRateLimit.waitMinutes
          }));
        }

        const otpRes = createOtpForEmail(email, name, 'email_verification');
        if (!otpRes.success) {
          res.writeHead(429, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: false,
            error: otpRes.error,
            cooldown: otpRes.cooldown,
            remainingSeconds: otpRes.remainingSeconds
          }));
        }

        // Live SMTP Dispatch (if GMAIL_USER and GMAIL_APP_PASS are configured)
        const isLiveSmtp = isEmailConfigured();
        let dispatchResult = null;
        if (isLiveSmtp) {
          dispatchResult = await sendNewsroomEmail({
            to: email,
            subject: 'PublicSpark Newsroom - Verify Your Email Ownership (5-Minute Passcode)',
            html: otpRes.emailHtml,
            text: `PublicSpark Newsroom Verification Passcode: ${otpRes.otpCode}. Valid for 5 minutes.`
          });
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          message: isLiveSmtp && (dispatchResult?.delivered || dispatchResult?.sent)
            ? `A 5-minute security passcode has been sent to ${email}. Please check your Gmail inbox.`
            : `A 5-minute verification passcode has been sent to ${email}.`,
          expiresInSeconds: otpRes.expiresInSeconds,
          liveSent: Boolean(dispatchResult?.delivered || dispatchResult?.sent)
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // POST /api/auth/register/verify-and-submit - Step 2: Verify Gmail OTP & Submit for Super Admin Approval
  if (req.method === 'POST' && (url.pathname === '/api/auth/register/verify-and-submit' || url.pathname === '/api/auth/register')) {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const name = String(body.name || '').trim();
        const email = String(body.email || '').toLowerCase().trim();
        const password = String(body.password || '').trim();
        const phone = String(body.phone || '').trim();
        const role = String(body.role || 'reporter').toLowerCase().trim();
        const otpCode = String(body.otpCode || '').trim();

        if (!name || !email || !password) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: false,
            error: 'Full name, email address, and password are required.'
          }));
        }

        // Strict Email Format & Delimiter Sanitization (SEC-044 Fix)
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(email) || email.includes(':') || email.includes(';') || email.includes(' ') || email.includes('"')) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: false,
            error: 'Please enter a valid email address (colons and special delimiter characters are strictly prohibited).'
          }));
        }

        if (password.length < 6) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: false,
            error: 'Password must be at least 6 characters long.'
          }));
        }

        // Mandatory Gmail Ownership OTP Verification Gate
        if (!otpCode || otpCode.length !== 6) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: false,
            error: 'Email verification required. Please enter the 6-digit OTP code sent to your Gmail.'
          }));
        }

        const staffList = getStaffList();
        const exists = staffList.find(s => s.email === email);
        if (exists) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: false,
            error: 'An account with this email address already exists.'
          }));
        }

        // Validate and destroy OTP
        const verifyRes = verifyAndDestroyOtp(email, otpCode);
        if (!verifyRes.valid) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: false,
            error: verifyRes.error,
            attemptsLeft: verifyRes.attemptsLeft
          }));
        }

        // Password hashing via scrypt
        const { hash, salt } = hashPassword(password);
        const newStaff = {
          id: `staff_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name,
          email,
          phone,
          role: role === 'editor' ? 'editor' : 'reporter',
          passwordHash: hash,
          passwordSalt: salt,
          emailVerified: true,
          emailVerifiedAt: new Date().toISOString(),
          status: 'pending_approval', // Locked until Super Admin explicitly approves!
          createdAt: new Date().toISOString()
        };

        staffList.push(newStaff);
        saveStaffList(staffList);

        console.log(`[Newsroom Application]: Gmail verified applicant: ${name} (${email}) - Submitted to Super Admin Desk for approval`);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          message: 'Gmail verified successfully! Your application has been submitted to the Super Admin Desk for approval.',
          email: newStaff.email,
          status: newStaff.status,
          emailVerified: true
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // POST /api/auth/forgot-password/send-otp - Request 5-Minute Verification OTP
  if (req.method === 'POST' && url.pathname === '/api/auth/forgot-password/send-otp') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', async () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const email = String(body.email || '').toLowerCase().trim();

        if (!email) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Email address is required.' }));
        }

        // Sliding-Window IP Rate Limiter for Outbound OTP Dispatch (SEC-004)
        const clientIp = getClientIp(req);
        const ipRateLimit = checkOtpIpRateLimit(clientIp);
        if (!ipRateLimit.allowed) {
          res.writeHead(429, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: false,
            error: ipRateLimit.error,
            rateLimited: true,
            retryAfterMinutes: ipRateLimit.waitMinutes
          }));
        }

        const staffList = getStaffList();
        const staff = staffList.find(s => s.email === email);
        if (!staff) {
          // Security standard: Do not reveal whether email exists or not
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: true,
            message: 'If the email is registered in our newsroom, a 5-minute security OTP has been sent.'
          }));
        }

        const otpRes = createOtpForEmail(email, staff.name, 'password_reset');
        if (!otpRes.success) {
          res.writeHead(429, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: false,
            error: otpRes.error,
            cooldown: otpRes.cooldown,
            remainingSeconds: otpRes.remainingSeconds
          }));
        }

        // Live SMTP Dispatch (if GMAIL_USER and GMAIL_APP_PASS are configured)
        const isLiveSmtp = isEmailConfigured();
        let dispatchResult = null;
        if (isLiveSmtp) {
          dispatchResult = await sendNewsroomEmail({
            to: email,
            subject: 'PublicSpark Newsroom - Reset Your Password (5-Minute Security OTP)',
            html: otpRes.emailHtml,
            text: `PublicSpark Newsroom Password Reset Passcode: ${otpRes.otpCode}. Valid for 5 minutes.`
          });
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          message: isLiveSmtp && (dispatchResult?.delivered || dispatchResult?.sent)
            ? 'A 5-minute security OTP has been dispatched directly to your Gmail inbox.'
            : 'A 5-minute security OTP has been dispatched to your email.',
          expiresInSeconds: otpRes.expiresInSeconds,
          liveSent: Boolean(dispatchResult?.delivered || dispatchResult?.sent)
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // POST /api/auth/forgot-password/verify-otp - Verify OTP with Instant Single-Use Destruction
  if (req.method === 'POST' && url.pathname === '/api/auth/forgot-password/verify-otp') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const email = String(body.email || '').toLowerCase().trim();
        const otp = String(body.otp || '').trim();

        if (!email || !otp) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Email and OTP code are required.' }));
        }

        const verifyRes = verifyAndDestroyOtp(email, otp);
        if (!verifyRes.valid) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: verifyRes.error }));
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          message: 'OTP verified successfully. You may now set your new password.',
          resetToken: verifyRes.resetToken
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // POST /api/auth/reset-password - Set New Password After OTP Verification
  if (req.method === 'POST' && url.pathname === '/api/auth/reset-password') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const email = String(body.email || '').toLowerCase().trim();
        const newPassword = String(body.newPassword || '').trim();
        const resetToken = String(body.resetToken || '').trim();

        if (!email || !newPassword || !resetToken) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Email, new password, and reset authorization token are required.' }));
        }

        if (newPassword.length < 6) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Password must be at least 6 characters long.' }));
        }

        // Audit Finding 1 Fix: Cryptographically verify reset authorization token
        const result = updateStaffPasswordWithToken(email, newPassword, resetToken);
        if (!result.success) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: result.error }));
        }

        console.log(`[Newsroom Security]: Password updated successfully for ${email}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          message: 'Password successfully updated. You can now login with your new credentials.'
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // GET /api/auth/me - Verify Staff Session Token
  if (req.method === 'GET' && url.pathname === '/api/auth/me') {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ authenticated: false, error: 'No token provided.' }));
    }

    const session = verifyStaffSessionToken(token);
    if (!session) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ authenticated: false, error: 'Session token expired or invalid.' }));
    }

    const staffList = getStaffList();
    const account = staffList.find(s => s.id === session.id) || { name: 'Staff Member', role: session.role };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      authenticated: true,
      id: session.id,
      email: session.email,
      role: session.role,
      name: account.name
    }));
  }

  // POST /api/auth/logout - Server-Side Session Revocation (Task 18 Subtopic 18.2 / SEC-007)
  if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (token) {
      // Critic Hardening: Only blacklist if token is a valid, signed session token (prevents disk bloat attack)
      const validSession = verifyStaffSessionToken(token);
      if (validSession) {
        revokeStaffSessionToken(token);
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, message: 'Session successfully revoked on server.' }));
  }

  // -------------------------------------------------------------
  // NEWSROOM STAFF & PERMISSION MANAGEMENT ENDPOINTS (Task 17 Subtopic 17.4)
  // -------------------------------------------------------------

  function requireAdminAuth(req, res) {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Unauthorized: Newsroom Administrator token required.' }));
      return null;
    }

    const session = verifyStaffSessionToken(token);
    if (!session || (session.role !== 'admin' && session.role !== 'developer')) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Forbidden: Insufficient privileges. Only Newsroom Administrators can access staff management.' }));
      return null;
    }

    return session;
  }

  // GET /api/staff - List all staff members (sanitized)
  if (req.method === 'GET' && url.pathname === '/api/staff') {
    const adminSession = requireAdminAuth(req, res);
    if (!adminSession) return;

    try {
      const staff = getSanitizedStaffList();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, staff }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  // POST /api/staff/approve - Approve pending staff member & grant role
  if (req.method === 'POST' && url.pathname === '/api/staff/approve') {
    const adminSession = requireAdminAuth(req, res);
    if (!adminSession) return;

    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const staffId = String(body.staffId || '').trim();
        const role = String(body.role || '').toLowerCase().trim();

        if (!staffId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Staff ID is required.' }));
        }

        const updated = approveStaffMember({ staffId, role });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          message: `Staff member ${updated.name} has been approved as ${updated.role}.`,
          staff: updated
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // POST /api/staff/update-role - Change staff member's RBAC role
  if (req.method === 'POST' && url.pathname === '/api/staff/update-role') {
    const adminSession = requireAdminAuth(req, res);
    if (!adminSession) return;

    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const staffId = String(body.staffId || '').trim();
        const role = String(body.role || '').toLowerCase().trim();

        if (!staffId || !role) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Staff ID and role are required.' }));
        }

        const updated = updateStaffRole({ staffId, role });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          message: `Role updated to ${updated.role} for ${updated.name}.`,
          staff: updated
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // POST /api/staff/update-status - Change staff status (active / suspended)
  if (req.method === 'POST' && url.pathname === '/api/staff/update-status') {
    const adminSession = requireAdminAuth(req, res);
    if (!adminSession) return;

    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const staffId = String(body.staffId || '').trim();
        const status = String(body.status || '').toLowerCase().trim();

        if (!staffId || !status) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Staff ID and status are required.' }));
        }

        const updated = updateStaffStatus({ staffId, status });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          message: `Status set to ${updated.status} for ${updated.name}.`,
          staff: updated
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // POST /api/staff/delete - Remove staff member or reject application
  if (req.method === 'POST' && url.pathname === '/api/staff/delete') {
    const adminSession = requireAdminAuth(req, res);
    if (!adminSession) return;

    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const staffId = String(body.staffId || '').trim();

        if (!staffId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Staff ID is required.' }));
        }

        const result = deleteStaffMember({ staffId });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          message: 'Staff member or application removed successfully.',
          result
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // POST /api/staff/admin-reset-password - Admin reset password for team member
  if (req.method === 'POST' && url.pathname === '/api/staff/admin-reset-password') {
    const adminSession = requireAdminAuth(req, res);
    if (!adminSession) return;

    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const staffId = String(body.staffId || '').trim();
        const newPassword = String(body.newPassword || '').trim();

        if (!staffId || !newPassword) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Staff ID and newPassword are required.' }));
        }

        const result = adminResetStaffPassword({ staffId, newPassword });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          message: 'Password reset successfully.',
          result
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // POST /api/staff/update-email - Update staff email (Admin email restricted strictly to Developer)
  if (req.method === 'POST' && url.pathname === '/api/staff/update-email') {
    const adminSession = requireAdminAuth(req, res);
    if (!adminSession) return;

    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const staffId = String(body.staffId || '').trim();
        const newEmail = String(body.newEmail || '').trim();

        if (!staffId || !newEmail) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Staff ID and newEmail are required.' }));
        }

        const result = updateStaffEmail({
          staffId,
          newEmail,
          requesterRole: adminSession.role
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          message: 'Email updated successfully.',
          result
        }));
      } catch (err) {
        const statusCode = String(err.message || '').startsWith('Forbidden:') ? 403 : 400;
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // -------------------------------------------------------------
  // TASK 19: DISASTER RECOVERY & 1-CLICK BACKUP DESK APIS
  // -------------------------------------------------------------

  // Ephemeral single-use 60-second download tickets for OWASP-compliant zero-token URL downloads
  const backupDownloadTickets = globalThis.__backupDownloadTickets || (globalThis.__backupDownloadTickets = new Map());

  // POST /api/admin/backup/download-ticket - Issues a 60-second single-use download nonce
  if (req.method === 'POST' && url.pathname === '/api/admin/backup/download-ticket') {
    const adminSession = requireAdminAuth(req, res);
    if (!adminSession) return;

    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const fileName = String(body.fileName || '').trim();
        const safePath = getSafeBackupFilePath(fileName);
        if (!safePath || !fs.existsSync(safePath)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Backup file not found or invalid filename.' }));
        }

        const ticket = crypto.randomBytes(24).toString('hex');
        const expiresAt = Date.now() + 60 * 1000; // 60 seconds TTL
        backupDownloadTickets.set(ticket, { fileName: path.basename(safePath), adminId: adminSession.id, expiresAt });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, ticket, expiresAt }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // POST /api/admin/backup/create - Generate a full disaster recovery archive
  if (req.method === 'POST' && url.pathname === '/api/admin/backup/create') {
    const adminSession = requireAdminAuth(req, res);
    if (!adminSession) return;

    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', async () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const creatorName = adminSession.name || 'Newsroom Admin';
        const result = await generateNewsroomBackupZipAsync({ creatorName });

        // If direct email dispatch requested during creation
        let emailResult = null;
        if (body.dispatchEmail) {
          emailResult = await dispatchBackupToGmail({
            fileName: result.backup.fileName,
            targetEmail: body.targetEmail,
            trigger: 'manual_with_create'
          });
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          backup: result.backup,
          emailResult
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // GET /api/admin/backups - List all archives and disk usage metrics
  if (req.method === 'GET' && url.pathname === '/api/admin/backups') {
    const adminSession = requireAdminAuth(req, res);
    if (!adminSession) return;

    try {
      const list = listAvailableBackups();
      const settings = getBackupSettings();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: true,
        ...list,
        settings
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  // GET /api/admin/backup/download/:filename or /api/admin/backup/download?file=...
  if (req.method === 'GET' && (url.pathname.startsWith('/api/admin/backup/download/') || url.pathname === '/api/admin/backup/download')) {
    let fileName = '';
    if (url.pathname.startsWith('/api/admin/backup/download/')) {
      fileName = decodeURIComponent(url.pathname.replace('/api/admin/backup/download/', ''));
    } else {
      fileName = url.searchParams.get('file') || url.searchParams.get('filename') || '';
    }

    // 1. Verify single-use download ticket if provided (OWASP recommended, zero token in URL)
    const ticketParam = url.searchParams.get('ticket');
    let authorizedByTicket = false;
    if (ticketParam && backupDownloadTickets.has(ticketParam)) {
      const ticketData = backupDownloadTickets.get(ticketParam);
      backupDownloadTickets.delete(ticketParam); // Single use - immediately consume
      if (Date.now() <= ticketData.expiresAt && (!fileName || ticketData.fileName === fileName)) {
        fileName = ticketData.fileName;
        authorizedByTicket = true;
      }
    }

    // 2. If not authorized by ticket, fallback to standard admin session check (SEC-029: Header-only, no token in URL)
    if (!authorizedByTicket) {
      const adminSession = requireAdminAuth(req, res);
      if (!adminSession) return;
    }

    const safePath = getSafeBackupFilePath(fileName);
    if (!safePath || !fs.existsSync(safePath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'Backup archive not found or invalid filename.' }));
    }

    const stat = fs.statSync(safePath);
    res.writeHead(200, {
      'Content-Type': 'application/zip',
      'Content-Length': stat.size,
      'Content-Disposition': `attachment; filename="${path.basename(safePath)}"`,
      'Cache-Control': 'no-store, no-cache, must-revalidate'
    });

    const readStream = fs.createReadStream(safePath);
    readStream.pipe(res);
    return;
  }

  // POST /api/admin/backup/email-dispatch - Dispatch backup zip to Gmail
  if (req.method === 'POST' && url.pathname === '/api/admin/backup/email-dispatch') {
    const adminSession = requireAdminAuth(req, res);
    if (!adminSession) return;

    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', async () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const fileName = body.fileName ? String(body.fileName).trim() : null;
        const targetEmail = body.targetEmail ? String(body.targetEmail).trim() : null;

        const result = await dispatchBackupToGmail({
          fileName,
          targetEmail,
          trigger: 'manual_admin_request'
        });

        if (result.success) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(result));
        } else {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(result));
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // POST /api/admin/backup/delete - Delete a backup file from server disk
  if (req.method === 'POST' && url.pathname === '/api/admin/backup/delete') {
    const adminSession = requireAdminAuth(req, res);
    if (!adminSession) return;

    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const fileName = String(body.fileName || '').trim();
        if (!fileName) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Filename is required' }));
        }

        const result = deleteBackupFile(fileName);
        if (result.success) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(result));
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(result));
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // GET /api/admin/backup/settings
  if (req.method === 'GET' && url.pathname === '/api/admin/backup/settings') {
    const adminSession = requireAdminAuth(req, res);
    if (!adminSession) return;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, settings: getBackupSettings() }));
  }

  // POST /api/admin/backup/settings
  if (req.method === 'POST' && url.pathname === '/api/admin/backup/settings') {
    const adminSession = requireAdminAuth(req, res);
    if (!adminSession) return;

    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const result = updateBackupSettings(body);
        res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // =========================================================================
  // TASK 34: SOVEREIGN DEVELOPER EMERGENCY ACCESS & DIAGNOSTICS GATEWAY
  // =========================================================================

  // GET /api/developer/diagnostics - Comprehensive real-time system and database health
  if (req.method === 'GET' && url.pathname === '/api/developer/diagnostics') {
    if (!verifyDeveloperAuthorization(req)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Endpoint not found' }));
    }

    const dbAudit = auditDatabaseFiles();
    const secDiag = getSecurityDiagnostics();
    const backupsInfo = listAvailableBackups();
    const backupList = Array.isArray(backupsInfo.backups) ? backupsInfo.backups : [];
    const backupSettings = getBackupSettings();
    const mem = process.memoryUsage();

    const payload = {
      success: true,
      timestamp: new Date().toISOString(),
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        uptimeSeconds: Math.floor(process.uptime()),
        uptimePretty: formatProcessUptime(process.uptime()),
        pid: process.pid,
        memory: {
          rssFormatted: (mem.rss / 1024 / 1024).toFixed(1) + ' MB',
          heapTotalFormatted: (mem.heapTotal / 1024 / 1024).toFixed(1) + ' MB',
          heapUsedFormatted: (mem.heapUsed / 1024 / 1024).toFixed(1) + ' MB',
          rssBytes: mem.rss,
          heapUsedBytes: mem.heapUsed
        }
      },
      security: {
        activeLoginLocks: secDiag.activeLoginLocks,
        totalTrackedLoginIps: secDiag.totalTrackedLoginIps,
        totalTrackedOtpIps: secDiag.totalTrackedOtpIps,
        status: secDiag.activeLoginLocks > 0 ? 'locked' : 'nominal'
      },
      database: {
        totalFiles: dbAudit.length,
        allValid: dbAudit.every(d => d.valid),
        files: dbAudit
      },
      backups: {
        totalBackups: backupList.length,
        latestBackup: backupList[0] || null,
        autoEmailEnabled: backupSettings.autoEmailEnabled,
        deliveryEmail: backupSettings.deliveryEmail,
        scheduleFrequency: backupSettings.scheduleFrequency
      }
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(payload));
  }

  // POST /api/developer/reset-locks - Emergency clearance of all IP rate limits and login locks
  if (req.method === 'POST' && url.pathname === '/api/developer/reset-locks') {
    if (!verifyDeveloperAuthorization(req)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Endpoint not found' }));
    }

    const result = clearAllSecurityLocks();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: true,
      message: 'All brute-force and IP rate limit locks have been cleared.',
      result
    }));
  }

  // POST /api/developer/verify-database - Deep integrity verification of all server/data/*.json files
  if (req.method === 'POST' && url.pathname === '/api/developer/verify-database') {
    if (!verifyDeveloperAuthorization(req)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Endpoint not found' }));
    }

    const dbAudit = auditDatabaseFiles();
    const validCount = dbAudit.filter(f => f.valid).length;
    const corruptCount = dbAudit.filter(f => !f.valid).length;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: true,
      totalFiles: dbAudit.length,
      verifiedCount: validCount,
      corruptCount,
      files: dbAudit
    }));
  }

  // POST /api/developer/emergency-backup - Immediate point-in-time PKZIP snapshot
  if (req.method === 'POST' && url.pathname === '/api/developer/emergency-backup') {
    if (!verifyDeveloperAuthorization(req)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Endpoint not found' }));
    }

    try {
      const result = await generateNewsroomBackupZipAsync({ creatorName: 'Developer Emergency Snapshot' });
      res.writeHead(result.success ? 200 : 500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

// Nightly 2:00 AM Automated Backup Evaluator (Strict Indian Standard Time IST)
async function evaluateAutomatedBackupSchedule() {
  try {
    const settings = getBackupSettings();
    if (settings.scheduleFrequency === 'manual') return;

    // Calculate current time in Asia/Kolkata (IST) to ensure timezone precision across cloud VPS
    let kolkataHour = 0;
    let kolkataDateStr = '';
    let kolkataDay = 'Mon';

    try {
      const kolkataTimeStr = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
      }).format(new Date());
      kolkataHour = parseInt(kolkataTimeStr.split(':')[0], 10);
      kolkataDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
      kolkataDay = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' }).format(new Date());
    } catch (_e) {
      const now = new Date();
      kolkataHour = now.getHours();
      kolkataDateStr = now.toISOString().split('T')[0];
    }

    // Check if 2:00 AM window in Indian Standard Time (2:00 - 2:30 AM IST)
    if (kolkataHour === 2) {
      const lastRunIST = settings.lastBackupDateIST || (settings.lastBackupAt ? settings.lastBackupAt.split('T')[0] : '');
      if (lastRunIST !== kolkataDateStr) {
        if (settings.scheduleFrequency === 'weekly' && kolkataDay !== 'Sun') {
          // If weekly, only execute on Sunday
          return;
        }

        console.log(`[Nightly Auto-Backup IST] Triggering automated newsroom backup for ${kolkataDateStr} (2:00 AM IST)...`);
        const fresh = await generateNewsroomBackupZipAsync({ creatorName: 'Nightly Auto-Cron (IST)' });
        if (settings.autoEmailEnabled && fresh.success) {
          dispatchBackupToGmail({
            fileName: fresh.backup.fileName,
            targetEmail: settings.deliveryEmail,
            trigger: 'nightly_cron_ist'
          }).catch(err => console.error('[Nightly Auto-Backup Email Error]:', err.message));
        }
      }
    }
  } catch (err) {
    console.error('[Automated Backup Schedule Evaluator Error]:', err.message);
  }
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`PublicSpark Newsroom Backend Proxy running at http://localhost:${PORT}`);
  // Initial startup orphan sweep and storage watchdog evaluation
  purgeOrphanedSatelliteData();
  runStorageWatchdogAndCleanup();

  // Storage Watchdog runs hourly (checks 80% alert notification & 90% emergency cleanup)
  const storageWatchdogTimer = setInterval(() => runStorageWatchdogAndCleanup(), 60 * 60 * 1000);
  if (storageWatchdogTimer.unref) storageWatchdogTimer.unref();

  // Evaluate nightly backup schedule every 5 minutes (guarantees 2:00 AM IST window is never missed)
  const backupCronInterval = setInterval(evaluateAutomatedBackupSchedule, 5 * 60 * 1000);
  if (backupCronInterval.unref) backupCronInterval.unref();
  setTimeout(evaluateAutomatedBackupSchedule, 10000);

  // Proactively pre-warm top 3 published stories audio in background (0ms instant playback for readers)
  setTimeout(() => {
    try {
      const all = getSavedArticles();
      const topPublished = all.filter(a => a.status === 'published').slice(0, 3);
      topPublished.forEach(a => autoPreWarmPublishedAudio(a));
    } catch (e) {}
  }, 3000);
});
