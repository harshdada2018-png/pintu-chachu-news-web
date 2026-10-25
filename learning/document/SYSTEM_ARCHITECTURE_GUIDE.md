# 🏗️ PublicSpark — System Architecture & Step-by-Step Implementation Guide

Document Version: `1.0.0`  
Target Architecture: **Zero-Cost Hybrid Cloud & Edge Architecture (as per Mermaid Blueprint)**  
Last Updated: September 2026  

---

## 📌 Table of Contents
1. [Overview & How System Works](#1-overview--how-system-works)
2. [Database & Storage Selection Strategy (Which DB Where?)](#2-database--storage-selection-strategy-which-db-where)
3. [Component-by-Component Working Mechanism](#3-component-by-component-working-mechanism)
4. [Step-by-Step Implementation Roadmap (Procedure)](#4-step-by-step-implementation-roadmap-procedure)
5. [Automatic Storage Cleanup & Safeguards](#5-automatic-storage-cleanup--safeguards)

---

## 1. 🌟 Overview & How System Works

PublicSpark is designed as an **Independent, High-Performance Digital News Portal** capable of delivering breaking news, 18-language instant translations, and 1-Click TTS audio reading at **₹0 direct monthly infrastructure cost**.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          USER (Browser SPA)                            │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Node.js Native Backend API Proxy                     │
│               (http://localhost:5000 / Edge Serverless)                │
└────────┬─────────────────┬─────────────────┬──────────────────┬────────┘
         │                 │                 │                  │
         ▼                 ▼                 ▼                  ▼
┌────────────────┐ ┌───────────────┐ ┌───────────────┐ ┌────────────────┐
│ Supabase DB    │ │ Turso Cache   │ │ Cloudflare R2 │ │ AI API Proxy   │
│ (PostgreSQL)   │ │ (LibSQL Edge) │ │ (Objects/MP3) │ │ (Google/Sarvam)│
└────────────────┘ └───────────────┘ └───────────────┘ └────────────────┘
```

---

## 2. 🗄️ Database & Storage Selection Strategy (Kon Sa DB Kaha Best Rahe Ga?)

To maintain maximum speed, zero cost, and strict data safety, we split storage across 4 specific tiers:

| Storage Engine | Recommended Usage (Kaha Use Karein?) | Why it's Best? (Kyu Best Hai?) | Free Tier Limits (Cost: ₹0) |
| :--- | :--- | :--- | :--- |
| **1. Supabase (PostgreSQL)** | **MAIN (MASTER) DATABASE**: News Articles, Categories Taxonomy, User Profiles & Auth/Roles (Admin, Editor, Reporter), RLS Security Policies, Analytics Logs (`article_views`). | Full relational SQL integrity, Row-Level Security (RLS), instant WebSocket subscriptions for live newsroom updates. | 500 MB Postgres DB, 50,000 MAU Auth |
| **2. Turso (LibSQL / SQLite Edge)** | **Translation & Metadata Cache**: High-frequency cached translated articles (`content_hash + lang -> translation`), provider quota logs. | Distributed ultra-low latency (<10ms) edge SQLite. Prevents hitting expensive Translation APIs. | 9 GB Storage, 1 Billion Reads/Month |
| **3. Local Server Storage / Supabase Storage / Cloudinary** | **Media Storage (Zero-Card Setup)**: Generated Audio MP3 files, Compressed WebP images, Video thumbnails. | **Zero International Card Required**. Server local disk (`server/data/uploads/`), Supabase 1GB Storage Bucket, or Cloudinary 25GB free CDN. | 1 GB - 25 GB Free Storage, ₹0 Cost |
| **4. Node.js In-Memory LRU Cache** | **Execution State**: Generation Locks (prevents 2 users requesting same TTS simultaneously), active session heartbeats. | Instant 0ms memory access inside `server.js` proxy. | Free (Server RAM) |

---

## 3. 🧩 Component-by-Component Working Mechanism

### A. 🎧 1-Click Audio (TTS Master)
1. User clicks **Play Audio** on an article.
2. Frontend sends request: `POST /api/tts` with `article_id`, `language`, and `voice_id`.
3. Proxy checks **Cloudflare R2** storage for `audio/article_id_lang.mp3`.
   - **If Found (Cache Hit)**: Directly returns existing MP3 URL. No API call made!
   - **If Missing (Cache Miss)**: 
     - Acquire **Generation Lock** in `server.js` (prevents duplicate generation calls).
     - Call **Google Cloud TTS** (or **Sarvam AI** for Odia/Assamese).
     - Save generated MP3 to Cloudflare R2.
     - Release Lock & Return MP3 to user.

### B. 🌐 18-Language Translation Engine
1. User selects language (e.g., Hindi `hi`, Bengali `bn`, French `fr`).
2. Frontend generates MD5/SHA256 hash of article content.
3. Proxy checks **Turso Edge DB** for matching `content_hash + target_lang`.
   - **Cache Hit**: Returns translated text instantly.
   - **Cache Miss**: Calls translation provider (Google Translate API / Fallbacks) -> Stores translation in Turso DB -> Returns translated text.

### C. 📊 Real-Time Analytics & Heartbeat
1. Reader opens article -> Frontend sends `POST /api/views/start`.
2. Every 15s of active reading sends heartbeat -> updates `scrollDepth` and `readDuration`.
3. Server updates `article_stats_daily` atomically (`view_count + 1`) in Supabase.

---

## 4. 📝 Step-by-Step Implementation Roadmap (Procedure)

### Phase 1: Environment & Secrets Setup
- [ ] Create `.env` file with Supabase, Cloudflare R2, and AI credentials.
- [ ] Install Supabase client SDK: `npm install @supabase/supabase-js`.

### Phase 2: Master Supabase Schema Creation
- [ ] Run SQL migration scripts in Supabase SQL Editor:
  - Create `articles` table (id, title, content, category, author_id, status).
  - Create `categories` table.
  - Create `article_views` and `article_stats_daily` tables.
  - Enable Row Level Security (RLS).

### Phase 3: Cloudflare R2 Bucket Setup
- [ ] Create R2 bucket `publicspark-assets`.
- [ ] Configure S3 client in Node proxy (`server/server.js`) to upload/serve MP3 audio and WebP images.

### Phase 4: Node.js Proxy Server Enhancements (`server/server.js`)
- [ ] Implement Generation Lock to prevent simultaneous TTS synthesis calls.
- [ ] Add Turso LibSQL client fallback for translation caching.
- [ ] Implement storage monitor heartbeat checking storage usage (alerts at 85%).

### Phase 5: Frontend Integration (`src/App.jsx` & Services)
- [ ] Replace `MOCK_ARTICLES` with real Supabase fetches (`src/services/supabaseClient.js`).
- [ ] Connect `cloudAudioService.js` to Node.js proxy `/api/tts`.
- [ ] Connect `translationService.js` to Node.js proxy `/api/translate`.

---

## 5. 🧹 Automatic Storage Cleanup & Safeguards

To ensure Cloudflare R2 storage remains strictly within the ₹0 Free Tier (10 GB):

```
Storage Check (Cron / Periodic)
       │
       ▼
Is R2 Usage > 85%?
 ├── NO  ──► Status: Normal (No Action)
 └── YES ──► Trigger Cleanup Service:
             1. Calculate Usage Score (least listened MP3s first)
             2. Protect Canonical Articles (NEVER AUTO-DELETE)
             3. Delete low-usage regeneratable MP3s until storage drops to ~70%
```

---

## 🎯 Summary Checklist
- **Supabase**: Primary Database + Auth + Real-Time
- **Turso**: Fast Translation Cache
- **Cloudflare R2**: Free File & Audio MP3 Storage
- **Node Proxy**: API Key Security & Routing Engine

*Guaranteed ₹0 Monthly Operating  Cost with Infinite Enterprise Scalability!*
