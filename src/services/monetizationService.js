/**
 * PublicSpark Newsroom Platform — Central Monetization & Partner Service
 * Manages Google AdSense & Direct Sponsor Placements with LocalStorage & Server Sync
 * Uses neutral names to avoid accidental ad-blocker false positives
 */
import { getAuthHeaders } from './authClient';

export const DEFAULT_ADS_CONFIG = {
  adSensePublisherId: '', // e.g. ca-pub-XXXXXXXXXXXXXXXX
  autoAdsEnabled: false,
  slots: {
    header: {
      id: 'header',
      name: 'Header Broadsheet Leaderboard',
      position: 'header',
      enabled: true,
      type: 'adsense', // 'adsense' | 'sponsor'
      adSlotId: '',    // 10-digit Google Ad Unit ID
      sponsorBannerUrl: '',
      sponsorTargetUrl: '',
      sponsorName: 'Featured Partner',
      desktopDimensions: '728×90',
      mobileDimensions: '320×50',
      scope: 'global', // 'global' | 'category' | 'article'
      targetCategory: 'all',
      targetArticleId: '',
      excludeArticleIds: '',
      startDateTime: '',
      endDateTime: '',
      startDate: '',
      endDate: '',
      status: 'active' // 'active' | 'paused' | 'expired'
    },
    in_article: {
      id: 'in_article',
      name: 'In-Article Native Reading Unit',
      position: 'in_article',
      enabled: true,
      type: 'adsense',
      adSlotId: '',
      sponsorBannerUrl: '',
      sponsorTargetUrl: '',
      sponsorName: 'Featured Partner',
      desktopDimensions: '336×280 / Fluid',
      mobileDimensions: '300×250',
      scope: 'global',
      targetCategory: 'all',
      targetArticleId: '',
      excludeArticleIds: '',
      startDateTime: '',
      endDateTime: '',
      startDate: '',
      endDate: '',
      status: 'active'
    },
    sidebar: {
      id: 'sidebar',
      name: 'Sidebar Sticky Half-Page Unit',
      position: 'sidebar',
      enabled: true,
      type: 'adsense',
      adSlotId: '',
      sponsorBannerUrl: '',
      sponsorTargetUrl: '',
      sponsorName: 'Featured Partner',
      desktopDimensions: '300×600',
      mobileDimensions: '300×250',
      scope: 'global',
      targetCategory: 'all',
      targetArticleId: '',
      excludeArticleIds: '',
      startDateTime: '',
      endDateTime: '',
      startDate: '',
      endDate: '',
      status: 'active'
    },
    home_feed: {
      id: 'home_feed',
      name: 'Homepage Feed In-Stream Unit',
      position: 'home_feed',
      enabled: false,
      type: 'adsense',
      adSlotId: '',
      sponsorBannerUrl: '',
      sponsorTargetUrl: '',
      sponsorName: 'Featured Partner',
      desktopDimensions: '728×90 / 300×250',
      mobileDimensions: '300×250',
      scope: 'global',
      targetCategory: 'all',
      targetArticleId: '',
      excludeArticleIds: '',
      startDateTime: '',
      endDateTime: '',
      startDate: '',
      endDate: '',
      status: 'active'
    },
    footer: {
      id: 'footer',
      name: 'Broadsheet Footer Leaderboard',
      position: 'footer',
      enabled: false,
      type: 'adsense',
      adSlotId: '',
      sponsorBannerUrl: '',
      sponsorTargetUrl: '',
      sponsorName: 'Featured Partner',
      desktopDimensions: '728×90',
      mobileDimensions: '320×50',
      scope: 'global',
      targetCategory: 'all',
      targetArticleId: '',
      excludeArticleIds: '',
      startDateTime: '',
      endDateTime: '',
      startDate: '',
      endDate: '',
      status: 'active'
    },
    mobile_footer: {
      id: 'mobile_footer',
      name: 'Mobile Sticky Anchor Banner',
      position: 'mobile_footer',
      enabled: false,
      type: 'adsense',
      adSlotId: '',
      sponsorBannerUrl: '',
      sponsorTargetUrl: '',
      sponsorName: 'Featured Partner',
      desktopDimensions: 'Hidden on Desktop',
      mobileDimensions: '320×50 Sticky',
      scope: 'global',
      targetCategory: 'all',
      targetArticleId: '',
      excludeArticleIds: '',
      startDateTime: '',
      endDateTime: '',
      startDate: '',
      endDate: '',
      status: 'active'
    }
  }
};

