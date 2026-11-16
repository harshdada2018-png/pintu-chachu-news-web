import React, { useState, useEffect, useMemo } from 'react';
import { 
  DollarSign, Check, Save, Sparkles, ExternalLink, 
  ToggleLeft, ToggleRight, Layout, Smartphone, Monitor, Image as ImageIcon, 
  RefreshCw, ShieldCheck,
  Calendar, Globe, Tag, FileText, Clock, Search, X,
  History, RotateCcw, Trash2, Copy, Eye, Edit3,
  BarChart2, TrendingUp, MousePointer, Share2, MessageCircle, Maximize2
} from 'lucide-react';
import { getAdSettings, syncAdSettingsServer, fetchAdSettings, fetchAdHistory, deleteAdHistoryItem, updateAdHistoryItem, parseSponsorTargetUrl, getSlotDimensionGuard } from '../../services/monetizationService';
import { compressImageToWebP } from '../../services/mediaService';
import { MOCK_CATEGORIES } from '../../services/mockData';

/**
 * Format ISO / datetime-local string to clean Indian standard readable format (e.g. 29 Oct 2026, 02:30 PM)
 */
function formatDisplayDateTime(dtStr) {
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
 * PublicSpark Newsroom — Professional Zero-Code Monetization Desk Suite
 * Enables visual control over Google AdSense & Direct Sponsor Placements
 * Uses neutral identifiers to avoid client-side browser extension blocking
 */
export default function MonetizationDesk({ onShowToast, articles = [], categories = [] }) {
  const [referenceTime] = useState(() => Date.now());
  const [adConfig, setAdConfig] = useState(() => getAdSettings());
  const [articleList, setArticleList] = useState(articles || []);
  const [categoryList, setCategoryList] = useState(() => (categories && categories.length > 0 ? categories : MOCK_CATEGORIES));
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isUploading, setIsUploading] = useState({});
  const [uploadStats, setUploadStats] = useState({});

  // Dynamic Search, Category Division, and Picker toggles per slot
  const [articleSearchQueries, setArticleSearchQueries] = useState({});
  const [articleCategoryFilters, setArticleCategoryFilters] = useState({});
  const [isPickerOpen, setIsPickerOpen] = useState({});

  // Sub-navigation tab: 'slots' or 'history'
  const [activeSubTab, setActiveSubTab] = useState('slots');
  const [campaignHistory, setCampaignHistory] = useState([]);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all'); // 'all' | 'live' | 'scheduled' | 'expired'
  const [historySlotFilter, setHistorySlotFilter] = useState('all');
  const [cloningCampaign, setCloningCampaign] = useState(null);
  const [cloneTargetSlot, setCloneTargetSlot] = useState('header');
  const [cloneDurationDays, setCloneDurationDays] = useState(7);
  const [previewBannerUrl, setPreviewBannerUrl] = useState(null);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [isUpdatingCampaign, setIsUpdatingCampaign] = useState(false);
  const [proofCampaign, setProofCampaign] = useState(null);
  const [copiedProof, setCopiedProof] = useState(false);

  // Derive unique dynamic categories from both categoryList and articleList
  const uniqueCategories = useMemo(() => {
    const map = new Map();
    (categoryList || []).forEach(c => {
      const slug = typeof c === 'string' ? c : (c.slug || c.id || '');
      const name = typeof c === 'string' ? c : (c.name || slug || '');
      if (slug) map.set(slug.toLowerCase(), { slug, name });
    });
    (articleList || []).forEach(a => {
      const catName = a.category || a.category_name;
      const catSlug = (a.category_slug || catName || '').toLowerCase();
      if (catSlug && !map.has(catSlug)) {
        map.set(catSlug, { slug: catSlug, name: catName || catSlug });
      }
    });
    return Array.from(map.values());
  }, [categoryList, articleList]);

  // Sync settings, categories, and articles from backend server on mount
  useEffect(() => {
    fetchAdSettings().then(serverConfig => {
      if (serverConfig) {
        setAdConfig(serverConfig);
      }
    });

    if (!articles || articles.length === 0) {
      fetch('/api/articles')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            setArticleList(data);
          }
        })
        .catch(() => {});
    }

    if (!categories || categories.length === 0) {
      fetch('/api/categories')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            setCategoryList(data);
          }
        })
        .catch(() => {});
    }

    fetchAdHistory().then(hist => {
      if (Array.isArray(hist)) {
        setCampaignHistory(hist);
      }
    });
  }, [articles, categories]);

  const handleUpdatePublisherId = (value) => {
    setAdConfig(prev => ({
      ...prev,
      adSensePublisherId: value
    }));
    setSaveSuccess(false);
  };

  const handleToggleAutoAds = () => {
    setAdConfig(prev => ({
      ...prev,
      autoAdsEnabled: !prev.autoAdsEnabled
    }));
    setSaveSuccess(false);
  };

  const handleToggleSlot = (slotKey) => {
    setAdConfig(prev => ({
      ...prev,
      slots: {
        ...prev.slots,
        [slotKey]: {
          ...prev.slots[slotKey],
          enabled: !prev.slots[slotKey].enabled
        }
      }
    }));
    setSaveSuccess(false);
  };

  const handleUpdateSlotField = (slotKey, field, value) => {
    setAdConfig(prev => ({
      ...prev,
      slots: {
        ...prev.slots,
        [slotKey]: {
          ...prev.slots[slotKey],
          [field]: value
        }
      }
    }));
    setSaveSuccess(false);
  };

  // Upload sponsor banner image to standalone WebP storage
  const handleUploadSponsorBanner = async (slotKey, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(prev => ({ ...prev, [slotKey]: true }));
    try {
      // 1. Compress image to clean WebP (< 200KB) to ensure blazing load speeds
      let dataUrl = '';
      let stats = null;
      try {
        const compressed = await compressImageToWebP(file, 200, 1200);
        dataUrl = compressed.dataUrl;
        stats = {
          originalKB: compressed.originalKB,
          compressedKB: compressed.compressedKB,
          savedPercent: Math.max(0, Math.round(((compressed.originalKB - compressed.compressedKB) / compressed.originalKB) * 100))
        };
      } catch (cErr) {
        // Fallback: direct FileReader if canvas compression encounters odd SVG/unsupported format
        dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      // 2. Upload to standalone backend storage endpoint (/api/upload/image)
      const res = await fetch('/api/upload/image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': 'publicspark-admin-secret-key-2026'
        },
        body: JSON.stringify({
          imageBase64: dataUrl,
          articleId: `sponsor_${slotKey}`
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          handleUpdateSlotField(slotKey, 'sponsorBannerUrl', data.url);
          if (stats) {
            setUploadStats(prev => ({ ...prev, [slotKey]: stats }));
          }
          const toastMsg = stats
            ? `Sponsor banner uploaded! WebP size: ${stats.compressedKB} KB (${stats.savedPercent}% lighter than ${stats.originalKB} KB original)`
            : 'Sponsor banner image uploaded & optimized successfully!';
          if (onShowToast) onShowToast(toastMsg);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || 'Image upload failed. Please verify image format and size.');
      }
    } catch (err) {
      console.error('[MonetizationDesk] Banner upload error:', err);
      alert('Upload error: ' + err.message);
    } finally {
      setIsUploading(prev => ({ ...prev, [slotKey]: false }));
    }
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await syncAdSettingsServer(adConfig);
      setSaveSuccess(true);
      if (onShowToast) onShowToast('Monetization settings & placements saved! Active campaign recorded.');
      
      // Auto-clear direct sponsor form inputs so the placement space is immediately fresh to place new ads
      setAdConfig(prev => {
        const updatedSlots = { ...prev.slots };
        let hasCleared = false;
        Object.keys(updatedSlots).forEach(sKey => {
          const sl = updatedSlots[sKey];
          if (sl && sl.type === 'sponsor' && (sl.sponsorBannerUrl || sl.sponsorName)) {
            updatedSlots[sKey] = {
              ...sl,
              sponsorName: '',
              sponsorBannerUrl: '',
              sponsorTargetUrl: '',
              startDateTime: '',
              endDateTime: '',
              startDate: '',
              endDate: '',
              targetArticleId: '',
              excludeArticleIds: ''
            };
            hasCleared = true;
          }
        });
        if (hasCleared) {
          saveAdSettingsLocal({ ...prev, slots: updatedSlots });
        }
        return hasCleared ? { ...prev, slots: updatedSlots } : prev;
      });

      // Refresh campaign archive snapshots
      fetchAdHistory().then(hist => {
        if (Array.isArray(hist)) setCampaignHistory(hist);
      });
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      console.error('[MonetizationDesk] Save error:', err);
      alert('Failed to save settings: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Edit Campaign Handlers
  const handleStartEditCampaign = (campaign, e) => {
    e?.stopPropagation();
    setEditingCampaign(campaign);
    setEditFormData({
      id: campaign.id,
      slotKey: campaign.slotKey || 'header',
      slotName: campaign.slotName || 'Header Broadsheet Leaderboard',
      sponsorName: campaign.sponsorName || '',
      sponsorTargetUrl: campaign.sponsorTargetUrl || '',
      sponsorBannerUrl: campaign.sponsorBannerUrl || '',
      scope: campaign.scope || 'global',
      targetCategory: campaign.targetCategory || 'all',
      targetArticleId: campaign.targetArticleId || '',
      excludeArticleIds: campaign.excludeArticleIds || '',
      startDateTime: campaign.startDateTime || '',
      endDateTime: campaign.endDateTime || ''
    });
  };

  const handleSaveEditedCampaign = async () => {
    if (!editingCampaign || !editFormData.id) return;
    setIsUpdatingCampaign(true);
    try {
      const res = await updateAdHistoryItem(editFormData);
      if (res && res.success) {
        setCampaignHistory(prev => prev.map(c => c.id === editFormData.id ? res.campaign : c));
        setEditingCampaign(null);
        if (onShowToast) onShowToast('Ad campaign updated & corrected successfully!');
        // Also refresh ad settings from server to keep live slots in sync
        fetchAdSettings().then(s => {
          if (s && s.slots) setAdConfig(s);
        });
      } else {
        alert(res?.error || 'Failed to update campaign.');
      }
    } catch (err) {
      console.error('[MonetizationDesk] Edit campaign error:', err);
      alert('Error updating campaign: ' + err.message);
    } finally {
      setIsUpdatingCampaign(false);
    }
  };

  const handleUploadEditBanner = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      let dataUrl;
      try {
        const compressed = await compressImageToWebP(file, 1200, 0.85);
        dataUrl = compressed.dataUrl;
      } catch {
        dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      const res = await fetch('/api/upload/image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': 'publicspark-admin-secret-key-2026'
        },
        body: JSON.stringify({
          imageBase64: dataUrl,
          articleId: `sponsor_${editFormData.slotKey || 'header'}`
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          setEditFormData(prev => ({ ...prev, sponsorBannerUrl: data.url }));
          if (onShowToast) onShowToast('Replacement banner uploaded successfully!');
        }
      }
    } catch (err) {
      alert('Banner upload failed: ' + err.message);
    }
  };

  // 1-Click Clone / Re-Run Handlers
  const handleStartClone = (campaign, e) => {
    e?.stopPropagation();
    setCloningCampaign(campaign);
    setCloneTargetSlot(campaign.slotKey || 'header');
    setCloneDurationDays(7);
  };

  const handleConfirmClone = () => {
    if (!cloningCampaign || !cloneTargetSlot) return;

    const now = new Date();
    const end = new Date(now.getTime() + (cloneDurationDays || 7) * 24 * 60 * 60 * 1000);

    const pad = (n) => String(n).padStart(2, '0');
    const startStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const endStr = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`;

    setAdConfig(prev => ({
      ...prev,
      slots: {
        ...prev.slots,
        [cloneTargetSlot]: {
          ...prev.slots[cloneTargetSlot],
          enabled: true,
          type: 'sponsor',
          sponsorName: cloningCampaign.sponsorName || 'Direct Sponsor',
          sponsorBannerUrl: cloningCampaign.sponsorBannerUrl,
          sponsorTargetUrl: cloningCampaign.sponsorTargetUrl || '',
          scope: cloningCampaign.scope || 'global',
          targetCategory: cloningCampaign.targetCategory || 'all',
          targetArticleId: cloningCampaign.targetArticleId || '',
          startDateTime: startStr,
          endDateTime: endStr,
          startDate: startStr.slice(0, 10),
          endDate: endStr.slice(0, 10),
          status: 'active'
        }
      }
    }));

    const slotTitle = adConfig.slots?.[cloneTargetSlot]?.name || cloneTargetSlot;
    setCloningCampaign(null);
    setActiveSubTab('slots');
    if (onShowToast) {
      onShowToast(`Campaign pre-filled into "${slotTitle}"! Click "Save & Apply Changes" to activate.`);
    }
  };

  const handleDeleteHistory = async (id, e) => {
    e?.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this campaign snapshot from history?')) return;
    const res = await deleteAdHistoryItem(id);
    if (res && res.success) {
      setCampaignHistory(prev => prev.filter(c => c.id !== id));
      if (onShowToast) onShowToast('Campaign removed from history.');
    }
  };

  // 1-Click WhatsApp Client Proof Generators
  const generateWhatsAppProofText = (camp) => {
    if (!camp) return '';
    const impressions = camp.impressions || 0;
    const clicks = camp.clicks || 0;
    const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(1) : '0.0';
    const startStr = formatDisplayDateTime(camp.startDateTime) || 'Immediate';
    const endStr = formatDisplayDateTime(camp.endDateTime) || 'Active';
    const scopeStr = camp.scope === 'global' ? 'Global (All Pages)' : camp.scope === 'category' ? `Category: ${camp.targetCategory}` : `Article: #${camp.targetArticleId}`;

    return (
`*PublicSpark Newsroom - Verified Ad Performance Report*
----------------------------------------
*Advertiser / Brand:* ${camp.sponsorName || 'Direct Sponsor'}
*Placement Slot:* ${camp.slotName || camp.slotKey}
*Campaign Scope:* ${scopeStr}
*Active Schedule:* ${startStr} to ${endStr}
----------------------------------------
*Verified Impressions (Views):* ${impressions.toLocaleString()}
*Verified Direct Clicks (Leads):* ${clicks.toLocaleString()}
*Engagement Rate (CTR):* ${ctr}%
----------------------------------------
*Data Authenticated by PublicSpark In-House Ad Engine*
*Live Portal:* ${typeof window !== 'undefined' ? window.location.origin : 'https://publicspark.in'}`
    );
  };

  const handleCopyProof = (camp) => {
    const text = generateWhatsAppProofText(camp);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedProof(true);
      setTimeout(() => setCopiedProof(false), 2500);
      if (onShowToast) onShowToast(`Performance report for "${camp.sponsorName}" copied to clipboard!`);
    }
  };

  const getWhatsAppDirectLink = (camp) => {
    if (!camp || !camp.sponsorTargetUrl) return null;
    const targetInfo = parseSponsorTargetUrl(camp.sponsorTargetUrl, camp.sponsorName);
    if (targetInfo.isWhatsApp && targetInfo.phone) {
      const text = encodeURIComponent(generateWhatsAppProofText(camp));
      return `https://wa.me/${targetInfo.phone}?text=${text}`;
    }
    return null;
  };

  // Filtered campaign history list
  const filteredHistory = useMemo(() => {
    const nowMs = referenceTime;
    return campaignHistory.filter(camp => {
      if (historySearchQuery.trim()) {
        const q = historySearchQuery.toLowerCase();
        const matchName = (camp.sponsorName || '').toLowerCase().includes(q);
        const matchTarget = (camp.sponsorTargetUrl || '').toLowerCase().includes(q);
        const matchSlot = (camp.slotName || camp.slotKey || '').toLowerCase().includes(q);
        const matchArticle = (camp.targetArticleTitle || camp.targetArticleId || '').toLowerCase().includes(q);
        if (!matchName && !matchTarget && !matchSlot && !matchArticle) return false;
      }

      if (historySlotFilter !== 'all' && camp.slotKey !== historySlotFilter) {
        return false;
      }

      const startMs = camp.startDateTime ? new Date(camp.startDateTime).getTime() : 0;
      const endMs = camp.endDateTime ? new Date(camp.endDateTime).getTime() : 0;
      let status = 'live';
      if (endMs && nowMs > endMs) status = 'expired';
      else if (startMs && nowMs < startMs) status = 'scheduled';

      if (historyStatusFilter !== 'all' && status !== historyStatusFilter) {
        return false;
      }

      return true;
    });
  }, [campaignHistory, historySearchQuery, historySlotFilter, historyStatusFilter, referenceTime]);

  // Compute live history stats counters including Impressions, Clicks, and Average CTR
  const historyStats = useMemo(() => {
    const nowMs = referenceTime;
    let live = 0, scheduled = 0, expired = 0, totalImpressions = 0, totalClicks = 0;
    campaignHistory.forEach(camp => {
      const startMs = camp.startDateTime ? new Date(camp.startDateTime).getTime() : 0;
      const endMs = camp.endDateTime ? new Date(camp.endDateTime).getTime() : 0;
      if (endMs && nowMs > endMs) expired++;
      else if (startMs && nowMs < startMs) scheduled++;
      else live++;

      totalImpressions += (camp.impressions || 0);
      totalClicks += (camp.clicks || 0);
    });
    const avgCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : '0.0';
    return { total: campaignHistory.length, live, scheduled, expired, totalImpressions, totalClicks, avgCtr };
  }, [campaignHistory, referenceTime]);

  const pubId = adConfig.adSensePublisherId?.trim() || '';
  const isPubIdValid = /^(ca-)?pub-[0-9]{16}$/.test(pubId);

  const slotKeys = ['header', 'in_article', 'sidebar', 'home_feed', 'footer', 'mobile_footer'];

  return (
    <div className="monetization-desk-wrapper">
      {/* Top Action Header Bar */}
      <div className="monetization-header-card">
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0 }}>
            <DollarSign color="var(--accent-crimson)" size={22} />
            News Monetization & Partner Unit Suite
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-subtle)', margin: '0.25rem 0 0 0' }}>
            Zero-code visual control over Google AdSense units, local sponsor banners, and placement toggles.
          </p>
        </div>

        <div className="monetization-header-actions">
          <button
            onClick={handleSaveAll}
            disabled={isSaving}
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.6rem 1.25rem',
              fontSize: '0.85rem',
              fontWeight: '700'
            }}
          >
            {isSaving ? (
              <>
                <RefreshCw size={15} className="spin" />
                Saving Settings...
              </>
            ) : saveSuccess ? (
              <>
                <Check size={15} color="#10B981" />
                Saved & Applied!
              </>
            ) : (
              <>
                <Save size={15} />
                Save & Apply Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* Sub-Navigation Pill Bar */}
      <div style={{ display: 'flex', gap: '0.6rem', borderBottom: '1px solid var(--border-medium)', paddingBottom: '0.85rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setActiveSubTab('slots')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.55rem 1.15rem',
            borderRadius: '4px',
            border: activeSubTab === 'slots' ? '1px solid var(--primary)' : '1px solid var(--border-medium)',
            background: activeSubTab === 'slots' ? 'var(--primary)' : 'var(--bg-surface)',
            color: activeSubTab === 'slots' ? '#ffffff' : 'var(--text-main)',
            fontWeight: '700',
            fontSize: '0.82rem',
            cursor: 'pointer'
          }}
        >
          <Layout size={15} /> 6 Live Placement Slots
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('history')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.55rem 1.15rem',
            borderRadius: '4px',
            border: activeSubTab === 'history' ? '1px solid var(--primary)' : '1px solid var(--border-medium)',
            background: activeSubTab === 'history' ? 'var(--primary)' : 'var(--bg-surface)',
            color: activeSubTab === 'history' ? '#ffffff' : 'var(--text-main)',
            fontWeight: '700',
            fontSize: '0.82rem',
            cursor: 'pointer'
          }}
        >
          <History size={15} /> Active Campaigns Desk ({campaignHistory.length})
        </button>
      </div>

      {/* VIEW 1: LIVE PLACEMENT SLOTS */}
      {activeSubTab === 'slots' && (
        <>
          {/* Section 1: Google AdSense Global Credentials */}
      <div className="monetization-cred-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <ShieldCheck size={18} color="var(--accent-blue)" />
          <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0 }}>Google AdSense Credentials & Verification</h3>
        </div>

        <div className="monetization-cred-grid">
          {/* Publisher ID Box */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', marginBottom: '0.4rem', color: 'var(--text-main)' }}>
              Google Publisher ID (प्रकाशक आईडी)
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="ca-pub-1234567890123456"
                value={adConfig.adSensePublisherId || ''}
                onChange={(e) => handleUpdatePublisherId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${pubId ? (isPubIdValid ? '#10B981' : 'var(--accent-crimson)') : 'var(--border-medium)'}`,
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-main)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.85rem'
                }}
              />
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.4rem' }}>
              <span style={{ fontSize: '0.74rem', color: pubId ? (isPubIdValid ? '#10B981' : 'var(--accent-crimson)') : 'var(--text-subtle)' }}>
                {pubId 
                  ? (isPubIdValid ? 'Valid Google Publisher ID Format' : 'Format should be ca-pub-XXXXXXXXXXXXXXXX (16 digits)')
                  : 'Found in Google AdSense Account > Settings > Account Info'}
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)' }}>
                Auto-syncs to /ads.txt
              </span>
            </div>
          </div>

          {/* Auto-Ads Toggle Box */}
          <div 
            style={{ 
              background: 'var(--bg-secondary)', 
              padding: '1rem', 
              borderRadius: 'var(--radius-sm)', 
              border: '1px solid var(--border-light)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '100%'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div>
                <span style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--text-main)' }}>Google Auto-Ads Script</span>
                <p style={{ fontSize: '0.74rem', color: 'var(--text-subtle)', margin: '0.2rem 0 0 0' }}>
                  Injects the official AdSense script tag to allow Google AI to dynamically serve ads.
                </p>
              </div>
              <button
                type="button"
                onClick={handleToggleAutoAds}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                title={adConfig.autoAdsEnabled ? 'Disable Auto-Ads' : 'Enable Auto-Ads'}
              >
                {adConfig.autoAdsEnabled ? (
                  <ToggleRight size={32} color="#10B981" />
                ) : (
                  <ToggleLeft size={32} color="var(--text-subtle)" />
                )}
              </button>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', borderTop: '1px dashed var(--border-medium)', paddingTop: '0.4rem' }}>
              Recommended: Keep <strong>ON</strong> once AdSense account is approved.
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Configurable Placement Slots */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '800', margin: 0 }}>Standard Broadsheet Placements</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', margin: '0.2rem 0 0 0' }}>
              Each slot can operate either with Google AdSense or as a direct paid sponsor banner.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {slotKeys.map(key => {
            const slot = adConfig.slots?.[key];
            if (!slot) return null;

            return (
              <div
                key={slot.id}
                className="monetization-slot-card"
                style={{
                  border: `1px solid ${slot.enabled ? 'var(--border-medium)' : 'var(--border-light)'}`,
                  opacity: slot.enabled ? 1 : 0.7
                }}
              >
                {/* Slot Card Header */}
                <div
                  className="monetization-slot-header"
                  style={{
                    background: slot.enabled ? 'var(--bg-secondary)' : 'transparent'
                  }}
                >
                  <div className="monetization-slot-title-group">
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        background: slot.enabled ? 'var(--accent-indigo)' : 'var(--border-medium)',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.8rem',
                        fontWeight: '800',
                        flexShrink: 0
                      }}
                    >
                      {key === 'header' || key === 'footer' ? <Monitor size={16} /> : key === 'mobile_footer' ? <Smartphone size={16} /> : <Layout size={16} />}
                    </div>
                    <div className="monetization-slot-meta">
                      <div className="monetization-slot-title-row">
                        <span style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--text-main)' }}>
                          {slot.name}
                        </span>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-medium)',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--text-subtle)',
                            wordBreak: 'break-word',
                            maxWidth: '100%'
                          }}
                        >
                          Desktop: {slot.desktopDimensions} • Mobile: {slot.mobileDimensions}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-subtle)' }}>
                        Position Key: <code>{slot.position}</code>
                      </span>
                    </div>
                  </div>

                  {/* Slot Master Toggle */}
                  <div className="monetization-slot-toggle-group">
                    <span 
                      style={{ 
                        fontSize: '0.78rem', 
                        fontWeight: '700',
                        color: slot.enabled ? '#10B981' : 'var(--text-subtle)' 
                      }}
                    >
                      {slot.enabled ? 'Slot Active (ON)' : 'Disabled (OFF)'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleSlot(key)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      title={slot.enabled ? 'Turn Off Slot' : 'Turn On Slot'}
                    >
                      {slot.enabled ? (
                        <ToggleRight size={32} color="#10B981" />
                      ) : (
                        <ToggleLeft size={32} color="var(--text-subtle)" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Slot Configuration Body (Only interactive when enabled) */}
                {slot.enabled && (
                  <div className="monetization-slot-body">
                    {/* Mode Selector: Google AdSense vs Direct Sponsor */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                        Monetization Source:
                      </label>
                      <div className="monetization-mode-selector">
                        <button
                          type="button"
                          onClick={() => handleUpdateSlotField(key, 'type', 'adsense')}
                          className={`btn ${slot.type === 'adsense' ? 'btn-primary' : 'btn-outline'}`}
                          style={{ padding: '0.4rem 0.85rem', fontSize: '0.78rem', fontWeight: '700' }}
                        >
                          Google AdSense Unit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateSlotField(key, 'type', 'sponsor')}
                          className={`btn ${slot.type === 'sponsor' ? 'btn-primary' : 'btn-outline'}`}
                          style={{ padding: '0.4rem 0.85rem', fontSize: '0.78rem', fontWeight: '700' }}
                        >
                          Direct Sponsor / Advertiser Banner
                        </button>
                      </div>
                    </div>

                    {/* SUB-SECTION A: Google AdSense Slot ID */}
                    {slot.type === 'adsense' && (
                      <div style={{ background: 'var(--bg-secondary)', padding: '0.85rem', borderRadius: 'var(--radius-sm)' }}>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.3rem', color: 'var(--text-main)' }}>
                          Ad Unit Slot ID (`data-ad-slot` 10-digit number):
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 9876543210 (Found in AdSense > Ads > By ad unit)"
                          value={slot.adSlotId || ''}
                          onChange={(e) => handleUpdateSlotField(key, 'adSlotId', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '4px',
                            border: '1px solid var(--border-medium)',
                            background: 'var(--bg-surface)',
                            color: 'var(--text-main)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.82rem',
                            boxSizing: 'border-box'
                          }}
                        />
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', marginTop: '0.25rem', display: 'block' }}>
                          If blank or running on localhost, PublicSpark automatically displays a subtle broadsheet placeholder box without throwing any errors.
                        </span>
                      </div>
                    )}

                    {/* SUB-SECTION B: Direct Sponsor Controls */}
                    {slot.type === 'sponsor' && (() => {
                      const nowMs = Date.now();
                      const startDateTimeStr = slot.startDateTime || (slot.startDate ? `${slot.startDate}T00:00` : '');
                      const endDateTimeStr = slot.endDateTime || (slot.endDate ? `${slot.endDate}T23:59` : '');

                      const startTimeMs = startDateTimeStr ? new Date(startDateTimeStr).getTime() : 0;
                      const endTimeMs = endDateTimeStr ? new Date(endDateTimeStr).getTime() : Infinity;

                      const isExpired = Boolean(endDateTimeStr && !isNaN(endTimeMs) && nowMs > endTimeMs);
                      const isFuture = Boolean(startDateTimeStr && !isNaN(startTimeMs) && nowMs < startTimeMs);

                      const activeCampForSlot = campaignHistory.find(c => {
                        if (c.slotKey !== key) return false;
                        const cEnd = c.endDateTime ? new Date(c.endDateTime).getTime() : 0;
                        if (cEnd && nowMs > cEnd) return false;
                        return Boolean(c.sponsorBannerUrl);
                      });

                      return (
                        <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                          
                          {/* Live Running Ad Notice if Active in this Slot */}
                          {activeCampForSlot && (
                            <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '0.65rem 0.85rem', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                                <div>
                                  <span style={{ fontSize: '0.78rem', color: '#065F46', fontWeight: '800', display: 'block' }}>
                                    Live Ad Running on Website: "{activeCampForSlot.sponsorName}"
                                  </span>
                                  <span style={{ fontSize: '0.7rem', color: '#047857' }}>
                                    Schedule: {formatDisplayDateTime(activeCampForSlot.startDateTime) || 'Now'} to {formatDisplayDateTime(activeCampForSlot.endDateTime) || 'Until stopped'}
                                  </span>
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                <button
                                  type="button"
                                  onClick={(e) => handleStartEditCampaign(activeCampForSlot, e)}
                                  className="btn btn-outline"
                                  style={{ padding: '0.25rem 0.65rem', fontSize: '0.72rem', fontWeight: '700', borderColor: '#059669', color: '#059669', background: '#FFFFFF', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                                >
                                  <Edit3 size={11} /> Edit Live Ad
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setActiveSubTab('history')}
                                  className="btn btn-outline"
                                  style={{ padding: '0.25rem 0.65rem', fontSize: '0.72rem', borderColor: '#059669', color: '#059669', background: '#FFFFFF' }}
                                >
                                  View in Desk →
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Section Header */}
                          <div style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '0.4rem' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <Sparkles size={13} color="var(--accent-crimson)" /> Configure / Place Sponsor Ad:
                            </span>
                          </div>

                          {/* 1. Campaign Status & Auto-Expiry Indicator Bar */}
                          <div style={{ 
                            background: 'var(--bg-surface)', 
                            padding: '0.65rem 0.85rem', 
                            borderRadius: 'var(--radius-sm)', 
                            border: '1px solid var(--border-light)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '0.6rem'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-main)' }}>
                                Campaign Status:
                              </span>
                              <div style={{ display: 'flex', gap: '0.35rem' }}>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateSlotField(key, 'status', 'active')}
                                  className={`btn ${slot.status !== 'paused' ? 'btn-primary' : 'btn-outline'}`}
                                  style={{ padding: '0.2rem 0.6rem', fontSize: '0.72rem', fontWeight: '700', borderRadius: '20px' }}
                                >
                                  Active (Live)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateSlotField(key, 'status', 'paused')}
                                  className={`btn ${slot.status === 'paused' ? 'btn-primary' : 'btn-outline'}`}
                                  style={{ padding: '0.2rem 0.6rem', fontSize: '0.72rem', fontWeight: '700', borderRadius: '20px' }}
                                >
                                  Paused
                                </button>
                              </div>
                            </div>

                            {/* Expiry Pill Notice */}
                            {slot.status === 'paused' ? (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', fontStyle: 'italic' }}>
                                Paused by Admin • Slot falls back to AdSense
                              </span>
                            ) : isExpired ? (
                              <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#b45309', background: '#fef3c7', padding: '0.2rem 0.55rem', borderRadius: '4px', border: '1px solid #fde68a', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                <Clock size={12} /> Expired on {formatDisplayDateTime(endDateTimeStr)} (Falling back to AdSense)
                              </span>
                            ) : isFuture ? (
                              <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#0284c7', background: '#e0f2fe', padding: '0.2rem 0.55rem', borderRadius: '4px', border: '1px solid #bae6fd', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                <Calendar size={12} /> Scheduled: Starts on {formatDisplayDateTime(startDateTimeStr)}
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#059669', background: '#ecfdf5', padding: '0.2rem 0.55rem', borderRadius: '4px', border: '1px solid #a7f3d0', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                <Check size={12} /> Live Now {endDateTimeStr ? `(Ends ${formatDisplayDateTime(endDateTimeStr)})` : '(Always Active)'}
                              </span>
                            )}
                          </div>

                          {/* 2. One-Click Ad Scope (Roadmap A1 & A2) */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                              <label style={{ fontSize: '0.76rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
                                Placement Scope (Ad kahan dikhega):
                              </label>
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-subtle)' }}>
                                One-click scope switcher
                              </span>
                            </div>

                            <div className="monetization-scope-selector">
                              <button
                                type="button"
                                onClick={() => handleUpdateSlotField(key, 'scope', 'global')}
                                className={`btn ${(!slot.scope || slot.scope === 'global') ? 'btn-primary' : 'btn-outline'}`}
                                style={{ padding: '0.35rem 0.75rem', fontSize: '0.74rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                              >
                                <Globe size={13} /> Poori Site (Global)
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateSlotField(key, 'scope', 'category')}
                                className={`btn ${slot.scope === 'category' ? 'btn-primary' : 'btn-outline'}`}
                                style={{ padding: '0.35rem 0.75rem', fontSize: '0.74rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                              >
                                <Tag size={13} /> Is Category Mein
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateSlotField(key, 'scope', 'article')}
                                className={`btn ${slot.scope === 'article' ? 'btn-primary' : 'btn-outline'}`}
                                style={{ padding: '0.35rem 0.75rem', fontSize: '0.74rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                              >
                                <FileText size={13} /> Sirf Ek Article Mein
                              </button>
                            </div>

                            {/* Dynamic Context Box based on Scope */}
                            {(!slot.scope || slot.scope === 'global') && (
                              <div style={{ marginTop: '0.5rem', padding: '0.65rem 0.85rem', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '4px' }}>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-main)', fontWeight: '700', display: 'block', marginBottom: '0.2rem' }}>
                                  Global Scope Active:
                                </span>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)' }}>
                                  Ye sponsor ad poori website ke sabhi pages aur har article par dikhega (~All readers).
                                </span>
                                
                                {/* Optional Exclude Articles */}
                                <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--border-light)' }}>
                                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                                    Optional: Exclude Specific Articles (Kisi specific article me ad nahi dikhana ho to select karein):
                                  </label>
                                  <select
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (!val) return;
                                      const currentList = slot.excludeArticleIds 
                                        ? slot.excludeArticleIds.split(',').map(s => s.trim()).filter(Boolean)
                                        : [];
                                      if (!currentList.includes(val)) {
                                        currentList.push(val);
                                        handleUpdateSlotField(key, 'excludeArticleIds', currentList.join(', '));
                                      }
                                      e.target.value = '';
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '0.45rem 0.65rem',
                                      fontSize: '0.78rem',
                                      borderRadius: '4px',
                                      border: '1px solid var(--border-medium)',
                                      background: 'var(--bg-secondary)',
                                      color: 'var(--text-main)',
                                      boxSizing: 'border-box'
                                    }}
                                  >
                                    <option value="">+ Add an Article to Exclusion List (Headline chuno)...</option>
                                    {articleList.map((art, idx) => (
                                      <option key={art.id} value={art.id}>
                                        #{idx + 1} • {art.title} ({art.category || 'News'})
                                      </option>
                                    ))}
                                  </select>

                                  {/* Active Excluded Pills */}
                                  {slot.excludeArticleIds && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.4rem' }}>
                                      {slot.excludeArticleIds.split(',').map(s => s.trim()).filter(Boolean).map(exId => {
                                        const art = articleList.find(a => a.id === exId);
                                        return (
                                          <span 
                                            key={exId}
                                            style={{
                                              fontSize: '0.68rem',
                                              fontWeight: '700',
                                              padding: '0.15rem 0.45rem',
                                              background: '#fee2e2',
                                              border: '1px solid #fecaca',
                                              color: '#b91c1c',
                                              borderRadius: '12px',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '0.3rem'
                                            }}
                                          >
                                            {art ? art.title.slice(0, 30) + '...' : exId}
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const updated = slot.excludeArticleIds
                                                  .split(',')
                                                  .map(s => s.trim())
                                                  .filter(s => s && s !== exId)
                                                  .join(', ');
                                                handleUpdateSlotField(key, 'excludeArticleIds', updated);
                                              }}
                                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#b91c1c', fontWeight: '900', fontSize: '0.75rem', lineHeight: 1 }}
                                              title="Remove"
                                            >
                                              ×
                                            </button>
                                          </span>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {slot.scope === 'category' && (
                              <div style={{ marginTop: '0.5rem', padding: '0.65rem 0.85rem', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '4px' }}>
                                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', marginBottom: '0.3rem', color: 'var(--text-main)' }}>
                                  Select Target News Category:
                                </label>
                                <select
                                  value={slot.targetCategory || 'all'}
                                  onChange={(e) => handleUpdateSlotField(key, 'targetCategory', e.target.value)}
                                  style={{
                                    width: '100%',
                                    padding: '0.45rem 0.65rem',
                                    borderRadius: '4px',
                                    border: '1px solid var(--border-medium)',
                                    background: 'var(--bg-secondary)',
                                    fontSize: '0.8rem',
                                    fontWeight: '700',
                                    color: 'var(--text-main)',
                                    boxSizing: 'border-box'
                                  }}
                                >
                                  <option value="all">All Categories ({articleList.length} total articles)</option>
                                  {uniqueCategories.map(cat => {
                                    const count = articleList.filter(a => (a.category || a.category_slug || '').toLowerCase() === cat.slug.toLowerCase()).length;
                                    return (
                                      <option key={cat.slug} value={cat.slug}>
                                        {cat.name} ({count} stories)
                                      </option>
                                    );
                                  })}
                                </select>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', marginTop: '0.35rem', display: 'block' }}>
                                  Doosri categories me ye slot automatically Google AdSense par fallback ho jayega.
                                </span>
                              </div>
                            )}

                            {slot.scope === 'article' && (
                              <div style={{ marginTop: '0.5rem', padding: '0.75rem 0.85rem', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '6px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem', flexWrap: 'wrap', gap: '0.3rem' }}>
                                  <label style={{ fontSize: '0.76rem', fontWeight: '800', color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <FileText size={14} color="var(--accent-blue)" /> Target News Article (खबर चुनें):
                                  </label>
                                  <span style={{ fontSize: '0.68rem', color: 'var(--text-subtle)' }}>
                                    Total Library: {articleList.length} articles
                                  </span>
                                </div>

                                {(() => {
                                  const selected = articleList.find(a => String(a.id) === String(slot.targetArticleId));
                                  const pickerOpen = isPickerOpen[key] || !selected;
                                  const query = (articleSearchQueries[key] || '').toLowerCase().trim();
                                  const activeCat = articleCategoryFilters[key] || 'all';

                                  // Filter articles by dynamic category division and search query
                                  const matchingArticles = articleList.filter(art => {
                                    const artCat = (art.category || art.category_slug || '').toLowerCase();
                                    const matchesCat = activeCat === 'all' || artCat === activeCat.toLowerCase();
                                    const matchesQuery = !query || 
                                      (art.title && art.title.toLowerCase().includes(query)) ||
                                      (art.id && String(art.id).toLowerCase().includes(query)) ||
                                      (art.author && art.author.toLowerCase().includes(query));
                                    return matchesCat && matchesQuery;
                                  });

                                  // 1. Pristine Confirmation Card when Article is Selected
                                  if (selected && !pickerOpen) {
                                    return (
                                      <div style={{ padding: '0.65rem 0.85rem', background: '#eff6ff', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
                                          <div style={{ minWidth: 0, flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                                              <span style={{ fontSize: '0.68rem', fontWeight: '800', color: '#1d4ed8', background: '#dbeafe', padding: '0.15rem 0.45rem', borderRadius: '3px' }}>
                                                ID: {selected.id}
                                              </span>
                                              <span style={{ fontSize: '0.68rem', fontWeight: '700', color: '#2563eb', background: '#ffffff', padding: '0.15rem 0.45rem', borderRadius: '3px', border: '1px solid #dbeafe' }}>
                                                Category: {selected.category || 'News'}
                                              </span>
                                              {selected.date && (
                                                <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                                                  {formatDisplayDateTime(selected.date)}
                                                </span>
                                              )}
                                            </div>
                                            <span style={{ fontSize: '0.84rem', fontWeight: '800', color: '#1e3a8a', display: 'block', lineHeight: 1.35 }}>
                                              {selected.title}
                                            </span>
                                            <span style={{ fontSize: '0.68rem', color: '#3b82f6', marginTop: '0.25rem', display: 'block' }}>
                                              Sponsor banner sirf is selected khabar par dikhega. Baaki saare articles me AdSense auto-fill hoga.
                                            </span>
                                          </div>

                                          {/* Change & Reset Actions */}
                                          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', marginTop: '0.2rem', flexShrink: 0 }}>
                                            <button
                                              type="button"
                                              onClick={() => setIsPickerOpen(prev => ({ ...prev, [key]: true }))}
                                              style={{
                                                padding: '0.35rem 0.65rem',
                                                fontSize: '0.72rem',
                                                fontWeight: '700',
                                                color: '#1d4ed8',
                                                background: '#ffffff',
                                                border: '1px solid #93c5fd',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.25rem'
                                              }}
                                            >
                                              <Search size={12} /> Doosri News Chuno
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                handleUpdateSlotField(key, 'targetArticleId', '');
                                                setIsPickerOpen(prev => ({ ...prev, [key]: true }));
                                              }}
                                              style={{
                                                padding: '0.35rem 0.55rem',
                                                fontSize: '0.72rem',
                                                fontWeight: '700',
                                                color: '#b91c1c',
                                                background: '#fee2e2',
                                                border: '1px solid #fecaca',
                                                borderRadius: '4px',
                                                cursor: 'pointer'
                                              }}
                                              title="Clear selection"
                                            >
                                              Reset
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  }

                                  // 2. Interactive Searchable Picker (Live Search + Dynamic Category Filter)
                                  return (
                                    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: '6px', padding: '0.65rem 0.75rem' }}>
                                      {/* Search Input Row */}
                                      <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
                                        <Search 
                                          size={14} 
                                          style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)' }} 
                                        />
                                        <input
                                          type="text"
                                          placeholder="Type keyword or headline to search (e.g. ISRO, budget, train)..."
                                          value={articleSearchQueries[key] || ''}
                                          onChange={(e) => setArticleSearchQueries(prev => ({ ...prev, [key]: e.target.value }))}
                                          style={{
                                            width: '100%',
                                            padding: '0.5rem 2rem 0.5rem 2rem',
                                            borderRadius: '4px',
                                            border: '1px solid var(--border-medium)',
                                            background: 'var(--bg-surface)',
                                            fontSize: '0.8rem',
                                            fontWeight: '600',
                                            color: 'var(--text-main)',
                                            boxSizing: 'border-box'
                                          }}
                                        />
                                        {articleSearchQueries[key] && (
                                          <button
                                            type="button"
                                            onClick={() => setArticleSearchQueries(prev => ({ ...prev, [key]: '' }))}
                                            style={{
                                              position: 'absolute',
                                              right: '8px',
                                              top: '50%',
                                              transform: 'translateY(-50%)',
                                              background: 'none',
                                              border: 'none',
                                              cursor: 'pointer',
                                              color: 'var(--text-subtle)',
                                              fontSize: '0.9rem',
                                              fontWeight: 'bold',
                                              padding: '2px 6px'
                                            }}
                                            title="Clear search"
                                          >
                                            ×
                                          </button>
                                        )}
                                      </div>

                                      {/* Dynamic Category Division Pills */}
                                      <div style={{ marginBottom: '0.6rem' }}>
                                        <span style={{ fontSize: '0.68rem', fontWeight: '800', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '0.25rem' }}>
                                          Divide By Category:
                                        </span>
                                        <div style={{ display: 'flex', gap: '0.3rem', overflowX: 'auto', paddingBottom: '0.25rem', scrollbarWidth: 'thin' }}>
                                          <button
                                            type="button"
                                            onClick={() => setArticleCategoryFilters(prev => ({ ...prev, [key]: 'all' }))}
                                            style={{
                                              padding: '0.2rem 0.55rem',
                                              fontSize: '0.7rem',
                                              fontWeight: '700',
                                              borderRadius: '12px',
                                              border: `1px solid ${activeCat === 'all' ? 'var(--text-main)' : 'var(--border-light)'}`,
                                              background: activeCat === 'all' ? 'var(--text-main)' : 'var(--bg-surface)',
                                              color: activeCat === 'all' ? 'var(--bg-surface)' : 'var(--text-muted)',
                                              cursor: 'pointer',
                                              whiteSpace: 'nowrap',
                                              flexShrink: 0
                                            }}
                                          >
                                            All ({articleList.length})
                                          </button>

                                          {uniqueCategories.map(cat => {
                                            const count = articleList.filter(a => (a.category || a.category_slug || '').toLowerCase() === cat.slug.toLowerCase()).length;
                                            const isActive = activeCat.toLowerCase() === cat.slug.toLowerCase();
                                            return (
                                              <button
                                                key={cat.slug}
                                                type="button"
                                                onClick={() => setArticleCategoryFilters(prev => ({ ...prev, [key]: cat.slug }))}
                                                style={{
                                                  padding: '0.2rem 0.55rem',
                                                  fontSize: '0.7rem',
                                                  fontWeight: '700',
                                                  borderRadius: '12px',
                                                  border: `1px solid ${isActive ? 'var(--text-main)' : 'var(--border-light)'}`,
                                                  background: isActive ? 'var(--text-main)' : 'var(--bg-surface)',
                                                  color: isActive ? 'var(--bg-surface)' : 'var(--text-muted)',
                                                  cursor: 'pointer',
                                                  whiteSpace: 'nowrap',
                                                  flexShrink: 0
                                                }}
                                              >
                                                {cat.name} ({count})
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>

                                      {/* Results Header & Scrollable List */}
                                      <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                                          <span style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-main)' }}>
                                            {query || activeCat !== 'all' 
                                              ? `Matching Articles (${matchingArticles.length}):` 
                                              : `Latest Published News (Quick Select):`}
                                          </span>
                                          {selected && (
                                            <button
                                              type="button"
                                              onClick={() => setIsPickerOpen(prev => ({ ...prev, [key]: false }))}
                                              style={{ background: 'none', border: 'none', fontSize: '0.7rem', color: 'var(--accent-blue)', cursor: 'pointer', fontWeight: '700' }}
                                            >
                                              Close / Keep Current
                                            </button>
                                          )}
                                        </div>

                                        <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-medium)', borderRadius: '4px', background: 'var(--bg-surface)' }}>
                                          {matchingArticles.length === 0 ? (
                                            <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                                              Koi news match nahi hui. Dusra keyword ya category try karein.
                                            </div>
                                          ) : (
                                            matchingArticles.slice(0, 50).map((art, idx) => {
                                              const isCurrent = String(slot.targetArticleId) === String(art.id);
                                              return (
                                                <div
                                                  key={art.id}
                                                  onClick={() => {
                                                    handleUpdateSlotField(key, 'targetArticleId', art.id);
                                                    setIsPickerOpen(prev => ({ ...prev, [key]: false }));
                                                  }}
                                                  style={{
                                                    padding: '0.45rem 0.65rem',
                                                    borderBottom: idx < matchingArticles.length - 1 ? '1px solid var(--border-light)' : 'none',
                                                    cursor: 'pointer',
                                                    background: isCurrent ? '#eff6ff' : 'transparent',
                                                    transition: 'background 0.15s ease',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    gap: '0.5rem'
                                                  }}
                                                  onMouseEnter={(e) => { if (!isCurrent) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                                                  onMouseLeave={(e) => { if (!isCurrent) e.currentTarget.style.background = 'transparent'; }}
                                                >
                                                  <div style={{ minWidth: 0, flex: 1 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.15rem', flexWrap: 'wrap' }}>
                                                      <span style={{ fontSize: '0.64rem', fontWeight: '800', color: 'var(--accent-crimson)', background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', padding: '0.05rem 0.3rem', borderRadius: '3px' }}>
                                                        #{idx + 1}
                                                      </span>
                                                      <span style={{ fontSize: '0.65rem', fontWeight: '700', color: 'var(--text-muted)' }}>
                                                        {art.category || 'News'}
                                                      </span>
                                                      {art.date && (
                                                        <span style={{ fontSize: '0.62rem', color: 'var(--text-subtle)' }}>
                                                          • {formatDisplayDateTime(art.date)}
                                                        </span>
                                                      )}
                                                    </div>
                                                    <span style={{ fontSize: '0.78rem', fontWeight: '700', color: isCurrent ? '#1d4ed8' : 'var(--text-main)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                      {art.title}
                                                    </span>
                                                  </div>

                                                  <button
                                                    type="button"
                                                    style={{
                                                      padding: '0.25rem 0.55rem',
                                                      fontSize: '0.68rem',
                                                      fontWeight: '800',
                                                      borderRadius: '3px',
                                                      border: '1px solid',
                                                      borderColor: isCurrent ? '#1d4ed8' : 'var(--border-medium)',
                                                      background: isCurrent ? '#1d4ed8' : 'var(--bg-surface)',
                                                      color: isCurrent ? '#ffffff' : 'var(--text-main)',
                                                      cursor: 'pointer',
                                                      flexShrink: 0
                                                    }}
                                                  >
                                                    {isCurrent ? 'Selected' : 'Select'}
                                                  </button>
                                                </div>
                                              );
                                            })
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                          </div>

                          {/* 3. Campaign Lifetime Dates & Exact Times (Admin Order Schedule) */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.3rem' }}>
                              <label style={{ fontSize: '0.76rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
                                Campaign Date & Time Schedule (Order Timings):
                              </label>
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-subtle)' }}>
                                Exact Hours:Minutes precision
                              </span>
                            </div>

                            <div className="monetization-dates-grid">
                              <div>
                                <span style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-subtle)', display: 'block', marginBottom: '0.2rem' }}>
                                  Start Date & Time (कब से शुरू होगा):
                                </span>
                                <input
                                  type="datetime-local"
                                  value={slot.startDateTime || (slot.startDate ? `${slot.startDate}T00:00` : '')}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    handleUpdateSlotField(key, 'startDateTime', val);
                                    if (val) handleUpdateSlotField(key, 'startDate', val.slice(0, 10));
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '0.45rem 0.65rem',
                                    borderRadius: '4px',
                                    border: '1px solid var(--border-medium)',
                                    background: 'var(--bg-surface)',
                                    fontSize: '0.8rem',
                                    boxSizing: 'border-box',
                                    color: 'var(--text-main)'
                                  }}
                                />
                                <span style={{ fontSize: '0.68rem', color: 'var(--text-subtle)', marginTop: '0.2rem', display: 'block' }}>
                                  Is date aur time se pehle ye ad nahi dikhega.
                                </span>
                              </div>

                              <div>
                                <span style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-subtle)', display: 'block', marginBottom: '0.2rem' }}>
                                  End Date & Time (कब तक चलेगा - Auto Expiry):
                                </span>
                                <input
                                  type="datetime-local"
                                  value={slot.endDateTime || (slot.endDate ? `${slot.endDate}T23:59` : '')}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    handleUpdateSlotField(key, 'endDateTime', val);
                                    if (val) handleUpdateSlotField(key, 'endDate', val.slice(0, 10));
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '0.45rem 0.65rem',
                                    borderRadius: '4px',
                                    border: `1px solid ${isExpired ? '#f59e0b' : 'var(--border-medium)'}`,
                                    background: 'var(--bg-surface)',
                                    fontSize: '0.8rem',
                                    boxSizing: 'border-box',
                                    color: 'var(--text-main)'
                                  }}
                                />
                                <span style={{ fontSize: '0.68rem', color: isExpired ? '#b45309' : 'var(--text-subtle)', marginTop: '0.2rem', display: 'block' }}>
                                  Is date aur time par pahunchte hi ad automatic expire ho jayega.
                                </span>
                              </div>
                            </div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', marginTop: '0.35rem', display: 'block' }}>
                              Backend server is schedule ko real clock se verify karta hai aur expire hone par turant Google AdSense par shift kar deta hai.
                            </span>
                          </div>

                          {/* 4. Advertiser Details */}
                          <div className="monetization-sponsor-grid">
                            {/* Sponsor Name */}
                            <div>
                              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.25rem' }}>
                                Advertiser / Brand Name:
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. City Coaching Classes / Apex Hospital"
                                value={slot.sponsorName || ''}
                                onChange={(e) => handleUpdateSlotField(key, 'sponsorName', e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '0.45rem 0.65rem',
                                  borderRadius: '4px',
                                  border: '1px solid var(--border-medium)',
                                  background: 'var(--bg-surface)',
                                  fontSize: '0.8rem',
                                  boxSizing: 'border-box'
                                }}
                              />
                            </div>

                            {/* Destination URL */}
                            <div>
                              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.25rem' }}>
                                Click Destination Link (WhatsApp / Website):
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. 9876543210 (WhatsApp) or https://..."
                                value={slot.sponsorTargetUrl || ''}
                                onChange={(e) => handleUpdateSlotField(key, 'sponsorTargetUrl', e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '0.45rem 0.65rem',
                                  borderRadius: '4px',
                                  border: '1px solid var(--border-medium)',
                                  background: 'var(--bg-surface)',
                                  fontSize: '0.8rem',
                                  boxSizing: 'border-box'
                                }}
                              />
                              {(() => {
                                const targetInfo = parseSponsorTargetUrl(slot.sponsorTargetUrl, slot.sponsorName);
                                if (targetInfo.isWhatsApp) {
                                  return (
                                    <div style={{ marginTop: '0.35rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.35rem 0.6rem', background: 'rgba(5, 150, 105, 0.08)', border: '1px solid #10b981', borderRadius: '4px', fontSize: '0.72rem' }}>
                                      <span style={{ color: '#047857', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                        <MessageCircle size={13} /> 1-Tap WhatsApp Connect: {targetInfo.display}
                                      </span>
                                      <a href={targetInfo.url} target="_blank" rel="noopener noreferrer" style={{ color: '#047857', fontWeight: '800', textDecoration: 'underline' }}>
                                        Test Link ↗
                                      </a>
                                    </div>
                                  );
                                } else if (slot.sponsorTargetUrl && slot.sponsorTargetUrl.trim() && targetInfo.type === 'website') {
                                  return (
                                    <div style={{ marginTop: '0.35rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.35rem 0.6rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: '4px', fontSize: '0.72rem' }}>
                                      <span style={{ color: 'var(--text-subtle)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                        <Globe size={13} /> External Website: {targetInfo.display}
                                      </span>
                                      <a href={targetInfo.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)', fontWeight: '700', textDecoration: 'underline' }}>
                                        Test Link ↗
                                      </a>
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          </div>

                          {/* Banner Image Upload & Preview with Dimension Guard (Task 16.6) */}
                          {(() => {
                            const slotGuard = getSlotDimensionGuard(key);
                            return (
                              <>
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.35rem' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: '700', margin: 0 }}>
                                      Upload Sponsor Poster / Banner Image:
                                    </label>
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.18rem 0.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: '4px', fontSize: '0.7rem', color: 'var(--text-subtle)' }}>
                                      <Maximize2 size={11} color="var(--accent-crimson)" />
                                      <span><strong>Recommended:</strong> {slotGuard.recommendedBadge}</span>
                                      <span style={{ color: 'var(--border-dark)' }}>•</span>
                                      <span>Max Clamp: <strong>{slotGuard.desktopMaxHeight}px</strong></span>
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={(e) => handleUploadSponsorBanner(key, e)}
                                      disabled={isUploading[key]}
                                      style={{ fontSize: '0.78rem', maxWidth: '100%' }}
                                    />
                                    {isUploading[key] && (
                                      <span style={{ fontSize: '0.75rem', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                        <RefreshCw size={12} className="spin" /> Uploading WebP...
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Banner Preview If Exists */}
                                {slot.sponsorBannerUrl && (
                                  <div style={{ marginTop: '0.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem', flexWrap: 'wrap', gap: '0.25rem' }}>
                                      <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                        <Check size={12} color="#047857" /> Live Clamped Preview ({slotGuard.desktopMaxHeight}px Guard Active):
                                      </span>
                                      {uploadStats[key] && (
                                        <span style={{ fontSize: '0.72rem', color: '#047857', background: '#ECFDF5', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid #A7F3D0', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                          <Check size={12} /> {uploadStats[key].compressedKB} KB WebP ({uploadStats[key].savedPercent}% compressed from {uploadStats[key].originalKB} KB)
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ 
                                      maxWidth: '100%', 
                                      width: '100%', 
                                      maxHeight: `${slotGuard.desktopMaxHeight}px`,
                                      borderRadius: '4px', 
                                      overflow: 'hidden', 
                                      border: '1px solid var(--border-medium)', 
                                      background: 'var(--bg-secondary)',
                                      boxSizing: 'border-box',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      padding: '4px'
                                    }}>
                                      <img 
                                        src={slot.sponsorBannerUrl} 
                                        alt="Sponsor preview" 
                                        style={{ 
                                          maxWidth: '100%', 
                                          maxHeight: `${slotGuard.desktopMaxHeight}px`, 
                                          width: 'auto',
                                          height: 'auto', 
                                          objectFit: 'contain', 
                                          display: 'block',
                                          margin: '0 auto'
                                        }} 
                                      />
                                    </div>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      </>
      )}

      {/* VIEW 2: AD CAMPAIGN HISTORY & ARCHIVE DESK */}
      {activeSubTab === 'history' && (
        <div className="campaign-history-container">
          {/* History Header & Summary */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <History size={20} color="var(--accent-crimson)" />
                Active Campaigns Desk (Zero-Waste Storage)
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', margin: '0.2rem 0 0 0' }}>
                Zero storage bloat: Campaign data and poster media exist <strong>only while the ad is running or scheduled</strong>. The moment the end time passes, data and images are automatically deleted from server disk.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                fetchAdHistory().then(h => {
                  if (Array.isArray(h)) {
                    setCampaignHistory(h);
                    if (onShowToast) onShowToast('Storage verified: All expired campaigns & files cleaned!');
                  }
                });
              }}
              className="btn btn-secondary"
              style={{ padding: '0.45rem 0.85rem', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <RefreshCw size={13} /> Verify & Clean Storage
            </button>
          </div>

          {/* Metric Counters Strip */}
          <div className="campaign-history-stats-grid">
            <div className="campaign-stat-box">
              <div className="val">{historyStats.total}</div>
              <div className="lbl">Active & Scheduled</div>
            </div>
            <div className="campaign-stat-box" style={{ borderColor: '#A7F3D0' }}>
              <div className="val" style={{ color: '#047857' }}>{historyStats.live}</div>
              <div className="lbl">Live Right Now</div>
            </div>
            <div className="campaign-stat-box" style={{ borderColor: '#BFDBFE' }}>
              <div className="val" style={{ color: '#1D4ED8' }}>{historyStats.scheduled}</div>
              <div className="lbl">Scheduled Future</div>
            </div>
            <div className="campaign-stat-box" style={{ borderColor: 'rgba(59, 130, 246, 0.4)' }}>
              <div className="val" style={{ color: '#2563EB' }}>{historyStats.totalImpressions.toLocaleString()}</div>
              <div className="lbl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                <Eye size={12} /> Total Ad Views
              </div>
            </div>
            <div className="campaign-stat-box" style={{ borderColor: 'rgba(16, 185, 129, 0.4)' }}>
              <div className="val" style={{ color: '#059669' }}>{historyStats.totalClicks.toLocaleString()}</div>
              <div className="lbl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                <MousePointer size={12} /> Total Ad Clicks
              </div>
            </div>
            <div className="campaign-stat-box" style={{ borderColor: 'var(--accent-crimson)' }}>
              <div className="val" style={{ color: 'var(--accent-crimson)' }}>{historyStats.avgCtr}%</div>
              <div className="lbl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                <TrendingUp size={12} /> Overall CTR
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="campaign-filter-strip">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 260px' }}>
              <div style={{ position: 'relative', width: '100%' }}>
                <Search size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)' }} />
                <input
                  type="text"
                  placeholder="Search by sponsor, link, or slot..."
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.65rem 0.45rem 2rem',
                    borderRadius: '4px',
                    border: '1px solid var(--border-medium)',
                    fontSize: '0.8rem',
                    background: 'var(--bg-secondary)',
                    boxSizing: 'border-box'
                  }}
                />
                {historySearchQuery && (
                  <button
                    type="button"
                    onClick={() => setHistorySearchQuery('')}
                    style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Status Filter Pills */}
              <div style={{ display: 'inline-flex', border: '1px solid var(--border-medium)', borderRadius: '4px', overflow: 'hidden' }}>
                {[
                  { id: 'all', label: 'All' },
                  { id: 'live', label: 'Live Now' },
                  { id: 'scheduled', label: 'Scheduled' }
                ].map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setHistoryStatusFilter(f.id)}
                    style={{
                      padding: '0.35rem 0.65rem',
                      fontSize: '0.74rem',
                      fontWeight: historyStatusFilter === f.id ? '700' : '500',
                      background: historyStatusFilter === f.id ? 'var(--primary)' : 'var(--bg-surface)',
                      color: historyStatusFilter === f.id ? '#ffffff' : 'var(--text-main)',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Slot Filter Select */}
              <select
                value={historySlotFilter}
                onChange={(e) => setHistorySlotFilter(e.target.value)}
                style={{
                  padding: '0.35rem 0.65rem',
                  borderRadius: '4px',
                  border: '1px solid var(--border-medium)',
                  background: 'var(--bg-surface)',
                  fontSize: '0.74rem'
                }}
              >
                <option value="all">All Placement Slots</option>
                {slotKeys.map(k => (
                  <option key={k} value={k}>{adConfig.slots?.[k]?.name || k}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Campaign Card Rows */}
          {filteredHistory.length === 0 ? (
            <div style={{
              padding: '3rem 1.5rem',
              textAlign: 'center',
              background: 'var(--bg-surface)',
              border: '1px dashed var(--border-medium)',
              borderRadius: 'var(--radius-sm)'
            }}>
              <History size={36} color="var(--text-subtle)" style={{ margin: '0 auto 0.75rem auto', opacity: 0.6 }} />
              <h4 style={{ margin: '0 0 0.35rem 0', fontSize: '0.95rem', fontWeight: '800' }}>
                {campaignHistory.length === 0 ? 'No Archived Campaigns Yet' : 'No Campaigns Match Your Search'}
              </h4>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-subtle)', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
                {campaignHistory.length === 0 
                  ? 'Whenever you save or schedule a direct sponsor banner in any slot, an automatic snapshot will be preserved here.'
                  : 'Try clearing the search query or status filter to see all archived campaigns.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filteredHistory.map(camp => {
                const nowMs = referenceTime;
                const startMs = camp.startDateTime ? new Date(camp.startDateTime).getTime() : 0;
                const endMs = camp.endDateTime ? new Date(camp.endDateTime).getTime() : 0;
                
                let statusBadge = (
                  <span className="status-badge-live">
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                    Live Now
                  </span>
                );
                if (endMs && nowMs > endMs) {
                  statusBadge = (
                    <span className="status-badge-expired">
                      <Clock size={11} /> Completed
                    </span>
                  );
                } else if (startMs && nowMs < startMs) {
                  statusBadge = (
                    <span className="status-badge-scheduled">
                      <Calendar size={11} /> Scheduled
                    </span>
                  );
                }

                return (
                  <div key={camp.id} className="campaign-card-row">
                    {/* Left Column: Thumbnail & Basic Info */}
                    <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center', minWidth: '260px', flex: '1 1 300px' }}>
                      {camp.sponsorBannerUrl ? (
                        <img
                          src={camp.sponsorBannerUrl}
                          alt={camp.sponsorName}
                          className="campaign-thumb-preview"
                          onClick={() => setPreviewBannerUrl(camp.sponsorBannerUrl)}
                          title="Click to view full banner"
                          style={{ cursor: 'pointer' }}
                        />
                      ) : (
                        <div className="campaign-thumb-preview" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <ImageIcon size={20} color="var(--text-subtle)" />
                        </div>
                      )}

                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
                          <span style={{ fontWeight: '800', fontSize: '0.92rem', color: 'var(--text-main)' }}>
                            {camp.sponsorName}
                          </span>
                          {statusBadge}
                        </div>

                        <div style={{ fontSize: '0.74rem', color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: '700', color: 'var(--accent-blue)' }}>{camp.slotName}</span>
                          <span>•</span>
                          {(() => {
                            const targetInfo = parseSponsorTargetUrl(camp.sponsorTargetUrl, camp.sponsorName);
                            if (targetInfo.isWhatsApp) {
                              return (
                                <a
                                  href={targetInfo.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={`Click to test WhatsApp chat with ${camp.sponsorName}`}
                                  style={{ color: '#047857', fontWeight: '700', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                                >
                                  <MessageCircle size={11} /> WhatsApp: {targetInfo.display} <ExternalLink size={10} />
                                </a>
                              );
                            }
                            if (camp.sponsorTargetUrl && targetInfo.type === 'website') {
                              return (
                                <a
                                  href={targetInfo.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ color: 'var(--accent-blue)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                                >
                                  {targetInfo.display.slice(0, 28)} <ExternalLink size={11} />
                                </a>
                              );
                            }
                            return <span>No target link</span>;
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Middle Column: Scope & Schedule */}
                    <div style={{ minWidth: '220px', flex: '1 1 240px', fontSize: '0.75rem' }}>
                      <div style={{ marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Tag size={12} color="var(--text-subtle)" />
                        <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>
                          {camp.scope === 'global' ? 'Global (All Pages)' : camp.scope === 'category' ? `Category: ${camp.targetCategory}` : `Article: #${camp.targetArticleId}`}
                        </span>
                      </div>
                      {camp.targetArticleTitle && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', fontStyle: 'italic', marginBottom: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '280px' }}>
                          "{camp.targetArticleTitle}"
                        </div>
                      )}
                      <div style={{ color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Clock size={12} />
                        <span>
                          {formatDisplayDateTime(camp.startDateTime) || 'Immediate'} to {formatDisplayDateTime(camp.endDateTime) || 'Until Manual Stop'}
                        </span>
                      </div>
                    </div>

                    {/* Analytics Column: Verified Impressions, Clicks, and CTR */}
                    <div style={{ minWidth: '150px', flex: '0 1 170px', display: 'flex', flexDirection: 'column', gap: '0.35rem', justifyContent: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <span 
                          style={{ 
                            fontSize: '0.72rem', 
                            fontWeight: '800', 
                            background: 'rgba(59, 130, 246, 0.1)', 
                            color: '#2563EB', 
                            padding: '0.18rem 0.5rem', 
                            borderRadius: '4px', 
                            border: '1px solid rgba(59, 130, 246, 0.25)', 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '0.25rem' 
                          }} 
                          title="Verified Impressions (Views by real readers)"
                        >
                          <Eye size={12} /> {(camp.impressions || 0).toLocaleString()} Views
                        </span>
                        <span 
                          style={{ 
                            fontSize: '0.72rem', 
                            fontWeight: '800', 
                            background: 'rgba(16, 185, 129, 0.1)', 
                            color: '#059669', 
                            padding: '0.18rem 0.5rem', 
                            borderRadius: '4px', 
                            border: '1px solid rgba(16, 185, 129, 0.25)', 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '0.25rem' 
                          }} 
                          title="Verified Direct Clicks / Leads"
                        >
                          <MousePointer size={12} /> {(camp.clicks || 0).toLocaleString()} Clicks
                        </span>
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <TrendingUp size={11} color="var(--accent-crimson)" />
                        <span>CTR: <strong>{((camp.clicks || 0) / Math.max(1, (camp.impressions || 0)) * 100).toFixed(1)}%</strong></span>
                      </div>
                    </div>

                    {/* Right Column: Edit, Proof Card, 1-Click Re-Run & Actions */}
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setProofCampaign(camp);
                        }}
                        className="btn btn-outline"
                        style={{
                          padding: '0.45rem 0.75rem',
                          fontSize: '0.78rem',
                          fontWeight: '700',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          borderColor: '#10B981',
                          color: '#047857',
                          background: 'rgba(16, 185, 129, 0.06)'
                        }}
                        title="Open verified performance card to copy WhatsApp proof for client"
                      >
                        <BarChart2 size={13} /> Proof Card
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleStartEditCampaign(camp, e)}
                        className="btn btn-outline"
                        style={{
                          padding: '0.45rem 0.85rem',
                          fontSize: '0.78rem',
                          fontWeight: '700',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          borderColor: 'var(--accent-blue)',
                          color: 'var(--accent-blue)',
                          background: 'var(--bg-surface)'
                        }}
                        title="Edit this campaign to correct errors or update details"
                      >
                        <Edit3 size={13} /> Edit Ad
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleStartClone(camp, e)}
                        className="btn btn-primary"
                        style={{
                          padding: '0.45rem 0.85rem',
                          fontSize: '0.78rem',
                          fontWeight: '700',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem'
                        }}
                        title="1-Click Re-Run this campaign"
                      >
                        <RotateCcw size={13} /> Re-Run / Clone
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteHistory(camp.id, e)}
                        style={{
                          padding: '0.45rem',
                          background: 'none',
                          border: '1px solid var(--border-medium)',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          color: 'var(--text-subtle)'
                        }}
                        title="Remove from history"
                      >
                        <Trash2 size={14} color="#EF4444" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: 1-CLICK RE-RUN / CLONE CAMPAIGN */}
      {cloningCampaign && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          boxSizing: 'border-box'
        }}>
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-md)',
            maxWidth: '520px',
            width: '100%',
            padding: '1.5rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            boxSizing: 'border-box'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
              <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <RotateCcw size={18} color="var(--accent-crimson)" />
                Re-Run / Clone Sponsor Campaign
              </h4>
              <button
                type="button"
                onClick={() => setCloningCampaign(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: '6px', alignItems: 'center' }}>
              {cloningCampaign.sponsorBannerUrl ? (
                <img
                  src={cloningCampaign.sponsorBannerUrl}
                  alt=""
                  style={{ width: '80px', height: '52px', objectFit: 'contain', background: '#fff', border: '1px solid var(--border-medium)', borderRadius: '4px' }}
                />
              ) : (
                <div style={{ width: '80px', height: '52px', background: '#fff', border: '1px solid var(--border-medium)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ImageIcon size={20} color="var(--text-subtle)" />
                </div>
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: '800', fontSize: '0.9rem', color: 'var(--text-main)' }}>{cloningCampaign.sponsorName}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Target: {cloningCampaign.sponsorTargetUrl || 'None'}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--accent-blue)', fontWeight: '700', marginTop: '0.2rem' }}>
                  Originally in: {cloningCampaign.slotName}
                </div>
              </div>
            </div>

            {/* Choose Destination Slot */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.35rem' }}>
                Select Placement Slot to Run This Campaign In:
              </label>
              <select
                value={cloneTargetSlot}
                onChange={(e) => setCloneTargetSlot(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem',
                  borderRadius: '4px',
                  border: '1px solid var(--border-medium)',
                  background: 'var(--bg-surface)',
                  fontSize: '0.82rem',
                  fontWeight: '600'
                }}
              >
                {slotKeys.map(k => (
                  <option key={k} value={k}>
                    {adConfig.slots?.[k]?.name || k} ({adConfig.slots?.[k]?.desktopDimensions})
                  </option>
                ))}
              </select>
              {(() => {
                const targetGuard = getSlotDimensionGuard(cloneTargetSlot);
                return (
                  <div style={{ marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: 'var(--text-subtle)' }}>
                    <Maximize2 size={12} color="var(--accent-crimson)" />
                    <span>Target Slot Guard: <strong>{targetGuard.recommendedBadge}</strong> (Clamped to {targetGuard.desktopMaxHeight}px)</span>
                  </div>
                );
              })()}
            </div>

            {/* Choose Duration */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.35rem' }}>
                Campaign Duration Preset (From Right Now):
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                {[
                  { label: 'Next 24 Hours', days: 1 },
                  { label: 'Next 7 Days', days: 7 },
                  { label: 'Next 30 Days', days: 30 }
                ].map(p => (
                  <button
                    key={p.days}
                    type="button"
                    onClick={() => setCloneDurationDays(p.days)}
                    style={{
                      padding: '0.5rem',
                      fontSize: '0.75rem',
                      fontWeight: cloneDurationDays === p.days ? '800' : '600',
                      borderRadius: '4px',
                      border: cloneDurationDays === p.days ? '1px solid var(--accent-blue)' : '1px solid var(--border-medium)',
                      background: cloneDurationDays === p.days ? '#EFF6FF' : 'var(--bg-surface)',
                      color: cloneDurationDays === p.days ? '#1D4ED8' : 'var(--text-main)',
                      cursor: 'pointer'
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setCloningCampaign(null)}
                className="btn btn-secondary"
                style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClone}
                className="btn btn-primary"
                style={{
                  padding: '0.5rem 1.25rem',
                  fontSize: '0.82rem',
                  fontWeight: '700',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <RotateCcw size={14} /> Re-Run & Pre-Fill Slot
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1B: EDIT CAMPAIGN MODAL (CORRECT ERRORS & UPDATE LIVE AD) */}
      {editingCampaign && (
        <div className="clone-modal-overlay" onClick={() => setEditingCampaign(null)}>
          <div className="clone-modal-box" style={{ maxWidth: '620px' }} onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-medium)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Edit3 size={18} color="var(--accent-blue)" /> Edit Ad Campaign
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                  Galti sahi karein — update sponsor details, phone/link, banner image or schedule.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingCampaign(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: 'var(--text-subtle)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '68vh', overflowY: 'auto', paddingRight: '0.35rem' }}>
              
              {/* Placement Slot Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.25rem' }}>
                  Ad Placement Slot:
                </label>
                <select
                  value={editFormData.slotKey || 'header'}
                  onChange={(e) => {
                    const k = e.target.value;
                    setEditFormData(prev => ({
                      ...prev,
                      slotKey: k,
                      slotName: adConfig.slots?.[k]?.name || k
                    }));
                  }}
                  style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '4px', border: '1px solid var(--border-medium)', background: 'var(--bg-secondary)', fontSize: '0.8rem', color: 'var(--text-main)', boxSizing: 'border-box' }}
                >
                  {slotKeys.map(k => (
                    <option key={k} value={k}>{adConfig.slots?.[k]?.name || k}</option>
                  ))}
                </select>
                {(() => {
                  const currentSlotGuard = getSlotDimensionGuard(editFormData.slotKey || 'header');
                  return (
                    <div style={{ marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: 'var(--text-subtle)' }}>
                      <Maximize2 size={12} color="var(--accent-crimson)" />
                      <span>Slot Dimension Guard: <strong>{currentSlotGuard.recommendedBadge}</strong> (Aspect: {currentSlotGuard.aspectRatio} • Max: {currentSlotGuard.desktopMaxHeight}px)</span>
                    </div>
                  );
                })()}
              </div>

              {/* Sponsor Name & Target URL / Phone */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.25rem' }}>
                    Sponsor / Brand Name:
                  </label>
                  <input
                    type="text"
                    value={editFormData.sponsorName || ''}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, sponsorName: e.target.value }))}
                    placeholder="e.g. City Jewellers"
                    style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '4px', border: '1px solid var(--border-medium)', background: 'var(--bg-secondary)', fontSize: '0.8rem', color: 'var(--text-main)', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.25rem' }}>
                    Destination Link OR 10-Digit WhatsApp:
                  </label>
                  <input
                    type="text"
                    value={editFormData.sponsorTargetUrl || ''}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, sponsorTargetUrl: e.target.value }))}
                    placeholder="e.g. 9876543210 or https://..."
                    style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '4px', border: '1px solid var(--border-medium)', background: 'var(--bg-secondary)', fontSize: '0.8rem', color: 'var(--text-main)', boxSizing: 'border-box' }}
                  />
                  {(() => {
                    const targetInfo = parseSponsorTargetUrl(editFormData.sponsorTargetUrl, editFormData.sponsorName);
                    if (targetInfo.isWhatsApp) {
                      return (
                        <div style={{ marginTop: '0.35rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.35rem 0.6rem', background: 'rgba(5, 150, 105, 0.08)', border: '1px solid #10b981', borderRadius: '4px', fontSize: '0.72rem' }}>
                          <span style={{ color: '#047857', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            <MessageCircle size={13} /> WhatsApp Connect: {targetInfo.display}
                          </span>
                          <a href={targetInfo.url} target="_blank" rel="noopener noreferrer" style={{ color: '#047857', fontWeight: '800', textDecoration: 'underline' }}>
                            Test Link ↗
                          </a>
                        </div>
                      );
                    } else if (editFormData.sponsorTargetUrl && editFormData.sponsorTargetUrl.trim() && targetInfo.type === 'website') {
                      return (
                        <div style={{ marginTop: '0.35rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.35rem 0.6rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: '4px', fontSize: '0.72rem' }}>
                          <span style={{ color: 'var(--text-subtle)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            <Globe size={13} /> External Website: {targetInfo.display}
                          </span>
                          <a href={targetInfo.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)', fontWeight: '700', textDecoration: 'underline' }}>
                            Test Link ↗
                          </a>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>

              {/* Start and End Date & Time */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.25rem' }}>
                    Start Date & Time:
                  </label>
                  <input
                    type="datetime-local"
                    value={editFormData.startDateTime || ''}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, startDateTime: e.target.value }))}
                    style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '4px', border: '1px solid var(--border-medium)', background: 'var(--bg-secondary)', fontSize: '0.8rem', color: 'var(--text-main)', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.25rem' }}>
                    End Date & Time:
                  </label>
                  <input
                    type="datetime-local"
                    value={editFormData.endDateTime || ''}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, endDateTime: e.target.value }))}
                    style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '4px', border: '1px solid var(--border-medium)', background: 'var(--bg-secondary)', fontSize: '0.8rem', color: 'var(--text-main)', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Target Scope */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.35rem' }}>
                  Target Display Scope:
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {[
                    { id: 'global', label: 'All Website Pages' },
                    { id: 'category', label: 'Specific Category' },
                    { id: 'article', label: 'Single Article' }
                  ].map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setEditFormData(prev => ({ ...prev, scope: s.id }))}
                      className={`btn ${editFormData.scope === s.id ? 'btn-primary' : 'btn-outline'}`}
                      style={{ padding: '0.35rem 0.65rem', fontSize: '0.74rem' }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {editFormData.scope === 'category' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', marginBottom: '0.25rem' }}>
                    Select Target Category:
                  </label>
                  <select
                    value={editFormData.targetCategory || 'all'}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, targetCategory: e.target.value }))}
                    style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '4px', border: '1px solid var(--border-medium)', background: 'var(--bg-secondary)', fontSize: '0.78rem', color: 'var(--text-main)', boxSizing: 'border-box' }}
                  >
                    <option value="all">All Categories</option>
                    {uniqueCategories.map(c => (
                      <option key={c.slug} value={c.slug}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {editFormData.scope === 'article' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', marginBottom: '0.25rem' }}>
                    Select Target Article:
                  </label>
                  <select
                    value={editFormData.targetArticleId || ''}
                    onChange={(e) => {
                      const artId = e.target.value;
                      const art = articleList.find(a => a.id === artId);
                      setEditFormData(prev => ({
                        ...prev,
                        targetArticleId: artId,
                        targetArticleTitle: art?.title || ''
                      }));
                    }}
                    style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '4px', border: '1px solid var(--border-medium)', background: 'var(--bg-secondary)', fontSize: '0.78rem', color: 'var(--text-main)', boxSizing: 'border-box' }}
                  >
                    <option value="">Select an Article...</option>
                    {articleList.map((a, i) => (
                      <option key={a.id} value={a.id}>#{i + 1} • {a.title}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Banner Poster & Replace Upload with Dimension Guard (Task 16.6) */}
              <div>
                {(() => {
                  const modalGuard = getSlotDimensionGuard(editFormData.slotKey || 'header');
                  return (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.35rem' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: '700', margin: 0 }}>
                          Banner Poster Image:
                        </label>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                          Clamped to max <strong>{modalGuard.desktopMaxHeight}px</strong>
                        </span>
                      </div>
                      {editFormData.sponsorBannerUrl && (
                        <div style={{ 
                          marginBottom: '0.5rem', 
                          borderRadius: '4px', 
                          overflow: 'hidden', 
                          border: '1px solid var(--border-medium)', 
                          background: 'var(--bg-secondary)',
                          maxHeight: `${modalGuard.desktopMaxHeight}px`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '4px',
                          boxSizing: 'border-box'
                        }}>
                          <img 
                            src={editFormData.sponsorBannerUrl} 
                            alt="Poster" 
                            style={{ 
                              maxWidth: '100%', 
                              maxHeight: `${modalGuard.desktopMaxHeight}px`, 
                              width: 'auto',
                              height: 'auto',
                              objectFit: 'contain', 
                              display: 'block',
                              margin: '0 auto'
                            }} 
                          />
                        </div>
                      )}
                    </>
                  );
                })()}
                <label style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', display: 'block', marginBottom: '0.2rem' }}>
                  Upload new banner to replace existing (Optional):
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUploadEditBanner}
                  style={{ fontSize: '0.76rem' }}
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-medium)' }}>
              <button
                type="button"
                onClick={() => setEditingCampaign(null)}
                className="btn btn-outline"
                style={{ padding: '0.45rem 0.95rem', fontSize: '0.8rem' }}
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isUpdatingCampaign}
                onClick={handleSaveEditedCampaign}
                className="btn btn-primary"
                style={{ padding: '0.45rem 1.15rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                {isUpdatingCampaign ? <RefreshCw size={13} className="spin" /> : <Save size={13} />}
                {isUpdatingCampaign ? 'Saving...' : 'Save & Update Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: BANNER LIGHTBOX PREVIEW */}
      {previewBannerUrl && (
        <div
          onClick={() => setPreviewBannerUrl(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            cursor: 'zoom-out'
          }}
        >
          <div style={{ position: 'relative', maxWidth: '900px', width: '100%', textAlign: 'center' }}>
            <img
              src={previewBannerUrl}
              alt="Full Banner Preview"
              style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: '6px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
            />
            <div style={{ marginTop: '0.75rem', color: '#fff', fontSize: '0.8rem' }}>
              Click anywhere to close preview
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: VERIFIED CLIENT PROOF & WHATSAPP PERFORMANCE CARD */}
      {proofCampaign && (
        <div 
          onClick={() => setProofCampaign(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            boxSizing: 'border-box'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-md)',
              maxWidth: '540px',
              width: '100%',
              padding: 'clamp(1rem, 4vw, 1.5rem)',
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: '0 24px 48px rgba(0,0,0,0.35)',
              boxSizing: 'border-box',
              position: 'relative'
            }}
          >
            {/* Header with Verified Shield Badge */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.85rem' }}>
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(16, 185, 129, 0.1)', color: '#047857', padding: '0.2rem 0.55rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>
                  <ShieldCheck size={13} /> PublicSpark Verified Proof
                </div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '900', color: 'var(--text-main)', fontFamily: 'var(--font-heading)' }}>
                  {proofCampaign.sponsorName}
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-subtle)' }}>
                  Slot: <strong>{proofCampaign.slotName}</strong> ({proofCampaign.desktopDimensions || 'Standard'})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setProofCampaign(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.35rem', color: 'var(--text-subtle)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Campaign Poster Preview Banner */}
            <div style={{ marginBottom: '1.15rem', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-medium)', background: '#0F172A', textAlign: 'center' }}>
              {proofCampaign.sponsorBannerUrl ? (
                <img 
                  src={proofCampaign.sponsorBannerUrl} 
                  alt={proofCampaign.sponsorName} 
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallbackEl = e.currentTarget.parentElement?.querySelector('.proof-fallback-banner');
                    if (fallbackEl) fallbackEl.style.display = 'block';
                  }}
                  style={{ maxHeight: '130px', width: '100%', objectFit: 'contain', display: 'block', margin: '0 auto' }} 
                />
              ) : null}
              <div 
                className="proof-fallback-banner" 
                style={{ 
                  display: proofCampaign.sponsorBannerUrl ? 'none' : 'block', 
                  padding: '1.25rem 1rem', 
                  background: 'linear-gradient(135deg, #1E293B, #0F172A)', 
                  color: '#F8FAFC' 
                }}
              >
                <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#F1F5F9' }}>{proofCampaign.sponsorName}</div>
                <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '0.25rem' }}>{proofCampaign.slotName} • Verified Direct Sponsor</div>
              </div>
            </div>

            {/* Big Visual KPI Counters (100% Mobile Safe Grid, No Overflow) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.45rem', marginBottom: '1.15rem', width: '100%', boxSizing: 'border-box' }}>
              <div style={{ minWidth: 0, overflow: 'hidden', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: '8px', padding: '0.65rem 0.35rem', textAlign: 'center', boxSizing: 'border-box' }}>
                <div style={{ fontSize: '0.62rem', fontWeight: '800', color: '#1E40AF', textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Impressions
                </div>
                <div style={{ fontSize: 'clamp(1.1rem, 3.8vw, 1.45rem)', fontWeight: '900', color: '#1D4ED8', margin: '0.15rem 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {(proofCampaign.impressions || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: '0.62rem', color: 'var(--text-subtle)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Verified Views
                </div>
              </div>

              <div style={{ minWidth: 0, overflow: 'hidden', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '8px', padding: '0.65rem 0.35rem', textAlign: 'center', boxSizing: 'border-box' }}>
                <div style={{ fontSize: '0.62rem', fontWeight: '800', color: '#065F46', textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Direct Clicks
                </div>
                <div style={{ fontSize: 'clamp(1.1rem, 3.8vw, 1.45rem)', fontWeight: '900', color: '#047857', margin: '0.15rem 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {(proofCampaign.clicks || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: '0.62rem', color: 'var(--text-subtle)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Engaged Leads
                </div>
              </div>

              <div style={{ minWidth: 0, overflow: 'hidden', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '8px', padding: '0.65rem 0.35rem', textAlign: 'center', boxSizing: 'border-box' }}>
                <div style={{ fontSize: '0.62rem', fontWeight: '800', color: '#991B1B', textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Click Rate
                </div>
                <div style={{ fontSize: 'clamp(1.1rem, 3.8vw, 1.45rem)', fontWeight: '900', color: 'var(--accent-crimson)', margin: '0.15rem 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {((proofCampaign.clicks || 0) / Math.max(1, (proofCampaign.impressions || 0)) * 100).toFixed(1)}%
                </div>
                <div style={{ fontSize: '0.62rem', color: 'var(--text-subtle)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  CTR Rate
                </div>
              </div>
            </div>

            {/* Campaign Schedule & Scope Details */}
            <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '0.75rem 0.85rem', fontSize: '0.76rem', marginBottom: '1.15rem', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--text-subtle)', flexShrink: 0 }}>Schedule:</span>
                <span style={{ fontWeight: '700', textAlign: 'right', wordBreak: 'break-word' }}>
                  {formatDisplayDateTime(proofCampaign.startDateTime) || 'Immediate'} to {formatDisplayDateTime(proofCampaign.endDateTime) || 'Manual Stop'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--text-subtle)', flexShrink: 0 }}>Target Scope:</span>
                <span style={{ fontWeight: '700', textAlign: 'right' }}>
                  {proofCampaign.scope === 'global' ? 'Global (All Pages)' : proofCampaign.scope === 'category' ? `Category: ${proofCampaign.targetCategory}` : `Article: #${proofCampaign.targetArticleId}`}
                </span>
              </div>
              {proofCampaign.sponsorTargetUrl && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: 'var(--text-subtle)', flexShrink: 0 }}>Target / WhatsApp:</span>
                  <span style={{ fontWeight: '700', color: 'var(--accent-blue)', textAlign: 'right', wordBreak: 'break-all' }}>
                    {proofCampaign.sponsorTargetUrl}
                  </span>
                </div>
              )}
            </div>

            {/* Action Bar: WhatsApp Copy & Direct Share */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => handleCopyProof(proofCampaign)}
                className="btn btn-primary"
                style={{
                  flex: '1 1 180px',
                  padding: '0.65rem',
                  fontSize: '0.82rem',
                  fontWeight: '800',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem'
                }}
              >
                {copiedProof ? <Check size={16} /> : <Copy size={16} />}
                {copiedProof ? 'Copied to Clipboard!' : 'Copy WhatsApp Client Proof'}
              </button>

              {getWhatsAppDirectLink(proofCampaign) && (
                <a
                  href={getWhatsAppDirectLink(proofCampaign)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn"
                  style={{
                    flex: '1 1 140px',
                    padding: '0.65rem 0.85rem',
                    fontSize: '0.82rem',
                    fontWeight: '800',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.45rem',
                    background: '#10B981',
                    color: '#ffffff',
                    textDecoration: 'none',
                    borderRadius: 'var(--radius-sm)'
                  }}
                >
                  <Share2 size={16} /> WhatsApp Sponsor
                </a>
              )}

              <button
                type="button"
                onClick={() => setProofCampaign(null)}
                className="btn btn-outline"
                style={{ flex: '0 0 auto', padding: '0.65rem 1rem', fontSize: '0.82rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
