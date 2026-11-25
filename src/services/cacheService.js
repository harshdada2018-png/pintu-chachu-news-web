/**
 * PublicSpark Local Caching Service (Stale-While-Revalidate Engine)
 * Caches published articles and breaking news in browser localStorage to save DB bandwidth.
 */

const CACHE_KEYS = {
  ARTICLES: 'ps_cached_articles_v2',
  BREAKING: 'ps_cached_breaking_v2',
  CATEGORIES: 'ps_cached_categories_v2',
  TIMESTAMP: 'ps_cache_timestamp_v2'
};

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache TTL
const TEST_ARTICLE_IDS = new Set(['art-1', 'art-2', 'art-3', 'art-4']);

export function getCachedNews() {
  try {
    const rawTime = localStorage.getItem(CACHE_KEYS.TIMESTAMP);
    const rawArticles = localStorage.getItem(CACHE_KEYS.ARTICLES);

    if (!rawTime || !rawArticles) return null;

    const age = Date.now() - parseInt(rawTime, 10);
    if (age > CACHE_TTL_MS) {
      // Cache expired
      return null;
    }

    const parsed = JSON.parse(rawArticles);
    const sanitized = Array.isArray(parsed)
      ? parsed.filter(a => a && !TEST_ARTICLE_IDS.has(String(a.id)))
      : [];

    return {
      articles: sanitized,
      isStale: age > CACHE_TTL_MS / 2
    };
  } catch (err) {
    console.warn('Cache read error:', err);
    return null;
  }
}

export function saveNewsToCache(articles) {
  try {
    localStorage.setItem(CACHE_KEYS.ARTICLES, JSON.stringify(articles));
    localStorage.setItem(CACHE_KEYS.TIMESTAMP, Date.now().toString());
  } catch (err) {
    console.warn('Cache write error:', err);
  }
}

export function clearNewsCache() {
  try {
    localStorage.removeItem(CACHE_KEYS.ARTICLES);
    localStorage.removeItem(CACHE_KEYS.TIMESTAMP);
  } catch (err) {
    console.warn('Cache clear error:', err);
  }
}

export function getCachedCategories() {
  try {
    const raw = localStorage.getItem(CACHE_KEYS.CATEGORIES);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn('Categories cache read error:', err);
    return null;
  }
}

export function saveCategoriesToCache(categories) {
  try {
    localStorage.setItem(CACHE_KEYS.CATEGORIES, JSON.stringify(categories));
  } catch (err) {
    console.warn('Categories cache write error:', err);
  }
}

/**
 * Calculates current client-side storage usage (localStorage + sessionStorage) in KB & MB.
 */
export function getClientStorageStats() {
  let localBytes = 0;
  let sessionBytes = 0;
  let localKeysCount = 0;
  let sessionKeysCount = 0;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        localKeysCount++;
        const val = localStorage.getItem(key) || '';
        localBytes += key.length + val.length;
      }
    }
  } catch (e) {
    console.warn('Error reading localStorage size:', e);
  }

  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key) {
        sessionKeysCount++;
        const val = sessionStorage.getItem(key) || '';
        sessionBytes += key.length + val.length;
      }
    }
  } catch (e) {
    console.warn('Error reading sessionStorage size:', e);
  }

  const totalBytes = localBytes + sessionBytes;
  const totalItems = localKeysCount + sessionKeysCount;
  const formattedSize = totalBytes >= 1048576 
    ? (totalBytes / (1024 * 1024)).toFixed(2) + ' MB'
    : (totalBytes / 1024).toFixed(1) + ' KB';

  return {
    localKb: (localBytes / 1024).toFixed(2),
    sessionKb: (sessionBytes / 1024).toFixed(2),
    totalMb: (totalBytes / (1024 * 1024)).toFixed(3),
    totalKb: (totalBytes / 1024).toFixed(2),
    totalItems,
    formattedSize,
    localKeysCount,
    sessionKeysCount,
    // 5MB is typical browser origin limit for localStorage
    usagePercent: Math.min(100, parseFloat(((totalBytes / (5 * 1024 * 1024)) * 100).toFixed(1)))
  };
}

/**
 * Purges all publicspark cached news, translations, and audio entries from localStorage & sessionStorage.
 */
export function purgeClientCache() {
  try {
    // Keys matching prefix ps_
    const localKeysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('ps_') || key.includes('cache') || key.includes('trans'))) {
        localKeysToRemove.push(key);
      }
    }
    localKeysToRemove.forEach(k => localStorage.removeItem(k));

    const sessionKeysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (key.startsWith('ps_') || key.includes('cache') || key.includes('audio'))) {
        sessionKeysToRemove.push(key);
      }
    }
    sessionKeysToRemove.forEach(k => sessionStorage.removeItem(k));

    return { success: true, removedCount: localKeysToRemove.length + sessionKeysToRemove.length };
  } catch (err) {
    console.error('Client cache purge error:', err);
    return { success: false, error: err.message };
  }
}


