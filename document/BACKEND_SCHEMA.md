# 🛠️ PublicSpark — Master Backend Architecture, Schema & API Specification

**Project:** PublicSpark Digital Newsroom Platform  
**Backend Runtime:** Node.js Native HTTP Proxy Server (`server/server.js`) on `http://localhost:5000`  
**Database Engine:** PostgreSQL / Supabase Schema & Row Level Security (RLS)  
**Architecture Theme:** ₹0 Direct Monetary Expense / High Performance / Hybrid Client-Cloud Architecture  
**Version:** 2.0.0 (Production Ready)  

---

## 📋 1. Executive Summary & Core Commitments

The backend architecture of **PublicSpark** is engineered around two core principles: **₹0 Direct Infrastructure Cost** and **High-Performance Execution Speed**.

PublicSpark employs a **Hybrid Client-Cloud Architecture**:
1. **Client-Side & Edge Layer (Browser-Native Execution)**: Image WebP compression (<200KB), local stale-while-revalidate caching, 18-language live translation, and rollout Text-To-Speech (TTS) execute directly within the user's browser without incurring cloud compute fees.
2. **Node.js Native Backend Proxy Layer (`server/server.js`)**: Runs locally on `http://localhost:5000` with zero external dependencies to securely proxy Google Cloud TTS, Sarvam AI, Google Translation API v2, Analytics View Tracking, and Audio Progress Tracking (`/api/audio/progress`).
3. **Cloud Database & Auth Layer (Production Supabase Integration)**: PostgreSQL (Supabase Free Tier) handles persistent storage, Row Level Security (RLS) policies, JWT authentication, and real-time newsroom WebSocket subscriptions.
4. **Sub-50ms Instant Page Load**: Local Stale-While-Revalidate caching layer offloading up to 85% of database queries.

---

## 🏗️ 2. High-Level Backend Service Architecture & Modular Layout

```mermaid
graph TD
    subgraph Client Application & Edge Layer
        UI[React 19 + Vite SPA]
        Cache[cacheService.js Stale-While-Revalidate]
        Compress[mediaService.js Canvas WebP Compressor]
        Trans[translationService.js 18-Lang Engine]
        TTS[speechEngine.js & cloudAudioService.js]
    end

    subgraph Node Backend Proxy (http://localhost:5000)
        ProxyTTS[POST /api/tts Google & Sarvam AI]
        ProxyTrans[POST /api/translate Multi-Tier]
        ProxyProgress[POST & GET /api/audio/progress]
        ProxyAnalytics[POST /api/views/* Analytics Engine]
    end

    subgraph External AI Services
        GCloudTTS[Google Cloud TTS API]
        SarvamAI[Sarvam AI Bulbul v1]
        GTranslate[Google Translation API v2]
    end

    UI --> ProxyProgress
    UI --> ProxyAnalytics
    UI --> ProxyTTS
    UI --> ProxyTrans
    ProxyTTS --> GCloudTTS
    ProxyTTS --> SarvamAI
    ProxyTrans --> GTranslate
```

### Core Frontend/Client Services (`src/services/`):

```
src/services/
├── cacheService.js        # Stale-While-Revalidate Local Browser Caching Engine
├── mediaService.js        # Canvas API WebP Automated Image Compressor (<200KB)
├── speechEngine.js        # Multi-Language Voice Router & Speed Controller Exports (0.75x - 2.0x)
├── cloudAudioService.js    # Base64 Audio Engine, Position Memory Sync & Fast Map Caching
├── translationService.js # 1-Click Multi-Language Translation Service (18 Languages)
├── analyticsService.js   # Real-Time View Session Tracking, Heartbeat Ping & Analytics API Client
└── mockData.js           # Newsroom Initial Bootstrapping & Fallback Mock Database
```

