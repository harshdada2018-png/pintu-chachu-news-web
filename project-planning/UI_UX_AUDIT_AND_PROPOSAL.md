# Public Spark — UI/UX Audit & Editorial Redesign Proposal (Phases 1 & 2)

**Document Status:** Pending User Review & Approval  
**Audit Date:** 2026-10-25  
**Version:** 3.0 Baseline Editorial Redesign  

---

## Part 1: Phase 1 — Comprehensive Pre-Coding Audit

### 1. Architectural & Technical Stack Overview

| Dimension | Current Implementation | Editorial Assessment |
| :--- | :--- | :--- |
| **Framework** | React 19 SPA powered by Vite | Fast HMR (600ms build); no heavy external UI dependencies |
| **Styling Engine** | Vanilla CSS via `src/index.css` with runtime CSS variable injection | Highly flexible; requires token consolidation (too many ad-hoc inline styles) |
| **Routing** | URL-based history router (`parseRouteFromUrl` in `App.jsx`) | Supports `/article/:slug`, `/search`, `/reporter`, `/editor`, `/admin`, hash fallback |
| **Icons** | Lucide React (`lucide-react`) + custom SVG paths | Clean, professional SVG vectors; 100% emoji-free |
| **Typography System** | Google Fonts dynamically loaded; CSS variables `--font-serif`, `--font-sans` | Headline fonts (`Playfair Display`, `Noto Serif Devanagari`), UI fonts (`Plus Jakarta Sans`) |
| **Design Tokens** | `:root` in `src/index.css` + `settings.json` theme overrides | Currently uses excessive border radii (`14px` - `20px`), causing a generic SaaS aesthetic |

---

### 2. Forensic Asset & Media Inspection

