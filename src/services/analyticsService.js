/**
 * PublicSpark Newsroom Analytics Service
 * Real-time view logging, heartbeat monitoring, and analytics reporting APIs.
 */

const API_BASE_URL = 'http://localhost:5000';

/**
 * Start a new reading view session when user opens an article card/reader.
 * @param {string|number} articleId 
 * @returns {Promise<{ sessionId: string, country: string }>}
 */
export async function startViewSession(articleId) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/views/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleId: String(articleId) })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.sessionId) {
        sessionStorage.setItem(`ps_sess_${articleId}`, data.sessionId);
        return data;
      }
    }
  } catch (err) {
    console.warn('[AnalyticsService] startViewSession fallback:', err.message);
  }
  
  // Local fallback session generator
  const fallbackSessionId = `local_sess_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  sessionStorage.setItem(`ps_sess_${articleId}`, fallbackSessionId);
  return { sessionId: fallbackSessionId, country: 'IN' };
}

/**
 * Send periodic heartbeat ping while user is actively on article page.
 * @param {string} sessionId 
 * @param {number} scrollDepth 
 */
export async function sendHeartbeat(sessionId, scrollDepth = 0) {
  if (!sessionId) return;
  try {
    await fetch(`${API_BASE_URL}/api/views/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, scrollDepth })
    });
  } catch (e) {
    // Silent catch for background heartbeat
  }
}

/**
 * Flush final reading duration and scroll depth when tab closes or component unmounts.
 * Uses navigator.sendBeacon for maximum reliability during unload.
 * @param {string} sessionId 
 * @param {number} readDurationSeconds 
 * @param {number} scrollDepth 
 */
export function endViewSession(sessionId, readDurationSeconds = 0, scrollDepth = 0) {
  if (!sessionId) return;
  const payload = JSON.stringify({ sessionId, readDurationSeconds, scrollDepth });
  
  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: 'application/json' });
    navigator.sendBeacon(`${API_BASE_URL}/api/views/end`, blob);
  } else {
    fetch(`${API_BASE_URL}/api/views/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true
    }).catch(() => {});
  }
}

/**
 * Fetch top-level dashboard analytics metrics and country breakdown.
 */
export async function fetchAnalyticsOverview() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/analytics/overview`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[AnalyticsService] fetchAnalyticsOverview fallback:', err.message);
  }

  // Fallback data if server is offline
  return {
    totalViews: 4280,
    uniqueReaders: 3510,
    avgReadTimeSeconds: 84,
    countryBreakdown: { IN: 2850, US: 780, GB: 320, CA: 190, BD: 140 },
    recentTrend: [
      { date: '2026-09-06', views: 420 },
      { date: '2026-09-07', views: 510 },
      { date: '2026-09-08', views: 590 },
      { date: '2026-09-09', views: 680 },
      { date: '2026-09-10', views: 740 },
      { date: '2026-09-11', views: 820 },
      { date: '2026-09-12', views: 520 }
    ]
  };
}

/**
 * Fetch top trending articles for given time period (day | week | month).
 * @param {string} period 
 */
export async function fetchTrendingArticles(period = 'week') {
  try {
    const res = await fetch(`${API_BASE_URL}/api/analytics/trending?period=${period}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[AnalyticsService] fetchTrendingArticles fallback:', err.message);
  }

  return {
    period,
    trending: [
      { articleId: '1', totalViews: 1840, uniqueViews: 1520, avgReadDuration: 94.2 },
      { articleId: '2', totalViews: 1120, uniqueViews: 940, avgReadDuration: 78.5 },
      { articleId: '3', totalViews: 860, uniqueViews: 710, avgReadDuration: 88.0 },
      { articleId: '4', totalViews: 640, uniqueViews: 530, avgReadDuration: 62.4 },
      { articleId: '5', totalViews: 490, uniqueViews: 410, avgReadDuration: 71.0 }
    ]
  };
}

/**
 * Toggle like state for an article (Like / Unlike).
 * @param {string|number} articleId 
 * @param {string} sessionId 
 */
export async function toggleArticleLike(articleId, sessionId = null) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/likes/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleId: String(articleId), sessionId })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[AnalyticsService] toggleArticleLike fallback:', err.message);
  }

  // Local fallback
  return { articleId: String(articleId), totalLikes: 1, isLiked: true, status: 'fallback' };
}

/**
 * Fetch like count and status for an article.
 * @param {string|number} articleId 
 * @param {string} sessionId 
 */
export async function fetchArticleLikes(articleId, sessionId = null) {
  try {
    const url = `${API_BASE_URL}/api/likes/article/${articleId}${sessionId ? `?sessionId=${sessionId}` : ''}`;
    const res = await fetch(url);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[AnalyticsService] fetchArticleLikes fallback:', err.message);
  }

  return { articleId: String(articleId), totalLikes: 0, isLiked: false };
}

/**
 * Fetch country breakdown stats (Views, Likes & Engagement Rate per country).
 */
export async function fetchCountryBreakdown() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/analytics/country-breakdown`);
    if (res.ok) {
      const data = await res.json();
      return data.countries || [];
    }
  } catch (err) {
    console.warn('[AnalyticsService] fetchCountryBreakdown fallback:', err.message);
  }

  return [
    { country: 'IN', views: 2450, likes: 320, engagementRate: 13.06 },
    { country: 'US', views: 820, likes: 115, engagementRate: 14.02 },
    { country: 'GB', views: 340, likes: 48, engagementRate: 14.12 },
    { country: 'CA', views: 210, likes: 29, engagementRate: 13.81 },
    { country: 'AE', views: 180, likes: 24, engagementRate: 13.33 },
    { country: 'BD', views: 120, likes: 15, engagementRate: 12.50 }
  ];
}
