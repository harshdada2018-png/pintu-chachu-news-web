/**
 * PublicSpark Newsroom — Article Revision & Rollback Service (Task 21)
 * Manages version snapshots, audit trail retrieval, and 1-click rollback execution
 */

/**
 * Format ISO datetime string to clean Indian standard format (e.g. 03 Nov 2026, 04:15 PM)
 */
export function formatRevisionTime(dtStr) {
  if (!dtStr) return '';
  try {
    const d = new Date(dtStr);
    if (isNaN(d.getTime())) return dtStr;
    return d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return dtStr;
  }
}

/**
 * Fetch all revision snapshots for a specific article
 */
export async function fetchArticleRevisions(articleId) {
  if (!articleId) return [];
  try {
    const res = await fetch(`/api/articles/${encodeURIComponent(articleId)}/revisions`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data.revisions) ? data.revisions : [];
  } catch (err) {
    console.warn('[Revision Service] Failed to fetch article revisions:', err.message);
    return [];
  }
}

/**
 * Rollback article to a previous snapshot
 */
export async function rollbackArticleRevision(articleId, revisionId, userRole = 'editor', editorName = 'Editor') {
  if (!articleId || !revisionId) {
    throw new Error('Both articleId and revisionId are required for rollback.');
  }

  const res = await fetch(`/api/articles/${encodeURIComponent(articleId)}/rollback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      revisionId,
      userRole,
      editorName
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Rollback failed with status ${res.status}`);
  }

  return data;
}

/**
 * Compute difference metrics between two word counts
 */
export function computeWordDelta(currentWords = 0, revWords = 0) {
  const delta = revWords - currentWords;
  if (delta > 0) return `+${delta} words`;
  if (delta < 0) return `${delta} words`;
  return 'Same word count';
}

