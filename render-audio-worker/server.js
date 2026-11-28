/**
 * PublicSpark Render Audio Microservice (Stateless FFmpeg WebM/Opus Compressor)
 * - GET  /health       : Zero-cost liveness check for 11-min keep-alive pingers
 * - POST /compress-tts : Synthesizes via Gemini TTS (or compresses provided WAV/PCM)
 *                        into lightweight 32 kbps mono WebM (Opus) using stdin/stdout pipes.
 */

import http from 'node:http';
import crypto from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const PORT = Number(process.env.PORT || 10000);
const FFMPEG_BIN = process.env.FFMPEG_PATH || 'ffmpeg';
const TTS_MODELS = [
  'gemini-3.8-flash-lite-tts',
  'gemini-2.5-flash-preview-tts',
  'gemini-3.8-flash-tts'
];

function checkFfmpegAvailable() {
  try {
    const res = spawnSync(FFMPEG_BIN, ['-version'], { timeout: 3000, stdio: 'ignore' });
    return res.status === 0;
  } catch {
    return false;
  }
}

const HAS_FFMPEG = checkFfmpegAvailable();

function sendJson(res, status, data) {
  const payload = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(payload);
}

function timingSafeMatch(a, b) {
  const s1 = String(a || '');
  const s2 = String(b || '');
  if (!s1 || s1.length !== s2.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(s1, 'utf8'), Buffer.from(s2, 'utf8'));
  } catch {
    return false;
  }
}

function verifyWorkerAuth(req) {
  const secret = process.env.RENDER_AUDIO_SECRET || '';
  if (!secret) {
    return { ok: false, status: 500, error: 'RENDER_AUDIO_SECRET is not configured on worker.' };
  }
  const auth = String(req.headers['authorization'] || '');
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  const headerSecret = String(req.headers['x-render-secret'] || '').trim();
  const provided = headerSecret || bearer;
  if (!timingSafeMatch(provided, secret)) {
    return { ok: false, status: 401, error: 'Unauthorized audio worker request.' };
  }
  return { ok: true };
}

function sanitizeAndTrimSpeechText(rawText, maxChars = 3200) {
  let clean = String(rawText || '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/Full investigative briefing[^\n.]*/gi, '')
    .replace(/[#*`_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (clean.length > maxChars) {
    const slice = clean.slice(0, maxChars);
    const boundary = Math.max(slice.lastIndexOf('।'), slice.lastIndexOf('. '), slice.lastIndexOf('\n'));
    clean = (boundary > Math.floor(maxChars * 0.6) ? slice.slice(0, boundary + 1) : slice).trim();
  }
  return clean;
}

async function fetchGeminiRawAudio(cleanText) {
  const apiKey = process.env.GEMINI_TTS_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_TTS_API_KEY / GEMINI_API_KEY is missing.');
  }

  let lastErr = null;
  for (const model of TTS_MODELS) {
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
      if (res.status === 429) {
        lastErr = new Error(`${model} HTTP 429 quota/rate limit`);
        continue;
      }
      if (!res.ok) {
        const msg = await res.text().catch(() => '');
        throw new Error(`${model} HTTP ${res.status}: ${msg.slice(0, 140)}`);
      }
      const json = await res.json();
      const part = json?.candidates?.[0]?.content?.parts?.[0];
      if (part?.inlineData?.data) {
        return {
          rawBuffer: Buffer.from(part.inlineData.data, 'base64'),
          mimeType: String(part.inlineData.mimeType || 'audio/l16;rate=24000'),
          model
        };
      }
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('All Gemini TTS models failed.');
}

function detectInputFormatArgs(rawBuffer, mimeType = '') {
  const lower = String(mimeType || '').toLowerCase();
  const isRiffWav = rawBuffer.length >= 12
    && rawBuffer.toString('ascii', 0, 4) === 'RIFF'
    && rawBuffer.toString('ascii', 8, 12) === 'WAVE';

  if (isRiffWav || lower.includes('wav')) {
    return ['-f', 'wav'];
  }
  if (lower.includes('mp3') || lower.includes('mpeg')) {
    return ['-f', 'mp3'];
  }
  const rateMatch = lower.match(/rate=(\d+)/);
  const sampleRate = rateMatch ? Number(rateMatch[1]) : 24000;
  return ['-f', 's16le', '-ar', String(sampleRate), '-ac', '1'];
}

export function compressBufferToWebmOpus(rawBuffer, mimeType = '', bitrateKbps = 32) {
  return new Promise((resolve, reject) => {
    if (!rawBuffer || rawBuffer.length < 32) {
      return reject(new Error('Input audio buffer is empty.'));
    }

    const inputArgs = detectInputFormatArgs(rawBuffer, mimeType);
    const kbps = Math.min(64, Math.max(16, Number(bitrateKbps) || 32));
    const args = [
      '-hide_banner',
      '-loglevel', 'error',
      ...inputArgs,
      '-i', 'pipe:0',
      '-c:a', 'libopus',
      '-b:a', `${kbps}k`,
      '-vbr', 'on',
      '-compression_level', '6',
      '-application', 'voip',
      '-ac', '1',
      '-f', 'webm',
      'pipe:1'
    ];

    const proc = spawn(FFMPEG_BIN, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const outChunks = [];
    const errChunks = [];
    let totalOutBytes = 0;
    const maxOutBytes = 12 * 1024 * 1024;
    let settled = false;

    const killTimer = setTimeout(() => {
      if (!settled) {
        settled = true;
        try { proc.kill('SIGKILL'); } catch {}
        reject(new Error('FFmpeg compression timed out after 60s.'));
      }
    }, 60000);

    proc.stdout.on('data', (chunk) => {
      totalOutBytes += chunk.length;
      if (totalOutBytes > maxOutBytes) {
        if (!settled) {
          settled = true;
          clearTimeout(killTimer);
          try { proc.kill('SIGKILL'); } catch {}
          reject(new Error('Compressed audio exceeded safety limit.'));
        }
        return;
      }
      outChunks.push(chunk);
    });

    proc.stderr.on('data', (chunk) => errChunks.push(chunk));
    proc.stdin.on('error', () => {});

    proc.on('error', (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(killTimer);
        reject(new Error(`FFmpeg spawn error: ${err.message}`));
      }
    });

    proc.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(killTimer);
      if (code !== 0) {
        const stderr = Buffer.concat(errChunks).toString('utf8').trim();
        return reject(new Error(`FFmpeg exited with code ${code}${stderr ? `: ${stderr}` : ''}`));
      }
      const webmBuffer = Buffer.concat(outChunks);
      if (webmBuffer.length < 32) {
        return reject(new Error('FFmpeg produced an empty WebM output.'));
      }
      resolve(webmBuffer);
    });

    proc.stdin.end(rawBuffer);
  });
}

