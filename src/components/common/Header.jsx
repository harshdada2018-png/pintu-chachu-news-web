import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Sun, Moon, Search, UserCheck, Flame, Newspaper, 
  ShieldCheck, PenTool, CheckCircle, Settings, Languages, Bookmark, Menu, X, CloudSun, Play, Pause, Calendar, ChevronRight
} from 'lucide-react';
import { MOCK_CATEGORIES, MOCK_BREAKING_NEWS } from '../../services/mockData';
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
  categories = MOCK_CATEGORIES,
  articles = [],
  onOpenSavedDrawer
}) {
  const breakingItems = useMemo(() => {
    const fromArticles = (articles || []).filter(a => a.is_breaking).map(a => a.title);
    return fromArticles.length > 0 ? fromArticles : MOCK_BREAKING_NEWS;
  }, [articles]);

  // Public category filter: Only display categories with >= 1 published article (prevents AdSense empty category rejection)
  const populatedCategories = useMemo(() => {
    const rawCategories = categories || MOCK_CATEGORIES;
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
  const [weather, setWeather] = useState({ temperature: '28°C', location: 'Delhi NCR' });

  // Fetch dynamic weather data from backend API
  useEffect(() => {
    fetch('/api/weather')
      .then(res => res.json())
      .then(data => {
        if (data && data.temperature) setWeather(data);
      })
      .catch(err => console.warn('[Weather API] Offline fallback:', err));
  }, []);

  // Sticky header on scroll detection (triggers as soon as masthead-top scrolls away)
  useEffect(() => {
    const handleScroll = () => {
      setIsSticky(window.scrollY > 45);
    };
    handleScroll(); // Execute once on mount so page refreshes while scrolled stay sticky
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNextTicker = useCallback(() => {
    setIsFading(true);
    setTimeout(() => {
      setTickerIndex((prev) => (prev + 1) % breakingItems.length);
      setIsFading(false);
    }, 350);
  }, [breakingItems.length]);

  useEffect(() => {
    if (!isTickerPlaying) return;
    const timer = setInterval(() => {
      handleNextTicker();
    }, 4000);

    return () => clearInterval(timer);
  }, [handleNextTicker, isTickerPlaying]);

  const currentDate = new Date().toLocaleDateString('en-IN', {
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
              onClick={() => onNavigate('search')} 
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
              style={{ color: '#f59e0b' }}
            >
              <Bookmark size={15} fill="#f59e0b" color="#f59e0b" />
            </button>

            {/* Dark / Light Toggle */}
            <button 
              onClick={onToggleTheme} 
              className="mobile-action-icon"
              title="Toggle Dark/Light Mode"
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? <Sun size={15} color="#F59E0B" /> : <Moon size={15} />}
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
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: 'var(--accent-amber)', fontWeight: '700' }}>
              <CloudSun size={15} /> {weather.temperature} {weather.location}
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

            {/* Institutional Newsroom Staff Access (Desktop) */}
            <div className="hide-on-mobile" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'var(--bg-secondary)', padding: '0.25rem 0.55rem', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', border: '1px solid var(--border-light)' }}>
              <UserCheck size={13} color={currentRole === 'visitor' ? 'var(--text-subtle)' : 'var(--accent-indigo)'} />
              <select 
                value={currentRole} 
                onChange={(e) => onRoleChange(e.target.value)}
                title="Staff & Editorial Desks"
                aria-label="Staff & Editorial Desks"
                style={{ background: 'transparent', border: 'none', fontWeight: '700', color: currentRole === 'visitor' ? 'var(--text-subtle)' : 'var(--text-main)', cursor: 'pointer', outline: 'none', fontSize: '0.75rem' }}
              >
                <option value="visitor">{t('readerView', currentLanguage)}</option>
                <option value="reporter">{t('reporterDesk', currentLanguage)}</option>
                <option value="editor">{t('editorDesk', currentLanguage)}</option>
                <option value="admin">{t('newsroomMgmt', currentLanguage)}</option>
              </select>
            </div>

            {/* Theme Toggle */}
            <button 
              onClick={onToggleTheme} 
              className="btn btn-outline" 
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
              title="Toggle Dark/Light Mode"
            >
              {theme === 'dark' ? <Sun size={14} color="#F59E0B" /> : <Moon size={14} color="#1E293B" />}
              <span className="hide-on-mobile">{theme === 'dark' ? t('lightMode', currentLanguage) : t('darkMode', currentLanguage)}</span>
            </button>

            {/* Mobile Hamburger Button */}
            <button
              className="mobile-menu-btn"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              style={{
                display: 'none',
                background: 'var(--gradient-accent)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '0.3rem 0.5rem',
                cursor: 'pointer'
              }}
              title="Toggle Menu"
            >
              {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* Classic Newspaper Main Masthead (Desktop Only - Fixed at top: 0 when scrolled like BBC) */}
      <div 
        className="masthead-main-wrapper hide-on-mobile"
        style={{ minHeight: isSticky ? '118px' : 'auto', transition: 'min-height 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <div 
          className={`masthead-main ${isSticky ? 'is-sticky' : ''}`}
        >
          <div 
            className="container" 
            style={{ 
              position: 'relative', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              minHeight: isSticky ? '46px' : 'auto',
              transition: 'min-height 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* Left Quick Actions (Snappy fade and slide like BBC ≡ Q) */}
            <div 
              style={{ 
                position: 'absolute', 
                left: '1.25rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.4rem',
                zIndex: 2,
                opacity: isSticky ? 1 : 0,
                transform: isSticky ? 'translateX(0)' : 'translateX(-8px)',
                pointerEvents: isSticky ? 'auto' : 'none',
                transition: 'opacity 0.2s ease, transform 0.2s ease'
              }}
            >
              <button
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
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: '700',
                  fontSize: '0.8rem',
                  transition: 'background 0.2s ease'
                }}
                className="btn-hover-subtle"
              >
                <Menu size={18} />
                <span>{t('allNews', currentLanguage) || 'Sections'}</span>
              </button>
              <button
                onClick={() => onNavigate('search')}
                title={t('search', currentLanguage)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0.35rem 0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  transition: 'background 0.2s ease'
                }}
                className="btn-hover-subtle"
              >
                <Search size={16} />
              </button>
            </div>

            {/* Centered Logo (Snappy scaling over 0.25s) */}
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
                  height: isSticky ? '44px' : '75px', 
                  width: 'auto', 
                  maxWidth: '90vw',
                  objectFit: 'contain',
                  mixBlendMode: theme === 'dark' ? 'normal' : 'multiply',
                  background: theme === 'dark' ? '#FFFFFF' : 'transparent',
                  padding: theme === 'dark' ? (isSticky ? '3px 10px' : '4px 14px') : '0',
                  borderRadius: theme === 'dark' ? 'var(--radius-sm)' : '0',
                  transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
                }} 
              />
            </a>

            {/* Hindi Tagline (Snappy fade and collapse) */}
            <div 
              className="masthead-tagline" 
              style={{ 
                marginTop: isSticky ? '0' : '0.35rem', 
                textAlign: 'center', 
                fontSize: '0.75rem', 
                letterSpacing: '0.18em', 
                color: 'var(--text-subtle)',
                opacity: isSticky ? 0 : 1,
                maxHeight: isSticky ? '0px' : '24px',
                overflow: 'hidden',
                pointerEvents: isSticky ? 'none' : 'auto',
                transition: 'opacity 0.2s ease, maxHeight 0.25s ease, margin 0.2s ease'
              }}
            >
              {t('tagline', currentLanguage)}
            </div>

            {/* Right Quick Actions (Snappy fade and slide) */}
            <div 
              style={{ 
                position: 'absolute', 
                right: '1.25rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.45rem',
                zIndex: 2,
                opacity: isSticky ? 1 : 0,
                transform: isSticky ? 'translateX(0)' : 'translateX(8px)',
                pointerEvents: isSticky ? 'auto' : 'none',
                transition: 'opacity 0.2s ease, transform 0.2s ease'
              }}
            >
              {/* Quick Language Pill */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', background: 'var(--accent-crimson-bg)', padding: '0.2rem 0.45rem', borderRadius: '4px', border: '1px solid var(--accent-crimson)' }}>
                <Languages size={12} color="var(--accent-crimson)" />
                <select 
                  value={currentLanguage} 
                  onChange={(e) => onLanguageChange(e.target.value)}
                  style={{ background: 'transparent', border: 'none', fontWeight: '800', color: 'var(--accent-crimson)', cursor: 'pointer', fontSize: '0.72rem', outline: 'none' }}
                >
                  {SUPPORTED_LANGUAGES.map(l => (
                    <option key={l.code} value={l.code}>{l.code.toUpperCase()}</option>
                  ))}
                </select>
              </div>

              {/* Theme Toggle Button */}
              <button
                onClick={onToggleTheme}
                title="Toggle Dark/Light Mode"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0.3rem 0.45rem',
                  borderRadius: 'var(--radius-sm)',
                  transition: 'background 0.2s ease'
                }}
                className="btn-hover-subtle"
              >
                {theme === 'dark' ? <Sun size={14} color="#F59E0B" /> : <Moon size={14} color="#1E293B" />}
              </button>
            </div>
          </div>
        </div>
      </div>


      {/* Live Breaking News Ticker Bar */}
      <div className="ticker-bar">
        <div className="ticker-badge">
          <span className="pulse-dot"></span>
          {t('breaking', currentLanguage)}
        </div>
        <div className={`ticker-content ${isFading ? 'fade-out' : ''}`}>
          {breakingItems[tickerIndex % breakingItems.length]}
        </div>
        <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
          <button 
            onClick={() => setIsTickerPlaying(!isTickerPlaying)}
            style={{ background: 'rgba(255,255,255,0.2)', color: 'white', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.75rem', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
            title={isTickerPlaying ? 'Pause Ticker' : 'Play Ticker'}
          >
            {isTickerPlaying ? <Pause size={12} /> : <Play size={12} />}
          </button>
          <button 
            onClick={handleNextTicker}
            style={{ background: 'rgba(255,255,255,0.2)', color: 'white', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
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
              onClick={() => { onSelectCategory('bookmarks'); onNavigate('home'); }}
              title={t('savedBookmarks', currentLanguage)}
              style={{
                background: activeCategory === 'bookmarks' ? '#f59e0b' : 'rgba(245, 158, 11, 0.15)',
                color: activeCategory === 'bookmarks' ? '#ffffff' : '#d97706',
                border: '1.5px solid #f59e0b',
                borderRadius: '8px',
                padding: '0.4rem 0.65rem',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: activeCategory === 'bookmarks' ? '0 2px 8px rgba(245, 158, 11, 0.4)' : 'none',
                transition: 'all 0.2s ease',
                flexShrink: 0
              }}
            >
              <Bookmark size={16} fill={activeCategory === 'bookmarks' ? '#ffffff' : 'none'} color={activeCategory === 'bookmarks' ? '#ffffff' : '#f59e0b'} />
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
            onClick={() => onNavigate('search')} 
            className="btn btn-outline" 
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.825rem', flexShrink: 0 }}
          >
            <Search size={14} /> <span className="hide-on-mobile">{t('search', currentLanguage)}</span>
          </button>
        </div>
      </nav>

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="mobile-drawer-overlay"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div 
            className="mobile-drawer-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <img src="/logo.png" alt="PublicSpark" style={{ height: '24px', width: 'auto' }} />
                <span style={{ fontWeight: '800', fontSize: '1rem', fontFamily: 'var(--font-serif)' }}>PUBLIC SPARK</span>
              </div>
              <button 
                onClick={() => setIsMobileMenuOpen(false)} 
                style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', padding: '0.25rem' }}
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>

            {/* Quick Workspace Switcher for Newsroom & Readers */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>
                Workspace & Desks
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.4rem' }}>
                <button
                  onClick={() => { onRoleChange('visitor'); onNavigate('home'); setIsMobileMenuOpen(false); }}
                  className={`btn ${currentRole === 'visitor' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ justifyContent: 'flex-start', padding: '0.5rem 0.75rem', fontSize: '0.825rem' }}
                >
                  <Newspaper size={15} /> {t('readerView', currentLanguage)}
                </button>
                <button
                  onClick={() => { onRoleChange('reporter'); onNavigate('reporter'); setIsMobileMenuOpen(false); }}
                  className={`btn ${currentRole === 'reporter' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ justifyContent: 'flex-start', padding: '0.5rem 0.75rem', fontSize: '0.825rem' }}
                >
                  <PenTool size={15} /> {t('reporterDesk', currentLanguage)}
                </button>
                <button
                  onClick={() => { onRoleChange('editor'); onNavigate('editor'); setIsMobileMenuOpen(false); }}
                  className={`btn ${currentRole === 'editor' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ justifyContent: 'flex-start', padding: '0.5rem 0.75rem', fontSize: '0.825rem' }}
                >
                  <CheckCircle size={15} /> {t('editorDesk', currentLanguage)}
                </button>
                <button
                  onClick={() => { onRoleChange('admin'); onNavigate('admin'); setIsMobileMenuOpen(false); }}
                  className={`btn ${currentRole === 'admin' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ justifyContent: 'flex-start', padding: '0.5rem 0.75rem', fontSize: '0.825rem' }}
                >
                  <Settings size={15} /> {t('newsroomMgmt', currentLanguage)}
                </button>
              </div>
            </div>

            {/* Mobile Categories */}
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>
                {t('topStories', currentLanguage)} & Sections
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <button
                  onClick={() => { onSelectCategory('all'); onNavigate('home'); setIsMobileMenuOpen(false); }}
                  className={`btn ${activeCategory === 'all' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ justifyContent: 'flex-start', width: '100%', padding: '0.45rem 0.75rem', fontSize: '0.825rem' }}
                >
                  {t('topStories', currentLanguage)}
                </button>
                <button
                  onClick={() => { onSelectCategory('bookmarks'); onNavigate('home'); setIsMobileMenuOpen(false); }}
                  className={`btn ${activeCategory === 'bookmarks' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ justifyContent: 'flex-start', width: '100%', padding: '0.45rem 0.75rem', fontSize: '0.825rem', borderColor: '#f59e0b', color: activeCategory === 'bookmarks' ? '#fff' : '#d97706' }}
                >
                  <Bookmark size={15} /> {t('savedBookmarks', currentLanguage)}
                </button>
                {populatedCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => { onSelectCategory(cat.slug); onNavigate('home'); setIsMobileMenuOpen(false); }}
                    className={`btn ${activeCategory === cat.slug ? 'btn-primary' : 'btn-outline'}`}
                    style={{ justifyContent: 'flex-start', width: '100%', padding: '0.45rem 0.75rem', fontSize: '0.825rem' }}
                  >
                    {translateCategoryName(cat.name, currentLanguage)}
                  </button>
                ))}
              </div>
            </div>

            {/* Bottom Drawer Meta */}
            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
              <div>{currentDate} • {weather.temperature}</div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
