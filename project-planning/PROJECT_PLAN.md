# Project Plan — Admin Full Customization Suite (PublicSpark)

## 1. Project Goal
Transform PublicSpark into a fully customizable digital news platform where an administrator has complete, zero-code visual control over typography, ad placements, themes, branding, and layouts directly from the Admin Workspace.

## 2. Core Requirements
1. **Zero Code for Admin**: All adjustments must be performed through intuitive UI controls (dropdowns, sliders, quick preset buttons, toggles, color pickers, and upload fields).
2. **Typography & Font Customizer (Phase 1)**:
   - Google Fonts integration supporting English, Hindi, and 18 regional/global languages.
   - Font Family selector for Headings and Body copy.
   - Font Size dual control: Preset Quick Buttons (Compact, Normal, Large, Extra Large) AND smooth interactive Range Slider (with live px/rem indicator).
   - Real-time preview within Admin panel + instant persistence across the public site.
   - Continuous Font Boldness Slider (no fixed numbers, qualitative descriptors).
   - Top explicit Save & Apply Typography action bar with draft preview isolation.
3. **Typography Suite Elegance & Emoji Purge (Immediate Next Step)**:
   - Replace all casual emojis (`👑`, `📖`, `🗺️`, `🌐`, `⚡`, `💡`) with corporate Lucide SVG icons.
   - Polish language cards, preview desk, and headers to match the high-end broadsheet newsroom standard.
4. **Google AdSense Monetization & Ads Manager (Phase 2)**:
   - Configurable ad placements (Header Leaderboard 728x90, Sub-Headline, Mid-Article 300x250, Sidebar Sticky 300x600, Sticky Mobile Footer 320x50).
   - Google AdSense Publisher ID input (`ca-pub-XXXXXXXXXXXXXXXX`) directly from Admin Settings.
   - Support for Google AdSense Auto-Ads script injection + custom advertiser banners with tracking links.
   - 1-Click Enable/Disable switches per placement slot.
   - Root `/ads.txt` auto-generator and static verification file.
   - AdSense policy compliance: Mandatory Privacy Policy (with Google DART cookie disclosure), Terms of Service, About Us, Contact Us/Grievance Redressal, and Disclaimer pages.
5. **Theme & Branding Customizer (Phase 3)**:
   - Visual color pickers for Primary brand color, Accent/Breaking color, Dark/Light mode overrides.
   - Logo, Tagline, Favicon customizer.
6. **Layout & Homepage Section Manager (Phase 4)**:
   - Toggle visibility of Bento Hero, Trending Widget, Opinion Poll, and Editorial Stream.
   - Section reordering (Up/Down controls).
7. **Comprehensive News SEO & Google Discover Suite (Phase 5 / Core)**:
   - Dynamic meta tags per article (`<title>`, `<meta name="description">`, canonical URL).
   - Social discoverability: Open Graph (`og:image`, `og:title`, `og:description`, `og:url`) & Twitter Card (`summary_large_image`).
   - Schema.org Structured Data (JSON-LD): `NewsArticle`, `Organization`, `BreadcrumbList` for Google News & Google Discover carousels.
   - Dynamic Google News XML Sitemap (`/sitemap.xml`) with `<news:news>` publication tags.
   - Search engine crawler directives (`/robots.txt`).
   - Multilingual `hreflang` tags across all 19 supported languages.
   - Clean crawlable news URL architecture.


## 3. Architecture & New Core Specifications
- **Database (Supabase PostgreSQL / Server JSON fallback)**:
  - `translations` table: `(article_id, lang)` unique composite key, `title`, `highlights` (JSONB), `body`, `status` (`pending`|`done`|`failed`), `content_hash`, `created_at`, `updated_at`.
  - `audio_records` table: `(article_id, lang, clip_type)` unique composite key, `audio_url`, `duration_seconds`, `size_bytes`, `last_played_at`.
  - `daily_usage` table: `(usage_date, provider, feature)` unique key tracking daily requests against API limits.
- **Writer Workflow**:
  - Simplified submission form: Headline, Body, Featured Image (+ caption & credit), Category, and Tags.
  - Pre-publish 1-call Gemini AI generation of 2-3 bullet points ("In 30 seconds" highlights) with Hindi spelling/grammar review.
  - Instant live in Hindi on publish click.
- **Lazy Translation & In-Flight Lock**:
  - Translation triggered only when reader views an unsaved language.
  - UI displays original Hindi with "अनुवाद बन रहा है..." indicator.
  - Mutex lock per `(article_id, lang)` so concurrent readers await the same promise.
  - Strict pre-save validation: all sections present, equal paragraph count, exact number/date/license plate preservation, zero error strings.
- **2-Stage Gemini Audio TTS ("Listen")**:
  - Server-side Gemini TTS generated only on user click.
  - Clip 1: Headline + 30-sec highlights.
  - Chime cue + 2-second pause.
  - Clip 2: Full Body, requested *only* after user listens to Clip 1 for > 5 seconds.
  - Excludes captions, credits, button texts, and disclaimers.
  - Auto-hide Listen button in Assamese (`as`).
  - Fallback to browser voice (`window.speechSynthesis`) when TTS quota is exhausted.
- **Abuse Guardrails & Hygiene**:
  - 19 supported languages only; published articles only.
  - Per-IP hourly limit + daily total cap with graceful fallback to Hindi.
  - 100% removal of MyMemory / scraper endpoints; purge of legacy error strings from DB.