function readJsonBody(req, maxBytes = 25 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > maxBytes) {
        reject(new Error('Request payload too large.'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(new Error('Invalid JSON payload.'));
      }
    });
    req.on('error', reject);
  });
}

export function createWorkerServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      return sendJson(res, 200, {
        ok: true,
        service: 'publicspark-render-audio-worker',
        ffmpegReady: HAS_FFMPEG,
        secretConfigured: Boolean(process.env.RENDER_AUDIO_SECRET),
        uptimeSec: Math.round(process.uptime()),
        memoryMb: Math.round(process.memoryUsage().rss / (1024 * 1024))
      });
    }

    if (req.method === 'POST' && url.pathname === '/compress-tts') {
      const authCheck = verifyWorkerAuth(req);
      if (!authCheck.ok) {
        return sendJson(res, authCheck.status, { success: false, error: authCheck.error });
      }

      try {
        const body = await readJsonBody(req);
        const bitrateKbps = Number(body.bitrateKbps || 32);

        let rawBuffer = null;
        let mimeType = String(body.mimeType || 'audio/l16;rate=24000');
        let model = 'direct_input';

        if (body.audioBase64) {
          rawBuffer = Buffer.from(String(body.audioBase64), 'base64');
        } else {
          const cleanText = sanitizeAndTrimSpeechText(body.text || '');
          if (!cleanText) {
            return sendJson(res, 400, { success: false, error: 'Either text or audioBase64 is required.' });
          }
          const gemRes = await fetchGeminiRawAudio(cleanText);
          rawBuffer = gemRes.rawBuffer;
          mimeType = gemRes.mimeType;
          model = gemRes.model;
        }

        const webmBuffer = await compressBufferToWebmOpus(rawBuffer, mimeType, bitrateKbps);
        return sendJson(res, 200, {
          success: true,
          mimeType: 'audio/webm',
          codec: 'opus',
          bitrateKbps,
          model,
          rawBytes: rawBuffer.length,
          compressedBytes: webmBuffer.length,
          compressionRatio: Number((rawBuffer.length / Math.max(1, webmBuffer.length)).toFixed(2)),
          audioBase64: webmBuffer.toString('base64')
        });
      } catch (err) {
        const isQuota = String(err.message || '').includes('429');
        return sendJson(res, isQuota ? 429 : 500, {
          success: false,
          quotaExhausted: isQuota,
          error: err.message || 'Audio compression failed.'
        });
      }
    }

    return sendJson(res, 404, { success: false, error: 'Route not found.' });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const server = createWorkerServer();
  server.listen(PORT, () => {
    console.log(`[Render Audio Worker] Listening on port ${PORT} (ffmpegReady=${HAS_FFMPEG})`);
  });
}
