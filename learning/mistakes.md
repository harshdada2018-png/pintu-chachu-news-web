# Learning & Mistakes Record

This document records significant mistakes, root causes, verified solutions, and prevention methods to ensure high quality and prevent regression.

## Records

### Mistake 1: Misinterpreting "Global Font" as passive scope mode instead of active propagation action
- **Mistake**: Implemented "Global" solely as a separate static view/mode instead of giving the admin an active button to propagate the currently selected font across all languages and the entire site simultaneously.
- **Root Cause**: Assumed "Global" and "Regional" were static decoupled settings rather than realizing that when an admin selects a font they love, they want a 1-click "Make Global" button to apply that headline or article font to all languages/site-wide.
- **Verified Solution**:
  1. Add direct 1-click action buttons:
     - `🌐 Apply this Headline Font across Entire Site (All Languages)`
     - `🌐 Apply this Article Font across Entire Site (All Languages)`
     - `🌐 Make Global: Sync Both Fonts to Entire Website (All 18 Languages)`
  2. Clicking this automatically copies the active font to `headingFont` / `bodyFont` AND syncs all 18 entries in `regionalFonts`, giving the user instant confirmation and total uniform typography across the entire platform.
- **Prevention Method**: Always verify whether a "global" requirement implies a passive fallback state or an active action to overwrite/propagate settings to all entities.

### Mistake 2: Temporal Dead Zone (TDZ) ReferenceError on `currentLanguage` in `App.jsx`
- **Mistake**: The website showed a blank/white screen because of `ReferenceError: Cannot access 'currentLanguage' before initialization` in `App.jsx`.
- **Root Cause**: `useEffect` applying live typography styles referenced `currentLanguage` on line 117 & 137, while `const [currentLanguage, setCurrentLanguage] = useState('en')` was declared lower down on line 287. In JavaScript, `const` variables are hoisted but uninitialized until execution reaches their declaration (Temporal Dead Zone), crashing React during render.
- **Verified Solution**: Moved `currentLanguage` and `isTranslating` state declarations up near the top of `App.jsx` (before any hook or effect that reads them). Verified with `npx vite build` and runtime HMR check.
- **Prevention Method**: Always declare core application-level state variables at the top of the component function before any `useEffect` or dependent handlers. Run `npx vite build` and check dev server logs immediately after moving or refactoring state logic.

### Mistake 3: Hardcoded CSS Gradients and Ambient Pseudo-Elements Overriding Dynamic Theme Palette
- **Mistake**: When the Admin selected "The Grand Broadsheet" or other palettes, the outer website still displayed bright purple buttons ("Newsroom Management", "Create Custom Story", active category tabs) and retained a purple atmospheric haze over the page.
- **Root Cause**: 
  1. Primary buttons (`.btn-primary`) and active category tabs (`.category-link.active`) used `background: var(--gradient-accent)`. `--gradient-accent` was hardcoded in `src/index.css` to `linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)` and was never dynamically updated.
  2. `body::before` in `src/index.css` had a fixed 50vw radial-gradient purple floating mesh orb (`rgba(99, 102, 241, 0.18)` with 90px blur), tinting the top-left background purple regardless of `--bg-primary`.
  3. `src/App.jsx` only set `--accent-indigo`, omitting `--gradient-accent`, `--border-dark`, and direct `document.body.style.backgroundColor`.
- **Verified Solution**:
  1. Bound `--gradient-accent` directly to `var(--accent-indigo)` and updated `.btn-primary` and `.category-link.active` to use `var(--accent-indigo)` with clean neutral elevation shadows.
  2. Set `body::before, body::after { display: none !important; }` to eliminate all atmospheric purple tint and preserve crisp broadsheet newsprint contrast.
  3. Enhanced `src/App.jsx`'s `useEffect([themePalette])` to inject `--gradient-accent`, `--border-dark`, `--glass-border`, and update `document.body.style.backgroundColor` and `document.body.style.color` immediately on change.
- **Prevention Method**: When implementing theme customizers, audit the global stylesheet for all static gradients, pseudo-elements (`::before`, `::after`), and fixed background overlays to ensure they are either removed or driven strictly by dynamic theme CSS variables.

