# PublicSpark Master Project Checklist (CHECKLIST.md)

> **Document Type**: Master Project Checklist (Governed by Rule 10 & Skill `master-checklist`)  
> **Platform**: PublicSpark (पब्लिकस्पार्क) — Multilingual Sovereign Newsroom Engine  
> **Build Verification**: `v1.0.0-verified` (`npm run build` = 0 errors, `npm run lint` = 0 errors)  
> **Active Status Protocol**: Only ONE item `In Progress` at any time. Every completed task must record a verified outcome.

---

## Status Summary

- **Currently In Progress**: Task 28: Saved Stories / Bookmark (Offline Reading Mode) — Subtopic A Completed & Verified; Subtopic B awaiting Boss approval.
- **Completed Quality Audit**: Super-Strict Critic UI/UX & Architecture Audit (7/7 defects resolved and verified: solid obsidian masthead ink, 40px-44px touch targets with 8px gap, unified `calculateReadingTime`, 4px broadsheet hero radius, `App.css` dead code purged, tabular numerics, smooth translation opacity).
- **Current Blockers / Dependencies**: None.
- **Reference Architecture Docs**: `project-planning/HOSTING_PLAN.md` (Cloudflare Pages + Workers + D1 Blueprint & Future VPS Roadmap).
- **Next Step**: Awaiting Boss approval to start Task 28 Subtopic B (Dedicated "Saved Stories" reading drawer).

---

##  Module 1: Complete In-House Ads & Monetization Suite

- [x] **Task 3: Backend Ad Decision Engine & Admin Order Scheduler** `Completed`
  - *Outcome*: Server evaluates start/end date-time, scope targeting (Global, Category, Article), and waterfall fallback to Google AdSense. Verified with live Node tests.
- [x] **Task 4: Ad Scope, Campaign Dates & Auto-Expiry Rules Suite** `Completed`
  - *Outcome*: 1-click Scope selector (Global vs Category vs Single Article), exclusion list, `datetime-local` inputs, and auto-updating `/ads.txt`.
- [x] **Task 5: Monetization Desk 6-Slot Expansion & Mobile Calibration** `Completed`
  - *Outcome*: 6 slots (Header, In-Article, Sidebar, Home Feed, Footer, Mobile Sticky Banner). Zero horizontal overflow on 360px-390px screens.
- [x] **Task 8: Google AdSense Mandatory Legal Suite (5 Policies)** `Completed`
  - *Outcome*: `LegalModal.jsx` with Privacy Policy (DART cookie disclosures), Terms, About Us, Contact Us (with Grievance Redressal Officer), and Fact-Check Policy.
- [x] **Task 16: Smart Searchable Article Picker in Ad Desk** `Completed`
  - *Outcome*: Dynamic category division filter pills auto-synced with `/api/categories`, live keyword search input with instant matching, selected article preview card. Verified via `npm run build` (0 errors).
- [x] **Task 16.1: Dynamic In-Place Editable & Backend-Persisted Category Suite** `Completed`
  - *Outcome*: Built backend `GET /api/categories` & `POST /api/categories` with persistent `server/data/categories.json`, inline Edit Category mode (`<Edit3 />`, `<Check />`, `<X />`), auto-slug derivation, duplicate validation, and article count safety checks. Verified with live API roundtrips and clean build.
- [x] **Task 16.2: Ad Campaign History & Archive Engine (with 1-Click Re-Run & In-Place Editing)** `Completed`
  - [x] *Subtopic A*: Backend Persistence & REST API — `server/data/ad_history.json`, `GET /api/ads/history`, and `POST /api/ads/history/delete`.
  - [x] *Subtopic B*: Automatic Campaign Snapshots — Auto-captures snapshot on ad save across all 6 slots with deduplication.
  - [x] *Subtopic C*: History Desk Interface — Dedicated broadsheet history table & cards inside `MonetizationDesk.jsx` showing Banner Thumbnail, Sponsor Name, Slot, Date Range, and Status Badges.
  - [x] *Subtopic D*: 1-Click "Re-Run / Clone" Action — Modal to instantly re-populate and activate past campaigns in any slot with 24h, 7d, 30d presets.
  - [x] *Subtopic E*: Zero-Waste Storage & Instant Expiry Purge — Automatic disk and DB record cleanup for expired media.
  - [x] *Subtopic F*: Placement Form Auto-Clear & Live Slot Notice — Slot inputs clear safely with `[  Clear Form / New Ad ]` while maintaining runtime ad delivery.
  - [x] *Subtopic G*: In-Place Campaign Editing (`POST /api/ads/history/update`) — Edit Modal allowing instant corrections for sponsor links, phone numbers, replacement banners, and schedule dates.