/**
 * Industry-standard IAB dimension recommendations and vertical clamp limits per broadsheet slot.
 * Enforces zero-layout deformation: tall/irregular posters are cleanly letterboxed inside max bounds.
 */
export const SLOT_DIMENSION_GUARDS = {
  header: {
    recommended: '728×90',
    aspectRatio: '8:1',
    desktopMaxHeight: 100,
    mobileMaxHeight: 110,
    recommendedBadge: '728×90 Leaderboard (8:1)',
    mobileBadge: '320×100 / 320×50 (3.2:1)',
    description: 'Header Broadsheet Banner — clamped to max 100px desktop / 110px mobile.'
  },
  in_article: {
    recommended: '300×250',
    aspectRatio: '6:5',
    desktopMaxHeight: 280,
    mobileMaxHeight: 280,
    recommendedBadge: '300×250 / 336×280 Medium Rectangle (6:5)',
    mobileBadge: '300×250 In-Story (6:5)',
    description: 'In-Article Native Unit — clamped to max 280px to protect reading flow.'
  },
  sidebar: {
    recommended: '300×600',
    aspectRatio: '1:2',
    desktopMaxHeight: 600,
    mobileMaxHeight: 300,
    recommendedBadge: '300×250 / 300×600 Half-Page (1:2)',
    mobileBadge: '300×250 Compact (6:5)',
    description: 'Sidebar Sticky Unit — clamped to max 600px desktop / 300px mobile.'
  },
  home_feed: {
    recommended: '728×90',
    aspectRatio: '8:1',
    desktopMaxHeight: 120,
    mobileMaxHeight: 110,
    recommendedBadge: '728×90 / 970×90 Leaderboard (8:1)',
    mobileBadge: '320×100 Feed Banner (3.2:1)',
    description: 'Homepage Feed Unit — clamped to max 120px desktop / 110px mobile.'
  },
  footer: {
    recommended: '728×90',
    aspectRatio: '8:1',
    desktopMaxHeight: 100,
    mobileMaxHeight: 80,
    recommendedBadge: '728×90 Broadsheet Colophon (8:1)',
    mobileBadge: '320×50 Footer Anchor (6.4:1)',
    description: 'Footer Broadsheet Unit — clamped to max 100px desktop / 80px mobile.'
  },
  mobile_footer: {
    recommended: '320×50',
    aspectRatio: '6.4:1',
    desktopMaxHeight: 60,
    mobileMaxHeight: 60,
    recommendedBadge: '320×50 Mobile Anchor (6.4:1)',
    mobileBadge: '320×50 Mobile Dock (6.4:1)',
    description: 'Mobile Sticky Dock Banner — strictly clamped to max 60px so it never blocks article text.'
  }
};

export function getSlotDimensionGuard(slotKey, isMobile = false) {
  const guard = SLOT_DIMENSION_GUARDS[slotKey] || {
    recommended: '728×90',
    aspectRatio: '8:1',
    desktopMaxHeight: 120,
    mobileMaxHeight: 100,
    recommendedBadge: 'Standard Banner',
    mobileBadge: 'Mobile Banner',
    description: 'Standard dimensions'
  };

  const maxHeight = isMobile ? guard.mobileMaxHeight : guard.desktopMaxHeight;
  return {
    ...guard,
    maxHeight: `${maxHeight}px`,
    maxHeightNum: maxHeight,
    activeBadge: isMobile ? guard.mobileBadge : guard.recommendedBadge
  };
}

