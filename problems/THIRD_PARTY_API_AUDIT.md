# Third-Party API & Integration Audit

**Project:** PublicSpark Newsroom
**Date:** 20 Nov 2026
**Method:** Static code scan + live read-only calls (no generation, no emails sent, no data modified)
**Code change:** ZERO

---

## 0. Verdict

**Haan, backend me 4 external API integrations hain. Unme se 2 kaam kar rahe hain, 1 dead hai, 1 fallback browser me CORS se block hai.**

Aur is audit me 2 cheezein mili jo pehle reports me nahi thi:

1. **`/api/storage/status` fake data de raha hai** — Supabase, Turso aur Cloudflare R2 ka status hardcoded hai, koi integration exist hi nahi karta.
2. **P-01 (grievance) ab fix ho chuka hai** — file 17:20 par modify hui, teeno endpoints maujood hain. Mera pichhla report is baat par galat tha (detail Section 6 me).

| Integration | Provider | Live status |
| :--- | :--- | :--- |
| AI translation | Google Gemini | **WORKING** |
| AI text-to-speech | Google Gemini TTS | **WORKING** |
| Live news feed | Google News RSS | **WORKING** |
| Live news feed (backup) | saurav.tech NewsAPI | **DEAD (404)** |
| Email / OTP | Gmail SMTP | **Config present, credentials unverified** |
| Browser TTS fallback | translate.google.com (unofficial) | **BROKEN (CORS)** |
| Storage tiers | Supabase / Turso / R2 | **FAKE (hardcoded)** |

---

## 1. Live test results (jo maine actually chalaya)

### 1.1 Gemini API key validity

`GET https://generativelanguage.googleapis.com/v1beta/models?key=...` — yeh metadata call hai, koi token/generation cost nahi.

```
KEY_PRESENT=true LEN=53
GEMINI_LIST_STATUS=200
GEMINI_MODEL_COUNT=50
```

Key **valid hai**. Ab code me jo models maange ja rahe hain, woh actually exist karte hain ya nahi:

| Code me maanga gaya model | Kahan | Exists? |
| :--- | :--- | :--- |
| `gemini-3.5-flash` | server.js:2072 | EXISTS |
| `gemini-3.7-flash` | server.js:2073 | EXISTS |
| `gemini-flash-latest` | server.js:2074 | EXISTS |
| `gemini-3.5-flash-lite` | server.js:2075 | EXISTS |
| `gemini-3.8-flash` | server.js:2076 | EXISTS |
| `gemini-flash-lite-latest` | server.js:2077 | EXISTS |
| `gemini-3.8-flash-lite-tts` | server.js:2214 | EXISTS |
| `gemini-2.5-flash-preview-tts` | server.js:2215 | EXISTS |
| `gemini-3.8-flash-tts` | server.js:2216 | EXISTS |

**9/9 models exist.** Fallback chain sahi bani hui hai. Yeh ek achhi khabar hai — model names me koi hallucination nahi.

### 1.2 Google News RSS

```
GNEWS_STATUS=200 BYTES=125639 ITEMS=26
```

App ke apne endpoint se bhi verify kiya:

```
GET /api/live-news?topic=TECHNOLOGY&lang=hi&provider=google
-> 200, count: 15, first: "सड़क किनारे तारों पर क्यों लटकती हैं पानी की बोतले"
```

**Kaam kar raha hai**, Hindi feed aa rahi hai.

### 1.3 saurav.tech NewsAPI (backup provider)

```
SAURAV_technology_STATUS=404
SAURAV_general_ERROR=terminated
```

App ke endpoint se:

```
GET /api/live-news?provider=saurav&category=technology
-> 200, count: 15, provider: "google"
```

Yani: saurav fail hota hai, phir chupchaap Google par fallback ho jata hai. **User ko pata nahi chalta** aur response me `provider: "google"` aata hai jabki request `saurav` ki thi. Saath hi har request ek fail hone wale fetch ka wait karti hai → latency waste.

### 1.4 Browser TTS fallback (translate.google.com)

Node se call karne par `200 audio/mpeg` aata hai, **par browser se**:

```
browserTts -> { error: "TypeError: Failed to fetch" }
```