### Mistake 4: Missing `useMemo` Import in `Header.jsx` Causing Runtime ReferenceError and Blank Screen
- **Mistake**: The website displayed a blank/white screen when opening `http://localhost:5173/`.
- **Root Cause**: When dynamically deriving breaking news headlines from `articles` in `Header.jsx`, `useMemo` was used to memoize `breakingItems` without adding `useMemo` to the `import React, { ... } from 'react'` declaration at the top of `Header.jsx`. This triggered `ReferenceError: useMemo is not defined` during the render phase, crashing the component tree.
- **Verified Solution**: Added `useMemo` to the React import line in `Header.jsx`. Verified with `npx vite build` (built cleanly) and verified dev server log confirmed successful HMR update.
- **Prevention Method**: Whenever utilizing React hooks (`useMemo`, `useCallback`, `useRef`, etc.), immediately check the file's top import statement to ensure the hook is explicitly imported.

### Mistake 5: Hardcoded Breaking News Ticker Bar Gradient Ignoring Custom Color Palette
- **Mistake**: When the Admin customized the "Breaking News Alert" color (`accentCrimson`) in the Color Palette Suite (e.g. to `#b19635`), the preview desk showed the change, but the actual breaking news ticker bar at the top of the website remained bright red (`#DC2626`).
- **Root Cause**: 
  1. `.ticker-bar` in `src/index.css` had a static background gradient `linear-gradient(90deg, #DC2626 0%, #991B1B 100%)` and hardcoded red box shadow, completely ignoring `var(--accent-crimson)`.
  2. `ColorPaletteCustomizer.jsx` initialized `localTheme` only on mount without a `useEffect` watching `currentTheme`, preventing it from synchronizing when `currentTheme` loaded asynchronously from `/api/settings/theme`.
- **Verified Solution**:
  1. Updated `.ticker-bar` in `src/index.css` to `background: var(--accent-crimson);` with `box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);` and smooth background transition.
  2. Updated `@keyframes pulse` to use clean opacity scaling instead of hardcoded red box-shadows.
  3. Added `--accent-crimson-hover` alongside `--accent-crimson` in `src/App.jsx`.
  4. Added `useEffect([currentTheme])` to `src/components/admin/ColorPaletteCustomizer.jsx` to keep local controls synchronized with active backend theme settings.
  5. Verified with `npx vite build` (clean exit code 0).
- **Prevention Method**: When implementing theme palettes, audit every prominent component's CSS classes to ensure no legacy hardcoded color gradients override the dynamic CSS variable tokens.

### Mistake 6: Exposing Competitor Newsroom Brand Names and Moodboard Annotations in CMS UI
- **Mistake**: The Preset Selection cards in the Color Palette Suite displayed competitor newsroom names and moodboard research citations (`Inspiration: The New York Times, The Atlantic`, `Inspiration: BBC News, Reuters`, `The Guardian Spectrum`, etc.).
- **Root Cause**: During initial design system research, moodboard notes comparing palettes to well-known publications were directly transferred into preset data objects (`inspiration: "..."`) and rendered in client-facing cards (`Inspiration: {preset.inspiration}`). In enterprise-grade newsroom software (e.g. Arc XP, Chorus, WordPress VIP), printing rival publisher names compromises brand sovereignty, creates legal/trademark ambiguity, and appears amateurish.
- **Verified Solution**:
  1. Completely purged all competitor brand names (`The New York Times`, `The Atlantic`, `BBC News`, `Reuters`, `The Guardian`, `Financial Times`, `Bloomberg`, `The Verge`, `Wired`, `Axios`, `Semafor`, `Dainik Bhaskar`, `The Hindu`, `National Geographic`, `Monocle`, `GQ`, `ProPublica`) from `server/data/presets.json` and all UI components.
  2. Renamed preset `"The Guardian Spectrum"` to sovereign editorial title `"Metropolitan Editorial Spectrum"` with ID `editorial-spectrum`.
  3. Replaced the `inspiration` field with a professional editorial beat attribute (`"beat": "National Affairs & Investigative Journalism"`, `"beat": "Markets, Commerce & Macroeconomics"`, etc.) displayed as a refined corporate pill badge.
  4. Purged emojis from font catalog badges in both `server/data/presets.json` and `VisualFontPicker.jsx` to enforce strict corporate typography standards.
  5. Updated technical documentation (`UI_UX_TDR.md` and `DECISIONS.md`) to remove competitor citations.
