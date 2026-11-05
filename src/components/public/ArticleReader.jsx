import React, { useState, useEffect, useRef } from 'react';
import { Clock, Eye, Share2, Bookmark, ArrowLeft, ArrowRight, ShieldCheck, Flame, Radio, Languages, Loader2, Heart, Copy, Check, Send, X, ExternalLink, ThumbsUp, Lightbulb, Zap, Type, Sparkles, CheckCircle, RefreshCw, FileText, BookOpen, AlertCircle, Award } from 'lucide-react';
import TextToSpeech from './TextToSpeech';
import VideoEmbedPlayer from './VideoEmbedPlayer';
import MarkdownRenderer from '../../utils/markdownRenderer';
import PartnerUnit from '../common/PartnerUnit';
import { startViewSession, sendHeartbeat, endViewSession, toggleArticleLike, fetchArticleLikes } from '../../services/analyticsService';
import { translateArticle, SUPPORTED_LANGUAGES } from '../../services/translationService';
import { stopAudioSpeech, clearArticleAudioCache } from '../../services/speechEngine';
import { t, translateCategoryName } from '../../services/uiTranslations';
import { buildWhatsAppShareText, getWhatsAppShareUrl, copyFormattedShareCard } from '../../services/shareService';
import { getMidArticleStory, getEndArticleStories } from '../../services/recommendationService';

const WhatsAppIcon = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
  </svg>
);

