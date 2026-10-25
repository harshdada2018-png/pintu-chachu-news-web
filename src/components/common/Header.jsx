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
  articles = []
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

  // Sticky header on scroll detection
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 120) {
        setIsSticky(true);
      } else {
        setIsSticky(false);
      }
    };
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
      <div className="mobile-app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
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
            style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
          >
            <img 
              src="/logo.png" 
              alt="PUBLIC SPARK" 
              style={{ height: '32px', width: 'auto', objectFit: 'contain' }} 
            />
          </a>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {/* Quick Mobile Language Select */}
          <div className="mobile-lang-pill">
            <Languages size={13} color="var(--accent-crimson)" />
            <select 
              value={currentLanguage} 
              onChange={(e) => onLanguageChange(e.target.value)}
              className="mobile-lang-select"
              aria-label="Select Language"
            >
              <optgroup label="Regional">
                {SUPPORTED_LANGUAGES.filter(l => !['fr', 'it', 'ja', 'id', 'zh-TW', 'ru', 'en'].includes(l.code)).map((lang) => (
                  <option key={lang.code} value={lang.code}>{lang.native} ({lang.name})</option>
                ))}
                <option value="en">English</option>
              </optgroup>
              <optgroup label="Global">
                {SUPPORTED_LANGUAGES.filter(l => ['fr', 'it', 'ja', 'id', 'zh-TW', 'ru'].includes(l.code)).map((lang) => (
                  <option key={lang.code} value={lang.code}>{lang.native} ({lang.name})</option>
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
            <Search size={16} />
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

          {/* Right Side Corner Controls: Mobile Hamburger, Language Selector, View Switcher & Theme Switcher */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            
            {/* Multi-Language Selector Section (Right Side Corner) */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.3rem', 
              background: 'var(--accent-crimson-bg)', 
              color: 'var(--accent-crimson)', 
              padding: '0.2rem 0.5rem', 
              borderRadius: 'var(--radius-sm)', 
              fontSize: '0.75rem',
              border: '1px solid var(--accent-crimson)',
              fontWeight: '700'
            }}>
              <Languages size={14} color="var(--accent-crimson)" />
              <select 
                id="lang-select"
                value={currentLanguage} 
                onChange={(e) => onLanguageChange(e.target.value)}
                disabled={isTranslating}
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  fontWeight: '800', 
                  color: 'var(--accent-crimson)', 
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

            {/* View Switcher (Desktop) */}
            <div className="hide-on-mobile" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--bg-secondary)', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }}>
              <UserCheck size={14} color="var(--accent-blue)" />
              <select 
                value={currentRole} 
                onChange={(e) => onRoleChange(e.target.value)}
                style={{ background: 'transparent', border: 'none', fontWeight: '700', color: 'var(--text-main)', cursor: 'pointer' }}
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

      {/* Classic Newspaper Main Masthead (Desktop Only) */}
      <div className="masthead-main hide-on-mobile" style={{ padding: '0.85rem 0', borderBottom: '1px solid var(--border-medium)' }}>
        <div className="container" style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
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
                borderRadius: theme === 'dark' ? 'var(--radius-sm)' : '0',
                transition: 'transform 0.2s ease'
              }} 
            />
          </a>
          <div className="masthead-tagline" style={{ marginTop: '0.35rem', textAlign: 'center', fontSize: '0.75rem', letterSpacing: '0.18em', color: 'var(--text-subtle)' }}>
            {t('tagline', currentLanguage)}
          </div>
        </div>
      </div>

      {/* Live Breaking News Ticker Bar */}
      <div className="ticker-bar">
        <div className="ticker-badge">
          <span className="pulse-dot"></span>
          <Flame size={13} color="var(--accent-crimson)" />
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
