import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Pause, Play, Loader2, Gauge, RotateCcw, Sparkles, Bell } from 'lucide-react';
import { t } from '../../services/uiTranslations';
import { 
  playTwoStageAudio, 
  pauseTwoStageAudio, 
  resumeTwoStageAudio, 
  stopTwoStageAudio, 
  seekTwoStageAudio, 
  setTwoStagePlaybackRate, 
  getTwoStagePlaybackRate 
} from '../../services/geminiAudioEngine';
import { 
  speakWithBrowserSpeechOnly, 
  setFallbackPlaybackRate,
  setAudioPlaybackRate,
  isAudioSupportedLanguage,
  pauseAudioSpeech, 
  resumeAudioSpeech, 
  stopAudioSpeech 
} from '../../services/speechEngine';
const AVAILABLE_SPEEDS = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export default function TextToSpeech({ 
  textToRead = '', 
  title = '', 
  highlights = [], 
  currentLanguage = 'en', 
  articleId = null 
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(getTwoStagePlaybackRate() || 1.0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [clipStatus, setClipStatus] = useState('idle'); // 'clip_1' | 'chime' | 'clip_2' | 'browser'
  const isUsingBrowserFallback = useRef(false);

  // Stop audio on language change or unmount
  useEffect(() => {
    stopTwoStageAudio();
    stopAudioSpeech();
    setIsPlaying(false);
    setIsLoading(false);
    setCurrentTime(0);
    setDuration(0);
    setClipStatus('idle');
    isUsingBrowserFallback.current = false;

    return () => {
      stopTwoStageAudio();
      stopAudioSpeech();
    };
  }, [articleId, currentLanguage]);

  const handleToggleSpeech = async (e) => {
    if (e) e.stopPropagation();

    if (isLoading) {
      stopTwoStageAudio();
      stopAudioSpeech();
      setIsPlaying(false);
      setIsLoading(false);
      setCurrentTime(0);
      setClipStatus('idle');
      return;
    }

    if (isPlaying) {
      if (isUsingBrowserFallback.current) {
        pauseAudioSpeech();
      } else {
        pauseTwoStageAudio();
      }
      setIsPlaying(false);
      return;
    }

    // Try resuming active paused stream
    if (!isUsingBrowserFallback.current) {
      const resumed = resumeTwoStageAudio();
      if (resumed) {
        setIsPlaying(true);
        return;
      }
    } else {
      const resumed = resumeAudioSpeech();
      if (resumed) {
        setIsPlaying(true);
        return;
      }
    }

    // Begin fresh 2-stage audio stream
    setIsLoading(true);
    let fallbackTriggered = false;

    const triggerBrowserFallback = (textToSpeak) => {
      if (fallbackTriggered) return;
      fallbackTriggered = true;
      console.log('[TTS] Smoothly falling back to native browser speech...');
      isUsingBrowserFallback.current = true;
      setClipStatus('browser');

      speakWithBrowserSpeechOnly({
        text: textToSpeak,
        langCode: currentLanguage,
        rate: currentSpeed,
        onStart: () => setIsLoading(true),
        onPlay: () => {
          setIsLoading(false);
          setIsPlaying(true);
        },
        onTimeUpdate: (cur, dur) => {
          setCurrentTime(cur);
          if (dur > 0) setDuration(dur);
        },
        onEnd: () => {
          setIsLoading(false);
          setIsPlaying(false);
          setCurrentTime(0);
          setClipStatus('idle');
        }
      });
    };

    const fullArticleText = highlights && highlights.length 
      ? `${title}. ${highlights.join('. ')}. ${textToRead}`
      : `${title}. ${textToRead}`;

    const result = await playTwoStageAudio({
      articleId: articleId || 'general',
      lang: currentLanguage,
      title,
      highlights: Array.isArray(highlights) ? highlights : [],
      body: textToRead,
      onStart: () => {
        setIsLoading(true);
      },
      onPlay: () => {
        setIsLoading(false);
        setIsPlaying(true);
      },
      onClipChange: (stage) => {
        setClipStatus(stage);
      },
      onClipLoading: (loading) => {
        setIsLoading(Boolean(loading));
      },
      onTimeUpdate: (cur, dur, stage) => {
        setCurrentTime(cur);
        if (dur > 0) setDuration(dur);
      },
      onEnd: () => {
        setIsPlaying(false);
        setIsLoading(false);
        setCurrentTime(0);
        setClipStatus('idle');
      },
      onError: () => {
        triggerBrowserFallback(fullArticleText);
      },
      onFallbackToBrowser: () => {
        triggerBrowserFallback(fullArticleText);
      }
    });

    // If quota exhausted or TTS initial call failed, fall back immediately
    if (result && result.fallback) {
      triggerBrowserFallback(fullArticleText);
    }
  };

  const handleSeek = (e) => {
    if (e) e.stopPropagation();
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (!isUsingBrowserFallback.current) {
      seekTwoStageAudio(newTime);
    }
  };

  const handleRestart = (e) => {
    if (e) e.stopPropagation();
    stopTwoStageAudio();
    stopAudioSpeech();
    setIsPlaying(false);
    setIsLoading(false);
    setCurrentTime(0);
    setClipStatus('idle');
  };

  const handleCycleSpeed = (e) => {
    if (e) e.stopPropagation();
    const currentIndex = AVAILABLE_SPEEDS.indexOf(currentSpeed);
    const nextIndex = (currentIndex + 1) % AVAILABLE_SPEEDS.length;
    const nextSpeed = AVAILABLE_SPEEDS[nextIndex];
    setCurrentSpeed(nextSpeed);
    setTwoStagePlaybackRate(nextSpeed);
    setAudioPlaybackRate(nextSpeed);
    setFallbackPlaybackRate(nextSpeed);
  };

  const isExpanded = isPlaying || isLoading || currentTime > 0;

  // Restrict audio feature strictly to Hindi ('hi') and English ('en')
  if (!isAudioSupportedLanguage(currentLanguage)) {
    return null;
  }

  return (
    <div 
      className={`audio-player-bar ${isExpanded ? 'expanded' : ''}`} 
      title={isPlaying ? t('clickToPauseAudio', currentLanguage) : t('clickToPlayAudio', currentLanguage)}
    >
      {/* Round Play/Pause Button */}
      <button 
        type="button"
        className="audio-btn" 
        onClick={handleToggleSpeech}
        aria-label={isPlaying ? "Pause Audio Reader" : "Play Story Audio Reader"}
      >
        {isLoading ? (
          <Loader2 size={18} className="spin-animation" />
        ) : isPlaying ? (
          <Pause size={20} />
        ) : (
          <Play size={20} style={{ marginLeft: '2px' }} />
        )}
      </button>

      {/* Collapsed State Label */}
      {!isExpanded ? (
        <button
          type="button"
          onClick={handleToggleSpeech}
          className="audio-pill-label-btn"
          aria-label={t('listenToStory', currentLanguage)}
        >
          <span>{t('listenToStory', currentLanguage)}</span>
          <Volume2 size={15} color="var(--accent-crimson)" />
        </button>
      ) : (
        /* Rollout Expanded Interactive Audio Timeline Bar */
        <div className="audio-player-content" style={{ flex: 1, gap: '0.85rem' }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-main)', gap: '0.5rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <Volume2 size={14} color="var(--accent-crimson)" style={{ flexShrink: 0 }} />
                {isLoading ? (
                  t('generatingVoice', currentLanguage)
                ) : clipStatus === 'chime' ? (
                  <span style={{ color: 'var(--accent-crimson)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    <Bell size={12} /> {t('upNextBody', currentLanguage)}
                  </span>
                ) : clipStatus === 'full_story' ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    <Sparkles size={12} color="var(--accent-crimson)" /> {t('playingAudio', currentLanguage)}
                  </span>
                ) : isPlaying ? (
                  t('playingAudio', currentLanguage)
                ) : (
                  t('audioPaused', currentLanguage)
                )}
              </span>
              <span style={{ color: 'var(--text-subtle)', fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                {formatTime(currentTime)} / {duration > 0 ? formatTime(duration) : '--:--'}
              </span>
            </div>

            {/* Interactive Progress Bar Scrubber */}
            <input 
              type="range"
              className="audio-scrubber-range"
              min="0"
              max={duration > 0 ? duration : 1}
              step="0.1"
              value={currentTime}
              disabled={isUsingBrowserFallback.current}
              onChange={handleSeek}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                minHeight: '28px',
                padding: '10px 0',
                accentColor: 'var(--accent-crimson)',
                cursor: isUsingBrowserFallback.current ? 'default' : 'pointer',
                background: 'transparent'
              }}
              title={isUsingBrowserFallback.current ? 'Browser speech progress' : 'Seek playback'}
            />
          </div>

          {/* Equalizer animation when playing */}
          {isPlaying && (
            <div className="equalizer-container" style={{ marginLeft: '0.1rem' }}>
              <div className="equalizer-bar" />
              <div className="equalizer-bar" />
              <div className="equalizer-bar" />
              <div className="equalizer-bar" />
            </div>
          )}

          {/* Restart Button */}
          {currentTime > 0 && (
            <button
              type="button"
              onClick={handleRestart}
              title="Restart Audio"
              style={{
                background: 'none',
                border: '1px solid var(--border-light)',
                borderRadius: '4px',
                color: 'var(--text-main)',
                cursor: 'pointer',
                minWidth: '36px',
                minHeight: '36px',
                padding: '0.3rem',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <RotateCcw size={15} />
            </button>
          )}

          {/* Speed Selector */}
          <button
            type="button"
            onClick={handleCycleSpeed}
            title="Reading Speed"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.35rem 0.65rem',
              minHeight: '36px',
              borderRadius: '20px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-main)',
              fontSize: '0.775rem',
              fontWeight: '700',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            <Gauge size={13} color="var(--accent-crimson)" />
            <span>{currentSpeed}x {t('speed', currentLanguage)}</span>
          </button>
        </div>
      )}
    </div>
  );
}
