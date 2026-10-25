/**
 * PublicSpark Newsroom Platform — Central Monetization & Partner Service
 * Manages Google AdSense & Direct Sponsor Placements with LocalStorage & Server Sync
 * Uses neutral names to avoid accidental ad-blocker false positives
 */

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
      mobileDimensions: '320×50'
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
      mobileDimensions: '300×250'
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
      mobileDimensions: '300×250'
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
      mobileDimensions: '320×50 Sticky'
    }
  }
};

const STORAGE_KEY = 'ps_monetization_settings_v1';
const EVENT_NAME = 'ps-monetization-changed';

/**
 * Get current settings from memory/localStorage, with fallback to default
 */
export function getAdSettings() {
  try {
    const cached = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('ps_ad_settings_v1');
    if (cached) {
      const parsed = JSON.parse(cached);
      return {
        ...DEFAULT_ADS_CONFIG,
        ...parsed,
        slots: {
          ...DEFAULT_ADS_CONFIG.slots,
          ...(parsed.slots || {})
        }
      };
    }
  } catch (err) {
    console.warn('[MonetizationService] Fallback to default config:', err);
  }
  return DEFAULT_ADS_CONFIG;
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
  try {
    const res = await fetch('/api/settings/monetization', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': 'publicspark-admin-secret-key-2026'
      },
      body: JSON.stringify(saved)
    }).catch(() => fetch('/api/settings/ads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': 'publicspark-admin-secret-key-2026'
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
