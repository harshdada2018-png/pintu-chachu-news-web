# PublicSpark — UI/UX Design System & Layout Guidelines

**Project:** PublicSpark Digital Newsroom Platform  
**Design Theme:** Modern Bento Grid / Editorial Newspaper Hybrid  
**Status:** Standardized & Active  

---

## 1. Color Palette & Typography Tokens

### Core Color Tokens:
```css
:root {
  /* Brand Primary Accents */
  --accent-crimson: #E50914;      /* Breaking News & Live Alerts */
  --accent-indigo: #4F46E5;       /* Primary Audio Reader Accent */
  --accent-emerald: #10B981;      /* Fact-Checked Badge Accent */

  /* Light Theme Foundations */
  --bg-primary: #FAFAFA;
  --bg-surface: #FFFFFF;
  --bg-secondary: #F3F4F6;
  --text-main: #111827;
  --text-muted: #4B5563;
  --text-subtle: #9CA3AF;
  --border-light: #E5E7EB;
  --border-medium: #D1D5DB;

  /* Dark Theme Foundations */
  --bg-dark-primary: #0F172A;
  --bg-dark-surface: #1E293B;
  --bg-dark-secondary: #334155;
  --text-dark-main: #F8FAFC;
  --text-dark-muted: #94A3B8;
  --border-dark-light: #334155;

  /* Shadows & Glassmorphism */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --glass-bg: rgba(255, 255, 255, 0.85);
  --glass-backdrop: blur(12px);
}
```

---

## 2. Interactive Component Specifications

### 2.1 1-Click Audio Reader Bar & Reading Speed Controller (`TextToSpeech.jsx`)
- **Layout**: Full-width Bento player bar placed directly above featured images or article text.
- **Speed Controller Badge**: Interactive rounded pill button (`Gauge` icon + `1.0x Speed`) that allows users to cycle through speeds (`0.75x`, `1.0x`, `1.25x`, `1.5x`, `1.75x`, `2.0x`) without interrupting active playback.
- **Equalizer Animation**: 4 vertical animated bar elements (`.equalizer-bar`) that bounce dynamically when audio is playing or loading.
- **States**:
  - `Idle`: Play Icon (`Play`) + "1-Click Audio Reader"
  - `Loading`: Spinner (`Loader2`) + "Preparing Audio Voice..."
  - `Playing`: Pause Icon (`Pause`) + Animated Equalizer Bars + "Click to Pause"

### 2.2 Header Dropdown & Navigation (`Header.jsx`)
- **Top Utility Bar**: Live date, city indicator ("New Delhi, IN"), Fact-Checked Badge, Language Selector dropdown, and Dark/Light Mode toggle.
- **Category Tabs**: Top Stories, India, World, Technology, Business, Science & Environment, Opinion, Sports, Entertainment.

### 2.3 Editorial Newspaper Card Layouts
- **Hero Featured Card**: Large 2-column layout with 480px max-height image, author avatar, reading time, and quick audio trigger.
- **Compact News Bento**: Grid layout featuring image, category badge, publication timestamp, and views counter.

### 2.4 Admin Analytics & Audience Desk (`AnalyticsDashboard.jsx`)
- **KPI Summary Cards**: High-impact Bento cards displaying Total Page Views, Unique Readers, Avg Read Time (seconds), and Primary Geographic Territory (`India (IN)`).
- **Interactive Period Filters**: Segment data by Today (`day`), 7 Days (`week`), and 30 Days (`month`).
- **4 Interactive Graph Visualizer Options**:
  1. **Line Trend Chart**: Smooth area vector curve depicting daily page view trends over time.
  2. **Bar Comparison Chart**: Rounded vertical comparison bars for daily view distribution.
  3. **Donut Ring Share Chart**: Circular percentage ring chart depicting geographic country audience share with legend.
  4. **Peak Reading Hours Bar**: Hourly traffic distribution bars highlighting Morning & Night prime reading peaks.
- **Content Performance Index**: Ranked data table showing article titles, category tags, total views, unique readers, and read duration.

---

## 3. Responsive Breakpoints & Mobile Rules

| Device Breakpoint | Layout Behavior |
| :--- | :--- |
| **Desktop (> 1024px)** | 3-column editorial grid layout, sticky reader bar, full header utilities |
| **Tablet (768px - 1023px)** | 2-column grid, compact audio player, collapsible mobile navigation |
| **Mobile (< 767px)** | 1-column single-stack cards, touch-optimized tap targets (>44px), sticky bottom audio reader |
