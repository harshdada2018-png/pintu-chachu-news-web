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
];

const BACKEND_TRANSLATE_URL = (import.meta.env && import.meta.env.VITE_TRANSLATE_API_URL) || '/api/translate';
const translationMemoryCache = new Map();

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
 * Fetch with automatic timeout (default 1800ms)
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 1800) {
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
 * Single-chunk multi-tier translation worker
 */
async function translateSingleChunk(cleanText, targetLang) {
  if (!cleanText || targetLang === 'en') return cleanText;
  const targetCode = (targetLang === 'zh-TW' || targetLang === 'zh-tw') ? 'zh-TW' : targetLang;

  // Tier 1: MyMemory Translation API (Instant 200ms response, 100% CORS-friendly for all Indian & Global languages)
  try {
    const myMemoryUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanText.slice(0, 800))}&langpair=en|${encodeURIComponent(targetCode)}`;
    const mmRes = await fetchWithTimeout(myMemoryUrl, {}, 2000);
    if (mmRes.ok) {
      const mmData = await mmRes.json();
      if (mmData && mmData.responseData && mmData.responseData.translatedText) {
        const translated = mmData.responseData.translatedText;
        if (translated && translated.trim() && translated.trim() !== cleanText && !translated.includes('MYMEMORY WARNING')) {
          return translated.trim();
        }
      }
    }
  } catch (e) {}

  // Tier 2: Classic Google GTX Endpoint (translate.googleapis.com)
  try {
    const gtxUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetCode)}&dt=t&q=${encodeURIComponent(cleanText.slice(0, 1500))}`;
    const gtxRes = await fetchWithTimeout(gtxUrl, {}, 1500);
    if (gtxRes.ok) {
      const gtxData = await gtxRes.json();
      if (Array.isArray(gtxData) && Array.isArray(gtxData[0])) {
        const translated = gtxData[0].map(item => (item && item[0]) ? item[0] : '').join('');
        if (translated && translated.trim() && translated.trim() !== cleanText) {
          return translated.trim();
        }
      }
    }
  } catch (e) {}

  // Tier 3: Clients5 Chrome Extension Translate Endpoint (clients5.google.com)
  try {
    const clients5Url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=${encodeURIComponent(targetCode)}&q=${encodeURIComponent(cleanText.slice(0, 1500))}`;
    const c5Res = await fetchWithTimeout(clients5Url, {}, 1500);
    if (c5Res.ok) {
      const data = await c5Res.json();
      let translated = '';
      if (Array.isArray(data) && data.length > 0) {
        if (typeof data[0] === 'string') {
          translated = data[0];
        } else if (Array.isArray(data[0])) {
          translated = data[0].map(item => (Array.isArray(item) ? item[0] : item)).join(' ');
        }
      }
      if (translated && translated.trim() && translated.trim() !== cleanText) {
        return translated.trim();
      }
    }
  } catch (e) {}

  // Tier 4: Backend Proxy (/api/translate)
  try {
    const res = await fetchWithTimeout(BACKEND_TRANSLATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: cleanText, targetLang: targetCode })
    }, 1200);

    if (res.ok) {
      const data = await res.json();
      if (data && data.translatedText && data.translatedText !== cleanText) {
        return data.translatedText;
      }
    }
  } catch (e) {}

  return cleanText;
}

/**
 * Translates a text string instantly into target language.
 * Uses smart paragraph grouping for long text to avoid high HTTP request counts.
 */
export async function translateText(text, targetLang) {
  if (!text || !text.trim() || targetLang === 'en') return text;

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
    if (localCached && localCached !== cleanText) {
      translationMemoryCache.set(cacheKey, localCached);
      return localCached;
    }
  } catch (e) {}

  // 3. For short text <= 800 chars, perform direct single-chunk translation
  if (cleanText.length <= 800) {
    const result = await translateSingleChunk(cleanText, targetLang);
    if (result && result !== cleanText) {
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
    translatedChunks.push(tChunk);
    if (i < chunks.length - 1) {
      await new Promise(r => setTimeout(r, 40));
    }
  }

  const fullResult = translatedChunks.join('\n\n');
  if (fullResult && fullResult !== cleanText) {
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
  if (!articleId || !targetLang || targetLang === 'en') return null;
  try {
    const raw = localStorage.getItem(`ps_art_obj_${articleId}_${targetLang}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {}
  return null;
}

/**
 * Helper to cache a translated article object to LocalStorage.
 */
export function cacheArticleObject(articleId, targetLang, translatedArticle) {
  if (!articleId || !targetLang || targetLang === 'en' || !translatedArticle) return;
  try {
    localStorage.setItem(`ps_art_obj_${articleId}_${targetLang}`, JSON.stringify(translatedArticle));
  } catch (e) {}
}

/**
 * Translates an article object (title, sub_title, summary, category, and optionally content).
 */
export async function translateArticle(article, targetLang, options = { includeContent: true }) {
  if (!article || targetLang === 'en') return article;

  const includeContent = options.includeContent !== false;
  const articleId = article.id || article.slug;

  // Check LocalStorage Cache for 0ms instant retrieval
  const cached = getCachedArticleObject(articleId, targetLang);
  if (cached && (!includeContent || (includeContent && cached.content))) {
    return cached;
  }

  try {
    const [translatedTitle, translatedSubTitle, translatedSummary, translatedCategory] = await Promise.all([
      translateText(article.title, targetLang),
      article.sub_title ? translateText(article.sub_title, targetLang) : Promise.resolve(''),
      article.summary ? translateText(article.summary, targetLang) : Promise.resolve(''),
      article.category ? translateText(article.category, targetLang) : Promise.resolve('')
    ]);

    let translatedContent = article.content;
    if (includeContent && article.content) {
      translatedContent = await translateText(article.content, targetLang);
    }

    const result = {
      ...article,
      title: translatedTitle || article.title,
      sub_title: translatedSubTitle || article.sub_title,
      summary: translatedSummary || article.summary,
      content: translatedContent || article.content,
      category: translatedCategory || article.category,
      originalLanguage: article.originalLanguage || 'en',
      currentLanguage: targetLang
    };

    cacheArticleObject(articleId, targetLang, result);
    return result;
  } catch (err) {
    console.error('Error translating article:', err);
    return article;
  }
}

/**
 * Translates ONLY the titles/headlines of articles for ultra-fast front-page rendering.
 */
export async function translateHeadlinesOnly(articles, targetLang) {
  if (!Array.isArray(articles) || articles.length === 0 || targetLang === 'en') {
    return articles;
  }

  return Promise.all(
    articles.map(async art => {
      const articleId = art.id || art.slug;
      const cached = getCachedArticleObject(articleId, targetLang);
      if (cached && cached.title) {
        return { ...art, title: cached.title };
      }
      try {
        const translatedTitle = await translateText(art.title, targetLang);
        return { ...art, title: translatedTitle || art.title };
      } catch (e) {
        return art;
      }
    })
  );
}

