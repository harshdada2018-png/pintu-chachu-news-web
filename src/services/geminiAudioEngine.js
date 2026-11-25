/**
 * Gemini 2-Stage Audio TTS Engine
 * Server-side high fidelity neural audio with:
 *  - Clip 1: Headline + Highlights
 *  - Soothing Bell Chime + Pause
 *  - Clip 2: Body text (Triggered ONLY when user listens > 5 seconds to Clip 1)
 *  - Auto-fallback to browser speech if TTS quota is reached or audio fails
 */

let activeAudio = null;
let currentClipType = null; // 'clip_1' | 'chime' | 'clip_2' | null
let activeRate = 1.0;
let clip2Promise = null;
let clip2FetchTriggered = false;
let activeSessionId = 0;

export function getTwoStagePlaybackRate() {
  return activeRate;
}

export function setTwoStagePlaybackRate(rate) {
  activeRate = rate;
  if (activeAudio) {
    try {
      activeAudio.playbackRate = rate;
    } catch (e) {}
  }
}

export function pauseTwoStageAudio() {
  if (activeAudio) {
    try {
      activeAudio.pause();
    } catch (e) {}
  }
}

export function resumeTwoStageAudio() {
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
  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
      activeAudio.removeAttribute('src');
      activeAudio.load();
    } catch (e) {}
    activeAudio = null;
  }
  currentClipType = null;
  clip2Promise = null;
  clip2FetchTriggered = false;
}

export function seekTwoStageAudio(seconds) {
  if (activeAudio && !isNaN(seconds)) {
    try {
      activeAudio.currentTime = seconds;
    } catch (e) {}
  }
}

