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

---

## Section 2: In-Progress Tasks (Jin Par Kaam Chal Raha Hai)

- **Currently In Progress**: **Task 27 - Hairline Reading Progress Bar & "X Min Read" Badge** (Subtopic A Completed & Verified; Subtopic B Planned for after approval).
- **Next Task in Queue**: Task 27 - Subtopic B: Calculated reading duration badge.

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

- [ ] **Task 21: Article Revision History & 1-Click Rollback Desk**
  - *Subtopic A*: Snapshot on Save — Store timestamped versions in `server/data/article_revisions.json`.
  - *Subtopic B*: Visual Side-by-Side Diff Viewer (Old vs New).
  - *Subtopic C*: 1-Click Restore / Rollback to any past version.

- [ ] **Task 22: Centralized Digital Asset & Photo Media Library Desk**
  - *Subtopic A*: Dedicated "Media Library" tab indexing all files in `server/data/uploads/`.
  - *Subtopic B*: Keyword search, caption/credit management, and file size statistics.
  - *Subtopic C*: 1-Click "Insert into Story" without re-uploading files.

- [ ] **Task 23: Live Breaking News Live-Blog / Minute-by-Minute Timeline Mode**
  - *Subtopic A*: Toggle "Live Blog Mode" for elections, cricket, and budget events.
  - *Subtopic B*: Fast micro-update editor posting timestamped bullets without full page reload.

---

###  Module 3: Reader Engagement, Traffic Virality & Indian Compliance

- [ ] **Task 24: WhatsApp Smart Formatted Share Card**
  - *Subtopic A*: Custom message builder: Headline + 3 Key Bullet Points + Clean Link.
  - *Subtopic B*: 1-Tap WhatsApp Web / App share button.

- [x] **Task 25: Fact-Check & Source Credibility Box** `Completed`
  - [x] *Subtopic A*: Editorial verification badge inside investigative stories. `Completed`
  - [x] *Subtopic B*: Official source and government gazette link citations. `Completed`

- [x] **Task 26: In-Article Smart Related Stories ("Ye Bhi Padhein")** `Completed`
  - [x] *Subtopic A*: Category-matched recommendation algorithm. `Completed`
  - [x] *Subtopic B*: Mid-article and end-of-article broadsheet related cards. `Completed`

- [/] **Task 27: Hairline Reading Progress Bar & "X Min Read" Badge** `In Progress`
  - [x] *Subtopic A*: Top broadsheet scroll indicator line (`scrollProgress %`). `Completed`
  - [ ] *Subtopic B*: Calculated reading duration badge. `Planned`

- [ ] **Task 28: Saved Stories / Bookmark (Offline Reading Mode)**
  - *Subtopic A*: Offline storage of bookmarked stories via `localStorage`.
  - *Subtopic B*: Dedicated "Saved Stories" reading drawer.

- [ ] **Task 29: Statutory Grievance Redressal / Complaint Form (IT Rules 2021 India)**
  - *Subtopic A*: Reader complaint submission modal with category & grievance officer routing.
  - *Subtopic B*: Admin Grievance Review Desk with resolution tracking.

- [ ] **Task 30: Google News Specialized XML Feed (`news-sitemap.xml`) & RSS 2.0**
  - *Subtopic A*: Google News `<news:news>` XML specification generator.
  - *Subtopic B*: Standard RSS 2.0 automated syndication feed.

- [ ] **Task 32: Dynamic Multi-Lingual Master Article Resolution via Mandatory `originalLanguage`**
  - *Subtopic A*: Backend resolution to read `article.originalLanguage` from database and dynamically use it as Gemini's translation pivot instead of static Hindi fallback.

- [ ] **Task 33: Multilingual Translation Pipeline Overhaul & Bug Resolution Suite**
  - *Subtopic A*: Pure master article state resolution in `App.jsx` (`handleSelectArticle`) preventing card headline translation pollution from spilling into reader.
  - *Subtopic B*: Backend automatic summary-to-highlights bridge & `summary`/`sub_title` translation in `server/server.js` ensuring 30s bullets are translated.
  - *Subtopic C*: LocalStorage translation cache strict integrity validator in `src/services/translationService.js` purging false-positive Hindi fallbacks.
  - *Subtopic D*: Sovereign broadsheet skeleton shimmer loading state in `ArticleReader.jsx` during translation fetch.

---

###  Module 4: Newsroom Access & Cybersecurity Suite (Final Dedicated Phase)

- [ ] **Task 17: Multi-Role Newsroom Login & PIN Security (RBAC)**
  - *Subtopic A*: 3 Distinct Roles (Reporter, Editor, Admin) with granular permissions.
  - *Subtopic B*: Secure 6-digit PIN login with memory-hard hashing (`scrypt`).
  - *Subtopic C*: HttpOnly secure session cookies.

- [ ] **Task 18: Backend API Hardening & Tamper Protection**
  - *Subtopic A*: Public route rate limiting & anti-DDoS IP throttling.
  - *Subtopic B*: Authentication token protection on `/api/settings/*`, `/api/articles/*`, and `/api/ads/*`.

- [ ] **Task 19: 1-Click Complete Database & Media Auto-Backup Desk**
  - *Subtopic A*: Admin backup generator creating `.zip` archive of database files and media uploads.
  - *Subtopic B*: 1-Click download and restore verification.
