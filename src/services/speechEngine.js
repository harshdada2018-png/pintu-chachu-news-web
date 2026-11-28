import { 
  playCloudAudioWithCache, 
  pauseCloudAudio,
  resumeCloudAudio,
  stopCloudAudio, 
  setAudioPlaybackRate, 
  getAudioPlaybackRate, 
  seekActiveAudio, 
  getSavedAudioPosition, 
  fetchBackendAudioPosition,
  saveAudioPosition, 
  clearSavedAudioPosition,
  clearArticleAudioCache 
} from './cloudAudioService.js';

export { 
  setAudioPlaybackRate, 
  getAudioPlaybackRate, 
  seekActiveAudio, 
  getSavedAudioPosition, 
  fetchBackendAudioPosition,
  saveAudioPosition, 
  clearSavedAudioPosition,
  clearArticleAudioCache,
  pauseCloudAudio,
  resumeCloudAudio
};

let cachedVoices = [];
let currentUtteranceChain = null;
let activeFallbackTimer = null;
let fallbackPlaybackRate = 1.0;

export function setFallbackPlaybackRate(rate = 1.0) {
  const num = Number(rate);
  fallbackPlaybackRate = Number.isFinite(num) ? Math.min(2.0, Math.max(0.5, num)) : 1.0;
}

export function getFallbackPlaybackRate() {
  return fallbackPlaybackRate;
}

if (typeof window !== 'undefined') {
  window._activeUtterances = window._activeUtterances || [];
}

function populateVoices() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length > 0) {
        cachedVoices = v;
      }
    } catch (e) { }
  }
  return cachedVoices;
}

populateVoices();
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = () => {
      populateVoices();
    };
  }
}

function ensureVoicesLoaded(timeoutMs = 300) {
  return new Promise((resolve) => {
    const existing = populateVoices();
    if (existing && existing.length > 0) {
      return resolve(existing);
    }

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return resolve([]);
    }

    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(populateVoices());
      }
    }, timeoutMs);

    const prevOnVoicesChanged = window.speechSynthesis.onvoiceschanged;
    window.speechSynthesis.onvoiceschanged = (e) => {
      if (typeof prevOnVoicesChanged === 'function') {
        try { prevOnVoicesChanged(e); } catch (err) { }
      }
      const loaded = populateVoices();
      if (!resolved && loaded.length > 0) {
        resolved = true;
        clearTimeout(timer);
        resolve(loaded);
      }
    };
  });
}

const BCP47_LOCALE_MAP = {
  en: 'en-IN',
  hi: 'hi-IN',
  bn: 'bn-IN',
  mr: 'mr-IN',
  te: 'te-IN',
  ta: 'ta-IN',
  gu: 'gu-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  pa: 'pa-IN',
  or: 'or-IN',
  as: 'as-IN',
  ur: 'ur-IN',
  fr: 'fr-FR',
  it: 'it-IT',
  ja: 'ja-JP',
  id: 'id-ID',
  zh: 'zh-TW',
  'zh-tw': 'zh-TW',
  'zh-TW': 'zh-TW',
  ru: 'ru-RU'
};

export const AUDIO_SUPPORTED_LANGUAGES = new Set(['hi', 'en']);

export function isAudioSupportedLanguage(langCode) {
  if (!langCode) return false;
  const base = String(langCode).trim().toLowerCase().split(/[-_]/)[0];
  return AUDIO_SUPPORTED_LANGUAGES.has(base);
}

/**
 * Check if the user's browser has an installed speech voice for the given language.
 * Returns true if available or if voices are still asynchronously initializing.
 */
export function hasBrowserVoiceForLanguage(langCode) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  const voices = populateVoices();
  if (!voices || voices.length === 0) return true;
  const match = findMatchingVoice(voices, langCode);
  return Boolean(match);
}

