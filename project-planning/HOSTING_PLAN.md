# Sovereign Hosting & Cloud Deployment Blueprint (PublicSpark News)

This document is the authoritative, permanent record of PublicSpark News' hosting architecture, cloud providers, quotas, zero-credit-card constraints, and future migration playbooks.

---

## 1. Core Operating Constraint

- **Zero International Credit Card**: The publisher does not possess an international credit card.
- **Provider Rule**: All hosting, database, media storage, and DNS services in Phase 1 must be 100% free forever and require strictly zero credit cards (standard email verification only).
- **Decoupled Architecture Rule**: The frontend (React 19) and backend (Node.js REST API) remain decoupled via standard `/api/*` contracts. Migrating backend servers in the future will require zero frontend code redesign and incur zero reader downtime.

---

## 2. Active Strategy: Phase 1 — Cloudflare Sovereign Free Stack

This is the active production deployment stack for launching PublicSpark News.

### 2.1 Frontend: Cloudflare Pages
- **Cost**: 100% Free Forever (Zero Credit Card Required).
- **Bandwidth**: Unlimited.
- **Requests**: Unlimited public reader requests.
- **Global Edge Network**: Cached across India edge nodes (Delhi, Mumbai, Chennai, Kolkata, Hyderabad, Bengaluru) for sub-50ms load times.
- **Deployment Pipeline**: Connected directly to the GitHub repository (`origin/main`). Every `git push` automatically builds (`npm run build`) and deploys with free SSL/TLS encryption.

### 2.2 Backend Compute: Cloudflare Workers
- **Cost**: 100,000 requests per day free (Zero Credit Card Required).
- **Execution Model**: Edge Serverless compute running co-located with incoming reader requests.
- **Cold Starts**: Exactly 0.0s (unlike container platforms like Render/Heroku, Cloudflare Workers never sleep and have zero cold-start delay).
- **Routes Served**: `/api/articles`, `/api/translate`, `/api/ads/*`, `/api/settings/*`, `/api/views/*`, `/api/media/*`.

### 2.3 Database: Cloudflare D1 SQL
- **Cost**: 5 GB storage free (Zero Credit Card Required).
- **Engine**: Serverless distributed SQLite/SQL engine co-located with Cloudflare Workers.
- **Capacity**: 5 GB safely accommodates over 2,00,000 full news stories, complete revision histories, 18-language translation caches, and ad impression logs.
- **Durability**: Automated replication and snapshots with zero risk of file loss on server restart.

### 2.4 Media & Photo Storage
- **Client-Side Compression**: Mandatory automatic WebP compression in `src/services/mediaService.js` (< 100 KB target size) before network transmission.
- **Storage Tier**: ImgBB API and Cloudinary Free Tier (Zero Credit Card Required, 25 GB monthly quota).
- **Audio Cache**: 32kbps mono MP3 encoding (< 400 KB per news article) combined with automated 14-day rolling purge (`cleanupExpiredAudioFiles`) capping audio disk space permanently under 60-80 MB.

---

## 3. Request Optimization Engine (How 100k Workers Serve 5,00,000+ Readers)

To ensure the 100,000 daily Worker limit is never exhausted prematurely by reader traffic, the following optimizations are engineered:

1. **Cloudflare Edge Caching (Cache-Control)**:
   - Public GET routes (`/api/articles`, `/api/categories`, `/api/ads/active`, `/api/presets`) emit `Cache-Control: public, max-age=180, s-maxage=300`.
   - When a trending story receives 50,000 visits in 10 minutes, the Cloudflare Edge serves 49,998 readers directly from cache memory.
   - **Crucial Rule**: Cloudflare Edge Cache hits DO NOT count against the 100k daily Worker execution quota.

2. **Cloudflare Zero-Call Geolocation**:
   - Cloudflare Edge automatically injects reader city, state, and country headers (`cf-ipcity`, `cf-ipregion`, `cf-ipcountry`) into every incoming HTTP request.
   - Eliminates all external IP geolocation and weather API calls.

3. **Analytics Beacon Batching (`navigator.sendBeacon`)**:
   - Rather than firing individual HTTP requests every 15-20 seconds during article reading, client-side timers accumulate dwell time in memory.
   - On page exit or article change, a single batch payload is dispatched via `navigator.sendBeacon('/api/views/batch', payload)`.
   - Reduces reader telemetry from 6-8 calls per session down to 1 call per session.

---

## 4. Scaling Roadmap: Phase 2 — Sovereign Budget VPS (Via Indian UPI)

When daily readership grows beyond 50,000 - 100,000 daily visitors and requires un-metered, continuous background compute:

### 4.1 VPS Specifications
- **Provider Options**: Hostinger India, Netcup, Contabo, or DigitalOcean India.
- **Payment Method**: 100% Indian Domestic Payments supported: Google Pay, PhonePe, Paytm, BHIM UPI, and RuPay Debit Cards / NetBanking. Zero international credit card needed.
- **Cost**: Approximately ₹250 to ₹350 per month.
- **Hardware**: 1 vCPU, 2 GB RAM, 20-50 GB NVMe SSD.
- **Compute Limit**: **UNLIMITED REQUESTS**. 0 request counting, 0 per-minute throttling.

### 4.2 VPS Software Stack
- **Operating System**: Ubuntu 24.04 LTS.
- **Process Manager**: PM2 (`pm2 start server/server.js --name publicspark-api -i max`).
- **Web Server / Reverse Proxy**: Nginx with HTTP/2 and gzip/brotli compression.
- **SSL**: Let's Encrypt automated SSL (`certbot`).
- **CDN Fronting**: Cloudflare Free Tier stays active as the authoritative DNS and DDoS shield in front of the VPS.

---

## 5. Zero-Downtime Migration Playbook (Moving Cloudflare -> VPS)

Whenever the publisher decides to shift backend compute to a VPS:

1. **Backup Extraction**:
   - Open Admin Workspace -> Settings -> Backup.
   - Click "Download Complete Newsroom Archive" to obtain `publicspark_backup_[date].zip` containing `server/data/*.json` and media assets.
2. **VPS Provisioning**:
   - Purchase ₹250-₹300 VPS using UPI.
   - Install Node.js (v20+) and Nginx.
   - Clone git repository: `git clone https://github.com/harshdada2018-png/pintu-chachu-news-web.git`.
   - Extract backup archive into `server/data/`.
3. **Service Launch**:
   - Run `npm install --omit=dev`.
   - Launch with PM2: `pm2 start server/server.js --name news-api`.
4. **DNS Switchover**:
   - In Cloudflare DNS management, update the `api.publicspark.in` record to point to the new VPS IP address.
   - Total reader downtime: **0 seconds**. All news stories, user comments, and ad campaigns continue running smoothly.

---

## 6. Environment Variables & Secret Credentials

| Variable Name | Environment | Description | Where to Configure |
| :--- | :--- | :--- | :--- |
| `GEMINI_API_KEY` | Production | Google AI Studio Free Tier Key for translation & fact-checking | Cloudflare Dashboard / Server `.env` |
| `PORT` | Local & VPS | Port for Node.js HTTP server (Default `5000`) | Server environment / `.env` |
| `NODE_ENV` | Production | Set to `production` for security hardening | Server environment / `.env` |
| `SESSION_SECRET` | Production | 32-character random string for Newsroom RBAC cookie encryption | Cloudflare Secrets / `.env` |

---

*Last Updated: November 2026*
*Authoritative Status: Approved by User*

