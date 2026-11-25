import React, { useMemo, useRef } from 'react';
import { ArrowRight, Clock, Volume2, Pause, Play, Radio, Newspaper, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { t, translateCategoryName } from '../../services/uiTranslations';
import { calculateReadingTime } from '../../utils/readingTime';
import { formatPublishedTime } from '../../utils/dateFormatter';

/**
 * PublicSpark Newsroom Library — Dynamic Category Shelves Engine (Task 39 Subtopic B)
 * Organizes published stories into distinct, structured "Bookshelves" per category.
 * 100% dynamically mapped from categories taxonomy and published articles.
 * Zero hardcoded mock boxes: empty categories automatically hide.
 */
export default function CategoryShelvesSection({
  categories = [],
  articles = [],
  currentLanguage = 'hi',
  onSelectArticle,
  onSelectCategory,
  onQuickAudioRead,
  playingArticleId
}) {
  const railRefs = useRef({});

  const handleScrollRail = (shelfSlug, direction) => {
    const el = railRefs.current[shelfSlug];
    if (el) {
      const scrollDistance = Math.max(el.clientWidth * 0.75, 280);
      el.scrollBy({
        left: direction === 'left' ? -scrollDistance : scrollDistance,
        behavior: 'smooth'
      });
    }
  };

  // Dynamically map categories with their published stories; auto-hide empty categories
  const populatedShelves = useMemo(() => {
    if (!categories || categories.length === 0 || !articles || articles.length === 0) return [];

    return categories.map(cat => {
      const catArticles = articles.filter(art => {
        // Public reader embargo guard
        if (art.status !== 'published') return false;

        const normArtSlug = (art.category_slug || '').trim().toLowerCase();
        const normArtCat = (art.category || '').trim().toLowerCase();
        const normCatSlug = (cat.slug || '').trim().toLowerCase();
        const normCatName = (cat.name || '').trim().toLowerCase();

        return (
          normArtSlug === normCatSlug ||
          normArtCat === normCatSlug ||
          normArtCat === normCatName
        );
      });

      return {
        id: cat.id || cat.slug,
        name: cat.name,
        slug: cat.slug,
        articles: catArticles
      };
    }).filter(shelf => shelf.articles.length > 0);
  }, [categories, articles]);

  if (populatedShelves.length === 0) {
    return null;
  }

  return (
    <section 
      className="newsroom-library-shelves-container"
      aria-label={currentLanguage === 'hi' ? 'समाचार लाइब्रेरी शेल्व्स' : 'Newsroom Category Shelves'}
    >
      {/* Section Global Super-Header */}
      <div className="library-shelves-master-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div className="library-shelves-icon-badge">
            <BookOpen size={18} color="var(--accent-crimson)" />
          </div>
          <div>
            <h2 className="library-shelves-master-title">
              {t('newsroomLibraryTitle', currentLanguage)}
            </h2>
            <p className="library-shelves-master-subtitle">
              {t('newsroomLibrarySubtitle', currentLanguage)}
            </p>
          </div>
        </div>

        <div className="library-shelves-stats-pill">
          <span>{populatedShelves.length} {t('activeShelves', currentLanguage)}</span>
        </div>
      </div>

      {/* Render each dynamic category shelf */}
      {populatedShelves.map((shelf) => {
        const shelfName = translateCategoryName(shelf.name, currentLanguage);
        const storyCount = shelf.articles.length;
        const leadStory = shelf.articles[0];
        const secondaryStories = shelf.articles.slice(1);

        return (
          <div key={shelf.slug || shelf.id} className="newsroom-library-shelf">
            {/* Shelf Header */}
            <div className="library-shelf-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <span className="library-shelf-accent-bar" aria-hidden="true" />
                <h3 className="library-shelf-title">
                  {shelfName}
                </h3>
                <span className="library-shelf-count-chip">
                  {storyCount} {storyCount === 1 ? t('singleStoryCount', currentLanguage) : t('storiesCount', currentLanguage)}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                {storyCount > 2 && (
                  <div className="library-shelf-nav-arrows">
                    <button
                      type="button"
                      onClick={() => handleScrollRail(shelf.slug, 'left')}
                      className="library-shelf-nav-btn"
                      title={t('scrollLeft', currentLanguage)}
                      aria-label="Scroll left"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleScrollRail(shelf.slug, 'right')}
                      className="library-shelf-nav-btn"
                      title={t('scrollRight', currentLanguage)}
                      aria-label="Scroll right"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}

                <button
                  onClick={() => onSelectCategory && onSelectCategory(shelf.slug)}
                  className="library-shelf-viewall-btn"
                  aria-label={`View all stories in ${shelfName}`}
                >
                  <span>{currentLanguage === 'hi' ? `${shelfName} ${t('allInShelf', currentLanguage)}` : `${t('allInShelf', currentLanguage)} ${shelfName}`}</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>

            {/* Shelf Content Layout based on article density */}
            {storyCount === 1 ? (
              /* Single Story: Prominent Wide Horizontal Feature Card */
              <div 
                className="library-shelf-single-lead"
                onClick={() => onSelectArticle && onSelectArticle(leadStory)}
              >
                <div className="library-single-thumb-wrap">
                  {leadStory.featured_image ? (
                    <img 
                      src={leadStory.featured_image} 
                      alt={leadStory.title} 
                      loading="lazy"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="library-thumb-placeholder">
                      <Newspaper size={36} />
                    </div>
                  )}
                  {leadStory.format === 'live' && (
                    <span className="library-badge-live">
                      <Radio size={10} /> {(leadStory.live_status || 'active') === 'active' ? 'LIVE' : 'CONCLUDED'}
                    </span>
                  )}
                </div>

                <div className="library-single-content">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <span className="story-category-tag">
                      {shelfName}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {leadStory.video_url && (
                        <span className="library-video-badge">
                          <Play size={10} fill="#fff" /> Video
                        </span>
                      )}
                      {onQuickAudioRead && (
                        <button
                          onClick={(e) => onQuickAudioRead(e, leadStory)}
                          className="btn btn-outline library-audio-btn"
                          title="Listen to story audio"
                        >
                          {playingArticleId === leadStory.id ? <Pause size={12} /> : <Volume2 size={12} />}
                          <span>{playingArticleId === leadStory.id ? t('playing', currentLanguage) : t('listen', currentLanguage)}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <h4 className="library-single-title">
                    {leadStory.title}
                  </h4>

                  {leadStory.summary && (
                    <p className="library-single-summary">
                      {leadStory.summary}
                    </p>
                  )}

                  <div className="story-meta library-card-meta">
                    <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>
                      {leadStory.author?.name || 'PublicSpark Desk'}
                    </span>
                    <span>•</span>
                    <span>{formatPublishedTime(leadStory.published_at, currentLanguage)}</span>
                    <span>•</span>
                    <span>
                      <Clock size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '2px' }} />
                      {leadStory.reading_time_mins || calculateReadingTime(leadStory.content || '', currentLanguage)?.minutes || 1} {t('minsRead', currentLanguage)}
                    </span>
                  </div>
                </div>
              </div>
            ) : storyCount >= 2 && storyCount <= 3 ? (
              /* 2 to 3 Stories: Split Broadsheet Layout (1 Main Lead + Stacked Side Stories) */
              <div className="library-shelf-split-layout">
                {/* Left: Main Lead Story */}
                <div 
                  className="library-shelf-split-lead"
                  onClick={() => onSelectArticle && onSelectArticle(leadStory)}
                >
                  <div className="library-split-thumb-wrap">
                    {leadStory.featured_image ? (
                      <img 
                        src={leadStory.featured_image} 
                        alt={leadStory.title} 
                        loading="lazy"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="library-thumb-placeholder">
                        <Newspaper size={32} />
                      </div>
                    )}
                    {leadStory.format === 'live' && (
                      <span className="library-badge-live">
                        <Radio size={10} /> {(leadStory.live_status || 'active') === 'active' ? 'LIVE' : 'CONCLUDED'}
                      </span>
                    )}
                  </div>
                  <div className="library-split-lead-body">
                    <span className="story-category-tag">{shelfName}</span>
                    <h4 className="library-split-lead-title">{leadStory.title}</h4>
                    {leadStory.summary && (
                      <p className="library-split-lead-summary">{leadStory.summary}</p>
                    )}
                    <div className="story-meta library-card-meta">
                      <span>{leadStory.author?.name || 'PublicSpark Desk'}</span>
                      <span>•</span>
                      <span>{formatPublishedTime(leadStory.published_at, currentLanguage)}</span>
                      <span>•</span>
                      <span>
                        <Clock size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '2px' }} />
                        {leadStory.reading_time_mins || calculateReadingTime(leadStory.content || '', currentLanguage)?.minutes || 1} {t('minsRead', currentLanguage)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Stacked Side Stories */}
                <div className="library-shelf-split-side">
                  {secondaryStories.map((art) => (
                    <div 
                      key={art.id} 
                      className="library-shelf-side-card"
                      onClick={() => onSelectArticle && onSelectArticle(art)}
                    >
                      <div className="library-side-thumb">
                        {art.featured_image ? (
                          <img 
                            src={art.featured_image} 
                            alt={art.title} 
                            loading="lazy"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        ) : (
                          <div className="library-thumb-placeholder-sm">
                            <Newspaper size={18} />
                          </div>
                        )}
                      </div>
                      <div className="library-side-content">
                        <span className="story-category-tag">{shelfName}</span>
                        <h5 className="library-side-title">{art.title}</h5>
                        <div className="story-meta" style={{ fontSize: '0.7rem' }}>
                          <span>{art.author?.name || 'PublicSpark Desk'}</span>
                          <span>•</span>
                          <span>{formatPublishedTime(art.published_at, currentLanguage)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* 4+ Stories: Smooth Horizontal Scrolling Rail */
              <div 
                ref={el => { railRefs.current[shelf.slug] = el; }}
                className="library-shelf-scroll-rail"
                tabIndex={0}
                role="region"
                aria-label={`${shelfName} stories rail`}
              >
                {shelf.articles.map((art) => (
                  <div 
                    key={art.id} 
                    className="story-card-secondary library-shelf-scroll-card"
                    onClick={() => onSelectArticle && onSelectArticle(art)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="secondary-card-img-wrap">
                      <div className="img-container">
                        {art.featured_image ? (
                          <img 
                            src={art.featured_image} 
                            alt={art.title} 
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              const ph = e.currentTarget.parentElement?.querySelector('.library-thumb-placeholder');
                              if (ph) ph.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div 
                          className="library-thumb-placeholder"
                          style={{ display: art.featured_image ? 'none' : 'flex' }}
                        >
                          <Newspaper size={24} color="var(--text-subtle)" />
                        </div>
                      </div>
                    </div>
                    <div className="secondary-card-content">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                        <span className="story-category-tag">{shelfName}</span>
                        {art.video_url && (
                          <span className="library-video-badge">
                            <Play size={10} fill="#fff" /> Video
                          </span>
                        )}
                      </div>
                      <h4 className="story-card-title">{art.title}</h4>
                      <div className="story-meta" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginTop: 'auto' }}>
                        <span>{art.author?.name || 'Staff Reporter'}</span>
                        <span>•</span>
                        <span>{formatPublishedTime(art.published_at, currentLanguage)}</span>
                        <span>•</span>
                        <span>
                          <Clock size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> {art.reading_time_mins || calculateReadingTime(art.content || '', currentLanguage)?.minutes || 1} {t('minsRead', currentLanguage)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