const STORAGE_KEY = 'ps_monetization_settings_v1';
const EVENT_NAME = 'ps-monetization-changed';

// In-memory cache & in-flight deduplication map for active ad decisions from server
let activeAdsCache = new Map();
const inFlightAdsRequests = new Map();

/**
 * Get current settings from memory/localStorage, with fallback to default
 */
export function getAdSettings() {
  try {
    const cached = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('ps_ad_settings_v1');
    if (cached) {
      const parsed = JSON.parse(cached);
      const mergedSlots = {};
      Object.keys(DEFAULT_ADS_CONFIG.slots).forEach(key => {
        const def = DEFAULT_ADS_CONFIG.slots[key];
        const existing = (parsed.slots && parsed.slots[key]) || {};
        mergedSlots[key] = {
          ...def,
          ...existing,
          scope: existing.scope || def.scope || 'global',
          targetCategory: existing.targetCategory || def.targetCategory || 'all',
          targetArticleId: existing.targetArticleId || '',
          excludeArticleIds: existing.excludeArticleIds || '',
          startDateTime: existing.startDateTime || (existing.startDate ? `${existing.startDate}T00:00` : ''),
          endDateTime: existing.endDateTime || (existing.endDate ? `${existing.endDate}T23:59` : ''),
          startDate: existing.startDate || '',
          endDate: existing.endDate || '',
          status: existing.status || 'active'
        };
      });

      return {
        ...DEFAULT_ADS_CONFIG,
        ...parsed,
        slots: mergedSlots
      };
    }
  } catch (err) {
    console.warn('[MonetizationService] Fallback to default config:', err);
  }
  return DEFAULT_ADS_CONFIG;
}

/**
 * Client-side Evaluator Fallback
 * Used when offline or while waiting for server response
 */
