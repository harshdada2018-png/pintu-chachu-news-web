# Backend Integration Check Report

**Project:** PublicSpark Newsroom (`D:\my projects\pintu chachu news web`)
**Date:** 20 Nov 2026
**Type:** Static integration audit (frontend <-> backend contract)
**Code change:** ZERO. Yeh sirf analysis report hai, koi file modify nahi hui.

---

## 0. Verdict (ek line me)

**Backend aapas me sahi integrate hai — imports, exports, syntax, routes sab theek hain. Frontend se 3 connections toote hue hain (grievance API), aur 1 duplicate route block dead code hai.**

> **CORRECTION (20 Nov 2026, 18:00):** P-01 ab **FIXED** hai. `server.js` 17:20 par update hua aur teeno grievance endpoints add ho gaye. Neeche P-01 section me status updated hai. Detail: `problems/THIRD_PARTY_API_AUDIT.md` Section 6.

| Area | Status |
| :--- | :--- |
| Backend internal integration (imports/exports) | PASS |
| Backend syntax | PASS (10/10 files) |
| Frontend -> Backend contract | 68/68 PASS (P-01 fixed) |
| Duplicate routes | 2 pairs (1 functional duplicate) |
| Dead code | 2 items |

---

## 1. Method

Kya-kya chalaya gaya:

| Check | Kaise |
| :--- | :--- |
| Import/export match | 59 JS/JSX files ke **221 named + 32 default imports** ko target file ke actual exports se milaya |
| Syntax | `node --check` saare server JS files par |
| Route extraction | `server.js` se **108 route definitions** nikale (88 exact, 14 prefix, 6 regex) |
| Frontend contract | `src/` ki **68 unique API calls** ko server routes se method ke saath match kiya |
| Duplicate routes | same method + path ki repeat definitions |
| ESM misuse | ESM files me `require()` |
| Dead code | kaunsi service file kahin import nahi hoti |

**Note:** Server ko real data par boot NAHI kiya gaya. Startup par seed accounts aur data files modify hoti hain, isliye runtime test alag se karna hoga (Section 6).

---

## 2. Jo PASS hua

| Check | Result |
| :--- | :--- |
| Imported symbols ka exist karna | **PASS** — 252/253 theek (1 dead import, P-03) |
| `node --check` syntax | **10/10 OK** — `server.js`, 6 services, 3 CLI |
| `require()` in ESM | **ZERO** — koi CommonJS leak nahi |
| Dynamic routes | **Integrated** — `/api/articles/:id/live-status`, `/live-updates`, `/revisions`, `/rollback` server me `pathname.match(regex)` se handle hote hain |
| TTS / translate | **Integrated** — frontend `POST`, server `POST` |
| `/api/media`, `/api/ads/active` | **Integrated** |
| Service files | 5/6 use ho rahe hain |

### Backend files jo verify hue

```
server/server.js                  OK
server/services/authService.js    OK (par dead - P-04)
server/services/staffAuthService.js   OK
server/services/totpService.js        OK
server/services/backupService.js      OK
server/services/emailSenderService.js OK
server/services/emailTemplateService.js OK
server/cli/admin-2fa-reset.js     OK
server/cli/restore-backup.js      OK
server/cli/emergency-lockdown.js  OK
```

---

## 3. Problems (asli findings)

### P-01 — Grievance API poori tarah missing (CRITICAL integration break) — **AB FIXED**

**Status: FIXED (20 Nov 2026, ~17:20).** Audit ke waqt endpoints exist nahi karte the; uske baad `server.js` update hua. Verify kiya:

| Endpoint | Line | Status |
| :--- | :--- | :--- |
| `POST /api/grievance/submit` | server.js:5181 | EXISTS — validation + tracking ID + deadlines |
| `GET /api/grievances` | server.js:5261 | EXISTS — staff auth required (401 without token, verified live) |
| `POST /api/grievance/update` | server.js:5279 | EXISTS — staff auth required |

**Naya issue jo ab bacha hai:** public submit route par koi rate limit / body size limit nahi hai — `grievances.json` spam se bhara ja sakta hai. Detail `problems/THIRD_PARTY_API_AUDIT.md` me.

Neeche original finding historical record ke liye rakhi hai.

**Severity:** High (user-facing feature dead + IT Rules compliance gap)
**Related security finding:** SEC-037

Frontend teen endpoints call karta hai, backend me teeno exist nahi karte:

| Frontend call | File:Line | Backend |
| :--- | :--- | :--- |
| `POST /api/grievance/submit` | `src/components/public/GrievanceModal.jsx:106` | **404** |
| `GET /api/grievances` | `src/components/admin/GrievanceDesk.jsx:31` | **404** |
| `POST /api/grievance/update` | `src/components/admin/GrievanceDesk.jsx:67` | **404** |

**Evidence:** `server.js` me `grievance` string ka **0 match**. Data file `server/data/grievances.json` maujood hai, par usko read/write karne wala koi handler nahi.

**Asar:**
- Public user complaint submit karega → network error / 404.
- Admin desk khaali dikhega, koi complaint load nahi hogi.
- Grievance redressal ka poora feature dead hai.

**Fix:** Teeno endpoints implement karo (validation, rate limit, admin auth, tracking ID), ya UI hata do.

---

### P-02 — Duplicate categories routes (MEDIUM, dead code)

**Severity:** Low-Medium (functional nahi, maintenance risk)
**Related security finding:** SEC-039

```
GET  /api/categories -> server.js:3617  aur  server.js:4522
POST /api/categories -> server.js:3624  aur  server.js:4532
```

