/**
 * PublicSpark Newsroom Backend Proxy & Cache Server
 * Built with ZERO external dependencies using Node.js native http module.
 * Securely handles:
 *  1. Google Cloud Text-to-Speech API & Sarvam AI API (POST /api/tts)
 *  2. Google Cloud Translation API v2 (POST /api/translate)
 * Protects API keys server-side & enforces 1-time caching per (text + language).
 */

import http from 'node:http';

const PORT = process.env.PORT || 5000;

// Official Voice Map for Google Cloud TTS & Sarvam AI
const LANGUAGE_VOICE_MAP = {
  'hi': { provider: 'google', languageCode: 'hi-IN', voiceName: 'hi-IN-Neural2-A', gender: 'FEMALE' },
  'bn': { provider: 'google', languageCode: 'bn-IN', voiceName: 'bn-IN-Wavenet-A', gender: 'FEMALE' },
  'mr': { provider: 'google', languageCode: 'mr-IN', voiceName: 'mr-IN-Wavenet-A', gender: 'FEMALE' },
  'te': { provider: 'google', languageCode: 'te-IN', voiceName: 'te-IN-Standard-A', gender: 'FEMALE' },
  'ta': { provider: 'google', languageCode: 'ta-IN', voiceName: 'ta-IN-Wavenet-A', gender: 'FEMALE' },
  'gu': { provider: 'google', languageCode: 'gu-IN', voiceName: 'gu-IN-Standard-A', gender: 'FEMALE' },
  'kn': { provider: 'google', languageCode: 'kn-IN', voiceName: 'kn-IN-Standard-A', gender: 'FEMALE' },
  'ml': { provider: 'google', languageCode: 'ml-IN', voiceName: 'ml-IN-Standard-A', gender: 'FEMALE' },
  'pa': { provider: 'google', languageCode: 'pa-IN', voiceName: 'pa-IN-Standard-A', gender: 'FEMALE' },
  'ur': { provider: 'google', languageCode: 'ur-IN', voiceName: 'ur-IN-Standard-A', gender: 'FEMALE' },
  'en': { provider: 'google', languageCode: 'en-IN', voiceName: 'en-IN-Wavenet-A', gender: 'FEMALE' },
  'fr': { provider: 'google', languageCode: 'fr-FR', voiceName: 'fr-FR-Wavenet-A', gender: 'FEMALE' },
  'it': { provider: 'google', languageCode: 'it-IT', voiceName: 'it-IT-Wavenet-A', gender: 'FEMALE' },
  'ja': { provider: 'google', languageCode: 'ja-JP', voiceName: 'ja-JP-Neural2-B', gender: 'FEMALE' },
  'id': { provider: 'google', languageCode: 'id-ID', voiceName: 'id-ID-Wavenet-A', gender: 'FEMALE' },
  'zh-tw': { provider: 'google', languageCode: 'zh-TW', voiceName: 'zh-TW-Wavenet-A', gender: 'FEMALE' },
  // Odia & Assamese -> Handled via Sarvam AI API
  'or': { provider: 'sarvam', languageCode: 'od-IN', speaker: 'meera' },
  'as': { provider: 'sarvam', languageCode: 'as-IN', speaker: 'meera' }
};

// In-Memory Server Caches
const serverAudioCache = new Map();
const serverTranslationCache = new Map();
const serverAudioProgressMap = new Map();

// -------------------------------------------------------------
// ANALYTICS & STATISTICS DATA STORE & AGGREGATOR
// -------------------------------------------------------------
// Raw event log: articleViews = [{ id, articleId, userId, sessionId, ipAddress, country, readDurationSeconds, scrollDepth, createdAt }]
const articleViews = [];

// Pre-aggregated table: articleStatsDaily = Map<`${articleId}_${date}`, { articleId, date, viewsCount, uniqueViewsCount, avgReadDuration, countryBreakdown }>
const articleStatsDaily = new Map();

// Session tracker for active heartbeats: Map<sessionId, { articleId, startTime, lastHeartbeat, scrollDepth, country, ipAddress }>
const activeViewSessions = new Map();

function resolveIpToCountry(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? forwarded.split(',')[0].trim() : req.socket?.remoteAddress || '127.0.0.1';
  
  if (req.headers['cf-ipcountry']) {
    return req.headers['cf-ipcountry'].toUpperCase();
  }
  
  const pool = ['IN', 'IN', 'IN', 'US', 'US', 'GB', 'CA', 'BD', 'AE'];
  let charSum = 0;
  for (let i = 0; i < ip.length; i++) charSum += ip.charCodeAt(i);
  return pool[charSum % pool.length] || 'IN';
}

