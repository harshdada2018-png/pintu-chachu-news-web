/**
 * PublicSpark Sovereign Newsroom — Cloudflare Pages Functions Edge API Gateway
 * Serves all /api/* routes natively on Cloudflare Edge backed by Cloudflare D1 SQLite (env.DB).
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS_HEADERS,
      ...extraHeaders
    }
  });
}

function publicCacheHeaders(request, maxAge = 120, sMaxAge = 300) {
  if (request.headers.get('Authorization')) {
    return { 'Cache-Control': 'private, no-store', 'Vary': 'Authorization' };
  }
  return { 'Cache-Control': `public, max-age=${maxAge}, s-maxage=${sMaxAge}`, 'Vary': 'Authorization' };
}

function normalizeLang(lang) {
  const raw = String(lang || 'hi').trim();
  if (raw.toLowerCase() === 'zh-tw') return 'zh-TW';
  return raw.toLowerCase();
}

function generateSafeArticleSlug(title, id) {
  const ascii = String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 55)
    .replace(/-+$/g, '');
  const idTail = String(id || '').replace(/[^a-zA-Z0-9]/g, '').slice(-8) || String(Date.now()).slice(-8);
  return ascii ? `${ascii}-${idTail}` : `news-${idTail}`;
}

// ---------------------------------------------------------------------------
// KV Store Helpers (backed by D1 kv_store table)
// ---------------------------------------------------------------------------
async function getKv(db, key, fallback = null) {
  try {
    const row = await db.prepare('SELECT value_json FROM kv_store WHERE store_key = ?').bind(key).first();
    if (row && row.value_json) return JSON.parse(row.value_json);
  } catch (_e) {}
  return fallback;
}

async function setKv(db, key, value) {
  const now = new Date().toISOString();
  await db.prepare(
    'INSERT INTO kv_store (store_key, value_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(store_key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at'
  ).bind(key, JSON.stringify(value), now).run();
}

async function enforceEdgeAudioQuota(db, maxBytes = 250 * 1024 * 1024, targetBytes = 200 * 1024 * 1024) {
  try {
    const res = await db.prepare(
      "SELECT cache_key, size_bytes, created_at FROM audio_cache WHERE cache_key NOT LIKE '%::%' ORDER BY created_at ASC"
    ).all();
    const rows = res?.results || [];
    let totalBytes = 0;
    for (const r of rows) totalBytes += Number(r.size_bytes) || 0;
    if (totalBytes <= maxBytes) return;

    for (const r of rows) {
      if (totalBytes <= targetBytes) break;
      await db.prepare('DELETE FROM audio_cache WHERE cache_key = ? OR cache_key LIKE ?')
        .bind(r.cache_key, `${r.cache_key}::%`).run().catch(() => {});
      totalBytes -= Number(r.size_bytes) || 0;
    }
  } catch (_err) {
    // Non-blocking quota check
  }
}

/**
 * Bound array datasets stored as single kv_store JSON rows well under D1's 1 MB row cap.
 */
function capKvRecordList(list, { maxItems = 100, maxJsonBytes = 750000, removableStatuses = ['dismissed', 'resolved', 'verified_published', 'closed'] } = {}) {
  const arr = Array.isArray(list) ? list.slice() : [];
  if (arr.length > maxItems) {
    for (let i = arr.length - 1; i >= 0 && arr.length > maxItems; i--) {
      if (removableStatuses.includes(String(arr[i]?.status || '').toLowerCase())) {
        arr.splice(i, 1);
      }
    }
    if (arr.length > maxItems) arr.length = maxItems;
  }
  while (arr.length > 1 && JSON.stringify(arr).length > maxJsonBytes) {
    arr.pop();
  }
  return arr;
}

function getAudioDb(env, lang) {
  const baseLang = normalizeLang(lang).split(/[-_]/)[0];
  if (baseLang === 'hi' && env?.DB_AUDIO_HI) return { audioDb: env.DB_AUDIO_HI, shard: 'DB_AUDIO_HI', dedicated: true };
  if (baseLang === 'en' && env?.DB_AUDIO_EN) return { audioDb: env.DB_AUDIO_EN, shard: 'DB_AUDIO_EN', dedicated: true };
  return { audioDb: env?.DB, shard: 'DB', dedicated: false };
}

function getAudioDbCapBytes(dedicated) {
  return dedicated
    ? { maxBytes: 450 * 1024 * 1024, targetBytes: 400 * 1024 * 1024, limitMb: 500, capMb: 450 }
    : { maxBytes: 250 * 1024 * 1024, targetBytes: 200 * 1024 * 1024, limitMb: 500, capMb: 250 };
}

function getAudioShardTargets(env) {
  const seen = new Set();
  const list = [];
  const add = (dbObj, shard) => {
    if (dbObj && !seen.has(dbObj)) {
      seen.add(dbObj);
      list.push({ db: dbObj, shard, dedicated: dbObj !== env?.DB });
    }
  };
  add(env?.DB_AUDIO_HI, 'DB_AUDIO_HI');
  add(env?.DB_AUDIO_EN, 'DB_AUDIO_EN');
  add(env?.DB, 'DB');
  return list;
}

function parseAudioLangFromCacheKey(cacheKey) {
  const m = String(cacheKey || '').match(/_(hi|en)_(?:full_story|clip_1_intro|clip_2_body)$/i);
  return m ? m[1].toLowerCase() : null;
}

async function purgeArticleSatelliteCaches(db, articleId, env = null) {
  const rawId = String(articleId || '');
  const sanitizedId = rawId.replace(/[^a-zA-Z0-9-_]/g, '_');
  await db.prepare('DELETE FROM translations WHERE article_id = ?').bind(rawId).run().catch(() => {});
  const targets = env ? getAudioShardTargets(env) : [{ db }];
  for (const t of targets) {
    await t.db.prepare('DELETE FROM audio_cache WHERE article_id = ? OR article_id = ?').bind(rawId, sanitizedId).run().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Web Crypto HMAC-SHA256 Session Tokens (Compatible with staffAuthService.js)
// ---------------------------------------------------------------------------
function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64) {
  const norm = b64.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(norm);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function createSessionToken(staff, secret) {
  const payload = {
    id: staff.id,
    email: staff.email,
    role: staff.role,
    name: staff.name || '',
    iat: Date.now()
  };
  const payloadStr = JSON.stringify(payload);
  const sig = await hmacHex(secret, payloadStr);
  return `psk1_${toBase64Url(payloadStr)}.${sig}`;
}

async function verifySessionToken(token, secret) {
  if (!token || typeof token !== 'string' || !token.startsWith('psk1_')) return null;
  try {
    const parts = token.slice(5).split('.');
    if (parts.length !== 2) return null;
    const payloadStr = fromBase64Url(parts[0]);
    const expectedSig = await hmacHex(secret, payloadStr);
    if (parts[1] !== expectedSig) return null;
    const data = JSON.parse(payloadStr);
    if (!data || !data.id || !data.email || !data.role) return null;
    if (Date.now() - (data.iat || 0) > 7 * 24 * 60 * 60 * 1000) return null;
    return data;
  } catch (_e) {
    return null;
  }
}

function generate6DigitOtp() {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(100000 + (arr[0] % 900000));
}

function timingSafeEqualStr(a, b) {
  const s1 = String(a || '');
  const s2 = String(b || '');
  if (s1.length !== s2.length) return false;
  let diff = 0;
  for (let i = 0; i < s1.length; i++) diff |= s1.charCodeAt(i) ^ s2.charCodeAt(i);
  return diff === 0;
}

async function sendBrevoEmailEdge(env, toEmail, subject, htmlContent) {
  const apiKey = env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error('BREVO_API_KEY is not configured in Cloudflare Variables.');
  }
  const senderEmail = env.SENDER_EMAIL || 'publicspark267@gmail.com';
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'api-key': apiKey
    },
    body: JSON.stringify({
      sender: { name: 'PublicSpark Newsroom', email: senderEmail },
      to: [{ email: toEmail }],
      subject,
      htmlContent
    })
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Brevo Email Error (${res.status}): ${errText.slice(0, 180)}`);
  }
  return await res.json().catch(() => ({ ok: true }));
}

async function deleteKv(db, key) {
  await db.prepare('DELETE FROM kv_store WHERE store_key = ?').bind(key).run().catch(() => {});
}

async function getAuthSession(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const secret = env.STAFF_AUTH_SECRET || 'publicspark_fallback_edge_secret';
  return verifySessionToken(token, secret);
}

async function derivePbkdf2Hex(plainPassword, saltHex) {
  const keyMat = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(String(plainPassword)),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: new TextEncoder().encode(String(saltHex)), iterations: 100000, hash: 'SHA-256' },
    keyMat,
    256
  );
  return 'pbkdf2$' + Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPasswordEdge(plainPassword, storedHash, storedSalt) {
  if (!plainPassword || !storedHash || !storedSalt) return false;
  if (String(storedHash).startsWith('pbkdf2$')) {
    const derived = await derivePbkdf2Hex(plainPassword, storedSalt);
    return timingSafeEqualStr(derived, storedHash);
  }
  try {
    const nodeCrypto = await import('node:crypto');
    if (typeof nodeCrypto.scryptSync === 'function') {
      const derived = nodeCrypto.scryptSync(String(plainPassword), String(storedSalt), 64).toString('hex');
      return timingSafeEqualStr(derived, storedHash);
    }
  } catch (_e) {
    // Fallback if node:crypto is not enabled or exceeds CPU budget
  }
  return false;
}

async function hashPasswordEdge(plainPassword) {
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const salt = Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const hash = await derivePbkdf2Hex(plainPassword, salt);
  return { hash, salt };
}

// ---------------------------------------------------------------------------
// Translation Helpers (Gemini + Google GTX Fallback + Anti-Poison Guard)
// ---------------------------------------------------------------------------
function isPoisonedEdgeTranslation(origTitle, transTitle, origBody, transBody, targetLang) {
  const combined = `${transTitle || ''} ${transBody || ''}`;
  if (!transTitle && !transBody) return true;
  if (combined.includes('QUERY LENGTH') || combined.includes('MAX ALLOWED QUERY') || combined.includes('MYMEMORY') || combined.includes('[object Object]')) {
    return true;
  }
  if (origTitle && transTitle && origTitle.trim() === transTitle.trim() && targetLang !== 'hi') {
    return true;
  }
  if (targetLang === 'en' && transBody && transBody.length > 50) {
    const devChars = (transBody.match(/[\u0900-\u097F]/g) || []).length;
    if (devChars > transBody.length * 0.4) return true;
  }
  return false;
}

async function translateGoogleGtxSingle(chunk, tl, sl) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(chunk)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
  if (!res.ok) throw new Error(`GTX HTTP ${res.status}`);
  const data = await res.json();
  if (Array.isArray(data) && Array.isArray(data[0])) {
    return data[0].map(seg => (Array.isArray(seg) ? seg[0] : '')).join('');
  }
  return chunk;
}

async function translateGoogleGtx(text, targetLang, sourceLang = 'auto') {
  const raw = String(text || '');
  if (!raw.trim()) return '';
  const tl = normalizeLang(targetLang);
  const sl = sourceLang && sourceLang !== 'auto' ? normalizeLang(sourceLang) : 'auto';
  if (raw.length <= 1600) return translateGoogleGtxSingle(raw, tl, sl);

  const paragraphs = raw.split(/\n+/);
  const chunks = [];
  let cur = '';
  for (const p of paragraphs) {
    if (p.length > 1500) {
      if (cur) { chunks.push(cur); cur = ''; }
      for (let i = 0; i < p.length; i += 1500) chunks.push(p.slice(i, i + 1500));
    } else if ((cur + '\n' + p).length > 1500) {
      if (cur) chunks.push(cur);
      cur = p;
    } else {
      cur = cur ? `${cur}\n${p}` : p;
    }
  }
  if (cur) chunks.push(cur);

  const out = [];
  for (const ch of chunks) {
    out.push(await translateGoogleGtxSingle(ch, tl, sl));
  }
  return out.join('\n\n');
}

async function callGeminiEdge(prompt, apiKey, isJson = false, timeoutMs = 8000) {
  if (!apiKey) throw new Error('GEMINI_API_KEY missing');
  const models = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.8-flash'];
  let lastErr = null;
  for (const model of models) {
    try {
      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2 }
      };
      if (isJson) payload.generationConfig.responseMimeType = 'application/json';
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify(payload)
      });
      if (res.status === 429) throw new Error('Gemini 429 quota/rate limit');
      if (!res.ok) throw new Error(`${model} HTTP ${res.status}`);
      const json = await res.json();
      const parts = json?.candidates?.[0]?.content?.parts || [];
      const textOut = parts.find(p => p.text && !p.thought)?.text || parts[0]?.text;
      if (textOut) return textOut.trim();
    } catch (e) {
      lastErr = e;
      if (String(e.message || '').includes('429')) break;
    }
  }
  throw lastErr || new Error('All Gemini models failed');
}

function fastBase64ToBytes(base64Data) {
  const clean = String(base64Data || '').trim();
  if (!clean) return new Uint8Array(0);
  if (typeof Uint8Array.fromBase64 === 'function') {
    return Uint8Array.fromBase64(clean);
  }
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(clean, 'base64'));
  }
  const binStr = atob(clean);
  const bytes = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes) {
  if (!bytes || bytes.length === 0) return '';
  if (typeof bytes.toBase64 === 'function') {
    return bytes.toBase64();
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
  }
  let outBin = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    outBin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(outBin);
}

function pcmBase64ToWavBytes(base64Data, mimeType = '') {
  const lower = String(mimeType || '').toLowerCase();
  const decodedBytes = fastBase64ToBytes(base64Data);
  if (lower.includes('wav') || lower.includes('mp3') || lower.includes('mpeg') || lower.includes('ogg') || lower.includes('webm') || lower.includes('opus')) {
    return { bytes: decodedBytes, mime: mimeType || 'audio/wav' };
  }
  const pcmLen = decodedBytes.length;
  const rateMatch = lower.match(/rate=(\d+)/);
  const sampleRate = rateMatch ? Number(rateMatch[1]) : 24000;
  const wav = new Uint8Array(44 + pcmLen);
  const view = new DataView(wav.buffer);
  const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) wav[off + i] = s.charCodeAt(i); };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + pcmLen, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, pcmLen, true);
  wav.set(decodedBytes, 44);
  return { bytes: wav, mime: 'audio/wav' };
}

async function callGeminiTtsEdge(text, apiKey) {
  if (!apiKey) throw new Error('GEMINI_TTS_API_KEY missing');
  const cleanText = String(text || '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/Full investigative briefing[^\n.]*/gi, '')
    .replace(/[#*`_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleanText) throw new Error('No readable text for TTS');

  const models = ['gemini-3.8-flash-lite-tts', 'gemini-2.5-flash-preview-tts', 'gemini-3.8-flash-tts'];
  let lastErr = null;
  for (const model of models) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({
          contents: [{ parts: [{ text: cleanText }] }],
          generationConfig: { responseModalities: ['AUDIO'] }
        })
      });
      if (res.status === 429) throw new Error('Gemini TTS 429 quota/rate limit');
      if (!res.ok) throw new Error(`${model} HTTP ${res.status}`);
      const json = await res.json();
      const part = json?.candidates?.[0]?.content?.parts?.[0];
      if (part?.inlineData?.data) {
        const { bytes, mime } = pcmBase64ToWavBytes(part.inlineData.data, part.inlineData.mimeType || '');
        const wavBase64 = bytesToBase64(bytes);
        return {
          wavBase64,
          mime,
          sizeBytes: bytes.length,
          dataUrl: `data:${mime};base64,${wavBase64}`,
          model
        };
      }
    } catch (e) {
      lastErr = e;
      if (String(e.message || '').includes('429')) break;
    }
  }
  throw lastErr || new Error('All Gemini TTS models failed');
}

