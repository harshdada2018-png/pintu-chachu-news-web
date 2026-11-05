# Architecture & Feature Decisions

## Decision 36: Article Future Publishing Timer & Editorial RBAC Gate (Task 20)
- **Status**: Implemented & Verified
- **Context**: In institutional journalism, news stories are written in advance (e.g. night coverage scheduled for 7:00 AM release, embargoed press releases, or planned weekend feature drops). Furthermore, standard newsroom hierarchy dictates that field reporters cannot directly publish live or schedule releases—their submissions must stay in `draft` for review. Only Editors and Admins hold sovereign editorial clearance to publish live or schedule future auto-publishing.
- **Decision**:
  1. Built dual-layer server-side auto-publish engine in `server/server.js`:
     - Layer A: 20-second active background heartbeat cron checking `scheduledPublishTime <= Date.now()`.
     - Layer B: On-demand evaluation on every article read request, ensuring zero lag even across server sleeps/reboots.
  2. Integrated Public Reader Embargo Shield:
     - Public API `GET /api/articles` filters out `scheduled` (whose time has not yet arrived) and `draft` stories.
     - SSR prerender gateway `/article/:slug` restricts pre-rendering to published articles only, preventing crawler leaks of embargoed news.
     - Frontend `displayedArticles` in `App.jsx` enforces the embargo shield on the reader homepage.
  3. Enforced Editorial RBAC Gate:
     - In `StoryEditorModal.jsx` and `AdminWorkspace.jsx`, the Reporter role is locked to `draft` / `Submitted for Review` with a clear educational notice: `Editorial Gate: Reporters submit drafts. Only Editors and Admins can publish live or schedule future publication.`
     - In `POST /api/articles/update`, backend intercepts requests from `userRole === 'reporter'` and overrides `status = 'draft'`, blocking any unauthorized direct publishing.
  4. Scheduled Stories Desk & 1-Click Controls:
     - Added dedicated ` Scheduled (N)` toolbar filter in `AdminWorkspace.jsx`.
     - Article cards display clear broadsheet scheduled badges with formatted release timestamps (`SCHEDULED: 4 Nov, 07:00 AM`).
     - Added 1-click `[  Publish Now ]` bypass button for Editors/Admins to release scheduled stories immediately if breaking events occur.
- **Reasoning**: Guarantees authentic journalistic governance, automated temporal publishing without manual midnight interventions, and complete embargo protection against leaks.

## Decision 35: Poster Aspect Ratio Lock & Dimension Guard (Task 16.6)
- **Status**: Implemented & Verified
- **Context**: Direct sponsors often submit posters of arbitrary dimensions (e.g. 1080×1920 portrait flyers, square Instagram posts, or tall promotional banners). Without strict dimension guards and aspect ratio locks, these images stretch or blow up the broadsheet newspaper layout, pushing editorial headlines down, breaking reading flow in articles, or obscuring screen contents on mobile phones.
- **Decision**:
  1. Centralized IAB industry dimension standards and vertical clamping bounds in `SLOT_DIMENSION_GUARDS` and `getSlotDimensionGuard(slotKey, isMobile)` inside `src/services/monetizationService.js`.
  2. Enforced maximum vertical bounds per slot (Header: 100px desktop / 110px mobile; In-Article: 280px; Sidebar: 600px desktop / 300px mobile; Home Feed: 120px desktop / 110px mobile; Footer: 100px desktop / 80px mobile; Mobile Sticky Footer: 60px).
  3. Engineered clean letterboxing using `object-fit: contain`, `background: var(--bg-secondary)`, and `max-height` constraints on both anchor container and `<img>` element in `PartnerUnit.jsx`, backed by slot-specific CSS rules in `src/index.css`.
  4. Added dynamic dimension guidance badges (e.g., `Recommended: 728×90 Leaderboard (8:1) • Max Clamp: 100px`) and live clamped previews in `MonetizationDesk.jsx` (Placement Accordion, Re-Run Clone Modal, and Edit Campaign Modal).
- **Reasoning**: Guarantees zero broadsheet layout deformation regardless of what image aspect ratio an advertiser provides, protects Cumulative Layout Shift (CLS), and provides clear visual sizing guidance for administrators during ad creation and editing.

## Decision 34: Real-Time Auto-Switch Timer & Zero-Reload Live Transition (Task 16.5)
- **Status**: Implemented & Verified
- **Context**: When an ad campaign reaches its scheduled start or expiry time, readers currently reading an article or viewing the page shouldn't be forced to reload their browser to see the ad change, nor should the text jump abruptly (avoiding Cumulative Layout Shift penalties). In addition, mobile readers who lock and unlock their phones need immediate inventory synchronization.
- **Decision**:
  1. Enhanced backend `evaluateActiveAds()` to supply predictive timestamps (`nextStartsAt` and `expiresAt`) across active, scheduled, and fallback slots.
  2. Implemented client-side precision sleep timer (`scheduleTransition`) in `PartnerUnit.jsx` that schedules millisecond-accurate `setTimeout` callbacks executing at exact `startsAt` and `expiresAt` timestamps.
  3. Engineered zero layout shift (CLS) crossfade: executes a 300ms CSS fade-out (`opacity: 1 -> 0`), pulls the updated ad decision from `/api/ads/active`, and smoothly fades back in (`opacity: 0 -> 1`), preserving fixed slot geometry.
  4. Added `document.visibilitychange` and `window.focus` listeners to instantly re-sync ad inventory the moment a reader returns to the tab or unlocks their phone.
- **Reasoning**: Guarantees seamless, zero-reload temporal ad transitions, eliminates layout shifts, and ensures advertisers' start/end schedules are respected down to the exact second.

## Decision 33: Minimalist Broadsheet Newsroom UI Polish (Task 31)
- **Status**: Implemented & Verified
- **Context**: To eliminate any generic "AI-generated" or toy template look (cluttered badges, neon pill dropdowns, bouncy cards, fake views/likes on cards) while preserving 100% of all existing functional features (Audio, 19 Languages, Polls, Search, Monetization, Newsroom Desks).
- **Decision**:
  1. Streamlined the top utility bar into a calm, dignified 32px line with clean calendar, dynamic local weather, verified shield badge, and refined multi-language dropdown.
  2. Discretely integrated Newsroom Staff access (`Reader View` vs ` Reporter / Editor / Admin`) so the public frontend looks like a credible, institutional media publication rather than an AI scaffold.
  3. Purged fake social counters (`6.3K views • 720 likes`) from front-page cards, keeping real analytics in the admin dashboard and reader view.
  4. Eliminated distracting hover zoom animations (`scale(1.04)`) and bouncy elevations (`translateY(-2px)`), adopting flat broadsheet paper surfaces with crisp 1px hairline dividers.
  5. Refined the Breaking Ticker badge into an authoritative journalistic alert strip without cartoon flame icons.
- **Reasoning**: Delivers an authentic, high-prestige newspaper aesthetic (comparable to *The New York Times*, *Reuters*, or *The Hindu*) while keeping every single feature 100% functional and accessible.

## Decision 32: 1-Tap WhatsApp Sponsor Connect & Local Advertiser Mode (Roadmap Task 16.4)
- **Status**: Implemented & Verified
- **Context**: In local Indian journalism and regional commerce, advertisers (retail stores, schools/coaching institutes, doctors, banquet halls, local services) primarily conduct business and capture inquiries via WhatsApp rather than formal HTTPS websites.
- **Decision**:
  1. Built dual-layer phone detection (`parseSponsorTargetUrl` on frontend and `resolveSponsorTargetUrl` on backend) that automatically recognizes 10-digit Indian mobile numbers, `0`-prefixed numbers, `+91` numbers, and `wa.me` links.
  2. Formulated structured deep links `https://wa.me/91XXXXXXXXXX?text=...` embedding a polite, pre-filled business enquiry message referencing the sponsor's name and PublicSpark News attribution.
  3. Integrated subtle broadsheet WhatsApp badge (`WhatsApp Connect` pill with Lucide `<MessageCircle size={11} />`) on direct sponsor banners in `PartnerUnit.jsx`, alerting readers that clicking opens WhatsApp directly.
  4. Added real-time visual detection badges and instant `[  Test Link ↗ ]` buttons in both the main Placement Form and the Edit Campaign Modal inside `MonetizationDesk.jsx`.
  5. Kept full telemetry compatibility with `trackAdClick` (via `sendBeacon` and `keepalive: true`) so that WhatsApp chats are recorded in advertiser performance analytics.
- **Reasoning**: Drastically increases campaign conversion rates for local advertisers who lack dedicated websites, eliminates manual link formatting errors by the admin, and delivers an authentic mobile experience for readers.

## Decision 31: Ad Scope, Campaign Dates & Auto-Expiry Rules Architecture (Roadmap A1 & A2)
- **Status**: Approved by User & Implemented
- **Context**: In line with `PublicSpark_ ads UPDATES.md` (Sections A1 & A2), sponsor campaigns required flexible scope control (Global vs Category vs Single Article), campaign run-time start & end dates, and an automatic fallback waterfall so that expired or mismatched campaigns seamlessly fall back to Google AdSense without throwing empty space or requiring manual intervention.
- **Decision**: 
  1. Extended ad slot state schema with `scope` ('global' | 'category' | 'article'), `targetCategory`, `targetArticleId`, `excludeArticleIds`, `startDate`, `endDate`, and `status` ('active' | 'paused').
  2. Implemented `evaluateAdSlot(slot, context)` in `monetizationService.js` that evaluates campaign status, date bounds (future vs expired), exclusion lists, and scope matches against the current active category and article ID.
  3. Built 1-click Scope selector buttons with instant context explanations, category dropdown, target article input, and date pickers with live auto-expiry status badge in `MonetizationDesk.jsx`.
  4. Added responsive CSS classes (`.monetization-scope-selector`, `.monetization-dates-grid`) to guarantee zero overflow on mobile screens (360px–390px).
- **Reasoning**: Gives administrators precise, automated control over direct sponsorships while guaranteeing 100% AdSense inventory backfill when campaigns end or don't target the current page.

## Decision 30: Monetization Desk 6-Slot Architecture & Mobile Calibration Suite
- **Status**: Approved by User & Implemented
- **Context**: In line with the `PublicSpark_ ads UPDATES.md` specification (Section A4), the monetization desk required support for 6 core broadsheet placements, zero layout shift (CLS prevention), and full calibration for small phone screens (360px–390px) where buttons and badges previously overflowed.
- **Decision**: 
  1. Extended `DEFAULT_ADS_CONFIG.slots` in `monetizationService.js` to 6 core broadsheet units: `header`, `in_article`, `sidebar`, `home_feed` (New), `footer` (New), and `mobile_footer`.
  2. Integrated `<PartnerUnit position="home_feed" />` and `<PartnerUnit position="footer" />` into `App.jsx`, ensuring zero DOM footprints when disabled.
  3. Replaced rigid inline styles in `MonetizationDesk.jsx` with responsive CSS classes: `.monetization-header-card`, `.monetization-cred-grid`, `.monetization-slot-header`, `.monetization-mode-selector`, `.monetization-sponsor-grid`.
  4. Added mobile rules in `src/index.css` under `@media (max-width: 768px)` to ensure full touch-target width, wrapping for dimension badges, and stacked sponsor grids.
- **Reasoning**: Ensures all 6 required ad slots are visually manageable from the admin panel and render with zero cumulative layout shift (CLS) on desktop and mobile.

## Decision 1: Google Fonts Library Integration for Multi-Language Typography
- **Status**: Approved by User
- **Context**: The platform supports 18 languages (Hindi, Marathi, Bengali, Tamil, Telugu, English, Urdu, etc.). Admin requires full visual typography control.
- **Decision**: Integrate Google Fonts and Google Noto Multi-Script families.
- **Reasoning**: Zero license cost, global CDN, covers all 18 supported scripts without character distortion ("tofu").
- **Alternatives Considered**: Self-hosting local WOFF2 files (larger bundle size, complex uploads).

## Decision 2: Dual Font Sizing Controls (Quick Buttons + Precision Slider)
- **Status**: Approved by User
- **Context**: User explicitly requested both quick-preset buttons (Small, Medium, Large, Extra Large) AND an interactive slider for fine-grained px adjustments.
- **Decision**: Provide synchronized controls where selecting a button moves the slider, and dragging the slider updates the active size value and reflects live.

## Decision 3: Dual-Scope Typography (Global Default vs Regional / Language-Wise)
- **Status**: Approved by User
- **Context**: User requested a Global font mode and a Regional / Language-specific font mode where admin can select any of the 18 languages and set distinct headline/body fonts for each language, with the live preview desk dynamically switching into that language's native script and font.
- **Decision**: Implemented two toggle buttons `[ Global Typography]` and `[ Regional / Language-Wise Fonts]`. In Regional mode, a language selection drawer/shelf renders all 18 languages with flags and native scripts. The sticky live preview desk updates in real-time to display authentic news headlines and body text written in that selected language's native script, rendered with its configured font.
- **Reasoning**: Ensures scripts like Bengali, Tamil, Telugu, Gurmukhi, and Urdu render in their authentic cultural typefaces without breaking layout or falling back to inappropriate generic fonts. Seamlessly persists to backend and dynamically applies when visitors change the site language.

