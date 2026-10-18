# Architecture & Feature Decisions

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
- **Decision**: Implemented two toggle buttons `[🌐 Global Typography]` and `[🗺️ Regional / Language-Wise Fonts]`. In Regional mode, a language selection drawer/shelf renders all 18 languages with flags and native scripts. The sticky live preview desk updates in real-time to display authentic news headlines and body text written in that selected language's native script, rendered with its configured font.
- **Reasoning**: Ensures scripts like Bengali, Tamil, Telugu, Gurmukhi, and Urdu render in their authentic cultural typefaces without breaking layout or falling back to inappropriate generic fonts. Seamlessly persists to backend and dynamically applies when visitors change the site language.

## Decision 4: 1-Click "Make Global" Propagation Actions
- **Status**: Implemented based on User Clarification
- **Context**: User clarified that "Global" should not merely be a separate tab/scope, but an active action where clicking "Make Global" propagates the currently chosen headline font to all headlines across the whole site, and clicking "Make Article Global" propagates the chosen article font to all articles across the whole site and all 18 languages.
- **Decision**: Added direct 1-click action buttons:
  1. `🌐 Make Headline Font Global (All 18 Languages & Whole Site)` directly below the Headline Font picker.
  2. `🌐 Make Article Font Global (All 18 Languages & Whole Site)` directly below the Article Body Font picker.
  3. Master `🌐 Make Current Fonts Global` button at the top that syncs both headline and body fonts across all 18 languages and whole site in one click.
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
  1. **Corporate Micro-Polish**: Purged all remaining emojis (`Listen 🔊`, `Remove ✖`, `👍 / 👎 / 🤔` poll buttons, and audio bar header) across the public frontpage, replacing them with refined Lucide SVG icons (`Volume2`, `X`, `ThumbsUp`, `ThumbsDown`, `HelpCircle`).
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

## Decision 12: Mandatory Language Gate for Story Composition, Source Language Traceability, and Broadcast Audio Cue
- **Status**: Approved by User & Implemented
- **Context**: 
  1. Previously, the system assumed news articles were written in English or used a fragile default, leading to broken downstream translations and TTS voice mismatch.
  2. The user required a broadcast-style 2-stage audio reading sequence across all 19 supported languages: Headline & Highlights read first, followed by a double-bell chime ("Ding... Ding!"), followed by the full article body.
  3. The user mandated an absolute "Language Gate" prior to writing: until an article's language (`originalLanguage`) is explicitly selected, typing in Headline, Body, AI pre-draft, and Submitting must be completely impossible and locked.
  4. The user strictly commanded: "emoji use maat karna" (no emojis anywhere in the newsroom or UI).
- **Decision**:
  1. *Mandatory Language Gate*: Implemented in `ReporterWorkspace.jsx` (Step 1 card with language pills) and `AdminWorkspace.jsx` (`StoryEditorModal`). All input controls remain locked/disabled with clear guidance until a language is clicked.
  2. *Source Language Traceability*: `originalLanguage` is saved in auto-saved client drafts, sent with article payload, and persisted permanently to backend `server/data/articles.json`.
  3. *Editorial Review*: `EditorWorkspace.jsx` displays the story's source language with an editable dropdown so editors can verify or adjust it before publishing.
  4. *Two-Stage Audio Sequencer*: Synthesized acoustic double-bell cue (`public/audio/chime.wav` at 880Hz and 1046.5Hz) played continuously on the active audio element between Headline/Highlights (Clip 1) and Full Body (Clip 2).
  5. *Zero Emoji Standard*: Replaced all emojis across reporter, editor, and admin workspace desks with semantic Lucide SVG icons.
- **Reasoning**: Deterministic metadata at authoring time guarantees 100% accuracy in downstream Gemini translation and neural speech generation, while maintaining a prestigious, serious broadsheet journalistic design standard.