- [x] **Task 16.3: Direct Sponsor Impressions & Click Tracker (In-House Ad Analytics)** `Completed`
  - [x] *Subtopic A*: Server-Side Tracking Gateway — `POST /api/ads/track/impression` and `POST /api/ads/track/click` with IP sliding window de-duplication (30 min cooldown for views, 5 min for clicks) and JSON persistence.
  - [x] *Subtopic B*: Client-Side Visibility & Click Telemetry — `IntersectionObserver` in `PartnerUnit.jsx` verifying real human reading (>50% visibility for >500ms) and `keepalive: true` / `navigator.sendBeacon` click recording.
  - [x] *Subtopic C*: Live Metrics Badges & 6 KPI Counters — Real-time counters inside `MonetizationDesk.jsx` showing Total Views, Total Clicks, and Average CTR %, plus live badges on every active campaign card.
  - [x] *Subtopic D*: Local Advertiser "Client Proof" Summary Card Modal — Professional verification modal with official shield badge, big KPI cards, 1-click WhatsApp copy text generator, and direct WhatsApp sharing link for advertisers.
- [x] **Task 16.4: 1-Tap WhatsApp Sponsor Connect (Local Advertiser Mode)** `Completed`
  - *Outcome*: Dual-layer Indian phone auto-detection (10 digits, +91, 0-prefix, wa.me) with dynamic `https://wa.me/91XXXXXXXXXX?text=...` deep link embedding custom enquiry message. Added subtle broadsheet `WhatsApp Connect` pill badge on reader banners in `PartnerUnit.jsx`, real-time visual detection badge with 1-click `[Test Link ↗]` in `MonetizationDesk.jsx` (placement form, edit modal, and history table), preserving click telemetry. Verified with unit tests (`scratch/test_whatsapp_connect.cjs`), `npm run build` (502ms), and `npm run lint` (0 errors).
- [x] **Task 16.5: Real-Time Auto-Switch Timer (Zero-Reload Live Transition)** `Completed`
  - *Outcome*: Implemented precision sleep timers (`setTimeout`) executing at exact `startsAt` and `expiresAt` timestamps. Added zero layout shift (CLS) crossfade (`opacity: 1 -> 0 -> 1` over 300ms) and predictive timestamps (`nextStartsAt`, `expiresAt`) in `/api/ads/active`. Integrated `document.visibilitychange` and `window.focus` listeners for instant synchronization when readers unlock mobile phones or return to tabs. Verified with automated tests, `npm run build` (554ms), and `npm run lint` (0 errors).
  - [x] *Subtopic A*: Precision Sleep Timers — Client-side exact-millisecond `setTimeout` scheduled for `startsAt` and `expiresAt` timestamps.
  - [x] *Subtopic B*: Zero Layout Shift (CLS) Fade Transition — CSS opacity crossfade (`opacity: 1 -> 0 -> 1`) preventing reader text jump when campaigns activate or expire.
 

---

##  Module 2: Enterprise Editorial & Newsroom Operations

- [x] **Task 1: Gemini Multilingual AI Translation Engine** `Completed`
  - *Outcome*: 19 languages supported with 0ms cache hits, rate limit protection, and Hindi base language auto-detection.
- [x] **Task 2: 2-Stage Neural AI Audio Storytelling ("Listen to Story")** `Completed`
  - *Outcome*: Headline -> Chime cue -> Full Story Body. Output converted to 32kbps mono MP3 via pure JS (`@breezystack/lamejs`) with HTTP 206 byte-range streaming.