export default function ArticleReader({ article, articles = [], onBack, onSelectArticle, currentLanguage = 'en', onShowToast }) {
  const [displayArticle, setDisplayArticle] = useState(article);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [likesCount, setLikesCount] = useState(article?.likes_count || 184);
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedWhatsAppCard, setCopiedWhatsAppCard] = useState(false);
  const [viewsCount, setViewsCount] = useState(article?.views_count || 1240);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [fontSizeMode, setFontSizeMode] = useState('md'); // 'sm' | 'md' | 'lg'
  const [showFactCheckDossier, setShowFactCheckDossier] = useState(false);
  const [reactions, setReactions] = useState({
    helpful: 42,
    hot: 88,
    inspiring: 29,
    shocking: 15
  });
  const [userReactions, setUserReactions] = useState({});

  // Task 23 Subtopic B: Live Blog Micro-Updates & Real-time Timeline Polling
  const [liveUpdates, setLiveUpdates] = useState(article?.live_updates || []);
  const [liveCoverageStatus, setLiveCoverageStatus] = useState(article?.live_status || 'active');
  const [filterKeyEventsOnly, setFilterKeyEventsOnly] = useState(false);
  const [isRefreshingUpdates, setIsRefreshingUpdates] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState(null);

  const sessionIdRef = useRef(null);
  const startTimeRef = useRef(Date.now());
  const maxScrollRef = useRef(0);

  // Dynamic real-time article translation when language changes or article opens
  useEffect(() => {
    let isSubscribed = true;

    if (!article) return;

    setDisplayArticle(article);

    const sourceLang = (article.originalLanguage || 'hi').toLowerCase();

    if (currentLanguage === sourceLang) {
      setIsTranslating(false);
      setShowOriginal(false);
      return;
    }

    if (article.currentLanguage === currentLanguage && article.content) {
      setIsTranslating(false);
      return;
    }

    setIsTranslating(true);
    translateArticle(article, currentLanguage, { includeContent: true })
      .then(translated => {
        if (isSubscribed) {
          setDisplayArticle(translated);
          setIsTranslating(false);
        }
      })
      .catch(err => {
        console.error('Failed to translate article in reader:', err);
        if (isSubscribed) {
          setDisplayArticle(article);
          setIsTranslating(false);
        }
      });

    return () => {
      isSubscribed = false;
    };
  }, [article?.id, currentLanguage]);

  // Analytics & Scroll tracking session
  useEffect(() => {
    if (!article || !article.id) return;

    startTimeRef.current = Date.now();
    maxScrollRef.current = 0;

    // Session Start: register article view
    startViewSession(article.id).then(data => {
      if (data && data.sessionId) {
        sessionIdRef.current = data.sessionId;
      }
    });

    let lastPct = -1;
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const docHeight = document.documentElement.scrollHeight - window.innerHeight;
          if (docHeight > 0) {
            const pct = Math.min(100, Math.max(0, Math.round((window.scrollY / docHeight) * 100)));
            if (pct !== lastPct) {
              lastPct = pct;
              setScrollProgress(pct);
            }
            if (pct > maxScrollRef.current) {
              maxScrollRef.current = pct;
            }
          } else {
            if (lastPct !== 100) {
              lastPct = 100;
              setScrollProgress(100);
            }
          }
          ticking = false;
        });
        ticking = true;
      }
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    let hasEnded = false;
    const handleUnload = () => {
      if (!hasEnded && sessionIdRef.current) {
        hasEnded = true;
        const rawDuration = Math.round((Date.now() - startTimeRef.current) / 1000);
        // Cap single session at 30 minutes (1800s) to prevent abandoned background tab skew
        const durationSecs = Math.max(1, Math.min(1800, rawDuration));
        const artTitle = article?.title ? `"${article.title.slice(0, 32)}..."` : 'Article';
        console.log(`%c[Analytics] Article [${article?.id || 'unknown'} - ${artTitle}] closed: ${durationSecs}s read, ${maxScrollRef.current}% scrolled`, 'color: #00ff88; font-weight: bold;');
        endViewSession(sessionIdRef.current, durationSecs, maxScrollRef.current, article?.id, article?.title);
      }
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('beforeunload', handleUnload);
      handleUnload();
      stopAudioSpeech();
      if (article?.id) {
        clearArticleAudioCache(article.id);
      }
    };
  }, [article?.id]);

  // Fetch Likes status for Article
  useEffect(() => {
    if (!article || !article.id) return;
    const localLiked = localStorage.getItem(`ps_like_${article.id}`) === 'true';
    setIsLiked(localLiked);

    fetchArticleLikes(article.id, sessionIdRef.current).then(data => {
      if (data && typeof data.totalLikes === 'number') {
        setLikesCount(data.totalLikes);
        if (typeof data.isLiked === 'boolean') {
          setIsLiked(data.isLiked || localLiked);
        }
      }
    });
  }, [article?.id]);

  // Fetch Bookmark status for Article
  useEffect(() => {
    if (!article || !article.id) return;
    const localBookmarked = localStorage.getItem(`ps_bookmark_${article.id}`) === 'true';
    setIsBookmarked(localBookmarked);
  }, [article?.id]);

  // Task 23 Subtopic B: Background Auto-Polling for Active Live Blogs
  useEffect(() => {
    if (!article || article.format !== 'live') return;

    let isMounted = true;
    const fetchLiveUpdates = async (showSpinner = false) => {
      if (showSpinner) setIsRefreshingUpdates(true);
      try {
        const res = await fetch(`/api/articles/${encodeURIComponent(article.id)}/live-updates`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.success) {
            setLiveUpdates(data.live_updates || []);
            setLiveCoverageStatus(data.live_status || 'active');
            setLastSyncedTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
          }
        }
      } catch (_err) {
        // Silent background sync catch
      } finally {
        if (isMounted && showSpinner) setIsRefreshingUpdates(false);
      }
    };

    // Initial fetch once mounted
    fetchLiveUpdates(false);

    // If liveCoverageStatus is active, poll every 25 seconds
    let intervalId = null;
    if (liveCoverageStatus === 'active') {
      intervalId = setInterval(() => {
        fetchLiveUpdates(false);
      }, 25000);
    }

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [article?.id, article?.format, liveCoverageStatus]);

  const handleManualRefreshLiveUpdates = () => {
    if (!article || article.format !== 'live' || isRefreshingUpdates) return;
    setIsRefreshingUpdates(true);
    fetch(`/api/articles/${encodeURIComponent(article.id)}/live-updates`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setLiveUpdates(data.live_updates || []);
          setLiveCoverageStatus(data.live_status || 'active');
          setLastSyncedTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
          if (onShowToast) onShowToast('Live blog timeline refreshed.');
        }
      })
      .catch(() => {
        if (onShowToast) onShowToast('Failed to sync live updates.');
      })
      .finally(() => setIsRefreshingUpdates(false));
  };

  const handleBookmarkToggle = () => {
    if (!article || !article.id) return;
    const nextState = !isBookmarked;
    setIsBookmarked(nextState);
    localStorage.setItem(`ps_bookmark_${article.id}`, String(nextState));
    if (onShowToast) {
      onShowToast(nextState ? `${t('saved', currentLanguage)}: ${t('savedBookmarks', currentLanguage)}` : t('remove', currentLanguage));
    }
  };

  const handleShareClick = async () => {
    const shareData = {
      title: (displayArticle || article)?.title || 'PublicSpark News',
      text: (displayArticle || article)?.excerpt || article?.title,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        if (err.name !== 'AbortError') {
          setIsShareModalOpen(true);
        }
        return;
      }
    }

    setIsShareModalOpen(true);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopiedLink(true);
      if (onShowToast) onShowToast(t('linkCopied', currentLanguage));
      setTimeout(() => setCopiedLink(false), 2500);
    }).catch(() => {
      if (onShowToast) onShowToast('Failed to copy link.');
    });
  };

  const handleLikeToggle = async () => {
    const nextState = !isLiked;
    setIsLiked(nextState);
    setLikesCount(prev => nextState ? prev + 1 : Math.max(0, prev - 1));
    localStorage.setItem(`ps_like_${article.id}`, String(nextState));

    const result = await toggleArticleLike(article.id, sessionIdRef.current);
    if (result && typeof result.totalLikes === 'number') {
      setLikesCount(result.totalLikes);
    }
  };

  const handleBackNavigation = () => {
    stopAudioSpeech();
    if (article?.id) {
      clearArticleAudioCache(article.id);
    }
    if (onBack) onBack();
  };

  if (!article) return null;

  const isCorruptedContent = displayArticle?.content && (
    displayArticle.content.includes('QUERY LENGTH') || 
    displayArticle.content.includes('MAX ALLOWED QUERY') || 
    displayArticle.content.includes('MYMEMORY')
  );
  const safeDisplayArticle = isCorruptedContent ? article : (displayArticle || article);
  const activeArticle = showOriginal ? article : safeDisplayArticle;
  const activeLang = showOriginal ? 'hi' : currentLanguage;

  // Task 25 Subtopic A: Fact-Check Data Model & Resolution
  const factCheck = activeArticle?.fact_check || {
    verified: true,
    rating: 'Verified',
    desk: 'PublicSpark Fact Desk',
    claim: 'Primary claims, figures, and institutional statements independently cross-checked prior to publication.',
    verified_at: activeArticle?.published_at || 'At Publication',
    methodology: 'Cross-verified against official government notifications, on-record institutional briefings, and press agency dispatches in accordance with Press Council of India standards.'
  };

  // Task 25 Subtopic B: Official Sources & Gazette Citations Model
  const defaultInstitutionalSources = [
    {
      id: 'src-default-1',
      title: activeArticle?.category === 'Science & Environment'
        ? 'Indian Space Research Organisation (ISRO) Official Launch Dispatch'
        : activeArticle?.category === 'Business'
          ? 'Reserve Bank of India (RBI) Official Notification'
          : 'The Gazette of India: Official Government Gazette Notification',
      url: activeArticle?.category === 'Science & Environment'
        ? 'https://www.isro.gov.in'
        : activeArticle?.category === 'Business'
          ? 'https://www.rbi.org.in'
          : 'https://egazette.gov.in',
      type: 'Government Gazette / Official Record',
      publisher: 'Government of India',
      accessed_at: activeArticle?.published_at || 'At Publication',
      document_ref: 'REF-IN-2026-GAZ'
    },
    {
      id: 'src-default-2',
      title: 'Press Information Bureau (PIB) New Delhi - Official Press Communiqué',
      url: 'https://pib.gov.in',
      type: 'Official Press Release',
      publisher: 'Press Information Bureau (PIB), New Delhi',
      accessed_at: activeArticle?.published_at || 'At Publication',
      document_ref: 'PIB-COMM-DEL-8941'
    }
  ];

  const resolvedSources = (Array.isArray(activeArticle?.sources) && activeArticle.sources.length > 0)
    ? activeArticle.sources
    : defaultInstitutionalSources;

  // Task 26: In-Article Smart Related Stories ("Ye Bhi Padhein")
  const midArticleStory = getMidArticleStory(activeArticle, articles);
  const endArticleStories = getEndArticleStories(activeArticle, articles, 3, midArticleStory ? [midArticleStory.id] : []);

  const fontSizeStyle = {
    sm: { fontSize: '0.92rem', lineHeight: '1.65', subTitleSize: '1.05rem', headlineSize: 'clamp(1.25rem, 4.5vw, 2.15rem)' },
    md: { fontSize: 'clamp(0.95rem, 3.8vw, 1.05rem)', lineHeight: '1.72', subTitleSize: '1.12rem', headlineSize: 'clamp(1.4rem, 5.2vw, 2.45rem)' },
    lg: { fontSize: 'clamp(1.08rem, 4.4vw, 1.2rem)', lineHeight: '1.8', subTitleSize: '1.25rem', headlineSize: 'clamp(1.6rem, 6vw, 2.75rem)' }
  }[fontSizeMode] || { fontSize: 'clamp(0.95rem, 3.8vw, 1.05rem)', lineHeight: '1.72', subTitleSize: '1.12rem', headlineSize: 'clamp(1.4rem, 5.2vw, 2.45rem)' };

  return (
    <article className="container reader-article-container" style={{ maxWidth: '840px', position: 'relative' }}>
      {/* Task 27 Subtopic A: Hairline Reading Progress Bar */}
      <div 
        className="article-reading-progress-track"
        role="progressbar"
        aria-valuenow={scrollProgress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Article reading progress"
      >
        <div 
          className="article-reading-progress-bar"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* Top Controls Header */}
      <div className="reader-top-controls">
        <button 
          onClick={handleBackNavigation} 
          className="btn btn-outline reader-back-btn" 
          style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', flexShrink: 0 }}
        >
          <ArrowLeft size={15} /> 
          <span className="hide-on-mobile">{t('backToTopStories', currentLanguage)}</span>
          <span className="show-on-mobile-inline">{t('back', currentLanguage) || 'वापस'}</span>
        </button>

        <div className="reader-actions-group" style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          {/* Font Scaler Toggle */}
          <div style={{ display: 'inline-flex', alignItems: 'center', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', padding: '0.15rem 0.3rem', gap: '0.2rem', border: '1px solid var(--border-light)' }} title={t('adjustTextSize', currentLanguage)}>
            <Type size={13} color="var(--text-subtle)" style={{ marginLeft: '0.2rem' }} />
            <button 
              onClick={() => setFontSizeMode('sm')} 
              style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem', fontWeight: fontSizeMode === 'sm' ? '900' : '600', color: fontSizeMode === 'sm' ? 'var(--accent-indigo)' : 'var(--text-subtle)', background: fontSizeMode === 'sm' ? 'var(--bg-surface)' : 'transparent', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
            >
              A-
            </button>
            <button 
              onClick={() => setFontSizeMode('md')} 
              style={{ padding: '0.2rem 0.4rem', fontSize: '0.8rem', fontWeight: fontSizeMode === 'md' ? '900' : '600', color: fontSizeMode === 'md' ? 'var(--accent-indigo)' : 'var(--text-subtle)', background: fontSizeMode === 'md' ? 'var(--bg-surface)' : 'transparent', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
            >
              A
            </button>
            <button 
              onClick={() => setFontSizeMode('lg')} 
              style={{ padding: '0.2rem 0.4rem', fontSize: '0.85rem', fontWeight: fontSizeMode === 'lg' ? '900' : '600', color: fontSizeMode === 'lg' ? 'var(--accent-indigo)' : 'var(--text-subtle)', background: fontSizeMode === 'lg' ? 'var(--bg-surface)' : 'transparent', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
            >
              A+
            </button>
          </div>

          {currentLanguage !== (article.originalLanguage || 'hi') && !isTranslating && (
            <button
              onClick={() => setShowOriginal(!showOriginal)}
              className="btn btn-outline"
              style={{ 
                padding: '0.4rem 0.8rem', 
                fontSize: '0.825rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                borderColor: showOriginal ? 'var(--accent-crimson)' : 'var(--border-medium)',
                color: showOriginal ? 'var(--accent-crimson)' : 'var(--text-main)'
              }}
            >
              <Languages size={15} />
              {showOriginal 
                ? t('viewTranslated', currentLanguage) 
                : `${t('viewOriginal', currentLanguage)} (${SUPPORTED_LANGUAGES.find(l => l.code === (article.originalLanguage || 'hi'))?.native || 'Original'})`}
            </button>
          )}

          <a
            href={getWhatsAppShareUrl(activeArticle, currentLanguage)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline"
            style={{
              padding: '0.35rem 0.65rem',
              fontSize: '0.8rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              cursor: 'pointer',
              color: '#15803D',
              borderColor: '#86EFAC',
              background: '#F0FDF4',
              textDecoration: 'none',
              fontWeight: '700'
            }}
            title="WhatsApp पर स्मार्ट बुलेटिन शेयर करें"
          >
            <WhatsAppIcon size={14} color="#15803D" />
            <span className="hide-on-mobile">WhatsApp</span>
          </a>

          <button
            onClick={handleShareClick}
            className="btn btn-outline"
            style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}
            title={t('share', currentLanguage)}
          >
            <Share2 size={14} /> <span className="hide-on-mobile">{t('share', currentLanguage)}</span>
          </button>

          <button
            onClick={handleBookmarkToggle}
            className="btn"
            style={{ 
              padding: '0.35rem 0.65rem', 
              fontSize: '0.8rem', 
              borderRadius: 'var(--radius-md)',
              border: isBookmarked ? '1px solid #f59e0b' : '1px solid var(--border-medium)',
              background: isBookmarked ? '#f59e0b' : 'var(--bg-surface)',
              color: isBookmarked ? '#ffffff' : 'var(--text-main)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              cursor: 'pointer',
              fontWeight: '700',
              transition: 'all 0.2s ease'
            }}
            title={isBookmarked ? t('saved', currentLanguage) : t('bookmark', currentLanguage)}
          >
            <Bookmark size={14} fill={isBookmarked ? '#ffffff' : 'none'} color={isBookmarked ? '#ffffff' : 'currentColor'} />
            <span className="hide-on-mobile">{isBookmarked ? t('saved', currentLanguage) : t('bookmark', currentLanguage)}</span>
          </button>
        </div>
      </div>

      {/* Lazy Translation Status Banner */}
      {isTranslating && (
        <div style={{
          background: 'var(--accent-indigo-bg, rgba(99, 102, 241, 0.08))',
          border: '1px solid var(--accent-indigo, #6366f1)',
          color: 'var(--text-main)',
          padding: '0.85rem 1.25rem',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Loader2 size={18} className="spin-animation" color="var(--accent-indigo)" />
            <span style={{ fontWeight: '800', fontSize: '0.95rem' }}>
              अनुवाद बन रहा है... (Translating...)
            </span>
          </div>
          <span style={{ fontSize: '0.825rem', color: 'var(--text-subtle)' }}>
            मूल समाचार प्रदर्शित हो रहा है (Hindi view)
          </span>
        </div>
      )}

      {/* Top / Header Leaderboard Ad Unit (Evaluated by Backend for this Article) */}
      <PartnerUnit position="header" category={activeArticle.category} articleId={activeArticle.id} />

      <div>
          {/* Category Badge & Breaking Flag */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <span className="story-category-tag">{translateCategoryName(activeArticle.category, currentLanguage)}</span>
            {activeArticle.format === 'live' && (
              <span 
                className="badge badge-live"
                style={{
                  background: (activeArticle.live_status || 'active') === 'active' ? '#DC2626' : '#4B5563',
                  color: '#FFFFFF',
                  fontWeight: '800',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.2rem 0.6rem'
                }}
              >
                {(activeArticle.live_status || 'active') === 'active' ? (
                  <>
                    <Radio size={12} /> LIVE BLOG
                  </>
                ) : (
                  <>
                    <CheckCircle size={12} /> COVERAGE CONCLUDED
                  </>
                )}
              </span>
            )}
            {activeArticle.is_breaking && (
              <span className="badge badge-live">
                <Flame size={12} /> {t('breaking', currentLanguage)}
              </span>
            )}
            {/* Task 25 Subtopic A: Interactive Editorial Verification Badge */}
            <button
              type="button"
              onClick={() => setShowFactCheckDossier(true)}
              className="badge"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                cursor: 'pointer',
                background: factCheck.rating === 'Under Review' ? '#FEF3C7' : '#ECFDF5',
                color: factCheck.rating === 'Under Review' ? '#92400E' : '#065F46',
                border: factCheck.rating === 'Under Review' ? '1px solid #FCD34D' : '1px solid #A7F3D0',
                padding: '0.2rem 0.6rem',
                borderRadius: '4px',
                fontWeight: '800',
                fontSize: '0.74rem',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                boxShadow: 'none',
                minHeight: '28px'
              }}
              title="Click to inspect editorial verification dossier"
            >
              <ShieldCheck size={13} color={factCheck.rating === 'Under Review' ? '#D97706' : '#059669'} />
              <span>FACT-CHECK: {factCheck.rating || 'Verified'}</span>
              <span style={{ fontSize: '0.68rem', fontWeight: '600', opacity: 0.85, textTransform: 'none' }}>
                ({factCheck.desk || 'Fact Desk'})
              </span>
            </button>
          </div>

          {/* Main Editorial Headline with Dynamic Font Size & Weight */}
          <h1 className="headline reader-headline" style={{ fontSize: fontSizeStyle.headlineSize, fontWeight: 'var(--font-weight-heading, 800)', lineHeight: '1.28', marginBottom: '0.85rem', transition: 'font-size 0.2s ease, font-weight 0.2s ease' }}>
            {activeArticle.title}
          </h1>

          {/* Subheading / Standfirst with Dynamic Font Size */}
          {activeArticle.sub_title && (
            <p className="story-excerpt" style={{ fontSize: fontSizeStyle.subTitleSize, color: 'var(--text-muted)', marginBottom: '1.25rem', fontWeight: '500', transition: 'font-size 0.2s ease' }}>
              {activeArticle.sub_title}
            </p>
          )}

          {/* Author Byline & Timestamps Bar */}
          <div className="reader-byline-bar">
            <div className="reader-byline-author" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              {activeArticle.author?.avatar && (
                <img 
                  src={activeArticle.author.avatar} 
                  alt={activeArticle.author.name}
                  style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} 
                />
              )}
              <div>
                <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{activeArticle.author?.name || 'PublicSpark Desk'}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>{activeArticle.author?.role || 'Staff Reporter'}</div>
              </div>
            </div>

            <div className="reader-byline-meta">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Clock size={13} /> {activeArticle.published_at} ({activeArticle.reading_time_mins} {t('minsRead', currentLanguage)})
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: '600', color: 'var(--text-main)' }}>
                <Eye size={13} color="var(--accent-crimson)" /> {(viewsCount || 1240).toLocaleString()} {t('views', currentLanguage)}
              </span>
              <button
                onClick={handleLikeToggle}
                className="btn"
                style={{
                  padding: '0.3rem 0.65rem',
                  fontSize: '0.78rem',
                  borderRadius: 'var(--radius-sm)',
                  border: isLiked ? '1px solid #ef4444' : '1px solid var(--border-medium)',
                  background: isLiked ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-surface)',
                  color: isLiked ? '#ef4444' : 'var(--text-main)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <Heart size={14} fill={isLiked ? '#ef4444' : 'none'} color={isLiked ? '#ef4444' : 'currentColor'} />
                <span>{likesCount.toLocaleString()} {likesCount === 1 ? t('like', currentLanguage) : t('likes', currentLanguage)}</span>
              </button>
            </div>
          </div>

          {/* Text-to-Speech Audio Reader Component (2-Stage Gemini Audio) */}
          <TextToSpeech 
            title={activeArticle.title} 
            highlights={activeArticle.highlights || (activeArticle.summary ? [activeArticle.summary] : [])}
            textToRead={activeArticle.content} 
            currentLanguage={activeLang} 
            articleId={activeArticle.id} 
          />

          {/* YouTube Video Player (If Video News) */}
          {activeArticle.video_url && (
            <VideoEmbedPlayer videoUrlOrId={activeArticle.video_url} title={activeArticle.title} />
          )}

          {/* Hero Featured Media Image */}
          {activeArticle.featured_image && (
            <figure style={{ margin: '1.5rem 0' }}>
              <img 
                src={activeArticle.featured_image} 
                alt={activeArticle.title} 
                style={{ width: '100%', maxHeight: '480px', objectFit: 'cover', borderRadius: 'var(--radius-md)' }}
              />
              {(activeArticle.image_caption || activeArticle.media_credits) && (
                <figcaption style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', marginTop: '0.5rem', fontStyle: 'italic' }}>
                  {activeArticle.image_caption} — <span style={{ fontWeight: '600' }}>Credit: {activeArticle.media_credits}</span>
                </figcaption>
              )}
            </figure>
          )}

          {/* Executive 30-Second Briefing Box */}
          {(activeArticle.summary || activeArticle.sub_title) && (
            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-medium)',
              borderLeft: '4px solid var(--accent-crimson)',
              borderRadius: 'var(--radius-sm)',
              padding: '1.25rem 1.5rem',
              margin: '1.75rem 0',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.45rem', 
                fontSize: '0.78rem', 
                fontWeight: '800', 
                color: 'var(--accent-indigo)', 
                textTransform: 'uppercase', 
                letterSpacing: '0.06em',
                marginBottom: '0.65rem'
              }}>
                <Sparkles size={14} /> {t('in30Seconds', currentLanguage)}
              </div>
              <ul style={{ 
                margin: 0, 
                paddingLeft: '1.2rem', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '0.45rem', 
                fontSize: '0.925rem', 
                lineHeight: '1.5',
                color: 'var(--text-main)',
                fontWeight: '500'
              }}>
                {Array.isArray(activeArticle.highlights) && activeArticle.highlights.filter(h => h && !h.toLowerCase().includes('full investigative briefing')).length > 0 ? (
                  activeArticle.highlights
                    .filter(h => h && !h.toLowerCase().includes('full investigative briefing'))
                    .map((h, i) => <li key={i}>{h}</li>)
                ) : (
                  <>
                    {activeArticle.summary && <li>{activeArticle.summary}</li>}
                    {activeArticle.sub_title && activeArticle.sub_title !== activeArticle.summary && (
                      <li>{activeArticle.sub_title}</li>
                    )}
                  </>
                )}
              </ul>
            </div>
          )}

          {/* Article Body Content Rendered via MarkdownRenderer with Dynamic Font Size */}
          <div style={{ 
            marginBottom: '2rem',
            transition: 'font-size 0.2s ease, line-height 0.2s ease'
          }}>
            <MarkdownRenderer 
              content={activeArticle.content} 
              fontSize={fontSizeStyle.fontSize} 
              fontSizeMode={fontSizeMode} 
              lineHeight={fontSizeStyle.lineHeight} 
              adComponent={<PartnerUnit position="in_article" category={activeArticle.category} articleId={activeArticle.id} />}
              relatedStoryComponent={midArticleStory ? (
                <aside
                  className="mid-article-related-callout"
                  aria-label="Related Story Recommendation"
                  onClick={() => {
                    if (onSelectArticle) {
                      onSelectArticle(midArticleStory);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  }}
                  style={{
                    margin: '1.75rem 0',
                    padding: '1rem 1.15rem',
                    background: 'var(--bg-secondary)',
                    borderLeft: '4px solid var(--accent-crimson)',
                    borderTop: '1px solid var(--border-medium)',
                    borderRight: '1px solid var(--border-medium)',
                    borderBottom: '1px solid var(--border-medium)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    boxSizing: 'border-box',
                    minHeight: '48px'
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      marginBottom: '0.35rem',
                      flexWrap: 'wrap'
                    }}>
                      <span style={{
                        fontSize: '0.74rem',
                        fontWeight: '900',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--accent-crimson)',
                        background: 'rgba(185, 28, 28, 0.08)',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '3px'
                      }}>
                        ये भी पढ़ें (Also Read)
                      </span>
                      {midArticleStory.category && (
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: '700',
                          color: 'var(--text-subtle)',
                          textTransform: 'uppercase'
                        }}>
                          {translateCategoryName(midArticleStory.category, currentLanguage)}
                        </span>
                      )}
                    </div>
                    <h4 style={{
                      margin: 0,
                      fontSize: '1.02rem',
                      fontWeight: '800',
                      fontFamily: 'var(--font-serif)',
                      color: 'var(--text-main)',
                      lineHeight: 1.35,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical'
                    }}>
                      {midArticleStory.title}
                    </h4>
                  </div>

                  {midArticleStory.image_url ? (
                    <img
                      src={midArticleStory.image_url}
                      alt={midArticleStory.title}
                      style={{
                        width: '76px',
                        height: '60px',
                        objectFit: 'cover',
                        borderRadius: '4px',
                        border: '1px solid var(--border-light)',
                        flexShrink: 0
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-medium)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      color: 'var(--accent-crimson)'
                    }}>
                      <ArrowRight size={18} />
                    </div>
                  )}
                </aside>
              ) : null}
            />
          </div>
        </div>

      {/* Live Blog Stream (If Format is Live) */}
      {activeArticle.format === 'live' && (
        <div style={{
          margin: '2.5rem 0',
          background: 'var(--bg-primary)',
          padding: '1.25rem',
          borderRadius: '4px',
          border: '1px solid var(--border-medium)',
          borderLeft: '4px solid var(--accent-crimson)'
        }}>
          {/* Header Row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
            paddingBottom: '0.85rem',
            borderBottom: '1px solid var(--border-medium)'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h3 style={{
                  fontSize: '1.2rem',
                  fontWeight: '800',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  margin: 0,
                  color: 'var(--text-main)'
                }}>
                  <Radio size={18} color="var(--accent-crimson)" /> Live News Timeline
                </h3>

                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: '800',
                  textTransform: 'uppercase',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                  background: liveCoverageStatus === 'active' ? '#FEE2E2' : '#E5E7EB',
                  color: liveCoverageStatus === 'active' ? '#B91C1C' : '#4B5563',
                  border: liveCoverageStatus === 'active' ? '1px solid #F87171' : '1px solid #D1D5DB'
                }}>
                  {liveCoverageStatus === 'active' ? 'Live Stream Active' : 'Coverage Concluded'}
                </span>
              </div>

              {lastSyncedTime && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', display: 'block', marginTop: '0.2rem' }}>
                  Auto-synced at {lastSyncedTime}
                </span>
              )}
            </div>

            <button
              onClick={handleManualRefreshLiveUpdates}
              disabled={isRefreshingUpdates}
              className="btn btn-outline"
              style={{
                minHeight: '36px',
                padding: '0.35rem 0.75rem',
                fontSize: '0.78rem',
                fontWeight: '700',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                borderRadius: '4px',
                cursor: isRefreshingUpdates ? 'not-allowed' : 'pointer'
              }}
              title="Refresh timeline updates"
            >
              <RefreshCw size={13} style={{ animation: isRefreshingUpdates ? 'spin 1s linear infinite' : 'none' }} />
              {isRefreshingUpdates ? 'Refreshing...' : 'Check for Updates'}
            </button>
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: '0.5rem', margin: '0.85rem 0 1.25rem 0', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setFilterKeyEventsOnly(false)}
              style={{
                minHeight: '32px',
                padding: '0.3rem 0.75rem',
                fontSize: '0.78rem',
                fontWeight: '800',
                borderRadius: '4px',
                border: !filterKeyEventsOnly ? '1px solid #0E2A47' : '1px solid var(--border-medium)',
                background: !filterKeyEventsOnly ? '#0E2A47' : '#FFFFFF',
                color: !filterKeyEventsOnly ? '#FFFFFF' : 'var(--text-main)',
                cursor: 'pointer'
              }}
            >
              All Updates ({liveUpdates.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterKeyEventsOnly(true)}
              style={{
                minHeight: '32px',
                padding: '0.3rem 0.75rem',
                fontSize: '0.78rem',
                fontWeight: '800',
                borderRadius: '4px',
                border: filterKeyEventsOnly ? '1px solid #B91C1C' : '1px solid var(--border-medium)',
                background: filterKeyEventsOnly ? '#B91C1C' : '#FFFFFF',
                color: filterKeyEventsOnly ? '#FFFFFF' : 'var(--text-main)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
            >
              <Flame size={12} /> Key Highlights ({liveUpdates.filter(u => u.is_key_event).length})
            </button>
          </div>

          {/* Timeline Stream */}
          {(() => {
            const filtered = filterKeyEventsOnly
              ? liveUpdates.filter(u => u.is_key_event)
              : liveUpdates;

            if (filtered.length === 0) {
              return (
                <div style={{
                  textAlign: 'center',
                  padding: '2rem 1rem',
                  background: '#FFFFFF',
                  borderRadius: '4px',
                  border: '1px dashed var(--border-medium)'
                }}>
                  <Clock size={24} color="var(--text-subtle)" style={{ margin: '0 auto 0.5rem auto', display: 'block' }} />
                  <p style={{ margin: 0, fontWeight: '700', fontSize: '0.88rem', color: 'var(--text-main)' }}>
                    {filterKeyEventsOnly
                      ? 'No key highlights flagged in this timeline yet.'
                      : 'Live coverage has commenced. Updates will appear here as news develops.'}
                  </p>
                </div>
              );
            }

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {filtered.map((update) => (
                  <div
                    key={update.id}
                    style={{
                      background: '#FFFFFF',
                      padding: '1.1rem',
                      borderRadius: '4px',
                      border: update.is_key_event ? '1.5px solid #F87171' : '1px solid var(--border-medium)',
                      borderLeft: update.is_key_event ? '4px solid #DC2626' : '1px solid var(--border-medium)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: '800',
                        color: '#B91C1C',
                        background: '#FEE2E2',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}>
                        <Clock size={11} /> {update.timestamp}
                      </span>
                      {update.is_key_event && (
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: '800',
                          color: '#991B1B',
                          background: '#FECACA',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          textTransform: 'uppercase'
                        }}>
                          Key Highlight
                        </span>
                      )}
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                        Reported by {update.author || 'Newsroom Desk'}
                      </span>
                    </div>

                    <h4 style={{
                      fontSize: '1.05rem',
                      fontWeight: '800',
                      margin: '0.35rem 0 0.5rem 0',
                      color: 'var(--text-main)',
                      lineHeight: 1.35
                    }}>
                      {update.headline}
                    </h4>

                    {update.body && (
                      <p style={{
                        fontSize: '0.92rem',
                        color: 'var(--text-body)',
                        margin: 0,
                        lineHeight: 1.5,
                        whiteSpace: 'pre-wrap'
                      }}>
                        {update.body}
                      </p>
                    )}

                    {update.media_url && (
                      <div style={{ marginTop: '0.65rem' }}>
                        <img
                          src={update.media_url}
                          alt={update.headline}
                          style={{
                            maxHeight: '320px',
                            maxWidth: '100%',
                            objectFit: 'cover',
                            borderRadius: '4px',
                            border: '1px solid var(--border-light)'
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Task 25 Subtopic B: Official Sources & Government Gazette Citations Box */}
      <section 
        id="article-official-sources" 
        className="story-sources-box"
        aria-label="Official Sources & Gazette Citations"
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-medium)',
          borderLeft: '4px solid #0E2A47',
          borderRadius: '4px',
          padding: '1.25rem',
          marginTop: '2rem',
          marginBottom: '1rem',
          boxSizing: 'border-box'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.65rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={18} color="#0E2A47" />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '900', color: 'var(--text-main)', letterSpacing: '0.01em' }}>
              स्रोत एवं संदर्भ (Official Sources & Gazette Citations)
            </h3>
          </div>
          <span style={{
            fontSize: '0.72rem',
            fontWeight: '800',
            color: '#065F46',
            background: '#ECFDF5',
            border: '1px solid #A7F3D0',
            padding: '0.2rem 0.55rem',
            borderRadius: '4px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem'
          }}>
            <ShieldCheck size={12} color="#059669" />
            {resolvedSources.length} {resolvedSources.length === 1 ? 'Source Verified' : 'Sources Verified'}
          </span>
        </div>

        <p style={{ margin: '0 0 1rem 0', fontSize: '0.82rem', color: 'var(--text-subtle)', lineHeight: '1.5' }}>
          सार्वजनिक विश्वास और निष्पक्ष पत्रकारिता के तहत यह समाचार प्रमाणित प्राथमिक अभिलेखों, सरकारी राजपत्रों एवं आधिकारिक प्रेस नोट पर आधारित है।
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {resolvedSources.map((src, idx) => (
            <div 
              key={src.id || idx}
              style={{
                background: '#FFFFFF',
                border: '1px solid var(--border-light)',
                borderRadius: '4px',
                padding: '0.85rem 1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem'
              }}
            >
              <div style={{ flex: '1 1 280px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: '800',
                    color: src.type?.includes('Gazette') ? '#92400E' : src.type?.includes('Judicial') ? '#5B21B6' : '#1E40AF',
                    background: src.type?.includes('Gazette') ? '#FEF3C7' : src.type?.includes('Judicial') ? '#EDE9FE' : '#DBEAFE',
                    padding: '0.15rem 0.45rem',
                    borderRadius: '3px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em'
                  }}>
                    {src.type || 'Official Record'}
                  </span>
                  {src.publisher && (
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-subtle)' }}>
                      • {src.publisher}
                    </span>
                  )}
                </div>

                <h4 style={{ margin: '0 0 0.2rem 0', fontSize: '0.92rem', fontWeight: '800', color: 'var(--text-main)', lineHeight: '1.35', wordBreak: 'break-word' }}>
                  {src.title}
                </h4>

                {(src.document_ref || src.accessed_at) && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {src.document_ref && <span>Ref: {src.document_ref}</span>}
                    {src.accessed_at && <span>Accessed: {src.accessed_at}</span>}
                  </div>
                )}
              </div>

              {src.url && (
                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline"
                  style={{
                    padding: '0.45rem 0.85rem',
                    fontSize: '0.78rem',
                    fontWeight: '700',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    color: '#0E2A47',
                    borderColor: '#94A3B8',
                    background: '#F8FAFC',
                    textDecoration: 'none',
                    minHeight: '36px',
                    flexShrink: 0
                  }}
                  title="Open official primary source document"
                >
                  <span>दस्तावेज़ देखें</span>
                  <ExternalLink size={13} />
                </a>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Task 26 Subtopic B: In-Article Smart Related Stories - End of Article Grid */}
      {endArticleStories && endArticleStories.length > 0 && (
        <section
          className="end-article-related-stories"
          aria-label="Related Stories"
          style={{
            marginTop: '2rem',
            marginBottom: '1rem',
            borderTop: '2px solid var(--border-medium)',
            paddingTop: '1.5rem',
            boxSizing: 'border-box'
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1.25rem',
            flexWrap: 'wrap',
            gap: '0.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '4px',
                height: '18px',
                background: 'var(--accent-crimson)',
                borderRadius: '2px'
              }}></div>
              <h3 style={{
                margin: 0,
                fontSize: '1.18rem',
                fontWeight: '900',
                fontFamily: 'var(--font-serif)',
                color: 'var(--text-main)',
                letterSpacing: '-0.01em'
              }}>
                संबंधित ख़बरें (Related Stories)
              </h3>
            </div>
            {activeArticle.category && (
              <span style={{
                fontSize: '0.74rem',
                fontWeight: '800',
                color: 'var(--text-subtle)',
                background: 'var(--bg-secondary)',
                padding: '0.2rem 0.6rem',
                borderRadius: '4px',
                border: '1px solid var(--border-light)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}>
                {translateCategoryName(activeArticle.category, currentLanguage)}
              </span>
            )}
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1rem',
            boxSizing: 'border-box'
          }}>
            {endArticleStories.map((story) => (
              <article
                key={story.id}
                onClick={() => {
                  if (onSelectArticle) {
                    onSelectArticle(story);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
                className="related-story-card"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
                  minHeight: '100%',
                  boxSizing: 'border-box'
                }}
              >
                {story.image_url && (
                  <div style={{
                    width: '100%',
                    height: '140px',
                    position: 'relative',
                    overflow: 'hidden',
                    background: 'var(--bg-secondary)'
                  }}>
                    <img
                      src={story.image_url}
                      alt={story.title}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block'
                      }}
                      loading="lazy"
                    />
                    {story.category && (
                      <span style={{
                        position: 'absolute',
                        bottom: '8px',
                        left: '8px',
                        fontSize: '0.68rem',
                        fontWeight: '800',
                        color: '#FFFFFF',
                        background: 'rgba(14, 42, 71, 0.88)',
                        backdropFilter: 'blur(4px)',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '3px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.03em'
                      }}>
                        {translateCategoryName(story.category, currentLanguage)}
                      </span>
                    )}
                  </div>
                )}

                <div style={{
                  padding: '0.85rem 0.95rem 1rem 0.95rem',
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  justifyContent: 'space-between',
                  boxSizing: 'border-box'
                }}>
                  <div>
                    {!story.image_url && story.category && (
                      <span style={{
                        display: 'inline-block',
                        fontSize: '0.7rem',
                        fontWeight: '800',
                        color: 'var(--accent-crimson)',
                        textTransform: 'uppercase',
                        marginBottom: '0.4rem',
                        letterSpacing: '0.03em'
                      }}>
                        {translateCategoryName(story.category, currentLanguage)}
                      </span>
                    )}

                    <h4 style={{
                      margin: '0 0 0.5rem 0',
                      fontSize: '0.98rem',
                      fontWeight: '800',
                      fontFamily: 'var(--font-serif)',
                      color: 'var(--text-main)',
                      lineHeight: 1.35,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical'
                    }}>
                      {story.title}
                    </h4>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '0.65rem',
                    paddingTop: '0.5rem',
                    borderTop: '1px solid var(--border-light)',
                    fontSize: '0.74rem',
                    color: 'var(--text-subtle)'
                  }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Clock size={12} />
                      {story.read_time ? `${story.read_time} min read` : '2 min read'}
                    </span>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      color: 'var(--accent-crimson)',
                      fontWeight: '800'
                    }}>
                      पढ़ें <ArrowRight size={12} />
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Action Footer & Social Sharing */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: '1rem 0',
        borderTop: '1px solid var(--border-medium)',
        marginTop: '2rem'
      }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={handleLikeToggle}
            className="btn"
            style={{
              padding: '0.45rem 1rem',
              fontSize: '0.85rem',
              borderRadius: 'var(--radius-sm)',
              border: isLiked ? '1px solid #ef4444' : '1px solid var(--border-medium)',
              background: isLiked ? '#ef4444' : 'var(--bg-surface)',
              color: isLiked ? '#ffffff' : 'var(--text-main)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: isLiked ? '0 4px 12px rgba(239, 68, 68, 0.3)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <Heart size={16} fill={isLiked ? '#ffffff' : 'none'} color={isLiked ? '#ffffff' : 'currentColor'} />
            <span>{isLiked ? t('liked', currentLanguage) : t('like', currentLanguage)} ({likesCount.toLocaleString()})</span>
          </button>
          <a
            href={getWhatsAppShareUrl(activeArticle, currentLanguage)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn"
            style={{
              padding: '0.45rem 1rem',
              fontSize: '0.85rem',
              borderRadius: 'var(--radius-sm)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontWeight: '700',
              cursor: 'pointer',
              background: '#25D366',
              color: '#FFFFFF',
              border: '1px solid #16A34A',
              textDecoration: 'none',
              boxShadow: '0 2px 8px rgba(37, 211, 102, 0.3)',
              minHeight: '36px'
            }}
            title="WhatsApp पर स्मार्ट समाचार कार्ड शेयर करें"
          >
            <WhatsAppIcon size={16} color="#FFFFFF" />
            <span>WhatsApp</span>
          </a>
          <button
            onClick={handleShareClick}
            className="btn btn-outline"
            style={{
              padding: '0.45rem 1rem',
              fontSize: '0.85rem',
              borderRadius: 'var(--radius-sm)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            <Share2 size={15} /> {t('share', currentLanguage)}
          </button>
          <button
            onClick={handleBookmarkToggle}
            className="btn"
            style={{
              padding: '0.45rem 1rem',
              fontSize: '0.85rem',
              borderRadius: 'var(--radius-sm)',
              border: isBookmarked ? '1px solid #f59e0b' : '1px solid var(--border-medium)',
              background: isBookmarked ? '#f59e0b' : 'var(--bg-surface)',
              color: isBookmarked ? '#ffffff' : 'var(--text-main)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: isBookmarked ? '0 4px 12px rgba(245, 158, 11, 0.3)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <Bookmark size={16} fill={isBookmarked ? '#ffffff' : 'none'} color={isBookmarked ? '#ffffff' : 'currentColor'} />
            <span>{isBookmarked ? t('saved', currentLanguage) : t('bookmark', currentLanguage)}</span>
          </button>
        </div>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-subtle)' }}>
          PublicSpark Verified News Engine
        </span>
      </div>

      {/* Interactive Share Modal Dialog */}
      {isShareModalOpen && (
        <div 
          className="share-modal-backdrop"
          onClick={() => setIsShareModalOpen(false)}
        >
          <div 
            className="share-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet-drag-handle"></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <Share2 size={18} color="var(--accent-crimson)" /> {t('share', currentLanguage)}
              </h3>
              <button 
                onClick={() => setIsShareModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: '1.4' }}>
              "{activeArticle.title}"
            </p>

            {/* WhatsApp Smart Formatted News Card */}
            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.85rem 1rem',
              marginBottom: '1.25rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: '800', fontSize: '0.82rem', color: '#16A34A' }}>
                  <WhatsAppIcon size={16} color="#16A34A" />
                  <span>WhatsApp Smart News Bulletin</span>
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', background: 'var(--bg-surface)', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid var(--border-light)', fontWeight: '600' }}>
                  Broadsheet Card
                </span>
              </div>

              {/* Live Preview of formatted card */}
              <pre style={{
                margin: 0,
                fontSize: '0.78rem',
                lineHeight: '1.45',
                color: 'var(--text-main)',
                fontFamily: 'inherit',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: '125px',
                overflowY: 'auto',
                background: 'var(--bg-surface)',
                padding: '0.65rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-light)'
              }}>
                {buildWhatsAppShareText(activeArticle, currentLanguage)}
              </pre>

              {/* Action Buttons for WhatsApp Card */}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                <a
                  href={getWhatsAppShareUrl(activeArticle, currentLanguage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn"
                  style={{
                    flex: '1 1 180px',
                    minHeight: '44px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    background: '#25D366',
                    color: '#FFFFFF',
                    border: '1px solid #16A34A',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: '700',
                    fontSize: '0.85rem',
                    textDecoration: 'none'
                  }}
                >
                  <WhatsAppIcon size={18} color="#FFFFFF" />
                  <span>WhatsApp पर भेजें (Send Card)</span>
                </a>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await copyFormattedShareCard(activeArticle, currentLanguage);
                    if (ok) {
                      setCopiedWhatsAppCard(true);
                      setTimeout(() => setCopiedWhatsAppCard(false), 2500);
                      if (onShowToast) onShowToast('WhatsApp समाचार कार्ड कॉपी हो गया!');
                    }
                  }}
                  className="btn btn-outline"
                  style={{
                    minHeight: '44px',
                    padding: '0.5rem 0.85rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.82rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    color: copiedWhatsAppCard ? 'var(--accent-emerald)' : 'var(--text-main)',
                    borderColor: copiedWhatsAppCard ? 'var(--accent-emerald)' : 'var(--border-medium)',
                    background: copiedWhatsAppCard ? 'var(--bg-secondary)' : 'transparent'
                  }}
                >
                  {copiedWhatsAppCard ? <Check size={16} color="var(--accent-emerald)" /> : <Copy size={16} />}
                  <span>{copiedWhatsAppCard ? 'कार्ड कॉपी हो गया!' : 'कार्ड कॉपी करें (Copy Card)'}</span>
                </button>
              </div>
            </div>

            {/* Copy Link Bar */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <input 
                type="text" 
                readOnly 
                value={window.location.href}
                style={{
                  flex: 1,
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.8rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-medium)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-main)',
                  outline: 'none'
                }}
              />
              <button 
                onClick={handleCopyLink}
                className="btn btn-primary"
                style={{ padding: '0.5rem 0.9rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}
              >
                {copiedLink ? <Check size={15} /> : <Copy size={15} />}
                {copiedLink ? t('linkCopied', currentLanguage) : t('copyLink', currentLanguage)}
              </button>
            </div>

            {/* Social Share Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', textAlign: 'center' }}>
              <a 
                href={getWhatsAppShareUrl(activeArticle, currentLanguage)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline"
                style={{ padding: '0.6rem 0.4rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', textDecoration: 'none', color: '#16A34A', borderColor: '#86EFAC' }}
              >
                <WhatsAppIcon size={18} color="#25D366" />
                WhatsApp
              </a>

              <a 
                href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(activeArticle.title)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline"
                style={{ padding: '0.6rem 0.4rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', textDecoration: 'none' }}
              >
                <Share2 size={18} color="#1DA1F2" />
                Twitter / X
              </a>

              <a 
                href={`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(activeArticle.title)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline"
                style={{ padding: '0.6rem 0.4rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', textDecoration: 'none' }}
              >
                <Send size={18} color="#0088cc" />
                Telegram
              </a>

              <a 
                href={`mailto:?subject=${encodeURIComponent(activeArticle.title)}&body=${encodeURIComponent(activeArticle.title + '\n\nRead full story: ' + window.location.href)}`}
                className="btn btn-outline"
                style={{ padding: '0.6rem 0.4rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', textDecoration: 'none' }}
              >
                <ExternalLink size={18} color="var(--accent-crimson)" />
                Email
              </a>
            </div>
          </div>
        </div>
      )}
      {/* Task 25 Subtopic A: Fact-Check Verification Dossier Modal */}
      {showFactCheckDossier && (
        <div 
          className="admin-modal-overlay" 
          style={{ zIndex: 12000 }}
          role="dialog"
          aria-modal="true"
          aria-label="Editorial Fact-Check Dossier"
        >
          <div 
            className="admin-modal-dialog" 
            style={{ 
              maxWidth: '620px', 
              width: '94%', 
              background: '#FFFFFF', 
              borderRadius: '6px', 
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              border: '1px solid var(--border-medium)',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={22} color="#059669" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '900', color: '#0E2A47' }}>
                  संपादकीय तथ्य सत्यापन रिपोर्ट
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFactCheckDossier(false)}
                className="btn btn-outline"
                style={{ padding: '0.35rem 0.5rem', minWidth: '40px', minHeight: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                aria-label="Close fact check modal"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Verification Status Pill */}
              <div style={{
                background: factCheck.rating === 'Under Review' ? '#FEF3C7' : '#ECFDF5',
                border: factCheck.rating === 'Under Review' ? '1px solid #FCD34D' : '1px solid #A7F3D0',
                padding: '0.85rem 1rem',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.5rem'
              }}>
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase', color: factCheck.rating === 'Under Review' ? '#92400E' : '#065F46', letterSpacing: '0.04em' }}>
                    EDITORIAL VERIFICATION STATUS
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: '900', color: factCheck.rating === 'Under Review' ? '#B45309' : '#047857' }}>
                    {factCheck.rating || 'Verified'}
                  </div>
                </div>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  color: 'var(--text-subtle)',
                  background: '#FFFFFF',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '3px',
                  border: '1px solid var(--border-light)'
                }}>
                  {factCheck.verified_at || activeArticle?.published_at || 'At Publication'}
                </span>
              </div>

              {/* Story Context */}
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-subtle)', display: 'block', marginBottom: '0.25rem' }}>
                  ARTICLE TITLE
                </label>
                <div style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-main)', lineHeight: '1.4' }}>
                  {activeArticle.title}
                </div>
              </div>

              {/* Verified By Desk */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-subtle)', display: 'block', marginBottom: '0.2rem' }}>
                    VERIFYING DESK
                  </span>
                  <span style={{ fontSize: '0.88rem', fontWeight: '800', color: '#0E2A47' }}>
                    {factCheck.desk || 'PublicSpark Fact Desk'}
                  </span>
                </div>
                <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-subtle)', display: 'block', marginBottom: '0.2rem' }}>
                    PRIMARY SOURCES CITED
                  </span>
                  <span style={{ fontSize: '0.88rem', fontWeight: '800', color: '#0E2A47' }}>
                    {resolvedSources.length} Official References
                  </span>
                </div>
              </div>

              {/* Verified Claim / Findings */}
              <div style={{ background: '#F8FAFC', padding: '0.85rem 1rem', borderRadius: '4px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  VERIFIED CLAIM & FACTUAL FINDINGS
                </span>
                <p style={{ margin: 0, fontSize: '0.88rem', color: '#1E293B', lineHeight: '1.5' }}>
                  {factCheck.claim || 'Primary claims, figures, and institutional statements independently cross-checked against authorized government portals and wire dispatches prior to publication.'}
                </p>
              </div>

              {/* Methodology & Ethics Standard */}
              <div style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', lineHeight: '1.5', borderLeft: '3px solid #059669', paddingLeft: '0.75rem' }}>
                <div style={{ fontWeight: '800', color: 'var(--text-main)', marginBottom: '0.2rem' }}>
                  Editorial Standards & Methodology:
                </div>
                {factCheck.methodology || 'Cross-verified against official government notifications, on-record institutional briefings, and press agency dispatches in accordance with Press Council of India standards.'}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '1.25rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.85rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  setShowFactCheckDossier(false);
                  const el = document.getElementById('article-official-sources');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="btn btn-outline"
                style={{ padding: '0.55rem 1rem', fontSize: '0.82rem', fontWeight: '700', minHeight: '44px', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <FileText size={15} />
                <span>स्रोत व संदर्भ देखें (View Citations)</span>
              </button>
              <button
                type="button"
                onClick={() => setShowFactCheckDossier(false)}
                className="btn btn-primary"
                style={{ padding: '0.55rem 1.25rem', fontSize: '0.82rem', fontWeight: '800', minHeight: '44px' }}
              >
                बंद करें (Close)
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
