import React, { useState, useEffect } from 'react';
import Header from './components/common/Header';
import LoadingSplash from './components/common/LoadingSplash';
import ToastNotice from './components/common/ToastNotice';
import ArticleReader from './components/public/ArticleReader';
import ReporterWorkspace from './components/reporter/ReporterWorkspace';
import EditorWorkspace from './components/editor/EditorWorkspace';
import AdminWorkspace from './components/admin/AdminWorkspace';
import SearchPage from './components/public/SearchPage';
import { MOCK_ARTICLES, MOCK_CATEGORIES } from './services/mockData';
import { getCachedNews, saveNewsToCache, getCachedCategories, saveCategoriesToCache } from './services/cacheService';
import { translateArticle, translateHeadlinesOnly, SUPPORTED_LANGUAGES } from './services/translationService';
import { speakTextWithNaturalVoice, stopAudioSpeech } from './services/speechEngine';
import { Clock, Eye, Sparkles, TrendingUp, Flame, ShieldCheck, Volume2, Pause, Play, Heart, Bookmark, Send, Share2 } from 'lucide-react';

const WhatsAppIcon = ({ size = 18, color = '#ffffff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
  </svg>
);

const InstagramIcon = ({ size = 18, color = '#ffffff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
  </svg>
);

const FacebookIcon = ({ size = 18, color = '#ffffff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
  </svg>
);

const XTwitterIcon = ({ size = 18, color = '#ffffff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

export default function App() {
  const [theme, setTheme] = useState('light');
  const [isLoading, setIsLoading] = useState(true);
  const [currentRole, setCurrentRole] = useState('visitor'); // visitor | reporter | editor | admin
  const [activeView, setActiveView] = useState('home'); // home | article | reporter | editor | admin | search
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedArticle, setSelectedArticle] = useState(null);

  // Toast & Bookmark State
  const [toastMessage, setToastMessage] = useState('');
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [bookmarkRefresh, setBookmarkRefresh] = useState(0);

  // Dynamic Configurable Social Channel URLs
  const DEFAULT_SOCIAL_LINKS = {
    whatsapp: 'https://whatsapp.com',
    instagram: 'https://instagram.com',
    facebook: 'https://facebook.com',
    twitter: 'https://x.com'
  };

  const [socialLinks, setSocialLinks] = useState(() => {
    try {
      const cached = localStorage.getItem('ps_social_links');
      return cached ? JSON.parse(cached) : DEFAULT_SOCIAL_LINKS;
    } catch (e) {
      return DEFAULT_SOCIAL_LINKS;
    }
  });

  const handleUpdateSocialLinks = (updatedLinks) => {
    setSocialLinks(updatedLinks);
    localStorage.setItem('ps_social_links', JSON.stringify(updatedLinks));

    fetch('http://localhost:5000/api/settings/social', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedLinks)
    })
    .then(res => res.json())
    .then(data => {
      console.log('Backend Social Links persisted:', data);
    })
    .catch(err => console.error('Error persisting social links to backend:', err));

    setToastMessage('Social Media Channel URLs saved to Backend Server! 🚀');
    setIsToastOpen(true);
  };

  const handleUpdateCategories = (updatedCategories) => {
    setCategories(updatedCategories);
    saveCategoriesToCache(updatedCategories);

    fetch('http://localhost:5000/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedCategories)
    })
    .then(res => res.json())
    .then(data => {
      console.log('Backend Categories persisted:', data);
    })
    .catch(err => console.error('Error persisting categories to backend:', err));
  };

  // Initial sync from backend server for social links & categories
  useEffect(() => {
    fetch('http://localhost:5000/api/settings/social')
      .then(res => res.json())
      .then(data => {
        if (data && typeof data === 'object' && Object.keys(data).length > 0) {
          setSocialLinks(data);
          localStorage.setItem('ps_social_links', JSON.stringify(data));
        }
      })
      .catch(err => console.warn('[Backend Sync] Social links offline fallback:', err.message));

    fetch('http://localhost:5000/api/categories')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setCategories(data);
          saveCategoriesToCache(data);
        }
      })
      .catch(err => console.warn('[Backend Sync] Categories offline fallback:', err.message));
  }, []);

  const getFormattedWhatsAppLink = (input) => {
    if (!input) return 'https://whatsapp.com';
    const trimmed = input.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    const digitsOnly = trimmed.replace(/[^\d]/g, '');
    return digitsOnly ? `https://wa.me/${digitsOnly}` : 'https://whatsapp.com';
  };

  const getFormattedInstagramLink = (input) => {
    if (!input) return 'https://instagram.com';
    const trimmed = input.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    const handle = trimmed.replace(/^@/, '');
    return handle ? `https://instagram.com/${handle}` : 'https://instagram.com';
  };

  const getFormattedFacebookLink = (input) => {
    if (!input) return 'https://facebook.com';
    const trimmed = input.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;

    // Check if input is a phone number or numeric ID (e.g. +919876543210, 9876543210, +91 98765 43210)
    const digitsOnly = trimmed.replace(/[^\d]/g, '');
    const isPhoneOrNumeric = /^[\+\d\s\-()]+$/.test(trimmed) && digitsOnly.length >= 7;

    if (isPhoneOrNumeric) {
      return `https://facebook.com/${digitsOnly}`;
    }

    const handle = trimmed.replace(/^@/, '');
    return handle ? `https://facebook.com/${handle}` : 'https://facebook.com';
  };

  const getFormattedTwitterLink = (input) => {
    if (!input) return 'https://x.com';
    const trimmed = input.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    const handle = trimmed.replace(/^@/, '');
    return handle ? `https://x.com/${handle}` : 'https://x.com';
  };

  // Global Taxonomy Categories State
  const [categories, setCategories] = useState(() => {
    return getCachedCategories() || MOCK_CATEGORIES;
  });

  useEffect(() => {
    saveCategoriesToCache(categories);
  }, [categories]);

  // Multi-Language State (Default: English 'en')
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [isTranslating, setIsTranslating] = useState(false);

  // Quick 1-Click Audio Playing Card ID State
  const [playingArticleId, setPlayingArticleId] = useState(null);

  // Raw & Translated Articles State Management
  const [baseArticles, setBaseArticles] = useState(() => {
    const cached = getCachedNews();
    return cached?.articles || MOCK_ARTICLES;
  });
  const [publishedArticles, setPublishedArticles] = useState(baseArticles);
  const [pendingArticles, setPendingArticles] = useState([]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Save base articles to local cache
  useEffect(() => {
    saveNewsToCache(baseArticles);
  }, [baseArticles]);

  // Translate headlines only on front page when language changes
  useEffect(() => {
    let isSubscribed = true;

    async function applyHeadlineTranslation() {
      if (currentLanguage === 'en') {
        setPublishedArticles(baseArticles);
        return;
      }

      setIsTranslating(true);
      try {
        const translatedHeadlines = await translateHeadlinesOnly(baseArticles, currentLanguage);
        if (isSubscribed) {
          setPublishedArticles(translatedHeadlines);
        }

        const langObj = SUPPORTED_LANGUAGES.find(l => l.code === currentLanguage || l.code.toLowerCase() === currentLanguage.toLowerCase());
        const langName = langObj ? (langObj.native || langObj.name) : currentLanguage;
        setToastMessage(`Headlines translated to ${langName}. Open any article for full translation.`);
        setIsToastOpen(true);
      } catch (err) {
        console.error('Headline translation error:', err);
      } finally {
        if (isSubscribed) setIsTranslating(false);
      }
    }

    applyHeadlineTranslation();

    return () => {
      isSubscribed = false;
    };
  }, [currentLanguage, baseArticles]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleSelectArticle = async (art) => {
    setSelectedArticle(art);
    setActiveView('article');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 1-Click Quick Audio Reading Trigger for Homepage Cards
  const handleQuickAudioRead = (e, article) => {
    e.stopPropagation();

    if (playingArticleId === article.id) {
      stopAudioSpeech();
      setPlayingArticleId(null);
    } else {
      stopAudioSpeech();
      const textToRead = `${article.title}. ${article.summary || article.content}`;
      setPlayingArticleId(article.id);

      speakTextWithNaturalVoice({
        text: textToRead,
        langCode: currentLanguage,
        articleId: article.id,
        onStart: () => setPlayingArticleId(article.id),
        onPlay: () => setPlayingArticleId(article.id),
        onEnd: () => setPlayingArticleId(null)
      });
    }
  };

  // Reporter submits a new draft
  const handleAddNewArticle = (newArticle) => {
    setPendingArticles([newArticle, ...pendingArticles]);
  };

  // Editor approves story
  const handleApproveArticle = (articleId, updatedTitle, isBreaking) => {
    const target = pendingArticles.find(a => a.id === articleId);
    if (target) {
      const approvedStory = {
        ...target,
        title: updatedTitle || target.title,
        status: 'published',
        is_breaking: isBreaking,
        published_at: 'Just now'
      };

      const updatedBase = [approvedStory, ...baseArticles];
      setBaseArticles(updatedBase);
      setPendingArticles(pendingArticles.filter(a => a.id !== articleId));
    }
  };

  // Editor rejects story
  const handleRejectArticle = (articleId) => {
    setPendingArticles(pendingArticles.filter(a => a.id !== articleId));
  };

  const handleRemoveBookmark = (e, art) => {
    e.stopPropagation();
    localStorage.setItem(`ps_bookmark_${art.id}`, 'false');
    setBookmarkRefresh(prev => prev + 1);
    setToastMessage('Article removed from Bookmarks.');
    setIsToastOpen(true);
  };

  // Filter articles by active category or bookmarks
  const displayedArticles = publishedArticles.filter(art => {
    if (activeCategory === 'bookmarks') {
      // Reference bookmarkRefresh state so filter re-evaluates on bookmark toggle
      if (bookmarkRefresh < 0) return false; 
      return localStorage.getItem(`ps_bookmark_${art.id}`) === 'true';
    }
    return activeCategory === 'all' ? true : art.category_slug === activeCategory;
  });

  const heroArticle = displayedArticles[0];
  const secondaryArticles = displayedArticles.slice(1, 3);
  const remainingArticles = displayedArticles.slice(3);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Animated Loading Splash Screen */}
      {isLoading && (
        <LoadingSplash onFinished={() => setIsLoading(false)} />
      )}

      {/* Header with Masthead, Language Selector & Category Nav */}
      <Header 
        currentRole={currentRole}
        onRoleChange={setCurrentRole}
        theme={theme}
        onToggleTheme={toggleTheme}
        activeCategory={activeCategory}
        onSelectCategory={setActiveCategory}
        activeView={activeView}
        onNavigate={setActiveView}
        currentLanguage={currentLanguage}
        onLanguageChange={setCurrentLanguage}
        isTranslating={isTranslating}
        categories={categories}
      />

      {/* Main Content Area */}
      <main style={{ flex: 1 }}>
        {/* PUBLIC HOME PAGE */}
        {activeView === 'home' && (
          <div className="container" style={{ padding: '1.5rem 1.25rem' }}>
            
            {/* DEDICATED BOOKMARKS VIEW */}
            {activeCategory === 'bookmarks' ? (
              <div style={{ padding: '1rem 0 3rem 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', borderBottom: '2px solid #f59e0b', paddingBottom: '0.75rem' }}>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-main)', margin: 0 }}>
                    <Bookmark size={24} color="#f59e0b" fill="#f59e0b" /> Your Saved Bookmarks ({displayedArticles.length})
                  </h2>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Saved locally in your browser
                  </span>
                </div>

                {displayedArticles.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '2rem' }}>
                    {displayedArticles.map((art) => (
                      <div key={art.id} className="story-card-secondary" onClick={() => handleSelectArticle(art)} style={{ cursor: 'pointer' }}>
                        <div className="img-container" style={{ height: '200px' }}>
                          <img src={art.featured_image} alt={art.title} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0.6rem 0' }}>
                          <span className="story-category-tag">{art.category}</span>
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            <button 
                              onClick={(e) => handleQuickAudioRead(e, art)}
                              className="btn btn-outline"
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', borderRadius: '20px' }}
                            >
                              {playingArticleId === art.id ? <Pause size={12} /> : <Volume2 size={12} />}
                              {playingArticleId === art.id ? 'Playing' : 'Listen 🔊'}
                            </button>
                            <button 
                              onClick={(e) => handleRemoveBookmark(e, art)}
                              className="btn"
                              style={{ padding: '0.2rem 0.65rem', fontSize: '0.7rem', borderRadius: '20px', background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: '700' }}
                              title="Remove from Bookmarks"
                            >
                              Remove ✖
                            </button>
                          </div>
                        </div>
                        <h3 className="story-card-title" style={{ fontSize: '1.1rem', fontWeight: '800', lineHeight: '1.35', marginBottom: '0.5rem' }}>{art.title}</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: '0.75rem' }}>
                          {art.excerpt}
                        </p>
                        <div className="story-meta" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                          <span>By {art.author?.name || 'Editorial Desk'}</span>
                          <span>• <Eye size={11} style={{ display: 'inline' }} /> {art.views_count ? art.views_count.toLocaleString() : '6.3K'}</span>
                          <span>• <Heart size={11} style={{ display: 'inline' }} fill="#ef4444" color="#ef4444" /> {art.likes_count ? art.likes_count.toLocaleString() : '720'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-subtle)', background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px dashed #f59e0b', margin: '1rem 0' }}>
                    <Bookmark size={48} color="#f59e0b" style={{ marginBottom: '0.75rem' }} />
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                      No Saved Bookmarks Yet
                    </h3>
                    <p style={{ fontSize: '0.9rem', maxWidth: '440px', margin: '0 auto', lineHeight: '1.5' }}>
                      Open any news story and click the <strong>"Bookmark"</strong> button to save it here for quick access anytime!
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* STANDARD CATEGORY & NEWSPAPER 3-COLUMN LAYOUT */
              <>
                {heroArticle ? (
                  <div className="news-grid-lead">
                    {/* Main Hero Column */}
                    <div className="story-card-hero" onClick={() => handleSelectArticle(heroArticle)} style={{ cursor: 'pointer' }}>
                      <div className="img-container">
                        <img src={heroArticle.featured_image} alt={heroArticle.title} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <span className="story-category-tag">{heroArticle.category}</span>
                          {heroArticle.is_breaking && (
                            <span className="badge badge-live"><Flame size={12} /> Breaking Lead</span>
                          )}
                          <span className="badge badge-verified"><ShieldCheck size={12} /> Verified</span>
                        </div>

                        {/* 1-Click Audio Reader Trigger */}
                        <button 
                          onClick={(e) => handleQuickAudioRead(e, heroArticle)}
                          className="btn btn-outline"
                          style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', borderRadius: '20px' }}
                          title="1-Click Listen to Story"
                        >
                          {playingArticleId === heroArticle.id ? <Pause size={13} color="var(--accent-crimson)" /> : <Volume2 size={13} color="var(--accent-crimson)" />}
                          {playingArticleId === heroArticle.id ? 'Playing' : 'Listen 🔊'}
                        </button>
                      </div>

                      <h2 className="story-card-title">{heroArticle.title}</h2>
                      <div className="story-meta" style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span>By {heroArticle.author?.name}</span>
                        <span>• {heroArticle.published_at}</span>
                        <span style={{ color: 'var(--accent-crimson)', fontWeight: '600' }}>• <Eye size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> {heroArticle.views_count ? heroArticle.views_count.toLocaleString() : '14.2K'} views</span>
                        <span style={{ color: '#ef4444', fontWeight: '600' }}>• <Heart size={12} style={{ display: 'inline', verticalAlign: 'middle' }} fill="#ef4444" /> {heroArticle.likes_count ? heroArticle.likes_count.toLocaleString() : '1.8K'} likes</span>
                      </div>
                    </div>

                    {/* Secondary Column */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {secondaryArticles.map((art) => (
                        <div key={art.id} className="story-card-secondary" onClick={() => handleSelectArticle(art)} style={{ cursor: 'pointer' }}>
                          <div className="img-container" style={{ height: '170px' }}>
                            <img src={art.featured_image} alt={art.title} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="story-category-tag">{art.category}</span>
                            <button 
                              onClick={(e) => handleQuickAudioRead(e, art)}
                              className="btn btn-outline"
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', borderRadius: '20px' }}
                            >
                              {playingArticleId === art.id ? <Pause size={12} /> : <Volume2 size={12} />}
                              {playingArticleId === art.id ? 'Playing' : 'Listen 🔊'}
                            </button>
                          </div>
                          <h3 className="story-card-title">{art.title}</h3>
                          <div className="story-meta" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                            <span>{art.published_at}</span>
                            <span>• <Eye size={11} style={{ display: 'inline' }} /> {art.views_count ? art.views_count.toLocaleString() : '8.9K'}</span>
                            <span>• <Heart size={11} style={{ display: 'inline' }} fill="#ef4444" color="#ef4444" /> {art.likes_count ? art.likes_count.toLocaleString() : '950'}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Opinion & Trending Column */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      <div className="opinion-box">
                        <div className="opinion-header">
                          <Sparkles size={15} /> Editor's Spotlight
                        </div>
                        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', fontWeight: '800', lineHeight: '1.35', cursor: 'pointer', marginBottom: '0.75rem' }} onClick={() => handleSelectArticle(publishedArticles[3] || heroArticle)}>
                          {(publishedArticles[3] || heroArticle)?.title}
                        </h3>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', fontWeight: '600' }}>
                          By {(publishedArticles[3] || heroArticle)?.author?.name || 'Kabir Roy, Editor-in-Chief'}
                        </div>
                      </div>

                      <div className="trending-widget">
                        <h4 style={{ fontSize: '0.85rem', fontWeight: '900', textTransform: 'uppercase', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-crimson)', letterSpacing: '0.08em' }}>
                          <TrendingUp size={16} /> Top Trending Stories
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {publishedArticles.slice(1, 4).map((art, idx) => (
                            <div key={art.id} className="trending-item" onClick={() => handleSelectArticle(art)} style={{ cursor: 'pointer' }}>
                              <span className="trending-rank">0{idx + 1}</span>
                              <div>
                                <div style={{ fontSize: '0.875rem', fontWeight: '800', lineHeight: '1.3' }}>{art.title}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: '0.2rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                  <span><Eye size={11} style={{ display: 'inline' }} /> {art.views_count ? art.views_count.toLocaleString() : '8.9K'}</span>
                                  <span>• <Heart size={11} style={{ display: 'inline' }} fill="#ef4444" color="#ef4444" /> {art.likes_count ? art.likes_count.toLocaleString() : '950'}</span>
                                  <span>• {art.published_at}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-subtle)', background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border-medium)', margin: '2rem 0' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                      No Stories Found
                    </h3>
                    <p style={{ fontSize: '0.9rem', maxWidth: '440px', margin: '0 auto', lineHeight: '1.5' }}>
                      No stories published in this category yet.
                    </p>
                  </div>
                )}

                {/* Remaining Grid Stories */}
                {remainingArticles.length > 0 && (
                  <div style={{ padding: '2.5rem 0' }}>
                    <h3 className="headline" style={{ fontSize: '1.75rem', fontWeight: '900', marginBottom: '1.75rem', borderBottom: '2px solid var(--border-dark)', paddingBottom: '0.6rem' }}>
                      Verified Editorial Stream
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '2rem' }}>
                      {remainingArticles.map((art) => (
                        <div key={art.id} className="story-card-secondary" onClick={() => handleSelectArticle(art)} style={{ cursor: 'pointer' }}>
                          <div className="img-container" style={{ height: '200px' }}>
                            <img src={art.featured_image} alt={art.title} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="story-category-tag">{art.category}</span>
                            <button 
                              onClick={(e) => handleQuickAudioRead(e, art)}
                              className="btn btn-outline"
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', borderRadius: '20px' }}
                            >
                              {playingArticleId === art.id ? <Pause size={12} /> : <Volume2 size={12} />}
                              {playingArticleId === art.id ? 'Playing' : 'Listen 🔊'}
                            </button>
                          </div>
                          <h3 className="story-card-title">{art.title}</h3>
                          <div className="story-meta" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginTop: '0.4rem' }}>
                            <span><Eye size={12} style={{ display: 'inline' }} /> {art.views_count ? art.views_count.toLocaleString() : '6.3K'} views</span>
                            <span>• <Heart size={12} style={{ display: 'inline' }} fill="#ef4444" color="#ef4444" /> {art.likes_count ? art.likes_count.toLocaleString() : '720'} likes</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ARTICLE DETAIL READER VIEW */}
        {activeView === 'article' && (
          <ArticleReader 
            article={selectedArticle} 
            onBack={() => setActiveView('home')} 
            onSelectArticle={handleSelectArticle}
            currentLanguage={currentLanguage}
            onShowToast={(msg) => { setToastMessage(msg); setIsToastOpen(true); }}
          />
        )}

        {/* SEARCH PAGE VIEW */}
        {activeView === 'search' && (
          <SearchPage 
            articles={publishedArticles}
            onSelectArticle={handleSelectArticle}
            onBack={() => setActiveView('home')}
          />
        )}

        {/* WORKSPACE DESKS */}
        {activeView === 'reporter' && (
          <ReporterWorkspace onAddNewArticle={handleAddNewArticle} />
        )}

        {activeView === 'editor' && (
          <EditorWorkspace 
            pendingArticles={pendingArticles}
            onApproveArticle={handleApproveArticle}
            onRejectArticle={handleRejectArticle}
          />
        )}

        {activeView === 'admin' && (
          <AdminWorkspace 
            categories={categories}
            onUpdateCategories={handleUpdateCategories}
            socialLinks={socialLinks}
            onUpdateSocialLinks={handleUpdateSocialLinks}
          />
        )}
      </main>

      {/* Toast Notice Notification */}
      <ToastNotice 
        message={toastMessage} 
        isOpen={isToastOpen} 
        onClose={() => setIsToastOpen(false)} 
      />

      {/* Footer */}
      <footer style={{ background: 'var(--bg-surface)', borderTop: '3px double var(--border-dark)', padding: '3rem 0 1.5rem 0', marginTop: '4rem' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
            <div>
              <img src="/logo.png" alt="PUBLIC SPARK Logo" style={{ height: '60px', width: 'auto', objectFit: 'contain', marginBottom: '0.75rem' }} />
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', maxWidth: '420px', lineHeight: '1.6', marginBottom: '1.25rem' }}>
                An independent, zero-cost digital news platform built on open technologies, human editorial integrity, and transparent reporting.
              </p>

              {/* Official Social Media Channel Icons */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                {/* WhatsApp */}
                <a 
                  href={getFormattedWhatsAppLink(socialLinks.whatsapp)} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    width: '38px', 
                    height: '38px', 
                    borderRadius: '50%', 
                    background: '#25D366', 
                    color: '#ffffff', 
                    boxShadow: '0 2px 8px rgba(37, 211, 102, 0.3)',
                    transition: 'transform 0.2s ease',
                    textDecoration: 'none'
                  }}
                  title="Follow on WhatsApp"
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-3px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <WhatsAppIcon size={18} color="#ffffff" />
                </a>

                {/* Instagram */}
                <a 
                  href={getFormattedInstagramLink(socialLinks.instagram)} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    width: '38px', 
                    height: '38px', 
                    borderRadius: '50%', 
                    background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)', 
                    color: '#ffffff', 
                    boxShadow: '0 2px 8px rgba(220, 39, 67, 0.3)',
                    transition: 'transform 0.2s ease',
                    textDecoration: 'none'
                  }}
                  title="Follow on Instagram"
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-3px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <InstagramIcon size={18} color="#ffffff" />
                </a>

                {/* Facebook */}
                <a 
                  href={getFormattedFacebookLink(socialLinks.facebook)} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    width: '38px', 
                    height: '38px', 
                    borderRadius: '50%', 
                    background: '#1877F2', 
                    color: '#ffffff', 
                    boxShadow: '0 2px 8px rgba(24, 119, 242, 0.3)',
                    transition: 'transform 0.2s ease',
                    textDecoration: 'none'
                  }}
                  title="Follow on Facebook"
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-3px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <FacebookIcon size={18} color="#ffffff" />
                </a>

                {/* X (Twitter) */}
                <a 
                  href={getFormattedTwitterLink(socialLinks.twitter)} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    width: '38px', 
                    height: '38px', 
                    borderRadius: '50%', 
                    background: '#000000', 
                    color: '#ffffff', 
                    border: '1px solid var(--border-medium)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                    transition: 'transform 0.2s ease',
                    textDecoration: 'none'
                  }}
                  title="Follow on X (Twitter)"
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-3px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <XTwitterIcon size={18} color="#ffffff" />
                </a>
              </div>
            </div>
            <div>
              <h4 style={{ fontSize: '0.85rem', fontWeight: '900', textTransform: 'uppercase', color: 'var(--text-subtle)', marginBottom: '0.85rem', letterSpacing: '0.08em' }}>
                Editorial Desks
              </h4>
              <ul style={{ listStyle: 'none', fontSize: '0.875rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <li>India Desk</li>
                <li>Technology Desk</li>
                <li>Climate & Environment</li>
                <li>Opinion & Analysis</li>
              </ul>
            </div>
            <div>
              <h4 style={{ fontSize: '0.85rem', fontWeight: '900', textTransform: 'uppercase', color: 'var(--text-subtle)', marginBottom: '0.85rem', letterSpacing: '0.08em' }}>
                About Newsroom
              </h4>
              <ul style={{ listStyle: 'none', fontSize: '0.875rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <li>About PublicSpark</li>
                <li>Editorial Code of Ethics</li>
                <li>Fact-Check Policy</li>
                <li>Contact Editorial Desk</li>
              </ul>
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1.25rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-subtle)' }}>
            © 2026 PublicSpark Newsroom Platform. All rights reserved. Built with precision for human journalism.
          </div>
        </div>
      </footer>
    </div>
  );
}
