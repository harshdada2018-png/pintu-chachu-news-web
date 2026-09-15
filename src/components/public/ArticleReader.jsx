import React, { useState, useEffect, useRef } from 'react';
import { Clock, Eye, Share2, Bookmark, ArrowLeft, ShieldCheck, Flame, Radio, Languages, Loader2 } from 'lucide-react';
import TextToSpeech from './TextToSpeech';
import VideoEmbedPlayer from './VideoEmbedPlayer';
import MarkdownRenderer from '../../utils/markdownRenderer';
import { MOCK_LIVE_UPDATES } from '../../services/mockData';
import { startViewSession, sendHeartbeat, endViewSession } from '../../services/analyticsService';
import { translateArticle } from '../../services/translationService';
import { stopAudioSpeech, clearArticleAudioCache } from '../../services/speechEngine';

export default function ArticleReader({ article, onBack, onSelectArticle, currentLanguage = 'en' }) {
  const [displayArticle, setDisplayArticle] = useState(article);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
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

            <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.8rem', color: 'var(--text-subtle)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Clock size={14} /> {activeArticle.published_at} ({activeArticle.reading_time_mins} min read)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Eye size={14} /> {activeArticle.views_count ? activeArticle.views_count.toLocaleString() : '1,240'} views
              </span>
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
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.825rem' }}>
            <Share2 size={15} /> Share Article
          </button>
          <button className="btn btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.825rem' }}>
            <Bookmark size={15} /> Bookmark
          </button>
        </div>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-subtle)' }}>
          PublicSpark Verified News Engine
        </span>
      </div>
    </article>
  );
}
