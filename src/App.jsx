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
import { Clock, Eye, Sparkles, TrendingUp, Flame, ShieldCheck, Volume2, Pause, Play } from 'lucide-react';

export default function App() {
  const [theme, setTheme] = useState('light');
  const [isLoading, setIsLoading] = useState(true);
  const [currentRole, setCurrentRole] = useState('visitor'); // visitor | reporter | editor | admin
  const [activeView, setActiveView] = useState('home'); // home | article | reporter | editor | admin | search
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedArticle, setSelectedArticle] = useState(null);

  // Toast Notification State
  const [toastMessage, setToastMessage] = useState('');
  const [isToastOpen, setIsToastOpen] = useState(false);

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

  // Filter articles by active category
  const displayedArticles = publishedArticles.filter(art => 
    activeCategory === 'all' ? true : art.category_slug === activeCategory
  );

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
            
            {/* Lead Story & Newspaper 3-Column Grid Layout */}
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
                  <div className="story-meta">
                    <span>By {heroArticle.author?.name}</span>
                    <span>• {heroArticle.published_at}</span>
                    <span>• {heroArticle.reading_time_mins} min read</span>
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
                      <div className="story-meta">
                        <span>{art.published_at}</span>
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
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: '0.2rem' }}>{art.views_count ? `${art.views_count.toLocaleString()} views` : '8.9K reads'} • {art.published_at}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-subtle)' }}>
                No stories published in this category yet.
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
                    </div>
                  ))}
                </div>
              </div>
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
            onUpdateCategories={setCategories}
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
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', maxWidth: '420px', lineHeight: '1.6' }}>
                An independent, zero-cost digital news platform built on open technologies, human editorial integrity, and transparent reporting.
              </p>
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