function cleanTextForSpeech(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/http[s]?:\/\/\S+/g, '')
    .replace(/[#*`_~><\[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findMatchingVoice(voices, langCode) {
  if (!voices || voices.length === 0) return null;

  const normalizedLang = (langCode || 'en').toLowerCase().replace('_', '-');
  const targetLocale = (BCP47_LOCALE_MAP[normalizedLang] || BCP47_LOCALE_MAP[normalizedLang.split('-')[0]] || normalizedLang || 'en-IN').toLowerCase().replace('_', '-');
  const targetPrefix = targetLocale.split('-')[0];

  const normalizedVoices = voices.map(v => ({
    voice: v,
    lang: v.lang.toLowerCase().replace('_', '-'),
    name: v.name.toLowerCase()
  }));

  let match = normalizedVoices.find(v => v.lang === targetLocale);
  if (match) return match.voice;

  match = normalizedVoices.find(v => v.lang.startsWith(targetPrefix));
  if (match) return match.voice;

  return null;
}

function splitTextIntoSentences(text) {
  if (!text || typeof text !== 'string') return [];
  const clean = text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  const parts = clean.match(/[^.!?\n।;:]+[.!?\n।;:]*|\S+/g) || [clean];
  const chunks = [];
  let current = '';

  for (const part of parts) {
    if ((current + ' ' + part).trim().length <= 140) {
      current = (current + ' ' + part).trim();
    } else {
      if (current) chunks.push(current);
      if (part.length > 140) {
        for (let i = 0; i < part.length; i += 100) {
          chunks.push(part.slice(i, i + 100).trim());
        }
        current = '';
      } else {
        current = part;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks.filter(c => c && c.length > 0);
}

/**
 * Fallback Browser Speech Synthesis (Web Speech API) if backend server is unreachable
 */
async function speakWithWebSpeechFallback(cleanedText, normalizedLang, onStartCallback, onPlayCallback, onEndCallback, onTimeUpdate) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (onEndCallback) onEndCallback();
    return;
  }

  if (activeFallbackTimer) {
    clearInterval(activeFallbackTimer);
    activeFallbackTimer = null;
  }

  const chunks = splitTextIntoSentences(cleanedText.slice(0, 4000));
  if (chunks.length === 0) {
    if (onEndCallback) onEndCallback();
    return;
  }

  const chainId = Symbol('fallbackChain');
  currentUtteranceChain = chainId;

  // Estimate total duration for smooth seconds counter: ~7 chars/sec for Indic, ~14 for Latin
  const isIndic = /[\u0900-\u0D7F]/.test(cleanedText);
  const charsPerSec = (isIndic ? 7 : 14) * Math.max(0.5, fallbackPlaybackRate);
  const estimatedTotalDuration = Math.max(3, Math.round(cleanedText.length / charsPerSec));
  const startTime = Date.now();

  try {
    const voices = await ensureVoicesLoaded(300);
    const localeTag = BCP47_LOCALE_MAP[normalizedLang] || BCP47_LOCALE_MAP[normalizedLang.split('-')[0]] || 'en-IN';
    const matchingVoice = findMatchingVoice(voices, normalizedLang);

    let chunkIndex = 0;

    const speakNextChunk = () => {
      if (currentUtteranceChain !== chainId) return;

      if (chunkIndex >= chunks.length) {
        currentUtteranceChain = null;
        if (activeFallbackTimer) {
          clearInterval(activeFallbackTimer);
          activeFallbackTimer = null;
        }
        if (onTimeUpdate) onTimeUpdate(estimatedTotalDuration, estimatedTotalDuration);
        if (onEndCallback) onEndCallback();
        return;
      }

      const chunkText = chunks[chunkIndex];
      const utterance = new SpeechSynthesisUtterance(chunkText);

      if (typeof window !== 'undefined') {
        window._activeUtterances = window._activeUtterances || [];
        window._activeUtterances.push(utterance);
      }

      if (matchingVoice) {
        utterance.voice = matchingVoice;
      }
      utterance.lang = (matchingVoice && matchingVoice.lang) ? matchingVoice.lang : localeTag;
      utterance.pitch = 1.0;
      utterance.rate = Math.min(2.0, Math.max(0.5, fallbackPlaybackRate));
      utterance.volume = 1.0;

      if (chunkIndex === 0) {
        if (onStartCallback) onStartCallback();
        if (onPlayCallback) onPlayCallback();

        // Start active progress timer to advance seconds smoothly
        activeFallbackTimer = setInterval(() => {
          if (currentUtteranceChain !== chainId) {
            clearInterval(activeFallbackTimer);
            activeFallbackTimer = null;
            return;
          }
          const elapsed = (Date.now() - startTime) / 1000;
          if (elapsed >= estimatedTotalDuration) {
            clearInterval(activeFallbackTimer);
            activeFallbackTimer = null;
            if (onTimeUpdate) onTimeUpdate(estimatedTotalDuration, estimatedTotalDuration);
          } else if (onTimeUpdate) {
            onTimeUpdate(elapsed, estimatedTotalDuration);
          }
        }, 200);
      }

      utterance.onend = () => {
        if (typeof window !== 'undefined' && window._activeUtterances) {
          window._activeUtterances = window._activeUtterances.filter(u => u !== utterance);
        }
        if (currentUtteranceChain === chainId) {
          chunkIndex++;
          speakNextChunk();
        }
      };

      utterance.onerror = (err) => {
        if (typeof window !== 'undefined' && window._activeUtterances) {
          window._activeUtterances = window._activeUtterances.filter(u => u !== utterance);
        }
        if (err && (err.error === 'interrupted' || err.error === 'canceled')) return;
        if (currentUtteranceChain === chainId) {
          chunkIndex++;
          speakNextChunk();
        }
      };

      if ('speechSynthesis' in window) {
        if (window.speechSynthesis.paused) window.speechSynthesis.resume();
        window.speechSynthesis.speak(utterance);
      }
    };

    // Chromium queue guard: brief delay after speechSynthesis.cancel() prevents silent first-chunk drop
    setTimeout(() => {
      if (currentUtteranceChain === chainId) {
        speakNextChunk();
      }
    }, 60);
  } catch (e) {
    if (activeFallbackTimer) {
      clearInterval(activeFallbackTimer);
      activeFallbackTimer = null;
    }
    if (onEndCallback) onEndCallback();
  }
}

/**
 * Direct browser-only Web Speech API fallback (never re-calls server /api/tts).
 */
export function speakWithBrowserSpeechOnly({
  text = '',
  langCode = 'hi',
  rate = null,
  onStart = null,
  onPlay = null,
  onTimeUpdate = null,
  onEnd = null
} = {}) {
  if (rate !== null) {
    setFallbackPlaybackRate(rate);
  }
  stopAudioSpeech();
  const cleaned = cleanTextForSpeech(text);
  if (!cleaned) {
    if (onEnd) onEnd();
    return;
  }
  const normalizedLang = (langCode || 'hi').toLowerCase();
  speakWithWebSpeechFallback(cleaned, normalizedLang, onStart, onPlay, onEnd, onTimeUpdate);
}

/**
 * Primary Text-To-Speech Engine for all 18 supported languages.
 * Routes all TTS requests through the Node.js Backend Proxy (/api/tts) for Google Cloud TTS & Sarvam AI synthesis.
 */
export async function speakTextWithNaturalVoice(
  text,
  langCode = 'hi',
  onEndCallback = null,
  articleId = null,
  onStartCallback = null,
  onPlayCallback = null,
  onTimeUpdate = null,
  startPosition = 0
) {
  let optsTimeUpdate = onTimeUpdate;
  let optsStartPosition = startPosition;

  if (typeof text === 'object' && text !== null) {
    const opts = text;
    text = opts.text;
    langCode = opts.langCode || 'hi';
    onEndCallback = opts.onEndCallback || opts.onEnd;
    articleId = opts.articleId || opts.id;
    onStartCallback = opts.onStartCallback || opts.onStart;
    onPlayCallback = opts.onPlayCallback || opts.onPlay;
    optsTimeUpdate = opts.onTimeUpdate || onTimeUpdate;
    optsStartPosition = opts.startPosition || opts.position || startPosition;
  }

  stopAudioSpeech();

  const cleaned = cleanTextForSpeech(text);
  if (!cleaned) {
    if (onEndCallback) onEndCallback();
    return;
  }

  const normalizedLang = (langCode || 'hi').toLowerCase();
  if (!isAudioSupportedLanguage(normalizedLang)) {
    if (onEndCallback) onEndCallback();
    return;
  }

  // 1. Primary: High-fidelity Neural Audio stream via Backend MP3 (100% cross-platform, zero client voice dependencies)
  try {
    let cloudStarted = false;
    playCloudAudioWithCache({
      articleId: articleId || 'general',
      text: cleaned,
      langCode: normalizedLang,
      startPosition: optsStartPosition,
      onStart: () => {
        cloudStarted = true;
        if (onStartCallback) onStartCallback();
      },
      onPlay: () => {
        cloudStarted = true;
        if (onPlayCallback) onPlayCallback();
      },
      onTimeUpdate: (cur, dur) => {
        if (optsTimeUpdate) optsTimeUpdate(cur, dur);
      },
      onEnd: () => {
        if (onEndCallback) onEndCallback();
      },
      onError: (err) => {
        console.warn('[SpeechEngine] Cloud audio failed, attempting Web Speech fallback:', err);
        speakWithWebSpeechFallback(cleaned, normalizedLang, onStartCallback, onPlayCallback, onEndCallback, optsTimeUpdate);
      }
    }).catch(err => {
      if (!cloudStarted) {
        console.warn('[SpeechEngine] Could not initialize cloud audio, falling back to Web Speech:', err);
        speakWithWebSpeechFallback(cleaned, normalizedLang, onStartCallback, onPlayCallback, onEndCallback, optsTimeUpdate);
      }
    });
  } catch (err) {
    console.warn('[SpeechEngine] Could not initialize cloud audio, falling back to Web Speech:', err);
    speakWithWebSpeechFallback(cleaned, normalizedLang, onStartCallback, onPlayCallback, onEndCallback, optsTimeUpdate);
  }
}

/**
 * Pause active audio playback (preserves stream position)
 */
export function pauseAudioSpeech() {
  pauseCloudAudio();
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.pause();
    } catch (e) {}
  }
}

/**
 * Resume paused active audio playback
 */
export function resumeAudioSpeech() {
  const resumed = resumeCloudAudio();
  if (!resumed && typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        return true;
      }
    } catch (e) {}
  }
  return resumed;
}

/**
 * Stop audio speech immediately (both backend audio stream & client Web Speech API)
 */
export function stopAudioSpeech() {
  currentUtteranceChain = null;
  if (activeFallbackTimer) {
    clearInterval(activeFallbackTimer);
    activeFallbackTimer = null;
  }
  stopCloudAudio();
  if (typeof window !== 'undefined') {
    window._activeUtterances = [];
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) { }
    }
  }
}