- [x] **Task 12: Writer Desk Auto-Save Protection, WebP Image Uploads & Minimalist Language Selector** `Completed`
  - *Outcome & Verification Proof*: `localStorage` draft recovery (`ps_reporter_draft_v1`), mandatory source language gate with sleek single-line `<select>` dropdown box (eliminating 500px vertical mobile clutter), and client-side WebP compression to `server/data/uploads/`. Verified via `npm run build` (541ms) and `npm run lint` (0 errors).
- [x] **Task 20: Article Future Publishing Timer (Auto-Publish Later)** `Completed`
  - *Outcome*: Built dual-layer auto-publish engine in `server/server.js` (20-second active background cron + on-demand evaluation on article fetch), public reader embargo shield (API + SSR), StoryEditorModal scheduler UI with `datetime-local` picker, scheduled stories filter desk with 1-click 'Publish Now' action, and strict Editorial RBAC gate (reporters locked to drafts; only editors and admins can publish live or schedule future publication). Verified with automated unit tests (`test_scheduled_publishing.mjs`), `npm run build` (640ms), and `npm run lint` (0 errors).
  - [x] *Subtopic A*: Future Date-Time Scheduler Input in Story Editor Modal.
  - [x] *Subtopic B*: Server Clock Cron / Evaluator flipping `scheduled` to `published`.
  - [x] *Subtopic C*: Admin Filter & Badges: "Scheduled Stories" view with live countdown timer.
  - [x] *Subtopic D*: Editorial RBAC Gate: Reporters restricted to drafts; only Editors and Admins can publish live or schedule.
- [x] **Task 21: Article Revision History & 1-Click Rollback Desk** `Completed`
  - *Outcome*: Built persistent storage in `server/data/article_revisions.json` storing `{ [articleId]: [ RevisionObject, ... ] }`, automatic baseline & update snapshots, zero-waste 30-revision capping, `ArticleRevisionModal.jsx` timeline & diff inspector, 1-click rollback restoring live article with audit log, and strict Editorial RBAC (reporters view-only). Verified via unit tests (`test_revision_rollback.mjs`), `npm run build` (769ms), and `npm run lint` (0 errors).
  - [x] *Subtopic A*: Snapshot on Save — Store timestamped versions in `server/data/article_revisions.json`.
  - [x] *Subtopic B*: Visual Side-by-Side Diff Viewer (Old vs New).
  - [x] *Subtopic C*: 1-Click Restore / Rollback to any past version.
- [x] **Task 22: Centralized Digital Asset & Photo Media Library Desk** `Completed`
  - [x] *Subtopic A*: Dedicated "Media Library" tab indexing all files in `server/data/uploads/`.
    - *Outcome*: Built backend indexer `syncAndIndexMediaAssets()` in `server/server.js`, persistent `server/data/media_library.json`, REST endpoints `GET /api/media`, `POST /api/upload/image`, `POST /api/media/delete` (with active story safety guard), and frontend `MediaLibraryDesk.jsx` integrated into `AdminWorkspace.jsx` with broadsheet metrics cards, search/filter/sort, thumbnail lightbox inspector, and 1-click URL copy.
  - [x] *Subtopic B*: Keyword search, caption/credit management, and file size statistics.
    - *Outcome*: Built multi-field search engine matching captions, agency credits, alt-text, and story categories. Added 8 agency presets (`PTI`, `Reuters`, `ANI`, `PIB`, `Staff`, etc.), missing-credit indicator badges and filter, detailed dimension & storage stats (avg size, % of 5GB Cloudflare free tier), and strict multi-tier Editorial RBAC (reporters can browse/upload; editors can edit metadata & delete unused; admins can force-delete in-use). Verified with 6 unit tests (`test_subtopic_b.mjs`) and clean build.
  - [x] *Subtopic C*: 1-Click "Insert into Story" without re-uploading files.
    - *Outcome*: Integrated 1-click Media Library picker modal in both `StoryEditorModal` (Admin Workspace) and `ReporterWorkspace` (Field Reporter Desk). Automatically populates `featured_image` / `imagePreview`, `image_caption`, and `media_credits` without re-uploading or duplicating disk assets. Added preview removal button and verified via automated tests (`test_subtopic_c.mjs`), `npm run build` (489ms), and `npm run lint` (0 errors).