**Yeh path browser me dead hai** (CORS). `src/services/cloudAudioService.js:332` `translate.google.com/translate_tts` ko direct browser `fetch` se call karta hai, jo CORS header nahi deta. Yani jab Gemini TTS quota khatam ho jaye (90/day), fallback bhi kaam nahi karega.

### 1.5 Gmail SMTP reachability

```
SMTP_BANNER=220 smtp.gmail.com ESMTP
```

Server reachable hai, credentials `.env` me maujood hain (`GMAIL_USER` 24 chars, `GMAIL_APP_PASS` 19 chars). **Lekin maine actual login verify nahi kiya** — usse Google aapke account par "new sign-in" alert bhej sakta hai aur yeh side effect main aapki permission ke bina nahi karna chahta. Neeche Section 7 me exact command hai.

### 1.6 Storage status

```
GET /api/storage/status -> 200
supabase: 14.8 MB, turso: 8.5 MB, cloudflareR2: 32.4 MB
```

Code me yeh numbers **hardcoded** hain (`server.js:3574, 3583, 3592`). Poore project me Supabase/Turso/R2 ka koi client, SDK, endpoint ya credential nahi hai. Sirf 3 strings hain naam ke liye.

### 1.7 Frontend key leak check

```
dist/assets/*.js aur src/ me 'AIza...' pattern -> 0 match
.env -> gitignored, git me tracked nahi
```

**PASS.** Gemini key browser bundle me leak nahi hui.

---

## 2. Findings

### A-01 — AI endpoints bilkul public hain (cost abuse) — HIGH

Teen endpoints bina kisi auth ke Gemini call karte hain:

| Endpoint | Line | Auth | Rate limit |
| :--- | :--- | :--- | :--- |
| `POST /api/article/pre-draft` | server.js:2769 | **none** | **none** |
| `POST /api/tts` / `/api/tts/generate` | server.js:2805 | **none** | global 90/day |
| `POST /api/translate` | server.js:2982 | none | 30/hour per IP |

**Attack:** koi bhi anonymous user `/api/article/pre-draft` par loop chala kar aapka Gemini quota aur paisa kha sakta hai. Script: 1000 requests → 1000 Gemini calls → aapke billing account par charge, aur asli writers ke liye quota khatam.

**Fix:** pre-draft aur TTS ko staff session ke peeche rakho. Translate public rahe (readers use karte hain) par per-IP limit already hai — usko body-size limit ke saath rakho.

---

### A-02 — TTS par per-IP limit nahi, sirf global daily cap — MEDIUM

`server.js:2887-2897` me sirf `getDailyUsage('Gemini_TTS') >= 90` check hai. Matlab ek user 90 calls me poora din ka quota khatam kar sakta hai, baaki sab readers ke liye TTS band.

Saath hi har call disk par file likhti hai (`audio_${article_id}_${lang}_${clip}.mp3`) — `article_id` user-controlled hai (sanitized, par unique banaya ja sakta hai).

**Fix:** per-IP limit (jaise 10/day), aur `article_id` ko DB me verify karo ki real article hai.

---

### A-03 — Browser TTS fallback CORS se dead hai — HIGH

`src/services/cloudAudioService.js:329-341` browser se Google ke unofficial TTS endpoint ko `fetch` karta hai. Browser me `Failed to fetch`.

**Asar:** Gemini quota khatam hone par reader ko audio nahi milega, chahe code me "browser fallback" likha ho. Yeh silent failure hai — user ko sirf kuch nahi hota.

**Fix:** fallback ko `window.speechSynthesis` (native Web Speech API) par shift karo, jo browser me built-in hai aur free hai. Ya fallback path hata do aur saaf error dikhao.

---

### A-04 — saurav.tech provider dead hai, silently Google par fallback — MEDIUM

`server.js:5349` — `https://saurav.tech/NewsAPI/top-headlines/category/technology/in.json` return 404.

**Do asar:**
1. Har `provider=saurav` request ek failing fetch ka wait karti hai (latency).
2. Response me `provider: "google"` aata hai par request saurav ki thi — frontend "SauravTech Live Wire" jaisa label dikha sakta hai jabki content Google ka hai.

