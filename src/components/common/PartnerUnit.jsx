import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle } from 'lucide-react';
import { getActiveAdsServer, subscribeToAdChanges, trackAdImpression, trackAdClick, getSlotDimensionGuard } from '../../services/monetizationService';

/**
 * PublicSpark Newsroom — Responsive High-End Partner & Ad Unit Component
 * Pure Display Component: Backend evaluates and commands WHAT, WHERE, and WHEN to show!
 * Supports Google AdSense & Direct Sponsor Banners with Zero-CLS Stability & Safe Fallbacks
 */
export default function PartnerUnit({ position = 'in_article', className = '', customStyle = {}, category = '', articleId = '' }) {
  const [activeDecision, setActiveDecision] = useState(null);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [isUnfilled, setIsUnfilled] = useState(false);
  const [fadeOpacity, setFadeOpacity] = useState(1);
  const adRef = useRef(null);
  const pushedRef = useRef(false);
  const unitRef = useRef(null);
  const trackedImpressionRef = useRef(null);

  // Screen size detection for responsive unit dimensions
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Backend Decision Sync: Backend server decides what ad to show based on clock & admin schedule
  useEffect(() => {
    let isCurrent = true;
    const loadDecision = async () => {
      const data = await getActiveAdsServer({ category, articleId });
      if (isCurrent && data?.slots?.[position]) {
        setActiveDecision(data.slots[position]);
      }
    };
    loadDecision();

    // Re-evaluate whenever admin updates settings or switches campaigns
    const unsubscribe = subscribeToAdChanges(() => {
      loadDecision();
    });

    return () => {
      isCurrent = false;
      unsubscribe();
    };
  }, [position, category, articleId]);

  // Real-Time Precision Sleep Timer & Zero-Reload Auto-Switch
  // Automatically transitions ad unit at the exact millisecond a campaign starts or expires
  useEffect(() => {
    if (!activeDecision) return;

    let timerId = null;
    let fadeTimerId = null;

    const scheduleTransition = (targetTimeStr) => {
      if (!targetTimeStr) return;
      const targetMs = new Date(targetTimeStr).getTime();
      if (isNaN(targetMs)) return;
      const delayMs = targetMs - Date.now();

      // Only schedule if within next 24 hours
      if (delayMs > 0 && delayMs <= 86400000) {
        timerId = setTimeout(() => {
          // 1. Zero-CLS Fade-Out (300ms)
          setFadeOpacity(0);
          fadeTimerId = setTimeout(async () => {
            // 2. Fetch freshly evaluated decision from server
            const fresh = await getActiveAdsServer({ category, articleId });
            if (fresh?.slots?.[position]) {
              setActiveDecision(fresh.slots[position]);
            }
            // 3. Smooth Fade-In (300ms)
            setFadeOpacity(1);
          }, 300);
        }, delayMs);
      }
    };

    if (activeDecision.expiresAt) {
      scheduleTransition(activeDecision.expiresAt);
    }
    if (activeDecision.startsAt || activeDecision.nextStartsAt) {
      scheduleTransition(activeDecision.startsAt || activeDecision.nextStartsAt);
    }

    return () => {
      if (timerId) clearTimeout(timerId);
      if (fadeTimerId) clearTimeout(fadeTimerId);
    };
  }, [activeDecision, position, category, articleId]);

  // Tab Wakeup & Background Sleep Synchronization
  // Re-evaluates ad immediately when a reader returns to the tab or unlocks their phone
  useEffect(() => {
    const handleWakeup = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        const nowMs = Date.now();
        const hasExpired = activeDecision?.expiresAt && nowMs >= new Date(activeDecision.expiresAt).getTime();
        const hasStarted = (activeDecision?.startsAt || activeDecision?.nextStartsAt) && nowMs >= new Date(activeDecision.startsAt || activeDecision.nextStartsAt).getTime();

        if (hasExpired || hasStarted) {
          setFadeOpacity(0);
          const fresh = await getActiveAdsServer({ category, articleId });
          if (fresh?.slots?.[position]) {
            setActiveDecision(fresh.slots[position]);
          }
          setFadeOpacity(1);
        }
      }
    };

    document.addEventListener('visibilitychange', handleWakeup);
    window.addEventListener('focus', handleWakeup);
    return () => {
      document.removeEventListener('visibilitychange', handleWakeup);
      window.removeEventListener('focus', handleWakeup);
    };
  }, [activeDecision, position, category, articleId]);

  const isLocalNetwork = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.startsWith('10.') ||
    window.location.hostname.startsWith('192.168.') ||
    window.location.hostname.startsWith('172.') ||
    window.location.hostname.endsWith('.local')
  );

  const isRealAdSense = !isLocalNetwork && 
    activeDecision?.action === 'adsense' && 
    Boolean(activeDecision?.publisherId) && 
    Boolean(activeDecision?.adSlotId);

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

  // Direct Sponsor Viewport Impression Tracker
  // Fires verified impression when at least 50% of the unit remains visible in viewport for >500ms
  useEffect(() => {
    if (!activeDecision || activeDecision.action !== 'sponsor' || !activeDecision.campaignId) return;
    const campaignId = activeDecision.campaignId;
    if (trackedImpressionRef.current === campaignId) return;

    const el = unitRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    let visibilityTimer = null;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          if (!visibilityTimer && trackedImpressionRef.current !== campaignId) {
            visibilityTimer = setTimeout(() => {
              if (trackedImpressionRef.current !== campaignId) {
                trackedImpressionRef.current = campaignId;
                trackAdImpression(campaignId, position);
              }
            }, 500);
          }
        } else {
          if (visibilityTimer) {
            clearTimeout(visibilityTimer);
            visibilityTimer = null;
          }
        }
      },
      { threshold: [0.5] }
    );

    observer.observe(el);

    return () => {
      if (visibilityTimer) clearTimeout(visibilityTimer);
      observer.disconnect();
    };
  }, [activeDecision, position]);

  const handleSponsorClick = () => {
    if (activeDecision?.campaignId) {
      trackAdClick(activeDecision.campaignId, position);
    }
  };

  // 1. If backend decided 'none' or not loaded yet: zero DOM footprint
  if (!activeDecision || activeDecision.action === 'none') {
    return null;
  }

  // 2. Hide mobile footer on large desktop screens
  if (position === 'mobile_footer' && !isMobile) {
    return null;
  }

  // 3. If Google AdSense reported unfilled inventory, collapse to zero DOM
  if (isUnfilled) {
    return null;
  }

  // 4. If neither real sponsor banner nor live AdSense is available, do not render empty placeholder box
  if (!isRealAdSense && !(activeDecision.action === 'sponsor' && activeDecision.bannerUrl)) {
    return null;
  }

  // Poster Aspect Ratio & Dimension Guard (Task 16.6)
  // Enforces strict vertical bounds and clean letterboxing to prevent layout deformation
  const slotGuard = getSlotDimensionGuard(position, isMobile);

  // Compute responsive dimensions based on position
  const getContainerStyles = () => {
    const base = {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      margin: position === 'in_article' ? '1.75rem auto' : position === 'header' ? '1rem auto' : '1.25rem auto',
      width: '100%',
      opacity: fadeOpacity,
      transition: 'opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      maxWidth: (position === 'header' || position === 'footer') 
        ? (isMobile ? '320px' : '728px') 
        : position === 'sidebar' 
          ? '300px' 
          : position === 'mobile_footer' 
            ? '320px' 
            : position === 'home_feed'
              ? (isMobile ? '320px' : '728px')
              : '100%',
      boxSizing: 'border-box',
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
        padding: '0.35rem 0.75rem',
        maxHeight: '60px'
      };
    }

    return base;
  };

  const isSponsor = activeDecision.action === 'sponsor' || (activeDecision.type === 'sponsor' && activeDecision.action !== 'adsense');

  return (
    <aside 
      ref={unitRef}
      className={`publicspark-partner-unit partner-unit-${position} ${className}`}
      style={getContainerStyles()}
      aria-label="Advertisement"
    >
      {/* Regulatory Disclosure Label */}
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
          {isSponsor ? 'Sponsored' : 'Advertisement'}
        </span>
      </div>

      {/* RENDER CASE A: Direct Sponsor Banner (Ordered & Decided by Backend) */}
      {activeDecision.action === 'sponsor' ? (
        activeDecision.bannerUrl ? (
          <a
            href={activeDecision.targetUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleSponsorClick}
            title={activeDecision.isWhatsApp 
              ? `Chat directly with ${activeDecision.sponsorName || 'sponsor'} on WhatsApp`
              : `Advertisement from ${activeDecision.sponsorName || 'sponsor'}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              width: '100%',
              maxWidth: '100%',
              maxHeight: slotGuard.maxHeight,
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
              border: '1px solid var(--border-light)',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              boxSizing: 'border-box'
            }}
          >
            <img
              src={activeDecision.bannerUrl}
              alt={activeDecision.sponsorName ? `Advertisement by ${activeDecision.sponsorName}` : 'Sponsored advertisement'}
              loading="lazy"
              style={{
                display: 'block',
                maxWidth: '100%',
                maxHeight: slotGuard.maxHeight,
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                margin: '0 auto'
              }}
            />
            {activeDecision.isWhatsApp && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '6px',
                  right: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.22rem 0.52rem',
                  background: 'rgba(4, 120, 87, 0.94)',
                  color: '#ffffff',
                  fontSize: '0.66rem',
                  fontWeight: '700',
                  borderRadius: '16px',
                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)',
                  letterSpacing: '0.01em',
                  pointerEvents: 'none',
                  border: '1px solid rgba(255, 255, 255, 0.35)'
                }}
              >
                <MessageCircle size={11} strokeWidth={2.5} />
                <span>WhatsApp Connect</span>
              </div>
            )}
          </a>
        ) : null
      ) : isRealAdSense ? (
        /* RENDER CASE B: Real Google AdSense Tag (Production Environment) */
        <div style={{ width: '100%', minHeight: (position === 'header' || position === 'footer') ? '90px' : '250px', textAlign: 'center' }}>
          <ins
            ref={adRef}
            className="adsbygoogle"
            style={{ display: 'block', textAlign: 'center' }}
            data-ad-client={activeDecision.publisherId}
            data-ad-slot={activeDecision.adSlotId}
            data-ad-format={position === 'header' ? 'horizontal' : 'auto'}
            data-full-width-responsive="true"
          />
        </div>
      ) : null}
    </aside>
  );
}

