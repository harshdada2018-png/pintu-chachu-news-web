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
const TRANSLATION_KEY_PREFIXES = ['ps_trans_', 'ps_art_obj_'];
const AUDIO_LOCAL_CACHE_PREFIXES = ['ps_audio_cache_v1_', 'ps_audio_pos_v1_'];
const MAX_EPHEMERAL_TRANSLATION_BYTES = 2 * 1024 * 1024; // 2 MB UTF-16 budget out of ~5 MB origin quota
const MAX_TRANSLATION_KEYS = 80;
const ephemeralAccessOrder = new Map();

function isQuotaExceededError(err) {
  if (!err) return false;
  return (
    err.name === 'QuotaExceededError' ||
    err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    err.code === 22 ||
    err.code === 1014 ||
    (typeof err.message === 'string' && /quota/i.test(err.message))
  );
}

function estimateKeyValueBytes(key, value) {
  return ((key ? key.length : 0) + (value ? value.length : 0)) * 2;
}

function isTranslationCacheKey(key) {
  return Boolean(key && TRANSLATION_KEY_PREFIXES.some(prefix => key.startsWith(prefix)));
}

function isAudioCacheKey(key) {
  return Boolean(key && AUDIO_LOCAL_CACHE_PREFIXES.some(prefix => key.startsWith(prefix)));
}

function readCachedTimestamp(key, rawValue) {
  if (ephemeralAccessOrder.has(key)) {
    return ephemeralAccessOrder.get(key);
  }
  if (key.startsWith('ps_art_obj_') && rawValue) {
    try {
      const parsed = JSON.parse(rawValue);
      if (parsed && typeof parsed._cachedAt === 'number') {
        return parsed._cachedAt;
      }
    } catch (_err) {
      // Malformed payload sorts as oldest (0) so it gets evicted first
    }
  }
  return 0;
}

export function touchEphemeralCacheKey(key) {
  if (!key) return;
  ephemeralAccessOrder.set(key, Date.now());
}

/**
 * Evicts oldest replaceable localStorage caches (translations, then audio, optionally feed)
 * without ever deleting offline bookmarks, auth tokens, drafts, votes, likes, or theme settings.
 */
export function evictEphemeralCache({ targetBytesToFree = 262144, preserveKey = '', includeFeed = false } = {}) {
  let removedCount = 0;
  let freedBytes = 0;

  try {
    if (typeof localStorage === 'undefined') return { removedCount, freedBytes };

    const translationCandidates = [];
    const audioCandidates = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || key === preserveKey) continue;
      const val = localStorage.getItem(key) || '';
      const bytes = estimateKeyValueBytes(key, val);

      if (isTranslationCacheKey(key)) {
        translationCandidates.push({
          key,
          bytes,
          lastAccessed: readCachedTimestamp(key, val)
        });
      } else if (isAudioCacheKey(key)) {
        audioCandidates.push({
          key,
          bytes,
          lastAccessed: readCachedTimestamp(key, '')
        });
      }
    }

    // Oldest accessed first; tie-break largest entries first to reclaim quota quickly
    translationCandidates.sort((a, b) => (a.lastAccessed - b.lastAccessed) || (b.bytes - a.bytes));
    for (const entry of translationCandidates) {
      if (freedBytes >= targetBytesToFree) break;
      localStorage.removeItem(entry.key);
      ephemeralAccessOrder.delete(entry.key);
      freedBytes += entry.bytes;
      removedCount++;
    }

    if (freedBytes < targetBytesToFree) {
      audioCandidates.sort((a, b) => (a.lastAccessed - b.lastAccessed) || (b.bytes - a.bytes));
      for (const entry of audioCandidates) {
        if (freedBytes >= targetBytesToFree) break;
        localStorage.removeItem(entry.key);
        ephemeralAccessOrder.delete(entry.key);
        freedBytes += entry.bytes;
        removedCount++;
      }
    }

    if (includeFeed && freedBytes < targetBytesToFree && preserveKey !== CACHE_KEYS.ARTICLES) {
      const rawArticles = localStorage.getItem(CACHE_KEYS.ARTICLES);
      const rawTimestamp = localStorage.getItem(CACHE_KEYS.TIMESTAMP);
      if (rawArticles) {
        freedBytes += estimateKeyValueBytes(CACHE_KEYS.ARTICLES, rawArticles);
        localStorage.removeItem(CACHE_KEYS.ARTICLES);
        removedCount++;
      }
      if (rawTimestamp) {
        freedBytes += estimateKeyValueBytes(CACHE_KEYS.TIMESTAMP, rawTimestamp);
        localStorage.removeItem(CACHE_KEYS.TIMESTAMP);
        removedCount++;
      }
    }
  } catch (err) {
    console.warn('Cache eviction error:', err);
  }

  return { removedCount, freedBytes };
}