- **Prevention Method**: Never carry external benchmark or moodboard references into user-facing UI, metadata, preset labels, or production database records. All design presets and feature sets must stand on their own merits with sovereign, authentic newsroom beat nomenclature.

### Mistake 7: In-Article Font Scaler (A- / A / A+) Toggled Button State Visually but Failed to Resize Article Content
- **Mistake**: Clicking `A-`, `A`, or `A+` in the Article Reader updated the active button highlight in the pill menu, but the article's actual text size did not change at all.
- **Root Cause**: 
  1. `src/utils/markdownRenderer.jsx` had an internal wrapper `div` with an inline hardcoded style `fontSize: '1.1rem'`, which completely overrode any font size specified on parent containers.
  2. `ArticleReader.jsx` was not passing the computed `fontSize`, `fontSizeMode`, or `lineHeight` props down to `MarkdownRenderer`.
  3. The headline and standfirst elements had static rem values and were not responsive to reader scaling.
- **Verified Solution**:
  1. Updated `src/utils/markdownRenderer.jsx` to accept `fontSize`, `fontSizeMode`, and `lineHeight` props, and eliminated the hardcoded `1.1rem` inline style.
  2. Made the editorial drop-cap first letter scale dynamically (`2.8rem` on `sm`, `3.4rem` on `md`, `4.2rem` on `lg`).
  3. Linked `h1.headline` (`2.15rem` -> `2.5rem` -> `2.85rem`), `p.story-excerpt` (`1.05rem` -> `1.2rem` -> `1.38rem`), and `MarkdownRenderer` body content (`0.92rem` -> `1.15rem` -> `1.42rem`) directly to `fontSizeMode`.
  4. Added smooth CSS transitions (`transition: 'font-size 0.2s ease, line-height 0.2s ease'`) so the text visually morphs smoothly between sizes.
  5. Verified with `npx vite build` (clean exit code 0).
- **Prevention Method**: When implementing client-side font scaling, always inspect the DOM hierarchy and child markdown/rich-text rendering components for nested inline font sizes or hardcoded CSS rules that override inherited parent typography.

### Mistake 7: Stale Scraper Error Strings Persisting in Browser LocalStorage & Aggressive Fetch Timeout
- **Mistake**: When the reader opened an article in Bengali, the main body rendered `QUERY LENGTH LIMIT EXCEEDED. MAX ALLOWED QUERY : 500 CHARS` even though `GEMINI_API_KEY` was configured and working on the backend.
- **Root Cause**:
  1. **Stale LocalStorage Cache**: Before the Gemini API key was added, testing with the former unofficial MyMemory scraper hit character limits and returned `"QUERY LENGTH LIMIT EXCEEDED. MAX ALLOWED QUERY : 500 CHARS"`. The frontend cached this error string in browser `localStorage` under `ps_art_obj_art-1_bn`. When `translateArticle` executed, `getCachedArticleObject` returned the cached error string without validating its content or checking if it was an error message.
  2. **Short Fetch Timeout**: `translateArticle` had a hardcoded `10000ms` (10s) timeout. Full article translation with Gemini can take 11–13s for non-Latin scripts. The frontend aborted the request (`AbortError`), falling back to snippet translation which also pulled the stale `localStorage` scraper error.
- **Verified Solution**:
  1. Updated `getCachedArticleObject` and `translateText` in `src/services/translationService.js` to strictly reject and delete any cached entry containing `"QUERY LENGTH"`, `"MAX ALLOWED QUERY"`, or `"MYMEMORY"`.
  2. Added an automatic startup cleanup sweep in `src/services/translationService.js` that purges any corrupted legacy cache entries from `localStorage` on page load.
  3. Added safety fallback in `ArticleReader.jsx` (`safeDisplayArticle`) that prevents error strings from ever rendering in the reader view.
  4. Increased `fetchWithTimeout` to `30000ms` (30s) to comfortably accommodate full article AI inference.
  5. Updated backend model priority in `server/server.js` to `gemini-3.5-flash-lite`, which is 3x faster and avoids free tier rate limits.
