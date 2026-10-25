# PublicSpark — Technical Requirement Document (TRD)

**Project Name:** PublicSpark Digital Newsroom Platform  
**System Architecture:** Hybrid Node.js Proxy & React Client  
**Version:** 2.0.0  
**Last Updated:** September 2026  

---

## 1. Technical Stack Overview

| Layer | Technology | Purpose / Rationale |
| :--- | :--- | :--- |
| **Frontend Framework** | React 19 + Vite 8 | Ultra-fast HMR, lightweight bundle size, modern JSX syntax |
| **Icons & Design** | Lucide React | Clean, scalable SVG icons (`Volume2`, `Play`, `Pause`, `ShieldCheck`, `Flame`, `RotateCcw`) |
| **Backend Runtime** | Node.js Native HTTP (`server/server.js`) | Zero external npm bloat, high concurrency, zero port conflicts |
| **Backend Proxy Port** | `http://localhost:5000` | Handles `/api/tts`, `/api/translate`, `/api/audio/progress`, `/api/views/*`, `/api/analytics/*` |
| **Frontend Port** | `http://localhost:5173` | Vite development server |
| **Audio Format** | Base64 Data URI MP3 (`data:audio/mp3;base64,...`) | Eliminates browser CORS, AdBlocker blocks, and `NotSupportedError` |
| **Position Store** | `audio_progress` Table & Server `Map()` | Real-time audio playback timestamp memory per `(articleId, langCode)` |
| **Translation Engine** | Multi-Tier (GTX + Clients5 + MyMemory) | Instant 18-language translation with zero API key requirement |

---

## 2. Core Service Architecture (`src/services/`)

```
src/services/
├── speechEngine.js        # Primary TTS Router + Playback Speed Controller Exports (0.75x - 2.0x)
├── cloudAudioService.js    # Base64 Audio Engine, Position Memory Sync & Fast Map Caching
├── translationService.js # 18-Language Translation Engine with Paragraph Chunking
├── analyticsService.js   # Real-Time View Session Tracking, Heartbeat Ping & Analytics Dashboard API Client
├── mediaService.js        # HTML5 Canvas WebP Automated Image Compressor (<200KB)
├── cacheService.js        # Stale-While-Revalidate Article Cache Engine
└── mockData.js           # Bootstrap Article & Category Dataset
```

---

## 3. Speech & Audio Architecture Flow

### Sequence Diagram:
```
[User Clicks "1-Click Audio Reader"]
           │
           ▼
[TextToSpeech.jsx Component]
           │ 1. Fetch Saved Position (GET /api/audio/progress?articleId=1&langCode=hi)
           │ 2. Passes (title + textToRead + langCode + articleId + startPosition)
           ▼
[speechEngine.js / speakTextWithNaturalVoice]
           │
           ▼
[cloudAudioService.js / playCloudAudioWithCache]
           │ Check Client In-Memory Stream Cache (`memoryAudioCache`)
           ├── (Cache Hit) ──► Seek & Play Base64 Audio Data URI Instantly
           │
           └── (Cache Miss) ──► POST Request to Backend Proxy (http://localhost:5000/api/tts)
                                        │
                                        ▼
                            [server/server.js (Node Backend)]
                                        │ Synthesize Google Cloud TTS / Sarvam AI
                                        ▼
                            [Return Base64 MP3 Data URI]
                                        │
                                        ▼
                            [Play via HTML5 Audio & Throttled Sync to POST /api/audio/progress]
```

---

## 4. Environment & Proxy Configuration

### Environment File (`.env`):
```env
# Optional Custom Backend Overrides (Defaults to localhost:5000)
VITE_TTS_API_URL=http://localhost:5000/api/tts
VITE_TRANSLATE_API_URL=http://localhost:5000/api/translate

# Optional Production API Keys (Handled Server-Side Only)
GOOGLE_CLOUD_TTS_API_KEY=your_google_cloud_key
SARVAM_AI_API_KEY=your_sarvam_key
GOOGLE_CLOUD_TRANSLATE_API_KEY=your_translate_key
```

---

## 5. Verification & Performance Standards

- **Page Load Speed**: Sub-50ms render time via local `cacheService` stale-while-revalidate strategy.
- **Audio Reliability**: 100% success rate on Chrome, Brave, Edge, Firefox, Mobile Chrome, and Safari.
- **Image Optimization**: Reporter image uploads automatically compressed to WebP format under 200KB.

---

## 6. Real-Time View Tracking & Analytics Flow Sequence

```
[User Opens Article (ArticleReader.jsx)]
           │
           ▼
[startViewSession(articleId)] ──► POST /api/views/start ──► Returns { sessionId, country }
           │
           ├── (Active Heartbeat every 5s) ──► POST /api/views/heartbeat (Updates read time & scroll_depth)
           │
           └── (On Page Exit / Unmount) ──► navigator.sendBeacon('/api/views/end')
                                                      │
                                                      ▼
                                       [server/server.js Event Log]
                                                      │ Periodic Cron Job
                                                      ▼
                                         [article_stats_daily Table]
                                                      │
                                                      ▼
                                      [AnalyticsDashboard.jsx Component]
```