export function evaluateAdSlot(slot, context = {}) {
  if (!slot || !slot.enabled) {
    return { shouldRender: false, effectiveType: 'none', reason: 'slot_disabled', isExpired: false };
  }

  // Pure Google AdSense unit
  if (slot.type === 'adsense') {
    return { shouldRender: true, effectiveType: 'adsense', reason: 'adsense_active', isExpired: false };
  }

  // Direct Sponsor Evaluation
  if (slot.type === 'sponsor') {
    const hasAdSenseFallback = Boolean(slot.adSlotId && slot.adSlotId.trim());

    // 1. Status Check: Paused
    if (slot.status === 'paused') {
      if (hasAdSenseFallback) {
        return { shouldRender: true, effectiveType: 'adsense', reason: 'sponsor_paused_fallback_adsense', isExpired: false };
      }
      return { shouldRender: false, effectiveType: 'none', reason: 'sponsor_paused', isExpired: false };
    }

    const nowMs = Date.now();

    // 2. Date & Time Check: Start Time (Future campaign)
    const startStr = slot.startDateTime || (slot.startDate ? `${slot.startDate}T00:00:00` : '');
    if (startStr) {
      const startTimeMs = new Date(startStr).getTime();
      if (!isNaN(startTimeMs) && nowMs < startTimeMs) {
        if (hasAdSenseFallback) {
          return { shouldRender: true, effectiveType: 'adsense', reason: 'sponsor_not_started_fallback_adsense', isExpired: false };
        }
        return { shouldRender: false, effectiveType: 'none', reason: 'sponsor_not_started', isExpired: false };
      }
    }

    // 3. Date & Time Check: End Time (Auto-Expiry)
    const endStr = slot.endDateTime || (slot.endDate ? `${slot.endDate}T23:59:59` : '');
    if (endStr) {
      const endTimeMs = new Date(endStr).getTime();
      if (!isNaN(endTimeMs) && nowMs > endTimeMs) {
        // Expired! Fallback to Google AdSense
        if (hasAdSenseFallback) {
          return { shouldRender: true, effectiveType: 'adsense', reason: 'sponsor_expired_fallback_adsense', isExpired: true };
        }
        return { shouldRender: false, effectiveType: 'none', reason: 'sponsor_expired', isExpired: true };
      }
    }

    // 4. Scope & Targeting Checks
    const currentCat = (context.category || '').toLowerCase().trim();
    const currentArtId = (context.articleId || '').trim();

    // Exclusion List: If current article is in exclusion list, fall back
    if (currentArtId && slot.excludeArticleIds) {
      const excluded = (Array.isArray(slot.excludeArticleIds)
        ? slot.excludeArticleIds
        : slot.excludeArticleIds.split(',').map(s => s.trim())
      );
      if (excluded.includes(currentArtId)) {
        if (hasAdSenseFallback) {
          return { shouldRender: true, effectiveType: 'adsense', reason: 'article_excluded_fallback_adsense', isExpired: false };
        }
        return { shouldRender: false, effectiveType: 'none', reason: 'article_excluded', isExpired: false };
      }
    }

    // Scope: Category
    if (slot.scope === 'category') {
      const targetCat = (slot.targetCategory || 'all').toLowerCase().trim();
      if (targetCat !== 'all' && currentCat && currentCat !== targetCat) {
        if (hasAdSenseFallback) {
          return { shouldRender: true, effectiveType: 'adsense', reason: 'category_mismatch_fallback_adsense', isExpired: false };
        }
        return { shouldRender: false, effectiveType: 'none', reason: 'category_mismatch', isExpired: false };
      }
    }

    // Scope: Single Article
    if (slot.scope === 'article') {
      if (slot.targetArticleId && slot.targetArticleId.trim()) {
        if (currentArtId !== slot.targetArticleId.trim()) {
          if (hasAdSenseFallback) {
            return { shouldRender: true, effectiveType: 'adsense', reason: 'article_mismatch_fallback_adsense', isExpired: false };
          }
          return { shouldRender: false, effectiveType: 'none', reason: 'article_mismatch', isExpired: false };
        }
      }
    }

    // All rules passed: display direct sponsor banner!
    return { shouldRender: true, effectiveType: 'sponsor', reason: 'sponsor_active', isExpired: false };
  }

  return { shouldRender: false, effectiveType: 'none', reason: 'unknown', isExpired: false };
}

/**
 * Fetch Backend-Decided Active Ads (Roadmap Core Architecture)
 * The backend evaluates server clock, start/end date-times, and targeting.
 * Returns authoritative decisions per slot.
 */
