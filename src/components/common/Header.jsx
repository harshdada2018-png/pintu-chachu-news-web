import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Sun, Moon, Search, UserCheck, Flame, Newspaper, 
  ShieldCheck, PenTool, CheckCircle, Settings, Languages, Bookmark, Menu, X, Play, Pause, Calendar, ChevronRight, Lock, LogOut
} from 'lucide-react';
import { DEFAULT_NEWSROOM_CATEGORIES } from '../../services/taxonomyService';
import { SUPPORTED_LANGUAGES } from '../../services/translationService';
import { t, translateCategoryName } from '../../services/uiTranslations';

export default function Header({ 
  currentRole, 
  onRoleChange, 
  theme, 
  onToggleTheme, 
  activeCategory, 
  onSelectCategory,
  activeView,
  onNavigate,
  currentLanguage,
  onLanguageChange,
  isTranslating,
  categories = DEFAULT_NEWSROOM_CATEGORIES,
  articles = [],
  onOpenSavedDrawer,
  onOpenStaffLogin,
  onStaffLogout,
  staffName = '',
  onOpenSearchDrawer,
  onSelectArticle
}) {
  const breakingItems = useMemo(() => {
    const fromArticles = (articles || []).filter(a => a.is_breaking);
    if (fromArticles.length > 0) return fromArticles;
    // Fallback to top published headlines (Rule 6 compliant - real stories only)
    return (articles || []).filter(a => a.status === 'published').slice(0, 3);
  }, [articles]);

  // Public category filter: Only display categories with >= 1 published article (prevents AdSense empty category rejection)
  const populatedCategories = useMemo(() => {
    const rawCategories = categories && categories.length > 0 ? categories : DEFAULT_NEWSROOM_CATEGORIES;
    return rawCategories.filter(cat => {
      return (articles || []).some(art => 
        art.status === 'published' && 
        (art.category_slug === cat.slug || art.category?.toLowerCase() === cat.name?.toLowerCase())
      );
    });
  }, [categories, articles]);

  const [tickerIndex, setTickerIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const [isTickerPlaying, setIsTickerPlaying] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSticky, setIsSticky] = useState(false);

  // GPU-friendly rAF sticky header detection with hysteresis (zero layout bounce/jitter)
  useEffect(() => {
    let rafId = null;
    const syncSticky = () => {
      rafId = null;
      const y = window.scrollY;
      setIsSticky((prev) => {
        if (!prev && y >= 145) return true;
        if (prev && y <= 90) return false;
        return prev;
      });
    };
    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(syncSticky);
    };
    syncSticky();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, []);

  // Lock background scroll & close full-screen All Categories drawer on Escape key
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileMenuOpen]);

  const handleNextTicker = useCallback(() => {
    if (breakingItems.length === 0) return;
    setIsFading(true);
    setTimeout(() => {
      setTickerIndex((prev) => (prev + 1) % breakingItems.length);
      setIsFading(false);
    }, 350);
  }, [breakingItems.length]);

  const activeTickerArticle = breakingItems.length > 0
    ? breakingItems[tickerIndex % breakingItems.length]
    : null;

  useEffect(() => {
    if (!isTickerPlaying) return;
    const timer = setInterval(() => {
      handleNextTicker();
    }, 4000);

    return () => clearInterval(timer);
  }, [handleNextTicker, isTickerPlaying]);

  const dateLocaleMap = {
    hi: 'hi-IN',
    en: 'en-IN',
    bn: 'bn-IN',
    mr: 'mr-IN',
    te: 'te-IN',
    ta: 'ta-IN',
    gu: 'gu-IN',
    kn: 'kn-IN',
    ml: 'ml-IN',
    pa: 'pa-IN',
    or: 'or-IN',
    as: 'as-IN',
    ur: 'ur-IN'
  };
  const activeDateLocale = dateLocaleMap[currentLanguage] || (currentLanguage ? `${currentLanguage}-IN` : 'hi-IN');
  const currentDate = new Date().toLocaleDateString(activeDateLocale, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  return (
    <header style={{ width: '100%' }}>
      {/* Sovereign Compact Mobile App Bar (<= 768px Only) */}
      {/* Sovereign Compact Mobile App Bar (<= 768px Only - Fixed at top: 0, 0 overlap) */}
      <div className="mobile-app-header-wrapper show-on-mobile">
        <div className="mobile-app-header">
          {/* Left: Menu & Brand Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
            <button
              className="mobile-hamburger-btn"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open Newsroom Navigation Drawer"
            >
              <Menu size={20} />
            </button>
            <a 
              href="#" 
              onClick={(e) => { e.preventDefault(); onNavigate('home'); }} 
              style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0 }}
              title="PublicSpark Home"
            >
              <img 
                src="/logo.png" 
                alt="PUBLIC SPARK" 
                style={{ 
                  height: '28px', 
                  maxWidth: '85px',
                  width: 'auto', 
                  objectFit: 'contain',
                  mixBlendMode: theme === 'dark' ? 'normal' : 'multiply',
                  background: theme === 'dark' ? '#FFFFFF' : 'transparent',
                  padding: theme === 'dark' ? '2px 6px' : '0',
                  borderRadius: theme === 'dark' ? 'var(--radius-sm)' : '0'
                }} 
              />
            </a>
          </div>

          {/* Right: Language Pill, Search & Dark/Light Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            {/* Quick Mobile Language Select */}
            <div className="mobile-lang-pill">
              <Languages size={13} color="var(--accent-crimson)" style={{ flexShrink: 0 }} />
              <select 
                value={currentLanguage} 
                onChange={(e) => onLanguageChange(e.target.value)}
                className="mobile-lang-select"
                aria-label="Select Language"
              >
                <optgroup label="Regional">
                  {SUPPORTED_LANGUAGES.filter(l => !['fr', 'it', 'ja', 'id', 'zh-TW', 'ru', 'en'].includes(l.code)).map((lang) => (
                    <option key={lang.code} value={lang.code}>{lang.native}</option>
                  ))}
                  <option value="en">English</option>
                </optgroup>
                <optgroup label="Global">
                  {SUPPORTED_LANGUAGES.filter(l => ['fr', 'it', 'ja', 'id', 'zh-TW', 'ru'].includes(l.code)).map((lang) => (
                    <option key={lang.code} value={lang.code}>{lang.native}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Quick Search */}
            <button 
              onClick={() => onOpenSearchDrawer ? onOpenSearchDrawer() : onNavigate('search')} 
              className="mobile-action-icon"
              title={t('search', currentLanguage)}
              aria-label="Search"
            >
              <Search size={15} />
            </button>

            {/* Quick Saved Stories Drawer Trigger */}
            <button 
              onClick={() => onOpenSavedDrawer ? onOpenSavedDrawer() : onSelectCategory('bookmarks')} 
              className="mobile-action-icon"
              title={t('savedBookmarks', currentLanguage)}
              aria-label="Open Saved Stories"
              style={{ color: 'var(--accent-crimson)' }}
            >
              <Bookmark size={15} fill="var(--accent-crimson)" color="var(--accent-crimson)" />
            </button>

            {/* Dark / Light Toggle */}
            <button 
              onClick={onToggleTheme} 
              className="mobile-action-icon"
              title="Toggle Dark/Light Mode"
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? <Sun size={15} color="var(--accent-crimson)" /> : <Moon size={15} />}
            </button>
          </div>
        </div>
      </div>

      {/* Top Utility Masthead (Desktop Only) */}
      <div className="masthead-top hide-on-mobile">
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.8rem' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <Calendar size={13} color="var(--text-subtle)" /> {currentDate}
            </span>
            <span className="hide-on-mobile" style={{ color: 'var(--accent-emerald)', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <ShieldCheck size={14} /> {t('factChecked', currentLanguage)}
            </span>
          </div>

          {/* Right Side Corner Controls: Language Selector, Staff Newsroom Portal & Theme Switcher */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            
            {/* Multi-Language Selector Section (Clean Editorial Dropdown) */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.35rem', 
              background: 'var(--bg-surface)', 
              color: 'var(--text-main)', 
              padding: '0.25rem 0.55rem', 
              borderRadius: 'var(--radius-sm)', 
              fontSize: '0.75rem',
              border: '1px solid var(--border-medium)',
              fontWeight: '600'
            }}>
              <Languages size={13} color="var(--text-subtle)" />
              <select 
                id="lang-select"
                value={currentLanguage} 
                onChange={(e) => onLanguageChange(e.target.value)}
                disabled={isTranslating}
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  fontWeight: '700', 
                  color: 'var(--text-main)', 
                  cursor: 'pointer',
                  outline: 'none',
                  fontSize: '0.75rem'
                }}
              >
                <optgroup label="Indian Regional Languages">
                  {SUPPORTED_LANGUAGES.filter(l => !['fr', 'it', 'ja', 'id', 'zh-TW', 'ru', 'en'].includes(l.code)).map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.native} ({lang.name})
                    </option>
                  ))}
                  <option value="en">English (EN)</option>
                </optgroup>
                <optgroup label="Global Languages">
                  {SUPPORTED_LANGUAGES.filter(l => ['fr', 'it', 'ja', 'id', 'zh-TW', 'ru'].includes(l.code)).map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.native} ({lang.name})
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Discrete Broadsheet Active Session Badge (Desktop: Only shown when logged in, keeping visitor masthead 100% clean) */}
            {currentRole === 'visitor' ? null : (
              <div
                className="hide-on-mobile"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: 'rgba(185, 28, 28, 0.08)',
                  padding: '0.25rem 0.6rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                  border: '1px solid rgba(185, 28, 28, 0.25)'
                }}
              >
                <button
                  type="button"
                  onClick={() => onNavigate(currentRole === 'developer' ? 'developer' : currentRole)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.1rem 0.25rem',
                    borderRadius: '4px',
                    font: 'inherit'
                  }}
                  title={`Open ${currentRole.toUpperCase()} Newsroom Workspace Desk`}
                >
                  <ShieldCheck size={13} color="var(--accent-crimson)" />
                  <span style={{ fontWeight: '800', color: 'var(--accent-crimson)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {currentRole}
                  </span>
                  {staffName && (
                    <span style={{ color: 'var(--text-subtle)', fontSize: '0.72rem' }}>
                      ({staffName})
                    </span>
                  )}
                  <span style={{ fontSize: '0.7rem', color: 'var(--accent-crimson)', fontWeight: '800', marginLeft: '2px' }}>
                    Desk ↗
                  </span>
                </button>

                <div style={{ width: '1px', height: '14px', backgroundColor: 'var(--border-medium)', opacity: 0.5 }} />

                <button
                  onClick={onStaffLogout}
                  style={{
                    background: 'none',
                    border: 'none',
                    minWidth: '32px',
                    minHeight: '32px',
                    padding: '0.35rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'var(--text-subtle)',
                    borderRadius: '4px'
                  }}
                  title="Sign Out of Newsroom"
                >
                  <LogOut size={14} />
                </button>
              </div>
            )}

            {/* Theme Toggle */}
            <button 
              onClick={onToggleTheme} 
              className="btn btn-outline" 
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', minHeight: '32px', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              title="Toggle Dark/Light Mode"
            >
              {theme === 'dark' ? <Sun size={14} color="var(--accent-crimson)" /> : <Moon size={14} color="var(--text-main)" />}
              <span className="hide-on-mobile">{theme === 'dark' ? t('lightMode', currentLanguage) : t('darkMode', currentLanguage)}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Classic Newspaper Main Masthead (100% Static Flow Height — Zero Scroll Reflow/Jitter) */}
      <div className="masthead-main-wrapper hide-on-mobile">
        <div className="masthead-main">
          <div
            className="container"
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {/* Centered Masthead Logo */}
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); onNavigate('home'); }}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
              title="PublicSpark Home"
            >
              <img
                src="/logo.png"
                alt="PUBLIC SPARK News Logo"
                style={{
                  height: '75px',
                  width: 'auto',
                  maxWidth: '90vw',
                  objectFit: 'contain',
                  mixBlendMode: theme === 'dark' ? 'normal' : 'multiply',
                  background: theme === 'dark' ? '#FFFFFF' : 'transparent',
                  padding: theme === 'dark' ? '4px 14px' : '0',
                  borderRadius: theme === 'dark' ? 'var(--radius-sm)' : '0'
                }}
              />
            </a>

            {/* Tagline (Fixed flow height — never collapses during scroll) */}
            <div
              className="masthead-tagline"
              style={{
                marginTop: '0.35rem',
                textAlign: 'center',
                fontSize: '0.75rem',
                letterSpacing: '0.18em',
                color: 'var(--text-subtle)',
                minHeight: '20px'
              }}
            >
              {t('tagline', currentLanguage)}
            </div>
          </div>
        </div>
      </div>

      {/* Decoupled GPU-Composited Compact Sticky Bar (Desktop Only — Glides via transform only) */}
      <div
        className={`masthead-compact-bar hide-on-mobile ${isSticky ? 'is-visible' : ''}`}
        aria-hidden={!isSticky}
      >
        <div
          className="container"
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%'
          }}
        >
          {/* Left Quick Actions (All Categories + Search) */}
          <div
            style={{
              position: 'absolute',
              left: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              zIndex: 2
            }}
          >
            <button
              type="button"
              tabIndex={isSticky ? 0 : -1}
              onClick={() => setIsMobileMenuOpen(true)}
              title="Browse Sections & Desks"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-main)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.35rem 0.55rem',
                minHeight: '36px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: '700',
                fontSize: '0.8rem'
              }}
              className="btn-hover-subtle"
            >
              <Menu size={18} />
              <span>{t('allCategories', currentLanguage) || 'Sections'}</span>
            </button>
            <button
              type="button"
              tabIndex={isSticky ? 0 : -1}
              onClick={() => onOpenSearchDrawer ? onOpenSearchDrawer() : onNavigate('search')}
              title={t('search', currentLanguage)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-main)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.35rem 0.5rem',
                minHeight: '36px',
                minWidth: '36px',
                borderRadius: 'var(--radius-sm)'
              }}
              className="btn-hover-subtle"
            >
              <Search size={16} />
            </button>
          </div>

          <a
            href="#"
            tabIndex={isSticky ? 0 : -1}
            onClick={(e) => { e.preventDefault(); onNavigate('home'); }}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
            title="PublicSpark Home"
          >
            <img
              src="/logo.png"
              alt="PUBLIC SPARK News Logo"
              style={{
                height: '38px',
                width: 'auto',
                objectFit: 'contain',
                mixBlendMode: theme === 'dark' ? 'normal' : 'multiply',
                background: theme === 'dark' ? '#FFFFFF' : 'transparent',
                padding: theme === 'dark' ? '2px 8px' : '0',
                borderRadius: theme === 'dark' ? 'var(--radius-sm)' : '0'
              }}
            />
          </a>
        </div>
      </div>


      {/* Live Breaking News Ticker Bar */}
      <div className="ticker-bar">
        <div className="ticker-badge">
          <span className="pulse-dot"></span>
          {t('breaking', currentLanguage)}
        </div>
        {activeTickerArticle ? (
          <button
            type="button"
            onClick={() => onSelectArticle && onSelectArticle(activeTickerArticle)}
            className={`ticker-content ticker-link-btn ${isFading ? 'fade-out' : ''}`}
            title={activeTickerArticle.title}
          >
            {activeTickerArticle.title}
          </button>
        ) : (
          <div className={`ticker-content ${isFading ? 'fade-out' : ''}`} />
        )}
        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          <button 
            onClick={() => setIsTickerPlaying(!isTickerPlaying)}
            style={{ background: 'rgba(255,255,255,0.2)', color: 'white', minHeight: '28px', minWidth: '28px', padding: '0.2rem 0.45rem', borderRadius: '4px', fontSize: '0.75rem', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            title={isTickerPlaying ? 'Pause Ticker' : 'Play Ticker'}
          >
            {isTickerPlaying ? <Pause size={12} /> : <Play size={12} />}
          </button>
          <button 
            onClick={handleNextTicker}
            style={{ background: 'rgba(255,255,255,0.2)', color: 'white', minHeight: '28px', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer', border: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
          >
            <span>{t('next', currentLanguage)}</span>
            <ChevronRight size={12} />
          </button>
        </div>
      </div>

      {/* Category Sticky Navigation */}
      <nav className={`category-nav ${isSticky ? 'sticky-glass' : ''}`}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden', flex: 1 }}>
            {/* Dedicated Bookmark Button */}
            <button 
              onClick={() => {
                if (onOpenSavedDrawer) {
                  onOpenSavedDrawer();
                } else {
                  onSelectCategory('bookmarks');
                  onNavigate('home');
                }
              }}
              title={t('savedBookmarks', currentLanguage)}
              style={{
                background: activeCategory === 'bookmarks' ? 'var(--accent-crimson)' : 'var(--accent-crimson-bg)',
                color: activeCategory === 'bookmarks' ? '#ffffff' : 'var(--accent-crimson)',
                border: '1.5px solid var(--accent-crimson)',
                borderRadius: '8px',
                padding: '0.4rem 0.65rem',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: activeCategory === 'bookmarks' ? '0 2px 8px rgba(184, 29, 19, 0.35)' : 'none',
                transition: 'all 0.2s ease',
                flexShrink: 0
              }}
            >
              <Bookmark size={16} fill={activeCategory === 'bookmarks' ? '#ffffff' : 'none'} color={activeCategory === 'bookmarks' ? '#ffffff' : 'var(--accent-crimson)'} />
            </button>

            <div style={{ width: '1px', height: '22px', backgroundColor: 'var(--border-medium)', opacity: 0.6, flexShrink: 0 }} />

            <div className="category-list" style={{ flex: 1 }}>
              <a 
                href="#" 
                onClick={(e) => { e.preventDefault(); onSelectCategory('all'); onNavigate('home'); }}
                className={`category-link ${activeCategory === 'all' ? 'active' : ''}`}
              >
                {t('topStories', currentLanguage)}
              </a>
              {populatedCategories.map((cat) => (
                <a 
                  key={cat.id} 
                  href="#"
                  onClick={(e) => { e.preventDefault(); onSelectCategory(cat.slug); onNavigate('home'); }}
                  className={`category-link ${activeCategory === cat.slug ? 'active' : ''}`}
                >
                  {translateCategoryName(cat.name, currentLanguage)}
                </a>
              ))}
            </div>
          </div>

          <button 
            onClick={() => onOpenSearchDrawer ? onOpenSearchDrawer() : onNavigate('search')} 
            className="btn btn-outline" 
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.825rem', flexShrink: 0 }}
          >
            <Search size={14} /> <span className="hide-on-mobile">{t('search', currentLanguage)}</span>
          </button>
        </div>
      </nav>

      {/* Full-Screen Left-Aligned Categories & Navigation Drawer */}
      {isMobileMenuOpen && (
        <div 
          className="mobile-drawer-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="All Categories Navigation"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div 
            className="mobile-drawer-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mobile-drawer-inner">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                  <img src="/logo.png" alt="PublicSpark" style={{ height: '28px', width: 'auto' }} />
                  <span style={{ fontWeight: '900', fontSize: '1.1rem', fontFamily: 'var(--font-serif)', letterSpacing: '-0.01em' }}>PUBLIC SPARK</span>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)} 
                  style={{
                    minWidth: '44px',
                    minHeight: '44px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-main)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                  aria-label="Close menu"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Staff Access & Workspaces */}
              <div style={{ maxWidth: '380px', width: '100%' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>
                  Newsroom Access
                </label>
                {currentRole === 'visitor' ? (
                  <button
                    type="button"
                    onClick={() => { setIsMobileMenuOpen(false); onOpenStaffLogin(); }}
                    className="btn btn-outline"
                    style={{ minHeight: '44px', width: '100%', justifyContent: 'flex-start', padding: '0.6rem 0.9rem', fontSize: '0.88rem', borderColor: 'var(--accent-crimson)', color: 'var(--accent-crimson)' }}
                  >
                    <Lock size={15} /> Staff Access Login
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    <div style={{ padding: '0.55rem 0.85rem', background: 'rgba(185, 28, 28, 0.08)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                        <ShieldCheck size={14} color="var(--accent-crimson)" />
                        <span style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--accent-crimson)', textTransform: 'uppercase' }}>
                          {currentRole}
                        </span>
                        {staffName && <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>({staffName})</span>}
                      </div>
                      <button
                        type="button"
                        onClick={() => { setIsMobileMenuOpen(false); onStaffLogout(); }}
                        style={{ minWidth: '36px', minHeight: '36px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        aria-label="Staff Logout"
                      >
                        <LogOut size={15} />
                      </button>
                    </div>
                    {currentRole === 'reporter' && (
                      <button
                        type="button"
                        onClick={() => { onNavigate('reporter'); setIsMobileMenuOpen(false); }}
                        className="btn btn-primary"
                        style={{ minHeight: '44px', justifyContent: 'flex-start', padding: '0.55rem 0.85rem', fontSize: '0.85rem' }}
                      >
                        <PenTool size={15} /> {t('reporterDesk', currentLanguage)}
                      </button>
                    )}
                    {currentRole === 'editor' && (
                      <button
                        type="button"
                        onClick={() => { onNavigate('editor'); setIsMobileMenuOpen(false); }}
                        className="btn btn-primary"
                        style={{ minHeight: '44px', justifyContent: 'flex-start', padding: '0.55rem 0.85rem', fontSize: '0.85rem' }}
                      >
                        <CheckCircle size={15} /> {t('editorDesk', currentLanguage)}
                      </button>
                    )}
                    {(currentRole === 'admin' || currentRole === 'developer') && (
                      <button
                        type="button"
                        onClick={() => { onNavigate('admin'); setIsMobileMenuOpen(false); }}
                        className="btn btn-primary"
                        style={{ minHeight: '44px', justifyContent: 'flex-start', padding: '0.55rem 0.85rem', fontSize: '0.85rem' }}
                      >
                        <Settings size={15} /> {t('newsroomMgmt', currentLanguage)}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* All Categories & Sections Grid */}
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.65rem' }}>
                  {t('topStories', currentLanguage)} & Sections
                </label>
                <div className="mobile-drawer-sections-grid">
                  <button
                    type="button"
                    onClick={() => { onSelectCategory('all'); onNavigate('home'); setIsMobileMenuOpen(false); }}
                    className={`btn ${activeCategory === 'all' ? 'btn-primary' : 'btn-outline'}`}
                    style={{ minHeight: '44px', justifyContent: 'flex-start', width: '100%', padding: '0.55rem 0.9rem', fontSize: '0.875rem' }}
                  >
                    {t('topStories', currentLanguage)}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      if (onOpenSavedDrawer) {
                        onOpenSavedDrawer();
                      } else {
                        onSelectCategory('bookmarks');
                        onNavigate('home');
                      }
                    }}
                    className={`btn ${activeCategory === 'bookmarks' ? 'btn-primary' : 'btn-outline'}`}
                    style={{ minHeight: '44px', justifyContent: 'flex-start', width: '100%', padding: '0.55rem 0.9rem', fontSize: '0.875rem', borderColor: activeCategory === 'bookmarks' ? 'var(--accent-crimson)' : 'var(--border-medium)', color: activeCategory === 'bookmarks' ? '#fff' : 'var(--text-main)' }}
                  >
                    <Bookmark size={15} /> {t('savedBookmarks', currentLanguage)}
                  </button>
                  {populatedCategories.map((cat) => (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() => { onSelectCategory(cat.slug); onNavigate('home'); setIsMobileMenuOpen(false); }}
                      className={`btn ${activeCategory === cat.slug ? 'btn-primary' : 'btn-outline'}`}
                      style={{ minHeight: '44px', justifyContent: 'flex-start', width: '100%', padding: '0.55rem 0.9rem', fontSize: '0.875rem' }}
                    >
                      {translateCategoryName(cat.name, currentLanguage)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bottom Drawer Meta */}
              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.85rem', fontSize: '0.8rem', color: 'var(--text-subtle)' }}>
                <div>{currentDate}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
