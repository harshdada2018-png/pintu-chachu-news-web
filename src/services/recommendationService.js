/**
 * PublicSpark Recommendation & Related Stories Engine (Task 26 Subtopic A)
 * 
 * Provides deterministic, multi-factor recommendation scoring to match companion
 * stories for in-article and end-of-article reader engagement.
 * Factors:
 * 1. Primary Category match (+50 pts)
 * 2. Shared tags and topic keywords (+15 pts per shared tag, +5 pts per title keyword)
 * 3. Timely live blog / breaking prominence (+10 pts)
 * 4. Readership / Engagement weighting (log-scaled view boost)
 * 5. Deduplication and graceful cross-publication backfill
 * 
 * Complies with strict broadsheet editorial standards (Zero Emojis).
 */

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were',
  'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'about',
  'into', 'through', 'after', 'over', 'between', 'out', 'against',
  'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'it', 'they',
  'this', 'that', 'these', 'those', 'kya', 'hai', 'hain', 'mein', 'ko',
  'se', 'ka', 'ke', 'ki', 'par', 'aur', 'ya', 'bhi', 'tha', 'thi', 'the'
]);

/**
 * Normalizes tags from array or comma-separated string to a clean Set of lowercase tokens
 */
function extractNormalizedTags(tagsInput) {
  if (!tagsInput) return new Set();
  const list = Array.isArray(tagsInput)
    ? tagsInput
    : String(tagsInput).split(',').map(t => t.trim());
  
  return new Set(
    list
      .map(t => String(t).toLowerCase().trim())
      .filter(t => t.length > 1)
  );
}

/**
 * Extracts significant keywords from title for lexical matching
 */
function extractTitleKeywords(title) {
  if (!title || typeof title !== 'string') return new Set();
  const tokens = title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
  return new Set(tokens);
}

/**
 * Calculates a multi-factor relevance score between candidate and the target article
 */
export function calculateArticleRelevanceScore(candidate, currentArticle) {
  if (!candidate || !currentArticle) return -Infinity;
  if (candidate.id === currentArticle.id) return -Infinity;
  if (candidate.status && candidate.status !== 'published') return -Infinity;

  let score = 0;

  // 1. Primary Category Match (+50 pts)
  const candCatSlug = candidate.category_slug || (candidate.category ? candidate.category.toLowerCase().replace(/\s+/g, '-') : '');
  const currCatSlug = currentArticle.category_slug || (currentArticle.category ? currentArticle.category.toLowerCase().replace(/\s+/g, '-') : '');

  if (candCatSlug && currCatSlug && candCatSlug === currCatSlug) {
    score += 50;
  } else if (candidate.category && currentArticle.category && candidate.category.toLowerCase() === currentArticle.category.toLowerCase()) {
    score += 50;
  }

  // 2. Tag Overlap (+15 pts per shared tag)
  const candTags = extractNormalizedTags(candidate.tags);
  const currTags = extractNormalizedTags(currentArticle.tags);

  if (candTags.size > 0 && currTags.size > 0) {
    let sharedTagCount = 0;
    for (const tag of candTags) {
      if (currTags.has(tag)) {
        sharedTagCount++;
      }
    }
    score += sharedTagCount * 15;
  }

  // 3. Title Keyword Lexical Overlap (+5 pts per keyword)
  const candKeywords = extractTitleKeywords(candidate.title);
  const currKeywords = extractTitleKeywords(currentArticle.title);

  if (candKeywords.size > 0 && currKeywords.size > 0) {
    let sharedKeywordCount = 0;
    for (const kw of candKeywords) {
      if (currKeywords.has(kw)) {
        sharedKeywordCount++;
      }
    }
    score += Math.min(25, sharedKeywordCount * 5);
  }

  // 4. Timely Format Boost
  if (candidate.format === 'live' && (candidate.live_status === 'active' || !candidate.live_status)) {
    score += 10;
  }
  if (candidate.is_breaking) {
    score += 8;
  }

  // 5. Engagement & Readership Boost (log scale, max +10 pts)
  const views = Number(candidate.views_count) || 100;
  score += Math.min(10, Math.round(Math.log10(Math.max(10, views)) * 2.5));

  return score;
}

/**
 * Returns prioritized related articles based on category, tags, and popularity
 * 
 * @param {Object} currentArticle - The article currently in view
 * @param {Array} allArticles - Catalog of available articles
 * @param {Object} options - { limit: number, excludeIds: Array<string> }
 * @returns {Array} List of matched related article objects
 */
export function getRelatedStories(currentArticle, allArticles = [], options = {}) {
  if (!currentArticle || !Array.isArray(allArticles) || allArticles.length === 0) {
    return [];
  }

  const limit = Math.max(1, Number(options.limit) || 4);
  const excludeSet = new Set([
    String(currentArticle.id),
    ...(Array.isArray(options.excludeIds) ? options.excludeIds.map(String) : [])
  ]);

  // Filter eligible published candidates
  const eligible = allArticles.filter(art => {
    if (!art || !art.id) return false;
    if (excludeSet.has(String(art.id))) return false;
    if (art.status && art.status !== 'published') return false;
    return true;
  });

  if (eligible.length === 0) return [];

  // Score each candidate
  const scored = eligible.map(cand => ({
    article: cand,
    score: calculateArticleRelevanceScore(cand, currentArticle)
  }));

  // Sort descending by score; tie-breaker: views or id
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (Number(b.article.views_count) || 0) - (Number(a.article.views_count) || 0);
  });

  const topMatches = scored.filter(item => item.score > 0).map(item => item.article);

  // If we have enough high-relevance matches, return immediately
  if (topMatches.length >= limit) {
    return topMatches.slice(0, limit);
  }

  // Otherwise, graceful backfill with other published stories to always satisfy the limit
  const result = [...topMatches];
  const pickedIds = new Set(result.map(a => String(a.id)));

  for (const item of scored) {
    if (result.length >= limit) break;
    if (!pickedIds.has(String(item.article.id))) {
      result.push(item.article);
      pickedIds.add(String(item.article.id));
    }
  }

  return result.slice(0, limit);
}

/**
 * Selects 1 top companion story specifically for mid-article "Ye Bhi Padhein" callout
 */
export function getMidArticleStory(currentArticle, allArticles = [], excludeIds = []) {
  const matches = getRelatedStories(currentArticle, allArticles, {
    limit: 1,
    excludeIds
  });
  return matches.length > 0 ? matches[0] : null;
}

/**
 * Selects companion stories for the end of the article, ensuring no duplication with mid-article callout
 */
export function getEndArticleStories(currentArticle, allArticles = [], limit = 3, excludeIds = []) {
  return getRelatedStories(currentArticle, allArticles, {
    limit,
    excludeIds
  });
}