function runDailyAggregationJob() {
  const todayStr = new Date().toISOString().split('T')[0];
  const grouped = new Map();

  for (const view of articleViews) {
    const viewDate = view.createdAt ? view.createdAt.split('T')[0] : todayStr;
    const key = `${view.articleId}_${viewDate}`;
    
    if (!grouped.has(key)) {
      grouped.set(key, {
        articleId: view.articleId,
        date: viewDate,
        views: [],
        sessions: new Set(),
        countries: {}
      });
    }
    const item = grouped.get(key);
    item.views.push(view);
    if (view.sessionId) item.sessions.add(view.sessionId);
    
    const c = view.country || 'IN';
    item.countries[c] = (item.countries[c] || 0) + 1;
  }

  for (const [key, data] of grouped.entries()) {
    const totalViews = data.views.length;
    const uniqueViews = data.sessions.size || totalViews;
    const sumDuration = data.views.reduce((acc, v) => acc + (v.readDurationSeconds || 0), 0);
    const avgDuration = totalViews > 0 ? parseFloat((sumDuration / totalViews).toFixed(1)) : 0;

    articleStatsDaily.set(key, {
      articleId: data.articleId,
      date: data.date,
      viewsCount: totalViews,
      uniqueViewsCount: uniqueViews,
      avgReadDuration: avgDuration,
      countryBreakdown: data.countries
    });
  }
}

