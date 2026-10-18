/**
 * PublicSpark Translation Engine (Multi-Language Support)
 * Dynamic, multi-tier fallback translation engine with rate-limit protection,
 * request batching, smart paragraph chunking, and memory caching.
 */

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'hi', name: 'Hindi', native: 'हिंदी' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'or', name: 'Odia', native: 'ଓଡ଼ିଆ' },
  { code: 'as', name: 'Assamese', native: 'অসমীয়া' },
  { code: 'ur', name: 'Urdu', native: 'اردو' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'it', name: 'Italian', native: 'Italiano' },
  { code: 'ja', name: 'Japanese', native: '日本語' },
  { code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia' },
  { code: 'zh-TW', name: 'Chinese (Taiwan)', native: '繁體中文' },
  { code: 'ru', name: 'Russian', native: 'Русский' }
];

const BACKEND_TRANSLATE_URL = (import.meta.env && import.meta.env.VITE_TRANSLATE_API_URL) || '/api/translate';
const translationMemoryCache = new Map();

// Automatically cleanse any corrupted scraper error strings from browser localStorage
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('ps_art_obj_') || k.startsWith('ps_trans_'))) {
        const val = localStorage.getItem(k);
        if (val && (val.includes('QUERY LENGTH') || val.includes('MAX ALLOWED QUERY') || val.includes('MYMEMORY'))) {
          keysToRemove.push(k);
        }
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    if (keysToRemove.length > 0) {
      console.log(`[Cache Cleanup] Purged ${keysToRemove.length} stale/corrupted legacy translation cache items.`);
    }
  } catch (e) {}
}

function generateCacheKey(text, targetLang) {
  if (!text) return `ps_trans_${targetLang}_empty`;
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return `ps_trans_${targetLang}_${text.length}_${Math.abs(hash)}`;
}

/**
 * Fetch with automatic timeout (default 15000ms for AI inference)
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

/**
 * Translation worker (strictly calling backend Gemini endpoint, zero unofficial scrapers)
 */
async function translateSingleChunk(cleanText, targetLang, sourceLang = 'hi') {
  if (!cleanText || targetLang === sourceLang) return cleanText;
  const targetCode = (targetLang === 'zh-TW' || targetLang === 'zh-tw') ? 'zh-TW' : targetLang;

  try {
    const res = await fetchWithTimeout(BACKEND_TRANSLATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: cleanText, targetLang: targetCode, source_lang: sourceLang })
    }, 8000);

    if (res.ok) {
      const data = await res.json();
      if (data && data.translatedText && data.translatedText !== cleanText) {
        return data.translatedText;
      }
    }
  } catch (e) {
    console.warn('[Gemini Translation Request]', e.message);
  }

  return cleanText;
}

/**
 * Translates a text string instantly into target language.
 * Uses smart paragraph grouping for long text to avoid high HTTP request counts.
 */
export async function translateText(text, targetLang, sourceLang = 'hi') {
  if (!text || !text.trim() || targetLang === sourceLang) return text;

  const cleanText = text.trim();
  const cacheKey = generateCacheKey(cleanText, targetLang);

  // 1. Check Memory Cache
  if (translationMemoryCache.has(cacheKey)) {
    const cached = translationMemoryCache.get(cacheKey);
    if (cached && cached !== cleanText) return cached;
  }

  // 2. Check Local Storage Cache
  try {
    const localCached = localStorage.getItem(cacheKey);
    if (localCached && (localCached.includes('QUERY LENGTH') || localCached.includes('MAX ALLOWED QUERY') || localCached.includes('MYMEMORY'))) {
      localStorage.removeItem(cacheKey);
    } else if (localCached && localCached !== cleanText) {
      translationMemoryCache.set(cacheKey, localCached);
      return localCached;
    }
  } catch (e) {}

  // 3. For short text <= 800 chars, perform direct single-chunk translation
  if (cleanText.length <= 800) {
    const result = await translateSingleChunk(cleanText, targetLang);
    if (result && result !== cleanText && !result.includes('QUERY LENGTH') && !result.includes('MYMEMORY')) {
      translationMemoryCache.set(cacheKey, result);
      try {
        if (result.length < 50000) localStorage.setItem(cacheKey, result);
      } catch (e) {}
      return result;
    }
    return cleanText;
  }

  // 4. For long text (> 800 chars), group paragraphs into ~900 char chunks to minimize requests
  const paragraphs = cleanText.split(/\n+/);
  const chunks = [];
  let currentChunk = '';

  for (const p of paragraphs) {
    if ((currentChunk + '\n' + p).length > 900) {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = p;
    } else {
      currentChunk = currentChunk ? (currentChunk + '\n' + p) : p;
    }
  }
  if (currentChunk) chunks.push(currentChunk);

  // Translate chunks sequentially with slight pause to prevent rate-limiting
  const translatedChunks = [];
  for (let i = 0; i < chunks.length; i++) {
    const tChunk = await translateSingleChunk(chunks[i], targetLang);
    if (tChunk && !tChunk.includes('QUERY LENGTH')) {
      translatedChunks.push(tChunk);
    } else {
      translatedChunks.push(chunks[i]);
    }
    if (i < chunks.length - 1) {
      await new Promise(r => setTimeout(r, 40));
    }
  }

  const fullResult = translatedChunks.join('\n\n');
  if (fullResult && fullResult !== cleanText && !fullResult.includes('QUERY LENGTH')) {
    translationMemoryCache.set(cacheKey, fullResult);
    try {
      if (fullResult.length < 50000) localStorage.setItem(cacheKey, fullResult);
    } catch (e) {}
    return fullResult;
  }

  return cleanText;
}

