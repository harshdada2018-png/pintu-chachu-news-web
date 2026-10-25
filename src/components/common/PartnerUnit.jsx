import React, { useState, useEffect, useRef } from 'react';
import { getAdSettings, subscribeToAdChanges } from '../../services/monetizationService';

/**
 * PublicSpark Newsroom — Responsive High-End Partner & Ad Unit Component
 * Supports Google AdSense & Direct Sponsor Banners with Zero-CLS Stability & Safe Fallbacks
 * Uses neutral identifiers to prevent aggressive browser extension blocking
 */
export default function PartnerUnit({ position = 'in_article', className = '', customStyle = {} }) {
  const [adConfig, setAdConfig] = useState(() => getAdSettings());
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const adRef = useRef(null);
  const pushedRef = useRef(false);

  // Subscribe to live settings updates from Admin panel
  useEffect(() => {
    const unsubscribe = subscribeToAdChanges((newSettings) => {
      setAdConfig(newSettings);
    });
    return unsubscribe;
  }, []);

  // Screen size detection for responsive unit rendering
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [isUnfilled, setIsUnfilled] = useState(false);
  const slot = adConfig?.slots?.[position];

  // 1. If slot is disabled or missing: zero DOM, zero layout footprint
  if (!slot || !slot.enabled) {
    return null;
  }

  // Hide mobile footer on large desktop screens to maintain broadsheet aesthetics
  if (position === 'mobile_footer' && !isMobile) {
    return null;
  }

  const publisherId = adConfig?.adSensePublisherId?.trim();
  const slotId = slot?.adSlotId?.trim();
  const isLocalhost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const isRealAdSense = !isLocalhost && publisherId && slotId && slot.type === 'adsense';

  // 2. On live production: If no real ad is configured (missing AdSense IDs or missing Sponsor banner), auto-remove completely
  if (!isLocalhost) {
    if (slot.type === 'adsense' && (!publisherId || !slotId)) {
      return null;
    }
    if (slot.type === 'sponsor' && !slot.sponsorBannerUrl) {
      return null;
    }
  }

  // 3. If Google AdSense reported unfilled inventory, collapse to zero DOM (no blank box)
  if (isUnfilled) {
    return null;
  }

  // Listen for Google AdSense unfilled status mutation to auto-collapse instantly
  useEffect(() => {
    if (!adRef.current || !isRealAdSense) return;
    const observer = new MutationObserver(() => {
      const status = adRef.current?.getAttribute('data-ad-status');
      if (status === 'unfilled') {
        setIsUnfilled(true);
      }
    });
    observer.observe(adRef.current, { attributes: true, attributeFilter: ['data-ad-status'] });
    return () => observer.disconnect();
  }, [isRealAdSense]);

  // Trigger Google AdSense script push safely in live production
  useEffect(() => {
    if (isRealAdSense && adRef.current && !pushedRef.current) {
      try {
        if (typeof window !== 'undefined') {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
          pushedRef.current = true;
        }
      } catch (err) {
        console.warn(`[PartnerUnit] AdSense push safe catch for (${position}):`, err);
      }
    }
  }, [isRealAdSense, position]);

  // Compute responsive dimensions based on position
  const getContainerStyles = () => {
    const base = {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      margin: position === 'in_article' ? '1.75rem auto' : position === 'header' ? '1rem auto' : '1.25rem auto',
      width: '100%',
      maxWidth: position === 'header' 
        ? (isMobile ? '320px' : '728px') 
        : position === 'sidebar' 
          ? '300px' 
          : position === 'mobile_footer' 
            ? '320px' 
            : '100%',
      ...customStyle
    };

    if (position === 'mobile_footer') {
      return {
        ...base,
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        margin: 0,
        background: 'var(--bg-surface)',
        boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.08)',
        borderTop: '1px solid var(--border-light)',
        padding: '0.35rem 0.75rem'
      };
    }

    return base;
  };

  return (
    <aside 
      className={`publicspark-partner-unit partner-unit-${position} ${className}`}
      style={getContainerStyles()}
      aria-label="Advertisement"
    >
      {/* Policy-Mandatory Regulatory Disclosure Label */}
      <div 
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '0.4rem',
          marginBottom: '0.35rem'
        }}
      >
        <span 
          style={{
            fontSize: '0.62rem',
            fontWeight: '700',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text-subtle)',
            fontFamily: 'var(--font-sans)',
            opacity: 0.85
          }}
        >
          {slot.type === 'sponsor' ? 'Sponsored' : 'Advertisement'}
        </span>
      </div>

      {/* RENDER CASE A: Direct Local Sponsor Banner */}
      {slot.type === 'sponsor' ? (
        slot.sponsorBannerUrl ? (
          <a
            href={slot.sponsorTargetUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            title={`Advertisement from ${slot.sponsorName || 'sponsor'}`}
            style={{
              display: 'block',
              maxWidth: '100%',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
              border: '1px solid var(--border-light)',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease'
            }}
          >
            <img
              src={slot.sponsorBannerUrl}
              alt={slot.sponsorName ? `Advertisement by ${slot.sponsorName}` : 'Sponsored advertisement'}
              loading="lazy"
              style={{
                display: 'block',
                width: '100%',
                height: 'auto',
                objectFit: 'contain'
              }}
            />
          </a>
        ) : (
          /* Sponsor Placeholder if image not uploaded yet */
          <div
            style={{
              width: '100%',
              minHeight: position === 'header' ? (isMobile ? '50px' : '90px') : '140px',
              background: 'var(--bg-secondary)',
              border: '1px dashed var(--border-medium)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
              textAlign: 'center',
              color: 'var(--text-subtle)'
            }}
          >
            <span style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '0.2rem' }}>
              Direct Sponsor Banner Space
            </span>
            <span style={{ fontSize: '0.72rem' }}>
              Upload sponsor poster in Admin Desk &gt; Monetization ({isMobile ? slot.mobileDimensions : slot.desktopDimensions})
            </span>
          </div>
        )
      ) : isRealAdSense ? (
        /* RENDER CASE B: Real Google AdSense Tag (Production Environment) */
        <div style={{ width: '100%', minHeight: position === 'header' ? '90px' : '250px', textAlign: 'center' }}>
          <ins
            ref={adRef}
            className="adsbygoogle"
            style={{ display: 'block', textAlign: 'center' }}
            data-ad-client={publisherId}
            data-ad-slot={slotId}
            data-ad-format={position === 'header' ? 'horizontal' : 'auto'}
            data-full-width-responsive="true"
          />
        </div>
      ) : (
        /* RENDER CASE C: Editorial Broadsheet Preview Mode (Localhost / Awaiting AdSense Slot ID) */
        <div
          style={{
            width: '100%',
            minHeight: position === 'header' 
              ? (isMobile ? '50px' : '84px') 
              : position === 'sidebar' 
                ? '240px' 
                : '110px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.75rem 1rem',
            textAlign: 'center',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
            <span 
              style={{
                fontSize: '0.74rem',
                fontWeight: '800',
                color: 'var(--text-main)',
                fontFamily: 'var(--font-sans)',
                letterSpacing: '0.02em'
              }}
            >
              {slot.name}
            </span>
            <span 
              style={{
                fontSize: '0.65rem',
                padding: '0.1rem 0.4rem',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                borderRadius: '4px',
                color: 'var(--text-subtle)',
                fontFamily: 'var(--font-mono)'
              }}
            >
              {isMobile ? slot.mobileDimensions : slot.desktopDimensions}
            </span>
          </div>
          <span 
            style={{ 
              fontSize: '0.7rem', 
              color: 'var(--text-subtle)',
              fontFamily: 'var(--font-sans)'
            }}
          >
            Google AdSense Unit Active • Ready for Live Deployment
          </span>
        </div>
      )}
    </aside>
  );
}