function seedMockAnalyticsData() {
  const mockArticles = [
    { id: '1', title: 'Tech Giants Announce Quantum Leap Breakthrough' },
    { id: '2', title: 'Global Climate Summit Reaches Historic Agreement' },
    { id: '3', title: 'New Space Mission Discovers Water Ice on Mars' },
    { id: '4', title: 'Healthcare AI Diagnostic Tool Gains FDA Approval' },
    { id: '5', title: 'Future of Clean Energy: Solar Breakthrough Achieved' }
  ];

  const countries = ['IN', 'IN', 'IN', 'US', 'US', 'GB', 'CA', 'BD', 'AE', 'DE'];
  const today = new Date();

  for (let d = 14; d >= 0; d--) {
    const dateObj = new Date(today);
    dateObj.setDate(today.getDate() - d);
    const dateStr = dateObj.toISOString().split('T')[0];

    mockArticles.forEach(art => {
      const count = Math.floor(Math.random() * 350) + 120 + (art.id === '1' ? 250 : 0);
      const countryBreakdown = { IN: 0, US: 0, GB: 0, CA: 0, BD: 0, AE: 0 };
      let totalDuration = 0;

      for (let i = 0; i < count; i++) {
        const country = countries[Math.floor(Math.random() * countries.length)];
        countryBreakdown[country] = (countryBreakdown[country] || 0) + 1;
        const duration = Math.floor(Math.random() * 160) + 25;
        totalDuration += duration;

        articleViews.push({
          id: `v-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          articleId: art.id,
          userId: Math.random() > 0.6 ? `user-${Math.floor(Math.random() * 100)}` : null,
          sessionId: `sess-${d}-${i}-${art.id}`,
          ipAddress: '127.0.0.1',
          country: country,
          readDurationSeconds: duration,
          scrollDepth: Math.floor(Math.random() * 60) + 40,
          createdAt: dateObj.toISOString()
        });
      }

      const uniqueCount = Math.floor(count * 0.85);
      const avgDuration = parseFloat((totalDuration / count).toFixed(1));

      articleStatsDaily.set(`${art.id}_${dateStr}`, {
        articleId: art.id,
        date: dateStr,
        viewsCount: count,
        uniqueViewsCount: uniqueCount,
        avgReadDuration: avgDuration,
        countryBreakdown
      });
    });
  }

  console.log(`📊 [Analytics Engine] Seeded ${articleViews.length} raw view events & ${articleStatsDaily.size} daily stats.`);
}

seedMockAnalyticsData();

// Run aggregation cron job every 30 minutes
setInterval(runDailyAggregationJob, 30 * 60 * 1000);

function splitTextIntoSafeChunks(text, maxLen = 140) {
  if (!text || !text.trim()) return [];
  const clean = text.replace(/\s+/g, ' ').trim();
  const sentences = clean.match(/[^.!?]+[.!?]+|\S+/g) || [clean];
  const chunks = [];
  let current = '';

  for (const sentence of sentences) {
    if ((current + ' ' + sentence).trim().length <= maxLen) {
      current = (current + ' ' + sentence).trim();
    } else {
      if (current) chunks.push(current);
      if (sentence.length > maxLen) {
        for (let i = 0; i < sentence.length; i += maxLen) {
          chunks.push(sentence.slice(i, i + maxLen));
        }
        current = '';
      } else {
        current = sentence;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * Fallback multi-chunk Google Translate TTS synthesizer for servers without API keys
 */
async function fetchGoogleTranslateTtsFallback(text, langCode) {
  if (!text || !text.trim()) return null;
  let targetLang = (langCode || 'hi').split('-')[0];
  
  // Google Translate TTS lacks native audio models for Odia (or) and Assamese (as).
  // Fall back to Bengali ('bn') voice model for phonetic audio synthesis.
  if (targetLang === 'or' || targetLang === 'as') {
    targetLang = 'bn';
  }

  const chunks = splitTextIntoSafeChunks(text.slice(0, 3000), 140);
  if (chunks.length === 0) return null;

  const buffers = await Promise.all(chunks.map(async (chunk) => {
    try {
      const res = await fetch(`https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&q=${encodeURIComponent(chunk)}&tl=${targetLang}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      if (res.ok) {
        return await res.arrayBuffer();
      }
    } catch (e) {
      console.warn('[TTS Fallback Chunk Exception]', e.message);
    }
    return new ArrayBuffer(0);
  }));

  const validBuffers = buffers.filter(b => b.byteLength > 0);
  if (validBuffers.length === 0) return null;

  const totalLength = validBuffers.reduce((acc, b) => acc + b.byteLength, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const b of validBuffers) {
    combined.set(new Uint8Array(b), offset);
    offset += b.byteLength;
  }

  const base64 = Buffer.from(combined).toString('base64');
  return `data:audio/mp3;base64,${base64}`;
}

const server = http.createServer(async (req, res) => {
  // CORS Headers for Local Development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'POST' && url.pathname === '/api/tts') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', async () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const { articleId, text, langCode = 'hi' } = body;

        if (!text) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Text prompt is required.' }));
        }

        const cleanLang = (langCode || 'hi').toLowerCase();
        const cacheKey = `${articleId || text.slice(0, 100)}_${cleanLang}`;

        // Check Server Audio Cache
        if (serverAudioCache.has(cacheKey)) {
          console.log(`[Server Audio Cache HIT] Serving cached audio for: ${cacheKey}`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            audioUrl: serverAudioCache.get(cacheKey),
            isCached: true,
            provider: 'cache'
          }));
        }

        const config = LANGUAGE_VOICE_MAP[cleanLang] || LANGUAGE_VOICE_MAP['hi'];
        let audioDataUri = null;

        if (config.provider === 'sarvam') {
          const sarvamKey = process.env.SARVAM_AI_API_KEY;
          if (sarvamKey) {
            try {
              const response = await fetch('https://api.sarvam.ai/text-to-speech', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'api-subscription-key': sarvamKey
                },
                body: JSON.stringify({
                  inputs: [text.slice(0, 1500)],
                  target_language_code: config.languageCode,
                  speaker: config.speaker,
                  pitch: 0,
                  pace: 1.0,
                  loudness: 1.5,
                  speech_sample_rate: 22050,
                  enable_preprocessing: true,
                  model: 'bulbul:v1'
                })
              });

              if (response.ok) {
                const data = await response.json();
                if (data.audios && data.audios[0]) {
                  audioDataUri = `data:audio/wav;base64,${data.audios[0]}`;
                }
              }
            } catch (e) {
              console.warn('[Sarvam AI Exception]', e.message);
            }
          }
        } else {
          const googleKey = process.env.GOOGLE_CLOUD_TTS_API_KEY;
          if (googleKey) {
            try {
              const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${googleKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  input: { text: text.slice(0, 3000) },
                  voice: {
                    languageCode: config.languageCode,
                    name: config.voiceName,
                    ssmlGender: config.gender
                  },
                  audioConfig: {
                    audioEncoding: 'MP3',
                    pitch: 0,
                    speakingRate: 0.95
                  }
                })
              });

              if (response.ok) {
                const data = await response.json();
                if (data.audioContent) {
                  audioDataUri = `data:audio/mp3;base64,${data.audioContent}`;
                }
              }
            } catch (e) {
              console.warn('[Google Cloud TTS Exception]', e.message);
            }
          }
        }

        // Automatic High-Definition Public Fallback if official API keys are missing or failed
        if (!audioDataUri) {
          console.info(`[Server TTS] Synthesizing fallback audio stream for (${cleanLang})...`);
          audioDataUri = await fetchGoogleTranslateTtsFallback(text.slice(0, 3000), cleanLang);
        }

        if (!audioDataUri) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Audio synthesis failed to produce audio content.' }));
        }

        if (articleId) {
          serverAudioCache.set(cacheKey, audioDataUri);
        }

        console.log(`[Server Audio Generated] Successfully created audio for key: ${cacheKey}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          audioUrl: audioDataUri,
          isCached: false,
          provider: config.provider || 'google_fallback'
        }));

      } catch (err) {
        console.error('[Server TTS Exception]', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Internal Server Error', message: err.message }));
      }
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/translate') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', async () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const { text, targetLang = 'en' } = body;

        if (!text || !text.trim() || targetLang === 'en') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ translatedText: text, isCached: true }));
        }

        // Key by unique targetLang + text string to prevent cache collisions
        const cacheKey = `${targetLang}:${text}`;

        if (serverTranslationCache.has(cacheKey)) {
          const cached = serverTranslationCache.get(cacheKey);
          if (cached && cached !== text) {
            console.log(`[Server Translation Cache HIT] Serving cached translation for (${targetLang}): ${cacheKey.slice(0, 40)}...`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
              translatedText: cached,
              isCached: true
            }));
          }
        }

        const googleKey = process.env.GOOGLE_CLOUD_TRANSLATE_API_KEY || process.env.GOOGLE_CLOUD_TTS_API_KEY;
        let translatedText = null;

        // Tier 1: Google Cloud Translation API v2
        if (googleKey) {
          try {
            const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${googleKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                q: text,
                target: targetLang,
                format: 'text'
              })
            });

            if (response.ok) {
              const data = await response.json();
              if (data && data.data && data.data.translations && data.data.translations[0]) {
                translatedText = data.data.translations[0].translatedText;
              }
            } else {
              const errText = await response.text();
              console.warn('[Google Cloud Translation Error]', response.status, errText);
            }
          } catch (e) {
            console.warn('[Google Cloud Translation Exception]', e.message);
          }
        }

        // Tier 2: Clients5 Chrome Extension Translate Endpoint (Fast & Highly Reliable)
        if (!translatedText) {
          try {
            const clients5Res = await fetch(`https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=${targetLang}&q=${encodeURIComponent(text)}`);
            if (clients5Res.ok) {
              const data = await clients5Res.json();
              if (Array.isArray(data) && data.length > 0) {
                if (typeof data[0] === 'string') {
                  translatedText = data[0];
                } else if (Array.isArray(data[0])) {
                  translatedText = data[0].map(item => (Array.isArray(item) ? item[0] : item)).join(' ');
                }
              }
            }
          } catch (e) {
            console.warn('[Clients5 Translation Exception]', e.message);
          }
        }

        // Tier 3: MyMemory Translation API
        if (!translatedText) {
          try {
            const myMemoryRes = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetLang}`);
            if (myMemoryRes.ok) {
              const data = await myMemoryRes.json();
              if (data && data.responseData && data.responseData.translatedText) {
                translatedText = data.responseData.translatedText;
              }
            }
          } catch (e) {
            console.warn('[MyMemory Translation Exception]', e.message);
          }
        }

        // Tier 4: Classic Google GTX Endpoint
        if (!translatedText) {
          try {
            const gtxRes = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`);
            if (gtxRes.ok) {
              const data = await gtxRes.json();
              if (data && data[0]) {
                translatedText = data[0].map(item => item[0]).join('');
              }
            }
          } catch (e) {}
        }

        const isSuccess = !!(translatedText && translatedText !== text);
        const finalTranslation = isSuccess ? translatedText : text;

        if (isSuccess) {
          serverTranslationCache.set(cacheKey, finalTranslation);
          console.log(`[Server Translation Success] (${targetLang}): "${text.slice(0, 30)}..." -> "${finalTranslation.slice(0, 30)}..."`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          translatedText: finalTranslation,
          isCached: false,
          success: isSuccess
        }));

      } catch (err) {
        console.error('[Server Translation Exception]', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Translation Exception', message: err.message, translatedText: text }));
      }
    });
    return;
  }

  // -------------------------------------------------------------
  // ANALYTICS & VIEW TRACKING ENDPOINTS
  // -------------------------------------------------------------

  // 1. POST /api/views/start
  if (req.method === 'POST' && url.pathname === '/api/views/start') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const { articleId = '1', userId = null } = body;
        const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const country = resolveIpToCountry(req);
        const ipAddress = req.socket?.remoteAddress || '127.0.0.1';

        const viewRecord = {
          id: `v-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          articleId: String(articleId),
          userId: userId ? String(userId) : null,
          sessionId,
          ipAddress,
          country,
          readDurationSeconds: 0,
          scrollDepth: 0,
          createdAt: new Date().toISOString()
        };

        articleViews.push(viewRecord);
        activeViewSessions.set(sessionId, {
          articleId: String(articleId),
          startTime: Date.now(),
          lastHeartbeat: Date.now(),
          scrollDepth: 0,
          country,
          viewRecordRef: viewRecord
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ sessionId, country, status: 'started' }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // 2. POST /api/views/heartbeat
  if (req.method === 'POST' && url.pathname === '/api/views/heartbeat') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const { sessionId, scrollDepth = 0 } = body;
        if (sessionId && activeViewSessions.has(sessionId)) {
          const sess = activeViewSessions.get(sessionId);
          sess.lastHeartbeat = Date.now();
          sess.scrollDepth = Math.max(sess.scrollDepth || 0, scrollDepth);
          const elapsedSecs = Math.round((Date.now() - sess.startTime) / 1000);
          if (sess.viewRecordRef) {
            sess.viewRecordRef.readDurationSeconds = elapsedSecs;
            sess.viewRecordRef.scrollDepth = sess.scrollDepth;
          }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false }));
      }
    });
    return;
  }

  // 3. POST /api/views/end
  if (req.method === 'POST' && url.pathname === '/api/views/end') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const { sessionId, readDurationSeconds = 0, scrollDepth = 0 } = body;
        if (sessionId && activeViewSessions.has(sessionId)) {
          const sess = activeViewSessions.get(sessionId);
          const finalDuration = readDurationSeconds || Math.round((Date.now() - sess.startTime) / 1000);
          if (sess.viewRecordRef) {
            sess.viewRecordRef.readDurationSeconds = Math.max(sess.viewRecordRef.readDurationSeconds || 0, finalDuration);
            sess.viewRecordRef.scrollDepth = Math.max(sess.viewRecordRef.scrollDepth || 0, scrollDepth);
          }
          activeViewSessions.delete(sessionId);
        }
        runDailyAggregationJob();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false }));
      }
    });
    return;
  }

  // 4. GET /api/analytics/overview
  if (req.method === 'GET' && url.pathname === '/api/analytics/overview') {
    runDailyAggregationJob();
    const totalViews = articleViews.length;
    const uniqueSessions = new Set(articleViews.map(v => v.sessionId)).size;
    const totalDuration = articleViews.reduce((acc, v) => acc + (v.readDurationSeconds || 0), 0);
    const avgReadTime = totalViews > 0 ? Math.round(totalDuration / totalViews) : 0;

    const countryMap = {};
    articleViews.forEach(v => {
      const c = v.country || 'IN';
      countryMap[c] = (countryMap[c] || 0) + 1;
    });

    // Last 7 days trend aggregation
    const daysTrend = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      let dayViews = 0;
      for (const [key, val] of articleStatsDaily.entries()) {
        if (key.endsWith(`_${dateStr}`)) {
          dayViews += val.viewsCount || 0;
        }
      }
      daysTrend.push({ date: dateStr, views: dayViews });
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      totalViews,
      uniqueReaders: uniqueSessions,
      avgReadTimeSeconds: avgReadTime,
      countryBreakdown: countryMap,
      recentTrend: daysTrend
    }));
  }

  // 5. GET /api/analytics/trending?period=day|week|month
  if (req.method === 'GET' && url.pathname === '/api/analytics/trending') {
    runDailyAggregationJob();
    const period = url.searchParams.get('period') || 'week'; // day, week, month
    const daysLimit = period === 'day' ? 1 : period === 'month' ? 30 : 7;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysLimit);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    const articleTotals = {};
    for (const [key, stat] of articleStatsDaily.entries()) {
      if (stat.date >= cutoffStr) {
        if (!articleTotals[stat.articleId]) {
          articleTotals[stat.articleId] = { articleId: stat.articleId, totalViews: 0, uniqueViews: 0, sumAvgRead: 0, count: 0 };
        }
        articleTotals[stat.articleId].totalViews += stat.viewsCount;
        articleTotals[stat.articleId].uniqueViews += stat.uniqueViewsCount;
        articleTotals[stat.articleId].sumAvgRead += stat.avgReadDuration;
        articleTotals[stat.articleId].count += 1;
      }
    }

    const trendingList = Object.values(articleTotals).map(item => ({
      articleId: item.articleId,
      totalViews: item.totalViews,
      uniqueViews: item.uniqueViews,
      avgReadDuration: parseFloat((item.sumAvgRead / (item.count || 1)).toFixed(1))
    })).sort((a, b) => b.totalViews - a.totalViews);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ period, trending: trendingList }));
  }

  // 6. GET /api/analytics/article/:id/summary
  if (req.method === 'GET' && url.pathname.startsWith('/api/analytics/article/') && url.pathname.endsWith('/summary')) {
    const parts = url.pathname.split('/');
    const articleId = parts[4];
    const viewsForArt = articleViews.filter(v => v.articleId === String(articleId));
    const totalViews = viewsForArt.length;
    const uniqueCount = new Set(viewsForArt.map(v => v.sessionId)).size;
    const sumDuration = viewsForArt.reduce((acc, v) => acc + (v.readDurationSeconds || 0), 0);
    const avgRead = totalViews > 0 ? parseFloat((sumDuration / totalViews).toFixed(1)) : 0;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ articleId, totalViews, uniqueViews: uniqueCount, avgReadDuration: avgRead }));
  }

  // 7. GET /api/analytics/article/:id/trend
  if (req.method === 'GET' && url.pathname.startsWith('/api/analytics/article/') && url.pathname.endsWith('/trend')) {
    const parts = url.pathname.split('/');
    const articleId = parts[4];
    const trendData = [];
    for (const [key, stat] of articleStatsDaily.entries()) {
      if (stat.articleId === String(articleId)) {
        trendData.push({ date: stat.date, views: stat.viewsCount, uniqueViews: stat.uniqueViewsCount });
      }
    }
    trendData.sort((a, b) => a.date.localeCompare(b.date));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ articleId, trend: trendData }));
  }

  // 8. GET /api/analytics/article/:id/countries
  if (req.method === 'GET' && url.pathname.startsWith('/api/analytics/article/') && url.pathname.endsWith('/countries')) {
    const parts = url.pathname.split('/');
    const articleId = parts[4];
    const countryMap = {};
    articleViews.filter(v => v.articleId === String(articleId)).forEach(v => {
      const c = v.country || 'IN';
      countryMap[c] = (countryMap[c] || 0) + 1;
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ articleId, countryBreakdown: countryMap }));
  }

  // -------------------------------------------------------------
  // AUDIO PLAYBACK PROGRESS ENDPOINTS
  // -------------------------------------------------------------

  // POST /api/audio/progress (Save progress per article & language)
  if (req.method === 'POST' && url.pathname === '/api/audio/progress') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const { articleId, langCode = 'hi', positionSeconds = 0 } = body;
        if (articleId && langCode) {
          const key = `${articleId}_${langCode}`;
          const pos = Math.max(0, parseFloat(positionSeconds) || 0);
          serverAudioProgressMap.set(key, pos);
          console.log(`[Backend Audio Progress Saved] (${key}): ${pos.toFixed(1)}s`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, articleId, langCode, positionSeconds: pos }));
        }
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'articleId and langCode are required.' }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // GET /api/audio/progress (Retrieve saved progress for article & language)
  if (req.method === 'GET' && url.pathname === '/api/audio/progress') {
    const articleId = url.searchParams.get('articleId');
    const langCode = url.searchParams.get('langCode') || 'hi';
    if (articleId) {
      const key = `${articleId}_${langCode}`;
      const pos = serverAudioProgressMap.get(key) || 0;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ articleId, langCode, last_position_seconds: pos }));
    }
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'articleId query parameter is required.' }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

server.listen(PORT, () => {
  console.log(`🚀 PublicSpark Newsroom Backend Proxy running at http://localhost:${PORT}`);
});
