/**
 * PublicSpark Newsroom — Offline Bookmark & Storage Service (Task 28 Subtopic A)
 * Sovereign local storage engine persisting complete article snapshots for offline reading.
 * Zero external cloud dependencies, zero quota leakage, and 100% device privacy.
 */

import { safeSetCacheItem } from './cacheService.js';

export const OFFLINE_STORIES_KEY = 'ps_offline_saved_stories_v1';
export const LEGACY_BOOKMARK_PREFIX = 'ps_bookmark_';
export const MAX_OFFLINE_STORIES = 50;

function hasValidArticleId(id) {
  return id !== undefined && id !== null && String(id).trim() !== '';
}

/**
 * Safe localStorage detection
 */
function isStorageAvailable() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const testKey = '__ps_storage_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch (_err) {
    return false;
  }
}

/**
 * Dispatch an in-window event whenever offline bookmarks change
 */
function notifyBookmarksChanged(action, articleId) {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(
        new CustomEvent('ps_offline_bookmarks_changed', {
          detail: { action, articleId, timestamp: Date.now() }
        })
      );
    } catch (_err) {
      // Non-blocking event dispatch
    }
  }
}

/**
 * Sanitize and serialize an article into a self-contained offline reading payload
 */
export function serializeArticleForOffline(article) {
  if (!article || !hasValidArticleId(article.id)) return null;

  return {
    id: String(article.id),
    title: String(article.title || 'Untitled Article').trim(),
    slug: String(article.slug || article.id),
    summary: String(article.summary || article.sub_title || '').trim(),
    sub_title: String(article.sub_title || article.summary || '').trim(),
    content: String(article.content || '').trim(),
    category: String(article.category || 'General'),
    category_slug: String(article.category_slug || 'general'),
    author: {
      name: article.author?.name || 'PublicSpark Desk',
      role: article.author?.role || 'Staff Reporter',
      avatar: article.author?.avatar || null
    },
    published_at: String(article.published_at || 'Recently Published'),
    featured_image: String(article.featured_image || '').trim(),
    image_caption: String(article.image_caption || '').trim(),
    media_credits: String(article.media_credits || '').trim(),
    video_url: article.video_url || null,
    reading_time_mins: Number(article.reading_time_mins) || 2,
    word_count: Number(article.word_count) || (article.content ? article.content.split(/\s+/).length : 0),
    originalLanguage: String(article.originalLanguage || 'hi'),
    format: String(article.format || 'standard'),
    fact_check: article.fact_check || null,
    sources: Array.isArray(article.sources) ? article.sources : [],
    saved_at: new Date().toISOString(),
    offline_version: 1
  };
}

/**
 * Retrieve all offline-saved articles, sorted by saved_at (latest saved first)
 * @returns {Array<Object>} List of offline articles
 */