- **Prevention Method**: Whenever deprecating an old API or scraper that previously wrote to client-side storage, always include an automatic cache-cleansing routine and validate cached objects against known error signatures before serving them to the UI.

### Mistake 8: Vite Dev Server Proxy Missing `/uploads` Route Causing Gemini TTS Audio Playback Failure
- **Mistake**: When user clicked "Listen to Story", the backend generated high-fidelity WAV speech with Gemini (`gemini-3.8-flash-tts`), but the browser threw `[Two-Stage TTS Exception] Failed to load because no supported source was found`, falling back to robotic browser speech.
- **Root Cause**: In `vite.config.js`, the proxy was only set up for `/api` (`target: 'http://127.0.0.1:5000'`), omitting `/uploads`. When the browser requested `/uploads/audio_art-1_hi_clip_1_intro.wav`, Vite's SPA fallback served `index.html` with `Content-Type: text/html`. The browser's native Audio decoder threw an error when attempting to decode HTML as audio data.
- **Verified Solution**:
  1. Added `/uploads` route to `server.proxy` in `vite.config.js` targeting `http://127.0.0.1:5000`.
  2. Upgraded the static file handler in `server/server.js` to support HTTP 206 Partial Content, `Content-Length`, and `Accept-Ranges: bytes` for instantaneous seeking and accurate duration detection in all modern browsers.
  3. Verified that requesting `http://localhost:5173/uploads/audio_art-1_hi_clip_1_intro.wav` returns `HTTP 200 Content-Type: audio/wav Accept-Ranges: bytes Length: 382436`.
- **Prevention Method**: Whenever media assets (audio, video, uploads) are saved to disk and served by a backend server in a Vite development environment, always proxy the asset path (`/uploads`, `/media`) alongside `/api` in `vite.config.js`.

### Mistake 9: Unhandled `ReferenceError: safeDisplayArticle is not defined` in `ArticleReader.jsx` Causing Blank White Screen
- **Mistake**: Opening `http://localhost:5173/` rendered a completely blank white screen.
- **Root Cause**: During the language toggle update in `ArticleReader.jsx`, the line `const safeDisplayArticle = isCorruptedContent ? article : (displayArticle || article);` was accidentally omitted while defining `const activeArticle = showOriginal ? article : safeDisplayArticle;`. In React, an unhandled ReferenceError during component render crashes the component tree, leaving the DOM `#root` unmounted and rendering white.
- **Verified Solution**:
  1. Restored `safeDisplayArticle` and verified the syntax in `src/components/public/ArticleReader.jsx`.
  2. Verified `npx vite build` completed cleanly in 386ms.
  3. Restarted fresh Vite dev server process (`task-998`), confirming clean reload with 0 errors.
- **Prevention Method**: Always verify that every variable referenced in JSX or child component props is defined in scope before testing or reloading. Check the active dev server log output immediately after any component edit.

### Mistake 10: Single-Model Quota Lock (429) & Disconnected `new Audio()` Autoplay Blocker on Clip 2
- **Mistake**: When user listened to an article, the intro/highlights read out, but the main story body never played ("artical reading nahi ho rahe keya").
- **Root Cause**:
  1. Google AI Studio imposes a strict 10 requests/day limit on `gemini-3.8-flash-tts` on the free tier. When this model hit 429, the backend immediately threw without trying healthy sibling models (`gemini-3.8-flash-lite-tts`, `gemini-2.5-flash-preview-tts`), both of which were completely active and functional.
  2. Clip 2 was being created in a detached `setTimeout(..., 2000)` as a separate `new Audio()` object. In Brave Browser and Chromium, background audio creation without a fresh direct user click is blocked by browser Autoplay shields (`{"isTrusted": true}` error).
  3. `TextToSpeech.jsx` had an empty `onError` hook, so when Clip 2 errored, it silently stopped rather than speaking the body via fallback.
- **Verified Solution**:
  1. Updated `server/server.js` model pool to prioritize `gemini-3.8-flash-lite-tts` and `gemini-2.5-flash-preview-tts` and catch 429s to seamlessly roll over to the next healthy model. Verified with live test calls (both generated 367 KB and 539 KB WAV files).
  2. Redesigned `geminiAudioEngine.js` to a single persistent `HTMLAudioElement` pipeline: `activeAudio` transitions sequentially from Clip 1 -> Chime -> Clip 2 directly within media `ended` events, preserving browser autoplay authorization throughout.
  3. Updated `public/audio/chime.wav` to 2.2s with harmonic chime and gentle acoustic decay for the respectful pause.
  4. Wired `onFallbackToBrowser` in `TextToSpeech.jsx` so if any neural audio clip ever encounters an issue, browser speech immediately reads the body text.
