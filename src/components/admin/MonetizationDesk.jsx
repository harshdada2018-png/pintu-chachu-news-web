import React, { useState, useEffect } from 'react';
import { 
  DollarSign, Check, Save, Sparkles, AlertCircle, ExternalLink, 
  ToggleLeft, ToggleRight, Layout, Smartphone, Monitor, Image as ImageIcon, 
  Link as LinkIcon, RefreshCw, ShieldCheck, HelpCircle
} from 'lucide-react';
import { getAdSettings, syncAdSettingsServer, fetchAdSettings } from '../../services/monetizationService';
import { compressImageToWebP } from '../../services/mediaService';

/**
 * PublicSpark Newsroom — Professional Zero-Code Monetization Desk Suite
 * Enables visual control over Google AdSense & Direct Sponsor Placements
 * Uses neutral identifiers to avoid client-side browser extension blocking
 */
export default function MonetizationDesk({ onShowToast }) {
  const [adConfig, setAdConfig] = useState(() => getAdSettings());
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isUploading, setIsUploading] = useState({});
  const [uploadStats, setUploadStats] = useState({});

  // Sync settings from backend server on mount
  useEffect(() => {
    fetchAdSettings().then(serverConfig => {
      if (serverConfig) {
        setAdConfig(serverConfig);
      }
    });
  }, []);

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
      if (onShowToast) onShowToast('Monetization settings & placements saved and synced across site!');
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      console.error('[MonetizationDesk] Save error:', err);
      alert('Failed to save settings: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const pubId = adConfig.adSensePublisherId?.trim() || '';
  const isPubIdValid = /^(ca-)?pub-[0-9]{16}$/.test(pubId);

  const slotKeys = ['header', 'in_article', 'sidebar', 'mobile_footer'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Top Action Header Bar */}
      <div 
        style={{ 
          background: 'var(--bg-surface)', 
          padding: '1.25rem 1.5rem', 
          borderRadius: 'var(--radius-md)', 
          border: '1px solid var(--border-light)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0 }}>
            <DollarSign color="var(--accent-crimson)" size={22} />
            News Monetization & Partner Unit Suite
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-subtle)', margin: '0.25rem 0 0 0' }}>
            Zero-code visual control over Google AdSense units, local sponsor banners, and placement toggles.
          </p>
        </div>

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

      {/* Section 1: Google AdSense Global Credentials */}
      <div 
        style={{ 
          background: 'var(--bg-surface)', 
          padding: '1.5rem', 
          borderRadius: 'var(--radius-md)', 
          border: '1px solid var(--border-light)' 
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <ShieldCheck size={18} color="var(--accent-blue)" />
          <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0 }}>Google AdSense Credentials & Verification</h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
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
                style={{
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${slot.enabled ? 'var(--border-medium)' : 'var(--border-light)'}`,
                  opacity: slot.enabled ? 1 : 0.7,
                  transition: 'opacity 0.2s ease, border-color 0.2s ease',
                  overflow: 'hidden'
                }}
              >
                {/* Slot Card Header */}
                <div
                  style={{
                    padding: '1rem 1.25rem',
                    background: slot.enabled ? 'var(--bg-secondary)' : 'transparent',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid var(--border-light)',
                    flexWrap: 'wrap',
                    gap: '0.75rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
                        fontWeight: '800'
                      }}
                    >
                      {key === 'header' ? <Monitor size={16} /> : key === 'mobile_footer' ? <Smartphone size={16} /> : <Layout size={16} />}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                            color: 'var(--text-subtle)'
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
                  <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Mode Selector: Google AdSense vs Direct Sponsor */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                        Monetization Source:
                      </label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
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
                            fontSize: '0.82rem'
                          }}
                        />
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', marginTop: '0.25rem', display: 'block' }}>
                          If blank or running on localhost, PublicSpark automatically displays a subtle broadsheet placeholder box without throwing any errors.
                        </span>
                      </div>
                    )}

                    {/* SUB-SECTION B: Direct Sponsor Controls */}
                    {slot.type === 'sponsor' && (
                      <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
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
                                fontSize: '0.8rem'
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
                              placeholder="https://wa.me/919876543210 or https://example.com"
                              value={slot.sponsorTargetUrl || ''}
                              onChange={(e) => handleUpdateSlotField(key, 'sponsorTargetUrl', e.target.value)}
                              style={{
                                width: '100%',
                                padding: '0.45rem 0.65rem',
                                borderRadius: '4px',
                                border: '1px solid var(--border-medium)',
                                background: 'var(--bg-surface)',
                                fontSize: '0.8rem'
                              }}
                            />
                          </div>
                        </div>

                        {/* Banner Image Upload & Preview */}
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.25rem' }}>
                            Upload Sponsor Poster / Banner Image:
                          </label>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleUploadSponsorBanner(key, e)}
                              disabled={isUploading[key]}
                              style={{ fontSize: '0.78rem' }}
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
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)' }}>
                                Current Live Banner Preview:
                              </span>
                              {uploadStats[key] && (
                                <span style={{ fontSize: '0.72rem', color: '#047857', background: '#ECFDF5', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid #A7F3D0', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <Check size={12} /> {uploadStats[key].compressedKB} KB WebP ({uploadStats[key].savedPercent}% compressed from {uploadStats[key].originalKB} KB)
                                </span>
                              )}
                            </div>
                            <div style={{ maxWidth: '320px', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-medium)' }}>
                              <img src={slot.sponsorBannerUrl} alt="Sponsor preview" style={{ width: '100%', display: 'block' }} />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