**Fix:** provider list se saurav hatao, ya fail hone par response me `fallback_used: true` bhejo.

---

### A-05 — `/api/storage/status` fake data ko "live healthy" bata raha hai — HIGH (honesty/trust)

```js
// server.js:3571-3599
storageTiers: {
  supabase:     { usedMb: 14.8, limitMb: 500,   status: 'healthy' },
  turso:        { usedMb: 8.5,  limitMb: 9216,  status: 'healthy' },
  cloudflareR2: { usedMb: 32.4, limitMb: 10240, status: 'healthy' }
}
```

Yeh numbers constants hain. Koi Supabase, Turso ya Cloudflare R2 integration project me maujood nahi. Admin UI (`StorageSettings.jsx:881-953`) inhi numbers ko progress bar ke saath "live quota" ki tarah dikhata hai.

**Asar:** admin ko lagta hai data Supabase me hai jabki sab kuch local JSON files me hai. Backup/restore/migration decisions galat liye ja sakte hain. Yeh "mock ko real dikhana" hai.

**Fix:** do options — (a) real integration banao, ya (b) UI me clearly "Local JSON files" dikhao. Beech ka rasta (fake healthy bars) sabse khatarnak hai.

---

### A-06 — `/api/storage/purge` bina auth ke cache clear kar sakta hai — MEDIUM

`server.js:3612` — koi session check nahi. Koi bhi POST karke audio cache, translation cache aur progress map clear kar sakta hai.

**Asar:** sirf performance hit (dobara generate hoga) — data loss nahi. Par public mutation route hona hi nahi chahiye.

**Fix:** staff session required.

---

### A-07 — `/api/live-news` public proxy hai, cache nahi — MEDIUM

`server.js:5340` — bina auth ke har request par Google News se fetch. Na cache, na per-IP limit.

**Asar:**
1. Koi bhi 1000 requests bhej kar Google ko aapse rate-limit/throttle karwa sakta hai (aapka server IP block ho jaye to live news band).
2. Har request ka latency outbound call par depend karta hai.

`topic` param seedha URL path me jaata hai (`server.js:5406`), `.toUpperCase()` ke baad. Host change nahi hota (slash uppercase nahi hota), isliye full SSRF nahi — par path manipulation possible hai.

**Fix:** 5-10 minute ka in-memory cache, per-IP limit, aur `topic` ko whitelist se map karo (`TECHNOLOGY -> technology`), direct interpolation na karo.

---

### A-08 — OTP email me link `localhost` ka jaata hai — HIGH (user-facing)

`server/services/staffAuthService.js` me `createOtpForEmail` hardcoded `siteUrl: 'http://localhost:5173'` pass karta hai, aur `emailTemplateService.js:139` usko link me daalta hai.

Matlab production me writer ko email milega jisme link hoga:
```
http://localhost:5173/staff
```

Recipient ke computer par woh link kabhi nahi khulega.

**Fix:** `process.env.CLIENT_URL` ya `https://publicspark.in` use karo.

---

### A-09 — `liveSent` field hamesha `false` aata hai (bug)

`server.js:6028` aur `6216`:
```js
liveSent: Boolean(dispatchResult?.sent)
```
Par `sendNewsroomEmail` return karta hai `{ success, delivered, mode, messageId }` — **`sent` field exist hi nahi karta**.

**Asar:** email actually chala jata hai, par API response kehta hai "live nahi bheja". Frontend agar `liveSent` par UI decide karta hai to galat message dikhega.

**Fix:** `dispatchResult?.delivered` check karo.

---

### A-10 — OTP request par per-IP limit nahi → email bombing — HIGH

`createOtpForEmail` sirf **per-email** 60-second cooldown rakhta hai. Per-IP kuch nahi.

**Attack:** attacker 500 different email addresses par OTP request bhejta hai →
- 500 emails aapke Gmail se jaate hain (free Gmail limit ~500/day)
- Gmail account spam/rate-limit flag ho sakta hai
- Uske baad **asli staff bhi OTP nahi paayega** → poora login system band
- Victims ko unsolicited email (aapke domain se) → reputation damage

**Fix:** per-IP hourly limit (jaise 5/hour), aur ek global daily send cap.

