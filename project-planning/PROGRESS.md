# PublicSpark Master Project Roadmap & Progress Tracker

> [!IMPORTANT]
> **Core Principle (Rule 10 & Rule 11)**:
> Start ONE task -> Complete it fully -> Verify it -> Report to User -> Get Approval -> Start Next Task.
> Zero cost burden: All features built natively in-house using React, Vite, Node.js, and standard web APIs without paid SaaS/plugins.

---

##  Section 1: Completed Tasks (Jo Kaam 100% Ho Chuke Hain)

| # | Task / Feature | Category | Status | Summary & Verification |
| :- | :--- | :--- | :- | :--- |
| 1 | **Gemini Multilingual AI Translation Engine** | AI & Editorial | `Completed` | 19 languages supported with 0ms cache hits, rate limit protection, and Hindi base language auto-detection. |
| 2 | **2-Stage Neural AI Audio Storytelling ("Listen to Story")** | AI & Voice | `Completed` | Headline -> Chime cue (2.2s pause) -> Full Story Body. Output converted to 32kbps mono MP3 via pure JS (`@breezystack/lamejs`) with HTTP 206 byte-range streaming. |
| 3 | **Backend Ad Decision Engine & Admin Order Scheduler** | Monetization | `Completed` | Server clock (`new Date()`) evaluates start/end date-time, scope targeting (Global, Category, Article), and waterfall fallback to Google AdSense. Verified with live Node tests. |
| 4 | **Ad Scope, Campaign Dates & Auto-Expiry Rules Suite** | Monetization | `Completed` | 1-click Scope selector (Global vs Category vs Single Article), exclusion list, `datetime-local` inputs, and auto-updating `/ads.txt`. |
| 5 | **Monetization Desk 6-Slot Expansion & Mobile Calibration** | Monetization | `Completed` | Expanded to 6 slots (Header, In-Article, Sidebar, Home Feed, Footer, Mobile Sticky Banner). Zero horizontal overflow on 360px-390px screens. |
| 6 | **Server-Side Dynamic Meta & Article Pre-Rendering Gateway (SSR)** | SEO & Crawlers | `Completed` | Injects dynamic `<title>`, canonical `<link>`, OpenGraph, Twitter Cards, Schema.org `NewsArticle` JSON-LD, and visible semantic `<article>` without cloaking. |
| 7 | **Native Browser History API Deep Linking** | SEO & Navigation | `Completed` | Full SPA navigation with `/article/:slug`, `/news/:slug`, `/search` via native History API (`pushState`, `popstate`). |
| 8 | **Google AdSense Mandatory Legal Suite (5 Policies)** | Compliance | `Completed` | `LegalModal.jsx` with Privacy Policy (DART cookie disclosures), Terms, About Us, Contact Us (with Grievance Redressal Officer), and Fact-Check Policy. |
| 9 | **Daily Reader Poll Manager & Live Homepage Sync** | Engagement | `Completed` | Admin Poll Desk with master toggle, dynamic options, live voting percentages, reset votes, and mobile 2-tier responsive layout. |
| 10 | **Sovereign Broadsheet UI & 100% Zero-Glassmorphism Purge** | UI/UX | `Completed` | Eradicated all `backdrop-filter` blurs and translucent alphas; established 100% solid paper surfaces with crisp 1px hairline borders. |
| 11 | **Regional Indian Typography Studio (18 Languages)** | UI/UX | `Completed` | Curated Indian font pairings (Mukta, Tiro, Hind Siliguri), quick presets, range slider, boldness slider, and 1-click site-wide sync. |
| 12 | **Writer Desk Auto-Save, WebP Uploads & Minimalist Language Dropdown** | Editorial | `Completed` | `localStorage` draft recovery (`ps_reporter_draft_v1`), mandatory source language gate with compact `<select>` dropdown (saving 500px mobile height), and client-side WebP compression to `server/data/uploads/`. |
| 13 | **In-Article Reader Accessibility Font Scaler (A- / A / A+)** | UI/UX | `Completed` | Reader font scaling smoothly adjusting headlines, standfirst, drop-caps (respecting non-Latin scripts), and body copy without page reload. |
| 14 | **Autonomous Mobile Newspaper Architecture** | UI/UX | `Completed` | 52px sticky app bar, touch horizontal category rail, compact split cards, docked audio mini-player, and zero overflow on 360px–390px screens. |
| 15 | **Strict Zero-Emoji Purge Across Entire Codebase** | Design System | `Completed` | Eradicated 100% of emojis; replaced with clean, high-contrast SVG Lucide icons and authentic broadsheet typography. |
| 16 | **Smart Searchable Article Picker in Ad Desk** | Monetization / Admin UX | `Completed` | Implemented dynamic category division filter pills auto-synced with `/api/categories`, live keyword search input with instant matching, latest news quick select list, selected article preview card with change/reset controls, and full mobile responsive calibration. Verified via `npm run build` (clean exit code 0 in 643ms). |
| 16.1 | **Dynamic In-Place Editable & Backend-Persisted Category Suite** | Taxonomy & Backend | `Completed` | Built backend `GET /api/categories` & `POST /api/categories` with persistent `server/data/categories.json`, inline Edit Category mode (`<Edit3 />`, `<Check />`, `<X />`) in Categories Desk, auto-slug derivation, duplicate validation, article count safety check on deletion, and real-time synchronization with Monetization Desk and reader navigation. Verified with live API roundtrips and `npm run build` (413ms). |
| 16.2 | **Ad Campaign History & Archive Engine (with 1-Click Re-Run)** | Monetization & Operations | `Completed` | Built backend `GET /api/ads/history` & `POST /api/ads/history/delete` with persistent `server/data/ad_history.json`, automatic snapshot capture on ad save, live dual-subtab interface (`6 Live Placement Slots` & `Campaign History & Archive`), 4 metrics counters, live search, status & slot filters, thumbnail lightbox preview, and 1-click modal to clone & re-run past campaigns in any slot with customizable duration presets. Verified via API roundtrips and clean `npm run build` (384ms). |
| 16.3 | **Direct Sponsor Impressions & Click Tracker (In-House Ad Analytics)** | Monetization & Analytics | `Completed` | Implemented server-side tracking endpoints `POST /api/ads/track/impression` & `POST /api/ads/track/click` with in-memory IP deduplication (30 min cooldown for views, 5 min for clicks) persisted to `ad_history.json`. Added client-side `IntersectionObserver` in `PartnerUnit.jsx` (50% visibility for >500ms) and `keepalive: true` / `sendBeacon` click tracking. Created 6 top KPI metric boxes, live card badges (`Views`, `Clicks`, `CTR %`), and interactive "Client Proof" Summary Modal with 1-click WhatsApp copy and direct WhatsApp messaging for sponsors. Verified end-to-end and clean `npm run build` (378ms). |
| 16.4 | **1-Tap WhatsApp Sponsor Connect (Local Advertiser Mode)** | Monetization & Local Business | `Completed` | Implemented dual-layer Indian phone auto-detection (10 digits, +91, 0-prefix, wa.me) with dynamic `https://wa.me/91XXXXXXXXXX?text=...` deep link embedding custom enquiry message. Added subtle broadsheet `WhatsApp Connect` pill badge on reader banners in `PartnerUnit.jsx`, real-time visual detection badge with 1-click `[Test Link ↗]` in `MonetizationDesk.jsx` (placement form, edit modal, and history table), preserving click telemetry. Verified with unit tests (`scratch/test_whatsapp_connect.cjs`), `npm run build` (502ms), and `npm run lint` (0 errors). |
| 16.5 | **Real-Time Auto-Switch Timer (Zero-Reload Live Transition)** | Monetization & Real-Time Sync | `Completed` | Implemented precision sleep timers (`setTimeout`) executing at exact `startsAt` and `expiresAt` timestamps. Added zero layout shift (CLS) crossfade (`opacity: 1 -> 0 -> 1` over 300ms) and predictive timestamps (`nextStartsAt`, `expiresAt`) in `/api/ads/active`. Integrated `document.visibilitychange` and `window.focus` listeners for instant synchronization when readers unlock mobile phones or return to tabs. Verified with automated tests, `npm run build` (554ms), and `npm run lint` (0 errors). |
| 16.6 | **Poster Aspect Ratio Lock & Dimension Guard** | Monetization & Layout Guard | `Completed` | Enforced IAB standards and vertical bounds via `SLOT_DIMENSION_GUARDS` and CSS clamps (Header: 100px/110px, In-Article: 280px, Sidebar: 600px/300px, Home Feed: 120px/110px, Footer: 100px/80px, Mobile Sticky: 60px). Added clean paper letterboxing via `object-fit: contain`, recommended dimension badges in placement accordion, re-run clone modal, and edit campaign modal. Verified with automated tests, `npm run build` (516ms), and `npm run lint` (0 errors). |
| 20 | **Article Future Publishing Timer (Auto-Publish Later)** | Editorial & Newsroom Ops | `Completed` | Implemented dual-layer auto-publish engine in `server/server.js` (20s background cron + on-demand evaluator), public reader embargo shield (API + SSR), StoryEditorModal scheduler UI with `datetime-local` picker, scheduled stories filter desk with 1-click 'Publish Now', and strict Editorial RBAC gate (reporters locked to drafts; only editors/admins can publish or schedule). Verified via unit tests (`test_scheduled_publishing.mjs`), `npm run build` (640ms), and `npm run lint` (0 errors). |
| 21 | **Article Revision History & 1-Click Rollback Desk** | Editorial & Newsroom Ops | `Completed` | Built persistent storage in `server/data/article_revisions.json` storing `{ [articleId]: [ RevisionObject, ... ] }`, automatic baseline & update snapshots, zero-waste 30-revision capping, `ArticleRevisionModal.jsx` timeline & diff inspector, 1-click rollback restoring live article with audit log, and strict Editorial RBAC (reporters view-only). Verified via unit tests (`test_revision_rollback.mjs`), `npm run build` (769ms), and `npm run lint` (0 errors). |
| 22 | **Centralized Digital Asset & Photo Media Library Desk** | Media & Assets | `Completed` | Dedicated Media Library tab indexing server uploads, multi-field search, 8 news agency credit presets, missing-credit badge, disk usage statistics (% of 5GB Cloudflare free tier), multi-tier Editorial RBAC, and 1-click 'Insert into Story' picker for Story Editor and Field Reporter Desk without re-uploading. Verified with 18 automated tests, clean build (489ms), and lint (0 errors). |
| 31 | **Minimalist Broadsheet Newsroom UI Polish (Phase 1)** | UI/UX & Editorial Standards | `Completed` | Refined header masthead, cards, and sidebar to eliminate generic AI/template aesthetics. Streamlined top utility bar, refined language selector, replaced public role dropdown with discrete staff access, removed fake views/likes from cards, eliminated bouncy hover zoom animations, and established 100% solid flat paper surfaces with crisp 1px hairline dividers while preserving 100% of all features. Verified via `npm run build` (515ms) and `npm run lint` (0 errors). |
| 23 | **Live Breaking News Live-Blog / Minute-by-Minute Timeline Mode** | Real-Time Editorial & Live Stream | `Completed` | Article presentation format switcher (`standard`, `live`, `video`), live coverage status toggle (`active` vs `concluded`), backend endpoints (`GET/POST/DELETE /api/articles/:id/live-updates`), fast micro-update editor (`LiveUpdatesModal.jsx`), and reader real-time live timeline with 25s auto-polling, manual refresh, and Key Highlights filter. Verified via automated unit tests (`test_subtopic_23_a.mjs`, `test_subtopic_23_b.mjs`), `npm run build` (529ms), and `npm run lint` (0 errors). |
| 23.1 | **Reporter Desk Rejection, Feedback Note & In-Place Resubmission Flow** | Editorial Workflow & Bug Fix | `Completed` | Synchronized `myStories` with `rejectedArticles` (`ps_rejected_articles_v1`), added feedback note modal with presets in `EditorWorkspace.jsx`, crimson rejection badge with editor's feedback note in `ReporterWorkspace.jsx`, and `[ Edit & Resubmit ]` action loading full story data into form for revision and re-queueing to editor desk. Verified via automated tests (`test_reporter_rejection_flow.mjs`), `npm run build` (923ms, exit code 0), and `npm run lint` (0 errors). |
| 24 | **WhatsApp Smart Formatted Share Card & Viral Bulletin Engine** | Reader Engagement & Virality | `Completed` | Custom message builder in `src/services/shareService.js` (bold headline, 3 bullet points, dateline, clean URL), 1-tap WhatsApp buttons in ArticleReader top/bottom toolbars, Share Modal with live bulletin preview & 1-click clipboard copy, and direct feed card WhatsApp share buttons in `src/App.jsx`. Verified via automated tests (`test_share_service.mjs`), `npm run build` (556ms), and `npm run lint` (0 errors). |
| 25 | **Fact-Check & Source Credibility Box** | Reader Trust & Verification | `Completed` | Interactive Credibility Shield badge and Editorial Fact-Check Dossier modal (`FactCheckDossierModal`) in `ArticleReader.jsx`, broadsheet Official Sources & Gazette Citations Box with document classification tags, category-based institutional fallback (PIB, Gazette of India, ISRO Bulletin, RBI), 1-click presets in `StoryEditorModal` and `ReporterWorkspace.jsx`, and certification in `EditorWorkspace.jsx`. Verified via 33 automated tests (`test_task_25_fact_check.mjs`), `npm run build` (637ms), and `npm run lint` (0 errors). |
| 26 | **In-Article Smart Related Stories ("Ye Bhi Padhein")** | Reader Retention & Discovery | `Completed` | Category-matched scoring algorithm in `src/services/recommendationService.js`, mid-article inline callout ("ये भी पढ़ें") after paragraph 4 in `markdownRenderer.jsx`, and 3-card broadsheet responsive grid at the end of the article with 1-tap navigation and smooth scroll. Verified via 19 automated tests, `npm run build` (628ms), and `npm run lint` (0 errors). |
| 27 | **Hairline Reading Progress Bar & "X Min Read" Badge** | Reader Experience & Polish | `Completed` | 60fps butter-smooth top reading progress bar (`scrollProgress %`) with mobile 52px app bar alignment, plus script-aware reading duration utility (`readingTime.js`) calibrated for Latin (200 WPM), Indic (160 WPM), and CJK (350 CPM) with byline clock badge, related story cards duration, and backend auto-calculation. Verified via 12 automated unit tests across subtopics, `npm run build` (673ms, exit code 0), and `npm run lint` (0 errors). |
| 17 | **Multi-Role Newsroom Login & RBAC & 2FA Suite** | Security & Newsroom Ops | `Completed` | Email/password auth, 5-min Gmail OTP, BBC-grade discrete routing, reporter story isolation, Admin Staff Desk, Super Admin RFC 6238 TOTP 2FA, 10 recovery codes, Master Passphrase CLI recovery (SHA-256 protected) + Cloudflare D1 lockdown, and full resolution of all 6 Critic audit defects (devOtpPreview eradicated, admin auth middleware on all /api/staff/* endpoints, responsive mobile card view for <= 768px, sovereign design tokens, copy timeout cleanup, 2FA modal clamping). |
| 18 | **Backend API Hardening & Pre-Deployment Tamper Protection** | Security & Backend Hardening | `Completed` | Subtopic 18.1: Server-side byline binding and reporter draft lockdown (SEC-003). Subtopic 18.2: Server-side token invalidation on logout (SEC-007) and admin settings/ads guard. Subtopic 18.3: Sliding-window IP rate limiter (max 5 OTPs/15 min, SEC-004), reverse proxy IP resolution (SEC-008), and restrictive CORS policy (SEC-005). |
| 19 | **1-Click Complete Database & Media Auto-Backup Desk** | Disaster Recovery & Operations | `Completed` | Subtopic 19.1: Zero-dependency pure Node.js PKZIP archiver (`backupService.js`), rolling 3-archive retention, anti-traversal security, and Gmail dispatch with 2x2 responsive telemetry digest. Subtopic 19.2: Sovereign Disaster Recovery Desk in `StorageSettings.jsx` with KPI metric cards, 1-click zip generation, 1-click email dispatch, 60s ephemeral download tickets, and responsive archives table. Subtopic 19.3: 1-command CLI restore utility (`server/cli/restore-backup.js`, `npm run restore-backup`), directory traversal protection with automated `stripDataPrefix = true` mapping, and 2:00 AM IST nightly cron evaluator on 5-min watchdog. Verified 100% via unit suites, lint (0 errors), and build (0 errors). |
| 34 | **Sovereign Developer God-Mode & Emergency Rescue Access (Stealth Portal)** | Security & Architecture | `Completed` | Anchored sovereign developer credentials in `.env` with dynamic salted scrypt sync, total directory stealth shield in `getSanitizedStaffList()` and `StaffPermissionsDesk.jsx` (invisible to regular staff, immutable protection against deletion/demotion), discrete `/developer` & `/rescue` gateway with `DeveloperRescueDesk.jsx`, system telemetry, lock resets, 15-table DB scan, and instant emergency PKZIP backup creation. Bound Google Authenticator TOTP 2FA. Verified 100% via unit suites (18/18 tests passed) and clean build. |
| 34.1 | **Full-Site Critic Audit & Responsive Viewport Hardening** | Quality & UX Hardening | `Completed` | Resolved all 13 forensic defects across functional security, mobile responsiveness (360px-480px), WCAG dark-mode contrast tokens, touch targets, and semantic DOM structure. Retained registration password in `StaffLoginModal.jsx` until final submission, dynamic delivery email in `StorageSettings.jsx`, gated synthetic analytics mock data behind `ENABLE_MOCK_ANALYTICS`, responsive flex-wrap & single-column layouts for reader controls and search results, CSS `:has()` sticky ad & audio collision avoidance, tokenized 53 dark mode colors in `StorageSettings.jsx`, workspace badge tokenization, and enlarged touch targets. Verified via automated tests (`scratch/test_critic_fixes.mjs`) and clean build (424ms). |
| 40 | **Cloudflare-Safe Single-Batch Multilingual Translation Engine & Zero-Quota Disk Caching** | Performance & Multilingual | `Completed` | Replaced naive 51-request client loop with single-batch POST /api/translate/batch & GET /api/articles?lang=... with Cloudflare Cache-Control headers (s-maxage=300). Pre-warmed top stories to translations.json. Added localized relative time formatter (dateFormatter.js) across all cards & shelves, localized Reader Poll, and linked breaking ticker to publishedArticles. Verified with 0 errors via oxlint and vite build. |
| 40.1 | **Cloudflare Real-Time Edge Cache Purge & Proactive Breaking Pre-Translation** | Real-Time Sync & CDN | `Completed` | Implemented `purgeCloudflareEdgeCache(reason)` calling Cloudflare's Purge Cache API (<200ms flush on publish/update/delete) + `autoPreTranslatePublishedArticle(article)` proactive background pre-translation of new stories to English. Enforced private non-cached headers on staff requests and configurable `EDGE_CACHE_TTL`. Verified live: breaking story auto-translated and immediately returned in GET /api/articles?lang=en. |
| 40.2 | **Strict 2-Color Master Broadsheet Design System (Combination 1)** | UI/UX & Design System | `Completed` | Unified entire site palette to strictly 2 disciplined colors: Signature Editorial Crimson Red (`#B81D13` / night `#F85149`) and Deep Obsidian Ink (`#121212` / `#14171A` / night `#E6EDF3`) on Paper White canvas. Eradicated all rainbow colors across CSS tokens, bookmarks, audio player equalizer, verified badges, action buttons, WhatsApp share controls, and drawers. Verified via oxlint (0 errors) and production build (622ms). |

---

## Section 2: In-Progress Tasks (Jin Par Kaam Chal Raha Hai)

- **Currently In Progress**: None (Ready to begin Task 38).
- **Just Completed & Verified**: **Task 39: Newsroom Library Architecture: Left-Side Animated Search Drawer & Dynamic Category Shelves Engine** (Subtopics A, B, and D 100% completed & verified under zero-emoji standards; Subtopic C deferred per Boss's directive).
- **Scheduled Next**:
  - **Task 38: BBC-Style Institutional Footer Compliance Strip & Custom Newsroom Identity Integration** (`Planned`)
    - Subtopic A: BBC-Grade Horizontal Legal & Compliance Strip (Terms of Use, Privacy Policy, Cookies, Do Not Sell Info, Accessibility Help, Advertise With Us, Help/FAQs, Content Index, External Linking Safe Harbor Policy).
    - Subtopic B: Integration of Boss's Old Site Content & Editorial Disclaimers (Exact copy, custom contacts, regional disclaimers).
    - Subtopic C: Responsive 360px Mobile-to-Desktop Layout & Accessibility Verification.

---

##  Section 3: Planned Tasks (Jo Jo Kaam Aage Karne Hain — Master Topic & Subtopic Checklist)

###  Module 1: Complete In-House Ads & Monetization Suite

- [x] **Task 16.2: Ad Campaign History & Archive Engine (with 1-Click Re-Run & In-Place Editing)** `Completed`
  - [x] *Subtopic A*: Backend Persistence & REST API — Created `server/data/ad_history.json` and endpoints `GET /api/ads/history` and `POST /api/ads/history/delete`.
  - [x] *Subtopic B*: Automatic Campaign Snapshots — Auto-captures snapshot on ad save across all 6 slots with deduplication.
  - [x] *Subtopic C*: History Desk Interface — Dedicated broadsheet history table & cards inside `MonetizationDesk.jsx` showing Banner Thumbnail, Sponsor Name, Slot, Date Range, and Status Badges (`Live Now`, `Scheduled`).
  - [x] *Subtopic D*: 1-Click "Re-Run / Clone" Action — Modal to instantly re-populate and activate the banner in any slot with 24h, 7d, 30d presets without re-uploading images.
  - [x] *Subtopic E*: Zero-Waste Storage & Instant Expiry Purge — Auto-deletes campaign record and physical WebP banner file from disk the moment `endDateTime` has passed.
  - [x] *Subtopic F*: Placement Form Auto-Clear & Live Slot Notice — Slot inputs clear automatically after saving or via manual `[  Clear Form / New Ad ]` button, while displaying an active status badge if an ad is currently live in that slot.
  - [x] *Subtopic G*: In-Place Campaign Editing (`POST /api/ads/history/update`) — Edit Modal allowing instant corrections for typos, sponsor links/WhatsApp phone, replacement banner, and schedule dates directly from the active campaigns desk.

- [x] **Task 16.3: Direct Sponsor Impressions & Click Tracker (In-House Ad Analytics)** `Completed`
  - [x] *Subtopic A*: Server-Side Tracking Gateway — Endpoints `POST /api/ads/track/impression` and `POST /api/ads/track/click` with in-memory IP sliding window de-duplication (30 min cooldown for views, 5 min for clicks) and direct JSON persistence in `ad_history.json`.
  - [x] *Subtopic B*: Client-Side Visibility & Click Telemetry — `IntersectionObserver` in `PartnerUnit.jsx` verifying real human reading (>50% visibility for >500ms) and `keepalive: true` / `navigator.sendBeacon` click recording.
  - [x] *Subtopic C*: Live Metrics Badges & 6 KPI Counters — Real-time counters inside `MonetizationDesk.jsx` showing Total Views, Total Clicks, and Average CTR %, plus live badges on every active campaign card.
  - [x] *Subtopic D*: Local Advertiser "Client Proof" Summary Card Modal — Professional verification modal with official shield badge, big KPI cards, 1-click WhatsApp copy text generator, and direct WhatsApp sharing link for advertisers.

- [x] **Task 16.4: 1-Tap WhatsApp Sponsor Connect (Local Advertiser Mode)** `Completed`
  - [x] *Subtopic A*: Phone Number Auto-Detection — Detect if Sponsor Target URL is a 10-digit Indian phone number, `+91`, `0`-prefix, or `wa.me` link.
  - [x] *Subtopic B*: Dynamic WhatsApp Deep Link — Auto-generate `https://wa.me/91XXXXXXXXXX?text=...` with pre-filled enquiry message including sponsor name and PublicSpark attribution.
  - [x] *Subtopic C*: In-App One-Touch Opening & Reader Badge — Subtle `WhatsApp Connect` pill on banner in `PartnerUnit.jsx`, 1-tap direct chat launch, and preserved click telemetry.
  - [x] *Subtopic D*: Admin Live Phone Validation & Test Button — Real-time detection badge and 1-click test link in `MonetizationDesk.jsx` (placement form, edit modal, and history table).

- [x] **Task 16.5: Real-Time Auto-Switch Timer (Zero-Reload Live Transition)** `Completed`
  - [x] *Subtopic A*: Precision Sleep Timers — Browser `setTimeout` executing at exact `startsAt` and `expiresAt` timestamps.
  - [x] *Subtopic B*: Zero Layout Shift (CLS) Fade Transition — Smooth CSS crossfade (`opacity: 1 -> 0 -> 1` over 300ms) preventing reader text jump.
  - [x] *Subtopic C*: Tab Wakeup Synchronization — `document.visibilitychange` & `window.focus` listeners to auto-sync when reader unlocks phone or returns to tab.
  - [x] *Subtopic D*: Backend Predictive Timestamps — Enhanced `/api/ads/active` with `nextStartsAt` and `expiresAt` across all slots.

- [x] **Task 16.6: Poster Aspect Ratio Lock & Dimension Guard** `Completed`
  - [x] *Subtopic A*: CSS Max-Height Clamps — Enforce maximum vertical bounds per slot (Header: 100px desktop / 110px mobile, In-Article: 280px, Sidebar: 600px desktop / 300px mobile, Home Feed: 120px desktop / 110px mobile, Footer: 100px desktop / 80px mobile, Mobile Sticky: 60px).
  - [x] *Subtopic B*: Object-Fit Contain & Clean Letterboxing — Clean paper letterboxing ensuring vertical/irregular posters never stretch, deform, or expand beyond slot bounds.
  - [x] *Subtopic C*: Recommended Dimension Badges & Ratio Indicators — High-contrast industry badges in placement accordion, re-run clone modal, and edit campaign modal.

---

###  Module 2: Enterprise Editorial & Newsroom Operations

- [x] **Task 20: Article Future Publishing Timer (Auto-Publish Later)** `Completed`
  - [x] *Subtopic A*: Future Date-Time Scheduler Input in Story Editor Modal.
  - [x] *Subtopic B*: Server Clock Cron / Evaluator flipping `scheduled` to `published`.
  - [x] *Subtopic C*: Admin Filter & Badges: "Scheduled Stories" view with live countdown timer.
  - [x] *Subtopic D*: Editorial RBAC Gate: Reporters restricted to drafts; only Editors and Admins can publish live or schedule.

- [x] **Task 21: Article Revision History & 1-Click Rollback Desk** `Completed`
  - [x] *Subtopic A*: Snapshot on Save — Store timestamped versions in `server/data/article_revisions.json`.
  - [x] *Subtopic B*: Visual Side-by-Side Diff Viewer (Old vs New).
  - [x] *Subtopic C*: 1-Click Restore / Rollback to any past version.

- [x] **Task 22: Centralized Digital Asset & Photo Media Library Desk** `Completed`
  - [x] *Subtopic A*: Dedicated "Media Library" tab indexing all files in `server/data/uploads/`.
  - [x] *Subtopic B*: Keyword search, caption/credit management, and file size statistics.
  - [x] *Subtopic C*: 1-Click "Insert into Story" without re-uploading files.

- [x] **Task 23: Live Breaking News Live-Blog / Minute-by-Minute Timeline Mode** `Completed`
  - [x] *Subtopic A*: Toggle "Live Blog Mode" for elections, cricket, and budget events.
  - [x] *Subtopic B*: Fast micro-update editor posting timestamped bullets without full page reload.

---

###  Module 3: Reader Engagement, Traffic Virality & Indian Compliance

- [x] **Task 24: WhatsApp Smart Formatted Share Card** `Completed`
  - [x] *Subtopic A*: Custom message builder: Headline + 3 Key Bullet Points + Clean Link.
  - [x] *Subtopic B*: 1-Tap WhatsApp Web / App share button.

- [x] **Task 25: Fact-Check & Source Credibility Box** `Completed`
  - [x] *Subtopic A*: Editorial verification badge inside investigative stories. `Completed`
  - [x] *Subtopic B*: Official source and government gazette link citations. `Completed`

- [x] **Task 26: In-Article Smart Related Stories ("Ye Bhi Padhein")** `Completed`
  - [x] *Subtopic A*: Category-matched recommendation algorithm. `Completed`
  - [x] *Subtopic B*: Mid-article and end-of-article broadsheet related cards. `Completed`

- [x] **Task 27: Hairline Reading Progress Bar & "X Min Read" Badge** `Completed`
  - [x] *Subtopic A*: Top broadsheet scroll indicator line (`scrollProgress %`). `Completed`
  - [x] *Subtopic B*: Calculated reading duration badge. `Completed`

- [x] **Task 28: Saved Stories / Bookmark (Offline Reading Mode)** `Completed`
  - [x] *Subtopic A*: Offline storage of bookmarked stories via `localStorage`. `Completed`
  - [x] *Subtopic B*: Dedicated "Saved Stories" reading drawer. `Completed`

- [x] **Super-Strict Critic UI/UX & Architecture Audit Fixes** `Completed`
  - [x] *Fix 1*: AI-slop masthead gradient text-clipping removed; restored solid obsidian broadsheet letterpress ink.
  - [x] *Fix 2*: Mobile navigation touch targets upgraded to 40px–44px standard with 8px adjacent spacing in `Header.jsx`.
  - [x] *Fix 3*: Synchronized all 5 reading duration card calculations in `App.jsx` with `calculateReadingTime`.
  - [x] *Fix 4*: Replaced 14px mobile bubble radius on hero card with 4px broadsheet token (`--radius-bento`).
  - [x] *Fix 5*: Purged all 184 lines of dead Vite starter boilerplate CSS from `src/App.css`.
  - [x] *Fix 6*: Enforced `font-variant-numeric: tabular-nums` on metadata counters and eliminated subpixel hover jitter.
  - [x] *Fix 7*: Replaced hardcoded Devanagari translation banner with smooth opacity transition in `ArticleReader.jsx`.

- [x] **Task 29: Statutory Grievance Redressal / Complaint Form (IT Rules 2021 India)** `Completed`
  - [x] *Subtopic A*: Reader complaint submission modal with category & grievance officer routing. `Completed`
  - [x] *Subtopic B*: Admin Grievance Review Desk with resolution tracking. `Completed`

- [x] **Task 30: Google News Specialized XML Feed (`news-sitemap.xml`) & RSS 2.0** `Completed`
  - [x] *Subtopic A*: Google News `<news:news>` XML specification generator. `Completed`
  - [x] *Subtopic B*: Standard RSS 2.0 automated syndication feed. `Completed`

- [x] **Task 32: Dynamic Multi-Lingual Master Article Resolution via Mandatory `originalLanguage`** `Completed`
  - [x] *Subtopic A*: Backend resolution to read `article.originalLanguage` from database and dynamically use it as Gemini's translation pivot instead of static Hindi fallback. `Completed`

- [x] **Task 33: Multilingual Translation Pipeline Overhaul & Bug Resolution Suite** `Completed`
  - [x] *Subtopic A*: Pure master article state resolution in `App.jsx` (`handleSelectArticle`) preventing card headline translation pollution from spilling into reader. `Completed`
  - [x] *Subtopic B*: Backend automatic summary-to-highlights bridge & `summary`/`sub_title` translation in `server/server.js` ensuring 30s bullets are translated. `Completed`
  - [x] *Subtopic C*: LocalStorage translation cache strict integrity validator in `src/services/translationService.js` purging false-positive Hindi fallbacks. `Completed`
  - [x] *Subtopic D*: Sovereign broadsheet skeleton shimmer loading state in `ArticleReader.jsx` during translation fetch. `Completed`

---

###  Module 4: Newsroom Access & Cybersecurity Suite (Final Dedicated Phase)

- [x] **Task 17: Multi-Role Newsroom Login & RBAC (Email + Password + 5-Min OTP Architecture)** `Completed`
  - [x] *Subtopic 17.1*: Backend Staff Store, Email/Password Auth, 5-Min OTP & Reset Architecture. `Completed`
  - [x] *Subtopic 17.2*: BBC-Grade Clean Header & Discrete `/staff` & `/login` Page (with Footer Staff Link & 12/12 Critic Fixes). `Completed`
  - [x] *Subtopic 17.3*: Reporter Story Isolation & Byline Auto-Attribution. `Completed`
  - [x] *Subtopic 17.4*: Admin "Newsroom Staff Desk" (Approval, Reset Password, Role Grant & High-Privilege Promotion Guard). `Completed`
  - [x] *Subtopic 17.5*: Super Admin Google Authenticator 2FA (RFC 6238 TOTP) with QR Pairing, 10 Emergency Recovery Codes & Zero-Attack-Surface Architecture. `Completed`
  - [x] *Subtopic 17.6*: Master Passphrase (`4552768`) Terminal Recovery CLI & Cloudflare D1 Lockdown. `Completed`

- [x] **Task 18: Backend API Hardening & Pre-Deployment Tamper Protection** `Completed`
  - [x] *Subtopic 18.1*: Server-Side Byline Binding & Reporter Impersonation Guard (SEC-003). `Completed`
  - [x] *Subtopic 18.2*: Server-Side Session Logout Revocation (SEC-007) & Admin Settings/Ads Guard. `Completed`
  - [x] *Subtopic 18.3*: Sliding-Window IP Rate Limiter (SEC-004), X-Forwarded-For Guard (SEC-008) & Restrictive CORS Hardening (SEC-005). `Completed`

- [x] **Task 19: 1-Click Complete Database & Media Auto-Backup Desk** `Completed`
  - [x] *Subtopic 19.1*: Backend Zip Archiver Engine & Gmail Dispatch REST API (`/api/admin/backup/create`, `/api/admin/backups`, `/api/admin/backup/download/:filename`, `/api/admin/backup/email-dispatch`, `/api/admin/backup/delete`). `Completed`
  - [x] *Subtopic 19.2*: Admin Workspace Backup Desk UI & 1-Click Browser Download (Metrics cards, history table, manual trigger, target email input). `Completed`
  - [x] *Subtopic 19.3*: Automated Nightly 2:00 AM Cron & 1-Command Restore Engine (`server/cli/restore-backup.js`). `Completed`
  - [x] *UI Polish (Boss Directive)*: Sovereign Newsroom Staff Portal Full-Screen Transformation (`StaffLoginModal.jsx` converted from small centered popup modal into a dedicated full-screen sovereign broadsheet gateway with desktop 2-column briefing, mobile responsive focus, and ESC/Exit controls). `Completed`

- [x] **Task 34: Sovereign Developer God-Mode & Emergency Rescue Access (Stealth Portal)** `Completed`
  - [x] *Subtopic A*: Backend Sovereign Developer Account (Developer Gmail, salted scrypt 30-char random password, dedicated Google Authenticator 2FA). `Completed`
  - [x] *Subtopic B*: Total Stealth Shield (Account 100% hidden in staff directory API and frontend desk; zero visibility to regular staff). `Completed`
  - [x] *Subtopic C*: Discrete Developer Emergency Access Gateway (Hidden URL/secret trigger route for Boss's maintenance & recovery). `Completed`

- [x] **Task 35: Mock Data & Dummy Placeholder Complete Production Purge (Rule 6 Compliance)** `Completed`
  - [x] *Subtopic A*: Comprehensive Database & Media Audit (Rule 6 Cataloging). `Completed`
    - Permanently purged dead file `src/services/mockData.js` and replaced all 7 component references with `DEFAULT_NEWSROOM_CATEGORIES`. Audited all 14 database JSON files in `server/data/`, identifying dummy WhatsApp contact (`9999999999`) and prototype poll. Reconciled and updated `learning/production-readiness.md` to 100% production-ready status under Rule 6. Verified via `node -c server/server.js` (0 errors), `npx oxlint` (0 errors), and `npm run build` (0 errors in 392ms).
  - [x] *Subtopic B*: Sovereign Clean Production Reset Tool `Completed`
    - Engineered pure Node.js CLI reset utility (`server/cli/clean-production-reset.js`) executable via `npm run clean-reset`. Automatically generates a pre-reset PKZIP safety backup archive, resets all article view counts and reaction counters to 0 while preserving genuine story copy/sources, purges dummy WhatsApp contact from `settings.json`, initializes `poll.json` with authentic regional green energy launch poll (0 votes), clears `ad_history.json`, and flushes live in-memory server caches. Verified 100% via automated test suite `scratch/test_subtopic_35_b_clean_reset.mjs` (5/5 passed), `node -c server/server.js` (0 errors), `npx oxlint` (0 errors), and `npm run build` (0 errors in 416ms).

- [x] **Task 36: Security Hardening & Vulnerability Remediation Suite (Full Pentest Closure)** `Completed`
  - [x] *Subtopic 1*: P0 Critical Exploits Lockdown (SEC-044 Delimiter Injection, SEC-010 Bulk DB Wipeout, SEC-011 Article Defacement, SEC-013/025 Media RBAC). `Completed`
  - [x] *Subtopic 2*: Data Leaks & Backdoor Isolation (SEC-043 Master Key Removal, SEC-015 Embargo Bypass, SEC-016 Revisions Leak, Clash 2 SPA Client Routes). `Completed`
  - [x] *Subtopic 3*: DoS, Backup Encryption & Security Headers (SEC-018 Request Quota, SEC-028 HTTP Security Headers, SEC-014 Stored JSON-LD XSS Escaping, SEC-021/036 Backup 2FA Redaction & Orphan Cleanup, SEC-037/039 Grievance Engine & Duplicate Categories Pruning). `Completed`
  - [x] *Subtopic 4*: Secondary Vulnerabilities Lockdown & Pentest Closure (SEC-017 Media Upload Gating, SEC-020 Client IP Anti-Spoofing, SEC-023 Live Updates Gating, SEC-024 Categories Overwrite Lockdown, SEC-027 Poll 24h IP Deduplication, SEC-029 Backup Token Query Param Dropped, SEC-030/026 Timing-Safe OTP & Production Masking, SEC-032 Cache Purge Gating, SEC-035 Environment Security Docs). `Completed`
  - [x] *Subtopic 5*: Full Remediation of Vulnerability Report (23 Items) & Problems Directory Audit (17 Checks). `Completed`
    - Deleted dead `server/services/authService.js` and dead `AdsManager.jsx`.
    - Dynamic CSPRNG random fallback for Master Passphrase.
    - Removed obsolete `ADMIN_API_SECRET` fallback constant.
    - Sanitized external RSS headlines with HTML tag stripping.
    - Dynamic `process.env.CLIENT_URL` in OTP emails.
    - Fixed `liveSent` field verification.
    - Purged 404 sponsor banner and test article "Hello".
    - Upgraded `art-1` to live official ISRO Chandrayaan-3 landing video (verified with YouTube oEmbed).
    - Neutralized empty AdSense/sponsor placeholder box in `PartnerUnit.jsx`.
    - Removed duplicate secondary language/theme controls from `Header.jsx`.
    - Corrected brand translation key to `allCategories`.
    - Purged dead news provider `saurav.tech`.
    - Replaced fake multi-cloud numbers with honest local file storage metrics in `/api/storage/status`.
    - Eliminated browser CORS console errors by dropping direct client calls to `translate.google.com/translate_tts`.
    - Updated `index.html` to `<html lang="hi">` with Open Graph tags and homepage masthead semantic `<h1>`.
    - Verified 100% via forensic audit suite `scratch/audit_all_problems.mjs` (17/17 passed), full regression suites Subtopics 1-4 (20/20 passed), `npx oxlint` (0 errors), and `npm run build` (0 errors).

- [x] **Task 37: Cloud Storage Quota Calibration & Dual-Threshold LRU Cleanup Architecture** `Completed`
  - [x] *Subtopic A*: Backend Engine, 80% Alert / 90% LRU Purge & Cascading Cleanup (`server/server.js`). `Completed`
    - Calibrated Audio storage tier to 1 GB (1024 MB, Cloudflare KV zero-card limit) and Master Database to 500 MB (Cloudflare D1 SQL zero-card limit).
    - Engineered dual-threshold storage watchdog in `server/server.js` (`runStorageWatchdogAndCleanup`): 80% Alert threshold (819.2 MB audio / 400 MB D1 / 102.4 MB RAM) raising `warning_80` state; 90% Emergency Purge threshold (921.6 MB audio / 450 MB D1 / 115.2 MB RAM) auto-evicting least recently used audio and stale translations down to 70% post-cleanup target (716.8 MB audio / 350 MB D1 / 89.6 MB RAM).
    - Added `last_accessed_at` in `translations.json` and `last_played_at` in `audio_records.json` with touch helpers on cache hit.
    - Built cascading article deletion engine (`cascadeDeleteArticleData`) wiping associated translations, revisions, audio records, physical files, and RAM cache on `DELETE /api/articles/:id`.
    - Built startup & deep purge orphan sweeper (`purgeOrphanedSatelliteData`) instantly purging 13 ghost translations (dropping `translations.json` from 251.36 KB to 161.12 KB) and 30 ghost revision trees (dropping `article_revisions.json` from 98.52 KB to 29.74 KB).
    - Added LRU bounded cache setter `setBoundedTranslationCache` with hard 500-entry ceiling.
    - Verified via live test suites, syntax check `node -c server/server.js` (0 errors), `npx oxlint` (0 errors), and `npm run build` (0 errors in 976ms).
  - [x] *Subtopic B*: Storage Settings Admin UI & Notification Alert Integration (`StorageSettings.jsx`). `Completed`
    - Integrated dynamic 80% Warning / 90% Emergency Cleanup alert banners and persistent broadsheet policy pill bar.
    - Updated Card 1 (D1 DB) with 80% (400 MB) alert / 90% (450 MB) purge thresholds.
    - Updated Card 3 (Audio Stories Storage) with 1,024 MB (1 GB) Cloudflare KV quota and 80% (819 MB) alert / 90% (921 MB) purge thresholds.
    - Updated Card 4 (Worker RAM) with 80% (102 MB) alert / 90% (115 MB) purge thresholds.
    - Upgraded server purge button to `Deep Purge Server Cache & Dead Records` with rich telemetry feedback.
    - Verified 100% via `npx oxlint` (0 errors) and `npm run build` (0 errors in 1.06s).
  - [x] *Subtopic C*: Automated Verification, Live Proof & Critic Audit. `Completed`
    - Created and executed comprehensive automated Critic verification suite (`scratch/test_subtopic_37_c_audit.mjs`) passing 23/23 assertions (100% pass rate).
    - Validated live API calibration of 1024 MB Audio Tier, 819.2 MB (80%) Alert, 921.6 MB (90%) Purge, 716.8 MB (70%) Target; 500 MB D1 DB Tier, 400 MB (80%) Alert, 450 MB (90%) Purge, 350 MB (70%) Target.
    - Validated live cascading article deletion, LRU bounded cache eviction, and deep storage purge.
    - Cleaned temporary scratch files, verified oxlint (0 errors) and production build (built in 957ms, 0 errors).

- [x] **Task 39: Newsroom Library Architecture: Left-Side Animated Search Drawer & Dynamic Category Shelves Engine** `Completed`
  - [x] *Subtopic A*: Left-Side GPU-Accelerated Animated Search Drawer (`SearchDrawer.jsx`, 60fps cubic-bezier left slide-in, 0ms in-memory instant search, dynamic category quick-pills, Escape key listener, auto-focus, zero lag). `Completed`
    - Created `SearchDrawer.jsx` with GPU-accelerated CSS keyframe `slideInFromLeft` (240ms cubic-bezier transition).
    - 0ms instant search across published stories with zero network latency, keyword match on title/summary/content/author/category.
    - Added category quick-filter pills dynamically mapped from real backend categories.
    - Added backdrop blur overlay, automatic input focus, instant clear button, reading time metadata, empty state, and Escape key dismissal.
    - Wired into `App.jsx` and connected to all 3 search buttons in `Header.jsx`.
    - Verified via `npx oxlint src/` (0 errors) and `npm run build` (built cleanly in 610ms, 0 errors).
  - [x] *Subtopic B*: 100% Dynamic Category Shelves Engine (Homepage bookshelves mapping real categories with published stories, zero hardcoded mock arrays, auto-hide empty shelves). `Completed`
    - Created `CategoryShelvesSection.jsx` organizing stories into structured "Bookshelves" per category.
    - Density-adaptive responsive layouts: Single wide horizontal lead card (1 story), Split lead + stacked side stories (2-3 stories), and multi-column library grid (4+ stories).
    - 100% dynamically mapped from `categories.json` and real published articles; empty categories gracefully auto-hide without broken boxes.
    - Wires 1-click category navigation (`[ इस श्रेणी के सभी समाचार देखें → ]`), audio reading triggers, and reading time badges.
    - Verified via automated test suite `scratch/test_subtopic_39_b_shelves.mjs` (19/19 passed), `npx oxlint src/` (0 errors), and `npm run build` (0 errors in 455ms).
  - [ ] *Subtopic C*: Live Real-Time Weather Engine & Interactive Search Section (Open-Meteo Integration, GPS Location Detection, On-Site City Search, Homepage Weather Card & Header Live Pill). `Deferred`
    - Per Boss's explicit direction ("weather aabhi achha nahi hai, ise baad me kare ge, abhi hata do"), the weather UI has been cleanly unmounted from `App.jsx` and `Header.jsx`.
    - Backend proxy endpoints and service logic remain safely retained in the codebase for future revival whenever Boss decides.
  - [x] *Subtopic D*: Responsive 360px-1440px Verification, Zero-Lag Benchmarks & Cross-Browser Stability. `Completed`
    - Enforced strict Rule 4 mobile 360px-480px responsive rules in `src/index.css`: drawer sheet auto-expands to `100vw`, 44x44px minimum touch targets on close and view-all buttons, 16px input font size preventing iOS Safari auto-zoom, and 36px category filter pills.
    - In `CategoryShelvesSection.jsx`, enforced mobile stacking on `<= 768px` and `<= 480px` (`flex-direction: column`, `grid-template-columns: 1fr`, `min-width: 0` child guards, 44px view-all button).
    - Verified 60fps zero-lag performance: in-memory search filtering runs in **0.079ms** (100 articles) and category shelves grouping runs in **0.251ms** (12 categories).
    - Verified zero emojis across all components (Mistake 46 compliant).
    - Verified via automated audit test suite, `npx oxlint src/` (0 errors), and `npm run build` (built in 847ms, 0 errors).

- [x] **Task 38: BBC-Style Institutional Footer Compliance Strip & Custom Newsroom Identity Integration** `Completed`
  - [x] *Subtopic A*: BBC-Grade Horizontal Legal & Compliance Strip (All 8 Policies in Pure Hindi & Microsoft-Grade Layout). `Completed`
    - Authored 8 statutory compliance documents in pure Hindi in `src/components/common/LegalModal.jsx`:
      1. सेवा की शर्तें (Terms of Use - 8 statutory clauses under IT Act 2000 & IT Rules 2021).
      2. गोपनीयता नीति (Privacy Policy - Google AdSense DART cookies, Opt-Out link, DPDP Act 2023, Zero Data Sale Guarantee).
      3. डेटा नियंत्रण व कुकी प्राथमिकताएं (Do Not Sell My Info - Local storage transparency and interactive 1-click Clear Local Storage button).
      4. डिजिटल सुलभता कथन व पाठक सहायता (Accessibility Statement - AI Neural Audio Storytelling, Font Scaler A-/A/A+, High Contrast, WCAG 2.2 AA).
      5. हमारे साथ विज्ञापन दें (Advertise With Us - 6 slots, transparent impression/click metrics, ethical guidelines, WhatsApp and email connect).
      6. संपादकीय आचार संहिता व तथ्य-जांच (Editorial Ethics & Fact-Checking - mandatory RTI/gazette cross-check for anti-corruption stories, Right of Reply, corrections policy).
      7. वैधानिक शिकायत निवारण अधिकारी (Statutory Grievance Redressal - IT Rules 2021 Level-I, Shri Rajesh Sharma details, 24h ack, 15d disposal, digital grievance form trigger).
      8. बाहरी लिंक्स व सुरक्षित आश्रय अस्वीकरण (External Linking Safe Harbor under Section 79 of IT Act 2000).
    - Replaced all email addresses strictly with official `publicspark.in@gmail.com`.
    - Engineered Microsoft Senior Developer style single-column centered document reader (`max-width: 800px`) with 60px sticky topbar, logo, ESC key listener, and bottom policy switcher.
    - Updated `src/App.jsx` footer description with Boss's official WhatsApp channel mission statement.
    - Embedded BBC-style institutional horizontal compliance strip in `src/App.jsx` footer with minimum 44x44px touch targets.
    - Verified via `npx oxlint src/` (0 errors) and `npm run build` (built in 708ms, 0 errors).
  - [x] *Subtopic B*: Integration of Boss's Old Site Content & Editorial Disclaimers (Regional disclaimers, specialized desk notes). `Completed`
    - Added `.footer-editorial-disclaimer` strip in `src/App.jsx` and `src/index.css` covering RTI/fact-based anti-corruption reporting, expert opinion disclaimers for astrology/dharma/tourism, BBC-style External Linking Safe Harbor notice with clickable policy trigger, and official `publicspark.in@gmail.com` + IT Rules 2021 Grievance Redressal link. Verified with `npx oxlint src/` (0 errors) and `npm run build` (958ms).
  - [x] *Subtopic C*: Responsive 360px Mobile-to-Desktop Layout & Accessibility Verification. `Completed`
    - Hardened footer responsiveness for 360px viewports (`min-width: 0` grid guards, 44x44px touch targets on social icons & staff login, `.footer-nav-link` 36px+ buttons, `@media (max-width: 480px)` clean wrapping and `overflow-wrap: anywhere`). Verified with `npx oxlint src/` (0 errors) and `npm run build` (836ms).

- [x] **Task 41: Production Security Hardening & Vulnerability Remediation (Closure of Critic Audit Findings 1–7)** `Completed`
  - In accordance with Boss's mandate, resolved all 7 forensic security vulnerabilities identified during the Super-Strict Critic Security Audit:
    1. Disabled automatic seeding of hardcoded default staff credentials (`Admin@2026`) in production (`staffAuthService.js`, CWE-798).
    2. Injected strict `Content-Security-Policy` (CSP), `Permissions-Policy`, and production `Strict-Transport-Security` (HSTS) headers (`server.js`, CWE-693).
    3. Gated image uploads with strict extension whitelist (`webp`, `jpg`, `png`) and binary header magic bytes validation for PNG, JPG, and WebP (`server.js`, CWE-434).
    4. Upgraded `vite` (v8.3.8) and `source-map-js` (v1.2.1) achieving 0 vulnerabilities on `npm audit` (CWE-1284, CWE-77).
    5. Enforced CSRF Origin/Referer gatekeeper blocking untrusted cross-origin mutating requests with HTTP 403 (`server.js`, CWE-352).
    6. Applied bounded 5,000-entry FIFO rolling cap on `serverAudioProgressMap` preventing memory leak DoS (`server.js`, CWE-400).
    7. Added explicit directory boundary assertion `assetPath.startsWith(DIST_DIR + path.sep)` on `/assets/` streaming (`server.js`, CWE-22).
  - Verified 100% via automated test suite `scratch/test_security_patches.mjs` (5/5 tests passed), syntax checks, `npx oxlint src/` (0 errors), and `npm run build` (built in 1.15s, 0 errors). Backend server daemon restarted and confirmed active on port 5000.

- [x] **Task 42: Cloudflare Pages Sovereign Edge Frontend Live Deployment** `Completed`
  - Successfully connected GitHub repository `harshdada2018-png/pintu-chachu-news-web` to Cloudflare Pages edge hosting.
  - Configured Vite build preset (`npm run build`, output `/dist`, `NODE_VERSION: 20`).
  - Automatically pushed `public/_redirects` (`/* /index.html 200`) ensuring zero 404 errors on deep linking and hard refreshes.
  - Verified live deployment at `https://pintu-chachu-news-web.pages.dev`: HTTP 200 OK, SSL active, Mumbai (BOM) edge node delivery, verified bundle JS/CSS streaming, and SPA routing confirmed.

- [x] **Task 40.3: Sovereign Full-Mechanism Audio Player & Gemini Neural TTS Overhaul** `Completed`
  - Overhauled `TextToSpeech.jsx` & `geminiAudioEngine.js` (fixed button click bubbling, silent WAV primer race condition, `resumeTwoStageAudio` state validation, duplicate fallback guard, 2-color `--accent-crimson` tokens, and 36px+ touch targets). Verified via `npx oxlint src/` (0 errors) and `npm run build` (831ms).

- [x] **Task 43: Sovereign Anonymous Whistleblower & Confidential News Tip Desk ("गुप्त सूचना केंद्र")** `Completed`
  - [x] *Subtopic A*: Zero-Trace Backend Storage & Tip Submission API (zero IP/device logging, tracking ID generator, RBAC admin triage API). `Completed`
    - Implemented `confidential_tips.json` store and 5 REST endpoints (`/api/tips/submit`, `/api/tips/status/:trackingId`, `/api/admin/tips`, `/api/admin/tips/update`, `/api/admin/tips/delete`) in `server/server.js`. Verified 5/5 live HTTP tests + syntax check.
  - [x] *Subtopic B*: Public Confidential Tip Form & Anonymity Assurance UI (`ConfidentialTipModal.jsx`, tracking receipt & status check). `Completed`
    - Built `ConfidentialTipModal.jsx` and wired Footer triggers in `App.jsx` with 2-color broadsheet UI, 8,000-char detailed report form, Tracking ID receipt & status lookup, and locked `/api/admin/tips*` strictly to Admin-only (`requireAdminAuth`). Verified with `oxlint` (0 errors) and `npm run build` (1.21s).
  - [x] *Subtopic C*: Admin-Only Investigation Desk & 1-Click Draft Conversion (`ConfidentialTipsDesk.jsx`, `AdminWorkspace.jsx`, 360px responsive verification). `Completed`
    - Built `ConfidentialTipsDesk.jsx` and wired into `AdminWorkspace.jsx` strictly for `admin` & `developer` roles (`403` for Editor/Reporter). Verified 5/5 live RBAC tests, `oxlint` (0 errors), and `npm run build` (711ms).

- [/] **Task 44: Cloudflare D1 + Pages Functions Edge Backend, Audio Cache & Email OTP Deployment** `In Progress`
  - **Done so far**:
    - `cloudflare/schema.sql` created with 5 tables (`articles`, `categories`, `translations`, `kv_store`, `audio_cache` + `idx_audio_cache_created`). First 4 tables + clean `scratch/d1_seed.sql` executed by Boss in D1 Console.
    - `functions/api/[[path]].js` created and verified (`node -c` exit code 0) with core Edge routes, separate `GEMINI_API_KEY` (Translation) & `GEMINI_TTS_API_KEY` (TTS), `429` immediate fallback guards, and D1 chunk-safe 14-day `audio_cache` + 7-day immutable browser cache headers.
    - Boss started adding Cloudflare Secrets (`GEMINI_API_KEY`, `GEMINI_TTS_API_KEY`, `IMGBB_API_KEY` added; `STAFF_AUTH_SECRET` Line 10 ready to save).
  - **Paused / Next Session Resume**:
    - Execute `audio_cache` SQL in Cloudflare D1 Console (`publicspark-db`).
    - Finish saving `STAFF_AUTH_SECRET` (`.env` Line 10), create free Brevo account (`brevo.com`) & add `BREVO_API_KEY` + `SENDER_EMAIL`, bind `DB -> publicspark-db`, enable `nodejs_compat`.
    - Wire Brevo HTTP Email OTP + remaining Edge routes in `functions/api/[[path]].js`, then commit & push via GitHub Desktop and verify live.