**Kyun problem hai:** Node if-chain me pehla match jeetta hai. Line 3617/3624 wala block hamesha pehle chalta hai, isliye **line 4522/4532 wala block kabhi execute hi nahi hota**.

**Asar:**
- Future me koi developer doosre block me fix lagayega → "fix kaam nahi kar raha" wala confusion.
- Code padhne wale ko lagta hai dono active hain.
- Security fix galat jagah lag sakta hai.

**Fix:** Line 4518-4540 ka duplicate block delete karo.

---

### P-03 — `adService.js` missing (LOW, dead component)

**Severity:** Low (build safe, app nahi tootta)

```
src/components/admin/AdsManager.jsx:7
  import { getAdSettings, syncAdSettingsServer, fetchAdSettings } from '../../services/adService';
```

`src/services/adService.js` exist nahi karta.

**Kyun build phir bhi pass hai:** `AdsManager` component **kisi bhi file me import nahi hota** (grep se confirm — sirf apni definition). Yaani dead code hai, bundle me shamil hi nahi hota.

**Asar:** Koi runtime asar nahi. Par agar kal koi `AdsManager` ko import kar de, build turant fail hoga.

**Fix:** `AdsManager.jsx` delete karo, ya `adService.js` banao (agar ads feature aage chahiye).

---

### P-04 — `server/services/authService.js` poori file dead hai + hardcoded secret

**Severity:** Medium (security hygiene)
**Related security finding:** SEC-036

**Evidence:** Poore repo me `authService.js` ka **0 import**. Sirf `staffAuthService.js` import hota hai (naam similar hai, file alag hai).

**Isme kya hai:** Legacy PIN authentication service, jisme **hardcoded HMAC secret** hai:
```
server/services/authService.js:165,181
'publicspark-newsroom-auth-secret-key-2026'
```

**Asar:** Koi code isko call nahi karta, isliye exploit nahi ho sakta. Par secret code me padi hui hai — audit me red flag, aur koi bhi future developer accidentally import kar sakta hai.

**Fix:** File delete karo. SEC-036 ka cleanup isi ke saath ho jayega.

---

### P-05 — Backup manifest me dead file reference

**Severity:** Info

`server/services/backupService.js:1059` ke manifest HTML me `data/newsroom_auth.json` listed hai. Agar P-04 ke saath yeh file delete hoti hai, to backup manifest me dead reference reh jayega.

**Fix:** Manifest list se bhi hatao.

---

## 4. False positives jo clear kar diye

Pehle run me 8-10 endpoints "unmatched" dikhe the. Verify karne par woh **analyzer ki limitation** thi, asli problem nahi:

| Endpoint | Kyun false positive |
| :--- | :--- |
| `/api/articles/:id/live-status` | Server `pathname.match(/^\/api\/articles\/([^/]+)\/live-status$/)` use karta hai |
| `/api/articles/:id/live-updates` (GET/POST/DELETE) | Same — regex based routing |
| `/api/articles/:id/revisions` | Same |
| `/api/articles/:id/rollback` | Same |
| `/api/media?q=...` | Query string concatenation se path `/api/media*` ban gaya tha |
| `/api/ads/active?slot=...` | Same |
| `/api/tts` GET | Frontend `POST` bhejta hai, URL variable me hai |
| `/api/translate` GET | Same |

Yeh sab **integrated hain**. Report me isliye shamil nahi kiye.

---

## 5. Numbers

| Metric | Value |
| :--- | :--- |
| Server JS files | 10 |
| Frontend files scanned | 54 (`src/`) |
| Backend files | 29 (`server/`) |
| Backend routes | 108 (88 exact + 14 prefix + 6 regex) |
| Frontend unique API calls | 68 |
| Matched calls | 65 |
| Unmatched calls | 3 (sab grievance) |
| Duplicate route pairs | 2 |
| Dead service files | 1 (`authService.js`) |
| Dead components | 1 (`AdsManager.jsx`) |

---

## 6. Jo test NAHI hua (honest limitation)

Yeh **static analysis + syntax check + frontend build** hai. Isme yeh cheezein cover nahi hui:

1. **Runtime handler behaviour** — server real data par boot nahi kiya, isliye koi handler runtime par crash karta hai ya nahi, pata nahi.
2. **Database state** — data files ki validity check nahi ki.
3. **Third-party APIs** — Gemini, Gmail, Supabase, Cloudflare test nahi hue.
4. **Auth flows end-to-end** — login, OTP, 2FA ka full runtime path.

**In sab ke liye throwaway copy par server boot karke har route ka status code record karna hoga** (port 5099, real data untouched).

---

## 7. Recommended action order

| # | Kaam | Effort |
| :--- | :--- | :--- |
| 1 | ~~Grievance ke 3 endpoints banao (P-01)~~ **DONE 20 Nov 17:20** — ab sirf submit par rate limit + body cap baaki | 1 ghanta |
| 2 | Duplicate categories block delete (P-02) | 15 min |
| 3 | `authService.js` + `newsroom_auth.json` delete + manifest update (P-04, P-05) | 30 min |
| 4 | `AdsManager.jsx` / `adService.js` decision (P-03) | 15 min |
| 5 | Runtime smoke test (har route ka status code) | 2-3 ghante |

---

## 8. Files dekhe gaye

```
server/server.js
server/services/*.js        (6 files)
server/cli/*.js             (3 files)
server/data/*.json          (14 files)
src/**/*.{js,jsx}           (54 files)
package.json
vite.config.js
index.html
```

---

**Report prepared by:** Automated integration analysis + manual verification
**Confidence:** High for static findings; runtime behaviour unverified
