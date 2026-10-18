import React, { useState, useEffect, useRef } from 'react';
import { Clock, Eye, Share2, Bookmark, ArrowLeft, ShieldCheck, Flame, Radio, Languages, Loader2, Heart, Copy, Check, Send, X, ExternalLink, ThumbsUp, Lightbulb, Zap, Type, Sparkles } from 'lucide-react';
import TextToSpeech from './TextToSpeech';
import VideoEmbedPlayer from './VideoEmbedPlayer';
import MarkdownRenderer from '../../utils/markdownRenderer';
import { MOCK_LIVE_UPDATES } from '../../services/mockData';
import { startViewSession, sendHeartbeat, endViewSession, toggleArticleLike, fetchArticleLikes } from '../../services/analyticsService';
import { translateArticle, SUPPORTED_LANGUAGES } from '../../services/translationService';
import { stopAudioSpeech, clearArticleAudioCache } from '../../services/speechEngine';
import { t, translateCategoryName } from '../../services/uiTranslations';

export default function ArticleReader({ article, onBack, onSelectArticle, currentLanguage = 'en', onShowToast }) {
  const [displayArticle, setDisplayArticle] = useState(article);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [likesCount, setLikesCount] = useState(article?.likes_count || 184);
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [viewsCount, setViewsCount] = useState(article?.views_count || 1240);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [fontSizeMode, setFontSizeMode] = useState('md'); // 'sm' | 'md' | 'lg'
  const [reactions, setReactions] = useState({
    helpful: 42,
    hot: 88,
    inspiring: 29,
    shocking: 15
  });
  const [userReactions, setUserReactions] = useState({});

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

    startViewSession(article.id).then(data => {
      if (data && data.sessionId) {
        sessionIdRef.current = data.sessionId;
      }
    });

    const heartbeatInterval = setInterval(() => {
      if (sessionIdRef.current) {
        sendHeartbeat(sessionIdRef.current, maxScrollRef.current);
      }
    }, 5000);

    const handleScroll = () => {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        const pct = Math.min(100, Math.round((window.scrollY / docHeight) * 100));
        setScrollProgress(pct);
        if (pct > maxScrollRef.current) {
          maxScrollRef.current = pct;
        }
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    const handleUnload = () => {
      if (sessionIdRef.current) {
        const durationSecs = Math.round((Date.now() - startTimeRef.current) / 1000);
        endViewSession(sessionIdRef.current, durationSecs, maxScrollRef.current);
      }
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(heartbeatInterval);
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

  const fontSizeStyle = {
    sm: { fontSize: '0.92rem', lineHeight: '1.62', subTitleSize: '1.05rem', headlineSize: '2.15rem' },
    md: { fontSize: '1.15rem', lineHeight: '1.75', subTitleSize: '1.2rem', headlineSize: '2.5rem' },
    lg: { fontSize: '1.42rem', lineHeight: '1.9', subTitleSize: '1.38rem', headlineSize: '2.85rem' }
  }[fontSizeMode] || { fontSize: '1.15rem', lineHeight: '1.75', subTitleSize: '1.2rem', headlineSize: '2.5rem' };

  return (
    <article className="container" style={{ padding: '2rem 1.25rem', maxWidth: '840px', position: 'relative' }}>
      {/* Top Reading Progress Bar */}
      <div 
        style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          height: '3px', 
          width: `${scrollProgress}%`, 
          background: 'var(--accent-indigo)', 
          zIndex: 10000, 
          transition: 'width 0.1s linear',
          boxShadow: '0 1px 6px var(--accent-indigo)'
        }} 
      />

      {/* Top Controls Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <button 
          onClick={handleBackNavigation} 
          className="btn btn-outline" 
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.825rem' }}
        >
          <ArrowLeft size={15} /> {t('backToTopStories', currentLanguage)}
        </button>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
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

          <button
            onClick={handleShareClick}
            className="btn btn-outline"
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.825rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}
            title={t('share', currentLanguage)}
          >
            <Share2 size={15} /> {t('share', currentLanguage)}
          </button>

          <button
            onClick={handleBookmarkToggle}
            className="btn"
            style={{ 
              padding: '0.4rem 0.75rem', 
              fontSize: '0.825rem', 
              borderRadius: 'var(--radius-md)',
              border: isBookmarked ? '1px solid #f59e0b' : '1px solid var(--border-medium)',
              background: isBookmarked ? '#f59e0b' : 'var(--bg-surface)',
              color: isBookmarked ? '#ffffff' : 'var(--text-main)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              cursor: 'pointer',
              fontWeight: '700',
              transition: 'all 0.2s ease'
            }}
            title={isBookmarked ? t('saved', currentLanguage) : t('bookmark', currentLanguage)}
          >
            <Bookmark size={15} fill={isBookmarked ? '#ffffff' : 'none'} color={isBookmarked ? '#ffffff' : 'currentColor'} />
            {isBookmarked ? t('saved', currentLanguage) : t('bookmark', currentLanguage)}
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

      <div>
          {/* Category Badge & Breaking Flag */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span className="story-category-tag">{translateCategoryName(activeArticle.category, currentLanguage)}</span>
            {activeArticle.is_breaking && (
              <span className="badge badge-live">
                <Flame size={12} /> {t('breaking', currentLanguage)}
              </span>
            )}
            <span className="badge badge-verified">
              <ShieldCheck size={12} /> {t('factChecked', currentLanguage)}
            </span>
          </div>

          {/* Main Editorial Headline with Dynamic Font Size & Weight */}
          <h1 className="headline" style={{ fontSize: fontSizeStyle.headlineSize, fontWeight: 'var(--font-weight-heading, 800)', lineHeight: '1.2', marginBottom: '1rem', transition: 'font-size 0.2s ease, font-weight 0.2s ease' }}>
            {activeArticle.title}
          </h1>

          {/* Subheading / Standfirst with Dynamic Font Size */}
          {activeArticle.sub_title && (
            <p className="story-excerpt" style={{ fontSize: fontSizeStyle.subTitleSize, color: 'var(--text-muted)', marginBottom: '1.5rem', fontWeight: '500', transition: 'font-size 0.2s ease' }}>
              {activeArticle.sub_title}
            </p>
          )}

          {/* Author Byline & Timestamps Bar */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            padding: '1rem 0',
            borderTop: '1px solid var(--border-light)',
            borderBottom: '1px solid var(--border-light)',
            marginBottom: '1.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {activeArticle.author?.avatar && (
                <img 
                  src={activeArticle.author.avatar} 
                  alt={activeArticle.author.name}
                  style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover' }} 
                />
              )}
              <div>
                <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>{activeArticle.author?.name || 'PublicSpark Desk'}</div>
                <div style={{ fontSize: '0.775rem', color: 'var(--text-subtle)' }}>{activeArticle.author?.role || 'Staff Reporter'}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-subtle)', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Clock size={14} /> {activeArticle.published_at} ({activeArticle.reading_time_mins} {t('minsRead', currentLanguage)})
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: '600', color: 'var(--text-main)' }}>
                <Eye size={14} color="var(--accent-crimson)" /> {(viewsCount || 1240).toLocaleString()} {t('views', currentLanguage)}
              </span>
              <button
                onClick={handleLikeToggle}
                className="btn"
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.8rem',
                  borderRadius: '20px',
                  border: isLiked ? '1px solid #ef4444' : '1px solid var(--border-medium)',
                  background: isLiked ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-surface)',
                  color: isLiked ? '#ef4444' : 'var(--text-main)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <Heart size={15} fill={isLiked ? '#ef4444' : 'none'} color={isLiked ? '#ef4444' : 'currentColor'} />
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
              borderLeft: '4px solid var(--accent-indigo)',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem 1.5rem',
              margin: '1.75rem 0',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)'
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
            />
          </div>
        </div>

      {/* Live Blog Stream (If Format is Live) */}
      {activeArticle.format === 'live' && (
        <div style={{ margin: '2.5rem 0', background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--accent-crimson)' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--accent-crimson)' }}>
            <Radio size={18} /> Live News Coverage Updates
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {MOCK_LIVE_UPDATES.map((update) => (
              <div key={update.id} style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--accent-crimson)', textTransform: 'uppercase' }}>
                  {update.time}
                </span>
                <h4 style={{ fontSize: '1rem', fontWeight: '700', margin: '0.25rem 0 0.5rem 0' }}>{update.headline}</h4>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{update.body}</p>
              </div>
            ))}
          </div>
        </div>
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
              borderRadius: '20px',
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
          <button
            onClick={handleShareClick}
            className="btn btn-outline"
            style={{
              padding: '0.45rem 1rem',
              fontSize: '0.85rem',
              borderRadius: '20px',
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
              borderRadius: '20px',
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
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
          }}
          onClick={() => setIsShareModalOpen(false)}
        >
          <div 
            style={{
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              padding: '1.75rem',
              maxWidth: '480px',
              width: '100%',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-main)',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
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
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(activeArticle.title + ' - ' + window.location.href)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline"
                style={{ padding: '0.6rem 0.4rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', textDecoration: 'none' }}
              >
                <Send size={18} color="#25D366" />
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
    </article>
  );
}