- **[`cacheService.js`](file:///d:/my%20projects/pintu%20chachu%20news%20web/src/services/cacheService.js)**: Caches published articles and breaking alerts in `localStorage` for sub-50ms page renders.
- **[`mediaService.js`](file:///d:/my%20projects/pintu%20chachu%20news%20web/src/services/mediaService.js)**: Intercepts reporter uploads (5MB - 15MB) and converts them to optimized WebP (<200KB limit).
- **[`translationService.js`](file:///d:/my%20projects/pintu%20chachu%20news%20web/src/services/translationService.js)**: Multi-tier 18-language translation engine with paragraph chunking.
- **[`cloudAudioService.js`](file:///d:/my%20projects/pintu%20chachu%20news%20web/src/services/cloudAudioService.js)**: Base64 audio stream engine & position memory sync with `/api/audio/progress`.

---

## 🔄 3. Data Flow Architecture & Sequence Diagrams

### A. Reader Article Viewing, Translation & Audio Progress Sequence
```
[User Selects Article]
       │
       ▼
[Check Local Cache (cacheService.js)] ───(Found <50ms)───► [Render Article Instantly]
       │ (Cache Miss)
       ▼
[Fetch from Database / Mock]
       │
       ▼
[User Changes Language Dropdown]
       │
       ▼
[translationService.js] ───► [Update UI Title & Content Instantly]
       │
       ▼
[User Clicks 🔊 Audio Reader]
       │
       ▼
[GET /api/audio/progress?articleId=1&langCode=hi] ───► [Fetch Saved Position (e.g. 15s)]
       │
       ▼
[cloudAudioService.js / playCloudAudioWithCache] ───► [Seek & Play Audio from 15s]
       │
       ▼
[Audio Playing] ───(Throttled Sync 1s)───► [POST /api/audio/progress (Save Timestamp)]
```

### B. Reporter Draft Submission & WebP Compression Sequence
```
[Reporter Uploads Raw Photo (10MB)]
       │
       ▼
[mediaService.js (Canvas WebP Pipeline)]
       ├── Downscale Max Width to 1200px
       ├── Convert to .webp format
       └── Enforce < 200KB File Constraint
       │
       ▼
[Save Draft with Compressed WebP & Metadata]
       │
       ▼
[Submit to Editorial Queue]
```

### C. Real-Time View Tracking & Analytics Session Sequence
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

---

## ⚡ 4. Node.js Backend Proxy API Specifications (`http://localhost:5000`)

### 4.1 Text-To-Speech Synthesis Endpoint
- **Route**: `POST /api/tts`
- **Description**: Synthesizes clean audio for an article prompt via Google Cloud TTS or Sarvam AI and returns a Base64 Data URI MP3.
- **Request Body**:
  ```json
  {
    "articleId": "1",
    "text": "ISRO Milestone: Indigenous Satellite System Deployed...",
    "langCode": "hi"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "audioUrl": "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2...",
    "isCached": false,
    "provider": "google"
  }
  ```

### 4.2 Multi-Language Translation Endpoint
- **Route**: `POST /api/translate`
- **Description**: Translates source text into target language using Google GTX / Clients5 / MyMemory with paragraph chunking.
- **Request Body**:
  ```json
  {
    "text": "ISRO successfully launches Next-Gen Earth Observation Satellite.",
    "targetLang": "hi"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "translatedText": "इसरो ने श्रीहरिकोटा से अगली पीढ़ी का पृथ्वी अवलोकन उपग्रह सफलतापूर्वक लॉन्च किया।",
    "isCached": false,
    "success": true
  }
  ```

### 4.3 View Tracking & Analytics Endpoints
- **Route**: `POST /api/views/start` — Initializes view session, returns `sessionId` and resolved `country`.
- **Route**: `POST /api/views/heartbeat` — 5-second ping updating active read time and max scroll percentage.
- **Route**: `POST /api/views/end` — Unload/exit beacon flushing final duration (`readDurationSeconds`) and scroll depth (`scroll_depth`).
- **Route**: `GET /api/analytics/overview` — Dashboard summary metrics (Total Views, Unique Readers, Avg Read Time, Country Breakdown, 7-Day Trend).
- **Route**: `GET /api/analytics/trending?period=day|week|month` — Ranked content performance index for requested time period.
- **Route**: `GET /api/analytics/article/:id/summary` — Per-article metrics summary.
- **Route**: `GET /api/analytics/article/:id/trend` — Per-article time-series daily view counts.
- **Route**: `GET /api/analytics/article/:id/countries` — Per-article geographic country distribution.

### 4.4 Audio Playback Progress Tracking Endpoints
- **Route**: `POST /api/audio/progress`
- **Description**: Saves playback progress in seconds for an article in a specific language.
- **Request Body**:
  ```json
  {
    "articleId": "1",
    "langCode": "hi",
    "positionSeconds": 42.5
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "articleId": "1",
    "langCode": "hi",
    "positionSeconds": 42.5
  }
  ```

- **Route**: `GET /api/audio/progress?articleId=1&langCode=hi`
- **Description**: Retrieves the saved playback position for an article in a specific language.
- **Response (200 OK)**:
  ```json
  {
    "articleId": "1",
    "langCode": "hi",
    "last_position_seconds": 42.5
  }
  ```

---

## 🗄️ 5. PostgreSQL Production Schema & Data Models

Below is the complete production PostgreSQL DDL schema definition (used in Supabase cloud database):

```sql
-- 1. ENUMS FOR ROLES & STATUS
CREATE TYPE user_role AS ENUM ('visitor', 'registered', 'reporter', 'editor', 'admin');
CREATE TYPE article_status AS ENUM ('draft', 'submitted', 'under_review', 'changes_requested', 'approved', 'published', 'archived');
CREATE TYPE article_format AS ENUM ('standard', 'breaking', 'live', 'explainer', 'opinion', 'video');

-- 2. USER PROFILES TABLE
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    bio TEXT,
    avatar_url TEXT,
    role user_role NOT NULL DEFAULT 'registered',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CATEGORIES TABLE
CREATE TABLE public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(64) NOT NULL,
    slug VARCHAR(64) UNIQUE NOT NULL,
    description TEXT
);

-- 4. ARTICLES MAIN TABLE
CREATE TABLE public.articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    sub_title TEXT,
    content TEXT NOT NULL,
    summary TEXT,
    format article_format NOT NULL DEFAULT 'standard',
    featured_image TEXT,
    image_caption TEXT,
    media_credits TEXT,
    video_url TEXT,
    author_id UUID NOT NULL REFERENCES public.profiles(id),
    category_id UUID NOT NULL REFERENCES public.categories(id),
    status article_status NOT NULL DEFAULT 'published',
    is_breaking BOOLEAN DEFAULT FALSE,
    views_count INT DEFAULT 0,
    reading_time_mins INT DEFAULT 4,
    published_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    fts_vector tsvector GENERATED ALWAYS AS (
        to_tsvector('english', coalesce(title, '') || ' ' || coalesce(summary, ''))
    ) STORED
);

-- 5. AUDIO CACHING TABLE
CREATE TABLE public.audio_cache (
    id SERIAL PRIMARY KEY,
    article_id VARCHAR(64) NOT NULL,
    language_code VARCHAR(16) NOT NULL,
    audio_data_uri TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(article_id, language_code)
);

-- 6. AUDIO PLAYBACK PROGRESS TABLE
CREATE TABLE public.audio_progress (
    id SERIAL PRIMARY KEY,
    article_id VARCHAR(64) NOT NULL,
    language_code VARCHAR(16) NOT NULL,
    last_position_seconds NUMERIC(8, 2) DEFAULT 0.0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(article_id, language_code)
);

-- 7. RAW EVENT LOG TABLE (article_views)
CREATE TABLE public.article_views (
    id VARCHAR(64) PRIMARY KEY,
    article_id VARCHAR(64) NOT NULL REFERENCES public.articles(id),
    user_id VARCHAR(64),
    session_id VARCHAR(128) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    country VARCHAR(8) NOT NULL,
    read_duration_seconds INT DEFAULT 0,
    scroll_depth INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. PRE-AGGREGATED DAILY SUMMARY TABLE (article_stats_daily)
CREATE TABLE public.article_stats_daily (
    article_id VARCHAR(64) NOT NULL REFERENCES public.articles(id),
    date DATE NOT NULL,
    views_count INT DEFAULT 0,
    unique_views_count INT DEFAULT 0,
    avg_read_duration FLOAT DEFAULT 0.0,
    country_breakdown JSONB DEFAULT '{}'::jsonb,
    PRIMARY KEY (article_id, date)
);

-- 9. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- Readers can ONLY read published articles
CREATE POLICY "Public articles read access" ON public.articles 
    FOR SELECT USING (status = 'published');

-- Reporters can create and update THEIR OWN drafts
CREATE POLICY "Reporters own articles access" ON public.articles 
    FOR ALL USING (auth.uid() = author_id);

-- Editors & Admins have full management permissions
CREATE POLICY "Editors full access" ON public.articles 
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role IN ('editor', 'admin')
        )
    );
```

---

## 🔑 6. Cache Keys & Naming Conventions

| Cache Layer | Key Pattern | Storage Location | Example |
| :--- | :--- | :--- | :--- |
| **Client Audio Cache** | `ps_audio_cache_v1_{articleId}_{langCode}` | `sessionStorage` & Memory | `ps_audio_cache_v1_1_hi` |
| **Client Translation Cache** | `ps_trans_{langCode}_{length}_{hash}` | `localStorage` & Memory | `ps_trans_hi_142_892314` |
| **Server Audio Cache** | `{articleId}_{cleanLang}` | Server `Map()` & `audio_cache` | `1_hi` |
| **Server Audio Progress** | `{articleId}_{langCode}` | Server `Map()` & `audio_progress` | `1_hi` (42.5s) |
| **Server Translation Cache** | `{targetLang}:{text}` | Server `Map()` | `hi:ISRO Milestone...` |
