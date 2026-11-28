/**
 * PublicSpark Backend Audio Service & Client Cache Engine
 * High-performance In-Memory + Safe Local Storage caching engine.
 * Eliminates quota errors, main-thread freezing, and playback bugs.
 */
import { getAuthHeaders } from './authClient.js';

const AUDIO_CACHE_PREFIX = 'ps_audio_cache_v1_';
const POS_CACHE_PREFIX = 'ps_audio_pos_v1_';
const BACKEND_TTS_URL = (import.meta.env && import.meta.env.VITE_TTS_API_URL) || '/api/tts';

// In-Memory Fast Cache Maps (0ms latency, zero quota errors)
const memoryAudioCache = new Map();
const memoryPosCache = new Map();

let currentActiveAudio = null;
let currentPlaybackRate = 1.0;
let lastSavedTime = 0;

/**
 * Sets playback speed rate for active & future audio streams (0.75x, 1.0x, 1.25x, 1.5x, 2.0x)
 */
export function setAudioPlaybackRate(rate = 1.0) {
  currentPlaybackRate = rate;
  if (currentActiveAudio) {
    try {
      currentActiveAudio.playbackRate = rate;
    } catch (e) { }
  }
}

export function getAudioPlaybackRate() {
  return currentPlaybackRate;
}

/**
 * Gets cached audio URL or stream (Checks In-Memory first, then Storage)
 */
export function getCachedAudio(articleId, langCode) {
  if (!articleId || !langCode) return null;
  const key = `${articleId}_${langCode}`;

  // 1. Check In-Memory Map
  if (memoryAudioCache.has(key)) {
    return memoryAudioCache.get(key);
  }

  // 2. Safe check SessionStorage
  try {
    const storageKey = `${AUDIO_CACHE_PREFIX}${key}`;
    const cached = sessionStorage.getItem(storageKey) || localStorage.getItem(storageKey);
    if (cached && cached.startsWith('data:audio/')) {
      memoryAudioCache.set(key, cached);
      return cached;
    }
  } catch (err) {}

  return null;
}

/**
 * Saves audio stream URL to in-memory & safe storage
 */
export function saveAudioToCache(articleId, langCode, audioUrl) {
  if (!articleId || !langCode || !audioUrl) return;
  const key = `${articleId}_${langCode}`;

  // Always save in fast JS memory
  memoryAudioCache.set(key, audioUrl);

  // Attempt safe storage write if payload is reasonable
  try {
    const storageKey = `${AUDIO_CACHE_PREFIX}${key}`;
    if (audioUrl.length < 2 * 1024 * 1024) {
      sessionStorage.setItem(storageKey, audioUrl);
    }
  } catch (err) {
    // Ignore storage quota limits safely
  }
}

/**
 * Position Cache Helpers with Backend Schema Sync
 */