### Mistake 11: Missing Draft Auto-Save & Lack of Backend Persistence for Reporter Articles Causing Data Loss on Page Refresh
- **Mistake**: When user was typing an article in the Writer Desk (`ReporterWorkspace.jsx`) or published an article and refreshed the page, the article was deleted and vanished from the site.
- **Root Cause**:
  1. *Unsaved typing draft*: Form state (`title`, `content`, `tags`, etc.) existed only in component React `useState` without auto-saving to `localStorage`. Page reload immediately wiped all active typing.
  2. *Missing backend persistence*: When clicking "Publish Story", `handleAddNewArticle` in `src/App.jsx` updated in-memory state and browser cache but never issued a `POST /api/articles/update` to the backend server.
  3. *Overwrite on initial fetch*: On page refresh, `src/App.jsx` executed `fetch('/api/articles')`. Since the backend never received the new article, it returned the static server articles and immediately overwrote both `baseArticles` React state and `localStorage` cache.
- **Verified Solution**:
  1. Added real-time draft auto-save to `localStorage` (`ps_reporter_draft_v1`) in `ReporterWorkspace.jsx` with automatic restoration banner, auto-saved active indicator, and "Clear Form (Discard Draft)" button.
  2. Integrated `POST /api/articles/update` into `handleAddNewArticle` and `handleApproveArticle` in `src/App.jsx` to permanently persist articles into `server/data/articles.json`.
  3. Added smart merging in `src/App.jsx`'s initial `fetch('/api/articles')` effect so local articles are preserved and synced rather than overwritten.
  4. Initialized physical `server/data/articles.json` file in backend storage.
  5. Verified with `npm run build` (clean 0 exit code).
- **Prevention Method**: Always persist user-generated content in two tiers: live client-side auto-save (`localStorage`) during editing to guard against accidental refreshes, and immediate backend API persistence (`POST`) upon publishing.

### Mistake 12: Broken Drop-Cap Glyph from UTF-16 Surrogate Pair Slicing & Hardcoded English Translation Bypass
- **Mistake**: 
  1. Article body displayed a giant black diamond with a question mark beside emojis or symbols (e.g. `💥` or `❖`).
  2. Selecting English or translating Hindi articles into other languages failed or returned raw Hindi.
  3. "Key Highlights" displayed an unwanted hardcoded English line: `Full investigative briefing, background context, and verified data detailed below.`
- **Root Cause**:
  1. *Unicode Corrupted Glyph*: In `src/utils/markdownRenderer.jsx`, editorial drop-caps used `trimmed.charAt(0)` and `trimmed.slice(1)`. For 4-byte UTF-16 characters like emojis (`💥` = `\uD83D\uDCA5`), `.charAt(0)` sliced only the high surrogate (`\uD83D`), rendering an orphaned invalid Unicode codepoint as the replacement character.
  2. *False Base Language Assumption*: Codebase hardcoded `if (targetLang === 'en') return article;` across `translationService.js` and `server/server.js` under the assumption that base articles were written in English. Since articles are written in Hindi, selecting English returned raw Hindi without calling Gemini.
  3. *Default Site Language*: `src/App.jsx` defaulted `currentLanguage` to `'en'`, causing the reader to show `[🔤 मूल समाचार (Hindi)]` on initial load even though the content was already in Hindi.
- **Verified Solution**:
  1. Restricted editorial drop caps strictly to Latin English letters (`/^[A-Za-z]$/`), leaving Hindi matras, symbols, and emojis completely intact without surrogate pair splitting.
  2. Updated `server/server.js`, `src/services/translationService.js`, and `src/App.jsx` to treat Hindi (`'hi'`) as the sovereign base language, allowing Gemini to translate cleanly into English (`'en'`) and all 18 regional/international languages. Verified live translation with `node -e fetch(...)`.
  3. Filtered out any legacy fallback string (`full investigative briefing`) in `ArticleReader.jsx` highlights list.
  4. Verified with `npm run build` (built cleanly in 370ms).