/**
 * Start 2-Stage Audio Playback
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
  onEnd,
  onError,
  onFallbackToBrowser
}) {
  stopTwoStageAudio();
  const sessionId = ++activeSessionId;

  // Crucial: Synchronously prime and unlock Audio element during user interaction gesture
  // This prevents Chrome/Safari "NotAllowedError" autoplay rejection after async network fetch
  const unlockedAudio = new Audio();
  unlockedAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
  try {
    const p = unlockedAudio.play();
    if (p !== undefined) {
      p.then(() => {
        // Only pause the silent primer if real Clip 1 hasn't already started
        if (currentClipType === null && sessionId === activeSessionId) {
          unlockedAudio.pause();
        }
      }).catch(() => {});
    }
  } catch (_e) {}
  activeAudio = unlockedAudio;

  // Guardrail: Assamese voice is explicitly not supported
  if (lang === 'as') {
    if (onError) onError(new Error('Assamese voice not supported.'));
    return { fallback: false, hidden: true };
  }

  if (onStart) onStart();

  try {
    // Stage 1: Request Clip 1 (Headline + Highlights)
    const res1 = await fetch('/api/tts/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        article_id: articleId,
        lang,
        clip_type: 'clip_1_intro',
        title,
        highlights
      })
    });

    if (sessionId !== activeSessionId) return { aborted: true };

    const data1 = await res1.json();

    // If quota exhausted or backend signaled browser fallback
    if (data1.fallback === 'browser' || data1.status === 'quota_exhausted') {
      console.warn('[Gemini TTS] Server reported quota exhausted. Using browser voice fallback.');
      return { fallback: true };
    }

    if (!data1.audio_url) {
      throw new Error(data1.error || 'Failed to obtain Clip 1 audio URL');
    }

    // Reuse the primed and unlocked active Audio element
    activeAudio.src = data1.audio_url;
    activeAudio.playbackRate = activeRate;

    currentClipType = 'clip_1';
    if (onClipChange) onClipChange('clip_1');

    activeAudio.onplay = () => {
      if (sessionId === activeSessionId && onPlay) onPlay();
    };

    activeAudio.ontimeupdate = () => {
      if (sessionId !== activeSessionId || !activeAudio) return;
      const cur = activeAudio.currentTime;
      const dur = activeAudio.duration || 0;
      if (onTimeUpdate) onTimeUpdate(cur, dur, currentClipType);

      // Crucial Quota Rule: Trigger Clip 2 background generation ONLY if listener exceeds 5 seconds
      if (!clip2FetchTriggered && (cur >= 5.0 || (dur > 0 && dur < 5.0 && cur >= dur * 0.8))) {
        clip2FetchTriggered = true;
        console.log(`[TTS 2-Stage] Listener exceeded 5s (${cur.toFixed(1)}s). Requesting Clip 2 (Body) in background.`);
        clip2Promise = fetch('/api/tts/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            article_id: articleId,
            lang,
            clip_type: 'clip_2_body',
            body
          })
        }).then(r => r.json()).catch(err => {
          console.error('[TTS Clip 2 Prefetch Error]', err);
          return null;
        });
      }
    };

    // Helper to start Clip 2 (Full Body)
    async function playClip2() {
      if (sessionId !== activeSessionId || !activeAudio) return;

      currentClipType = 'clip_2';
      if (onClipChange) onClipChange('clip_2');

      if (!clip2FetchTriggered && !clip2Promise) {
        clip2FetchTriggered = true;
        clip2Promise = fetch('/api/tts/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            article_id: articleId,
            lang,
            clip_type: 'clip_2_body',
            body
          })
        }).then(r => r.json()).catch(() => null);
      }

      let data2 = null;
      try {
        data2 = await clip2Promise;
      } catch (e) {
        console.error('[TTS Clip 2 Fetch Error]', e);
      }

      if (sessionId !== activeSessionId || !activeAudio) return;

      if (!data2 || !data2.audio_url || data2.fallback === 'browser') {
        console.warn('[TTS 2-Stage] Clip 2 unavailable. Switching smoothly to browser speech for body...');
        if (onFallbackToBrowser) {
          onFallbackToBrowser('clip_2');
        } else if (onEnd) {
          onEnd();
        }
        return;
      }

      // Continue on the SAME blessed audio element
      activeAudio.src = data2.audio_url;
      activeAudio.playbackRate = activeRate;
      try {
        await activeAudio.play();
        console.log('[TTS 2-Stage] Clip 2 (Body) is now actively playing.');
      } catch (play2Err) {
        console.error('[TTS Clip 2 Playback Error]', play2Err.message);
        if (onFallbackToBrowser) {
          onFallbackToBrowser('clip_2');
        } else if (onEnd) {
          onEnd();
        }
      }
    }

    // Continuous audio sequencer
    activeAudio.onended = async () => {
      if (sessionId !== activeSessionId) return;

      if (currentClipType === 'clip_1') {
        console.log('[TTS 2-Stage] Clip 1 ended. Playing soothing chime...');
        currentClipType = 'chime';
        if (onClipChange) onClipChange('chime');

        // Play chime on the SAME active audio element to maintain uninterrupted playback permissions
        activeAudio.src = '/audio/chime.wav';
        activeAudio.playbackRate = 1.0;
        try {
          await activeAudio.play();
        } catch (chimeErr) {
          console.warn('[Chime Playback Note]', chimeErr.message);
          playClip2();
        }
        return;
      }

      if (currentClipType === 'chime') {
        console.log('[TTS 2-Stage] Chime finished. Proceeding to Clip 2 (Body)...');
        playClip2();
        return;
      }

      if (currentClipType === 'clip_2') {
        console.log('[TTS 2-Stage] Full article playback finished.');
        stopTwoStageAudio();
        if (onEnd) onEnd();
      }
    };

    activeAudio.onerror = (e) => {
      const errCode = activeAudio?.error?.code;
      const errMsg = activeAudio?.error?.message;
      console.error(`[TTS Audio Element Error] Stage: ${currentClipType}, Code: ${errCode}, Message: ${errMsg}`);

      if (currentClipType === 'clip_1') {
        if (onError) onError(e);
      } else if (currentClipType === 'clip_2') {
        if (onFallbackToBrowser) {
          onFallbackToBrowser('clip_2');
        } else if (onEnd) {
          onEnd();
        }
      }
    };

    await activeAudio.play();
    return { fallback: false };

  } catch (err) {
    console.error('[Two-Stage TTS Exception]', err.message);
    if (onError) onError(err);
    return { fallback: true };
  }
}