## Decision 4: 1-Click "Make Global" Propagation Actions
- **Status**: Implemented based on User Clarification
- **Context**: User clarified that "Global" should not merely be a separate tab/scope, but an active action where clicking "Make Global" propagates the currently chosen headline font to all headlines across the whole site, and clicking "Make Article Global" propagates the chosen article font to all articles across the whole site and all 18 languages.
- **Decision**: Added direct 1-click action buttons:
  1. ` Make Headline Font Global (All 18 Languages & Whole Site)` directly below the Headline Font picker.
  2. ` Make Article Font Global (All 18 Languages & Whole Site)` directly below the Article Body Font picker.
  3. Master ` Make Current Fonts Global` button at the top that syncs both headline and body fonts across all 18 languages and whole site in one click.
- **Reasoning**: Gives the admin total instant control to homogenize fonts across the entire website with zero friction, while still preserving the option to customize individual regional languages whenever desired.

## Decision 5: Editorial Color Harmonies & Custom Color Suite (Strict Zero-Emoji Corporate Design)
- **Status**: Implemented based on User Request
- **Context**: User requested giving Admin full customization power over website colors, with a dedicated column providing 10 curated color harmonies based on industry research, plus real-time fine-tuning controls. Crucially, user requested strict zero-emoji styling to ensure an ultra-professional, corporate, high-end feel rather than cheap or childish.
- **Decision**: 
  1. Built [ColorPaletteCustomizer.jsx](file:///d:/my%20projects/pintu%20chachu%20news%20web/src/components/admin/ColorPaletteCustomizer.jsx) featuring:
     - **Column 1**: 10 Curated Newsroom Presets (The Grand Broadsheet, The Global Wire, Metropolitan Editorial Spectrum, Financial Bisque, Modern Tech Bento, Nordic Minimalist, Vernacular Kesari & Teal, Earth & Environmental, Midnight Executive, and The Pure Monolith). Each preset features live color swatches, editorial description, beat badge, and 1-click apply.
     - **Column 2**: Sticky Real-Time Live Preview Desk (simulated navigation, breaking alert ticker, and lead story card) paired with fine-tuning color pickers and hex inputs for 10 individual tokens (Primary brand, Background canvas, Surface card, Secondary surface, Headings/main ink, Body text, Metadata, Breaking alert, Accent links, and Borders).
  2. Strict Zero-Emoji Rule: Entire component, buttons, badges, labels, and feedback alerts use clean typography and refined Lucide SVG icons with zero emojis.
  3. Dynamic CSS Variable Injection: Injected into `--accent-indigo`, `--bg-primary`, `--bg-surface`, `--bg-secondary`, `--text-main`, `--text-muted`, `--text-subtle`, `--accent-crimson`, `--accent-blue`, `--border-light`, `--border-medium`, enabling instant site-wide theme switching without page reload.
  4. Dual Storage Persistence: Saved to localStorage for 0ms sub-millisecond client boot and synchronized with `server/server.js` via `GET` / `POST /api/settings/theme`.

## Decision 6: Backend Security Hardening & Zero-Trust Input Validation (OWASP Compliance)
- **Status**: Implemented based on User Inquiry & Approved
- **Context**: User raised a critical security concern regarding whether malicious users could manipulate frontend code in DevTools to inject unauthorized payloads or destructive scripts into the backend.
- **Decision**: 
  1. Created formal project security specification in [SECURITY_REQUIREMENTS.md](file:///d:/my%20projects/pintu%20chachu%20news%20web/SECURITY_REQUIREMENTS.md).
  2. Implemented 4-tier security guard architecture in [server/server.js](file:///d:/my%20projects/pintu%20chachu%20news%20web/server/server.js):
     - **Input Validation**: Strict HEX and RGBA regex pattern matching (`SAFE_HEX_REGEX` & `SAFE_RGBA_REGEX`) and anti-breakout character checks (rejecting `;`, `<`, `>`, quotes, and CSS exfiltration sequences).
     - **Whitelist Property Filtering**: Strips any unauthorized/arbitrary properties outside approved theme tokens.
     - **Payload Size Ceiling**: Hard 10 KB request body limit (`413 Payload Too Large`) to protect against RAM/disk flooding DoS attacks.
     - **Admin Authorization Verification**: Enforces `x-admin-key` / `Authorization: Bearer` secret validation, blocking untrusted origins with `403 Forbidden`.
  3. Verified across 4 automated adversarial test cases (XSS script injection, CSS breakout injection, unauthorized origin attempt, and clean theme updates).

## Decision 8: Typography Boldness Bar (Zero Fixed Numbers) & Top Explicit Apply Button
- **Status**: Implemented based on User Request
- **Context**: User explicitly requested:
  1. A font boldness bar ("font ko bold karne wala baar") to decide how bold the fonts should be.
  2. Crucially, the bar must NOT display any fixed numbers ("baar me koi fix numbers nahi hone chahiye jese jese aapan baar ko aage karte jaye vese vese bold hota jaye").
  3. An Apply button placed at the TOP of the section ("1 apply button bhe lagao jis se changing karne par jaab tak apply par click na ho tab tak pure site me vo change apply na ho or ye neeche nahi UPAR hona chahiye").
- **Decision**: 
  1. **Font Boldness Slider**:
     - Added headline and body boldness controls backed by CSS variables `--font-weight-heading` and `--font-weight-body`.
     - Zero numbers displayed: Replaced raw numeric weights (400, 500, 700, 900) with dynamic qualitative descriptors (*Regular*, *Medium*, *Semi-Bold*, *Bold*, *Extra Bold*, *Ultra Black*) rendered directly in that font weight.
     - Slider endpoints display text labels `Slim / Regular` to `Maximum Bold`. Quick preset chips allow 1-click weight selection rendered in the exact thickness with zero numbers.
     - Connected to the Live Interactive Preview Desk so dragging the slider makes the headline smoothly and visibly bolder in real time.
  2. **Top Action Bar & Draft State**:
     - Added a prominent `[Save & Apply Typography]` button alongside `[Reset Defaults]` at the **TOP** header row of the Typography tab.
     - Added `● Unsaved Changes (Preview Active)` warning pill.
     - Tweaking fonts, font scale, or boldness updates local state and the live preview desk only; public site and backend are untouched until the admin explicitly clicks the top Apply button.
     - Removed the redundant bottom save button row.
- **Reasoning**: Protects public site visitors from color flashing while admin experiments, eliminates high-frequency backend disk-write requests during color wheel dragging, and gives the admin full drafting control.

## Decision 8: 4-Pillar UI/UX Modernization Suite (Bento Broadsheet Elevation)
- **Status**: Implemented based on User Approval ("sare he karo but 1 by 1")
- **Context**: User approved implementing all 4 researched editorial UX improvements to elevate PublicSpark to premier global digital newsroom standards.
- **Decision**:
  1. **Corporate Micro-Polish**: Purged all remaining emojis (`Listen `, `Remove `, ` /  / ` poll buttons, and audio bar header) across the public frontpage, replacing them with refined Lucide SVG icons (`Volume2`, `X`, `ThumbsUp`, `ThumbsDown`, `HelpCircle`).
  2. **Hairline Broadsheet Precision Grid**: Replaced fuzzy, heavy glassmorphism drop-shadows on `.story-card-hero` and `.story-card-secondary` with crisp 1px hairline border rules (`var(--border-medium)`), subtle 8px border-radius, and added dynamic word-count reading time estimates (`⏱ 2 min read`, `⏱ 3 min read`) on every news card.
  3. **Executive 30-Second Highlights**: Added an "In 30 Seconds: Key Highlights" callout card at the top of full articles in `ArticleReader.jsx` with bulleted takeaways for effortless fast scanning.
  4. **In-Article Reading Ergonomics**: Bound the reader `A- / A / A+` font size mode directly to the article markdown body text (enabling seamless switching between 0.975rem, 1.125rem, and 1.275rem on the fly) and refined the top 3px sticky reading progress bar.
- **Reasoning**: Aligns the product with modern 2025–2026 digital news publishing standards (high-contrast typography, calm reading interfaces, instant scanning, and sovereign branding).

## Decision 9: Gemini AI Translation, 19-Language Suite (with Russian), Native Browser TTS, and Database Schema
- **Status**: Implemented per User Specification
- **Context**: User specified 4 core architectural requirements and 3 database storage models:
  1. **Translation Engine**: Purge unofficial Google translation endpoints from backend, switch strictly to Google Gemini (`gemini-2.5-flash`) called exclusively from the backend proxy.
  2. **Secret Management**: `GEMINI_API_KEY` stored strictly in Render / `.env` environment variables, never committed to git or exposed to the client bundle.
  3. **19-Language Standard**: Add Russian (`ru`) to the standard supported languages across frontend dropdown, translation service, font catalog, backend validation, and database storage.
  4. **Listen / TTS Engine**: Purge unofficial `translate_tts` scrapers. Enforce native browser SpeechSynthesis (`window.speechSynthesis`). If the reader's browser lacks a native voice for that language, hide the "Listen" button completely.
  5. **Database Models**:
     - `translations` store: `article_id`, `lang`, `title`, `body`, `status` (`pending`|`done`|`failed`), `content_hash` (for cache invalidation when articles are edited), `created_at`. Unique key `(article_id, lang)`.
     - `audio_records` store (schema-ready for future TTS file integration): `article_id`, `lang`, `voice`, `audio_url`, `size`, `last_played_at`, `status`.
     - `usage_logs` store: `date`, `provider`, `requests` (to guard daily quota limits).
     - Strict constraints: No API keys in DB, no saving failed/partial translations, no translating draft articles.

## Decision 11: Editorial Chain Architecture (Reporter -> Editor Review -> Live, Admin Direct Publish)
- **Status**: Implemented based on User Requirement
- **Context**: User specified the editorial governance chain:
  1. Reporter Desk submissions must NOT go live immediately; they must be routed to the Editor Desk with `status: 'pending'`.
  2. Editor reviews, adjusts headline, toggles breaking news, and upon clicking "Approve & Publish", the story goes live to the homepage and is saved permanently to `server/data/articles.json`.
  3. When an Admin creates a story from Admin Workspace ("Create Custom Story"), it bypasses the Editor Desk completely and publishes directly live on the homepage immediately.
  4. Both the Editor review queue (`pendingArticles`) and Reporter submission history (`myStories`) are backed by persistent storage so page reloads do not cause data loss.
- **Decision**:
  1. Updated `ReporterWorkspace.jsx` to submit stories with `status: 'pending'`, updated header banner to editorial chain mode, changed button to "Submit to Editor Desk", and persisted `myStories` in `localStorage`.
  2. Updated `App.jsx` to persist `pendingArticles` in `localStorage` (`ps_pending_articles_v1`), route incoming reporter submissions to the pending queue with toast notification, and save approved articles permanently to `server/data/articles.json`.
  3. Preserved Admin direct publish authority in `AdminWorkspace.jsx`.
- **Reasoning**: Enforces strict journalistic quality control and gatekeeping while allowing administrative executive override.

## Decision 13: Google AdSense Monetization & Full News SEO Architecture
- **Status**: Proposed & Recorded (Awaiting Implementation Approval)
- **Context**: User explicitly requested that the platform must support Google AdSense monetization and complete newsroom SEO from the ground up:
  1. Google AdSense activation with policy-compliant ad placements, publisher ID management, and `ads.txt`.
  2. Complete newsroom SEO (Google Search, Google Discover, Google News) with dynamic meta tags, JSON-LD NewsArticle schema, XML sitemaps, robots.txt, and clean crawlable URLs.
- **Decision & Architecture Specification**:
  1. **Google AdSense Foundation & Policy Compliance**:
     - *Publisher ID Configuration*: In Admin Workspace (`activeTab === 'ads'`), admin can input real AdSense Client ID (`ca-pub-XXXXXXXXXXXXXXXX`) and toggle AdSense Auto-Ads or manual placement slots.
     - *Root `ads.txt` Endpoint*: Served at `/ads.txt` via Express backend and static `/public/ads.txt`.
     - *Policy-Mandated Legal & Editorial Pages*: Google AdSense mandates 5 public pages for approval: Privacy Policy (with Google AdSense DoubleClick DART cookie disclaimer), Terms of Service, About Us (newsroom & publisher identity), Contact Us (with Grievance Redressal Officer), and Disclaimer.
     - *Policy-Safe Ad Slots*: Non-intrusive placements labeled "ADVERTISEMENT" (Header Leaderboard 728x90, Mid-Article Native 300x250, Sidebar Sticky 300x600, and Sticky Mobile Footer 320x50), built to never violate AdSense Core Web Vitals or content-to-ad ratio limits.
  2. **News SEO & Google Discover Suite**:
     - *Dynamic Meta Head Tags*: `<title>`, `<meta name="description">`, canonical URL, Open Graph (`og:title`, `og:description`, `og:image`, `og:type="article"`), Twitter Card (`summary_large_image`).
     - *Structured Data (Schema.org / JSON-LD)*: Full `NewsArticle` schema per story (headline, datePublished, dateModified, author, publisher logo, articleBody snippet) + `Organization` & `BreadcrumbList` schemas.
     - *Dynamic Google News XML Sitemap*: Dynamic `/sitemap.xml` endpoint that serves all published articles with `<news:news>`, `<news:publication>`, `<news:publication_date>`, and `<news:title>` tags.
     - *Crawler Control (`robots.txt`)*: Clean directive allowing Googlebot, Googlebot-News, and bingbot, with sitemap declaration and admin workspace protection.
     - *Crawlable News URLs*: Hash/History routing supporting shareable and crawlable URLs (e.g. `/article/:id` or `/#/article/:id`).
     - *Multilingual `hreflang`*: Direct signals for all 19 supported languages so search engines index regional translations accurately.
- **Reasoning**: Preparing both AdSense and SEO at the architectural level ensures the codebase passes Google AdSense approval without "Low-value content" or "Policy violation" rejections, and guarantees immediate discoverability on Google Search and Google Discover upon launch.

## Decision 14: Dynamic Category Population & Zero-Story Auto-Hiding (AdSense Navigation Guard)
- **Status**: Approved by User & Implemented
- **Context**: User rightly pointed out that creating/managing categories is dynamically handled by the Admin, not hardcoded by developers. If an Admin creates a new category (e.g. "Crime" or "Sports") and leaves it empty with 0 articles, Google AdSense reviewers or public readers clicking the category could see a blank page, causing an instant "Site Behaviour: Navigation" rejection.
- **Decision & Engineering Solution**:
  1. *Public Navigation Auto-Filter*: On the public website, only categories that have at least 1 published live article (`articles.some(a => a.category_slug === cat.slug && a.status === 'published')`) will be rendered in the top header and navigation pills.
  2. *Admin Workspace Transparency*: In the Admin Workspace "Categories" desk, each category dynamically displays its article count and publication status (e.g., `India (14 articles - Live)` vs `Sports (0 articles - [Note] Hidden from public until first story is published)`).
  3. *Graceful Fallback on Direct URL*: If an empty category is directly accessed, the UI will not display a blank page or 404 error; instead, it renders an editorial placeholder ("Fresh reporting underway for this section") followed by the latest trending stories.
- **Reasoning**: Protects Google AdSense approval completely from empty category rejections while giving the administrator 100% freedom to create as many categories as they want whenever they want.

## Decision 15: Direct Code-Level Mock Data Purge at Delivery (Strict YAGNI Standard)
- **Status**: Approved by User
- **Context**: User clarified that there is no need for a dedicated "Clear Sample Data" button or extra UI controls in the Admin panel. Since we are developing the codebase directly, once development and verification are complete, all mock data files (`mockData.js`), hardcoded sample arrays, and test fallbacks will be pruned directly from the source code.
- **Decision**:
  1. *No Redundant UI Buttons*: Follow Rule 3 (Lazy Developer & Minimal Code / YAGNI) by avoiding unnecessary UI buttons, handlers, and endpoints for clearing mock data.
  2. *Direct Code Purge at Delivery*: Prior to final deployment/delivery, excise `mockData.js` and all static fallbacks from the code, binding all frontend displays strictly to the live backend database (`server/data/articles.json` / PostgreSQL).
- **Reasoning**: Eliminates code bloat, avoids confusing administrative users with development-only buttons, and guarantees a 100% clean, professional production bundle.

## Decision 16: Pure JS MP3 Audio Compression (32kbps Mono) & 14-Day Automated Rolling Cache
- **Status**: Approved by User & Implemented
- **Context**: User raised valid concerns that caching uncompressed Gemini TTS audio could rapidly deplete server disk space (7.5 MB - 9.5 MB per article clip) and that readers replaying audio shouldn't repeatedly fetch from the server. User requested 32kbps mono audio compression and automated 14-day audio file purging.
- **Decision & Engineering Solution**:
  1. *Pure JavaScript MP3 Compression (32kbps Mono)*: Integrated `@breezystack/lamejs` directly into `server/server.js` with zero native C/C++ dependencies. Every generated Gemini PCM audio buffer is automatically compressed to 32kbps mono MP3 before writing to disk. At 32kbps mono, 100% of the 32,000 bits/sec are dedicated to a single speech channel (equivalent to 64kbps stereo), preserving full natural speech clarity.
  2. *92%+ Storage Reduction*: Reduces storage footprints from ~8 MB down to ~500 KB per full-body clip (and intro clips down to ~25-30 KB) with 0% audible degradation in natural voice clarity.
  3. *7-Day Mobile Device Persistence*: Configured HTTP 206 (Range Request) and HTTP 200 responses for `/uploads/` with `Cache-Control: public, max-age=604800, immutable`. Mobile browsers store audio in persistent device disk cache; replaying or seeking audio incurs 0 network requests to the server.
  4. *14-Day Automated Rolling Cleanup*: Implemented `cleanupExpiredAudioFiles(14)` in `server.js` running on startup and every 24 hours. Any audio file older than 14 days is automatically deleted from disk and pruned from `audio_records.json`, permanently capping audio storage under 60-80 MB regardless of lifetime article volume.
- **Reasoning**: Ensures the news portal can host thousands of audio stories on zero-cost free-tier storage without ever exhausting quotas or incurring repeat bandwidth costs.

## Decision 17: Multi-Year Media Storage Strategy (Deferred to Thinking Folder)
- **Status**: Deferred / Under Consideration
- **Context**: User analyzed the long-term storage impact of permanent news cover photos, camera image compression, base64 database bloat, and zero-credit-card cloud tiers. User commanded that this entire strategy be documented in a dedicated thinking document for careful future evaluation.
- **Decision & Documentation**:
  1. Created `thinking/MEDIA_STORAGE_STRATEGY.md` containing full technical comparisons of Local Server vs Cloudinary (25 GB free) vs Supabase Storage (1 GB free) vs ImgBB.
  2. Designed the Plug-and-Play Hybrid Architecture (Local Server default -> Cloudinary environment switch via `.env` without frontend changes).
  3. Action deferred for future review before committing to any third-party media cloud provider.
- **Reasoning**: Strictly adheres to Rule 2 (wait for approval before major architectural shifts) and preserves deep research for future execution.

## Decision 18: Server-Side Dynamic Meta & Article Pre-Rendering Gateway (SSR), Native History Routing & Google AdSense Compliance
- **Status**: Approved by User & Implemented
- **Context**: Standard Single Page Applications (React + Vite) fail Google News, Google Discover, and social sharing previews (WhatsApp/Twitter/Facebook) because crawlers do not execute JavaScript and encounter an empty `<div id="root"></div>`. User explicitly commanded: "React + Vite frontend SSR ya prerendering ke bina Google pe kamzor rahega... haa ise implant karo".
- **Decision & Engineering Solution**:
  1. *Server-Side Pre-Rendering Gateway*: Built dynamic HTML gateway in `server/server.js` (`GET /article/:id`, `GET /news/:slug`, `GET /?article=...`) that intercepts crawler requests, injects dynamic `<title>`, canonical `<link>`, OpenGraph tags, Twitter cards, and Schema.org `NewsArticle` JSON-LD, plus a clean semantic `<article id="ssr-prerendered-content" data-ssr="true">` body with zero `display:none` cloaking penalties.
  2. *Native Browser History API Deep Linking*: In `src/App.jsx`, implemented native `window.location.pathname` routing, `pushState`, and `popstate` event listeners so articles deep-link directly to `/article/:slug` without bulky third-party router libraries (Rule 3: Minimal Code).
  3. *Standalone WebP Image Upload Pipeline*: Wired `ReporterWorkspace.jsx` to `POST /api/upload/image`, saving compressed WebP files directly to `server/data/uploads/` and returning clean `/uploads/img_....webp` URLs, permanently preventing base64 storage bloat in `articles.json`.
  4. *Google AdSense Mandatory Legal Suite*: Implemented `src/components/common/LegalModal.jsx` and connected footer links for all 5 mandatory compliance policies (Privacy Policy with DoubleClick cookie disclosure, Terms of Service, About Us, Contact Us & Statutory Grievance Redressal under India IT Rules 2021, and Fact-Checking & Editorial Code).
  5. *Crawler Directives & AdSense Files*: Created `public/ads.txt` and served `GET /ads.txt`, `GET /robots.txt`, and dynamic Google News `GET /sitemap.xml` with `<news:news>` and `<image:image>` tags.
- **Reasoning**: Guarantees instant Googlebot/Google News indexing, rich WhatsApp preview cards, and passes Google AdSense verification seamlessly on zero-cost free-tier infrastructure.

## Decision 19: Responsive Ad Placement & Monetization Customizer Suite (Google AdSense & Direct Sponsor Engine)
- **Status**: Approved by User & Implemented
- **Context**: User requested a robust, zero-code news monetization system with total administrative control over ad placements, support for both Google AdSense and local direct advertiser banners, zero policy violations, and responsive adaptation between PC (desktop) and Mobile screens.
- **Decision & Engineering Solution**:
  1. *Central Ad Management Service (`src/services/adService.js`)*: Handles 4 standard slots (`header`, `in_article`, `sidebar`, `mobile_footer`), localStorage fast-boot caching (`ps_ad_settings_v1`), server synchronization, and dynamic subscriber dispatching (`ps-ad-settings-changed`).
  2. *Responsive AdSlot Component (`src/components/common/AdSlot.jsx`)*: Automatically detects device viewport (PC vs Mobile). Returns 0 DOM if disabled (zero CPU/memory lag). Supports direct sponsor banners (with target links & images) or Google AdSense units. In localhost/development, renders an unobtrusive broadsheet preview card without console errors.
  3. *In-Article Native Injection (`src/utils/markdownRenderer.jsx`)*: Seamlessly injects `<AdSlot position="in_article" />` directly between Paragraph 2 and Paragraph 3 with a 24px safe breathing margin preventing accidental clicks (OWASP/AdSense policy compliant).
  4. *Broadsheet Placements in `src/App.jsx`*: Positioned Header Leaderboard (728×90 / 320×50), Sidebar Sticky Unit (300×600), and Mobile Sticky Anchor (320×50).
  5. *Visual Ads Manager Desk (`src/components/admin/AdsManager.jsx`)*: Built clean Admin panel tab featuring Google Publisher ID validation (`ca-pub-XXXXXXXXXXXXXXXX`), Auto-Ads toggle, per-slot mode toggles (AdSense vs Sponsor), image upload to WebP storage, and target link inputs.
  6. *Backend Persistence & Automated `ads.txt` Sync (`server/server.js`)*: Added `GET /api/settings/ads` and `POST /api/settings/ads` with 25 KB payload guard, admin authentication (`x-admin-key`), regex validation, and automatic synchronization to `public/ads.txt`.
- **Reasoning**: Gives the publication immediate dual-monetization capability (Google Ads + direct local sponsorship revenue) while ensuring 100% compliance with Google Publisher Policies and responsive layout stability.

## Decision 20: 100% Zero-Glassmorphism Purge & Sovereign Broadsheet Paper Architecture
- **Status**: Approved by User & Implemented
- **Context**: User strongly commanded: "ye site ko uiux deep research and talking ke baad banana hai na ke ai generated, we need premiumness". In accordance with Rule 4 ("Avoid generic AI-generated designs, repetitive layouts, predictable gradients, excessive glassmorphism"), all remaining AI-template glassmorphism artifacts were audited.
- **Decision & Engineering Solution**:
  1. *Total Purge of Blur Filters*: Purged 100% of `backdrop-filter: blur(...)` and `-webkit-backdrop-filter` rules across the entire codebase (verified with ripgrep: 0 remaining in `index.css`, `App.jsx`, `Header.jsx`, `ArticleReader.jsx`, `LegalModal.jsx`, `AdminWorkspace.jsx`, `VisualFontPicker.jsx`, and `LoadingSplash.jsx`).
  2. *Solid Broadsheet Newsprint Surfaces*: Replaced all translucent `rgba()` alphas with 100% solid, crisp surfaces (`--bg-surface: #FFFFFF` in light mode, `#0F172A` in dark mode).
  3. *Crisp 1px Hairline Borders*: Styled cards, sticky rails, and widgets with refined 1px newspaper border rules (`#E2E8F0` / `#CBD5E1`) and clean newsprint elevation shadows (`--shadow-sm`, `--shadow-md`) instead of fuzzy neon/glow halos.
  4. *Solid Sticky Navigation*: Sticky category and masthead rails are now 100% opaque, ensuring no background text bleed or GPU composition stutter during fast scrolling.
- **Reasoning**: Aligns the newsroom with premier global print/digital journalism institutions (*The New York Times*, *The Hindu*, *Indian Express*, *BBC News*), delivers 60 FPS butter-smooth mobile scrolling, and guarantees maximum typography readability.

## Decision 21: Autonomous Single-Codebase Mobile Newspaper Architecture (5 Pillars)
- **Status**: Approved by User & Implemented
- **Context**: User confirmed: "haa yahe to chhaye raha leptop ke leye aalag or mobile ke leye aalag tab na maja aaye ga kaam karne me... aapne aap ho jaye ga na jaab screen chota ho ga to 1 ke he ander".
- **Decision & Engineering Solution**:
  1. *100% Automatic Viewport Responsiveness*: Single React codebase dynamically transitions between Desktop Broadsheet layout (> 768px) and Mobile Newspaper App (<= 768px) with zero page reload or separate domain required.
  2. *Pillar 1 — Sovereign 52px Mobile App Bar*: Replaces massive 95px desktop masthead and top utility bar on mobile with a compact app bar featuring a slide-out hamburger menu trigger, crisp logo, quick regional/global language selector, instant search button, and dark/light mode toggle.
  3. *Pillar 2 — Momentum Touch Horizontal Category Rail*: Category navigation sits directly below the 52px app bar with `-webkit-overflow-scrolling: touch` and hidden scrollbars for native-feeling thumb swiping.
  4. *Pillar 3 — Compact Split Story Cards*: Secondary story cards switch on mobile from vertical 400px columns to horizontal split cards (96×96px thumbnail on right, 2-line clamp headline + category + metadata on left), allowing readers to scan 4-5 stories per viewport swipe.
  5. *Pillar 4 — Docked Bottom Audio Mini-Player*: Floating audio player docks to screen bottom on mobile with native iOS/Android safe-area inset padding (`env(safe-area-inset-bottom)`), remaining accessible without obstructing article reading.
  6. *Pillar 5 — Native Mobile Bottom Share Sheet*: Article share dialog transforms on `< 600px` into an animated bottom sheet with a native-style drag handle pill and quick 1-tap WhatsApp, Twitter, Telegram, and Link Copy triggers.
- **Reasoning**: Delivers an app-like newsreading experience on mobile smartphones while retaining the grand broadsheet presence on laptops and desktops, without code fragmentation or duplicate maintenance.

## Decision 22: Responsive Device Mode Switcher (Desktop vs Mobile) & 390px Phone Frame Preview
- **Status**: Approved by User & Implemented
- **Context**: User requested: "topography me phoine ke setting ke leye 1 aalag section tayatr karo jis se aapan badi screen ke leye aalag setting and chato setting ke leye aalag seting lar sake", "space management ka bhaut dhyan rakhna, aagar space management aacha nahi ho ga to site cheep he lagegi", and confirmed "mode changing ka option dena hai na".
- **Decision & Engineering Solution**:
  1. *Segmented Device Mode Controller*: Instead of stacking duplicate sliders vertically (which creates visual clutter and violates strict space management), introduced an elegant segmented pill control: `[ Desktop / बड़ी स्क्रीन ] [ Mobile / छोटी स्क्रीन ]` at the top of the Typography Desk.
  2. *Contextual Responsive Sliders*:
     - In **Desktop Mode**: Configures desktop headline scale (`headingScale`: 80% to 150%) and desktop article body size (`bodySize`: 12px to 24px) with quick broadsheet presets.
     - In **Mobile Mode**: Configures mobile headline scale (`mobileHeadingScale`: 70% to 115%) and mobile article body size (`mobileBodySize`: 12px to 18px) with mobile-calibrated reading presets.
  3. *Synchronized Dual-View Live Preview (390px Phone Simulation)*:
     - When Desktop Mode is active, the preview displays full-width broadsheet cards with desktop font scaling.
     - When Mobile Mode is active, the preview dynamically transforms into an authentic 390px mobile phone mockup container complete with top speaker notch, status bar (9:41 / 5G / 100%), mobile font scaling, compact mobile padding, and a bottom home indicator bar.
  4. *Quick Header Switcher*: Added synchronized mini device toggle buttons directly inside the preview desk header for instant one-click switching.
  5. *CSS Variable Mapping*: Injected `--font-scale-heading-mobile` and `--font-size-base-mobile` into `:root` in `App.jsx`, automatically mapped under `@media (max-width: 768px)` in `index.css`.
- **Reasoning**: Enforces world-class space management by eliminating redundant slider bloat while granting the administrator total, independent typographic control over both desktop readers and mobile readers with real-time visual certainty.

## Decision 23: Absolute Purge of Emojis and Adoption of SVG Vector System & Clean Editorial Typography
- **Status**: Enforced by User & Implemented
- **Context**: User firmly instructed: "emogi use pse mana tha na to keyou kere ho isa" (Emojis were explicitly forbidden, why did you use them?). Emojis undermine the gravitas of a reputable newsroom and cheapen the UI.
- **Decision & Engineering Solution**:
  1. *Zero-Emoji Mandate Across Code & UI*: Every single Unicode emoji was audited and removed across the entire repository.
  2. *SVG Vector Replacement*: Replaced device indicators, theme switches, and language toggles with Lucide SVG vector components (`<Monitor />`, `<Smartphone />`, `<Globe />`, `<Languages />`, `<Check />`, `<ChevronRight />`, `<Sparkles />`).
  3. *ISO Country Badges*: Replaced country flag emojis in the Analytics Dashboard with clean, styled two-letter ISO country code badges (`[IN]`, `[US]`, `[GB]`, `[CA]`, `[BD]`, `[AE]`, `[DE]`).
  4. *Wire Copy Sanitization*: Configured `MarkdownRenderer.jsx` with Unicode escape ranges (`[\u{1F300}-\u{1F9FF}...]`) to strip emojis from pasted wire releases, ensuring no emoji renders on published articles.
  5. *Automated Verification*: Validated using an automated Node.js regex scanner confirming 0 emojis in `src/`, followed by a clean `npm run build` test.
- **Reasoning**: Guarantees institutional broadsheet dignity, eliminates cross-platform emoji rendering discrepancies, and strictly fulfills user expectations.

## Decision 24: Default Public UI Design Protocol with Instant Rollback Guarantee
- **Status**: Approved by User & Initiated
- **Context**: User requested to design and implement a new default UI for the site that remains active as the base state until changed by the Admin. Crucially, the user requested that if they do not like the final design, it can be 100% cleanly reverted back to how it was ("desine khatam hone ke baad jo me dene wala hu aagar pasand nahi aaya ti me bolu ga wapas jaisakaro to vo wapas ho jaye ga ok na").
- **Decision & Engineering Solution**:
  1. *Git Checkpoint Tag for Instant 1-Click Rollback*: Created explicit Git tag `checkpoint-before-ui-redesign` (commit `8ade9da`) containing 100% of the verified working codebase (monetization desk, analytics, legal suite, 19-lang TTS, font pickers, SSR gateway). If the user decides to revert, a single rollback command will instantly restore the exact baseline with zero data loss or side effects.
  2. *True Default System Layering*: The new default design will be rooted in default CSS variables (`:root` in `src/index.css`), default fallback values in `server/data/settings.json`, and initial component structures. When a new visitor arrives or before an administrator configures custom styles in the Admin Desk, this new default UI will be active. If an admin later customizes colors or fonts, those user settings will seamlessly overlay the default.
  3. *Zero-Emoji & High Editorial Dignity*: Maintain the established zero-emoji rule, SVG icons, and human-centered editorial broadsheet standards.
- **Reasoning**: Ensures total psychological safety for creative design exploration while guaranteeing the integrity and reversibility of all previously completed features.

## Decision 25: Sovereign Eye-Comfort Dark Mode with 1-Theme Lock Architecture
- **Status**: Approved by User & Implemented
- **Context**: User explicitly instructed: "yaar me chhata hu ke dark mode isa ho ke ke aakho ko jada painn bhe na ho read karne me or vo coustimise na ho dark mode me 1 he theme ho jisa apan ne diside kare de dark background etc etc" (Dark mode must cause zero eye pain/strain while reading, and must NOT be customizable in dark mode—there should be ONE single, scientifically perfected theme locked across the platform).
- **Decision & Engineering Solution**:
  1. *Anti-Halation Palette (WCAG AAA 9.8:1)*: Replaced high-glare pitch black/pure white with GitHub Primer/Material 3 calibrated tokens:
     - Background: `#0D1117` (Deep Obsidian Slate)
     - Card Surface: `#161B22` (+4% elevation)
     - Secondary/Callouts: `#21262D` (+8% elevation)
     - Headlines: `#E6EDF3` (90% soft ivory, eliminating astigmatism blur)
     - Body Paragraphs: `#C9D1D9` (78% warm light slate for fatigue-free long reading)
     - Metadata: `#6E7681`
     - Borders: `rgba(240, 246, 252, 0.10)`
     - Alert Red: `#F85149`
  2. *Photo Night Shield*: Automatically applies `filter: brightness(0.92) contrast(0.98)` to images in dark mode (smoothly transitioning to `1.0` on hover) to prevent sudden daylight glare in dark rooms.
  3. *Single-Theme Lock Architecture*: In `src/App.jsx`, when `theme === 'dark'`, inline custom palette overrides on `root.style` are wiped, giving `[data-theme="dark"]` in CSS 100% full authority. Custom palettes from the Admin Color Customizer exclusively adjust Light/Day Mode.
- **Reasoning**: Delivers medical-grade reading comfort, eliminates eye strain, and prevents fragmentation or broken contrast caused by ad-hoc dark mode customizations.

## Decision 26: Daily Reader Poll Management & Live Backend Persistence Suite
- **Status**: Approved by User & Implemented
- **Context**: The Daily Reader Poll was previously an unmanageable mock component hardcoded in `src/App.jsx` with static questions and local-only vote counts in `localStorage`. The user requested an administration panel to edit the poll question, options, and toggle the poll ON/OFF, with zero empty space when disabled.
- **Decision & Engineering Solution**:
  1. *Backend Data Store & Endpoints (`server/data/poll.json` & `server/server.js`)*:
     - Created independent atomic poll storage `server/data/poll.json` keeping reader vote traffic isolated from global settings.
     - `GET /api/poll`: Serves active poll state, question, options, and live percentages.
     - `POST /api/poll/vote`: Atomic voter increment with validation, preventing client race conditions.
     - `POST /api/poll/admin`: Protected endpoint allowing admins to toggle visibility, edit question/options, or reset votes for a fresh poll topic (assigning a new poll `id`).
  2. *Admin Workspace Integration (`src/components/admin/PollManager.jsx`)*:
     - Added "Daily Reader Poll" tab under "Editorial & Content" in the Admin Workspace sidebar.
     - 1-Click Master ON/OFF Toggle: Instantly sets live status or hides the card from the public website with 0 leftover blank area.
     - Multi-Option Customizer: Supports dynamic 2 to 5 options with live percentage calculation.
     - Live Broadsheet Simulation Preview: Interactive toggle to view both unvoted button states and voted percentage bar results in real time before publishing.
     - Safe Reset Button: Allows resetting vote tallies to 0 with confirmation guard when launching a new topic.
  3. *Homepage Dynamic Binding (`src/App.jsx`)*:
     - Homepage polls `/api/poll` on mount. If `enabled: false`, the card is 100% hidden. If `enabled: true`, renders dynamic options, respects local user vote records per poll ID, and synchronizes real-time votes directly with the server.
- **Reasoning**: Replaces mock hardcoded content with an authentic, production-ready editorial engagement tool that gives administrators full operational control.

## Decision 27: Persistent Sticky Broadsheet Logo & BBC-Style Ceil-Locking Architecture
- **Status**: Approved by User & Implemented
- **Context**: User requested: "yaar jaab aapa neche scro;; karte ho to saab ouper ka ke chip jana chhaye buy mews la logo nahi chipna chhaye logo jisa ka tisa rahe vo nahi chipna chaheey like bbc" and clarified "A1: number 3 - jaab aapan scroll kare to logo ouper khiske o uper ke wall me ja kar ruk jaye or page scroll hota rahe like jisa e imae de raha hu vesa".
- **Decision & Engineering Solution**:
  1. *Ceil-Locking Sticky Masthead (`src/index.css` & `Header.jsx`)*:
     - Set `.masthead-main` on desktop to `position: sticky; top: 0; z-index: 500;` with an opaque solid surface background (`var(--bg-surface)`) and clean 1px bottom border.
     - When the reader scrolls down past 45px, `masthead-top` (date, weather, fact-check badge) scrolls up into the ceiling, while `.masthead-main` hits `top: 0` and firmly freezes/locks at the top wall.
  2. *Smooth Proportional Scaling & Space Management*:
     - When sticky, logo smoothly transitions from 75px to 44px (`transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1)`).
     - Padding tightens from `0.85rem 0` to `0.35rem 0`, creating a sleek, compact ~52px sticky bar height that preserves maximum vertical reading space for articles.
     - Hindi tagline ("स्वतंत्र डिजिटल न्यूज़रूम • सत्य • सत्यापन • पारदर्शिता") gracefully hides while sticky to prevent vertical clutter.
  3. *BBC-Style Quick Navigation Bar Integration*:
     - Revealed on the left edge when sticky: `[≡ Sections]` (triggers the full newsroom category & desk drawer) and `[Search]` button.
     - Revealed on the right edge when sticky: Compact language pill and dark/light mode toggle.
     - Brand logo remains 100% centered and clickable to return home, exactly mirroring the reference BBC layout.
## Decision 28: Hinglish & English Mandatory Communication Standard
- **Status**: Approved by User & Permanently Recorded
- **Context**: User explicitly requested: "aaye yaar mee ko itne hindi nahi aate hai yaar hinglish me naat keya karo pr aapne rule table me globle me kaa ke save karo tak ke converataion haes hinglish and english me hho he".
- **Decision & Engineering Solution**:
  1. *Rule Enforcement*:
     - Created workspace rule at [`.agents/rules/communication.md`](file:///d:/my%20projects/pintu%20chachu%20news%20web/.agents/rules/communication.md).
     - Created root [`GEMINI.md`](file:///d:/my%20projects/pintu%20chachu%20news%20web/GEMINI.md) defining strict Hinglish (conversational Hindi written in English/Latin letters) and English conversation style.
     - Mandated that the AI assistant MUST NEVER use pure/formal Devanagari Hindi for conversation.
     - Technical terms, code, file paths, variables, and explanations must remain in crisp English.
- **Reasoning**: Ensures effortless communication tailored to the user's preferred spoken language while preserving technical accuracy.

## Decision 29: Backend-Driven Ad Engine (Admin Order -> Backend Decision Maker with Date & Time Precision -> Pure Frontend Display)
- **Status**: Approved by User & Implemented
- **Context**: User instructed: "dekho plane ye hai diside backend kare ke kon sa add kaha or kaan tak dikhana hai or frontend ouse dikhaye bass. frontend ka kaam hai dikhana and or, baskend ka kaam hai keya dikha rahe hai ouse bataana. or backend ko order admine de ga ke is add ko itne daten ko itne baje se ise bage tak chalana hai is date ko ye add yaha lage ga".
- **Decision & Engineering Solution**:
  1. *Admin Order Desk (`MonetizationDesk.jsx`)*: Admin orders exact slot, scope (Global, Category, Article), creative, and exact Start Date & Time (`startDateTime`) and End Date & Time (`endDateTime`) down to exact minutes. Renders real-time status badges (`Live Now`, `Scheduled`, `Expired`, `Paused`).
  2. *Backend Decision Brain (`server/server.js`)*: Added `GET /api/ads/active?category=...&articleId=...` evaluating the real server clock against campaign timestamps, scope targeting, and paused status, with automatic waterfall fallback to Google AdSense.
  3. *Pure Display Frontend (`PartnerUnit.jsx`)*: Displays the backend decision directly with zero date math or complex logic in the client.
- **Reasoning**: Ensures tamper-proof scheduling, high performance, and total admin control.
## Decision 32: Formalization and Deferral of Military-Grade Cybersecurity & 3-Tier Hashing Blueprint
- **Status**: Recorded & Scheduled for Dedicated Cybersecurity Phase (User Approved)
- **Context**: User commanded: "ok innsaari chije ka 1 list bana ke save kar lo aapan is me or deep me resarch kare ge sare kaam khatam karne ke baad jaab aapan cyber me jaye ge tab ok na". The user requested a complete record of military-grade newsroom security and 3-tier cryptographic hashing, to be deeply researched and implemented during a dedicated cybersecurity phase after finishing primary functional tasks.
- **Decision & Engineering Record**:
  1. Documented the full technical architecture in [SECURITY_REQUIREMENTS.md](file:///d:/my%20projects/pintu%20chachu%20news%20web/SECURITY_REQUIREMENTS.md) (Section 6) and [project-planning/PROGRESS.md](file:///d:/my%20projects/pintu%20chachu%20news%20web/project-planning/PROGRESS.md) (Phase A).
  2. Defined the 3-Tier Hashing Architecture:
     - **Tier A (Passwords & PINs)**: Memory-hard `scrypt` / `Argon2id` with 32-byte salt (GPU/ASIC-proof).
     - **Tier B (Article Tamper-Proofing & Sessions)**: Keyed `HMAC-SHA256` digital signatures with server-side master key validation.
     - **Tier C (Audit Logging & Media)**: Tamper-evident `Hash-Chaining` (mini-blockchain ledger) and binary magic-byte inspection.
  3. Defined the 6-Layer Newsroom Defense Suite: RFC 6238 TOTP 2FA, Honeypot traps & auto-blacklisting, binary magic-byte inspection, zero-trust RBAC, enterprise HTTP headers, and 1-click Emergency Lockdown / Air-Gap circuit breaker.
  4. Execution deferred: Active implementation will commence as a focused, single-task cybersecurity phase after current editorial and monetization tasks are finalized.
- **Reasoning**: Strictly complies with Rule 2, Rule 5, and Rule 10, maintaining deep research documentation while keeping immediate development focused on the current task order.

## Decision 33: Dynamic In-Place Editable & Backend-Persisted Taxonomy Management Engine
- **Status**: Approved by User & Implemented
- **Context**: User specifically requested: "1 jaruri charactery jo ho ge vo aditable ho ge na, yane admin jese jese list add kare ha chatagery ke vo bhe ouse hesab se add hote jaye ge ok na" (Categories must be editable, and as the admin adds or updates categories, they must dynamically expand and sync everywhere).
- **Decision & Engineering Solution**:
  1. *Backend REST Persistence (`server/server.js` & `server/data/categories.json`)*:
     - Implemented `GET /api/categories` returning the real server-persisted category array.
     - Implemented `POST /api/categories` receiving sanitized category arrays and writing to disk (`server/data/categories.json`), with fallback to standard `DEFAULT_CATEGORIES`.
  2. *In-Place Inline Editing in Categories Desk (`AdminWorkspace.jsx`)*:
     - Added `<Edit3 />` inline trigger next to each category card.
     - Clicking triggers an inline input with auto-focus, clean broadsheet styling, keyboard shortcut support (`Enter` to save, `Esc` to cancel), and action buttons (`[ Save]`, `[ Cancel]`).
     - Validation: duplicate name check, automatic SEO slug normalization (`[^a-z0-9]+ -> '-'`).
  3. *Safety Guard on Deletion*:
     - If articles are assigned to a category when deletion is attempted, the system alerts the admin with exact article count before proceeding.
  4. *Omni-Channel Real-Time Synchronization*:
     - Updates immediately propagate across:
       - Top Broadsheet Masthead Category Nav
       - Mobile Touch Horizontal Category Rail
       - Monetization Desk: Scope "Specific Category" dropdown with live story count
       - Monetization Desk: Scope "Single Article" Category division filter pills
       - Story Editor Modal category select
- **Reasoning**: Fulfills the user's requirement for a 100% dynamic, editable, and permanent newsroom taxonomy system without relying on client-only storage or external database services.



## Decision 34: Ad Campaign History & Archive Engine with 1-Click Re-Run & Re-Activation
- **Status**: Approved by User & Implemented
- **Context**: User noted: "yaar ads placment ke history nahi hai keya jaha jaha dekha ja sake ke kon kon se ads lagaya ja chuka hai" and "aabhi aapan me ye baat ke the na Ad Campaign History & Archive Engine... list me topic and subtopic dono hone chaaye na tab na kaab badya se ho ga".
- **Decision & Engineering Solution**:
  1. *Backend REST Persistence (server/server.js & server/data/ad_history.json)*:
     - Created server/data/ad_history.json initialized with user's verified historical campaigns.
     - Implemented GET /api/ads/history returning immutable campaign snapshots sorted newest first.
     - Implemented POST /api/ads/history/delete with admin token verification allowing deletion of individual historical snapshots or clearing all records.
  2. *Automatic Campaign Snapshot Capture*:
     - In POST /api/settings/ads and /api/settings/monetization, whenever the admin saves or updates any of the 6 placement slots with type === 'sponsor', archiveCampaignSnapshot() automatically logs a snapshot with slot position, sponsor name, banner URL, target URL, scope, target article title, start/end dates, and created timestamp.
     - Includes deduplication to prevent duplicate snapshots if the admin saves multiple times without altering campaign details.
  3. *Broadsheet Archive Desk Interface (MonetizationDesk.jsx)*:
     - Introduced top-level subtab navigation: [ 6 Live Placement Slots ] and [ Campaign History & Archive (N) ].
     - Live metric counters: Total Archived, Live Right Now (emerald), Scheduled Future (blue), Completed / Past (gray).
     - Filter bar: keyword search across sponsor name, link, and article title; status filter pills (All, Live, Scheduled, Completed); and slot dropdown filter.
     - Visual banner thumbnail with click-to-lightbox full-screen preview.
     - Auto-detects 10-digit Indian phone numbers in target URL and badges them as WhatsApp: XXXXXXXXXX.
  4. *1-Click Re-Run / Clone Modal*:
     - Clicking "Re-Run / Clone" on any archived campaign opens an elegant modal allowing the administrator to choose a target slot and a duration preset ("Next 24 Hours", "Next 7 Days", "Next 30 Days").
     - Automatically pre-fills the slot with the archived banner, destination URL, sponsor name, and calculated dates, switching back to the slots view with zero re-upload friction.
- **Reasoning**: Solves the advertiser record management problem for newsroom operations, allowing editorial staff to easily prove past campaign runs to local clients and re-run recurring sponsorships in seconds.

## Decision 35: In-Place Ad Campaign Editing & Placement Form Auto-Clear Workflow
- **Status**: Approved by User & Implemented
- **Context**: User requested: "aab after save jaha aapan ads ko lagate hai ous jagaha ko clear kar dena hai jis se waha oe koi ads lagaya ja sake or jaab aapan history section me ja kar dekhe ye ye ye ads lage hai and kese add par tik kare to 1 edit ka option aana chhaye edir ka jis se aapan ouse edit kar sake aagar ads lagane me koi galti ho gaye to is se ouse sahi keya ja sakta hai".
- **Decision & Engineering Solution**:
  1. *Ad Decision Engine Resolves Active Campaigns from History*:
     - In evaluateActiveAds() (server/server.js), before falling back to static slot configuration, the backend scans ad_history.json for the active campaign matching the current slotKey, timestamp, and scope targeting.
     - This decouples the live reader display from temporary input state, allowing the placement form to be safely cleared without disrupting active running ads on the website.
  2. *Placement Form Auto-Clear & Live Slot Notice (MonetizationDesk.jsx)*:
     - After an administrator launches and saves a sponsor ad, the slot's input fields (sponsorName, sponsorTargetUrl, sponsorBannerUrl, dates) automatically clear to give a clean workspace ready for the next ad placement.
     - Added a dedicated [  Clear Form / New Ad ] button on each slot card for manual reset.
     - Added an informative green status notice banner on any slot where a campaign is actively live, displaying the sponsor name, active schedule, and a direct [  Edit Live Ad ] shortcut.
  3. *In-Place Campaign Editing (POST /api/ads/history/update & Edit Modal)*:
     - Built POST /api/ads/history/update supporting comprehensive edits to sponsor name, target URL / WhatsApp phone, placement slot, start/end date-times, targeting scope, and poster banner image.
     - Added a prominent [  Edit Ad ] button on every campaign card in Active Campaigns Desk.
     - Integrated a full-featured Edit Campaign Modal allowing instant correction of typos, wrong links, or adjusted dates with zero friction.
- **Reasoning**: Prevents cluttered stale form inputs and gives the publisher complete confidence that any operational mistake or client change can be corrected immediately without recreating campaigns from scratch.

## Decision 36: In-House Direct Sponsor Impression & Click Analytics Engine with Anti-Cheat IP Deduplication
- **Status**: Approved by User & Implemented
- **Context**: Local advertisers require verified proof of impressions and direct clicks to justify ad spending on the regional news platform. Without an in-house analytics engine, publishers must either rely on heavy third-party SaaS trackers (violating zero-cost, privacy, and zero-bloat principles) or cannot provide proof to advertisers.
- **Decision & Engineering Solution**:
  1. *Unified Lightweight Storage in `server/data/ad_history.json`*:
     - Rather than creating a detached secondary analytics table or SQLite database, stored `impressions: Number`, `clicks: Number`, `lastImpressionAt`, and `lastClickAt` directly on each campaign object.
     - Guarantees zero disk bloat: when a campaign expires and is purged by the Zero-Waste storage engine, its analytics records are deleted in lockstep.
  2. *Server-Side Tracking Gateway with Anti-Cheat Sliding Windows (`server/server.js`)*:
     - Implemented endpoints `POST /api/ads/track/impression` and `POST /api/ads/track/click`.
     - In-memory IP tracking cache (`adImpressionTracker` and `adClickTracker`) with sliding TTL cooldown windows:
       - Impressions: 30 minutes cooldown per IP per campaign (prevents page reload inflation).
       - Clicks: 5 minutes cooldown per IP per campaign (prevents click spamming).
  3. *Client-Side Visibility & Click Telemetry (`src/components/common/PartnerUnit.jsx`)*:
     - Built an `IntersectionObserver` that only fires an impression when at least 50% of the ad banner remains visible in the reader's viewport for >500ms (ensuring real human attention, not off-screen pre-rendering).
     - Click tracking employs `navigator.sendBeacon` with fallback to `fetch(..., { keepalive: true })`, guaranteeing reliable click registration even during navigation or external WhatsApp redirection.
  4. *Admin Real-Time KPI Suite & Client Proof Modal (`src/components/admin/MonetizationDesk.jsx`)*:
     - 6 top-level KPI summary cards: Total Campaigns, Live Now, Scheduled Future, Total Views, Total Clicks, Overall CTR %.
     - Live badges on every active campaign row showing Views, Clicks, and calculated CTR %.
     - Interactive **"Client Proof Summary Modal"**: Displays an official verified shield badge, banner preview, large visual KPI cards, schedule details, and a 1-click **" Copy WhatsApp Client Proof"** button (formatted for WhatsApp) plus direct **" WhatsApp Sponsor"** action link if the target is a phone number.
- **Reasoning**: Delivers complete transparency and professional advertiser reporting with zero external costs, zero dependencies, and zero persistent storage bloat.

## Decision 37: Article Revision History, Snapshot Engine & 1-Click Rollback Desk
- **Status**: Approved by User & Implemented
- **Context**: In real newsroom operations, articles undergo breaking updates, factual corrections, and editorial revisions. If an accidental deletion or faulty edit occurs, editors need an audit trail to inspect past states and restore previous copies in 1 click.
- **Decision & Engineering Solution**:
  1. *Backend Revisions Engine (`server/server.js` & `server/data/article_revisions.json`)*:
     - Built persistent storage in `server/data/article_revisions.json` storing `{ [articleId]: [ RevisionObject, ... ] }`.
     - Automatically creates an initial baseline snapshot when an existing story is edited for the first time.
     - Automatically records a new snapshot on every `POST /api/articles/update`, capturing title, subtitle, summary, body content, category, author info, status, word count, character count, and change note.
     - Strictly enforces Zero-Waste Capping (keeps the last 30 revisions per article to permanently prevent unbounded disk growth).
  2. *Revision Endpoints with Editorial RBAC Gate*:
     - `GET /api/articles/:id/revisions`: Returns chronological history sorted newest-first.
     - `POST /api/articles/:id/rollback`: Validates role and rollback target. Restores article fields in `articles.json` and creates a new audit trail entry noting "Rolled back to revision from [timestamp]".
     - Strictly enforces Editorial RBAC: Reporters are locked to view-only; rollback execution is restricted to Editors and Administrators (returns 403 Forbidden for reporters).
  3. *Broadsheet Revision Desk UI (`ArticleRevisionModal.jsx` & `AdminWorkspace.jsx`)*:
     - Split desktop layout with timeline rail on left (showing version badges `v1`, `v2`, editor name, change note, and timestamp) and snapshot inspector on right.
     - Snapshot inspector displays headline, standfirst, status pill, word count delta vs live version, and full body copy.
     - 1-Click Rollback button with confirmation dialog and instant UI state synchronization without page reload.
     - Integrated `[ Revisions ]` shortcuts directly into article management rows and inside `StoryEditorModal`.
- **Reasoning**: Gives the newsroom enterprise-grade revision safety and accountability with zero third-party dependencies, zero emojis, and complete editorial integrity.

## Decision 38: 100% Zero-Credit-Card, Zero-Cost Sovereign Cloud & Storage Architecture
- **Status**: Approved by User & Booked for Production Deployment
- **Context**: The project owner has no international credit card. Many cloud providers (Cloudflare R2, AWS S3, Google Cloud Storage) mandate an active credit card during signup even on free tiers. The newsroom requires a production infrastructure that is 100% free forever, never sleeps (no cold starts), incurs zero card requirements, and handles unlimited news stories, photos, translations, and audio.
- **Decision & Engineering Solution**:
  1. *Hosting & Edge Computing (Cloudflare Pages + Workers)*:
     - 100% Free, Zero Credit Card required (standard email signup).
     - Global edge network (including local servers in Delhi, Mumbai, Chennai, Kolkata).
     - 100,000 requests/day free tier with zero cold starts (instant 0.05s response times).
  2. *Database for Articles, Revisions & Translations (Cloudflare D1 SQL)*:
     - 100% Free, Zero Credit Card required.
     - 5 GB dedicated serverless SQL database co-located with Cloudflare Workers.
     - 5 GB capacity stores over 2,00,000 articles, all 18-language translation caches, comments, and full revision histories.
  3. *Media & Photo Storage (ImgBB API / Cloudinary Free Tier)*:
     - 100% Free, Zero Credit Card required.
     - Mandatory client-side WebP auto-compression (< 100 KB target) in `mediaService.js` before network upload.
     - ImgBB provides unlimited photo storage; Cloudinary provides 25 monthly credits (~15-25 GB) without ever requiring card information.
  4. *Audio Storytelling Cache (Dual Safeguards)*:
     - Pure JavaScript 32kbps mono MP3 compression (< 400 KB per story).
     - 14-day rolling automated cleanup (`cleanupExpiredAudioFiles`) capping audio storage permanently under 60-80 MB.
- **Reasoning**: Completely eliminates credit card dependencies, prevents recurring infrastructure bills, and guarantees world-class performance and high-volume scalability for the regional news platform.

## Decision 39: Centralized Digital Asset & Photo Media Library Desk (Task 22 Subtopic A)
- **Status**: Implemented & Verified
- **Context**: In institutional journalism, newsrooms upload hundreds of photo assets over time. Without a centralized media desk, reporters re-upload the same images repeatedly, bloating server storage and losing track of image origins. Furthermore, editors need visibility into which stories are currently using a specific image, and a safety guard to prevent accidental deletion of images active in published stories.
- **Decision & Engineering Solution**:
  1. *Backend Media Asset Indexer (`server/server.js` & `server/data/media_library.json`)*:
     - Implemented `syncAndIndexMediaAssets()` scanning `server/data/uploads/` for image extensions (`.webp`, `.jpg`, `.jpeg`, `.png`, `.gif`, `.svg`, `.avif`) while strictly excluding audio files (`audio_*.mp3`, `audio_*.wav`).
     - Persistent registry in `server/data/media_library.json` preserving custom editorial captions, credits, and alt text across disk rescans.
     - Live usage cross-referencing: Maps each image against `articles.json` (`featured_image`, `content`) and `ad_history.json` to calculate `usedInArticles`, `usedInAds`, and `isUsed: Boolean`.
  2. *REST Endpoints*:
     - `GET /api/media`: Returns indexed assets with live summary statistics (`totalCount`, `usedCount`, `unusedCount`, `totalSizeMb`), supporting search query (`q`), filter (`all`, `used`, `unused`), and sort (`newest`, `oldest`, `size_desc`, `size_asc`).
     - `POST /api/upload/image`: Auto-indexes new WebP uploads and associates editorial metadata immediately.
     - `POST /api/media/delete`: Enforces Active Article Safety Guard (returns 409 Conflict if image is used in live stories unless `force: true`) and Editorial RBAC (reporters blocked with 403 Forbidden).
     - `POST /api/media/update`: In-place updates for photo caption, photographer credit, and alt-text.
  3. *Broadsheet Media Library UI (`MediaLibraryDesk.jsx` & `AdminWorkspace.jsx`)*:
     - Clean broadsheet desk layout with 4 metrics KPI cards (Total Assets, In-Use in Stories, Unused Assets, Storage Consumed vs 5,000 MB Cloudflare free tier).
     - Upload button with client-side WebP compression (< 200 KB).
     - Responsive grid of media cards with size badges, usage status pills, 1-click URL copy with visual feedback, and Lightbox Inspector modal.
     - Lightbox Inspector displays full image, dimensions, file size, editable caption/credit fields, and clickable list of all linked news stories.
- **Reasoning**: Delivers institutional media asset governance, eliminates duplicate storage bloat, protects against broken live images, and provides seamless photo access for editorial staff.

## Decision 40: Multi-Field Search, Agency Credit Management & Multi-Tier Editorial RBAC (Task 22 Subtopic B)
- **Status**: Implemented & Verified
- **Context**: In real-world journalism, images must carry proper attribution (news agency sources like PTI, Reuters, ANI, PIB) and captions for ethical reporting and copyright safety. Furthermore, editors need to quickly discover photos through deep keyword search (matching captions, credits, and linked story categories), spot uncredited images, and have clear role-based access control where reporters write drafts, editors manage metadata, and administrators retain emergency override powers.
- **Decision & Engineering Solution**:
  1. *Multi-Field Search & Advanced Filters*:
     - Enhanced `GET /api/media` search engine (`q`) to perform case-insensitive matching across `fileName`, `caption`, `credit`, `altText`, and linked articles (`title` and `category`).
     - Added specialized filter pills: `All Photos`, `In-Use`, `Unused`, `Missing Credit` (flags images lacking source attribution), and `With Caption`.
     - Added sorting presets: `Newest`, `Oldest`, `Largest Size`, `Smallest Size`, `Name (A-Z)`, `Name (Z-A)`.
  2. *Attribution & Caption Management Suite*:
     - Integrated 8 institutional news agency presets (`PTI`, `Reuters`, `ANI`, `PIB`, `Staff Photographer`, `AFP`, `AP`, `Press Release`) for 1-click credit filling.
     - Created dedicated Upload Photo Modal allowing staff to input Caption, Agency Credit, and Alt-Text with live WebP compression preview.
     - Added amber `Missing Credit` warning badge on asset cards to alert editors to attribution gaps.
  3. *Multi-Tier Editorial RBAC*:
     - *Reporter*: Can browse, search, upload new photos with initial caption/credit, and insert into stories. Blocked with 403 Forbidden on editing existing metadata or deleting assets.
     - *Editor*: Can edit and save Caption, Credit, and Alt-Text for any photo. Can delete unused assets. Blocked with 403 Forbidden from force-deleting assets in active stories.
     - *Admin*: Retains supreme system authority: can edit all metadata, delete unused assets, and execute **Force Deletion** on in-use assets with confirmation override.
  4. *Storage Analytics*:
     - Real-time KPI counters tracking average image size (`avgSizeKb`), captioned photos, missing credit count, and storage consumed as a percentage of the 5,000 MB Cloudflare free tier.
- **Reasoning**: Enforces strict journalistic accountability, copyright attribution safety, and precise role-based boundaries with zero external subscriptions.

## Decision 41: 1-Click "Insert into Story" Media Picker Modal for Story Editor and Field Reporter Workspace (Task 22 Subtopic C)
- **Status**: Implemented & Verified
- **Context**: Previously, whenever editors in `StoryEditorModal` or field reporters in `ReporterWorkspace` wrote an article, they had to either upload a fresh file or manually type image URLs and credit info. This caused duplicate file uploads, wasted storage, and friction in selecting existing archived or agency photos.
- **Decision & Engineering Solution**:
  1. *Reusable Media Library Picker Mode*: Added `onSelectAssetForStory` callback support to `MediaLibraryDesk.jsx`. In picker mode, asset cards surface a prominent `[ Insert into Story / स्टोरी में जोड़ें ]` action button.
  2. *StoryEditorModal Integration (Admin & Executive Editors)*: Added `[ Choose from Media Library ]` trigger alongside the cover image input. Opening the picker displays the full Media Library desk in an overlay modal dialog. Selecting an asset auto-populates `featured_image` (with exact URL without re-uploading), `image_caption`, and `media_credits`.
  3. *ReporterWorkspace Integration (Field Reporters)*: Added `[ मीडिया लाइब्रेरी से चुनें ]` button with folder icon and a modal overlay in the reporter's Featured Image section. Selecting an asset updates `imagePreview`, `imageCaption`, and `mediaCredits`, automatically preserving the values in the local draft and submitting them with the article to the editor desk. Added 1-click photo removal button (`[X]`).
  4. *Zero Duplicate Storage*: Uses the exact indexed WebP URL (`/api/uploads/...`) directly. Zero redundant file uploads to disk, preserving server disk space and bandwidth.
- **Reasoning**: Streamlines editorial workflow, eliminates redundant uploads, prevents duplicate storage bloat, and allows staff to reuse high-quality accredited photos with one click.

## Decision 42: Live Blog Presentation Mode & Real-Time Coverage Status Engine (Task 23 Subtopic A)
- **Status**: Implemented & Verified
- **Context**: High-stakes breaking events (Election counts, budget speeches, cricket finals, natural disasters) require a distinct minute-by-minute presentation format rather than static single-article reporting. Newsroom staff must be able to flag an article as a Live Blog, toggle its coverage status between active and concluded, and have this recognized across editorial curation desks, reader views, and homepage feeds.
- **Decision & Engineering Solution**:
  1. *Schema Specification*:
     - `format`: Extended from binary (`standard` / `video`) to three distinct presentation modes: `'standard'` | `'live'` | `'video'`.
     - `live_status`: `'active'` (Event updates currently ongoing) | `'concluded'` (Live coverage concluded; timeline archived).
     - `live_updates`: Array initialized to store micro-updates.
  2. *Editorial Switcher in Workspaces*:
     - `StoryEditorModal` (Admin) & `ReporterWorkspace` (Field Reporters) now feature high-contrast sovereign format selector pills (`Standard Article`, `Live Blog (Timeline Mode)`, `Video Story`).
     - Selecting `Live Blog` surfaces real-time coverage status toggle buttons (`Live Active` vs `Coverage Concluded`).
  3. *REST Endpoint & Editorial RBAC*:
     - Created `POST /api/articles/:id/live-status` with body `{ live_status: 'active' | 'concluded', userRole }`.
     - Enforced strict Editorial RBAC: Field reporters attempting to toggle live status are blocked with HTTP 403 Forbidden. Only Editors and Administrators have authority to flip coverage status.
  4. *Visual Recognition & Curation Desk*:
     - Admin Stories List: Features a dedicated filter pill `Live Blogs ({count})`, visual status badge on story rows, and a 1-click `[ Conclude Live / Reactivate Live ]` action button.
     - Homepage & Feeds (`App.jsx`): Hero cards and secondary grid cards display high-contrast `LIVE BLOG` / `LIVE CONCLUDED` badges.
     - Reader Header (`ArticleReader.jsx`): Renders a prominent `LIVE BLOG` (active crimson badge) or `COVERAGE CONCLUDED` (neutral broadsheet archive badge).
- **Reasoning**: Establishes the foundational presentation layer for institutional live blogging, cleanly separating static articles from dynamic event streams without breaking existing article schemas or SSR pre-rendering.






## Decision 43: Reporter Desk Minimalist Language Selection Dropdown
- **Status**: Implemented & Verified
- **Context**: On mobile viewports in the Field Reporter Desk (`/reporter`), language selection previously rendered 12 bulky individual grid buttons. This created over 500px of vertical clutter, forcing mobile reporters to scroll extensively before reaching headline and article drafting fields, violating broadsheet minimalism.
- **Decision & Engineering Solution**:
  1. Replaced the 12-button grid in `src/components/reporter/ReporterWorkspace.jsx` with a single-line, accessible `<select>` dropdown box.
  2. Maintained the informative selected status badge (`चयनित भाषा: ...`) and mandatory field-unlock logic upon selection.
  3. Styled with authentic newsroom typography: 1.5px border, high contrast, matching `AdminWorkspace.jsx`.
  4. Verified with `npm run build` (541ms, exit code 0), `npm run lint` (0 errors), and zero-emoji compliance.
- **Reasoning**: Drastically reduces mobile viewport friction, eliminates unnecessary scrolling, and aligns the Reporter Desk with newsroom minimalism design standards.

## Decision 44: Live Blog Real-Time Micro-Update Editor & Public Reader Timeline Polling Engine (Task 23 Subtopic B)
- **Status**: Implemented & Verified
- **Context**: For live coverage (e.g. general election vote counting, budget speeches, major breaking news), editorial staff cannot rewrite and re-publish the entire article every 2 minutes. Readers need to view a chronological, minute-by-minute timeline with key event highlights that automatically synchronizes in the background with zero page reload.
- **Decision & Engineering Solution**:
  1. *Backend Endpoints (`server/server.js`)*:
     - `GET /api/articles/:id/live-updates`: Fast, lightweight endpoint returning `{ format, live_status, live_updates: [...] }` without serving heavy rendered HTML bodies.
     - `POST /api/articles/:id/live-updates`: Posts a new timestamped micro-update (`headline`, `body`, `is_key_event`, `media_url`, `author`, `timestamp`), automatically prepending to the article's `live_updates` array in `server/data/articles.json`.
     - `DELETE /api/articles/:id/live-updates/:updateId`: Removes an individual update safely.
  2. *Admin Micro-Updates Desk (`LiveUpdatesModal.jsx` & `AdminWorkspace.jsx`)*:
     - Added `[ Live Updates ({count}) ]` action button in the Stories Table for any live-format article.
     - Built dedicated modal with quick input form (timestamp marker, headline, body bullet, key highlight toggle, and media library photo picker).
     - Provides instant list of all posted updates with filter (`All` vs `Highlights`) and in-place deletion.
  3. *Public Reader Live Timeline (`ArticleReader.jsx`)*:
     - Completely eliminated placeholder `MOCK_LIVE_UPDATES`.
     - Rendered dynamic broadsheet timeline with crimson timestamp badges, key highlight flags, attached media thumbnails, and author bylines.
     - Integrated dual-layer sync: 25-second background auto-polling while `live_status === 'active'` (halting automatically when `concluded`) plus a manual `[ Check for Updates ]` button.
     - Added filter tabs: `All Updates ({count})` vs `Key Highlights ({count})`.
  4. *Universal Responsive Design Compliance (Rule 4)*:
     - Zero horizontal overflow at 360px viewport width.
     - 44x44px primary action button touch target.
     - 32x32px dense action button touch targets with 8px spacing.
     - Base form inputs styled with 16px font size to prevent mobile browser force-zoom.
- **Reasoning**: Delivers institutional live blogging capabilities natively with zero third-party subscriptions, zero WebSockets/socket overhead, zero emojis, and complete data persistence.

## Decision 45: Reporter Desk Editorial Rejection Handling, Feedback Display, In-Place Editing & Resubmission Engine
- **Status**: Implemented & Verified
- **Context**: When a field reporter submitted a story to the Editor Desk and an editor rejected it or requested revisions, two major defects occurred:
  1. The story became permanently frozen in the reporter's desk showing a misleading yellow badge ("Pending Editor Review") because the reporter workspace defaulted all non-published articles to pending and was disconnected from editor rejection state.
  2. The reporter had no mechanism to view the editor's rejection reasons, no edit button to open their submitted story in the drafting form, and no way to update and resubmit the revised story back to the editorial review queue.
- **Decision & Engineering Solution**:
  1. *App-Level Rejection & Revision State Management (`src/App.jsx`)*:
     - Implemented `rejectedArticles` state with localStorage persistence (`ps_rejected_articles_v1`).
     - Enhanced `handleRejectArticle(articleId, reasonNote)` to move the article from `pendingArticles` to `rejectedArticles` with a structured `rejection_reason` note and timestamp.
     - Added `handleResubmitArticle(updatedStory)` which extracts the story from `rejectedArticles`, clears the rejection flag, and re-inserts it into `pendingArticles` for editorial review.
     - Passed `rejectedArticles`, `pendingArticles`, `publishedArticles`, and `onResubmitArticle` into `<ReporterWorkspace />`.
  2. *Editor Desk Rejection Modal & Quick Presets (`src/components/editor/EditorWorkspace.jsx`)*:
     - Upgraded the "Request Changes / Reject" action to open a dedicated modal with an editorial feedback note input.
     - Provided 4 quick institutional editorial presets: *Fact Verification Required*, *Headline Revision Required*, *Missing Official Quotes / Statements*, and *Formatting & Proofreading Required*.
  3. *Reporter Desk In-Place Editing & Synchronization (`src/components/reporter/ReporterWorkspace.jsx`)*:
     - Added `useEffect` hook to continuously synchronize `myStories` with `rejectedArticles`, `pendingArticles`, and `publishedArticles`.
     - Added high-contrast crimson badge (`Changes Requested (Rejected)`) with the editor's specific revision instructions rendered directly underneath the story headline in the "मेरी रिपोर्ट्स (My Submissions)" table.
     - Added an `Actions` column with a prominent `[ सुधारें व पुनः भेजें (Edit & Resubmit) ]` button (`handleEditStory(story)`).
     - Clicking Edit populates all article fields (language, headline, body, category, tags, cover image, caption, credits, video URL, highlights) back into the form and switches to the editing tab.
     - Displays a prominent top alert banner in the drafting form showing the editor's revision instructions with a `[ Cancel Editing ]` option.
     - Transformed the submission button into `"Update & Resubmit to Editor (संशोधित समाचार पुनः भेजें)"`. Resubmission updates the story in-place, clears rejection status, sends the revised payload back to `pendingArticles` for editorial review, and updates reporter submissions.
  4. *Zero-Emoji & Rule 4 Universal Responsive Design Compliance*:
     - Zero emojis across code, UI labels, and terminal outputs.
     - Minimum 44x44px primary touch target, minimum 32x32px dense action button touch targets, 16px body font to prevent mobile auto-zoom, and zero horizontal overflow at 360px viewport width.
- **Reasoning**: Closes the fundamental journalistic editorial feedback loop between field reporters and editors, eliminating workflow dead-ends and empowering reporters to iteratively polish and resubmit reporting until published.

## Decision 46: WhatsApp Smart Formatted Share Card & Viral Broadsheet News Bulletin Engine (Task 24)
- **Status**: Implemented & Verified
- **Context**: Standard web shares send a raw, unformatted link with only a page title. In real-world Indian digital news consumption, WhatsApp groups and status updates drive over 70% of viral reader traffic. Readers and community journalists require a rich, structured news bulletin formatted in native WhatsApp markdown (bold headlines, key bullet points, dateline, and clean link) that can be sent or copied with 1 click.
- **Decision & Engineering Solution**:
  1. *Share Service (`src/services/shareService.js`)*:
     - `buildWhatsAppShareText(article, currentLang)`: Builds a structured, viral bulletin featuring:
       - Brand Header (`*PUBLICSPARK NEWS BULLETIN*` / `*BREAKING NEWS | PUBLICSPARK*` / `*LIVE BLOG UPDATES*`).
       - Bold Headline (`*Headline*`).
       - Key Highlights: Automatically extracts the top 3 bullet points (`• Point 1\n• Point 2\n• Point 3`) from `article.highlights`, with intelligent fallback to standfirst/summary sentences or clean lead paragraphs.
       - Localized Call-to-Action (`पूरी खबर और लाइव अपडेट्स यहाँ पढ़ें:`).
       - Canonical article link (`/article/:slug`).
     - `getWhatsAppShareUrl(article, currentLang)`: Returns a cross-platform WhatsApp deep link (`https://api.whatsapp.com/send?text=...`) compatible with WhatsApp Android/iOS apps and WhatsApp Web on desktop.
     - `copyFormattedShareCard(article, currentLang)`: Robust clipboard copy with fallback for older browsers and insecure contexts.
  2. *Reader Top & Bottom 1-Tap WhatsApp Actions (`ArticleReader.jsx`)*:
     - Added a dedicated high-contrast emerald green 1-tap WhatsApp button in the Top Reader Action Bar (beside the generic share button).
     - Added a prominent WhatsApp action button in the Bottom Social Actions Bar.
  3. *Share Modal Smart Card Preview & 1-Click Copy (`ArticleReader.jsx`)*:
     - Integrated a dedicated "WhatsApp Smart News Bulletin" card preview inside the Share Modal displaying the live formatted text.
     - Provided a 1-tap `[ WhatsApp पर भेजें (Send Card) ]` button and a `[ पूरा कार्ड कॉपी करें (Copy Card) ]` button with real-time visual feedback ("कार्ड कॉपी हो गया!").
     - Updated the social share grid WhatsApp icon to also dispatch the smart bulletin.
  4. *Homepage Story Cards Direct Share Triggers (`App.jsx`)*:
     - Integrated 1-click WhatsApp share buttons directly on the Hero Article card and Secondary Grid cards so readers can broadcast breaking news to WhatsApp groups straight from the feed.
  5. *Zero-Emoji & Rule 4 Universal Responsive Design Compliance*:
     - Zero emojis across all code, UI labels, and terminal outputs (using clean SVG `WhatsAppIcon`).
     - Minimum 44x44px primary action button touch target and 32x32px dense action button touch targets.
- **Reasoning**: Creates a powerful viral growth loop, turning every published article into an instantly shareable, professional news bulletin for WhatsApp groups, channels, and statuses.

## Decision 47: Editorial Fact-Check Dossier & Sovereign Source Citations Architecture (Task 25)
- **Status**: Implemented & Verified
- **Context**: In digital news, misinformation and lack of source transparency degrade public trust. Standard CMS platforms treat stories as unverified text blocks without institutional audit trails or primary source citations. Task 25 requires:
  1. *Subtopic A*: An editorial verification badge inside investigative stories indicating verification rating and verifying desk (PIB, PTI, ANI, Court Records, Editorial Desk).
  2. *Subtopic B*: An official source and government gazette citations box linking primary gazettes, court orders, press releases, and notifications.
- **Decision & Engineering Solution**:
  1. *Structured Fact-Check & Sources Data Model*:
     - `fact_check`: `{ verified: boolean, rating: 'Verified' | 'Official Statement' | 'Government Gazette' | 'Ground Report' | 'Under Review', desk: string, claim?: string, verified_at?: string, methodology?: string }`
     - `sources`: `Array<{ id: string, title: string, url: string, type: 'Government Gazette' | 'Official Press Release' | 'Judicial Order' | 'News Agency Dispatch' | 'Official Notification' | 'Institutional Report', publisher?: string, accessed_at?: string, document_ref?: string }>`
  2. *Interactive Credibility Badge & Verification Dossier Modal (`ArticleReader.jsx`)*:
     - Replaced static badge with an interactive broadsheet Credibility Shield (`FACT-CHECK: {rating} ({desk})`).
     - Clicking opens `FactCheckDossierModal`: displays verification status, verifying desk, timestamp, claim findings, and IFCN / Press Council of India standards methodology statement with smooth-scroll button to citations.
  3. *Official Sources & Government Gazette Citations Box (`ArticleReader.jsx`)*:
     - Rendered directly below article content/live blog and above reader reaction footer (`<section className="story-sources-box">`).
     - Broadsheet newsprint layout with verified source count pill, citation cards, classification tags (Government Gazette in amber, Judicial Order in purple, Official Press Release in blue), publisher, document ref, and secure external link button (`target="_blank" rel="noopener noreferrer"`).
     - Category-based intelligent institutional fallback ensuring unannotated or legacy stories display verified default institutional citations (PIB, Gazette of India, ISRO Mission Bulletin, RBI).
  4. *Newsroom Admin & Story Editor Controls (`AdminWorkspace.jsx`)*:
     - Integrated Fact-Check Verification Status dropdown, Verifying Desk input, and Claim Summary input.
     - Built Primary Sources builder with 1-click presets (`+ PIB Release`, `+ Gazette of India`, `+ PTI Wire`, `+ Judicial Order`, `+ Govt Notification`), title/URL/type inputs, and in-place delete.
  5. *Field Reporter Desk Integration (`ReporterWorkspace.jsx`)*:
     - Added optional sources section with 1-click presets enabling field reporters to cite official police notes, gazette orders, and wire dispatches when filing ground stories.
  6. *Editor Review Desk Certification (`EditorWorkspace.jsx` & `App.jsx`)*:
     - In the review modal, editors inspect reporter's attached sources and certify the verification rating and bureau before publishing.
  7. *Rule 4 & Mistake 46 Compliance*:
     - Zero emojis across all code, UI labels, logs, and docs.
     - Universal Responsive Design: zero horizontal overflow at 360px width, min 44x44px primary touch target, min 32x32px dense touch target.
- **Reasoning**: Establishes sovereign journalistic integrity and institutional credibility, distinguishing the newsroom from unverified social media blogs and content farms.

## Decision 48: Category-Matched Smart Recommendation Engine (Task 26 Subtopic A)
- **Status**: Implemented & Verified
- **Context**: Retaining reader attention in a digital newspaper requires showing highly relevant companion stories ("Ye Bhi Padhein"). Random or unranked links cause bounce rates to spike. A multi-factor relevance ranking algorithm is needed to evaluate category match, tag overlap, live blog/breaking status, and reader popularity.
- **Decision & Engineering Solution**:
  1. *Recommendation Service (`src/services/recommendationService.js`)*:
     - `calculateArticleRelevanceScore(candidate, currentArticle)`:
       - Self-exclusion (`candidate.id === currentArticle.id` returns `-Infinity`).
       - Status check (only `status === 'published'` is eligible; drafts return `-Infinity`).
       - Primary Category Match: `+50` points.
       - Shared Tag Match: `+15` points per matching tag.
       - Title Keyword Lexical Overlap: `+5` points per word (ignoring stop words, max `+25` pts).
       - Timely Format Boost: `+10` points for active live blogs, `+8` points for breaking news.
       - Readership Engagement: Log-scaled view boost (`Math.min(10, log10(views) * 2.5)`).
     - `getRelatedStories(currentArticle, allArticles, options = { limit: 4, excludeIds: [] })`: Returns scored and sorted candidate articles with automatic fallback backfill from published catalog to always fulfill requested limit.
     - `getMidArticleStory(currentArticle, allArticles, excludeIds = [])`: Selects 1 top companion story for mid-article insertion.
     - `getEndArticleStories(currentArticle, allArticles, limit = 3, excludeIds = [])`: Selects companion stories for the end of the article, excluding mid-article story to guarantee zero card duplication on the same page.
  2. *Verification & Standards*:
     - Verified via 13 automated tests (`scratch/test_task_26_subtopic_a.mjs`).
     - Production build verified (`npm run build` in 645ms, exit code 0).
     - Linter check passed with 0 errors.
     - Zero emojis across code and logs.
- **Reasoning**: Provides a robust, deterministic, client-side recommendation engine that powers in-article reading discovery without heavy ML dependencies or external tracking scripts.

## Decision 49: Broadsheet Mid-Article Callout & End-of-Article Related Stories (Task 26 Subtopic B)
- **Status**: Implemented & Verified
- **Context**: In digital broadsheets, related story cards must look editorial, unobtrusive, and clearly distinguished from sponsor ads, while delivering effortless 1-tap navigation without full-page reloads.
- **Decision & Engineering Solution**:
  1. *Mid-Article Callout ("ये भी पढ़ें (Also Read)")*:
     - Injected into `src/utils/markdownRenderer.jsx` after Paragraph 4 (or at the end if the story has 2-3 paragraphs).
     - Styled as an editorial broadsheet block with a 4px crimson accent bar (`border-left: 4px solid var(--accent-crimson)`), category tag, serif headline, and thumbnail/icon.
     - On tap, calls `onSelectArticle(story)` and smoothly scrolls to top (`window.scrollTo({ top: 0, behavior: 'smooth' })`).
  2. *End-of-Article Related Stories Grid ("संबंधित ख़बरें (Related Stories)")*:
     - Positioned directly below the Official Sources & Gazette Citations Box and above the reader action bar in `ArticleReader.jsx`.
     - Displays up to 3 non-duplicate companion stories in a responsive auto-fit grid (`repeat(auto-fit, minmax(240px, 1fr))`) that stacks seamlessly to 1 column on mobile screens (360px–480px).
     - Each card features a lazy-loaded cover thumbnail, category pill, serif headline clamped to 2 lines, reading time badge, and a `पढ़ें ->` action button.
  3. *Universal Responsive Design & Micro-Interactions*:
     - Added desktop hover interactions wrapped in `@media (hover: hover) and (pointer: fine)` in `src/index.css` to prevent sticky hover states on touch screens.
     - Enforced `box-sizing: border-box` and `min-width: 0` on all cards and containers to guarantee zero horizontal overflow at 360px width.
     - All interactive touch targets are >= 44x44px.
  4. *Zero Emojis & Rigorous Verification*:
     - Zero emojis across all code, UI labels, logs, and docs (Mistake 46 compliance).
     - Verified via 6 automated unit tests (`scratch/test_task_26_subtopic_b.mjs`), `npm run build` (628ms), and `npm run lint` (0 errors).
- **Reasoning**: Creates a frictionless circular reading loop that increases average reader session duration and page views per visit while upholding broadsheet design elegance.

## Decision 50: Sovereign Hairline Reading Progress Bar with Mobile Header Offset (Task 27 Subtopic A)
- **Status**: Implemented & Verified
- **Context**: Long-form broadsheet readers require instant, subtle visual feedback on their reading depth without distracting neon glow effects or UI stuttering during scrolling. The progress bar must also integrate with both desktop sticky mastheads and the 52px fixed mobile app bar.
- **Decision & Engineering Solution**:
  1. *ARIA Semantic Progressbar & Track Container*:
     - In `ArticleReader.jsx`, implemented a hairline track (`.article-reading-progress-track`) with `role="progressbar"`, `aria-valuenow={scrollProgress}`, `aria-valuemin="0"`, `aria-valuemax="100"`, and `aria-label="Article reading progress"`.
     - Inner hairline bar (`.article-reading-progress-bar`) dynamically reflects `${scrollProgress}%` with `var(--accent-crimson)` (PublicSpark signal red).
  2. *60fps requestAnimationFrame Scroll Engine*:
     - Replaced raw scroll event state setters with `window.requestAnimationFrame` and `lastPct` deduplication to prevent unnecessary React re-renders.
     - Added immediate execution on mount (`handleScroll()`) so reloads or deep links immediately show correct reading progress.
  3. *Mobile 52px Header Pinning & Universal Responsiveness*:
     - On desktop, the track is pinned at `top: 0` with `z-index: 10005`.
     - On mobile (`max-width: 768px`), configured `top: 52px` so the progress indicator cleanly runs directly beneath the 52px sovereign mobile app bar, avoiding any status bar or header button overlap.
  4. *Zero Emojis & Verification*:
     - Zero emojis across all code and CSS (Mistake 46 compliance).
     - Verified via 4 automated unit tests (`scratch/test_task_27_subtopic_a.mjs`), `npm run build` (702ms, exit code 0), and `npm run lint` (0 errors).
- **Reasoning**: Provides a crisp, high-performance broadsheet reading feedback line that elevates reader immersion across all device form factors.

## Decision 51: Dynamic Multi-Lingual Master Article Resolution via Mandatory `originalLanguage` (Planned / Recorded)
- **Status**: Recorded / Deferred for Future Execution (Per User Instruction)
- **Context**: The user identified a critical architectural refinement: In the Reporter Desk and Story Editor, `originalLanguage` (primary language) is already a mandatory selection for journalists and writers. Currently, backend Master Article Resolution assumes the source language is default Hindi if not explicitly passed. When a reporter files an investigative piece originally written in English, Tamil, Marathi, or Bengali, the backend should dynamically resolve `source_lang = targetArticle.originalLanguage` rather than hardcoding a Hindi fallback.
- **Planned Solution (To be implemented later)**:
  1. In `server/server.js` (`POST /api/translate`), when `article_id` is supplied:
     - Read `targetArticle.originalLanguage` from `server/data/articles.json`.
     - Set `sourceLanguage = (targetArticle.originalLanguage || source_lang || 'hi').toLowerCase()`.
  2. If `targetLanguage === sourceLanguage`, immediately return `targetArticle` as-is with zero AI calls.
  3. Feed `sourceLanguage` into `translateWithGemini` so Gemini precisely translates from the true original source language (e.g. Tamil -> English, or English -> Marathi) rather than assuming Hindi as the pivot.
- **Reasoning**: Honors the newsroom's multi-lingual authoring capability where journalists file native reports in their respective regional languages.

## Decision 52: Comprehensive Multilingual Translation Pipeline Bug Audit & Forensic Log (Recorded / Deferred)
- **Status**: Recorded / Deferred for Dedicated Deep-Dive Phase (Per User Instruction)
- **Context**: Live user testing revealed a mixed-language visual defect on the article page (e.g. viewing in Tamil displays: Tamil UI chrome + English headline + Hindi 30s summary bullet + Hindi article body). A thorough forensic code audit across frontend state, backend Gemini bridge, and browser storage identified four interconnected root causes.
- **Documented Bugs & Forensic Findings**:
  1. *Bug 1 - Frontend State Mutation (`App.jsx` -> `ArticleReader.jsx`)*:
     - When the user selects a language (e.g. English) on the homepage, `translateHeadlinesOnly` modifies `art.title` on `publishedArticles` cards.
     - When a reader clicks a story, `handleSelectArticle(art)` passes the card object from `publishedArticles` directly to `ArticleReader`. This object has an English title but un-translated Hindi content and summary.
     - Solution: `handleSelectArticle` must always resolve the pristine master article from `baseArticles` by ID (`baseArticles.find(a => a.id === art.id)`), guaranteeing zero field pollution.
  2. *Bug 2 - Missing Translation of `summary` and `sub_title` (`server.js`)*:
     - In `articles.json`, `highlights` is often empty (`[]`), but `summary` contains Hindi text.
     - `server/server.js` sends `highlights: []` to Gemini, so Gemini returns `highlights: []`.
     - In `ArticleReader.jsx`, the 30-second bullet fallback renders `activeArticle.summary`. Because `summary` was never passed to Gemini, it remains in Hindi even though the box header ("30 வினாடிகளில்: முக்கியக் குறிப்புகள்") is in Tamil.
     - Solution: In `server/server.js`, if `highlights` is empty, automatically bridge `[targetArticle.summary]` as the highlight input for Gemini, and return translated `summary` and `sub_title`.
  3. *Bug 3 - Browser LocalStorage Poisoning & False-Positive Cache (`translationService.js`)*:
     - When a translation request encounters temporary rate-limiting (429) or network timeout, the fallback article (English title + Hindi content) gets stored in `localStorage` (`ps_art_obj_${id}_${lang}`).
     - `getCachedArticleObject` retrieves this corrupted cached object on subsequent visits without verifying if `content` is actually in the target language or still in Hindi, ignoring complete valid translations (e.g. 12,908 chars Tamil copy) already saved on the backend server.
     - Solution: Strict cache validation in `getCachedArticleObject` that automatically purges entries where `targetLang !== 'hi'` but body content remains in original Hindi.
  4. *Bug 4 - Lack of Clean Reader Skeleton / Loading State (`ArticleReader.jsx`)*:
     - While `translateArticle` is in progress, the reader immediately renders `displayArticle` with raw un-translated text, creating an unsightly flash of mixed languages before translation completes.
     - Solution: Render a clean broadsheet skeleton placeholder in the reader until the target translation is resolved.
- **Execution Strategy**: Per user direction, all 4 bugs are fully documented here and in `CHECKLIST.md` (Task 33) to be solved together in a dedicated future translation overhaul session.

## Decision 53: Two-Stage Deployment Lifecycle (Cloudflare Launch -> Personal VPS at Scale)
- **Status**: Approved by User & Formally Adopted
- **Context**: The project owner confirmed the production deployment lifecycle: launch immediately on the 100% free Cloudflare sovereign stack (Zero Credit Card, Pages + Workers + D1), and subsequently migrate backend and database to a dedicated Personal VPS once traffic scales to high volumes.
- **Approved Roadmap**:
  1. *Stage 1 (Launch & Initial Audience)*: Cloudflare Pages (Frontend) + Cloudflare Workers (API with Edge Caching & Telemetry Batching) + Cloudflare D1 SQL. Incurs zero costs, zero credit card requirements, zero maintenance, and handles initial district-wide readers effortlessly.
  2. *Stage 2 (High Traffic Scaling)*: When traffic explodes into tens of thousands of daily active readers, cleanly migrate the backend and database to a Personal Linux VPS (Hostinger India / UPI-paid, ₹250-₹350/mo) for un-metered compute, complete self-hosted ownership, and automated nightly backups.
- **Reasoning**: Combines immediate zero-cost launch speed with enterprise-grade future scalability and zero risk of vendor lock-in. Full playbook recorded in `project-planning/HOSTING_PLAN.md`.