/**
 * Keeps translation cache entries within a safe budget (2 MB / 80 items)
 * before browser ~5 MB origin quota exhaustion affects bookmarks or settings.
 */
export function enforceTranslationCacheBudget(preserveKey = '') {
  try {
    if (typeof localStorage === 'undefined') return 0;

    const entries = [];
    let totalBytes = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!isTranslationCacheKey(key)) continue;
      const val = localStorage.getItem(key) || '';
      const bytes = estimateKeyValueBytes(key, val);
      totalBytes += bytes;
      entries.push({
        key,
        bytes,
        lastAccessed: readCachedTimestamp(key, val)
      });
    }

    if (entries.length <= MAX_TRANSLATION_KEYS && totalBytes <= MAX_EPHEMERAL_TRANSLATION_BYTES) {
      return 0;
    }

    const targetKeys = Math.floor(MAX_TRANSLATION_KEYS * 0.75);
    const targetBytes = Math.floor(MAX_EPHEMERAL_TRANSLATION_BYTES * 0.75);
    entries.sort((a, b) => (a.lastAccessed - b.lastAccessed) || (b.bytes - a.bytes));

    let currentCount = entries.length;
    let currentBytes = totalBytes;
    let removed = 0;

    for (const entry of entries) {
      if (currentCount <= targetKeys && currentBytes <= targetBytes) break;
      if (entry.key === preserveKey) continue;
      localStorage.removeItem(entry.key);
      ephemeralAccessOrder.delete(entry.key);
      currentCount--;
      currentBytes -= entry.bytes;
      removed++;
    }

    return removed;
  } catch (_err) {
    return 0;
  }
}

/**
 * Writes to localStorage with automatic oldest-cache eviction on QuotaExceededError.
 */
export function safeSetCacheItem(key, value, { preserveKey = key, includeFeedOnRetry = true } = {}) {
  try {
    localStorage.setItem(key, value);
    if (isTranslationCacheKey(key)) {
      touchEphemeralCacheKey(key);
    }
    return true;
  } catch (err) {
    if (!isQuotaExceededError(err)) {
      console.warn('Cache write error:', err);
      return false;
    }

    const neededBytes = estimateKeyValueBytes(key, value) + 65536;
    evictEphemeralCache({
      targetBytesToFree: Math.max(neededBytes, 262144),
      preserveKey,
      includeFeed: false
    });

    try {
      localStorage.setItem(key, value);
      if (isTranslationCacheKey(key)) {
        touchEphemeralCacheKey(key);
      }
      return true;
    } catch (retryErr) {
      if (includeFeedOnRetry && isQuotaExceededError(retryErr)) {
        evictEphemeralCache({
          targetBytesToFree: Math.max(neededBytes, 524288),
          preserveKey,
          includeFeed: true
        });
        try {
          localStorage.setItem(key, value);
          if (isTranslationCacheKey(key)) {
            touchEphemeralCacheKey(key);
          }
          return true;
        } catch (_finalErr) {
          return false;
        }
      }
      return false;
    }
  }
}

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
    const serialized = JSON.stringify(articles);
    let saved = safeSetCacheItem(CACHE_KEYS.ARTICLES, serialized, {
      preserveKey: CACHE_KEYS.ARTICLES,
      includeFeedOnRetry: false
    });

    if (!saved && Array.isArray(articles) && articles.length > 30) {
      const compactSerialized = JSON.stringify(articles.slice(0, 30));
      saved = safeSetCacheItem(CACHE_KEYS.ARTICLES, compactSerialized, {
        preserveKey: CACHE_KEYS.ARTICLES,
        includeFeedOnRetry: false
      });
    }

    if (saved) {
      safeSetCacheItem(CACHE_KEYS.TIMESTAMP, Date.now().toString(), {
        preserveKey: CACHE_KEYS.ARTICLES,
        includeFeedOnRetry: false
      });
    }
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
    safeSetCacheItem(CACHE_KEYS.CATEGORIES, JSON.stringify(categories), {
      preserveKey: CACHE_KEYS.CATEGORIES,
      includeFeedOnRetry: true
    });
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

const PROTECTED_USER_KEY_PREFIXES = [
  'ps_offline_saved_stories_v1',
  'ps_bookmark_',
  'ps_theme_',
  'ps_typography_',
  'ps_social_',
  'ps_like_',
  'ps_news_poll_vote_',
  'ps_reporter_',
  'ps_pending_',
  'ps_rejected_',
  'ps_staff_'
];

function isProtectedUserKey(key) {
  return Boolean(key && PROTECTED_USER_KEY_PREFIXES.some(prefix => key.startsWith(prefix)));
}

/**
 * Purges replaceable publicspark cached news, translations, and audio entries from localStorage & sessionStorage
 * while keeping offline bookmarks and user settings intact.
 */
export function purgeClientCache() {
  try {
    const localKeysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !isProtectedUserKey(key) && (key.startsWith('ps_') || key.includes('cache') || key.includes('trans'))) {
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