export async function fetchBackendAudioPosition(articleId, langCode) {
  if (!articleId || !langCode) return 0;
  const key = `${articleId}_${langCode}`;

  if (memoryPosCache.has(key)) {
    return memoryPosCache.get(key);
  }

  try {
    const res = await fetch(`/api/audio/progress?articleId=${encodeURIComponent(articleId)}&langCode=${encodeURIComponent(langCode)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.last_position_seconds === 'number') {
        const pos = data.last_position_seconds;
        memoryPosCache.set(key, pos);
        return pos;
      }
    }
  } catch (e) {}

  return getSavedAudioPosition(articleId, langCode);
}

export function getSavedAudioPosition(articleId, langCode) {
  if (!articleId || !langCode) return 0;
  const key = `${articleId}_${langCode}`;

  if (memoryPosCache.has(key)) {
    return memoryPosCache.get(key);
  }

  try {
    const raw = sessionStorage.getItem(`${POS_CACHE_PREFIX}${key}`) || localStorage.getItem(`${POS_CACHE_PREFIX}${key}`);
    const pos = raw ? parseFloat(raw) || 0 : 0;
    if (pos > 0) memoryPosCache.set(key, pos);
    return pos;
  } catch (e) {
    return 0;
  }
}

export function saveAudioPosition(articleId, langCode, positionSeconds) {
  if (!articleId || !langCode || isNaN(positionSeconds)) return;
  const key = `${articleId}_${langCode}`;
  memoryPosCache.set(key, positionSeconds);

  // Throttle writes (once per second max) to prevent blocking main thread / overloading backend
  const now = Date.now();
  if (now - lastSavedTime > 1000) {
    lastSavedTime = now;
    try {
      sessionStorage.setItem(`${POS_CACHE_PREFIX}${key}`, positionSeconds.toFixed(1));
    } catch (e) {}

    // Post to backend database/memory schema asynchronously
    try {
      fetch('/api/audio/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: String(articleId),
          langCode,
          positionSeconds: parseFloat(positionSeconds.toFixed(2))
        })
      }).catch(() => {});
    } catch (e) {}
  }
}

export function clearSavedAudioPosition(articleId, langCode) {
  if (!articleId || !langCode) return;
  const key = `${articleId}_${langCode}`;
  memoryPosCache.delete(key);
  try {
    sessionStorage.removeItem(`${POS_CACHE_PREFIX}${key}`);
    localStorage.removeItem(`${POS_CACHE_PREFIX}${key}`);
  } catch (e) {}

  try {
    fetch('/api/audio/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        articleId: String(articleId),
        langCode,
        positionSeconds: 0
      })
    }).catch(() => {});
  } catch (e) {}
}

/**
 * Clears active audio stream to free memory while preserving position history
 */
export function clearArticleAudioCache(articleId) {
  if (!articleId) return;

  stopCloudAudio();

  // Clear in-memory audio stream data URIs to keep browser heap lean
  for (const key of Array.from(memoryAudioCache.keys())) {
    if (key.startsWith(`${articleId}_`)) {
      memoryAudioCache.delete(key);
      try {
        sessionStorage.removeItem(`${AUDIO_CACHE_PREFIX}${key}`);
        localStorage.removeItem(`${AUDIO_CACHE_PREFIX}${key}`);
      } catch (e) {}
    }
  }
}

/**
 * Seek active audio to target seconds
 */
export function seekActiveAudio(seconds) {
  if (currentActiveAudio && !isNaN(seconds)) {
    try {
      const duration = currentActiveAudio.duration || seconds;
      const targetTime = Math.max(0, Math.min(seconds, duration));
      if (typeof currentActiveAudio.fastSeek === 'function') {
        currentActiveAudio.fastSeek(targetTime);
      } else {
        currentActiveAudio.currentTime = targetTime;
      }
    } catch (e) {
      console.warn('[CloudAudio] Seek exception:', e);
    }
  }
}

export function getCurrentAudioElement() {
  return currentActiveAudio;
}

/**
 * Pause active HTML5 Audio playback without destroying the audio stream
 */
export function pauseCloudAudio() {
  if (currentActiveAudio) {
    try {
      currentActiveAudio.pause();
    } catch (e) {}
  }
}

/**
 * Resume active HTML5 Audio playback if available
 */
export function resumeCloudAudio() {
  if (currentActiveAudio && currentActiveAudio.src && !currentActiveAudio.ended) {
    try {
      const promise = currentActiveAudio.play();
      if (promise && promise.then) {
        promise.catch(e => console.warn('[CloudAudio] Resume play rejected:', e));
      }
      return true;
    } catch (e) {}
  }
  return false;
}

/**
 * Stop active HTML5 Audio playback immediately
 */
export function stopCloudAudio() {
  if (currentActiveAudio) {
    try {
      currentActiveAudio.onloadedmetadata = null;
      currentActiveAudio.oncanplay = null;
      currentActiveAudio.onplaying = null;
      currentActiveAudio.ontimeupdate = null;
      currentActiveAudio.onended = null;
      currentActiveAudio.onerror = null;
      currentActiveAudio.pause();
      currentActiveAudio.currentTime = 0;
      currentActiveAudio.removeAttribute('src');
      currentActiveAudio.load();
    } catch (e) {}
    currentActiveAudio = null;
  }
}

/**
 * Calls backend proxy (/api/tts) to synthesize full article audio without 300-char title truncation.
 */
export async function fetchBackendTtsAudio({ articleId, text, langCode = 'hi' }) {
  if (!BACKEND_TTS_URL) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35000);

    const trimmedBody = String(text || '').slice(0, 3200);
    const response = await fetch(BACKEND_TTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        article_id: String(articleId || ''),
        articleId: String(articleId || ''),
        clip_type: 'full_story',
        body: trimmedBody,
        text: trimmedBody,
        lang: langCode,
        langCode
      }),
      signal: controller.signal
    });
    clearTimeout(timer);

    if (response.ok) {
      const data = await response.json();
      const url = data.audio_url || data.audioUrl;
      if (data && url) {
        return url;
      }
    }
  } catch (err) {
    // Backend proxy unreachable or timed out
  }

  return null;
}

/**
 * Client-side fallback TTS helper:
 * Avoids direct cross-origin fetches that trigger browser CORS violations.
 * Audio synthesis is handled securely via the backend /api/tts proxy or native browser Web Speech API.
 */
async function fetchGoogleTranslateTtsClient() {
  return null;
}

/**
 * Play Backend Cloud Audio with HTML5 Audio element and full lifecycle callbacks.
 */
export async function playCloudAudioWithCache({ articleId, text, langCode, onStart, onPlay, onEnd, onError, onTimeUpdate, startPosition = 0 }) {
  stopCloudAudio();

  // Crucial: Synchronously prime and unlock Audio element during user interaction gesture
  const unlockedAudio = new Audio();
  unlockedAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
  try {
    const p = unlockedAudio.play();
    if (p !== undefined) {
      p.then(() => unlockedAudio.pause()).catch(() => {});
    }
  } catch (e) {}
  currentActiveAudio = unlockedAudio;

  if (onStart) onStart();

  try {
    let audioSrc = getCachedAudio(articleId, langCode);

    if (!audioSrc) {
      audioSrc = await fetchBackendTtsAudio({ articleId, text, langCode });
    }

    if (!audioSrc) {
      audioSrc = await fetchGoogleTranslateTtsClient(text, langCode);
    }

    if (articleId && audioSrc) {
      saveAudioToCache(articleId, langCode, audioSrc);
    }

    if (!audioSrc) {
      throw new Error('Audio generation produced no audio content');
    }

    const audio = currentActiveAudio || unlockedAudio;
    currentActiveAudio = audio;
    audio.src = audioSrc;
    try {
      audio.playbackRate = currentPlaybackRate;
    } catch (e) {}

    let hasSeekedToStart = false;

    const applyStartPosition = () => {
      if (hasSeekedToStart || !startPosition || startPosition <= 0) return;
      try {
        if (typeof audio.fastSeek === 'function') {
          audio.fastSeek(startPosition);
        } else {
          audio.currentTime = startPosition;
        }
        hasSeekedToStart = true;
        console.log(`[CloudAudio Cache] Applied start position (${startPosition}s) for key: ${articleId}_${langCode}`);
      } catch (e) {
        console.warn('[CloudAudio Cache] Seek attempt delayed:', e);
      }
    };

    audio.onloadedmetadata = applyStartPosition;
    audio.oncanplay = applyStartPosition;

    audio.onplaying = () => {
      applyStartPosition();
      if (onPlay) onPlay();
    };

    audio.ontimeupdate = () => {
      if (articleId && langCode && audio.currentTime > 0) {
        saveAudioPosition(articleId, langCode, audio.currentTime);
      }
      if (onTimeUpdate) {
        onTimeUpdate(audio.currentTime, audio.duration || 0);
      }
    };

    audio.onended = () => {
      if (articleId && langCode) {
        clearSavedAudioPosition(articleId, langCode);
      }
      currentActiveAudio = null;
      if (onEnd) onEnd();
    };

    audio.onerror = (err) => {
      console.warn('[CloudAudio] Playback error:', err);
      currentActiveAudio = null;
      if (onError) onError(err);
      else if (onEnd) onEnd();
    };

    await audio.play();
  } catch (err) {
    console.error('[CloudAudio] Play Exception:', err);
    currentActiveAudio = null;
    if (onError) onError(err);
    else if (onEnd) onEnd();
  }
}

/**
 * Staff Audio Generation & Render Worker Orchestration (Task 44.6 Subtopic C)
 */
export async function warmRenderAudioWorker() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 65000);
    const res = await fetch('/api/tts/warm-worker', {
      method: 'GET',
      headers: { ...getAuthHeaders() },
      signal: controller.signal
    });
    clearTimeout(timer);
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, ...data };
  } catch (err) {
    return { ok: false, renderConfigured: false, error: err.message };
  }
}

export async function fetchArticleAudioStatus(articleId) {
  if (!articleId) return null;
  try {
    const res = await fetch(`/api/tts/article-status/${encodeURIComponent(String(articleId))}`, {
      method: 'GET',
      headers: { ...getAuthHeaders() }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function triggerArticleAudioStep({ articleId, step, lang, forceRegenerate = false, overrides = null }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 70000);
  try {
    const res = await fetch('/api/tts/generate-article-audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        articleId: String(articleId),
        step,
        lang,
        forceRegenerate: Boolean(forceRegenerate),
        ...(overrides ? { overrides } : {})
      }),
      signal: controller.signal
    });
    clearTimeout(timer);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      const err = new Error(data.error || `Audio step failed (${res.status})`);
      err.status = res.status;
      err.quotaExhausted = Boolean(data.quotaExhausted || res.status === 429);
      throw err;
    }
    return data;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function syncPendingArticleDraftBeforeAudio(article) {
  if (!article || !article.id || !article.content) return false;
  try {
    const payload = {
      ...article,
      status: article.status || 'draft'
    };
    const res = await fetch('/api/articles/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(payload)
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function runSequentialArticleAudioPipeline({
  articleId,
  article = null,
  forceRegenerate = false,
  onStepUpdate
}) {
  const overrides = article
    ? { title: article.title, originalLanguage: article.originalLanguage }
    : null;
  const steps = [
    {
      id: 'warm',
      label: 'Step 1: Wake & Verify Audio Compression Worker',
      status: 'pending',
      detail: 'Render FFmpeg libopus (32 kbps WebM) / local worker check'
    },
    {
      id: 'translate_hi',
      label: 'Step 2: Hindi (HI) Translation -> Backend Cache',
      status: 'pending',
      detail: 'Saves Hindi headline, summary & body in backend D1 cache'
    },
    {
      id: 'audio_hi',
      label: 'Step 3: Hindi (HI) Audio -> WebM Compress -> D1 (HI)',
      status: 'pending',
      detail: 'Synthesizes HI voice, compresses via FFmpeg & stores in DB_AUDIO_HI'
    },
    {
      id: 'translate_en',
      label: 'Step 4: English (EN) Translation -> Backend Cache',
      status: 'pending',
      detail: 'Saves English headline, summary & body in backend D1 cache'
    },
    {
      id: 'audio_en',
      label: 'Step 5: English (EN) Audio -> WebM Compress -> D1 (EN)',
      status: 'pending',
      detail: 'Synthesizes EN voice, compresses via FFmpeg & stores in DB_AUDIO_EN'
    }
  ];

  const notify = (stepId, patch) => {
    const idx = steps.findIndex((s) => s.id === stepId);
    if (idx !== -1) {
      steps[idx] = { ...steps[idx], ...patch };
    }
    if (onStepUpdate) {
      onStepUpdate({ steps, currentStepId: stepId });
    }
  };

  let activeStepId = 'warm';
  try {
    // 1. Warm Render worker
    notify('warm', { status: 'running', detail: 'Checking Render FFmpeg worker health...' });
    const workerRes = await warmRenderAudioWorker();
    notify('warm', {
      status: 'done',
      detail: workerRes.renderConfigured
        ? (workerRes.ffmpegReady ? 'Render FFmpeg Worker Warm & Ready (WebM Opus)' : 'Render Worker Awake (Edge fallback active if offline)')
        : 'Using Edge / Local Node Direct Compression Mode'
    });

    // 2. Translate & cache Hindi
    activeStepId = 'translate_hi';
    notify('translate_hi', { status: 'running', detail: 'Translating & saving Hindi (HI) text in backend cache...' });
    let trHi;
    try {
      trHi = await triggerArticleAudioStep({ articleId, step: 'translate', lang: 'hi', forceRegenerate, overrides });
    } catch (firstErr) {
      if (firstErr.status === 404 && article) {
        const synced = await syncPendingArticleDraftBeforeAudio(article);
        if (synced) {
          trHi = await triggerArticleAudioStep({ articleId, step: 'translate', lang: 'hi', forceRegenerate, overrides });
        } else {
          throw firstErr;
        }
      } else {
        throw firstErr;
      }
    }
    notify('translate_hi', {
      status: 'done',
      detail: trHi.isCached ? 'Hindi (HI) translation verified in backend cache.' : 'Hindi (HI) translation saved to backend cache.'
    });

    // 3. Synthesize & compress Hindi Audio -> DB_AUDIO_HI
    activeStepId = 'audio_hi';
    notify('audio_hi', { status: 'running', detail: 'Synthesizing HI speech -> FFmpeg WebM compression -> D1 HI shard...' });
    const audioHi = await triggerArticleAudioStep({ articleId, step: 'audio', lang: 'hi', forceRegenerate, overrides });
    const hiKb = `${(Number(audioHi.size_bytes || 0) / 1024).toFixed(1)} KB`;
    notify('audio_hi', {
      status: 'done',
      detail: `${audioHi.isCached ? 'Already Cached' : 'Saved'} (${hiKb} ${String(audioHi.mime_type || '').includes('webm') ? 'WebM' : 'Audio'} · ${audioHi.shard || 'DB_AUDIO_HI'})`
    });

    // 4. Translate & cache English
    activeStepId = 'translate_en';
    notify('translate_en', { status: 'running', detail: 'Translating & saving English (EN) text in backend cache...' });
    const trEn = await triggerArticleAudioStep({ articleId, step: 'translate', lang: 'en', forceRegenerate, overrides });
    notify('translate_en', {
      status: 'done',
      detail: trEn.isCached ? 'English (EN) translation verified in backend cache.' : 'English (EN) translation saved to backend cache.'
    });

    // 5. Synthesize & compress English Audio -> DB_AUDIO_EN
    activeStepId = 'audio_en';
    notify('audio_en', { status: 'running', detail: 'Synthesizing EN speech -> FFmpeg WebM compression -> D1 EN shard...' });
    const audioEn = await triggerArticleAudioStep({ articleId, step: 'audio', lang: 'en', forceRegenerate, overrides });
    const enKb = `${(Number(audioEn.size_bytes || 0) / 1024).toFixed(1)} KB`;
    notify('audio_en', {
      status: 'done',
      detail: `${audioEn.isCached ? 'Already Cached' : 'Saved'} (${enKb} ${String(audioEn.mime_type || '').includes('webm') ? 'WebM' : 'Audio'} · ${audioEn.shard || 'DB_AUDIO_EN'})`
    });

    return { success: true, worker: workerRes, trHi, hi: audioHi, trEn, en: audioEn };
  } catch (err) {
    notify(activeStepId, {
      status: 'error',
      detail: err.quotaExhausted
        ? `Gemini API quota exhausted (429): ${err.message}`
        : (err.message || 'Step failed')
    });
    return { success: false, failedStep: activeStepId, error: err.message || 'Audio pipeline failed' };
  }
}
