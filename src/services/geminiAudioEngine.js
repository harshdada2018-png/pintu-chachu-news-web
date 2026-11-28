/**
 * Gemini 1-Call Broadcast Audio TTS Engine
 * Minimal-quota single-call audio synthesis with soothing broadcast intro chime:
 *  - 0ms Intro Bell Chime (/audio/chime.wav, 1.80s) played synchronously inside user gesture
 *  - Parallel single /api/tts/generate call synthesizing Title + Highlights + Full Body once
 *  - Shared D1 / Disk / Session caching across readers (1 Gemini call total per article+lang)
 *  - Auto-fallback to native browser speech if TTS quota is exhausted or audio fails
 */

let activeAudio = null;
let currentClipType = null; // 'chime' | 'full_story' | null
let activeRate = 1.0;
let activeSessionId = 0;
let isPausedByUser = false;
const sessionAudioUrlCache = new Map();
const MAX_SESSION_AUDIO_CACHE = 30;

function readSessionAudioUrl(key) {
  return sessionAudioUrlCache.get(key) || null;
}

function saveSessionAudioUrl(key, audioUrl) {
  if (!key || !audioUrl) return;
  if (sessionAudioUrlCache.has(key)) sessionAudioUrlCache.delete(key);
  sessionAudioUrlCache.set(key, audioUrl);
  if (sessionAudioUrlCache.size > MAX_SESSION_AUDIO_CACHE) {
    const oldestKey = sessionAudioUrlCache.keys().next().value;
    if (oldestKey) sessionAudioUrlCache.delete(oldestKey);
  }
}

export function getTwoStagePlaybackRate() {
  return activeRate;
}

export function setTwoStagePlaybackRate(rate) {
  activeRate = rate;
  if (activeAudio && currentClipType === 'full_story') {
    try {
      activeAudio.playbackRate = rate;
    } catch (e) {}
  }
}

export function pauseTwoStageAudio() {
  isPausedByUser = true;
  if (activeAudio) {
    try {
      activeAudio.pause();
    } catch (e) {}
  }
}

export function resumeTwoStageAudio() {
  isPausedByUser = false;
  if (activeAudio && activeAudio.src && currentClipType && activeAudio.paused) {
    try {
      const p = activeAudio.play();
      if (p && typeof p.catch === 'function') {
        p.catch((err) => console.warn('[TTS Resume Error]', err.message));
      }
      return true;
    } catch (_e) {}
  }
  return false;
}

export function stopTwoStageAudio() {
  activeSessionId++;
  isPausedByUser = false;
  if (activeAudio) {
    try {
      activeAudio.onplay = null;
      activeAudio.ontimeupdate = null;
      activeAudio.onended = null;
      activeAudio.onerror = null;
      activeAudio.pause();
      activeAudio.currentTime = 0;
      activeAudio.removeAttribute('src');
      activeAudio.load();
    } catch (e) {}
    activeAudio = null;
  }
  currentClipType = null;
}

export function seekTwoStageAudio(seconds) {
  if (activeAudio && currentClipType === 'full_story' && !isNaN(seconds)) {
    try {
      activeAudio.currentTime = seconds;
    } catch (e) {}
  }
}

/**
 * Start 1-Call Audio Playback with 1.80s Broadcast Intro Bell
 */