---

### A-11 — Dev fallback "success: true" return karta hai jab email nahi gayi — MEDIUM

`emailSenderService.js:11-16`:
```js
if (!t) {
  console.log('[Email Dispatcher (Dev Fallback)] ...');
  return { success: true, delivered: false, mode: 'dev_preview' };
}
```
`success: true` hai par email nahi gayi. Jo bhi caller sirf `success` check karta hai, usko lagega email chali gayi.

**Asar:** production me SMTP config galat hua to OTP silently "bhej diya" dikhega, user ko kabhi nahi milega, aur koi error bhi nahi.

**Fix:** `success: false` return karo dev mode me, ya caller ko `delivered` check karwao.

---

### A-12 — Backup email "encrypted archive" bolta hai, ZIP plaintext hai — HIGH

`backupService.js:1152`:
> "The complete encrypted archive is attached as a .zip file."

Par `backupService.js` me `encrypt`, `cipher`, `passphrase` ka **ek bhi reference nahi** hai. ZIP plain hai, aur usme staff records with plaintext `twoFactorSecret` hain (pehle ke audit se confirmed).

Aur woh ZIP email attachment ban kar Gmail se guzarta hai. Gmail ke servers par plaintext 2FA secrets.

**Fix:** (a) email text se "encrypted" hatao, ya (b) actual encryption add karo (AES-256 + passphrase) — bina encryption ke email par bhejna band karo.

---

### A-13 — OTP codes console me plaintext log hote hain — MEDIUM

`staffAuthService.js`:
```js
console.log(`[PublicSpark OTP Engine]: Generated 5-Min OTP ... [ ${otpCode} ] ...`);
```

Production me logs (PM2/journald/cloud log) me 2FA codes chale jayenge. Log access rakhne wala koi bhi account hijack kar sakta hai.

**Fix:** sirf `NODE_ENV !== 'production'` par log karo.

---

### A-14 — Dead code: 2 email exports kabhi use nahi hote

| Export | Status |
| :--- | :--- |
| `dispatchOtpEmail` | `server.js:48` par import hota hai, **kabhi call nahi hota** |
| `verifySmtpConnection` | exported, **kabhi call nahi hota**, koi route expose nahi karta |

Yani SMTP credentials verify karne ka koi UI/endpoint hi nahi hai. Admin ko pata hi nahi chal sakta ki email kaam kar raha hai ya nahi.

**Fix:** `verifySmtpConnection` ko ek admin-only `GET /api/admin/email/health` par expose karo, ya dead code hatao.

---

## 3. Kya kaam kar raha hai (PASS)

| Check | Result |
| :--- | :--- |
| Gemini API key valid | PASS (200) |
| Gemini model names accurate | PASS (9/9 exist) |
| Gemini fallback chain | PASS (6 models, try/catch per model) |
| Google News RSS | PASS (15-26 items, Hindi) |
| Gmail SMTP reachable | PASS (220 banner) |
| API key browser bundle me leak nahi | PASS (0 match) |
| `.env` gitignored + untracked | PASS |
| Translation response caching | PASS (content hash + in-flight lock) |
| TTS response caching | PASS (MP3 cache on disk) |
| Frontend external calls | sirf intentional links (share, wa.me, YouTube embed) |

---

## 4. Cost exposure (real numbers)

| Route | Model | Cost per call | Public? | Worst case |
| :--- | :--- | :--- | :--- | :--- |
| `/api/translate` | gemini-3.x-flash | article ke size par | yes, 30/hr/IP | IP rotate kar ke unlimited |
| `/api/article/pre-draft` | gemini-3.x-flash | article ke size par | **yes, no limit** | unlimited |
| `/api/tts` | gemini TTS | audio length par | yes, 90/day global | 90 calls/day |

Free tier limits lagne par paid billing on ho sakti hai — aur woh bill aapke naam par aayega.

---

## 5. Fix priority

