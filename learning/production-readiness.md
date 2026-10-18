# Production Readiness & Backend Integration Audit

This document maintains an honest, project-specific record of implemented & verified backend features, active mock/temporary implementations, security risks, and required production replacements as mandated by Rule 6.

---

## 1. Executive Summary

| Category | Real & Connected to Backend | Mock Data / Local State Only | Pending Production Requirement |
| :--- | :--- | :--- | :--- |
| **Color Harmonies & Themes** | Yes (`/api/settings/theme`, `/api/presets`) | None (Theme presets now loaded dynamically from backend) | Replace client-side secret header with real session auth |
| **Typography & Fonts** | Yes (`/api/settings/typography`, `/api/presets`) | None (Font catalog loaded dynamically from backend) | None |
| **Stock Imagery & Weather** | Yes (`/api/presets`, `/api/weather`) | None (Dynamic city & weather from backend API) | Connect live external weather provider API |
| **Social Links** | Yes (`/api/settings/social`) | None | None |
| **Articles & News CRUD** | Yes (`/api/articles`) | Initial fallback in `mockData.js` | Connect to PostgreSQL / Supabase for multi-node deployments |
| **Categories Taxonomy** | Yes (`/api/categories`) | None (now dynamic in all workspaces) | Connect to PostgreSQL / Supabase |
| **Breaking News Ticker** | Yes (Dynamic from real `is_breaking` stories) | Fallback if 0 breaking stories | None |
| **Live News Wire (RSS)** | Yes (`/api/live-news`) | None (Real-time Google News RSS & SauravTech) | None |
| **Analytics & View Tracking** | Yes (`/api/views/*`, `/api/analytics/*`) | Hourly distribution estimation | Persist analytics logs to database table |
| **Multi-Language Translation** | Yes (`/api/translate`) | None (Real Gemini `gemini-3.8-flash` translation) | Live & verified with persistent `(article_id, lang)` database cache & sha256 hash invalidation |
| **Text-to-Speech (Audio Engine)** | Yes (Browser Native Web Speech API) | None | Pure native `window.speechSynthesis` with dynamic voice-availability auto-hiding |
| **Team & Permissions** | No (Frontend `useState` in AdminWorkspace) | Yes (`usersList` in `AdminWorkspace.jsx`) | Create `GET/POST /api/users` & secure auth system |
| **Ad Slot Placements** | No (Frontend `useState` in AdminWorkspace) | Yes (`adSlots` in `AdminWorkspace.jsx`) | Phase 2: Build `GET/POST /api/settings/ads` & banner manager |
| **Public Opinion Poll** | No (Client `localStorage` only) | Initial vote counts hardcoded | Create `POST /api/poll/vote` with IP/session de-duplication |
| **Article Live Blog Timeline** | No (Hardcoded in `mockData.js`) | Yes (`MOCK_LIVE_UPDATES`) | Create `GET/POST /api/articles/:id/updates` |
| **Storage & Multi-DB Quotas** | Partial (RAM & in-memory caches real) | Quota figures for Supabase, Turso, R2 are estimated | Connect live cloud provider metrics APIs |
| **AI Headline Assistant** | No (Simulated `setTimeout` in Editor Desk) | Yes (Hardcoded template string generation) | Connect real Gemini API via backend proxy route |

---

## 2. Detailed Audit by Feature

