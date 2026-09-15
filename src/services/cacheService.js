/**
 * PublicSpark Local Caching Service (Stale-While-Revalidate Engine)
 * Caches published articles and breaking news in browser localStorage to save DB bandwidth.
 */

const CACHE_KEYS = {
  ARTICLES: 'ps_cached_articles_v1',
  BREAKING: 'ps_cached_breaking_v1',
  CATEGORIES: 'ps_cached_categories_v1',
  TIMESTAMP: 'ps_cache_timestamp_v1'
};

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache TTL

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

    return {
      articles: JSON.parse(rawArticles),
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

