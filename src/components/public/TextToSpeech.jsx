import React, { useState, useEffect } from 'react';
import { Volume2, Pause, Play, Loader2, Gauge, RotateCcw } from 'lucide-react';
import { 
  speakTextWithNaturalVoice, 
  pauseAudioSpeech,
  resumeAudioSpeech,
  stopAudioSpeech, 
  setAudioPlaybackRate, 
  getAudioPlaybackRate, 
  seekActiveAudio, 
  getSavedAudioPosition, 
  fetchBackendAudioPosition,
  saveAudioPosition,
  clearSavedAudioPosition 
} from '../../services/speechEngine';

const AVAILABLE_SPEEDS = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export default function TextToSpeech({ textToRead, title, currentLanguage = 'en', articleId = null }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(getAudioPlaybackRate() || 1.0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Sync saved position and stop old language stream on language or article change
  useEffect(() => {
    let isSubscribed = true;
    stopAudioSpeech();
    setIsPlaying(false);
    setIsLoading(false);
    setCurrentTime(0);
    setDuration(0);

    if (articleId && currentLanguage) {
      const syncPosition = async () => {
        const savedPos = await fetchBackendAudioPosition(articleId, currentLanguage);
        if (isSubscribed && savedPos > 0) {
          setCurrentTime(savedPos);
        }
      };
      syncPosition();
    }

    return () => {
      isSubscribed = false;
    };
  }, [articleId, currentLanguage]);

  const handleToggleSpeech = (e) => {
    if (e) e.stopPropagation();

    if (isPlaying) {
      pauseAudioSpeech();
      setIsPlaying(false);
      setIsLoading(false);
      if (articleId && currentLanguage && currentTime > 0) {
        saveAudioPosition(articleId, currentLanguage, currentTime);
      }
    } else if (isLoading) {
      stopAudioSpeech();
      setIsPlaying(false);
      setIsLoading(false);
    } else {
      // Check if we can resume an existing loaded audio element in memory
      const resumed = resumeAudioSpeech();
      if (resumed) {
        setIsPlaying(true);
        return;
      }

      // Otherwise start/fetch audio stream
      const fullText = `${title}. ${textToRead}`;
      setIsLoading(true);

      const savedPos = getSavedAudioPosition(articleId, currentLanguage) || currentTime;

      speakTextWithNaturalVoice({
        text: fullText,
        langCode: currentLanguage,
        articleId,
        startPosition: savedPos,
        onStart: () => setIsLoading(true),
        onPlay: () => {
          setIsLoading(false);
          setIsPlaying(true);
        },
        onTimeUpdate: (cur, dur) => {
          setCurrentTime(cur);
          if (dur && !isNaN(dur) && dur > 0) {
            setDuration(dur);
          }
        },
        onEnd: () => {
          setIsLoading(false);
          setIsPlaying(false);
          setCurrentTime(0);
          if (articleId && currentLanguage) {
            clearSavedAudioPosition(articleId, currentLanguage);
          }
        }
      });
    }
  };

  const handleSeek = (e) => {
    if (e) e.stopPropagation();
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    seekActiveAudio(newTime);
    if (articleId && currentLanguage) {
      saveAudioPosition(articleId, currentLanguage, newTime);
    }
  };

  const handleRestart = (e) => {
    if (e) e.stopPropagation();
    stopAudioSpeech();
    setIsPlaying(false);
    setIsLoading(false);
    setCurrentTime(0);
    if (articleId && currentLanguage) {
      clearSavedAudioPosition(articleId, currentLanguage);
    }
  };

  const handleCycleSpeed = (e) => {
    if (e) e.stopPropagation();
    const currentIndex = AVAILABLE_SPEEDS.indexOf(currentSpeed);
    const nextIndex = (currentIndex + 1) % AVAILABLE_SPEEDS.length;
    const nextSpeed = AVAILABLE_SPEEDS[nextIndex];
    setCurrentSpeed(nextSpeed);
    setAudioPlaybackRate(nextSpeed);
  };

  const isExpanded = isPlaying || isLoading || currentTime > 0;

  return (
    <div 
      className={`audio-player-bar ${isExpanded ? 'expanded' : ''}`} 
      onClick={handleToggleSpeech} 
      title={isPlaying ? "Click to Pause Audio" : "Click to Play/Resume Audio"}
    >
      {/* Round Play/Pause Button */}
      <button 
        className="audio-btn" 
        aria-label={isPlaying ? "Pause Audio Reader" : "Play/Resume Audio Reader"}
      >
        {isLoading ? (
          <Loader2 size={18} className="spin-animation" />
        ) : isPlaying ? (
          <Pause size={20} />
        ) : (
          <Play size={20} style={{ marginLeft: '2px' }} />
        )}
      </button>

      {/* Collapsed State Label when no audio active and 0 progress */}
      {!isExpanded ? (
        <div style={{ fontSize: '0.875rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
          <span>Listen to Story</span>
          <Volume2 size={15} color="var(--accent-indigo)" />
        </div>
      ) : (
        /* Rollout Expanded Interactive Audio Scrubber Timeline Bar */
        <div className="audio-player-content" style={{ flex: 1, gap: '0.85rem' }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, minWidth: '180px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-main)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Volume2 size={14} color="var(--accent-indigo)" />
                {isLoading ? 'Preparing Audio...' : isPlaying ? 'Playing Audio' : 'Audio Paused'}
              </span>
              <span style={{ color: 'var(--text-subtle)', fontFamily: 'monospace' }}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {/* Interactive Progress Bar Scrubber Slider */}
            <input 
              type="range"
              min="0"
              max={duration || 100}
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                height: '5px',
                borderRadius: '3px',
                accentColor: 'var(--accent-indigo)',
                cursor: 'pointer',
                background: 'var(--border-medium)'
              }}
              title="Drag or click to seek forward/backward"
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
              onClick={handleRestart}
              title="Restart Audio from Beginning"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-subtle)',
                cursor: 'pointer',
                padding: '0.2rem',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <RotateCcw size={15} />
            </button>
          )}

          {/* Reading Speed Controller Button */}
          <button
            onClick={handleCycleSpeed}
            title="Click to Change Reading Speed (0.75x, 1.0x, 1.25x, 1.5x, 1.75x, 2.0x)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.35rem 0.65rem',
              borderRadius: '20px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-main)',
              fontSize: '0.775rem',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
              boxShadow: 'var(--shadow-sm)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-indigo)';
              e.currentTarget.style.transform = 'scale(1.04)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-medium)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <Gauge size={13} color="var(--accent-indigo)" />
            <span>{currentSpeed}x Speed</span>
          </button>
        </div>
      )}
    </div>
  );
}