- **Prevention Method**: Never use `.charAt(0)` or `.slice(1)` for typography effects on multilingual or emoji text. Always test that translation bypasses align with the newsroom's actual primary language (Hindi) rather than assuming English.

### Mistake 13: Writing Articles Without Explicit Source Language Declaration & Unprofessional Emoji Usage
- **Mistake**: Reporters and editors could draft and submit stories without declaring what language the article was written in, leading to misclassified articles and broken translation/TTS. UI also contained unprofessional emojis contrary to broadsheet standards.
- **Root Cause**:
  1. *Implicit Language Assumption*: The platform relied on global fallbacks rather than requiring the author to declare the story's source language. Downstream AI translation and neural voice engines require deterministic source language codes to function properly.
  2. *Premature Form Input*: Form inputs were enabled immediately on load, allowing reporters to write and submit without ever selecting a language.
  3. *Emoji Clutter*: Status badges and button labels included consumer emojis (`🚀`, `🔥`, `💡`, `🟢`, `🔴`), undermining the authoritative, professional news brand.
- **Verified Solution**:
  1. Implemented a strict **Language Gate** in `ReporterWorkspace.jsx`: all drafting fields (Headline, Body, Highlights, Photo upload, Category, Tags, Submit button) are strictly locked and disabled until an explicit language pill is selected.
  2. Persisted `originalLanguage` in client-side auto-saved drafts and in `newStory` payload sent to backend database.
  3. Added an editable "Article Source Language" selector in `EditorWorkspace.jsx` and `AdminWorkspace.jsx` (`StoryEditorModal`).
  4. Updated `handleApproveArticle` in `src/App.jsx` to preserve and persist `originalLanguage` to backend `server/data/articles.json`.
  5. Purged all emojis from workspace desks, replacing them with clean, semantic Lucide SVG icons (`<Languages />`, `<Lock />`, `<Check />`, `<Sparkles />`).
  6. Verified frontend compilation with `npm run build` (0 errors, 407ms).
- **Prevention Method**: Always enforce data integrity at the moment of entry. When downstream pipelines depend on critical metadata (such as source language), make the selection mandatory before input fields can be activated. Avoid emojis in professional journalism software.

### Mistake 14: Translating Static UI Chrome via Dynamic API Calls & Unwanted UI Emojis
- **Mistake**: UI elements (buttons, navigation tabs, section headers, reader controls, poll options) either remained in English when the user switched language, or risked consuming Gemini API quotas for static UI chrome. In addition, emojis lingered in ticker headlines and toast messages.
- **Root Cause**:
  1. *Lack of In-Memory Localization Dictionary*: The translation engine was designed solely for dynamic article text using Gemini API calls. Calling an LLM API to translate fixed UI strings ("Listen", "Share", "Read full story", "Daily Poll") wastes daily quota, adds network latency, and causes flickering.
  2. *Static Header & Home Elements*: Buttons and badges in `Header.jsx`, `App.jsx`, `ArticleReader.jsx`, `TextToSpeech.jsx`, and `SearchPage.jsx` were hardcoded in English or Hindi without reactive language binding.
- **Verified Solution**:
  1. Built a high-performance, client-side in-memory localization engine in `src/services/uiTranslations.js` covering all 19 supported languages (`hi, en, bn, mr, te, ta, gu, kn, ml, pa, or, as, ur, fr, it, ja, id, zh-TW, ru`).
  2. Exposed helper functions `t(key, lang, fallback)` and `translateCategoryName(categoryName, lang)` with 0ms execution and zero external network calls.
  3. Bound all UI chrome across `Header.jsx`, `App.jsx`, `ArticleReader.jsx`, `TextToSpeech.jsx`, and `SearchPage.jsx` to `t()`.
  4. Purged all remaining emojis from `mockData.js`, toast notices, and modal titles.
  5. Verified compilation with `npm run build` (clean exit code 0 in 396ms).
- **Prevention Method**: Never use LLM API calls to translate fixed UI chrome, buttons, or navigation labels. Always use an in-memory client-side lookup table for static UI strings, reserving API quota strictly for dynamic news content.