- [x] **Task 23: Live Breaking News Live-Blog / Minute-by-Minute Timeline Mode** `Completed`
  - [x] *Subtopic A*: Toggle "Live Blog Mode" for elections, cricket, and budget events. `Completed`
    - *Outcome & Verification Proof*: Built article presentation format switcher (`standard`, `live`, `video`) and live coverage status toggle (`active` vs `concluded`) across `StoryEditorModal` and `ReporterWorkspace`. Added `POST /api/articles/:id/live-status` endpoint in `server/server.js` with Editorial RBAC guard (reporters blocked with 403). Integrated 1-click status toggle action in Admin Stories table, filter pill (`Live Blogs`), card badges (`LIVE BLOG` / `LIVE CONCLUDED`) on homepage and category grids, and reader status badge in `ArticleReader.jsx`. Verified via 5 automated tests (`test_subtopic_23_a.mjs`), `npm run build` (503ms), and `npm run lint` (0 errors).
  - [x] *Subtopic B*: Fast micro-update editor posting timestamped bullets without full page reload & reader live timeline sync. `Completed`
    - *Outcome & Verification Proof*: Built backend endpoints `GET /api/articles/:id/live-updates`, `POST /api/articles/:id/live-updates`, and `DELETE /api/articles/:id/live-updates/:updateId` in `server/server.js`. Created `LiveUpdatesModal.jsx` integrated into `AdminWorkspace.jsx` with quick micro-update post form, key highlight flag, media library photo picker, and in-place delete. Upgraded `ArticleReader.jsx` to render dynamic live timeline with auto-polling (25s interval while coverage is active), manual refresh action, and Key Highlights filter. Verified via automated tests (`test_subtopic_23_b.mjs`), `npm run build` (529ms), and `npm run lint` (0 errors).
- [x] **Editorial Workflow Enhancement: Reporter Rejection, Feedback Note & In-Place Resubmission Flow** `Completed`
  - *Outcome & Verification Proof*: Built state sync in `src/App.jsx` with `rejectedArticles` (`ps_rejected_articles_v1`), `handleRejectArticle` with feedback note modal in `EditorWorkspace.jsx`, and in-place editing in `ReporterWorkspace.jsx` (`handleEditStory`). Rejected stories show crimson badge with editor feedback note in "मेरी रिपोर्ट्स (My Submissions)" table, and an `[ Edit / सुधारें ]` action button populates the form for modification and resubmission (`handleResubmitArticle`). Verified via automated integration tests (`test_reporter_rejection_flow.mjs`), `npm run build` (923ms, exit code 0), and `npm run lint` (0 errors).

---

##  Module 3: Sovereign Broadsheet UI/UX & Typography

- [x] **Task 10: Sovereign Broadsheet UI & 100% Zero-Glassmorphism Purge** `Completed`
  - *Outcome*: Eradicated all `backdrop-filter` blurs and translucent alphas; established 100% solid paper surfaces with crisp 1px hairline borders.
- [x] **Task 11: Regional Indian Typography Studio (18 Languages)** `Completed`
  - *Outcome*: Curated Indian font pairings (Mukta, Tiro, Hind Siliguri), quick presets, range slider, boldness slider, and 1-click site-wide sync.
- [x] **Task 13: In-Article Reader Accessibility Font Scaler (A- / A / A+)** `Completed`
  - *Outcome*: Reader font scaling smoothly adjusting headlines, standfirst, drop-caps, and body copy without page reload.
- [x] **Task 14: Autonomous Mobile Newspaper Architecture** `Completed`
  - *Outcome*: 52px sticky app bar, touch horizontal category rail, compact split cards, docked audio mini-player, and zero overflow on 360px–390px screens.
- [x] **Task 15: Strict Zero-Emoji Purge Across Entire Codebase** `Completed`
  - *Outcome*: Purged 100% emojis; replaced with clean, high-contrast SVG Lucide icons and authentic broadsheet typography.