/**
 * Helper to retrieve a cached translated article object from LocalStorage.
 */
export function getCachedArticleObject(articleId, targetLang) {
  if (!articleId || !targetLang) return null;
  try {
    const key = `ps_art_obj_${articleId}_${targetLang}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Validate that content is real and not a legacy scraper error string
      if (
        !parsed ||
        typeof parsed.content !== 'string' ||
        parsed.content.includes('QUERY LENGTH') ||
        parsed.content.includes('MAX ALLOWED QUERY') ||
        parsed.content.includes('MYMEMORY') ||
        (parsed.title && parsed.title.includes('QUERY LENGTH'))
      ) {
        localStorage.removeItem(key);
        return null;
      }
      return parsed;
    }
  } catch (e) {}
  return null;
}

/**
 * Helper to cache a translated article object to LocalStorage.
 */
export function cacheArticleObject(articleId, targetLang, translatedArticle) {
  if (!articleId || !targetLang || !translatedArticle) return;
  if (translatedArticle.content && translatedArticle.content.includes('QUERY LENGTH')) return;
  try {
    localStorage.setItem(`ps_art_obj_${articleId}_${targetLang}`, JSON.stringify(translatedArticle));
  } catch (e) {}
}

/**
 * Translates an article object (title, sub_title, summary, category, and optionally content).
 */
export async function translateArticle(article, targetLang, options = { includeContent: true }) {
  const sourceLang = (article?.originalLanguage || 'hi').toLowerCase();
  if (!article || targetLang === sourceLang) return article;

  const includeContent = options.includeContent !== false;
  const articleId = article.id || article.slug;

  // Check LocalStorage Cache for 0ms instant retrieval
  const cached = getCachedArticleObject(articleId, targetLang);
  if (cached && (!includeContent || (includeContent && cached.content && !cached.content.includes('QUERY LENGTH')))) {
    return cached;
  }

  try {
    // Unified Fast Backend Gemini Translation Call (Translates Title, Highlights & Body in 1 API Call)
    const backendRes = await fetchWithTimeout(BACKEND_TRANSLATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        article_id: articleId,
        lang: targetLang,
        source_lang: sourceLang,
        title: article.title,
        highlights: Array.isArray(article.highlights) ? article.highlights : [],
        body: includeContent ? article.content : ''
      })
    }, 30000);

    if (backendRes.ok) {
      const backendData = await backendRes.json();
      if (backendData && backendData.status === 'done' && backendData.body && !backendData.body.includes('QUERY LENGTH')) {
        const result = {
          ...article,
          title: backendData.title || article.title,
          content: backendData.body || article.content,
          highlights: Array.isArray(backendData.highlights) ? backendData.highlights : (article.highlights || []),
          summary: article.summary,
          sub_title: article.sub_title,
          originalLanguage: article.originalLanguage || 'hi',
          currentLanguage: targetLang
        };
        cacheArticleObject(articleId, targetLang, result);
        return result;
      }
    }

    // Rule: If translation failed or validation failed, do NOT save anything; cleanly return original Hindi article
    return article;
  } catch (err) {
    console.warn('Translation call failed or timed out. Serving original Hindi article:', err.message);
    return article;
  }
}

/**
 * Translates ONLY the titles/headlines of articles for ultra-fast front-page rendering.
 */
export async function translateHeadlinesOnly(articles, targetLang) {
  if (!Array.isArray(articles) || articles.length === 0) {
    return articles;
  }

  return Promise.all(
    articles.map(async art => {
      const sourceLang = (art.originalLanguage || 'hi').toLowerCase();
      if (targetLang === sourceLang) return art;

      const articleId = art.id || art.slug;
      const cached = getCachedArticleObject(articleId, targetLang);
      if (cached && cached.title) {
        return { ...art, title: cached.title };
      }
      try {
        const translatedTitle = await translateText(art.title, targetLang, sourceLang);
        return { ...art, title: translatedTitle || art.title };
      } catch (e) {
        return art;
      }
    })
  );
}