export function getOfflineArticles() {
  if (!isStorageAvailable()) return [];

  try {
    const raw = window.localStorage.getItem(OFFLINE_STORIES_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(item => item && item.id && item.title)
      .sort((a, b) => {
        const timeA = new Date(a.saved_at || 0).getTime();
        const timeB = new Date(b.saved_at || 0).getTime();
        return timeB - timeA;
      });
  } catch (err) {
    console.warn('[BookmarkStorage] Failed to parse offline articles:', err);
    return [];
  }
}

/**
 * Check if a specific article is saved offline
 * @param {string|number} articleId
 * @returns {boolean}
 */
export function isArticleOffline(articleId) {
  if (!hasValidArticleId(articleId) || !isStorageAvailable()) return false;

  const strId = String(articleId);

  // Authoritative check: verify snapshot actually exists in OFFLINE_STORIES_KEY
  const offlineArticles = getOfflineArticles();
  return offlineArticles.some(a => String(a.id) === strId);
}

/**
 * Save an article snapshot for offline reading
 * @param {Object} article 
 * @returns {{ success: boolean, count: number, article?: Object, error?: string }}
 */
export function saveArticleOffline(article) {
  if (!isStorageAvailable()) {
    return { success: false, count: 0, error: 'Storage not available' };
  }

  const serialized = serializeArticleForOffline(article);
  if (!serialized) {
    return { success: false, count: 0, error: 'Invalid article payload' };
  }

  try {
    const current = getOfflineArticles();
    // Filter out existing version if re-saving
    const filtered = current.filter(a => String(a.id) !== serialized.id);

    // Prepend new snapshot at top
    let candidate = serialized;
    const withNew = [candidate, ...filtered].slice(0, MAX_OFFLINE_STORIES);

    let saved = safeSetCacheItem(OFFLINE_STORIES_KEY, JSON.stringify(withNew), {
      preserveKey: OFFLINE_STORIES_KEY,
      includeFeedOnRetry: true
    });

    // If quota still fails due to oversized inline base64 featured_image, strip data: URI and retry
    if (!saved && candidate.featured_image && candidate.featured_image.startsWith('data:image/')) {
      candidate = { ...candidate, featured_image: '' };
      const compactWithNew = [candidate, ...filtered].slice(0, MAX_OFFLINE_STORIES);
      saved = safeSetCacheItem(OFFLINE_STORIES_KEY, JSON.stringify(compactWithNew), {
        preserveKey: OFFLINE_STORIES_KEY,
        includeFeedOnRetry: true
      });
    }

    if (!saved) {
      return { success: false, count: current.length, error: 'Browser storage quota exceeded' };
    }

    // Synchronize legacy flag for backwards compatibility
    safeSetCacheItem(`${LEGACY_BOOKMARK_PREFIX}${candidate.id}`, 'true', {
      preserveKey: OFFLINE_STORIES_KEY,
      includeFeedOnRetry: true
    });

    notifyBookmarksChanged('saved', candidate.id);

    return { success: true, count: withNew.length, article: candidate };
  } catch (err) {
    console.error('[BookmarkStorage] Failed to save article offline:', err);
    return { success: false, count: 0, error: err.message };
  }
}

/**
 * Remove an article from offline storage
 * @param {string|number} articleId 
 * @returns {{ success: boolean, count: number }}
 */
export function removeArticleOffline(articleId) {
  if (!hasValidArticleId(articleId) || !isStorageAvailable()) {
    return { success: false, count: 0 };
  }

  const strId = String(articleId);

  try {
    const current = getOfflineArticles();
    const filtered = current.filter(a => String(a.id) !== strId);

    safeSetCacheItem(OFFLINE_STORIES_KEY, JSON.stringify(filtered), {
      preserveKey: OFFLINE_STORIES_KEY,
      includeFeedOnRetry: false
    });
    window.localStorage.setItem(`${LEGACY_BOOKMARK_PREFIX}${strId}`, 'false');

    notifyBookmarksChanged('removed', strId);

    return { success: true, count: filtered.length };
  } catch (err) {
    console.error('[BookmarkStorage] Failed to remove offline article:', err);
    return { success: false, count: 0 };
  }
}

/**
 * Toggle an article's offline saved status
 * @param {Object} article 
 * @returns {{ isSaved: boolean, count: number, error?: string }}
 */
export function toggleArticleOffline(article) {
  if (!article || !hasValidArticleId(article.id)) return { isSaved: false, count: 0, error: 'Invalid article' };

  const strId = String(article.id);
  const currentlySaved = isArticleOffline(strId);

  if (currentlySaved) {
    const res = removeArticleOffline(strId);
    return { isSaved: false, count: res.count };
  } else {
    const res = saveArticleOffline(article);
    return { isSaved: res.success, count: res.count, error: res.error };
  }
}

/**
 * Calculate total offline storage consumption metrics
 * @returns {{ count: number, bytes: number, formattedSize: string, maxStories: number }}
 */
export function getOfflineStorageMetrics() {
  if (!isStorageAvailable()) {
    return { count: 0, bytes: 0, formattedSize: '0 KB', maxStories: MAX_OFFLINE_STORIES };
  }

  try {
    const raw = window.localStorage.getItem(OFFLINE_STORIES_KEY) || '[]';
    const articles = getOfflineArticles();
    const bytes = typeof Blob !== 'undefined' ? new Blob([raw]).size : raw.length;
    
    let formattedSize = '0 KB';
    if (bytes > 1024 * 1024) {
      formattedSize = `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    } else {
      formattedSize = `${Math.max(0.1, (bytes / 1024)).toFixed(1)} KB`;
    }

    return {
      count: articles.length,
      bytes,
      formattedSize,
      maxStories: MAX_OFFLINE_STORIES
    };
  } catch (_err) {
    return { count: 0, bytes: 0, formattedSize: '0 KB', maxStories: MAX_OFFLINE_STORIES };
  }
}

/**
 * Clear all offline stories and synchronize flags
 * @returns {{ success: boolean }}
 */
export function clearAllOfflineArticles() {
  if (!isStorageAvailable()) return { success: false };

  try {
    const current = getOfflineArticles();
    current.forEach(art => {
      window.localStorage.setItem(`${LEGACY_BOOKMARK_PREFIX}${art.id}`, 'false');
    });

    window.localStorage.removeItem(OFFLINE_STORIES_KEY);
    notifyBookmarksChanged('cleared', null);
    return { success: true };
  } catch (err) {
    console.error('[BookmarkStorage] Failed to clear offline articles:', err);
    return { success: false };
  }
}

/**
 * Migration helper: If user had bookmarked stories before full snapshot engine,
 * hydrate them from current article list into offline store so bookmarks are not lost.
 * @param {Array<Object>} availableArticles
 */
export function syncLegacyBookmarks(availableArticles) {
  if (!isStorageAvailable() || !Array.isArray(availableArticles) || availableArticles.length === 0) {
    return;
  }

  try {
    const currentOffline = getOfflineArticles();
    const existingIds = new Set(currentOffline.map(a => String(a.id)));

    let hasNewSaves = false;
    for (const art of availableArticles) {
      if (!art || !art.id) continue;
      const strId = String(art.id);
      const isLegacyMarked = window.localStorage.getItem(`${LEGACY_BOOKMARK_PREFIX}${strId}`) === 'true';

      if (isLegacyMarked && !existingIds.has(strId)) {
        const serialized = serializeArticleForOffline(art);
        if (serialized) {
          currentOffline.push(serialized);
          existingIds.add(strId);
          hasNewSaves = true;
        }
      }
    }

    if (hasNewSaves) {
      const capped = currentOffline.slice(0, MAX_OFFLINE_STORIES);
      window.localStorage.setItem(OFFLINE_STORIES_KEY, JSON.stringify(capped));
      notifyBookmarksChanged('hydrated', null);
    }
  } catch (_err) {
    // Non-blocking migration
  }
}