export async function playTwoStageAudio({
  articleId,
  lang = 'hi',
  title = '',
  highlights = [],
  body = '',
  onStart,
  onPlay,
  onTimeUpdate,
  onClipChange,
  onClipLoading,
  onEnd,
  onError,
  onFallbackToBrowser
}) {
  stopTwoStageAudio();
  const sessionId = ++activeSessionId;
  isPausedByUser = false;

  // Guardrail: Audio TTS currently enabled only for Hindi ('hi') and English ('en')
  const baseLang = String(lang || '').trim().toLowerCase().split(/[-_]/)[0];
  if (!['hi', 'en'].includes(baseLang)) {
    if (onEnd) onEnd();
    return { fallback: false, hidden: true };
  }

  const fullStoryKey = `${articleId || 'general'}_${baseLang}_full_story`;

  // Synchronously create blessed Audio element inside user click gesture
  const audio = new Audio();
  activeAudio = audio;

  if (onStart) onStart();

  // Launch single combined Gemini TTS request (or 0ms session hit) immediately in parallel with bell chime
  const cachedUrl = readSessionAudioUrl(fullStoryKey);
  const fullStoryPromise = cachedUrl
    ? Promise.resolve({ audio_url: cachedUrl, status: 'done', isCached: true })
    : (() => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 50000);
        return fetch('/api/tts/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            article_id: articleId,
            lang: baseLang,
            clip_type: 'full_story',
            title,
            highlights,
            body
          })
        })
          .then(r => r.json())
          .catch(() => null)
          .finally(() => clearTimeout(timer));
      })();

  let fullStoryStarted = false;

  async function playFullStory() {
    if (fullStoryStarted || sessionId !== activeSessionId || !activeAudio) return;
    fullStoryStarted = true;

    currentClipType = 'full_story';
    if (onClipChange) onClipChange('full_story');
    if (onClipLoading) onClipLoading(true);

    let data = null;
    try {
      data = await fullStoryPromise;
    } catch (_e) {}

    if (sessionId !== activeSessionId || !activeAudio) {
      if (onClipLoading) onClipLoading(false);
      return;
    }

    if (!data || !data.audio_url || data.fallback === 'browser' || data.status === 'quota_exhausted') {
      console.warn('[Gemini TTS] Audio unavailable or quota exhausted. Switching smoothly to browser voice...');
      if (onClipLoading) onClipLoading(false);
      if (isPausedByUser) return;
      if (onFallbackToBrowser) {
        onFallbackToBrowser('full_story');
      } else if (onError) {
        onError(new Error(data?.error || 'Gemini TTS unavailable'));
      }
      return;
    }

    saveSessionAudioUrl(fullStoryKey, data.audio_url);
    activeAudio.src = data.audio_url;
    activeAudio.playbackRate = activeRate;

    if (isPausedByUser) {
      if (onClipLoading) onClipLoading(false);
      return;
    }

    try {
      await activeAudio.play();
      if (onClipLoading) onClipLoading(false);
    } catch (playErr) {
      if (playErr && playErr.name === 'AbortError' && sessionId === activeSessionId && activeAudio) {
        await new Promise(r => setTimeout(r, 30));
        if (sessionId === activeSessionId && activeAudio) {
          try {
            await activeAudio.play();
            if (onClipLoading) onClipLoading(false);
            return;
          } catch (_retryErr) {}
        }
      }
      console.error('[TTS Full Story Playback Error]', playErr?.message || playErr);
      sessionAudioUrlCache.delete(fullStoryKey);
      if (onClipLoading) onClipLoading(false);
      if (onFallbackToBrowser) {
        onFallbackToBrowser('full_story');
      } else if (onEnd) {
        onEnd();
      }
    }
  }

  audio.onplay = () => {
    if (sessionId !== activeSessionId) return;
    if (currentClipType === 'full_story' && onClipLoading) onClipLoading(false);
    if (onPlay) onPlay();
  };

  audio.ontimeupdate = () => {
    if (sessionId !== activeSessionId || !activeAudio) return;
    if (currentClipType !== 'full_story') return;
    const cur = activeAudio.currentTime || 0;
    const dur = activeAudio.duration || 0;
    if (onTimeUpdate) onTimeUpdate(cur, dur, currentClipType);
  };

  audio.onended = () => {
    if (sessionId !== activeSessionId) return;
    if (currentClipType === 'chime') {
      playFullStory();
      return;
    }
    if (currentClipType === 'full_story') {
      stopTwoStageAudio();
      if (onEnd) onEnd();
    }
  };

  audio.onerror = (e) => {
    if (sessionId !== activeSessionId) return;
    if (currentClipType === 'chime') {
      playFullStory();
      return;
    }
    sessionAudioUrlCache.delete(fullStoryKey);
    if (onClipLoading) onClipLoading(false);
    if (onFallbackToBrowser) {
      onFallbackToBrowser('full_story');
    } else if (onError) {
      onError(e);
    }
  };

  // Start soothing 1.80s newsroom intro bell synchronously while 1-call Gemini TTS loads
  currentClipType = 'chime';
  if (onClipChange) onClipChange('chime');
  if (onPlay) onPlay();

  audio.src = '/audio/chime.wav';
  audio.playbackRate = 1.0;

  try {
    await audio.play();
    return { fallback: false };
  } catch (_chimeErr) {
    await playFullStory();
    return { fallback: false };
  }
}