- [x] **Task 31: Minimalist Broadsheet Newsroom UI Polish (Phase 1: Header, Cards & Layout)** `Completed`
  - *Outcome*: Refined header masthead, story cards, and sidebar to eliminate generic AI/template aesthetics. Streamlined utility bar, refined language selector, replaced public role dropdown with discrete staff access, removed fake views/likes counters from cards, eliminated bouncy hover zoom animations, and established 100% solid flat paper surfaces with crisp 1px hairline dividers while preserving 100% of all features. Verified via `npm run build` (515ms) and `npm run lint` (0 errors).

---

##  Module 4: Reader Engagement, Traffic Virality & SEO

- [x] **Task 6: Server-Side Dynamic Meta & Article Pre-Rendering Gateway (SSR)** `Completed`
  - *Outcome*: Injects dynamic `<title>`, canonical `<link>`, OpenGraph, Twitter Cards, Schema.org `NewsArticle` JSON-LD, and visible semantic `<article>` without cloaking.
- [x] **Task 7: Native Browser History API Deep Linking** `Completed`
  - *Outcome*: Full SPA navigation with `/article/:slug`, `/news/:slug`, `/search` via native History API (`pushState`, `popstate`).
- [x] **Task 9: Daily Reader Poll Manager & Live Homepage Sync** `Completed`
  - *Outcome*: Admin Poll Desk with master toggle, dynamic options, live voting percentages, reset votes, and mobile 2-tier responsive layout.
- [x] **Task 24: WhatsApp Smart Formatted Share Card** `Completed`
  - [x] *Subtopic A*: Custom message builder: Headline + 3 Key Bullet Points + Clean Link. `Completed`
    - *Outcome & Verification Proof*: Built `buildWhatsAppShareText(article, currentLang)` in `src/services/shareService.js` supporting breaking/live flags, bold headline, 3 bullet points with summary fallbacks, localized CTA, and clean article link. Verified via automated tests (`test_share_service.mjs`), zero emojis regex scan, and clean production build.
  - [x] *Subtopic B*: 1-Tap WhatsApp Web / App share button. `Completed`
    - *Outcome & Verification Proof*: Integrated 1-tap WhatsApp button in Top Action Bar, Bottom Action Bar, and Share Modal in `ArticleReader.jsx` with live bulletin preview and 1-click `[ Copy Card ]` clipboard button. Added direct WhatsApp share actions on Homepage Hero Card and Secondary Grid cards in `src/App.jsx`. Verified via automated tests, `npm run build` (556ms), and `npm run lint` (0 errors).
- [x] **Task 25: Fact-Check & Source Credibility Box** `Completed`
  - [x] *Subtopic A*: Editorial verification badge inside investigative stories. `Completed`
    - *Outcome & Verification Proof*: Built interactive Credibility Shield badge and expandable Editorial Fact-Check Dossier modal (`FactCheckDossierModal`) in `ArticleReader.jsx` displaying verification rating (`Verified`, `Official Statement`, `Government Gazette`, `Under Review`), verifying desk (`PublicSpark Fact Desk`, `PIB Fact Check`, `PTI`, `ANI`), verification timestamp, claim findings, and IFCN / Press Council of India standards methodology statement. Integrated verification rating and desk selectors into `AdminWorkspace.jsx` (`StoryEditorModal`) and `EditorWorkspace.jsx`. Verified via 33 automated tests (`test_task_25_fact_check.mjs`), `npm run build` (637ms, exit code 0), and `npm run lint` (0 errors).
  - [x] *Subtopic B*: Official source and government gazette link citations. `Completed`
    - *Outcome & Verification Proof*: Built sovereign broadsheet Official Sources & Gazette Citations Box (`story-sources-box`) in `ArticleReader.jsx` directly above reader reactions, featuring verified count pill, citation cards, document classification tags (Government Gazette, Judicial Order, Official Press Release, News Agency Wire), publisher byline, document ref, and secure external links (`target="_blank" rel="noopener noreferrer"`). Implemented category-based institutional fallback (PIB, Gazette of India, ISRO Mission Bulletin, RBI) guaranteeing all stories display verified primary sources. Created 1-click citation presets (`+ PIB`, `+ Gazette of India`, `+ PTI Wire`, `+ Judicial Order`, `+ Govt Notification`) and interactive builders in `AdminWorkspace.jsx` and `ReporterWorkspace.jsx`. Verified via 33 automated tests, zero emojis regex check, and clean production build.
