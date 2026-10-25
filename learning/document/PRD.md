# PublicSpark — Product Requirement Document (PRD)

**Project Name:** PublicSpark — Independent Digital Newsroom Platform  
**Version:** 2.0.0 (Production Ready)  
**Last Updated:** September 2026  
**Status:** Active & Maintained  

---

## 1. Product Overview & Vision

**PublicSpark** is a high-performance, independent digital news platform designed to deliver verified, fact-checked breaking news and deep-dive editorial stories to a diverse global audience. 

### Core Product Objectives:
- **Zero-Barrier Accessibility**: Enable hands-free 1-Click Audio Reading for every news story.
- **Multilingual Inclusivity**: Real-time 18-language instant translation covering all major Indian and international languages.
- **Fact-Checked Integrity**: Dedicated fact-checked badges, breaking news ribbons, and live coverage streams.
- **Modern Bento UI/UX**: State-of-the-art responsive design with glassmorphism, animated sound equalizers, dark/light themes, and mobile-first layouts.

---

## 2. Supported Languages Matrix (18 Languages)

PublicSpark natively supports translation and high-definition voiceover across 18 regional and international languages:

| Region | Language Code | Native Script | Voice Synthesis Engine |
| :--- | :--- | :--- | :--- |
| **Indian Languages** | `hi` | हिंदी (Hindi) | Google Cloud TTS Neural2 |
| | `bn` | বাংলা (Bengali) | Google Cloud TTS Wavenet |
| | `mr` | मराठी (Marathi) | Google Cloud TTS Wavenet |
| | `te` | తెలుగు (Telugu) | Google Cloud TTS Standard |
| | `ta` | தமிழ் (Tamil) | Google Cloud TTS Wavenet |
| | `gu` | ગુજરાતી (Gujarati) | Google Cloud TTS Standard |
| | `kn` | ಕನ್ನಡ (Kannada) | Google Cloud TTS Standard |
| | `ml` | മലയാളം (Malayalam) | Google Cloud TTS Standard |
| | `pa` | ਪੰਜਾਬੀ (Punjabi) | Google Cloud TTS Standard |
| | `or` | ଓଡ଼ିଆ (Odia) | Sarvam AI Bulbul v1 |
| | `as` | অসমীয়া (Assamese) | Sarvam AI Bulbul v1 |
| | `ur` | اردو (Urdu) | Google Cloud TTS Standard |
| **International** | `en` | English | Google Cloud TTS Wavenet |
| | `fr` | Français (French) | Google Cloud TTS Wavenet |
| | `it` | Italiano (Italian) | Google Cloud TTS Wavenet |
| | `ja` | 日本語 (Japanese) | Google Cloud TTS Neural2 |
| | `id` | Bahasa Indonesia | Google Cloud TTS Wavenet |
| | `zh-TW` | 繁體中文 (Chinese Taiwan) | Google Cloud TTS Wavenet |

---

## 3. Key Feature Specifications

### 3.1 1-Click Rollout Audio Reader & Audio Position Memory (Text-To-Speech)
- **Rollout UI Animation**: Displays a compact round play button initially that smoothly rolls out into an expanded interactive audio bar upon playback.
- **Interactive Scrubber Timeline**: Includes a progress bar slider allowing readers to drag or click to seek forward/backward in the audio stream.
- **Dynamic Speed Controller**: Readers can adjust speech rate on-the-fly (`0.75x`, `1.0x`, `1.25x`, `1.5x`, `1.75x`, `2.0x`) using the speed control pill button without interrupting active audio.
- **Visual Feedback**: Displays animated Bento equalizer sound waveform bars while playing.
- **Backend Position Memory (`audio_progress`)**: Tracks and persists exact audio position (`last_position_seconds`) per article and per language (`POST /api/audio/progress` & `GET /api/audio/progress`). Switching languages or re-opening articles resumes playback from the exact saved timestamp without cache clashing.
- **Backend Audio Proxy**: Audio is synthesized server-side via Node.js Backend Proxy (`/api/tts`) as a Base64 MP3 Data URI.
- **Stream Caching**: Fast in-memory caching per article ID and language. Repeat listens start instantaneously (0ms delay).

### 3.2 Real-Time Multilingual Article Translation
- **On-the-Fly Engine**: Automatically translates article titles, subtitles, summaries, body text, and category tags when switching language in the header dropdown.
- **Paragraph Chunking**: Large articles (>800 chars) are split by paragraphs to ensure zero URL truncation or HTTP 414 errors.
- **Memory & Storage Caching**: Hash-based cache keys prevent untranslated fallbacks and ensure immediate language switches.

### 3.3 Live Breaking News & Fact-Checking Desk
- **Breaking News Ticker**: Animated ticker bar highlighting urgent developments.
- **Fact-Checked Badges**: Visual indicator (`ShieldCheck`) verifying editorial authenticity.
- **Live Coverage Updates**: Real-time timeline blog stream for ongoing breaking events.

### 3.4 Reporter & Editor Workspaces
- **Reporter Drafting**: Submit news stories with automated client-side WebP image compression (<200KB limit).
- **Editor Desk**: Review submitted drafts, update titles, toggle breaking news flags, and publish in 1 click.

### 3.5 Real-Time Analytics & Audience Intelligence System
- **Raw Event Logging**: Logs individual article view sessions (`article_views`) with session IDs, active read duration (via 5s heartbeats), scroll depth percentage, and IP address.
- **GeoIP Country Detection**: Automatically resolves client IP to geographic country codes (`IN`, `US`, `GB`, `CA`, `BD`, `AE`) for demographic traffic breakdown.
- **Pre-Aggregated Summary Tables**: Background cron job periodically aggregates raw events into `article_stats_daily` to serve analytics dashboards in sub-5ms.
- **Admin Audience Desk**: Features Bento KPI cards (Total Views, Unique Readers, Avg Read Time, Top Country), period selectors (Today, 7 Days, 30 Days), SVG trend line charts, country share bars, and a ranked content performance index.

---

## 4. Future Roadmap & Update Guidelines

All future feature enhancements must maintain documentation alignment in this `document/` folder:
- **Phase 1**: Advanced Offline Progressive Web App (PWA) audio caching.
- **Phase 2**: AI-assisted automated article summarization.
- **Phase 3**: User bookmarking and audio playlist queues.
