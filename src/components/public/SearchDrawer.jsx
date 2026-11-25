import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, Clock, ArrowRight, Newspaper, Flame, Tag, Check } from 'lucide-react';
import { t, translateCategoryName } from '../../services/uiTranslations';
import { calculateReadingTime } from '../../utils/readingTime';

/**
 * PublicSpark Newsroom — Left-Side Animated Search Drawer (Task 39 Subtopic A)
 * Highly-calibrated 60fps GPU-accelerated slide-out search drawer.
 * Provides 0ms instant search matching across real published articles,
 * dynamic category quick-pills, and instant 1-tap reading navigation.
 */
export default function SearchDrawer({
  isOpen,
  onClose,
  articles = [],
  categories = [],
  currentLanguage = 'hi',
  onSelectArticle,
  onSelectCategory
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCatFilter, setSelectedCatFilter] = useState('all');
  const inputRef = useRef(null);
  const drawerRef = useRef(null);

  // Auto-focus search input with micro-delay for smooth animation synchronization
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setSearchQuery('');
      setSelectedCatFilter('all');
    }
  }, [isOpen]);

  // Keyboard accessibility: Escape key closes the drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // 100% Dynamic 0ms in-memory search filtering (Zero Server Latency)
  const filteredArticles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    
    return articles.filter(art => {
      // Embargo guard: only published stories
      if (art.status === 'hidden' || art.status === 'draft') return false;
      if (art.status === 'scheduled') {
        if (!art.scheduledPublishTime || new Date(art.scheduledPublishTime).getTime() > Date.now()) {
          return false;
        }
      }

      // Category filter check
      if (selectedCatFilter !== 'all') {
        const normSlug = (art.category_slug || '').toLowerCase();
        const normCat = (art.category || '').toLowerCase();
        const filterSlug = selectedCatFilter.toLowerCase();
        if (normSlug !== filterSlug && normCat !== filterSlug) {
          return false;
        }
      }

      // If query is empty, show all available matching the category filter
      if (!query) return true;

      const title = (art.title || '').toLowerCase();
      const summary = (art.summary || '').toLowerCase();
      const content = (art.content || '').toLowerCase();
      const author = (art.author?.name || '').toLowerCase();
      const category = (art.category || '').toLowerCase();

      return (
        title.includes(query) ||
        summary.includes(query) ||
        content.includes(query) ||
        author.includes(query) ||
        category.includes(query)
      );
    });
  }, [articles, searchQuery, selectedCatFilter]);

  const handleArticleClick = (art) => {
    if (onSelectArticle) {
      onSelectArticle(art);
    }
    onClose();
  };

  const handleCategoryPillClick = (slug) => {
    setSelectedCatFilter(prev => prev === slug ? 'all' : slug);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="search-drawer-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Newsroom Search Library"
    >
      <div 
        ref={drawerRef}
        className="search-drawer-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Top Navigation Bar */}
        <div className="search-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div className="search-drawer-icon-badge">
              <Search size={18} color="var(--accent-crimson)" />
            </div>
            <div>
              <h2 className="search-drawer-title">
                {currentLanguage === 'hi' ? 'समाचार लाइब्रेरी खोज' : 'Newsroom Library Search'}
              </h2>
              <span className="search-drawer-subtitle">
                {currentLanguage === 'hi' ? 'शीर्षक, विषय या पत्रकार खोजें' : 'Search by headline, topic or byline'}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="search-drawer-close-btn"
            aria-label="Close search drawer"
            title="Close (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Input Bar with Instant Clear */}
        <div className="search-drawer-input-wrap">
          <Search size={18} className="search-drawer-input-icon" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={currentLanguage === 'hi' ? 'यहाँ कीवर्ड या शीर्षक लिखें...' : 'Type keyword or headline...'}
            className="search-drawer-input"
            maxLength={120}
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); inputRef.current?.focus(); }}
              className="search-drawer-clear-btn"
              title="Clear text"
              aria-label="Clear search input"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Dynamic Category Quick-Pills Filter */}
        <div className="search-drawer-pills-container">
          <button
            onClick={() => setSelectedCatFilter('all')}
            className={`search-drawer-pill ${selectedCatFilter === 'all' ? 'active' : ''}`}
          >
            {currentLanguage === 'hi' ? 'सभी श्रेणियां' : 'All Categories'}
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id || cat.slug}
              onClick={() => handleCategoryPillClick(cat.slug)}
              className={`search-drawer-pill ${selectedCatFilter === cat.slug ? 'active' : ''}`}
            >
              {translateCategoryName(cat.name, currentLanguage)}
            </button>
          ))}
        </div>

        {/* Results Metadata Bar */}
        <div className="search-drawer-meta-bar">
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {searchQuery 
              ? `${filteredArticles.length} ${currentLanguage === 'hi' ? 'परिणाम मिले' : 'results found'}`
              : `${filteredArticles.length} ${currentLanguage === 'hi' ? 'उपलब्ध समाचार' : 'stories available'}`
            }
          </span>
          {selectedCatFilter !== 'all' && (
            <button
              onClick={() => setSelectedCatFilter('all')}
              style={{ background: 'none', border: 'none', color: 'var(--accent-crimson)', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer', padding: 0 }}
            >
              {currentLanguage === 'hi' ? 'फ़िल्टर हटाएं' : 'Reset Filter'}
            </button>
          )}
        </div>

        {/* Search Results List / Empty State */}
        <div className="search-drawer-results-list">
          {filteredArticles.length > 0 ? (
            filteredArticles.map((art) => {
              const readingMinutes = art.reading_time_mins || calculateReadingTime(art.content || '', currentLanguage)?.minutes || 1;
              return (
                <div
                  key={art.id}
                  onClick={() => handleArticleClick(art)}
                  className="search-drawer-result-card"
                >
                  <div className="search-drawer-result-thumb">
                    {art.featured_image ? (
                      <img 
                        src={art.featured_image} 
                        alt={art.title} 
                        loading="lazy" 
                        onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                      />
                    ) : (
                      <div className="search-drawer-thumb-placeholder">
                        <Newspaper size={20} />
                      </div>
                    )}
                  </div>
                  <div className="search-drawer-result-content">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                      <span className="search-drawer-result-badge">
                        {translateCategoryName(art.category, currentLanguage)}
                      </span>
                      {art.format === 'video' && (
                        <span style={{ fontSize: '0.65rem', fontWeight: '800', background: 'var(--accent-crimson)', color: '#fff', padding: '0.1rem 0.35rem', borderRadius: '3px' }}>
                          VIDEO
                        </span>
                      )}
                    </div>
                    <h3 className="search-drawer-result-headline">
                      {art.title}
                    </h3>
                    <div className="search-drawer-result-meta">
                      <span>{art.author?.name || 'PublicSpark Desk'}</span>
                      <span>•</span>
                      <span>{art.published_at}</span>
                      <span>•</span>
                      <span>
                        <Clock size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '2px' }} />
                        {readingMinutes} {t('minsRead', currentLanguage)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="search-drawer-empty-state">
              <div className="search-drawer-empty-icon">
                <Search size={32} color="var(--accent-crimson)" />
              </div>
              <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                {currentLanguage === 'hi' ? 'कोई समाचार नहीं मिला' : 'No matching stories found'}
              </h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', lineHeight: '1.5', maxWidth: '280px', margin: '0 auto 1rem auto' }}>
                {currentLanguage === 'hi' 
                  ? 'कृपया अन्य कीवर्ड खोजें या ऊपर किसी दूसरी श्रेणी का चयन करें।' 
                  : 'Try searching with different keywords or select another category above.'
                }
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="btn btn-outline"
                  style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
                >
                  {currentLanguage === 'hi' ? 'खोज साफ़ करें' : 'Clear search query'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Drawer Bottom Utility Bar */}
        <div className="search-drawer-footer">
          <button
            onClick={() => {
              if (onSelectCategory) {
                onSelectCategory('all');
              }
              onClose();
            }}
            className="search-drawer-viewall-btn"
          >
            <span>{currentLanguage === 'hi' ? 'सम्पूर्ण लाइब्रेरी होम पर जाएं' : 'Browse Entire News Library'}</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