### 2.1 Color Harmonies & Visual Themes
- **Current State**: Real & Persisted.
- **Backend File**: [server.js](file:///d:/my%20projects/pintu%20chachu%20news%20web/server/server.js) (`GET /api/settings/theme`, `POST /api/settings/theme`).
- **Disk Storage**: [server/data/settings.json](file:///d:/my%20projects/pintu%20chachu%20news%20web/server/data/settings.json).
- **Frontend File**: [App.jsx](file:///d:/my%20projects/pintu%20chachu%20news%20web/src/App.jsx) & [ColorPaletteCustomizer.jsx](file:///d:/my%20projects/pintu%20chachu%20news%20web/src/components/admin/ColorPaletteCustomizer.jsx).
- **Security Guards**:
  - Regex validation (`SAFE_HEX_REGEX` & `SAFE_RGBA_REGEX`).
  - Whitelist property filtering (only 10 approved theme tokens).
  - 10 KB payload size limit.
- **Pending Production Replacement**: Replace static `x-admin-key` header with user session/cookie authentication.

---

### 2.2 Typography & Regional Font Customizer
- **Current State**: Real & Persisted.
- **Backend File**: [server.js](file:///d:/my%20projects/pintu%20chachu%20news%20web/server/server.js) (`GET /api/settings/typography`, `POST /api/settings/typography`).
- **Disk Storage**: [server/data/settings.json](file:///d:/my%20projects/pintu%20chachu%20news%20web/server/data/settings.json).
- **Frontend File**: [App.jsx](file:///d:/my%20projects/pintu%20chachu%20news%20web/src/App.jsx) & [VisualFontPicker.jsx](file:///d:/my%20projects/pintu%20chachu%20news%20web/src/components/admin/VisualFontPicker.jsx).
- **Features**: Dual-scope font switching (Global vs Regional per 18 languages), 1-click global propagation, live CSS variable injection.

---

### 2.3 News Articles & Curation Engine
- **Current State**: Real & Persisted.
- **Backend File**: [server.js](file:///d:/my%20projects/pintu%20chachu%20news%20web/server/server.js) (`GET /api/articles`, `POST /api/articles`, `POST /api/articles/update`, `POST /api/articles/delete`).
- **Disk Storage**: [server/data/articles.json](file:///d:/my%20projects/pintu%20chachu%20news%20web/server/data/articles.json).
- **Resolved Gap**: Previously [AnalyticsDashboard.jsx](file:///d:/my%20projects/pintu%20chachu%20news%20web/src/components/admin/AnalyticsDashboard.jsx) looked up article titles from hardcoded `MOCK_ARTICLES`. Now it uses the real dynamic `articles` array passed from [AdminWorkspace.jsx](file:///d:/my%20projects/pintu%20chachu%20news%20web/src/components/admin/AdminWorkspace.jsx).

---

### 2.4 Categories Taxonomy
- **Current State**: Real & Persisted.
- **Backend File**: [server.js](file:///d:/my%20projects/pintu%20chachu%20news%20web/server/server.js) (`GET /api/categories`, `POST /api/categories`).
- **Disk Storage**: [server/data/categories.json](file:///d:/my%20projects/pintu%20chachu%20news%20web/server/data/categories.json).
- **Resolved Gap**: Previously [ReporterWorkspace.jsx](file:///d:/my%20projects/pintu%20chachu%20news%20web/src/components/reporter/ReporterWorkspace.jsx) and [SearchPage.jsx](file:///d:/my%20projects/pintu%20chachu%20news%20web/src/components/public/SearchPage.jsx) directly imported `MOCK_CATEGORIES`. Now both components receive and render dynamic `categories` synced with backend storage.

---

### 2.5 Breaking News Ticker
- **Current State**: Real & Dynamically Derived.
- **Frontend File**: [Header.jsx](file:///d:/my%20projects/pintu%20chachu%20news%20web/src/components/common/Header.jsx).
- **Resolved Gap**: Previously the ticker only cycled through 4 hardcoded strings from `mockData.js`. Now it actively inspects `articles.filter(a => a.is_breaking)` so any breaking news marked by Editor or Admin immediately broadcasts in the top ticker bar.

---

### 2.6 Analytics, Country Breakdown & Reader Heartbeat
- **Current State**: Real Backend View Tracking.
- **Backend File**: [server.js](file:///d:/my%20projects/pintu%20chachu%20news%20web/server/server.js) (`/api/views/start`, `/api/views/heartbeat`, `/api/views/end`, `/api/analytics/overview`).
- **Frontend File**: [analyticsService.js](file:///d:/my%20projects/pintu%20chachu%20news%20web/src/services/analyticsService.js) & [AnalyticsDashboard.jsx](file:///d:/my%20projects/pintu%20chachu%20news%20web/src/components/admin/AnalyticsDashboard.jsx).
- **Pending Production Replacement**: Currently in-memory array (`articleViews = []`). For multi-server or container restarts, persist view sessions to a real database (PostgreSQL / SQLite).

---

### 2.7 Team Members & Access Roles (PENDING INTEGRATION)
- **Current State**: **MOCK / IN-MEMORY ONLY**.
- **Frontend File**: [AdminWorkspace.jsx](file:///d:/my%20projects/pintu%20chachu%20news%20web/src/components/admin/AdminWorkspace.jsx#L387-L393) (`usersList` in local `useState`).
- **Why It Exists**: UI prototype for role-based permissions (Reader, Registered, Reporter, Editor, Admin).
- **Required Replacement**:
  1. Backend routes: `GET /api/users`, `POST /api/users/role`, `POST /api/auth/login`.
  2. Database table: `users` (id, name, email, password_hash, role, created_at).
  3. Real auth token / session cookies.

---

### 2.8 Ad Slot Placements (PENDING INTEGRATION — PHASE 2)
- **Current State**: **MOCK / IN-MEMORY ONLY**.
- **Frontend File**: [AdminWorkspace.jsx](file:///d:/my%20projects/pintu%20chachu%20news%20web/src/components/admin/AdminWorkspace.jsx#L395-L400) (`adSlots` in local `useState`).
- **Why It Exists**: Placeholder for Phase 2 advertisement monetization engine.
- **Required Replacement**:
  1. Backend routes: `GET /api/settings/ads`, `POST /api/settings/ads`.
  2. Persistent ad configuration in `settings.json` or database table.
  3. Dynamic ad banner rendering component with Google AdSense script integration or direct advertiser image banners with UTM links.

---

### 2.9 Public Voice Opinion Poll (PENDING INTEGRATION)
- **Current State**: **MOCK / LOCALSTORAGE ONLY**.
- **Frontend File**: [App.jsx](file:///d:/my%20projects/pintu%20chachu%20news%20web/src/App.jsx#L61-L79).
- **Why It Exists**: Demonstrates reader engagement widget with local storage persistence.
- **Required Replacement**:
  1. Backend routes: `GET /api/poll/active`, `POST /api/poll/vote`.
  2. Database table: `poll_questions` & `poll_votes` with IP/session de-duplication.

---

### 2.10 Article Live Blog Updates Timeline (PENDING INTEGRATION)
- **Current State**: **MOCK ONLY**.
- **Frontend File**: [ArticleReader.jsx](file:///d:/my%20projects/pintu%20chachu%20news%20web/src/components/public/ArticleReader.jsx#L474) (`MOCK_LIVE_UPDATES`).
- **Why It Exists**: Static sample timeline for breaking live stories.
- **Required Replacement**:
  1. Backend routes: `GET /api/articles/:id/updates`, `POST /api/articles/:id/updates`.
  2. Schema field: `live_updates` array inside article record.

---

### 2.11 Multi-DB Quota Status in Storage Tab
- **Current State**: **PARTIAL (Estimated Cloud Quotas)**.
- **Backend File**: [server.js](file:///d:/my%20projects/pintu%20chachu%20news%20web/server/server.js#L1333-L1360).
- **Why It Exists**: Node.js memory & cache counts are real, but Supabase, Turso, and Cloudflare R2 MB figures are estimated UI indicators because external cloud credentials have not yet been provided.
- **Required Replacement**: Connect real cloud provider APIs when user sets up live API keys.

---

### 2.12 Critical Security Finding: Client-Side Admin Key
- **Current State**: **EXPOSED IN FRONTEND CODE**.
- **Location**: [App.jsx](file:///d:/my%20projects/pintu%20chachu%20news%20web/src/App.jsx#L184), [App.jsx](file:///d:/my%20projects/pintu%20chachu%20news%20web/src/App.jsx#L206).
- **Issue**: `'x-admin-key': 'publicspark-admin-secret-key-2026'` is present in client-side JavaScript. Any user can inspect browser network traffic and discover the secret key.
- **Required Replacement**:
  1. Implement a proper login endpoint `/api/auth/login`.
  2. Issue an `httpOnly`, `SameSite=Strict`, `Secure` session cookie or short-lived JWT.
  3. Validate session cookies on protected backend routes.
