import React, { useState, useEffect, useCallback } from 'react';
import { Bookmark, X, Trash2, Clock, CheckCircle, Newspaper, HardDrive, ArrowRight, AlertTriangle, BookOpen } from 'lucide-react';
import { 
  getOfflineArticles, 
  removeArticleOffline, 
  clearAllOfflineArticles, 
  getOfflineStorageMetrics 
} from '../../services/bookmarkStorageService';
import { t, translateCategoryName } from '../../services/uiTranslations';
import { calculateReadingTime } from '../../utils/readingTime';

/**
 * PublicSpark Newsroom — Dedicated Saved Stories Reading Drawer (Task 28 Subtopic B)
 * Sovereign offline slide-out drawer providing 100% network-independent reading access,
 * live storage health telemetry, and instant 1-tap read/remove controls.
 */
export default function SavedStoriesDrawer({
  isOpen,
  onClose,
  onSelectArticle,
  onViewAllBookmarks,
  currentLanguage = 'hi'
}) {
  const [savedArticles, setSavedArticles] = useState([]);
  const [storageMetrics, setStorageMetrics] = useState({ count: 0, formattedSize: '0 KB', maxStories: 50 });
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Synchronize saved articles and storage metrics from localStorage
  const refreshSavedArticles = useCallback(() => {
    const list = getOfflineArticles();
    setSavedArticles(list);
    setStorageMetrics(getOfflineStorageMetrics());
  }, []);

  // Hydrate on mount & whenever drawer opens
  useEffect(() => {
    if (isOpen) {
      refreshSavedArticles();
      setShowClearConfirm(false);
    }
  }, [isOpen, refreshSavedArticles]);

  // Reactive listener: automatically update drawer when bookmarks change in reader or feed
  useEffect(() => {
    const handleBookmarkChange = () => {
      refreshSavedArticles();
    };

    window.addEventListener('ps_offline_bookmarks_changed', handleBookmarkChange);
    return () => {
      window.removeEventListener('ps_offline_bookmarks_changed', handleBookmarkChange);
    };
  }, [refreshSavedArticles]);

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

  const handleRemoveArticle = (e, articleId) => {
    e.stopPropagation();
    removeArticleOffline(articleId);
    refreshSavedArticles();
  };

  const handleClearAll = () => {
    clearAllOfflineArticles();
    refreshSavedArticles();
    setShowClearConfirm(false);
  };

  const handleArticleClick = (art) => {
    if (onSelectArticle) {
      onSelectArticle(art);
    }
    if (onClose) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const storagePercentage = Math.min(100, Math.round((storageMetrics.count / (storageMetrics.maxStories || 50)) * 100));

  return (
    <div 
      className="saved-drawer-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="saved-drawer-title"
    >
      <div 
        className="saved-drawer-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="saved-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div className="saved-drawer-icon-wrap">
              <Bookmark size={18} color="var(--accent-crimson)" fill="var(--accent-crimson)" />
            </div>
            <div>
              <h2 id="saved-drawer-title" className="saved-drawer-title">
                {t('savedBookmarks', currentLanguage) || 'Saved Stories'}
              </h2>
              <span className="saved-drawer-count-badge">
                {savedArticles.length} {savedArticles.length === 1 ? 'story' : 'stories'} saved
              </span>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="saved-drawer-close-btn"
            aria-label="Close Saved Stories Drawer"
            title="Close Drawer (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Offline Status & Storage Health Bar */}
        <div className="saved-drawer-metrics-box">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
            <span className="saved-drawer-offline-pill">
              <CheckCircle size={13} color="var(--accent-emerald)" />
              <span>100% Offline Ready</span>
            </span>
            <span className="saved-drawer-storage-text">
              <HardDrive size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.25rem' }} />
              {storageMetrics.formattedSize} • {storageMetrics.count}/{storageMetrics.maxStories || 50}
            </span>
          </div>

          {/* Quota Progress Bar */}
          <div className="saved-drawer-progress-track">
            <div 
              className="saved-drawer-progress-fill"
              style={{ width: `${Math.max(4, storagePercentage)}%` }}
            />
          </div>

          {/* Clear All Action Bar */}
          {savedArticles.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.55rem', paddingTop: '0.45rem', borderTop: '1px solid var(--border-light)' }}>
              {showClearConfirm ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.725rem', color: 'var(--accent-crimson)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <AlertTriangle size={12} /> Clear all offline stories?
                  </span>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button 
                      onClick={handleClearAll}
                      className="saved-drawer-confirm-btn"
                    >
                      Yes, Clear
                    </button>
                    <button 
                      onClick={() => setShowClearConfirm(false)}
                      className="saved-drawer-cancel-btn"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)' }}>
                    Saved snapshots persist on device disk
                  </span>
                  <button 
                    onClick={() => setShowClearConfirm(true)}
                    className="saved-drawer-clear-link"
                  >
                    Clear All
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Stories List Body */}
        <div className="saved-drawer-list">
          {savedArticles.length === 0 ? (
            <div className="saved-drawer-empty-state">
              <div className="saved-drawer-empty-icon">
                <BookOpen size={36} color="var(--accent-crimson)" />
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                {t('noSavedBookmarks', currentLanguage) || 'No Saved Stories Yet'}
              </h3>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', lineHeight: '1.6', maxWidth: '280px', margin: '0 auto 1.25rem auto' }}>
                {t('noSavedBookmarksDesc', currentLanguage) || 'Tap the bookmark icon on any news story to save full articles here for reading offline anytime.'}
              </p>
              <button 
                onClick={onClose}
                className="btn btn-outline"
                style={{ padding: '0.45rem 1rem', fontSize: '0.8rem', borderRadius: 'var(--radius-sm)' }}
              >
                Browse News Stories
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {savedArticles.map((art) => {
                const readingTime = art.reading_time_mins || calculateReadingTime(art.content || '', currentLanguage);

                return (
                  <div 
                    key={art.id}
                    className="saved-drawer-card"
                    onClick={() => handleArticleClick(art)}
                  >
                    {/* Thumbnail */}
                    <div className="saved-card-thumb-wrap">
                      {art.featured_image ? (
                        <img 
                          src={art.featured_image} 
                          alt={art.title}
                          loading="lazy"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : (
                        <div className="saved-card-thumb-fallback">
                          <Newspaper size={20} color="var(--text-subtle)" />
                        </div>
                      )}
                    </div>

                    {/* Story Content */}
                    <div className="saved-card-body">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.4rem', marginBottom: '0.2rem' }}>
                        <span className="story-category-tag" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>
                          {translateCategoryName(art.category, currentLanguage)}
                        </span>
                        <button 
                          onClick={(e) => handleRemoveArticle(e, art.id)}
                          className="saved-card-remove-btn"
                          title="Remove from offline storage"
                          aria-label={`Remove ${art.title} from offline storage`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <h4 className="saved-card-title">
                        {art.title}
                      </h4>

                      <div className="saved-card-meta">
                        <span>
                          <Clock size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.2rem' }} />
                          {readingTime} {t('minsRead', currentLanguage)}
                        </span>
                        <span>•</span>
                        <span>{art.published_at || 'Recently Saved'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Drawer Footer: Bridge to Full Page View */}
        {savedArticles.length > 0 && onViewAllBookmarks && (
          <div className="saved-drawer-footer">
            <button 
              onClick={() => {
                onClose();
                onViewAllBookmarks();
              }}
              className="saved-drawer-view-all-btn"
            >
              <span>View Full Broadsheet Page</span>
              <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

