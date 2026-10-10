# PublicSpark Newsroom - Session Updates & Changelog (2026-10-10)

## Overview
This document logs all features, bug fixes, UI enhancements, and system architecture updates implemented during the development session on **October 10, 2026**.

---

## 🚀 Summary of Changes & Enhancements

### 1. Breaking News Ticker Auto-Rotation & Animations
- **Auto-Cycle Timer**: Set breaking news ticker to auto-advance every **4 seconds** (4000 ms) in `Header.jsx`.
- **Fade In / Fade Out Transitions**: Added `.ticker-content` and `.ticker-content.fade-out` CSS opacity and translation transitions in `src/index.css`.
- **Manual Navigation**: Connected the "Next ❯" button to trigger smooth fade-out and fade-in transitions.

---

### 2. Bookmark System & Dedicated Bookmarks View
- **Placement**: Positioned the **Bookmark Icon Button (`🔖`)** directly below the red Breaking News ticker bar on the far-left corner, separated from category links by a vertical divider.
- **Dedicated View**: Selecting the Bookmarks tab filters `App.jsx` to render a dedicated **"Your Saved Bookmarks"** grid containing **ONLY** articles saved by the reader. Unbookmarked sidebar widgets (Editor's Spotlight, Top Trending Stories) are completely hidden in this view.
- **1-Click Quick Remove**: Added a `Remove ✖` button on each bookmarked article card.
- **Storage & Server Load Logic**:
  - Saved in browser `localStorage` under `ps_bookmark_<article_id>`.
  - **Server Load**: `0%` (Client-side execution).
  - **Server Storage Space**: `0 Bytes`.

---

### 3. Share Article System & Interactive Share Modal
- **Native Device Share**: Utilizes `navigator.share` on supported mobile devices and browsers.
- **Interactive Share Modal**: Custom modal dialog equipped with:
  - **1-Click Copy Link**: Copies URL to clipboard with instant *"Copied! 📋"* toast feedback.
  - **Direct Social Platforms**: Instant sharing to **WhatsApp**, **Twitter / X**, **Telegram**, and **Email**.

---

### 4. Social Media Footer Icons & Newsroom Management Settings
- **Footer Social Icons**: Rendered pixel-perfect branded SVG icons next to the Public Spark logo in the footer:
  - **WhatsApp** (`#25D366`)
  - **Instagram** (Gradient `#dc2743` / `#bc1888`)
  - **Facebook** (`#1877F2`)
  - **X (Twitter)** (`#000000`)
- **Admin Workspace Settings**: Added a new **"Social Channels Links"** configuration tab in `AdminWorkspace.jsx` allowing Admins to set custom handles, usernames, or URLs for WhatsApp, Instagram, Facebook, and X.
- **WhatsApp Phone & URL Support**: Supports both direct mobile numbers (e.g. `+919876543210` -> auto-converts to `https://wa.me/919876543210`) and full Group/Channel URLs (`https://whatsapp.com/channel/...`).
- **Instagram Handle/Username & URL Support**: Supports both plain handles/usernames (e.g. `@publicspark` or `publicspark` -> auto-converts to `https://instagram.com/publicspark`) and full page URLs (`https://instagram.com/publicspark`).
- **Facebook Phone Number, Handle & URL Support**: Supports mobile/phone numbers (e.g. `+919876543210` / `9876543210` -> auto-converts to `https://facebook.com/919876543210`), page handles/usernames (e.g. `@publicspark` -> `https://facebook.com/publicspark`), and full page URLs (`https://facebook.com/...`).
- **Persistence**: Social links are saved in `localStorage` under `ps_social_links` and dynamically update the footer icons across the website.

---

### 5. Backend Server Configuration & Persistent JSON Storage
- **Backend Endpoints (`server/server.js`)**:
  - `GET /api/settings/social`: Returns backend-persisted social links.
  - `POST /api/settings/social`: Persists social links to `server/data/settings.json`.
  - `GET /api/categories`: Returns backend-persisted news categories taxonomy.
  - `POST /api/categories`: Persists updated category taxonomy list to `server/data/categories.json`.
- **Backend Server Data Locking**:
  - Configurations are stored safely on the Node.js backend server (`server/data/settings.json` and `server/data/categories.json`).
  - Browser clear-cache or non-developer user actions cannot wipe or tamper with the authoritative backend server configuration.
- **Frontend Sync (`src/App.jsx`)**:
  - Automatically syncs social links and categories from the backend server on mount.
  - Saves updates directly to the backend proxy server when edited via Newsroom Management.

---

## 📁 Modified Files Reference

| File Path | Key Changes Made |
| :--- | :--- |
| `server/server.js` | Added `GET`/`POST` `/api/settings/social` and `/api/categories` endpoints with file-backed JSON storage (`server/data/`). |
| `src/components/common/Header.jsx` | Added auto-ticker 4s interval, fade animation state, and positioned dedicated Bookmark icon button under Breaking News bar. |
| `src/components/public/ArticleReader.jsx` | Implemented full Bookmark state, Share click handler, and interactive Share Modal popup. |
| `src/components/admin/AdminWorkspace.jsx` | Added "Social Channels Links" sidebar tab and URL management form. |
| `src/App.jsx` | Added dedicated Bookmarks grid view, `handleRemoveBookmark` state refresh, `socialLinks` state management, rendered footer social icons, and backend sync handlers. |
| `src/index.css` | Added `.ticker-content` and `.ticker-content.fade-out` CSS animations. |

---

## 🛠️ Verification & Build Status
- **Linter Output**: `oxlint` executed cleanly with `0 errors`.
- **Production Build**: `npm run build` compiled successfully in `325ms`.
- **Development Servers**: Frontend running on `http://localhost:5173/`, Backend running on `http://localhost:5000`.
