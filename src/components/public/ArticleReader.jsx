import React, { useState, useEffect, useRef } from 'react';
import { Clock, Eye, Share2, Bookmark, ArrowLeft, ShieldCheck, Flame, Radio, Languages, Loader2, Heart, Copy, Check, Send, X, ExternalLink } from 'lucide-react';
import TextToSpeech from './TextToSpeech';
import VideoEmbedPlayer from './VideoEmbedPlayer';
import MarkdownRenderer from '../../utils/markdownRenderer';
import { MOCK_LIVE_UPDATES } from '../../services/mockData';
import { startViewSession, sendHeartbeat, endViewSession, toggleArticleLike, fetchArticleLikes } from '../../services/analyticsService';
import { translateArticle } from '../../services/translationService';
import { stopAudioSpeech, clearArticleAudioCache } from '../../services/speechEngine';

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
  const sessionIdRef = useRef(null);
  const startTimeRef = useRef(Date.now());
  const maxScrollRef = useRef(0);

  // Dynamic real-time article translation when language changes or article opens
  useEffect(() => {
    let isSubscribed = true;

    if (!article) return;

    setDisplayArticle(article);

    if (currentLanguage === 'en') {
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
      onShowToast(nextState ? 'Article saved to your Bookmarks! 🔖' : 'Article removed from Bookmarks.');
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
      if (onShowToast) onShowToast('Article link copied to clipboard! 📋');
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

  const activeArticle = showOriginal ? article : (displayArticle || article);
  const activeLang = showOriginal ? 'en' : currentLanguage;

  return (
    <article className="container" style={{ padding: '2rem 1.25rem', maxWidth: '840px' }}>
      {/* Top Controls Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <button 
          onClick={handleBackNavigation} 
          className="btn btn-outline" 
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.825rem' }}
        >
          <ArrowLeft size={15} /> Back to Top Stories
        </button>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {currentLanguage !== 'en' && !isTranslating && (
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
              {showOriginal ? 'Switch to Translated Text' : 'View Original (English)'}
            </button>
          )}

          <button
            onClick={handleShareClick}
            className="btn btn-outline"
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.825rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}
            title="Share Article"
          >
            <Share2 size={15} /> Share
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
            title={isBookmarked ? 'Bookmarked' : 'Bookmark Article'}
          >
            <Bookmark size={15} fill={isBookmarked ? '#ffffff' : 'none'} color={isBookmarked ? '#ffffff' : 'currentColor'} />
            {isBookmarked ? 'Saved' : 'Bookmark'}
          </button>
        </div>
      </div>

      {/* Glassmorphic Skeleton Shimmer Loader during Translation */}
      {isTranslating ? (
        <div style={{ 
          padding: '2.5rem 1.5rem', 
          background: 'var(--bg-surface)', 
          borderRadius: 'var(--radius-lg)', 
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--accent-crimson)', marginBottom: '1.5rem', fontWeight: '700', fontSize: '0.95rem' }}>
            <Loader2 size={18} className="spin-animation" />
            <span>Translating article into selected language...</span>
          </div>

          {/* Skeleton Title Lines */}
          <div style={{ height: '32px', background: 'var(--border-light)', borderRadius: '6px', marginBottom: '12px', width: '90%', animation: 'pulse 1.5s infinite' }}></div>
          <div style={{ height: '32px', background: 'var(--border-light)', borderRadius: '6px', marginBottom: '24px', width: '65%', animation: 'pulse 1.5s infinite' }}></div>

          {/* Skeleton Subtitle */}
          <div style={{ height: '20px', background: 'var(--border-light)', borderRadius: '4px', marginBottom: '24px', width: '80%', animation: 'pulse 1.5s infinite' }}></div>

          {/* Skeleton Image Placeholder */}
          <div style={{ height: '280px', background: 'var(--border-light)', borderRadius: 'var(--radius-md)', marginBottom: '24px', width: '100%', animation: 'pulse 1.5s infinite' }}></div>

          {/* Skeleton Content Lines */}
          <div style={{ height: '16px', background: 'var(--border-light)', borderRadius: '4px', marginBottom: '10px', width: '100%', animation: 'pulse 1.5s infinite' }}></div>
          <div style={{ height: '16px', background: 'var(--border-light)', borderRadius: '4px', marginBottom: '10px', width: '95%', animation: 'pulse 1.5s infinite' }}></div>
          <div style={{ height: '16px', background: 'var(--border-light)', borderRadius: '4px', marginBottom: '10px', width: '88%', animation: 'pulse 1.5s infinite' }}></div>
        </div>
      ) : (
        <>
          {/* Category Badge & Breaking Flag */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span className="story-category-tag">{activeArticle.category}</span>
            {activeArticle.is_breaking && (
              <span className="badge badge-live">
                <Flame size={12} /> Breaking News
              </span>
            )}
            <span className="badge badge-verified">
              <ShieldCheck size={12} /> Fact Checked
            </span>
          </div>

          {/* Main Editorial Headline */}
          <h1 className="headline" style={{ fontSize: '2.5rem', fontWeight: '800', lineHeight: '1.2', marginBottom: '1rem' }}>
            {activeArticle.title}
          </h1>

          {/* Subheading / Standfirst */}
          {activeArticle.sub_title && (
            <p className="story-excerpt" style={{ fontSize: '1.2rem', color: 'var(--text-muted)', marginBottom: '1.5rem', fontWeight: '500' }}>
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
                <Clock size={14} /> {activeArticle.published_at} ({activeArticle.reading_time_mins} min read)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: '600', color: 'var(--text-main)' }}>
                <Eye size={14} color="var(--accent-crimson)" /> {(viewsCount || 1240).toLocaleString()} views
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
                <span>{likesCount.toLocaleString()} {likesCount === 1 ? 'Like' : 'Likes'}</span>
              </button>
            </div>
          </div>

          {/* Text-to-Speech Audio Reader Component */}
          <TextToSpeech 
            title={activeArticle.title} 
            textToRead={[activeArticle.sub_title, activeArticle.summary, activeArticle.content].filter(Boolean).join('. ')} 
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

          {/* Article Body Content Rendered via MarkdownRenderer */}
          <div style={{ marginBottom: '2rem' }}>
            <MarkdownRenderer content={activeArticle.content} />
          </div>
        </>
      )}

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
            <span>{isLiked ? 'Liked' : 'Like'} ({likesCount.toLocaleString()})</span>
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
            <Share2 size={15} /> Share Article
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
            <span>{isBookmarked ? 'Bookmarked' : 'Bookmark'}</span>
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
                <Share2 size={18} color="var(--accent-crimson)" /> Share Article
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
                {copiedLink ? 'Copied!' : 'Copy Link'}
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