#### A. Header Sponsor Banner Test Asset
* **File:** [`server/data/uploads/img_sponsor_header_1792749746636.webp`](file:///d:/my%20projects/pintu%20chachu%20news%20web/server/data/uploads/img_sponsor_header_1792749746636.webp) (139 KB).
* **User Confirmation:** This banner was intentionally uploaded by the user to test the custom sponsor advertisement feature.
* **Resolution:** Ad system is verified and working as intended. Maintain user-configured test ad banner while ensuring the container dimensions and editorial styling around the ad unit are clean and broadsheet-aligned.

#### B. Logo Background Transparency Audit
* **File:** [`public/logo.png`](file:///d:/my%20projects/pintu%20chachu%20news%20web/public/logo.png) (35.5 KB).
* **Binary Analysis:** Color type 6 (RGBA with alpha channel).
* **Pixel Inspection:** The first pixel buffer value is `0xFF 0xFF 0xFF 0xFF` (`[255, 255, 255, 255]` — **Solid Opaque White**).
* **Impact:** The logo does **NOT** have a transparent background. When placed over dark mode canvas (`#050711`), warm newsprint (`#F8FAFC` / `#FAF8F5`), or tinted containers, it displays an unappealing solid white rectangular box around the pen-cannon emblem and wordmark.
* **Required Fix:** Convert `public/logo.png` to have a true alpha transparent background (or provide an inline SVG vector brandmark) so it floats seamlessly over both light newsprint and dark carbon modes.

---

### 3. Component-by-Component Issue List

| Component | Observed Problem | Proposed Architectural Fix | Expected Editorial Outcome |
| :--- | :--- | :--- | :--- |
| **Header & Masthead** (`Header.jsx`) | Consumes > 220px vertical height; splits utility bar, centered logo, breaking ticker, and category pills into 4 disparate stacked rows. Redundant view switcher and weather widget clutter top utility row. | Consolidate into a compact, unified 2-row editorial masthead: (Row 1) Sleek utility bar with date, language switch, search, and theme toggle; (Row 2) Authoritative horizontal masthead with inline logo, editorial tagline, and clean inline category navigation. | Headlines appear above the fold on standard laptop screens without aggressive scrolling. Clean, cohesive broadsheet identity. |
| **Breaking News Ticker** (`Header.jsx`, `index.css`) | 48px bright crimson bar with heavy drop-shadows and pulsing dot. Creates excessive urgency fatigue and visual clash with article photography. | Streamline into a low-profile, hairline editorial alert strip (32px) integrated directly beneath or within the masthead with crisp typography and subtle pause/play control. | Urgent stories remain immediately legible without visually overwhelming the editorial lead story. |
| **Lead Hero Story Card** (`App.jsx`, `index.css`) | Overloaded with 7 competing badges/counters: Category pill, Breaking flame, Fact-checked shield, Listen button, Author byline, Time read, Views count, Likes count. Massive 20px card corner radius resembles a consumer mobile app. | Adopt a disciplined broadsheet hierarchy: crisp 4px or 0px hairline borders, single prominent category tag, refined author byline with date/time, and secondary metrics (views/likes) relegated to article reader only. | The photography and investigative headline take center stage, establishing journalistic gravitas. |
| **Secondary & Grid Cards** (`App.jsx`) | Repetitive cards with identical 200px image heights, repetitive pill buttons (`Listen`, `Bookmark`, `Category`), and redundant view/like metrics. | Implement a story-driven layout: Lead story accompanied by high-density headline list and editorial split cards (compact 16:9 thumbnail + 2-line headline) prioritizing story diversity over repetitive white cards. | Scannability improves 3x; readers can digest 6-8 stories in a single glance rather than scrolling past identical bloated cards. |
| **Supporting Sidebar** (`App.jsx`) | Stacks three large independent rounded cards (Editor's Spotlight, Trending 01-03, and Daily Poll) with conflicting accent colors (Amber, Crimson, Indigo). | Unify into an authoritative single-column "Editorial Dispatch & Analysis" rail with consistent 1px hairline dividers and subtle typography hierarchy. | Clean editorial structure with zero visual clutter. |
| **Partner & Ad Units** (`PartnerUnit.jsx`) | Displaying accidental GPU error screenshot in header; dashed placeholder boxes with technical configuration text ("Upload sponsor poster in Admin Desk > Monetization...") visible to readers on localhost. | When ads are unconfigured or unfilled, render either a clean, designed editorial self-promo / subscription / newsletter dispatch or collapse to zero height (0 DOM footprint). | No technical placeholders or broken states ever visible to readers. |
| **Article Reader** (`ArticleReader.jsx`) | Top controls bar has 5 adjacent pill buttons (Back, Font Scaler, Language toggle, Share, Bookmark); multiple reaction buttons with mock counters at the bottom. | Refine reader header into a quiet, distraction-free reading toolbar. Standardize font scaler and byline. Strip arbitrary reaction counters from news stories. | Elevates the reading experience to the standard of premier editorial publications. |
| **Writer Desk** (`ReporterWorkspace.jsx`) | Mandatory language gate works well, but layout has excessive vertical spacing between fields and redundant badges. | Tighten spacing, make headline and full-bleed markdown editor the undisputed centerpiece, group metadata (category, tags, credits) in a clean right-hand publishing sidebar. | Fast, distraction-free reporting desk. |
| **Editorial Desk** (`EditorWorkspace.jsx`) | When queue is empty, displays an oversized blank workspace with conflicting status counts. Headline generator creates generic formulaic titles. | Build a clean, purposeful empty state with queue statistics; when reviewing, provide a realistic split-screen article preview alongside one-click approve/reject actions. | Editors can rapidly vet and publish stories with zero confusion. |
| **Admin Control Desk** (`AdminWorkspace.jsx`) | Sidebar navigation has 9 items with varying label lengths; story list lacks compact table view; action buttons (Edit, Hide, Delete) lack visual hierarchy. | Reorganize admin navigation into 3 logical clusters (Content & Editorial, Audience & Distribution, Settings & Design); introduce compact tabular story list with clear status pills and modal confirmation on deletion. | Fast, institutional-grade CMS administration. |

---

### 4. Mock Data & Production-Readiness Inventory

1. **Articles & Categories:**
   * Backend database has 5 real articles in `server/data/articles.json` and 8 dynamic categories in `server/data/settings.json`.
   * Fallback to `MOCK_ARTICLES` and `MOCK_CATEGORIES` in `src/services/mockData.js` occurs only during server disconnects.
2. **Hardcoded Counters:**
   * Views (`art.views_count || '14.2K'`), Likes (`art.likes_count || '1.8K'`), Poll counts (`{ yes: 1420, no: 410, undecided: 120 }`), and Reader reactions (`{ helpful: 42, hot: 88... }`).
   * **Resolution:** Suppress fabricated view/like counters from the public homepage cards. Only show verified counters in the Admin Analytics desk or when backed by real session logs (`server/data/usage_logs.json`).

---

## Part 2: Phase 2 — Proposed Editorial Design System & Architecture

### 1. Brand Identity & Restrained Color Palette

Rather than an arbitrary mix of indigo, purple, red, green, amber, and blue across every card, the new default design system establishes a disciplined, cohesive color hierarchy anchored to Public Spark's authentic identity:

```css
:root {
  /* Editorial Canvas & Paper Surfaces */
  --bg-primary: #F8F9FA;         /* Crisp editorial warm paper */
  --bg-surface: #FFFFFF;         /* 100% Solid pure card surface */
  --bg-secondary: #EDEFF2;       /* Subtle neutral fill for dividers/toolbars */
  --bg-inset: #F1F3F5;           /* Quiet callout background */

  /* Journalistic Obsidian Ink */
  --text-main: #1A1D20;          /* Deep rich obsidian ink for headlines */
  --text-body: #2D3136;          /* High-legibility charcoal for news reading */
  --text-muted: #5A626A;         /* Subheadings and standfirsts */
  --text-subtle: #7A848E;        /* Timestamps, bylines, and photo credits */

  /* Purposeful Accent Accents */
  --brand-primary: #C5221F;      /* Public Spark Sovereign Signal Red (Masthead spark & urgent bulletins) */
  --brand-navy: #0E2A47;         /* Deep editorial navy for authoritative navigation & category anchors */
  --state-success: #1B7A43;      /* Fact-check guarantee & published live states */
  --state-warning: #B45309;      /* Attention / changes requested */
  --state-danger: #DC2626;       /* Destructive delete actions */

  /* Hairline Rules (No Heavy Drop Shadows) */
  --border-hairline: #E2E6EA;    /* 1px crisp broadsheet separation line */
  --border-medium: #CBD2D9;      /* Card and table borders */
  --border-focus: #0E2A47;       /* Accessible keyboard focus ring */

  /* Geometry & Elevation (Moving away from bubble SaaS pills) */
  --radius-xs: 2px;
  --radius-sm: 4px;              /* Clean, crisp corner for cards and inputs */
  --radius-md: 6px;              /* Subtle curvature for interactive buttons */
  --radius-full: 9999px;         /* Reserved strictly for small status dots and audio play triggers */

  --shadow-editorial: 0 1px 3px rgba(10, 15, 25, 0.04);
  --shadow-hover: 0 4px 12px rgba(10, 15, 25, 0.08);
}
```

---

### 2. Editorial Typography Architecture

* **Major Headlines (Serif):** `Playfair Display` (Latin) / `Noto Serif Devanagari` (Hindi / Devanagari) with high contrast, tight tracking (`-0.02em`), and strict line-height (`1.18` to `1.24`).
* **Interface, Navigation & Metadata (Sans-Serif):** `Plus Jakarta Sans` / `Noto Sans Devanagari` with high x-height, open apertures, and crisp readability at small sizes (`11px` to `14px`).
* **Article Body:** Set at optimal reading measure (65–75 characters per line), with generous line-height (`1.75`), crisp font scaling (`A-`, `A`, `A+`), and seamless Devanagari ligature rendering.

---

### 3. Page-Level Layout Blueprint

```
+-----------------------------------------------------------------------------------+
| DATE & EDITION  |  WEATHER  |  HINDI / 19-LANG SELECT  |  SEARCH  |  THEME  | ROLE   |  (36px Sleek Utility Bar)
+-----------------------------------------------------------------------------------+
|                           PUBLIC SPARK [Logo Emblem]                               |  (Unified Masthead)
|                      Truth, Inquiry & Public Interest Journalism                   |
+-----------------------------------------------------------------------------------+
| [TOP STORIES]  [INDIA]  [WORLD]  [TECHNOLOGY]  [BUSINESS]  [SCIENCE]  [OPINION]   |  (Sticky Category Rail)
+-----------------------------------------------------------------------------------+
| [BREAKING] :: ISRO successfully deploys next-gen satellite...          [Pause/Play]|  (Low-Profile Ticker)
+-----------------------------------------------------------------------------------+
|  [=== 2-COLUMN LEAD EDITORIAL GRID ===]         | [=== EDITORIAL DISPATCH RAIL ===]|
|                                                 |                                  |
|  [LEAD STORY (Hero Photo + Headline + Excerpt)] | [ANALYSIS & OPINION SPOTLIGHT]   |
|  - By Priya Ramachandran • 12 mins ago          | - Deep dive on Sovereign AI      |
|  - In-Depth reporting with 1-click audio read   |                                  |
|                                                 | [TOP TRENDING BULLETINS 01-05]   |
|  ---------------------------------------------- | 01. National Economic Indicators |
|  [SECONDARY STORY 1]  |  [SECONDARY STORY 2]    | 02. Renewable Grid Milestone     |
|  - Compact 16:9 photo |  - Compact 16:9 photo   | 03. High Court Judicial Ruling   |
|  - 2-line headline    |  - 2-line headline      |                                  |
|  - Category tag       |  - Category tag         | [DAILY PUBLIC VOICE POLL]        |
|  - Byline & timestamp |  - Byline & timestamp   | - Single clean editorial card    |
+-----------------------------------------------------------------------------------+
| [THE WIRE: CHRONOLOGICAL BRIEFINGS & REGIONAL DISPATCHES]                         |
+-----------------------------------------------------------------------------------+
```

---

## Part 3: Implementation Priority Order (Phase 3 Execution Plan)

1. **Step 1: Production Quality & Asset Corrections**
   * Clear the DaVinci Resolve GPU error banner from `server/data/settings.json`.
   * Configure a clean fallback for unconfigured partner slots (0 DOM height or refined editorial self-promo).
   * Update `public/logo.png` rendering with clean alpha handling / inline vector treatment to prevent white bounding box artifacts.
2. **Step 2: Design Token & Global Stylesheet Realignment**
   * Update `src/index.css` with the restrained editorial color system, hairline borders, and purposeful radii.
   * Strip generic SaaS pill shapes from cards and buttons.
3. **Step 3: Masthead, Navigation & Ticker Overhaul**
   * Streamline `Header.jsx` to reduce vertical consumption from 220px to ~120px.
   * Consolidate utility controls and align Hindi/English category typography.
4. **Step 4: Homepage Editorial Grid & Card Redesign**
   * Overhaul the lead hero, secondary story cards, and right-hand dispatch rail.
   * Purge excessive badges (views, likes, flames, shields) from the cards to let the journalism breathe.
5. **Step 5: Article Reader Visual Polish**
   * Simplify the reading toolbar, enhance typography scales, and refine the byline.
6. **Step 6: Newsroom Desks (Reporter, Editor, Admin) Alignment**
   * Polish the Writer Desk for maximum composition focus.
   * Streamline the Editorial review queue and provide a purposeful empty state.
   * Clean up Admin navigation grouping and story list hierarchy.
7. **Step 7: Mobile Responsiveness & Localized Script Verification**
   * Verify all 19 languages, especially Hindi Devanagari text wrapping, table layouts, and touch interactions on 390px mobile viewports.