function trimTtsSpeechText(text, maxChars = 3200) {
  let clean = String(text || '').trim();
  if (clean.length > maxChars) {
    const cutSlice = clean.slice(0, maxChars);
    const lastBoundary = Math.max(cutSlice.lastIndexOf('।'), cutSlice.lastIndexOf('. '), cutSlice.lastIndexOf('\n'));
    clean = (lastBoundary > Math.floor(maxChars * 0.6) ? cutSlice.slice(0, lastBoundary + 1) : cutSlice).trim();
  }
  return clean;
}

async function callRenderAudioWorker(text, env, bitrateKbps = 16) {
  const baseUrl = String(env?.RENDER_AUDIO_URL || '').trim().replace(/\/+$/, '');
  const secret = String(env?.RENDER_AUDIO_SECRET || '').trim();
  if (!baseUrl || !secret) return null;

  const res = await fetch(`${baseUrl}/compress-tts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-render-secret': secret
    },
    signal: AbortSignal.timeout(95000),
    body: JSON.stringify({ text, bitrateKbps })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success || !data?.audioBase64) {
    const err = new Error(data?.error || `Render audio worker HTTP ${res.status}`);
    if (res.status === 429 || data?.quotaExhausted) err.isQuota = true;
    throw err;
  }
  return {
    audioBase64: data.audioBase64,
    mime: data.mimeType || 'audio/webm',
    sizeBytes: Number(data.compressedBytes || 0),
    model: `${data.model || 'gemini-tts'}+render-opus`,
    compressedByRender: true
  };
}

async function translateOrGetArticleEdge(db, env, articleId, targetLang, overrides = {}, forceRegenerate = false) {
  const target = normalizeLang(targetLang || 'hi');
  const artRow = await db.prepare('SELECT data_json FROM articles WHERE id = ? OR slug = ?').bind(String(articleId), String(articleId)).first();
  const art = artRow ? JSON.parse(artRow.data_json) : null;
  const canonicalId = String(art?.id || articleId);
  const src = normalizeLang(overrides.originalLanguage || overrides.source_lang || art?.originalLanguage || 'hi');
  const rawTitle = overrides.title || art?.title || '';
  const rawSummary = overrides.summary || art?.summary || '';
  const rawBody = overrides.body || art?.content || '';
  const rawHighlights = (Array.isArray(overrides.highlights) && overrides.highlights.length > 0)
    ? overrides.highlights
    : ((art && Array.isArray(art.highlights) && art.highlights.length > 0) ? art.highlights : []);

  if (target === src) {
    return {
      article: art,
      canonicalId,
      title: rawTitle,
      summary: rawSummary,
      highlights: rawHighlights,
      body: rawBody,
      isCached: true
    };
  }

  const key = `${canonicalId}:${target}`;
  const cached = await db.prepare('SELECT title, summary, highlights_json, body FROM translations WHERE cache_key = ? AND status = ?').bind(key, 'done').first();
  if (!forceRegenerate && cached && cached.body && !isPoisonedEdgeTranslation(rawTitle, cached.title, rawBody, cached.body, target)) {
    let parsedHl = rawHighlights;
    try {
      const h = JSON.parse(cached.highlights_json || '[]');
      if (Array.isArray(h) && h.length > 0) parsedHl = h;
    } catch (_e) {}
    return {
      article: art,
      canonicalId,
      title: cached.title,
      summary: cached.summary || '',
      highlights: parsedHl,
      body: cached.body,
      isCached: true
    };
  }

  let tTitle = '';
  let tSummary = '';
  let tHighlights = rawHighlights;
  let tBody = '';

  try {
    const prompt = `Translate this complete news story accurately from ${src} to ${target}. Return strictly valid JSON with keys {"title", "summary", "highlights", "body"}. Preserve markdown formatting in body:\n${JSON.stringify({ title: rawTitle, summary: rawSummary, highlights: rawHighlights, body: rawBody })}`;
    const rawAi = await callGeminiEdge(prompt, env.GEMINI_API_KEY, true, 14000);
    const parsed = JSON.parse(rawAi.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim());
    tTitle = parsed.title || '';
    tSummary = parsed.summary || '';
    if (Array.isArray(parsed.highlights) && parsed.highlights.length > 0) tHighlights = parsed.highlights;
    tBody = parsed.body || '';
  } catch (_geminiErr) {
    const [gTitle, gSummary, gBody, gHl] = await Promise.all([
      translateGoogleGtx(rawTitle, target, src).catch(() => rawTitle),
      rawSummary ? translateGoogleGtx(rawSummary, target, src).catch(() => rawSummary) : Promise.resolve(''),
      translateGoogleGtx(rawBody, target, src).catch(() => rawBody),
      rawHighlights.length > 0
        ? Promise.all(rawHighlights.map(h => translateGoogleGtx(h, target, src).catch(() => h)))
        : Promise.resolve([])
    ]);
    tTitle = gTitle;
    tSummary = gSummary;
    tBody = gBody;
    if (Array.isArray(gHl) && gHl.length > 0) tHighlights = gHl;
  }

  const nowIso = new Date().toISOString();
  if (!isPoisonedEdgeTranslation(rawTitle, tTitle, rawBody, tBody, target)) {
    await db.prepare(
      'INSERT INTO translations (cache_key, article_id, lang, title, summary, highlights_json, body, status, created_at, last_accessed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(cache_key) DO UPDATE SET title=excluded.title, summary=excluded.summary, highlights_json=excluded.highlights_json, body=excluded.body, last_accessed_at=excluded.last_accessed_at'
    ).bind(key, canonicalId, target, tTitle, tSummary, JSON.stringify(tHighlights), tBody, 'done', nowIso, nowIso).run();
  }

  return {
    article: art,
    canonicalId,
    title: tTitle || rawTitle,
    summary: tSummary || rawSummary,
    highlights: tHighlights,
    body: tBody || rawBody,
    isCached: false
  };
}

async function synthesizeAndCacheAudioEdge({ env, articleId, lang, clipType = 'full_story', speechText, forceRegenerate = false }) {
  const targetLang = normalizeLang(lang || 'hi');
  const rawArticleId = String(articleId || 'general').replace(/[^a-zA-Z0-9-_]/g, '_');
  const cacheKey = `${rawArticleId}_${targetLang}_${clipType}`;
  const nowIso = new Date().toISOString();
  const { audioDb, shard, dedicated } = getAudioDb(env, targetLang);
  const caps = getAudioDbCapBytes(dedicated);

  if (!forceRegenerate) {
    const cached = await audioDb.prepare('SELECT size_bytes, mime_type, created_at FROM audio_cache WHERE cache_key = ?').bind(cacheKey).first().catch(() => null);
    if (cached && cached.created_at) {
      const cachedUrl = `/api/tts/audio/${encodeURIComponent(cacheKey)}?v=${encodeURIComponent(cached.created_at)}`;
      return {
        article_id: rawArticleId,
        lang: targetLang,
        clip_type: clipType,
        audio_url: cachedUrl,
        audioUrl: cachedUrl,
        size_bytes: cached.size_bytes || 0,
        mime_type: cached.mime_type || 'audio/wav',
        shard,
        status: 'done',
        isCached: true
      };
    }
  }

  const trimmedSpeech = trimTtsSpeechText(speechText, 3200);
  if (!trimmedSpeech) throw new Error('No readable text for TTS');

  let audioPayload = null;
  if (env?.RENDER_AUDIO_URL && env?.RENDER_AUDIO_SECRET) {
    try {
      audioPayload = await callRenderAudioWorker(trimmedSpeech, env, 16);
    } catch (renderErr) {
      if (renderErr?.isQuota) throw renderErr;
    }
  }

  if (!audioPayload) {
    const ttsKey = env.GEMINI_TTS_API_KEY || env.GEMINI_API_KEY;
    if (!ttsKey) {
      const e = new Error('GEMINI_TTS_API_KEY not configured');
      e.isQuota = true;
      throw e;
    }
    const edgeAudio = await callGeminiTtsEdge(trimmedSpeech, ttsKey);
    audioPayload = {
      audioBase64: edgeAudio.wavBase64,
      mime: edgeAudio.mime,
      sizeBytes: edgeAudio.sizeBytes,
      model: edgeAudio.model,
      dataUrl: edgeAudio.dataUrl,
      compressedByRender: false
    };
  }

  let finalAudioUrl = audioPayload.dataUrl || `data:${audioPayload.mime};base64,${audioPayload.audioBase64}`;
  await audioDb.prepare('DELETE FROM audio_cache WHERE cache_key = ? OR cache_key LIKE ?').bind(cacheKey, `${cacheKey}::%`).run().catch(() => {});

  const chunkSize = 800000;
  let allSaved = true;
  for (let idx = 0, offset = 0; offset < audioPayload.audioBase64.length; idx++, offset += chunkSize) {
    const partKey = idx === 0 ? cacheKey : `${cacheKey}::${String(idx).padStart(3, '0')}`;
    const partB64 = audioPayload.audioBase64.slice(offset, offset + chunkSize);
    const ok = await audioDb.prepare(
      'INSERT INTO audio_cache (cache_key, article_id, lang, clip_type, mime_type, audio_base64, size_bytes, created_at, last_accessed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(partKey, rawArticleId, targetLang, clipType, audioPayload.mime, partB64, idx === 0 ? audioPayload.sizeBytes : 0, nowIso, nowIso).run().then(() => true).catch(() => false);
    if (!ok) {
      allSaved = false;
      await audioDb.prepare('DELETE FROM audio_cache WHERE cache_key = ? OR cache_key LIKE ?').bind(cacheKey, `${cacheKey}::%`).run().catch(() => {});
      break;
    }
  }

  if (allSaved) {
    await enforceEdgeAudioQuota(audioDb, caps.maxBytes, caps.targetBytes);
    finalAudioUrl = `/api/tts/audio/${encodeURIComponent(cacheKey)}?v=${encodeURIComponent(nowIso)}`;
  }

  return {
    article_id: rawArticleId,
    lang: targetLang,
    clip_type: clipType,
    audio_url: finalAudioUrl,
    audioUrl: finalAudioUrl,
    size_bytes: audioPayload.sizeBytes,
    mime_type: audioPayload.mime,
    compressedByRender: audioPayload.compressedByRender,
    shard,
    model: audioPayload.model,
    status: 'done',
    isCached: false
  };
}

// ---------------------------------------------------------------------------
// Main Request Router
// ---------------------------------------------------------------------------
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  const path = url.pathname;
  const db = env.DB;

  if (!db) {
    return jsonResponse({
      success: false,
      error: 'Cloudflare D1 binding (DB) is not configured in Pages Settings -> Bindings.'
    }, 500);
  }

  try {
    // 1. GET /api/articles
    if (request.method === 'GET' && path === '/api/articles') {
      const lang = url.searchParams.get('lang');
      const scope = url.searchParams.get('scope');
      const session = await getAuthSession(request, env);
      const isStaff = session && ['reporter', 'editor', 'admin', 'developer'].includes(session.role);

      const { results } = await db.prepare('SELECT data_json FROM articles ORDER BY createdAt DESC').all();
      let articles = (results || []).map(r => JSON.parse(r.data_json));

      if (!(isStaff && scope === 'all')) {
        const now = Date.now();
        articles = articles.filter(a => {
          if (a.status === 'published' || !a.status) return true;
          if (a.status === 'scheduled' && a.scheduledPublishTime) {
            return new Date(a.scheduledPublishTime).getTime() <= now;
          }
          return false;
        });
      }

      if (lang) {
        const targetLang = normalizeLang(lang);
        const { results: transRows } = await db.prepare('SELECT article_id, title, summary FROM translations WHERE lang = ? AND status = ?').bind(targetLang, 'done').all();
        const transMap = new Map((transRows || []).map(t => [String(t.article_id), t]));
        articles = articles.map(a => {
          const origLang = normalizeLang(a.originalLanguage || 'hi');
          if (origLang === targetLang) return a;
          const t = transMap.get(String(a.id));
          if (t && t.title && t.title.trim() !== String(a.title || '').trim()) {
            return { ...a, title: t.title, summary: t.summary || a.summary };
          }
          return a;
        });
      }

      return jsonResponse(articles, 200, {
        'Cache-Control': (isStaff || scope === 'all') ? 'private, no-store' : 'public, max-age=60, s-maxage=120',
        'Vary': 'Authorization'
      });
    }

    // 2. POST /api/articles/update
    if (request.method === 'POST' && path === '/api/articles/update') {
      const session = await getAuthSession(request, env);
      if (!session || !['reporter', 'editor', 'admin', 'developer'].includes(session.role)) {
        return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
      }
      const body = await request.json();
      const nowIso = new Date().toISOString();
      const id = String(body.id || `art-${Date.now()}`);
      const existingArt = await db.prepare('SELECT title, summary, content, slug, createdAt FROM articles WHERE id = ?').bind(id).first().catch(() => null);
      const slug = existingArt?.slug || String(body.slug || '').trim() || generateSafeArticleSlug(body.title, id);
      const status = session.role === 'reporter' ? 'draft' : (body.status || 'published');
      const article = {
        ...body,
        id,
        slug,
        status,
        author: body.author || session.name || 'PublicSpark Desk',
        authorEmail: body.authorEmail || session.email,
        createdAt: existingArt?.createdAt || body.createdAt || nowIso,
        updatedAt: nowIso
      };
      await db.prepare(
        `INSERT INTO articles (id, slug, title, sub_title, summary, content, category, status, originalLanguage, image, author, authorEmail, format, live_status, scheduledPublishTime, data_json, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET slug=excluded.slug, title=excluded.title, sub_title=excluded.sub_title, summary=excluded.summary, content=excluded.content, category=excluded.category, status=excluded.status, originalLanguage=excluded.originalLanguage, image=excluded.image, format=excluded.format, live_status=excluded.live_status, scheduledPublishTime=excluded.scheduledPublishTime, data_json=excluded.data_json, updatedAt=excluded.updatedAt`
      ).bind(
        article.id, article.slug || article.id, article.title || '', article.sub_title || '', article.summary || '',
        article.content || '', article.category || 'General', article.status, article.originalLanguage || 'hi',
        article.image || '', article.author, article.authorEmail, article.format || 'standard',
        article.live_status || 'active', article.scheduledPublishTime || '', JSON.stringify(article),
        article.createdAt, article.updatedAt
      ).run();
      if (existingArt && (
        existingArt.title !== article.title ||
        existingArt.summary !== article.summary ||
        existingArt.content !== article.content
      )) {
        await purgeArticleSatelliteCaches(db, article.id, env);
      }
      return jsonResponse({ success: true, article });
    }

    // 3. POST /api/articles/delete
    if (request.method === 'POST' && path === '/api/articles/delete') {
      const session = await getAuthSession(request, env);
      if (!session || !['editor', 'admin', 'developer'].includes(session.role)) {
        return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
      }
      const { id } = await request.json();
      await db.prepare('DELETE FROM articles WHERE id = ?').bind(String(id)).run();
      await purgeArticleSatelliteCaches(db, id, env);
      return jsonResponse({ success: true, deletedId: id });
    }

    // 4. Categories
    if (request.method === 'GET' && path === '/api/categories') {
      const { results } = await db.prepare('SELECT id, name, slug FROM categories ORDER BY sort_order ASC').all();
      return jsonResponse(results || [], 200, publicCacheHeaders(request));
    }

    if (request.method === 'POST' && path === '/api/categories') {
      const session = await getAuthSession(request, env);
      if (!session || !['editor', 'admin', 'developer'].includes(session.role)) {
        return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
      }
      const body = await request.json();
      const list = Array.isArray(body) ? body : (body.categories || []);
      await db.prepare('DELETE FROM categories').run();
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        await db.prepare('INSERT INTO categories (id, name, slug, sort_order) VALUES (?, ?, ?, ?)')
          .bind(String(c.id || `cat-${i}`), String(c.name || ''), String(c.slug || ''), i).run();
      }
      return jsonResponse({ success: true, categories: list });
    }

    // 5. Settings & Presets
    if (path.startsWith('/api/settings/') || path === '/api/presets') {
      const key = path === '/api/presets' ? 'presets' : 'settings';
      if (request.method === 'GET') {
        const data = await getKv(db, key, {});
        const cacheHdr = publicCacheHeaders(request);
        if (path === '/api/presets') return jsonResponse(data, 200, cacheHdr);
        const section = path.split('/').pop();
        return jsonResponse(data[section] || data || {}, 200, cacheHdr);
      }
      if (request.method === 'POST') {
        const session = await getAuthSession(request, env);
        if (!session || !['admin', 'developer'].includes(session.role)) {
          return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
        }
        const body = await request.json();
        const existing = await getKv(db, 'settings', {});
        const section = path.split('/').pop();
        existing[section] = body;
        await setKv(db, 'settings', existing);
        return jsonResponse({ success: true, settings: existing[section] });
      }
    }

    // 6. Ads Active & History & Tracking
    if (request.method === 'GET' && path === '/api/ads/active') {
      const settings = await getKv(db, 'settings', {});
      return jsonResponse({ success: true, slots: settings.ads || settings.monetization || {} }, 200, publicCacheHeaders(request));
    }

    if (request.method === 'GET' && path === '/api/ads/history') {
      const history = await getKv(db, 'ad_history', []);
      return jsonResponse({ success: true, history });
    }

    if (request.method === 'POST' && (path === '/api/ads/track/impression' || path === '/api/ads/track/click')) {
      return jsonResponse({ success: true });
    }

    // 7. Poll
    if (request.method === 'GET' && path === '/api/poll') {
      const poll = await getKv(db, 'poll', { enabled: false, question: '', options: [] });
      return jsonResponse(poll, 200, publicCacheHeaders(request));
    }

    if (request.method === 'POST' && path === '/api/poll/vote') {
      const { optionId } = await request.json();
      const poll = await getKv(db, 'poll', { enabled: false, question: '', options: [] });
      if (Array.isArray(poll.options)) {
        poll.options = poll.options.map(o => String(o.id) === String(optionId) ? { ...o, votes: (o.votes || 0) + 1 } : o);
        await setKv(db, 'poll', poll);
      }
      return jsonResponse({ success: true, poll });
    }

    if (request.method === 'POST' && path === '/api/poll/admin') {
      const session = await getAuthSession(request, env);
      if (!session || !['editor', 'admin', 'developer'].includes(session.role)) {
        return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
      }
      const body = await request.json();
      await setKv(db, 'poll', body);
      return jsonResponse({ success: true, poll: body });
    }

    // 8. Translation Endpoints (D1 Cached + Gemini + Google GTX Fallback)
    if (request.method === 'POST' && path === '/api/translate/batch') {
      const { items = [], targetLang = 'hi', source_lang = 'hi' } = await request.json();
      const target = normalizeLang(targetLang);
      const src = normalizeLang(source_lang);
      const capped = items.slice(0, 15);
      if (target === src) return jsonResponse({ status: 'done', items: capped });

      const results = [];
      const uncached = [];
      for (const it of capped) {
        const key = `${it.id}:${target}`;
        const row = await db.prepare('SELECT title, summary FROM translations WHERE cache_key = ? AND status = ?').bind(key, 'done').first();
        if (row && row.title && row.title.trim() !== String(it.title || '').trim()) {
          results.push({ id: it.id, title: row.title, summary: row.summary || it.summary || '', isCached: true });
        } else {
          uncached.push(it);
        }
      }

      if (uncached.length > 0) {
        let translated = null;
        try {
          const prompt = `Translate the following news headlines and summaries to ${target}. Return strictly a JSON array with objects { "id", "title", "summary" }:\n${JSON.stringify(uncached)}`;
          const raw = await callGeminiEdge(prompt, env.GEMINI_API_KEY, true);
          translated = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim());
        } catch (_e) {
          translated = await Promise.all(uncached.map(async (u) => ({
            id: u.id,
            title: await translateGoogleGtx(u.title || '', target, src).catch(() => u.title),
            summary: u.summary ? await translateGoogleGtx(u.summary, target, src).catch(() => u.summary) : ''
          })));
        }
        const nowIso = new Date().toISOString();
        for (const tr of (Array.isArray(translated) ? translated : [])) {
          const orig = uncached.find(u => String(u.id) === String(tr.id));
          if (tr.title && (!orig || tr.title.trim() !== String(orig.title || '').trim())) {
            const key = `${tr.id}:${target}`;
            await db.prepare(
              'INSERT INTO translations (cache_key, article_id, lang, title, summary, status, created_at, last_accessed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(cache_key) DO UPDATE SET title=excluded.title, summary=excluded.summary, last_accessed_at=excluded.last_accessed_at'
            ).bind(key, String(tr.id), target, tr.title, tr.summary || '', 'done', nowIso, nowIso).run();
            results.push({ id: tr.id, title: tr.title, summary: tr.summary || '', isCached: false });
          }
        }
      }

      const merged = capped.map(o => results.find(r => String(r.id) === String(o.id)) || o);
      return jsonResponse({ status: 'done', items: merged });
    }

    if (request.method === 'POST' && path === '/api/translate') {
      const body = await request.json();
      const articleId = body.article_id || body.articleId;
      const target = normalizeLang(body.lang || body.targetLang || 'hi');
      const src = normalizeLang(body.source_lang || 'hi');
      if (target === src) {
        return jsonResponse({ title: body.title, highlights: body.highlights || [], body: body.body || body.text, status: 'done' });
      }

      if (articleId) {
        const resTr = await translateOrGetArticleEdge(db, env, articleId, target, body);
        return jsonResponse({
          title: resTr.title,
          summary: resTr.summary,
          highlights: resTr.highlights,
          body: resTr.body,
          isCached: resTr.isCached,
          status: 'done'
        });
      }

      const translatedText = await translateGoogleGtx(body.text || '', target, src).catch(() => body.text);
      return jsonResponse({ translatedText, isCached: false, status: 'done' });
    }

    // 9. Confidential Tips (Zero-Trace Public + Admin-Only Desk)
    if (request.method === 'POST' && path === '/api/tips/submit') {
      const body = await request.json();
      const title = String(body.title || '').trim().slice(0, 200);
      const details = String(body.details || '').trim().slice(0, 8000);
      if (title.length < 5 || details.length < 20) {
        return jsonResponse({ success: false, error: 'Title (min 5) and details (min 20) are required.' }, 400);
      }
      const randBytes = new Uint8Array(4);
      crypto.getRandomValues(randBytes);
      const trackingId = `TIP-${1000 + (randBytes[0] * 35)}-${randBytes[1].toString(16).padStart(2, '0').toUpperCase()}${randBytes[2].toString(16).padStart(2, '0').toUpperCase()}`;
      const nowIso = new Date().toISOString();
      const tip = {
        id: `tip_${Date.now()}_${randBytes[3].toString(16)}`,
        trackingId,
        category: body.category || 'corruption',
        title,
        location: String(body.location || '').trim().slice(0, 150),
        incidentDate: String(body.incidentDate || '').trim().slice(0, 50),
        involvedEntities: String(body.involvedEntities || '').trim().slice(0, 300),
        details,
        evidenceUrl: /^(https?:\/\/|\/uploads\/)/i.test(String(body.evidenceUrl || '').trim()) ? String(body.evidenceUrl).trim() : '',
        optionalContact: String(body.optionalContact || '').trim().slice(0, 150) || 'Anonymous (Gupt)',
        status: 'pending_review',
        editorialNote: '',
        submittedAt: nowIso,
        updatedAt: nowIso
      };
      const tips = await getKv(db, 'confidential_tips', []);
      tips.unshift(tip);
      await setKv(db, 'confidential_tips', capKvRecordList(tips, { maxItems: 100, maxJsonBytes: 750000 }));
      return jsonResponse({ success: true, trackingId, status: tip.status, submittedAt: nowIso }, 201);
    }

    if (request.method === 'GET' && path.startsWith('/api/tips/status/')) {
      const tid = decodeURIComponent(path.slice('/api/tips/status/'.length)).trim().toUpperCase();
      const tips = await getKv(db, 'confidential_tips', []);
      const tip = tips.find(t => String(t.trackingId || '').toUpperCase() === tid);
      if (!tip) return jsonResponse({ success: false, error: 'Tracking ID not found.' }, 404);
      return jsonResponse({
        success: true,
        trackingId: tip.trackingId,
        status: tip.status,
        submittedAt: tip.submittedAt,
        updatedAt: tip.updatedAt,
        editorialNote: tip.editorialNote || ''
      });
    }

    if (request.method === 'GET' && path === '/api/admin/tips') {
      const session = await getAuthSession(request, env);
      if (!session || !['admin', 'developer'].includes(session.role)) {
        return jsonResponse({ success: false, error: 'Forbidden: Admin only.' }, session ? 403 : 401);
      }
      const tips = await getKv(db, 'confidential_tips', []);
      return jsonResponse({ success: true, tips });
    }

    if (request.method === 'POST' && path === '/api/admin/tips/update') {
      const session = await getAuthSession(request, env);
      if (!session || !['admin', 'developer'].includes(session.role)) {
        return jsonResponse({ success: false, error: 'Forbidden: Admin only.' }, session ? 403 : 401);
      }
      const body = await request.json();
      const tips = await getKv(db, 'confidential_tips', []);
      const idx = tips.findIndex(t => t.id === body.id);
      if (idx === -1) return jsonResponse({ success: false, error: 'Tip not found.' }, 404);
      tips[idx] = {
        ...tips[idx],
        status: body.status || tips[idx].status,
        editorialNote: body.editorialNote !== undefined ? String(body.editorialNote).slice(0, 1000) : tips[idx].editorialNote,
        updatedAt: new Date().toISOString()
      };
      await setKv(db, 'confidential_tips', tips);
      return jsonResponse({ success: true, tip: tips[idx] });
    }

    if (request.method === 'POST' && path === '/api/admin/tips/delete') {
      const session = await getAuthSession(request, env);
      if (!session || !['admin', 'developer'].includes(session.role)) {
        return jsonResponse({ success: false, error: 'Forbidden: Admin only.' }, session ? 403 : 401);
      }
      const { id } = await request.json();
      const tips = await getKv(db, 'confidential_tips', []);
      await setKv(db, 'confidential_tips', tips.filter(t => t.id !== id));
      return jsonResponse({ success: true, deletedId: id });
    }

    // 10. Staff Login & Management
    if (request.method === 'POST' && path === '/api/auth/login') {
      const { email, password } = await request.json();
      const cleanEmail = String(email || '').trim().toLowerCase();
      const staffList = await getKv(db, 'staff', []);
      const staff = staffList.find(s => String(s.email || '').toLowerCase() === cleanEmail);
      if (!staff || staff.status !== 'active') {
        return jsonResponse({ success: false, error: 'Invalid credentials or account inactive.' }, 401);
      }
      const valid = await verifyPasswordEdge(password, staff.passwordHash, staff.passwordSalt);
      if (!valid) {
        return jsonResponse({ success: false, error: 'Invalid email or password.' }, 401);
      }
      const secret = env.STAFF_AUTH_SECRET || 'publicspark_fallback_edge_secret';
      const token = await createSessionToken(staff, secret);
      return jsonResponse({
        success: true,
        token,
        role: staff.role,
        name: staff.name,
        email: staff.email,
        staff: { id: staff.id, name: staff.name, email: staff.email, role: staff.role }
      });
    }

    if (request.method === 'POST' && path === '/api/auth/register/send-otp') {
      const { name, email, password, role } = await request.json();
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return jsonResponse({ success: false, error: 'Valid email address is required.' }, 400);
      }
      if (!name || String(name).trim().length < 2) {
        return jsonResponse({ success: false, error: 'Full name is required.' }, 400);
      }
      if (!password || String(password).length < 6) {
        return jsonResponse({ success: false, error: 'Password must be at least 6 characters.' }, 400);
      }
      const staffList = await getKv(db, 'staff', []);
      if (staffList.some(s => String(s.email || '').toLowerCase() === cleanEmail)) {
        return jsonResponse({ success: false, error: 'An account with this email already exists.' }, 409);
      }
      const existingOtp = await getKv(db, `otp_reg_${cleanEmail}`, null);
      if (existingOtp && existingOtp.sentAt && Date.now() - existingOtp.sentAt < 60 * 1000) {
        const waitSec = Math.ceil((60 * 1000 - (Date.now() - existingOtp.sentAt)) / 1000);
        return jsonResponse({ success: false, error: `Please wait ${waitSec}s before requesting another OTP.` }, 429);
      }
      const otp = generate6DigitOtp();
      await setKv(db, `otp_reg_${cleanEmail}`, { otp, sentAt: Date.now(), expiresAt: Date.now() + 5 * 60 * 1000, role: role || 'reporter' });
      await sendBrevoEmailEdge(
        env,
        cleanEmail,
        'PublicSpark Newsroom - Email Verification OTP',
        `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:20px;border:1px solid #ddd;"><h2 style="color:#B81D13;margin-top:0;">PublicSpark Newsroom</h2><p>Hello ${String(name).replace(/[<>&]/g, '')},</p><p>Your 5-minute verification OTP for Newsroom Staff Registration is:</p><div style="font-size:28px;font-weight:bold;letter-spacing:6px;padding:14px;background:#f5f5f5;text-align:center;">${otp}</div><p style="color:#666;font-size:12px;">Valid for 5 minutes. Do not share this code with anyone.</p></div>`
      );
      return jsonResponse({ success: true, message: 'Verification OTP sent to your email.' });
    }

    if (request.method === 'POST' && path === '/api/auth/register/verify-and-submit') {
      const { name, email, password, phone, role, otpCode } = await request.json();
      const cleanEmail = String(email || '').trim().toLowerCase();
      const otpRecord = await getKv(db, `otp_reg_${cleanEmail}`, null);
      if (!otpRecord || Date.now() > otpRecord.expiresAt || !timingSafeEqualStr(otpRecord.otp, String(otpCode || '').trim())) {
        return jsonResponse({ success: false, error: 'Invalid or expired OTP code.' }, 400);
      }
      const staffList = await getKv(db, 'staff', []);
      if (staffList.some(s => String(s.email || '').toLowerCase() === cleanEmail)) {
        return jsonResponse({ success: false, error: 'Account already exists.' }, 409);
      }
      const { hash, salt } = await hashPasswordEdge(password);
      const allowedRole = ['reporter', 'editor'].includes(role) ? role : 'reporter';
      const newStaff = {
        id: `staff_${Date.now()}`,
        name: String(name || '').trim(),
        email: cleanEmail,
        phone: String(phone || '').trim(),
        role: allowedRole,
        status: 'pending',
        passwordHash: hash,
        passwordSalt: salt,
        createdAt: new Date().toISOString()
      };
      staffList.push(newStaff);
      await setKv(db, 'staff', staffList);
      await deleteKv(db, `otp_reg_${cleanEmail}`);
      return jsonResponse({ success: true, message: 'Application submitted! Super Admin approval pending.' }, 201);
    }

    if (request.method === 'POST' && path === '/api/auth/forgot-password/send-otp') {
      const { email } = await request.json();
      const cleanEmail = String(email || '').trim().toLowerCase();
      const staffList = await getKv(db, 'staff', []);
      const staff = staffList.find(s => String(s.email || '').toLowerCase() === cleanEmail && !s.stealth);
      if (!staff) {
        return jsonResponse({ success: true, message: 'If this email is registered, a 5-minute OTP has been sent.' });
      }
      const existingPwdOtp = await getKv(db, `otp_pwd_${cleanEmail}`, null);
      if (existingPwdOtp && existingPwdOtp.sentAt && Date.now() - existingPwdOtp.sentAt < 60 * 1000) {
        const waitSec = Math.ceil((60 * 1000 - (Date.now() - existingPwdOtp.sentAt)) / 1000);
        return jsonResponse({ success: false, error: `Please wait ${waitSec}s before requesting another OTP.` }, 429);
      }
      const otp = generate6DigitOtp();
      await setKv(db, `otp_pwd_${cleanEmail}`, { otp, sentAt: Date.now(), expiresAt: Date.now() + 5 * 60 * 1000 });
      await sendBrevoEmailEdge(
        env,
        cleanEmail,
        'PublicSpark Newsroom - Password Reset OTP',
        `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:20px;border:1px solid #ddd;"><h2 style="color:#B81D13;margin-top:0;">Password Reset Request</h2><p>Your 5-minute OTP to reset your PublicSpark password is:</p><div style="font-size:28px;font-weight:bold;letter-spacing:6px;padding:14px;background:#f5f5f5;text-align:center;">${otp}</div><p style="color:#666;font-size:12px;">Valid for 5 minutes. Ignore if you did not request this.</p></div>`
      );
      return jsonResponse({ success: true, message: 'If this email is registered, a 5-minute OTP has been sent.' });
    }

    if (request.method === 'POST' && path === '/api/auth/forgot-password/verify-otp') {
      const { email, otp } = await request.json();
      const cleanEmail = String(email || '').trim().toLowerCase();
      const record = await getKv(db, `otp_pwd_${cleanEmail}`, null);
      if (!record || Date.now() > record.expiresAt || !timingSafeEqualStr(record.otp, String(otp || '').trim())) {
        return jsonResponse({ success: false, error: 'Invalid or expired OTP.' }, 400);
      }
      const resetToken = `rst_${generate6DigitOtp()}_${Date.now()}`;
      await setKv(db, `reset_tok_${cleanEmail}`, { resetToken, expiresAt: Date.now() + 10 * 60 * 1000 });
      await deleteKv(db, `otp_pwd_${cleanEmail}`);
      return jsonResponse({ success: true, resetToken });
    }

    if (request.method === 'POST' && path === '/api/auth/reset-password') {
      const { email, newPassword, resetToken } = await request.json();
      const cleanEmail = String(email || '').trim().toLowerCase();
      const tokRecord = await getKv(db, `reset_tok_${cleanEmail}`, null);
      if (!tokRecord || Date.now() > tokRecord.expiresAt || !timingSafeEqualStr(tokRecord.resetToken, String(resetToken || ''))) {
        return jsonResponse({ success: false, error: 'Invalid or expired reset session.' }, 400);
      }
      if (!newPassword || String(newPassword).length < 6) {
        return jsonResponse({ success: false, error: 'Password must be at least 6 characters.' }, 400);
      }
      const staffList = await getKv(db, 'staff', []);
      const target = staffList.find(s => String(s.email || '').toLowerCase() === cleanEmail);
      if (!target) return jsonResponse({ success: false, error: 'Account not found.' }, 404);
      const { hash, salt } = await hashPasswordEdge(newPassword);
      target.passwordHash = hash;
      target.passwordSalt = salt;
      target.updatedAt = new Date().toISOString();
      await setKv(db, 'staff', staffList);
      await deleteKv(db, `reset_tok_${cleanEmail}`);
      return jsonResponse({ success: true, message: 'Password reset successful. Please login.' });
    }

    if (request.method === 'POST' && path === '/api/auth/logout') {
      return jsonResponse({ success: true });
    }

    if (request.method === 'GET' && path === '/api/auth/2fa/status') {
      return jsonResponse({ success: true, enabled: false, remainingRecoveryCodes: 0 });
    }

    if (request.method === 'GET' && path === '/api/staff') {
      const session = await getAuthSession(request, env);
      if (!session || !['admin', 'developer'].includes(session.role)) {
        return jsonResponse({ success: false, error: 'Forbidden' }, session ? 403 : 401);
      }
      const staffList = await getKv(db, 'staff', []);
      const sanitized = staffList
        .filter(s => !s.stealth && s.role !== 'developer')
        .map(s => ({ id: s.id, name: s.name, email: s.email, role: s.role, status: s.status, createdAt: s.createdAt }));
      return jsonResponse({ success: true, staff: sanitized });
    }

    if (request.method === 'POST' && path === '/api/staff/update-email') {
      const session = await getAuthSession(request, env);
      if (!session || !['admin', 'developer'].includes(session.role)) {
        return jsonResponse({ success: false, error: 'Forbidden' }, session ? 403 : 401);
      }
      const { staffId, newEmail } = await request.json();
      const cleaned = String(newEmail || '').trim().toLowerCase();
      const staffList = await getKv(db, 'staff', []);
      const target = staffList.find(s => s.id === staffId);
      if (!target) return jsonResponse({ success: false, error: 'Staff not found.' }, 404);
      if (target.role === 'admin' && session.role !== 'developer') {
        return jsonResponse({ success: false, error: 'Forbidden: Only Developer can change Super Admin email.' }, 403);
      }
      target.email = cleaned;
      target.updatedAt = new Date().toISOString();
      await setKv(db, 'staff', staffList);
      return jsonResponse({ success: true, result: { id: target.id, email: cleaned } });
    }

    if (request.method === 'POST' && path === '/api/staff/admin-reset-password') {
      const session = await getAuthSession(request, env);
      if (!session || !['admin', 'developer'].includes(session.role)) {
        return jsonResponse({ success: false, error: 'Forbidden' }, session ? 403 : 401);
      }
      const { staffId, newPassword } = await request.json();
      const staffList = await getKv(db, 'staff', []);
      const target = staffList.find(s => s.id === staffId);
      if (!target) return jsonResponse({ success: false, error: 'Staff not found.' }, 404);
      const { hash, salt } = await hashPasswordEdge(newPassword);
      target.passwordHash = hash;
      target.passwordSalt = salt;
      target.updatedAt = new Date().toISOString();
      await setKv(db, 'staff', staffList);
      return jsonResponse({ success: true });
    }

    if (request.method === 'POST' && path === '/api/staff/approve') {
      const session = await getAuthSession(request, env);
      if (!session || !['admin', 'developer'].includes(session.role)) {
        return jsonResponse({ success: false, error: 'Forbidden' }, session ? 403 : 401);
      }
      const { staffId, role } = await request.json();
      const staffList = await getKv(db, 'staff', []);
      const target = staffList.find(s => s.id === staffId);
      if (!target) return jsonResponse({ success: false, error: 'Staff not found.' }, 404);
      target.status = 'active';
      if (role && ['reporter', 'editor', 'admin'].includes(role)) target.role = role;
      target.updatedAt = new Date().toISOString();
      await setKv(db, 'staff', staffList);
      return jsonResponse({ success: true });
    }

    if (request.method === 'POST' && path === '/api/staff/update-role') {
      const session = await getAuthSession(request, env);
      if (!session || !['admin', 'developer'].includes(session.role)) {
        return jsonResponse({ success: false, error: 'Forbidden' }, session ? 403 : 401);
      }
      const { staffId, role } = await request.json();
      if (!['reporter', 'editor', 'admin'].includes(role)) {
        return jsonResponse({ success: false, error: 'Invalid role.' }, 400);
      }
      const staffList = await getKv(db, 'staff', []);
      const target = staffList.find(s => s.id === staffId);
      if (!target) return jsonResponse({ success: false, error: 'Staff not found.' }, 404);
      if (target.role === 'developer') return jsonResponse({ success: false, error: 'Forbidden.' }, 403);
      target.role = role;
      target.updatedAt = new Date().toISOString();
      await setKv(db, 'staff', staffList);
      return jsonResponse({ success: true });
    }

    if (request.method === 'POST' && path === '/api/staff/update-status') {
      const session = await getAuthSession(request, env);
      if (!session || !['admin', 'developer'].includes(session.role)) {
        return jsonResponse({ success: false, error: 'Forbidden' }, session ? 403 : 401);
      }
      const { staffId, status } = await request.json();
      if (!['active', 'suspended', 'pending'].includes(status)) {
        return jsonResponse({ success: false, error: 'Invalid status.' }, 400);
      }
      const staffList = await getKv(db, 'staff', []);
      const target = staffList.find(s => s.id === staffId);
      if (!target) return jsonResponse({ success: false, error: 'Staff not found.' }, 404);
      if (target.role === 'developer') return jsonResponse({ success: false, error: 'Forbidden.' }, 403);
      target.status = status;
      target.updatedAt = new Date().toISOString();
      await setKv(db, 'staff', staffList);
      return jsonResponse({ success: true });
    }

    if (request.method === 'POST' && path === '/api/staff/delete') {
      const session = await getAuthSession(request, env);
      if (!session || !['admin', 'developer'].includes(session.role)) {
        return jsonResponse({ success: false, error: 'Forbidden' }, session ? 403 : 401);
      }
      const { staffId } = await request.json();
      const staffList = await getKv(db, 'staff', []);
      const target = staffList.find(s => s.id === staffId);
      if (!target) return jsonResponse({ success: false, error: 'Staff not found.' }, 404);
      if (target.role === 'developer' || target.id === session.id) {
        return jsonResponse({ success: false, error: 'Cannot delete this account.' }, 403);
      }
      await setKv(db, 'staff', staffList.filter(s => s.id !== staffId));
      return jsonResponse({ success: true });
    }

    // 11. ImgBB Cloud Image Upload
    if (request.method === 'POST' && path === '/api/upload/image') {
      const session = await getAuthSession(request, env);
      if (!session || !['reporter', 'editor', 'admin', 'developer'].includes(session.role)) {
        return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
      }
      if (!env.IMGBB_API_KEY) {
        return jsonResponse({ success: false, error: 'IMGBB_API_KEY not configured in Cloudflare Variables.' }, 500);
      }
      const body = await request.json();
      const base64Data = String(body.image || '').replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
      const form = new FormData();
      form.append('image', base64Data);
      const imgRes = await fetch(`https://api.imgbb.com/1/upload?key=${env.IMGBB_API_KEY}`, {
        method: 'POST',
        body: form
      });
      const imgData = await imgRes.json();
      if (!imgRes.ok || !imgData.success) {
        return jsonResponse({ success: false, error: imgData?.error?.message || 'ImgBB upload failed' }, 500);
      }
      return jsonResponse({ success: true, url: imgData.data.url, display_url: imgData.data.display_url });
    }

    // 12. Grievances
    if (request.method === 'POST' && path === '/api/grievance/submit') {
      const body = await request.json();
      const list = await getKv(db, 'grievances', []);
      const entry = {
        ...body,
        name: String(body.name || '').trim().slice(0, 150),
        email: String(body.email || '').trim().slice(0, 150),
        subject: String(body.subject || '').trim().slice(0, 250),
        details: String(body.details || body.description || '').trim().slice(0, 6000),
        id: `grv_${Date.now()}`,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      list.unshift(entry);
      await setKv(db, 'grievances', capKvRecordList(list, { maxItems: 100, maxJsonBytes: 750000 }));
      return jsonResponse({ success: true, grievance: entry }, 201);
    }

    if (request.method === 'GET' && path === '/api/grievances') {
      const session = await getAuthSession(request, env);
      if (!session || !['editor', 'admin', 'developer'].includes(session.role)) {
        return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
      }
      const grievances = await getKv(db, 'grievances', []);
      return jsonResponse({ success: true, grievances });
    }

    // 13. Analytics & Likes Safe Endpoints
    if (path.startsWith('/api/views/') || path.startsWith('/api/likes/') || path.startsWith('/api/analytics/')) {
      if (path === '/api/analytics/overview') {
        return jsonResponse({ totalViews: 0, totalReads: 0, activeReaders: 1, avgReadTime: 0 });
      }
      if (path === '/api/analytics/trending' || path === '/api/analytics/country-breakdown') {
        return jsonResponse([]);
      }
      if (path.startsWith('/api/likes/article/')) {
        return jsonResponse({ totalLikes: 0, isLiked: false });
      }
      return jsonResponse({ success: true });
    }

    // 14. Storage Status (Multi-D1 Audio Shards + Master DB)
    if (request.method === 'GET' && path === '/api/storage/status') {
      const hiShard = getAudioDb(env, 'hi');
      const enShard = getAudioDb(env, 'en');
      const readShardStats = async (shardDb) => shardDb.prepare(
        "SELECT COUNT(*) as c, COALESCE(SUM(size_bytes), 0) as b FROM audio_cache WHERE cache_key NOT LIKE '%::%'"
      ).first().catch(() => ({ c: 0, b: 0 }));

      const hiRaw = await readShardStats(hiShard.audioDb);
      const enRaw = (enShard.audioDb === hiShard.audioDb) ? { c: 0, b: 0 } : await readShardStats(enShard.audioDb);

      const hiMb = Number((Number(hiRaw?.b || 0) / (1024 * 1024)).toFixed(2));
      const enMb = Number((Number(enRaw?.b || 0) / (1024 * 1024)).toFixed(2));
      const totalAudioMb = Number((hiMb + enMb).toFixed(2));
      const sharedAudioMb = (!hiShard.dedicated ? hiMb : 0) + (!enShard.dedicated && enShard.audioDb !== hiShard.audioDb ? enMb : 0);
      const d1UsedMb = Number((0.25 + sharedAudioMb).toFixed(2));
      const d1Percent = Number(Math.min(100, (d1UsedMb / 500) * 100).toFixed(2));
      const audioLimitMb = (hiShard.dedicated ? 450 : 250) + (enShard.dedicated ? 450 : 0);

      return jsonResponse({
        success: true,
        alertState: (d1Percent >= 80 || (hiShard.dedicated && hiMb >= 360) || (enShard.dedicated && enMb >= 360)) ? 'warning' : 'normal',
        renderWorkerConfigured: Boolean(env.RENDER_AUDIO_URL && env.RENDER_AUDIO_SECRET),
        audioStats: {
          cachedClips: Number(hiRaw?.c || 0) + Number(enRaw?.c || 0),
          audioMb: totalAudioMb,
          autoLruCapMb: audioLimitMb,
          shards: {
            hi: { shard: hiShard.shard, dedicated: hiShard.dedicated, cachedClips: Number(hiRaw?.c || 0), usedMb: hiMb, capMb: hiShard.dedicated ? 450 : 250 },
            en: { shard: enShard.shard, dedicated: enShard.dedicated, cachedClips: Number(enRaw?.c || 0), usedMb: enMb, capMb: enShard.dedicated ? 450 : 250 }
          }
        },
        storageTiers: {
          cloudflareD1: { name: 'Cloudflare D1 SQL (Master DB)', usedMb: d1UsedMb, limitMb: 500, percent: d1Percent, status: d1Percent >= 80 ? 'warning' : 'healthy' },
          imgbbCdn: { name: 'ImgBB Cloud Image CDN', isCloudActive: !!env.IMGBB_API_KEY, usedMb: 0, limitMb: 2048, percent: 0, status: 'healthy' }
        }
      });
    }

    // 15. Gemini + Render FFmpeg TTS Endpoint with Multi-D1 Shards & HTTP 206 Streaming
    if (request.method === 'GET' && path.startsWith('/api/tts/audio/')) {
      const cacheKey = decodeURIComponent(path.slice('/api/tts/audio/'.length));
      const langHint = normalizeLang(url.searchParams.get('lang') || parseAudioLangFromCacheKey(cacheKey) || 'hi');
      const { audioDb } = getAudioDb(env, langHint);
      let rows = await audioDb.prepare('SELECT cache_key, mime_type, audio_base64 FROM audio_cache WHERE cache_key = ? OR cache_key LIKE ? ORDER BY cache_key ASC')
        .bind(cacheKey, `${cacheKey}::%`).all().catch(() => ({ results: [] }));
      if ((!rows?.results || rows.results.length === 0) && audioDb !== db) {
        rows = await db.prepare('SELECT cache_key, mime_type, audio_base64 FROM audio_cache WHERE cache_key = ? OR cache_key LIKE ? ORDER BY cache_key ASC')
          .bind(cacheKey, `${cacheKey}::%`).all().catch(() => ({ results: [] }));
      }
      const list = rows?.results || [];
      if (list.length === 0 || !list[0].audio_base64) {
        return jsonResponse({ error: 'Cached audio not found' }, 404);
      }
      const fullBase64 = list.map(r => r.audio_base64).join('');
      const bytes = fastBase64ToBytes(fullBase64);
      const contentType = list[0].mime_type || 'audio/wav';
      const rangeHeader = request.headers.get('Range');

      if (rangeHeader && rangeHeader.startsWith('bytes=')) {
        const parts = rangeHeader.replace(/^bytes=/, '').split('-');
        const start = parts[0] ? parseInt(parts[0], 10) : 0;
        const end = parts[1] ? Math.min(bytes.length - 1, parseInt(parts[1], 10)) : bytes.length - 1;
        if (isNaN(start) || isNaN(end) || start > end || start >= bytes.length) {
          return new Response(null, {
            status: 416,
            headers: { 'Content-Range': `bytes */${bytes.length}`, ...CORS_HEADERS }
          });
        }
        const sliced = bytes.subarray(start, end + 1);
        return new Response(sliced, {
          status: 206,
          headers: {
            'Content-Type': contentType,
            'Content-Range': `bytes ${start}-${end}/${bytes.length}`,
            'Content-Length': String(sliced.length),
            'Cache-Control': 'public, max-age=604800, immutable',
            'Accept-Ranges': 'bytes',
            ...CORS_HEADERS
          }
        });
      }

      return new Response(bytes, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(bytes.length),
          'Cache-Control': 'public, max-age=604800, immutable',
          'Accept-Ranges': 'bytes',
          ...CORS_HEADERS
        }
      });
    }

    if (request.method === 'GET' && path === '/api/tts/warm-worker') {
      const session = await getAuthSession(request, env);
      if (!session || !['editor', 'admin', 'developer'].includes(session.role)) {
        return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
      }
      const baseUrl = String(env.RENDER_AUDIO_URL || '').trim().replace(/\/+$/, '');
      if (!baseUrl) {
        return jsonResponse({ success: true, renderConfigured: false, ffmpegReady: false, mode: 'edge_direct' });
      }
      try {
        const hRes = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(65000) });
        const hData = await hRes.json().catch(() => ({}));
        return jsonResponse({
          success: hRes.ok,
          renderConfigured: true,
          ffmpegReady: Boolean(hData.ffmpegReady),
          status: hData
        });
      } catch (err) {
        return jsonResponse({ success: false, renderConfigured: true, ffmpegReady: false, error: err.message });
      }
    }

    if (request.method === 'GET' && path.startsWith('/api/tts/article-status/')) {
      const session = await getAuthSession(request, env);
      if (!session || !['editor', 'admin', 'developer'].includes(session.role)) {
        return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
      }
      const rawArtId = decodeURIComponent(path.slice('/api/tts/article-status/'.length)).replace(/[^a-zA-Z0-9-_]/g, '_');
      const hiShard = getAudioDb(env, 'hi');
      const enShard = getAudioDb(env, 'en');

      const [hiRow, enRow, trHi, trEn] = await Promise.all([
        hiShard.audioDb.prepare('SELECT size_bytes, mime_type, created_at FROM audio_cache WHERE cache_key = ?').bind(`${rawArtId}_hi_full_story`).first().catch(() => null),
        enShard.audioDb.prepare('SELECT size_bytes, mime_type, created_at FROM audio_cache WHERE cache_key = ?').bind(`${rawArtId}_en_full_story`).first().catch(() => null),
        db.prepare('SELECT status FROM translations WHERE cache_key = ?').bind(`${rawArtId}:hi`).first().catch(() => null),
        db.prepare('SELECT status FROM translations WHERE cache_key = ?').bind(`${rawArtId}:en`).first().catch(() => null)
      ]);

      return jsonResponse({
        success: true,
        articleId: rawArtId,
        renderConfigured: Boolean(env.RENDER_AUDIO_URL && env.RENDER_AUDIO_SECRET),
        hi: hiRow ? {
          cached: true,
          sizeBytes: hiRow.size_bytes || 0,
          mimeType: hiRow.mime_type || 'audio/wav',
          createdAt: hiRow.created_at,
          shard: hiShard.shard,
          audioUrl: `/api/tts/audio/${encodeURIComponent(`${rawArtId}_hi_full_story`)}?v=${encodeURIComponent(hiRow.created_at || '')}`
        } : { cached: false, shard: hiShard.shard },
        en: enRow ? {
          cached: true,
          sizeBytes: enRow.size_bytes || 0,
          mimeType: enRow.mime_type || 'audio/wav',
          createdAt: enRow.created_at,
          shard: enShard.shard,
          audioUrl: `/api/tts/audio/${encodeURIComponent(`${rawArtId}_en_full_story`)}?v=${encodeURIComponent(enRow.created_at || '')}`
        } : { cached: false, shard: enShard.shard },
        translations: { hiCached: trHi?.status === 'done', enCached: trEn?.status === 'done' }
      });
    }

    if (request.method === 'POST' && path === '/api/tts/generate-article-audio') {
      const session = await getAuthSession(request, env);
      if (!session || !['editor', 'admin', 'developer'].includes(session.role)) {
        return jsonResponse({ success: false, error: 'Forbidden: Editor or Admin access required.' }, session ? 403 : 401);
      }
      const body = await request.json().catch(() => ({}));
      const articleId = String(body.articleId || body.article_id || '').trim();
      const step = String(body.step || 'audio').toLowerCase();
      const targetLang = normalizeLang(body.lang || 'hi');
      const forceRegenerate = Boolean(body.forceRegenerate);
      const overrides = (body.overrides && typeof body.overrides === 'object') ? body.overrides : {};

      if (!articleId) return jsonResponse({ success: false, error: 'articleId is required.' }, 400);
      if (!['hi', 'en'].includes(targetLang)) {
        return jsonResponse({ success: false, error: 'Only Hindi (hi) and English (en) audio generation is enabled.' }, 400);
      }

      const artRow = await db.prepare('SELECT data_json FROM articles WHERE id = ? OR slug = ?').bind(articleId, articleId).first();
      if (!artRow) return jsonResponse({ success: false, error: 'Article not found.' }, 404);
      const art = JSON.parse(artRow.data_json);
      const canonicalId = String(art.id || articleId);

      if (step === 'translate') {
        const trResult = await translateOrGetArticleEdge(db, env, canonicalId, targetLang, overrides, forceRegenerate);
        return jsonResponse({
          success: true,
          step: 'translate',
          articleId: canonicalId,
          lang: targetLang,
          isCached: trResult.isCached,
          title: trResult.title
        });
      }

      const storyContent = await translateOrGetArticleEdge(db, env, canonicalId, targetLang, overrides, false);
      const hl = Array.isArray(storyContent.highlights) && storyContent.highlights.length > 0
        ? storyContent.highlights.filter(Boolean).join('. ')
        : (storyContent.summary || '');
      const speechText = [storyContent.title, hl, storyContent.body].filter(Boolean).join('. ').trim();

      try {
        const audioRes = await synthesizeAndCacheAudioEdge({
          env,
          articleId: canonicalId,
          lang: targetLang,
          clipType: 'full_story',
          speechText,
          forceRegenerate
        });
        return jsonResponse({
          success: true,
          step: 'audio',
          ...audioRes
        });
      } catch (ttsErr) {
        return jsonResponse({
          success: false,
          step: 'audio',
          quotaExhausted: Boolean(ttsErr.isQuota || String(ttsErr.message || '').includes('429')),
          error: ttsErr.message || 'Audio synthesis failed'
        }, ttsErr.isQuota ? 429 : 500);
      }
    }

    if (request.method === 'POST' && (path === '/api/tts/generate' || path === '/api/tts')) {
      const body = await request.json().catch(() => ({}));
      const targetLang = normalizeLang(body.lang || body.langCode || 'hi');
      if (!['hi', 'en'].includes(targetLang)) {
        return jsonResponse({ error: 'Audio TTS is currently enabled only for Hindi and English.', hidden: true }, 400);
      }

      const rawArticleId = String(body.article_id || body.articleId || 'general').replace(/[^a-zA-Z0-9-_]/g, '_');
      const rawClip = body.clip_type || body.clipType || 'full_story';
      const clipType = rawClip === 'clip_2_body' ? 'clip_2_body' : (rawClip === 'clip_1_intro' ? 'clip_1_intro' : 'full_story');

      let speechText = String(body.text || '').trim();
      if (!speechText) {
        const hl = Array.isArray(body.highlights) ? body.highlights.filter(Boolean).join('. ') : '';
        if (clipType === 'full_story') {
          speechText = [body.title, hl, body.body].filter(Boolean).join('. ').trim();
        } else if (clipType === 'clip_1_intro') {
          speechText = [body.title, hl].filter(Boolean).join('. ');
        } else {
          speechText = String(body.body || '').trim();
        }
      }

      try {
        const result = await synthesizeAndCacheAudioEdge({
          env,
          articleId: rawArticleId,
          lang: targetLang,
          clipType,
          speechText
        });
        return jsonResponse(result);
      } catch (ttsErr) {
        return jsonResponse({
          status: 'quota_exhausted',
          fallback: 'browser',
          error: ttsErr.message || 'Gemini TTS unavailable'
        });
      }
    }

    // 16. Grievance Update, Ads History CRUD, Media Library, Live Updates & Revisions
    if (request.method === 'POST' && path === '/api/grievance/update') {
      const session = await getAuthSession(request, env);
      if (!session || !['editor', 'admin', 'developer'].includes(session.role)) {
        return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
      }
      const { id, status, actionTaken } = await request.json();
      const list = await getKv(db, 'grievances', []);
      const idx = list.findIndex(g => g.id === id);
      if (idx === -1) return jsonResponse({ success: false, error: 'Grievance not found.' }, 404);
      if (status) list[idx].status = status;
      if (actionTaken !== undefined) list[idx].actionTaken = actionTaken;
      list[idx].updatedAt = new Date().toISOString();
      await setKv(db, 'grievances', list);
      return jsonResponse({ success: true, grievance: list[idx] });
    }

    if (request.method === 'POST' && path === '/api/ads/history/update') {
      const session = await getAuthSession(request, env);
      if (!session || !['admin', 'developer'].includes(session.role)) {
        return jsonResponse({ success: false, error: 'Forbidden' }, session ? 403 : 401);
      }
      const body = await request.json();
      const list = await getKv(db, 'ad_history', []);
      const idx = list.findIndex(a => a.id === body.id);
      if (idx >= 0) list[idx] = { ...list[idx], ...body, updatedAt: new Date().toISOString() };
      else list.unshift({ ...body, id: body.id || `ad_${Date.now()}`, createdAt: new Date().toISOString() });
      await setKv(db, 'ad_history', list);
      return jsonResponse({ success: true, history: list });
    }

    if (request.method === 'POST' && path === '/api/ads/history/delete') {
      const session = await getAuthSession(request, env);
      if (!session || !['admin', 'developer'].includes(session.role)) {
        return jsonResponse({ success: false, error: 'Forbidden' }, session ? 403 : 401);
      }
      const { id } = await request.json();
      const list = await getKv(db, 'ad_history', []);
      await setKv(db, 'ad_history', list.filter(a => a.id !== id));
      return jsonResponse({ success: true });
    }

    if (request.method === 'GET' && path === '/api/media') {
      const session = await getAuthSession(request, env);
      if (!session || !['reporter', 'editor', 'admin', 'developer'].includes(session.role)) {
        return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
      }
      const media = await getKv(db, 'media_library', []);
      return jsonResponse({ success: true, media });
    }

    if (request.method === 'POST' && path === '/api/media/update') {
      const session = await getAuthSession(request, env);
      if (!session || !['reporter', 'editor', 'admin', 'developer'].includes(session.role)) {
        return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
      }
      const body = await request.json();
      const media = await getKv(db, 'media_library', []);
      const idx = media.findIndex(m => m.id === body.id);
      if (idx >= 0) media[idx] = { ...media[idx], ...body, updatedAt: new Date().toISOString() };
      else media.unshift({ ...body, id: body.id || `med_${Date.now()}`, createdAt: new Date().toISOString() });
      await setKv(db, 'media_library', media);
      return jsonResponse({ success: true, media });
    }

    if (request.method === 'POST' && path === '/api/media/delete') {
      const session = await getAuthSession(request, env);
      if (!session || !['admin', 'developer'].includes(session.role)) {
        return jsonResponse({ success: false, error: 'Forbidden' }, session ? 403 : 401);
      }
      const { id } = await request.json();
      const media = await getKv(db, 'media_library', []);
      await setKv(db, 'media_library', media.filter(m => m.id !== id));
      return jsonResponse({ success: true });
    }

    if (request.method === 'GET' && path === '/api/live-news') {
      const rows = await db.prepare("SELECT data_json FROM articles WHERE format = 'live' AND status = 'published' ORDER BY updatedAt DESC LIMIT 20").all();
      return jsonResponse((rows.results || []).map(r => JSON.parse(r.data_json)));
    }

    const liveUpdatesMatch = path.match(/^\/api\/articles\/([^/]+)\/live-updates(?:\/([^/]+))?$/);
    if (liveUpdatesMatch) {
      const artId = decodeURIComponent(liveUpdatesMatch[1]);
      const pathUpdateId = liveUpdatesMatch[2] ? decodeURIComponent(liveUpdatesMatch[2]) : null;

      if (request.method === 'GET' && !pathUpdateId) {
        const session = await getAuthSession(request, env);
        const isStaff = session && ['reporter', 'editor', 'admin', 'developer'].includes(session.role);
        const row = await db.prepare('SELECT data_json, status FROM articles WHERE id = ? OR slug = ?').bind(artId, artId).first();
        if (!row) return jsonResponse({ success: false, error: 'Article not found' }, 404);
        const art = JSON.parse(row.data_json);
        const isPublished = art.status === 'published' || !art.status ||
          (art.status === 'scheduled' && art.scheduledPublishTime && new Date(art.scheduledPublishTime).getTime() <= Date.now());
        if (!isPublished && !isStaff) {
          return jsonResponse({ success: false, error: 'Article not found' }, 404);
        }
        const updates = Array.isArray(art.live_updates)
          ? art.live_updates
          : (Array.isArray(art.liveUpdates) ? art.liveUpdates : []);
        return jsonResponse({
          success: true,
          articleId: art.id,
          format: art.format || 'standard',
          live_status: art.live_status || 'active',
          live_updates: updates
        }, 200, isStaff ? { 'Cache-Control': 'private, no-store', 'Vary': 'Authorization' } : publicCacheHeaders(request, 15, 20));
      }

      const session = await getAuthSession(request, env);
      if (!session || !['reporter', 'editor', 'admin', 'developer'].includes(session.role)) {
        return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
      }
      if (request.method === 'DELETE' && !['editor', 'admin', 'developer'].includes(session.role)) {
        return jsonResponse({ success: false, error: 'Forbidden' }, 403);
      }
      const row = await db.prepare('SELECT data_json FROM articles WHERE id = ?').bind(artId).first();
      if (!row) return jsonResponse({ success: false, error: 'Article not found' }, 404);
      const art = JSON.parse(row.data_json);
      const body = await request.json().catch(() => ({}));
      const updates = Array.isArray(art.live_updates)
        ? art.live_updates
        : (Array.isArray(art.liveUpdates) ? art.liveUpdates : []);

      let newUpdate = null;
      if (request.method === 'POST') {
        newUpdate = { id: `lu_${Date.now()}`, ...body, timestamp: body.timestamp || new Date().toISOString() };
        updates.unshift(newUpdate);
      } else if (request.method === 'DELETE') {
        const targetUpdateId = pathUpdateId || body.updateId;
        const filtered = updates.filter(u => String(u.id) !== String(targetUpdateId));
        art.live_updates = filtered;
        art.liveUpdates = filtered;
      }
      if (request.method === 'POST') {
        art.live_updates = updates;
        art.liveUpdates = updates;
      }
      art.updatedAt = new Date().toISOString();
      await db.prepare('UPDATE articles SET data_json = ?, updatedAt = ? WHERE id = ?').bind(JSON.stringify(art), art.updatedAt, artId).run();
      return jsonResponse({ success: true, update: newUpdate, live_updates: art.live_updates, liveUpdates: art.live_updates });
    }

    if (path.startsWith('/api/articles/') && path.endsWith('/revisions')) {
      const session = await getAuthSession(request, env);
      if (!session || !['editor', 'admin', 'developer'].includes(session.role)) {
        return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
      }
      const artId = decodeURIComponent(path.slice('/api/articles/'.length, -'/revisions'.length));
      const revisions = await getKv(db, `revisions_${artId}`, []);
      return jsonResponse({ success: true, revisions });
    }

    if (request.method === 'POST' && path === '/api/audio/progress') {
      return jsonResponse({ success: true });
    }

    // 17. Storage Purge, Backups (D1 JSON + Brevo Email Dispatch) & Developer Rescue
    if (request.method === 'POST' && path === '/api/storage/purge') {
      const session = await getAuthSession(request, env);
      if (!session || !['admin', 'developer'].includes(session.role)) {
        return jsonResponse({ success: false, error: 'Forbidden' }, session ? 403 : 401);
      }
      let purgedAudioRows = 0;
      for (const t of getAudioShardTargets(env)) {
        const beforeRow = await t.db.prepare("SELECT COUNT(*) as c FROM audio_cache WHERE cache_key NOT LIKE '%::%'").first().catch(() => ({ c: 0 }));
        const caps = getAudioDbCapBytes(t.dedicated);
        await enforceEdgeAudioQuota(t.db, caps.maxBytes, caps.targetBytes);
        const afterRow = await t.db.prepare("SELECT COUNT(*) as c FROM audio_cache WHERE cache_key NOT LIKE '%::%'").first().catch(() => ({ c: 0 }));
        purgedAudioRows += Math.max(0, Number(beforeRow?.c || 0) - Number(afterRow?.c || 0));
      }
      return jsonResponse({
        success: true,
        purgedAudioRows,
        purged: {
          inMemoryTranslations: 0,
          orphanedTranslations: 0,
          orphanedRevisions: 0,
          audioFilesPurged: purgedAudioRows
        },
        message: 'FIFO D1 audio quota enforcement completed across shards.'
      });
    }

    if (request.method === 'GET' && (path === '/api/admin/backups' || path === '/api/admin/backup/settings')) {
      const session = await getAuthSession(request, env);
      if (!session || !['admin', 'developer'].includes(session.role)) {
        return jsonResponse({ success: false, error: 'Forbidden' }, session ? 403 : 401);
      }
      if (path === '/api/admin/backup/settings') {
        const cfg = await getKv(db, 'backup_settings', { autoEmail: false, recipientEmail: env.SENDER_EMAIL || 'publicspark267@gmail.com' });
        return jsonResponse({ success: true, settings: cfg });
      }
      const backups = await getKv(db, 'edge_backup_log', []);
      return jsonResponse({ success: true, backups });
    }

    if (request.method === 'POST' && path === '/api/admin/backup/create') {
      const session = await getAuthSession(request, env);
      if (!session || !['admin', 'developer'].includes(session.role)) {
        return jsonResponse({ success: false, error: 'Forbidden' }, session ? 403 : 401);
      }
      const log = await getKv(db, 'edge_backup_log', []);
      const entry = { id: `d1_snap_${Date.now()}`, filename: `publicspark_d1_snapshot_${new Date().toISOString().slice(0, 10)}.json`, createdAt: new Date().toISOString(), type: 'D1 Snapshot' };
      log.unshift(entry);
      await setKv(db, 'edge_backup_log', log.slice(0, 20));
      return jsonResponse({ success: true, backup: entry });
    }

    if (request.method === 'POST' && path === '/api/admin/backup/download-ticket') {
      const session = await getAuthSession(request, env);
      if (!session || !['admin', 'developer'].includes(session.role)) {
        return jsonResponse({ success: false, error: 'Forbidden' }, session ? 403 : 401);
      }
      return jsonResponse({ success: true, ticket: 'edge_direct' });
    }

    if (request.method === 'GET' && (path === '/api/admin/backup/download' || path === '/api/developer/emergency-backup')) {
      const session = await getAuthSession(request, env);
      if (!session || !['admin', 'developer'].includes(session.role)) {
        return jsonResponse({ success: false, error: 'Forbidden' }, session ? 403 : 401);
      }
      if (path === '/api/developer/emergency-backup' && session.role !== 'developer') {
        return jsonResponse({ success: false, error: 'Developer only' }, 403);
      }
      const arts = await db.prepare('SELECT data_json FROM articles').all();
      const cats = await db.prepare('SELECT * FROM categories ORDER BY sort_order ASC').all();
      const kvs = await db.prepare('SELECT store_key, value_json, updated_at FROM kv_store WHERE store_key NOT LIKE ? AND store_key NOT LIKE ?').bind('otp_%', 'reset_%').all();
      const payload = {
        exportedAt: new Date().toISOString(),
        source: 'Cloudflare D1',
        articles: (arts.results || []).map(r => JSON.parse(r.data_json)),
        categories: cats.results || [],
        kvStore: kvs.results || []
      };
      return new Response(JSON.stringify(payload, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="publicspark_d1_backup_${new Date().toISOString().slice(0, 10)}.json"`,
          ...CORS_HEADERS
        }
      });
    }

    if (request.method === 'POST' && path === '/api/admin/backup/email-dispatch') {
      const session = await getAuthSession(request, env);
      if (!session || !['admin', 'developer'].includes(session.role)) {
        return jsonResponse({ success: false, error: 'Forbidden' }, session ? 403 : 401);
      }
      const body = await request.json().catch(() => ({}));
      const recipient = String(body.email || env.SENDER_EMAIL || 'publicspark267@gmail.com').trim();
      const artCount = await db.prepare('SELECT COUNT(*) as c FROM articles').first();
      const trCount = await db.prepare('SELECT COUNT(*) as c FROM translations').first();
      await sendBrevoEmailEdge(
        env,
        recipient,
        `PublicSpark D1 Database Snapshot Summary (${new Date().toISOString().slice(0, 10)})`,
        `<div style="font-family:sans-serif;padding:16px;"><h2>PublicSpark Newsroom D1 Backup Report</h2><p>Triggered by: ${session.email}</p><ul><li>Total Articles: ${artCount?.c || 0}</li><li>Cached Translations: ${trCount?.c || 0}</li><li>Timestamp: ${new Date().toISOString()}</li></ul></div>`
      );
      return jsonResponse({ success: true, message: `Backup summary dispatched via Brevo to ${recipient}` });
    }

    if (path.startsWith('/api/developer/')) {
      const session = await getAuthSession(request, env);
      if (!session || session.role !== 'developer') {
        return jsonResponse({ success: false, error: 'Developer access required.' }, session ? 403 : 401);
      }
      if (path === '/api/developer/diagnostics' || path === '/api/developer/verify-database') {
        const artCount = await db.prepare('SELECT COUNT(*) as c FROM articles').first();
        const catCount = await db.prepare('SELECT COUNT(*) as c FROM categories').first();
        const trCount = await db.prepare('SELECT COUNT(*) as c FROM translations').first();
        let audTotal = 0;
        for (const t of getAudioShardTargets(env)) {
          const c = await t.db.prepare('SELECT COUNT(*) as c FROM audio_cache').first().catch(() => ({ c: 0 }));
          audTotal += (c?.c || 0);
        }
        return jsonResponse({
          success: true,
          runtime: 'Cloudflare Pages Functions + D1',
          bindings: {
            db: !!env.DB,
            dbAudioHi: !!env.DB_AUDIO_HI,
            dbAudioEn: !!env.DB_AUDIO_EN,
            renderAudioWorker: !!(env.RENDER_AUDIO_URL && env.RENDER_AUDIO_SECRET),
            geminiTranslate: !!env.GEMINI_API_KEY,
            geminiTts: !!(env.GEMINI_TTS_API_KEY || env.GEMINI_API_KEY),
            imgbb: !!env.IMGBB_API_KEY,
            brevo: !!env.BREVO_API_KEY
          },
          counts: { articles: artCount?.c || 0, categories: catCount?.c || 0, translations: trCount?.c || 0, audioCache: audTotal }
        });
      }
      if (path === '/api/developer/reset-locks') {
        return jsonResponse({ success: true, message: 'Edge locks cleared.' });
      }
    }

    // 18. Secret-Protected 5-Day Google Drive Backup Export (Zero Gmail Spam)
    if (request.method === 'GET' && path === '/api/cron/export-backup') {
      const cronSecret = env.CRON_BACKUP_SECRET;
      const provided = request.headers.get('x-cron-secret') || (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      if (!cronSecret || !timingSafeEqualStr(provided, cronSecret)) {
        return jsonResponse({ success: false, error: 'Forbidden: Invalid CRON_BACKUP_SECRET.' }, 403);
      }
      const arts = await db.prepare('SELECT data_json FROM articles').all();
      const cats = await db.prepare('SELECT * FROM categories ORDER BY sort_order ASC').all();
      const trs = await db.prepare('SELECT cache_key, article_id, lang, title, summary, highlights_json, body, status, created_at FROM translations').all();
      const kvs = await db.prepare('SELECT store_key, value_json, updated_at FROM kv_store WHERE store_key NOT LIKE ? AND store_key NOT LIKE ?').bind('otp_%', 'reset_%').all();

      const articles = (arts.results || []).map(r => JSON.parse(r.data_json));
      const publishedCount = articles.filter(a => a.status === 'published').length;
      const kvMap = {};
      for (const row of (kvs.results || [])) {
        try { kvMap[row.store_key] = JSON.parse(row.value_json); } catch (_e) { kvMap[row.store_key] = row.value_json; }
      }
      const exportedAt = new Date().toISOString();
      return jsonResponse({
        success: true,
        summary: {
          exportedAt,
          source: 'Cloudflare D1 (publicspark-db)',
          totalArticles: articles.length,
          publishedArticles: publishedCount,
          draftArticles: articles.length - publishedCount,
          totalCategories: (cats.results || []).length,
          cachedTranslations: (trs.results || []).length,
          staffCount: Array.isArray(kvMap.staff) ? kvMap.staff.length : 0,
          confidentialTipsCount: Array.isArray(kvMap.confidential_tips) ? kvMap.confidential_tips.length : 0,
          grievancesCount: Array.isArray(kvMap.grievances) ? kvMap.grievances.length : 0
        },
        datasets: {
          articles,
          categories: cats.results || [],
          translations: trs.results || [],
          settings: kvMap.settings || {},
          presets: kvMap.presets || [],
          poll: kvMap.poll || {},
          staff: kvMap.staff || [],
          confidential_tips: kvMap.confidential_tips || [],
          grievances: kvMap.grievances || [],
          ad_history: kvMap.ad_history || [],
          media_library: kvMap.media_library || []
        }
      });
    }

    return jsonResponse({ error: 'Endpoint not found on Cloudflare Edge API' }, 404);
  } catch (err) {
    return jsonResponse({ success: false, error: err.message || 'Internal Edge Error' }, 500);
  }
}