- [x] **Task 26: In-Article Smart Related Stories ("Ye Bhi Padhein")** `Completed`
  - [x] *Subtopic A*: Category-matched recommendation algorithm. `Completed`
    - *Outcome & Verification Proof*: Built deterministic, multi-factor recommendation service in `src/services/recommendationService.js` (`calculateArticleRelevanceScore`, `getRelatedStories`, `getMidArticleStory`, `getEndArticleStories`). Implemented primary category match (+50 pts), shared tags (+15 pts/tag), title keyword overlap (+5 pts/word), live blog/breaking boost (+10 pts), log-scaled readership views weighting, self-exclusion, draft-exclusion, and cross-category graceful backfill. Verified via 13 automated tests (`test_task_26_subtopic_a.mjs`), `npm run build` (645ms), and `npm run lint` (0 errors).
  - [x] *Subtopic B*: Mid-article and end-of-article broadsheet related cards. `Completed`
    - *Outcome & Verification Proof*: Implemented in-article "ये भी पढ़ें (Also Read)" recommendation callout after Paragraph 4 (with short article fallback) in `src/utils/markdownRenderer.jsx` and `src/components/public/ArticleReader.jsx`. Built sovereign 3-card responsive grid (`.end-article-related-stories` & `.related-story-card`) at the end of the article with category badge, reading time, thumbnail, and 1-tap navigation to the related story (`onSelectArticle` + smooth scroll to top). Added broadsheet card micro-interactions in `src/index.css`. Fully responsive on 360px–1440px with touch targets >= 44x44px. Verified via 6 automated tests (`test_task_26_subtopic_b.mjs`), `npm run build` (628ms), `npm run lint` (0 errors), and zero emojis.
- [x] **Task 27: Hairline Reading Progress Bar & "X Min Read" Badge** `Completed`
  - [x] *Subtopic A*: Top broadsheet scroll indicator line (`scrollProgress %`). `Completed`
    - *Outcome & Verification Proof*: Implemented sovereign hairline reading progress bar in `ArticleReader.jsx` with semantic ARIA progressbar attributes (`role="progressbar"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`). Engineered 60fps butter-smooth scroll engine using `window.requestAnimationFrame`, state change deduplication, and mount initialization. Styled `.article-reading-progress-track` and `.article-reading-progress-bar` in `src/index.css` with PublicSpark editorial crimson (`var(--accent-crimson)`), `z-index: 10005`, and mobile responsive adjustment `top: 52px` pinning the hairline indicator directly beneath the 52px fixed mobile app bar on screens <= 768px. Verified via 4 automated tests (`test_task_27_subtopic_a.mjs`), `npm run build` (702ms), `npm run lint` (0 errors), and zero emojis.
  - [x] *Subtopic B*: Calculated reading duration badge. `Completed`
    - *Outcome & Verification Proof*: Implemented sovereign, script-aware reading duration calculation utility `src/utils/readingTime.js` calibrated for Latin/English (~200 WPM), Indian regional scripts (~160 WPM for Devanagari, Dravidian, and eastern ligatures), and CJK (~350 CPM) with markdown syntax stripping and a 1-minute floor. Integrated broadsheet byline reading badge (`.reader-reading-badge`) in `src/components/public/ArticleReader.jsx` featuring `<Clock color="var(--accent-crimson)" />`, publication date (`<Calendar />`), and views count (`<Eye />`), with full localization across 19 languages. Upgraded related story cards to compute dynamic reading time. Enhanced backend `POST /api/articles/update` in `server/server.js` to automatically calculate `word_count` and `reading_time_mins` on persistence, and backfilled all existing stories in `server/data/articles.json`. Verified via 8 automated tests (`test_task_27_subtopic_b.mjs`), clean production build (`npm run build` in 673ms, exit code 0), zero linter errors (`npm run lint`), and zero emojis.
