# Media Storage Strategy: Long-Term Image, Audio & Video Architecture

> [!NOTE]
> **Status:** Thinking / Under Consideration (Deferred for in-depth evaluation)  
> **Topic:** Zero-Cost, Card-Free Permanent Storage for PublicSpark Newsroom (Images, Audio, Video, Press Releases)  
> **Recorded On:** October 2026  

---

## 1. Context & The Core Problem
In a digital newsroom, **Audio and Text can be managed with rolling caches or small footprints**, but **Images (Cover photos) must be permanent**:
- If an article from 6 months or 2 years ago is opened, its cover photo must never be broken.
- Reporters frequently take photos with modern smartphones (48MP - 108MP) resulting in **5 MB to 15 MB per raw file**.
- Storing base64 strings in the database creates massive bloat (`articles.json` ballooning to 20MB+), destroying Core Web Vitals (LCP) and page load speed.
- The project owner has **no international credit card**, so paid tiers (e.g., Cloudflare R2 paid storage, AWS S3 billing) cannot be used. Solutions must be 100% card-free.

---

## 2. The 3 Core Media Challenges

### Challenge 1: Smartphone Photo Bloat
* **Threat:** 10MB raw camera photos uploaded directly will exhaust a 1 GB storage tier in fewer than 100 articles.
* **Solution:** Mandatory client-side HTML5 Canvas WebP compression in `src/services/mediaService.js`:
  - Maximum width scaled to **1200px** (official Google Discover / News standard).
  - WebP conversion targeting **< 100 KB - 120 KB**.
  - 10MB phone photo drops to ~100 KB before any network transmission occurs.

### Challenge 2: Base64 String Bloat vs Clean URLs
* **Threat:** Embedding raw base64 data URIs (`data:image/webp;base64,...`) into article JSON structures balloons the database and slows down initial API payloads.
* **Solution:** Standalone binary file uploads via `POST /api/upload/image`:
  - Files saved as `/uploads/img_art_<id>_<timestamp>.webp`.
  - Articles store only clean 35-character URLs (`"featured_image": "/uploads/img_art_123.webp"`).
  - Independent browser caching with `Cache-Control: public, max-age=604800, immutable`.

### Challenge 3: Permanent Multi-Year Storage Without Credit Cards
* **Threat:** 1 GB free hosting on Supabase/Render will eventually fill up after 2–3 years of continuous publishing (approx. 8,000 photos).
* **Question:** Where do we store photos, audio, and videos permanently without needing an international credit card?

---

## 3. Storage Provider Comparison Matrix

| Provider | Free Tier Allowance | International Credit Card Required? | Formats Supported | CDN Included? | Lifetime News Photos (at 100KB) |
| :--- |  :---: | :---: | :--- | :---: | :---: |
| **Local Server (`/uploads`)** | Shared Host Disk (1-10 GB) | [No] **No** | Images, Audio, Any file | Local Express / Node server | ~10,000 photos per GB |
| **Cloudinary** | **25 Credits / month** (~15–25 GB) | [No] **No** (Email/Google login only) | **Images, Audio (MP3), Videos (MP4), PDFs** | [Completed] **Global Akamai/Fastly CDN** | **~2,50,000 Photos** (20+ Years capacity) |
| **Supabase Storage** | **1 GB** dedicated storage | [No] **No** | Any binary file | [Completed] Cloudflare CDN | ~10,000 photos |
| **ImgBB API** | Unlimited uploads (32 MB max per image) | [No] **No** | Images only (No Audio/Video) | [Completed] Fast CDN | Unlimited |

---

## 4. What Cloudinary Offers (Deep Dive)

Cloudinary is a dedicated media cloud platform. Its Free Tier gives **25 Credits** per month:
1. **Multi-Media Support (Not Just Images):**
   - **Images:** WebP, AVIF, JPG, PNG with auto-format (`f_auto`) and auto-quality (`q_auto`).
   - **Audio:** MP3, WAV podcast and speech hosting.
   - **Video:** MP4, WebM breaking news clips and reels.
   - **Documents:** PDF press releases, government notices, circulars.
2. **Zero Credit Card:** Free tier requires zero card details; signup via Google or email.
3. **Automatic Optimization:** Automatically delivers the smallest possible format (e.g., AVIF on Chrome, WebP on Safari) without manual intervention.

---

## 5. Recommended Architecture: Plug-and-Play Hybrid Mode

When we revisit this implementation, we will use a **Plug-and-Play Hybrid Architecture**:

```
[ Reporter / Admin Uploads Image ]
              │
              ▼
[ Client-side WebP Compression (< 120 KB, 1200px) ]
              │
              ▼
    [ Backend /api/upload/image ]
              │
    ┌─────────┴─────────┐
    ▼                   ▼
If CLOUDINARY_URL in .env:     Fallback (Default):
Uploads to Cloudinary CDN       Saves to server/data/uploads/
Returns https://res.cloudinary... Returns /uploads/img_xxx.webp
```

### Benefits:
* **Zero Disruption Today:** Works 100% locally out-of-the-box without registering any external accounts right now.
* **Seamless Cloud Upgrade:** When ready, adding 3 keys (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`) in `.env` automatically routes all future uploads to Cloudinary's 25 GB free cloud without altering a single line of React frontend code.

---

## 6. Open Questions for Future Discussion
1. Should news audio clips also be mirrored to Cloudinary, or should they stay on the local 14-day rolling cache?
2. Do we want to support short breaking news video reels (MP4) in the future?
3. Should older local server images be batch-migrated to Cloudinary once an account is configured?
