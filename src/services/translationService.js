/**
 * PublicSpark Translation Engine (Multi-Language Support)
 * Dynamic, multi-tier fallback translation engine with rate-limit protection,
 * request batching, smart paragraph chunking, and memory caching.
 */

import { safeSetCacheItem, touchEphemeralCacheKey, enforceTranslationCacheBudget } from './cacheService.js';

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
    }, 15000);

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
      touchEphemeralCacheKey(cacheKey);
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
        if (result.length < 50000 && safeSetCacheItem(cacheKey, result)) {
          enforceTranslationCacheBudget(cacheKey);
        }
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
      if (fullResult.length < 50000 && safeSetCacheItem(cacheKey, fullResult)) {
        enforceTranslationCacheBudget(cacheKey);
      }
    } catch (e) {}
    return fullResult;
  }

  return cleanText;
}

/**
 * Helper to retrieve a cached translated article object from LocalStorage.
 * Task 33 Subtopic C: Strict Cache Integrity Validator purging false-positive Hindi fallbacks
 */
export function getCachedArticleObject(articleId, targetLang) {
  if (!articleId || !targetLang) return null;
  try {
    const key = `ps_art_obj_${articleId}_${targetLang}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Validate that content is real and not a legacy scraper error string
      const hasError = !parsed ||
        typeof parsed.content !== 'string' ||
        parsed.content.includes('QUERY LENGTH') ||
        parsed.content.includes('MAX ALLOWED QUERY') ||
        parsed.content.includes('MYMEMORY') ||
        parsed.content.includes('[object Object]') ||
        (parsed.title && parsed.title.includes('QUERY LENGTH'));

      if (hasError) {
        localStorage.removeItem(key);
        return null;
      }

      // False-positive script validator:
      // If target is English ('en'), content must not be majority Devanagari script (stale Hindi fallback)
      if (targetLang === 'en' && parsed.content.length > 50) {
        const devanagariCount = (parsed.content.match(/[\u0900-\u097F]/g) || []).length;
        if (devanagariCount > (parsed.content.length * 0.4)) {
          localStorage.removeItem(key);
          return null;
        }
      }

      touchEphemeralCacheKey(key);
      return parsed;
    }
  } catch (e) {}
  return null;
}

/**
 * Task 33 Subtopic C: Purge any legacy poisoned or corrupted translation caches from LocalStorage
 */
export function purgeCorruptedTranslationCache() {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('ps_art_obj_') || k.startsWith('ps_trans_'))) {
        const val = localStorage.getItem(k);
        if (!val || val.includes('QUERY LENGTH') || val.includes('MYMEMORY') || val.includes('[object Object]')) {
          keysToRemove.push(k);
        }
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (e) {}
}

/**
 * Helper to cache a translated article object to LocalStorage with quota eviction guard.
 */
export function cacheArticleObject(articleId, targetLang, translatedArticle) {
  if (!articleId || !targetLang || !translatedArticle) return;
  if (translatedArticle.content && (translatedArticle.content.includes('QUERY LENGTH') || translatedArticle.content.includes('[object Object]'))) return;
  try {
    const key = `ps_art_obj_${articleId}_${targetLang}`;
    const payload = JSON.stringify({ ...translatedArticle, _cachedAt: Date.now() });
    if (payload.length > 500000) return;
    if (safeSetCacheItem(key, payload)) {
      enforceTranslationCacheBudget(key);
    }
  } catch (e) {}
}

/**
 * Translates an article object (title, sub_title, summary, category, and optionally content).
 * Task 33 Subtopic B: Translates summary and highlights in unified payload
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
    // Unified Fast Backend Gemini Translation Call (Translates Title, Summary, Highlights & Body in 1 API Call)
    const backendRes = await fetchWithTimeout(BACKEND_TRANSLATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        article_id: articleId,
        lang: targetLang,
        source_lang: sourceLang,
        title: article.title,
        summary: article.summary || '',
        sub_title: article.sub_title || '',
        highlights: Array.isArray(article.highlights) ? article.highlights : [],
        body: includeContent ? article.content : ''
      })
    }, 75000);

    if (backendRes.ok) {
      const backendData = await backendRes.json();
      if (backendData && backendData.status === 'done' && backendData.body && !backendData.body.includes('QUERY LENGTH')) {
        const result = {
          ...article,
          title: backendData.title || article.title,
          content: backendData.body || article.content,
          highlights: Array.isArray(backendData.highlights) && backendData.highlights.length > 0
            ? backendData.highlights
            : (article.highlights || []),
          summary: backendData.summary || (Array.isArray(backendData.highlights) && backendData.highlights[0]) || article.summary,
          sub_title: backendData.sub_title || (Array.isArray(backendData.highlights) && backendData.highlights[1] ? backendData.highlights[1] : article.sub_title),
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
 * Translates headlines and summaries of front-page articles using a single,
 * ultra-fast, quota-protected batch call or pre-translated disk cache.
 * Eliminates naive 51-request client loops and protects Cloudflare Worker limits.
 */
export async function translateHeadlinesOnly(articles, targetLang) {
  if (!Array.isArray(articles) || articles.length === 0) {
    return articles;
  }

  const normalizedTarget = (targetLang || 'hi').toLowerCase();
  const sourceLang = (articles[0]?.originalLanguage || 'hi').toLowerCase();
  if (normalizedTarget === sourceLang) return articles;

  // 1. Single Fast Request: Retrieve pre-translated articles from backend cache (0ms, 0 AI calls)
  try {
    const res = await fetch(`/api/articles?lang=${encodeURIComponent(normalizedTarget)}`);
    if (res.ok) {
      const backendArticles = await res.json();
      if (Array.isArray(backendArticles) && backendArticles.length > 0) {
        const backendMap = new Map(backendArticles.map(a => [String(a.id), a]));
        let merged = articles.map(art => {
          const preTrans = backendMap.get(String(art.id));
          if (preTrans && preTrans.title && preTrans.title !== art.title) {
            return {
              ...art,
              title: preTrans.title,
              summary: preTrans.summary || art.summary,
              sub_title: preTrans.sub_title || art.sub_title
            };
          }
          return art;
        });

        // 2. Identify top visible stories (max 10) that still need translation
        const uncachedVisible = merged.slice(0, 10).filter(art => {
          const preTrans = backendMap.get(String(art.id));
          // If title didn't change and originalLanguage doesn't match target, it needs translation
          return (!preTrans || preTrans.title === art.title) && (art.originalLanguage || 'hi').toLowerCase() !== normalizedTarget;
        });

        // 3. If uncached visible stories exist, translate them in 1 single Gemini batch call
        if (uncachedVisible.length > 0) {
          try {
            const batchRes = await fetch('/api/translate/batch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                items: uncachedVisible.map(a => ({ id: a.id, title: a.title, summary: a.summary || '' })),
                targetLang: normalizedTarget,
                source_lang: sourceLang
              })
            });
            if (batchRes.ok) {
              const batchData = await batchRes.json();
              if (batchData && Array.isArray(batchData.items)) {
                const batchMap = new Map(batchData.items.map(it => [String(it.id), it]));
                merged = merged.map(art => {
                  const bItem = batchMap.get(String(art.id));
                  if (bItem && bItem.title) {
                    return {
                      ...art,
                      title: bItem.title,
                      summary: bItem.summary || art.summary
                    };
                  }
                  return art;
                });
              }
            }
          } catch (batchErr) {
            console.warn('[Batch Translation Request Error]:', batchErr.message);
          }
        }

        return merged;
      }
    }
  } catch (e) {
    console.warn('[Fetch Pre-translated Articles Error]:', e.message);
  }

  return articles;
}