- [/] **Task 28: Saved Stories / Bookmark (Offline Reading Mode)** `In Progress`
  - [x] *Subtopic A*: Offline storage of bookmarked stories via `localStorage`. `Completed`
    - *Outcome & Verification Proof*: Built sovereign local storage engine `src/services/bookmarkStorageService.js` persisting complete, standalone article snapshots (`id`, `title`, `summary`, `content`, `author`, `featured_image`, `reading_time_mins`, `fact_check`, `sources`, `saved_at`) in `ps_offline_saved_stories_v1` with a 50-story quota-safe rolling cap. Integrated `isArticleOffline` and `toggleArticleOffline` into `ArticleReader.jsx` with reactive `ps_offline_bookmarks_changed` event bus and localized toast confirmations. Connected `getOfflineArticles()` to `App.jsx` bookmarks view, guaranteeing instant access to saved stories with zero network connectivity. Added offline storage metrics badge and legacy bookmark hydration (`syncLegacyBookmarks`). Verified via 9 automated unit tests (`test_task_28_subtopic_a.mjs`), clean production build (`npm run build` in 551ms), zero linter errors (`npm run lint`), and zero emojis.
  - [ ] *Subtopic B*: Dedicated "Saved Stories" reading drawer. `Planned`
- [ ] **Task 29: Statutory Grievance Redressal / Complaint Form (IT Rules 2021 India)** `Planned`
  - [ ] *Subtopic A*: Reader complaint submission modal with category & grievance officer routing.
  - [ ] *Subtopic B*: Admin Grievance Review Desk with resolution tracking.
- [ ] **Task 30: Google News Specialized XML Feed (`news-sitemap.xml`) & RSS 2.0** `Planned`
  - [ ] *Subtopic A*: Google News `<news:news>` XML specification generator.
  - [ ] *Subtopic B*: Standard RSS 2.0 automated syndication feed.
- [ ] **Task 32: Dynamic Multi-Lingual Master Article Resolution via Mandatory `originalLanguage`** `Planned (Postponed for later)`
  - [ ] *Subtopic A*: Backend resolution to read `article.originalLanguage` from database and dynamically use it as the source language for Gemini translation instead of static Hindi fallback.
- [ ] **Task 33: Multilingual Translation Pipeline Overhaul & Bug Resolution Suite** `Planned (Postponed for later)`
  - [ ] *Subtopic A*: Pure master article state resolution in `App.jsx` (`handleSelectArticle`) preventing card headline translation pollution from spilling into reader.
  - [ ] *Subtopic B*: Backend automatic summary-to-highlights bridge & `summary`/`sub_title` translation in `server/server.js` ensuring 30s bullets are translated.
  - [ ] *Subtopic C*: LocalStorage translation cache strict integrity validator in `src/services/translationService.js` purging false-positive Hindi fallbacks.
  - [ ] *Subtopic D*: Sovereign broadsheet skeleton shimmer loading state in `ArticleReader.jsx` during translation fetch.

---

##  Module 5: Newsroom Access & Cybersecurity Suite (Final Dedicated Phase)

- [ ] **Task 17: Multi-Role Newsroom Login & PIN Security (RBAC)** `Planned`
  - [ ] *Subtopic A*: 3 Distinct Roles (Reporter, Editor, Admin) with granular permissions.
  - [ ] *Subtopic B*: Secure 6-digit PIN login with memory-hard hashing (`scrypt`).
  - [ ] *Subtopic C*: HttpOnly secure session cookies.
- [ ] **Task 18: Backend API Hardening & Tamper Protection** `Planned`
  - [ ] *Subtopic A*: Public route rate limiting & anti-DDoS IP throttling.
  - [ ] *Subtopic B*: Authentication token protection on `/api/settings/*`, `/api/articles/*`, and `/api/ads/*`.
- [ ] **Task 19: 1-Click Complete Database & Media Auto-Backup Desk** `Planned`
  - [ ] *Subtopic A*: Admin backup generator creating `.zip` archive of database files and media uploads.
  - [ ] *Subtopic B*: 1-Click download and restore verification.