export async function getActiveAdsServer({ category = '', articleId = '' } = {}) {
  const cacheKey = `${category || ''}_${articleId || ''}`;
  const cached = activeAdsCache.get(cacheKey);
  const now = Date.now();
  if (cached && (now - cached.timestamp < 15000)) {
    return cached.data;
  }

  if (inFlightAdsRequests.has(cacheKey)) {
    return inFlightAdsRequests.get(cacheKey);
  }

  const requestPromise = (async () => {
    try {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (articleId) params.set('articleId', articleId);
      const qs = params.toString();
      const url = `/api/ads/active${qs ? `?${qs}` : ''}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.slots) {
          activeAdsCache.set(cacheKey, { timestamp: Date.now(), data });
          return data;
        }
      }
    } catch (err) {
      console.warn('[MonetizationService] Active ads fetch failed, using local evaluator fallback:', err);
    }

    // Resilient fallback: evaluate locally if network or server proxy is temporarily down
    const localConfig = getAdSettings();
    const fallbackSlots = {};
    Object.keys(DEFAULT_ADS_CONFIG.slots).forEach(slotKey => {
      const slot = localConfig.slots?.[slotKey];
      const ev = evaluateAdSlot(slot, { category, articleId });
      if (!ev.shouldRender) {
        fallbackSlots[slotKey] = { action: 'none', reason: ev.reason };
      } else if (ev.effectiveType === 'sponsor') {
        fallbackSlots[slotKey] = {
          action: slot.sponsorBannerUrl ? 'sponsor' : 'placeholder',
          type: 'sponsor',
          bannerUrl: slot.sponsorBannerUrl || '',
          targetUrl: slot.sponsorTargetUrl || '#',
          sponsorName: slot.sponsorName || 'Featured Partner',
          desktopDimensions: slot.desktopDimensions,
          mobileDimensions: slot.mobileDimensions,
          reason: 'local_fallback_active'
        };
      } else if (ev.effectiveType === 'adsense') {
        fallbackSlots[slotKey] = {
          action: (localConfig.adSensePublisherId && slot.adSlotId) ? 'adsense' : 'placeholder',
          type: 'adsense',
          publisherId: localConfig.adSensePublisherId,
          adSlotId: slot.adSlotId,
          desktopDimensions: slot.desktopDimensions,
          mobileDimensions: slot.mobileDimensions,
          reason: 'local_fallback_adsense'
        };
      } else {
        fallbackSlots[slotKey] = { action: 'none', reason: 'unknown' };
      }
    });

    return {
      success: true,
      serverTime: new Date().toISOString(),
      context: { category, articleId },
      slots: fallbackSlots
    };
  })().finally(() => {
    inFlightAdsRequests.delete(cacheKey);
  });

  inFlightAdsRequests.set(cacheKey, requestPromise);
  return requestPromise;
}

/**
 * Save settings to localStorage and notify all active units
 */
export function saveAdSettingsLocal(newConfig) {
  try {
    const merged = {
      ...DEFAULT_ADS_CONFIG,
      ...newConfig,
      slots: {
        ...DEFAULT_ADS_CONFIG.slots,
        ...(newConfig.slots || {})
      }
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    activeAdsCache.clear();
    inFlightAdsRequests.clear();
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: merged }));
    return merged;
  } catch (err) {
    console.error('[MonetizationService] Error saving settings locally:', err);
    return newConfig;
  }
}

/**
 * Fetch settings from backend server
 */
export async function fetchAdSettings() {
  try {
    const res = await fetch('/api/settings/monetization').catch(() => fetch('/api/settings/ads'));
    if (res && res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        return saveAdSettingsLocal(data);
      }
    }
  } catch (err) {
    console.warn('[MonetizationService] Could not fetch server settings, using local:', err);
  }
  return getAdSettings();
}

/**
 * Sync settings to backend server
 */
export async function syncAdSettingsServer(config) {
  // Always update local first for instant responsiveness
  const saved = saveAdSettingsLocal(config);
  activeAdsCache.clear();
  try {
    const res = await fetch('/api/settings/monetization', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(saved)
    }).catch(() => fetch('/api/settings/ads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(saved)
    }));
    if (res && res.ok) {
      const serverData = await res.json();
      return serverData;
    }
  } catch (err) {
    console.error('[MonetizationService] Server sync failed:', err);
  }
  return saved;
}

/**
 * Subscribe to setting changes
 */
export function subscribeToAdChanges(callback) {
  const handler = (e) => callback(e.detail);
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}

/**
 * Fetch ad campaign history snapshots from backend
 */
export async function fetchAdHistory() {
  try {
    const res = await fetch('/api/ads/history');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) return data;
    }
  } catch (err) {
    console.warn('[MonetizationService] Failed to fetch ad history:', err);
  }
  return [];
}

/**
 * Delete an ad campaign record from history
 */
export async function deleteAdHistoryItem(id) {
  try {
    const res = await fetch('/api/ads/history/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({ id })
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (err) {
    console.error('[MonetizationService] Failed to delete ad history item:', err);
  }
  return { success: false };
}

/**
 * Edit and update an existing ad campaign
 */
export async function updateAdHistoryItem(campaignData) {
  try {
    const res = await fetch('/api/ads/history/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(campaignData)
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (err) {
    console.error('[MonetizationService] Failed to update ad campaign:', err);
  }
  return { success: false };
}

/**
 * Record a reader impression when an ad becomes visible in viewport
 */
export async function trackAdImpression(campaignId, slotKey) {
  if (!campaignId) return;
  try {
    await fetch('/api/ads/track/impression', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId, slotKey })
    });
  } catch (err) {
    // Telemetry failure is non-blocking
  }
}

/**
 * Record a reader click when an ad banner is clicked (using sendBeacon or keepalive fetch)
 */
export async function trackAdClick(campaignId, slotKey) {
  if (!campaignId) return;
  try {
    const payload = JSON.stringify({ campaignId, slotKey });
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon('/api/ads/track/click', blob);
    } else {
      await fetch('/api/ads/track/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true
      });
    }
  } catch (err) {
    // Non-blocking telemetry
  }
}

/**
 * Format and resolve sponsor target URL with automatic WhatsApp Indian phone detection.
 * Converts 10-digit Indian numbers (or +91 / 0 prefixed) into deep links with pre-filled enquiry message.
 */
export function parseSponsorTargetUrl(rawUrl, sponsorName = '') {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { url: '#', isWhatsApp: false, display: 'No Link', type: 'none' };
  }
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed === '#') {
    return { url: '#', isWhatsApp: false, display: 'No Link', type: 'none' };
  }

  const cleanDigits = trimmed.replace(/[^0-9]/g, '');
  let indianPhone = null;

  if (cleanDigits.length === 10) {
    indianPhone = `91${cleanDigits}`;
  } else if (cleanDigits.length === 11 && cleanDigits.startsWith('0')) {
    indianPhone = `91${cleanDigits.slice(1)}`;
  } else if (cleanDigits.length === 12 && cleanDigits.startsWith('91')) {
    indianPhone = cleanDigits;
  }

  const nameStr = sponsorName ? sponsorName.trim() : 'Team';
  const defaultMessage = `Hello ${nameStr}, I saw your advertisement on PublicSpark News and would like to inquire about your services/products.`;
  const encodedMsg = encodeURIComponent(defaultMessage);

  // If detected as Indian phone number (or starts with tel:)
  if (indianPhone && (trimmed.startsWith('+') || trimmed.startsWith('0') || /^[0-9\s-]+$/.test(trimmed) || trimmed.startsWith('tel:'))) {
    return {
      url: `https://wa.me/${indianPhone}?text=${encodedMsg}`,
      isWhatsApp: true,
      phone: indianPhone,
      display: `+91 ${indianPhone.slice(2, 7)} ${indianPhone.slice(7)}`,
      type: 'whatsapp'
    };
  }

  // If already a wa.me or api.whatsapp.com link
  if (trimmed.includes('wa.me/') || trimmed.includes('api.whatsapp.com/send')) {
    let finalWaUrl = trimmed;
    if (!finalWaUrl.startsWith('http://') && !finalWaUrl.startsWith('https://')) {
      finalWaUrl = `https://${finalWaUrl}`;
    }
    if (!finalWaUrl.includes('text=')) {
      finalWaUrl += (finalWaUrl.includes('?') ? '&' : '?') + `text=${encodedMsg}`;
    }
    return {
      url: finalWaUrl,
      isWhatsApp: true,
      phone: cleanDigits || null,
      display: 'WhatsApp Direct',
      type: 'whatsapp'
    };
  }

  // Standard website URL
  let websiteUrl = trimmed;
  if (!websiteUrl.startsWith('http://') && !websiteUrl.startsWith('https://') && !websiteUrl.startsWith('mailto:')) {
    websiteUrl = `https://${websiteUrl}`;
  }

  return {
    url: websiteUrl,
    isWhatsApp: false,
    display: websiteUrl.replace(/^https?:\/\/(www\.)?/, ''),
    type: 'website'
  };
}