| # | Kaam | File | Effort | Risk |
| :--- | :--- | :--- | :--- | :--- |
| 1 | pre-draft + TTS ko auth ke peeche | server.js:2769, 2805 | 1 hr | Low |
| 2 | storage status ka fake data hatao / real banao | server.js:3552 | 1-2 hr | Low |
| 3 | OTP email ka localhost link fix | staffAuthService.js | 15 min | Low |
| 4 | `liveSent` → `delivered` fix | server.js:6028, 6216 | 10 min | Low |
| 5 | OTP par per-IP limit | server.js:5990+, staffAuthService.js | 1 hr | Low |
| 6 | browser TTS fallback → Web Speech API | cloudAudioService.js:329 | 1 hr | Low |
| 7 | `/api/live-news` cache + topic whitelist | server.js:5340 | 1-2 hr | Low |
| 8 | saurav provider hatao ya fallback flag bhejo | server.js:5346 | 20 min | Low |
| 9 | `/api/storage/purge` auth | server.js:3612 | 15 min | Low |
| 10 | backup email se "encrypted" hatao ya encrypt karo | backupService.js:1152 | 30 min / 4-6 hr | Low / Medium |
| 11 | OTP console log production me band | staffAuthService.js | 10 min | Low |
| 12 | SMTP health endpoint + dead imports cleanup | server.js:48, emailSenderService.js:70 | 30 min | Low |

**Total: ~8-11 ghante** (backup encryption chhod kar).

---

## 6. Correction — P-01 galat tha (honesty note)

`problems/BACKEND_INTEGRATION_REPORT.md` me maine likha tha:

> P-01 — Grievance API poori tarah missing. `server.js` me `grievance` string ka **0 match**.

**Yeh ab sach nahi hai.** Verify karne par mila:

| Endpoint | Line | Status |
| :--- | :--- | :--- |
| `POST /api/grievance/submit` | server.js:5181 | EXISTS, validation + tracking ID |
| `GET /api/grievances` | server.js:5261 | EXISTS, staff auth required |
| `POST /api/grievance/update` | server.js:5279 | EXISTS, staff auth required |

Live test: `GET /api/grievances` bina token → **401** (sahi behaviour).

`server.js` ka last-modified **20 Nov 2026 17:20** hai, jabki mera audit ~17:00 par hua tha. Yani file mere audit ke **baad** change hui — us waqt grievance code exist nahi karta tha.

**Naya observation:** `POST /api/grievance/submit` public hai aur usme **koi rate limit / body size limit nahi** hai. `grievances.json` ko spam se bhara ja sakta hai (disk fill + admin desk unusable). Yeh naya finding hai.

---

## 7. Jo test nahi hua (honest limitations)

1. **Gmail credentials ka actual login verify nahi hua.** Sirf SMTP banner check kiya (220). Login test ke liye yeh chalta hai:
   ```
   node -e "import('./server/services/emailSenderService.js').then(async m=>{console.log(await m.verifySmtpConnection())})"
   ```
   Yeh email bhejta nahi, sirf auth karta hai — par Google aapke account par "new sign-in" alert bhej sakta hai. Isliye aapki permission ke baad chalana chahiye.

2. **Gemini par actual generation test nahi kiya.** Sirf model list (free metadata). Ek translate/TTS call chalane par quota lagta hai, isliye skip kiya.

3. **WhatsApp / share links** sirf URL builders hain — inka koi API call nahi hota, isliye test ki zarurat nahi.

4. **Frontend YouTube embeds** — `youtube-nocookie.com/embed/<id>` banti hai, par video ID valid hai ya nahi woh verify nahi kiya. Broken embed pehle ke UI audit me mila tha.

5. **Third-party Google Fonts** — 947 font faces load hote hain, woh alag finding hai (typography report me).

---

## 8. Bottom line

- **Gemini integration technically strong hai** — valid key, sahi model names, fallback chain, caching, in-flight lock. Kaam professional hai.
- **Par uske teeno endpoints khule pade hain.** Anonymous user aapka AI bill badha sakta hai.
- **Google News RSS kaam karta hai**, saurav dead hai, browser TTS fallback CORS se mara hua hai.
- **Email system config-wise ready hai**, par 4 bugs hain: localhost link, galat `liveSent` field, `success: true` without delivery, aur per-IP limit ka na hona.
- **Storage dashboard fake hai** — yeh sabse zyada confidence todne wali cheez hai, kyunki admin usko sach maan kar decisions lega.
