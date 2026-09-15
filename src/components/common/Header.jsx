import React, { useState } from 'react';
import { 
  Sun, Moon, Search, UserCheck, Flame, Newspaper, 
  ShieldCheck, PenTool, CheckCircle, Settings, Languages 
} from 'lucide-react';
import { MOCK_CATEGORIES, MOCK_BREAKING_NEWS } from '../../services/mockData';
import { SUPPORTED_LANGUAGES } from '../../services/translationService';

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
  categories = MOCK_CATEGORIES
}) {
  const [tickerIndex, setTickerIndex] = useState(0);
  const currentDate = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <header style={{ width: '100%' }}>
      {/* Top Utility Masthead */}
      <div className="masthead-top">
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
            <span>📅 {currentDate}</span>
            <span>📍 New Delhi, IN</span>
            <span style={{ color: 'var(--accent-emerald)', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <ShieldCheck size={14} /> Fact-Checked Platform
            </span>
          </div>

          {/* Right Side Corner Controls: Language Selector, View Switcher & Theme Switcher */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            
            {/* Multi-Language Selector Section (Right Side Corner) */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.4rem', 
              background: 'var(--accent-crimson-bg)', 
              color: 'var(--accent-crimson)', 
              padding: '0.25rem 0.65rem', 
              borderRadius: 'var(--radius-sm)', 
              fontSize: '0.8rem',
              border: '1px solid var(--accent-crimson)',
              fontWeight: '700'
            }}>
              <Languages size={15} color="var(--accent-crimson)" />
              <label htmlFor="lang-select" style={{ cursor: 'pointer' }}>Lang:</label>
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
                  outline: 'none' 
                }}
              >
                <optgroup label="🇮🇳 Indian Languages">
                  {SUPPORTED_LANGUAGES.filter(l => !['fr', 'it', 'ja', 'id', 'zh-TW', 'en'].includes(l.code)).map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.native} ({lang.name})
                    </option>
                  ))}
                  <option value="en">English (EN)</option>
                </optgroup>
                <optgroup label="🌐 International Languages">
                  {SUPPORTED_LANGUAGES.filter(l => ['fr', 'it', 'ja', 'id', 'zh-TW'].includes(l.code)).map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.native} ({lang.name})
                    </option>
                  ))}
                </optgroup>
              </select>
              {isTranslating && (
                <span style={{ fontSize: '0.7rem', color: 'var(--accent-amber)', fontWeight: '700' }}>
                  Translating...
                </span>
              )}
            </div>

            {/* View Switcher */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--bg-secondary)', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }}>
              <UserCheck size={14} color="var(--accent-blue)" />
              <select 
                value={currentRole} 
                onChange={(e) => onRoleChange(e.target.value)}
                style={{ background: 'transparent', border: 'none', fontWeight: '700', color: 'var(--text-main)', cursor: 'pointer' }}
              >
                <option value="visitor">Reader View</option>
                <option value="reporter">Reporter Desk</option>
                <option value="editor">Editor Desk</option>
                <option value="admin">Newsroom Management</option>
              </select>
            </div>

            {/* Theme Toggle */}
            <button 
              onClick={onToggleTheme} 
              className="btn btn-outline" 
              style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
              title="Toggle Dark/Light Mode"
            >
              {theme === 'dark' ? <Sun size={14} color="#F59E0B" /> : <Moon size={14} color="#1E293B" />}
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>
        </div>
      </div>

      {/* Classic Newspaper Main Masthead */}
      <div className="masthead-main" style={{ padding: '1.25rem 0' }}>
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
                height: '95px', 
                width: 'auto', 
                objectFit: 'contain',
                filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.08))',
                transition: 'transform 0.2s ease'
              }} 
            />
          </a>
          <div className="masthead-tagline" style={{ marginTop: '0.4rem' }}>
            INDEPENDENT DIGITAL NEWSROOM • TRUTH • VERIFICATION • TRANSPARENCY
          </div>

          {/* Newsroom Quick Link Buttons */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginTop: '1rem' }}>
            <button 
              onClick={() => onNavigate('home')} 
              className={`btn ${activeView === 'home' ? 'btn-primary' : 'btn-outline'}`}
              style={{ padding: '0.45rem 1.1rem', fontSize: '0.825rem', borderRadius: '30px' }}
            >
              <Newspaper size={15} /> Public News
            </button>

            {(currentRole === 'reporter' || currentRole === 'admin') && (
              <button 
                onClick={() => onNavigate('reporter')} 
                className={`btn ${activeView === 'reporter' ? 'btn-primary' : 'btn-outline'}`}
                style={{ padding: '0.45rem 1.1rem', fontSize: '0.825rem', borderRadius: '30px' }}
              >
                <PenTool size={15} /> Reporter Desk
              </button>
            )}

            {(currentRole === 'editor' || currentRole === 'admin') && (
              <button 
                onClick={() => onNavigate('editor')} 
                className={`btn ${activeView === 'editor' ? 'btn-primary' : 'btn-outline'}`}
                style={{ padding: '0.45rem 1.1rem', fontSize: '0.825rem', borderRadius: '30px' }}
              >
                <CheckCircle size={15} /> Editor Desk
              </button>
            )}

            {currentRole === 'admin' && (
              <button 
                onClick={() => onNavigate('admin')} 
                className={`btn ${activeView === 'admin' ? 'btn-primary' : 'btn-outline'}`}
                style={{ padding: '0.45rem 1.1rem', fontSize: '0.825rem', borderRadius: '30px' }}
              >
                <Settings size={15} /> Newsroom Management
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Live Breaking News Ticker Bar */}
      <div className="ticker-bar">
        <div className="ticker-badge">
          <span className="pulse-dot"></span>
          <Flame size={13} color="var(--accent-crimson)" />
          BREAKING
        </div>
        <div style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {MOCK_BREAKING_NEWS[tickerIndex]}
        </div>
        <button 
          onClick={() => setTickerIndex((prev) => (prev + 1) % MOCK_BREAKING_NEWS.length)}
          style={{ background: 'rgba(255,255,255,0.2)', color: 'white', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700' }}
        >
          Next ❯
        </button>
      </div>

      {/* Category Sticky Navigation */}
      <nav className="category-nav">
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="category-list">
            <a 
              href="#" 
              onClick={(e) => { e.preventDefault(); onSelectCategory('all'); onNavigate('home'); }}
              className={`category-link ${activeCategory === 'all' ? 'active' : ''}`}
            >
              Top Stories
            </a>
            {(categories || MOCK_CATEGORIES).map((cat) => (
              <a 
                key={cat.id} 
                href="#"
                onClick={(e) => { e.preventDefault(); onSelectCategory(cat.slug); onNavigate('home'); }}
                className={`category-link ${activeCategory === cat.slug ? 'active' : ''}`}
              >
                {cat.name}
              </a>
            ))}
          </div>

          <button 
            onClick={() => onNavigate('search')} 
            className="btn btn-outline" 
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.825rem' }}
          >
            <Search size={14} /> Search
          </button>
        </div>
      </nav>
    </header>
  );
}
