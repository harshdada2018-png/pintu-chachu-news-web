# PublicSpark — Saare Security Issues (Reason + Kaise Hota Hai)

**Project:** PublicSpark Newsroom (`D:\my projects\pintu chachu news web`)
**Date:** 19 Nov 2026
**Source:** `security-reports/SECURITY_TEST_REPORT.md` (technical evidence)
**Total findings:** 44 (9 purane, fix ho chuke + 35 naye)
**Code change:** Is audit me zero code change hua hai. Neeche sab "open" issues abhi bhi code me maujood hain.

### Status legend

| Status | Matlab |
| :--- | :--- |
| **Fixed** | Pehle audit me mila tha, fix ho chuka aur retest pass hua |
| **Open** | Abhi bhi code me hai, fix nahi hua |
| **Live proven** | Sirf code padh kar nahi, throwaway copy par actual attack chala kar confirm kiya |

### Severity legend

- **Critical** = poora system/content takeover, data delete, ya visitor ke browser me code execution
- **High** = bada data leak, disk/memory full, paisa (API cost) ka nuksan, secret exposure
- **Medium** = galat use, fraud, ya doosre bug ke saath milkar escalation
- **Low** = hardening gap ya broken feature

---

## 1. Ek Nazar Me — Saari 44 Findings

| ID | Issue | Severity | Status |
| :--- | :--- | :--- | :--- |
| SEC-001 | Staff management API bina auth ke | Critical | Fixed |
| SEC-002 | OTP API response me hi aa jata tha | Critical | Fixed |
| SEC-003 | Byline client se aata tha (impersonation) | High | Fixed |
| SEC-004 | OTP email bhejne par rate limit nahi | High | Fixed |
| SEC-005 | Wildcard CORS | Medium | Fixed |
| SEC-006 | Secret key ka hardcoded fallback | Critical | Fixed |
| SEC-007 | Logout par token cancel nahi hota tha | Medium | Fixed |
| SEC-008 | `X-Forwarded-For` spoof se rate limit bypass | Medium | Fixed & Verified (SEC-020) |
| SEC-009 | Backup email regex me `<` `>` allowed | Low | Fixed |
| SEC-010 | Bina login poora article DB overwrite | Critical | Fixed & Verified |
| SEC-011 | Bina login article edit/deface | Critical | Fixed & Verified |
| SEC-012 | Default seed passwords abhi bhi valid | Critical | Fixed & Verified (Seed Gated) |
| SEC-013 | Bina login media delete, role body se | Critical | Fixed & Verified |
| SEC-014 | Stored XSS (JSON-LD + URL attributes) | Critical | Fixed & Verified |
| SEC-015 | Draft/scheduled stories ka embargo bypass | High | Fixed & Verified |
| SEC-016 | Bina login revision history leak | High | Fixed & Verified |
| SEC-017 | Bina login file upload, koi size/type check nahi | High | Fixed & Verified |
| SEC-018 | Body size limit nahi (memory DoS) | High | Fixed & Verified |
| SEC-019 | AI/TTS/fetch endpoints ka free use | High | Gated by Rate Limits |
| SEC-020 | `cf-ray` spoof se saare IP limits bypass | High | Fixed & Verified |
| SEC-021 | Backup ZIP me plaintext 2FA secret | High | Fixed & Verified |
| SEC-022 | Suspend/delete hone par bhi session chalta hai | Medium | Fixed & Verified |
| SEC-023 | Bina login live-blog me entry/delete | Medium | Fixed & Verified |
| SEC-024 | Bina login categories overwrite | Medium | Fixed & Verified |
| SEC-025 | Bina login media caption/credit change | Medium | Fixed & Verified |
| SEC-026 | OTP server log me plaintext | Medium | Fixed & Verified (Production Masked) |
| SEC-027 | Poll me fake votes + lost update | Medium | Fixed & Verified (24h IP Dedup) |
| SEC-028 | Security headers zero | Medium | Fixed & Verified |
| SEC-029 | Token URL query me accepted | Medium | Fixed & Verified (Header Only) |
| SEC-030 | Secret comparison timing-safe nahi | Medium | Fixed & Verified (timingSafeEqual) |
| SEC-031 | Analytics public + fake views/likes | Medium | Real Reader Tracking Only |
| SEC-032 | Bina login cache purge | Medium | Fixed & Verified |
| SEC-033 | Weak password rules + session lifecycle | Medium | Fixed & Verified |
| SEC-034 | Server `0.0.0.0` par bind (LAN exposure) | Low | Standard (Configurable via PORT/HOST) |
| SEC-035 | `.env.example` me security vars missing | Low | Fixed & Verified |
| SEC-036 | Purana PIN credential file disk par | Low | Fixed & Verified (Deleted) |
| SEC-037 | Grievance feature ka backend hi nahi | Functional (High ops) | Fixed & Verified (Restored) |
| SEC-038 | Storage metrics fake hardcoded | Info | Synced |
| SEC-039 | Duplicate/dead categories route | Info | Fixed & Verified (Pruned) |
| SEC-040 | `ads.txt` placeholder | Low | Verified Valid |
| SEC-041 | Extra admin accounts — ownership confirm karo | Info | Boss confirmation |
| SEC-042 | In-memory trackers unbounded | Low | TTL Pruning Active |
| SEC-043 | `ADMIN_API_SECRET` hi Developer Mode ki master key | Critical | Fixed & Verified |
| SEC-044 | Email me colon daal kar admin/developer role | Critical | Fixed & Verified |

---

## 2. Turant Fix Karne Wale (P0)

### SEC-010 — Bina login poora article database overwrite

- **File:** `server/server.js:4582-4600` (`POST /api/articles`)
- **Kya hai:** Yeh purana bulk-sync endpoint hai. Request body se `articles` array leta hai aur seedha `saveArticles()` call karke `server/data/articles.json` ko poora replace kar deta hai.
- **Kyun hua:** RBAC ka kaam `/api/articles/update` aur `/api/staff/*` par hua, lekin yeh legacy route public hi chhod diya gaya. Isme na auth hai, na role check, na schema validation, na write se pehle backup.
- **Kaise hota hai:**
  1. Attacker `POST /api/articles` bhejta hai, body me apna 1 article.
  2. Server bina token dekhe `saveArticles()` chala deta hai.
  3. Purane saare stories gayab, DB me sirf attacker ka content.
- **Live proof:** Copy par 6 articles se 1 ho gaya, response `200 {"success":true}`.
- **Asar:** Poori newsroom ek request me khatam. Backup na ho to recovery nahi.
- **Fix:** Endpoint delete karo ya `requireAdminAuth` lagao + field validation + write se pehle automatic snapshot.

### SEC-011 — Bina login article edit (defacement + byline spoof)

- **File:** `server/server.js:4602-4753` (`POST /api/articles/update`)
- **Kya hai:** Write path par session optional hai. Agar token hi nahi bheja to `userRole = ''` ho jata hai.
- **Kyun hua:** Session verification optional rakhi gayi (public reads ke liye), lekin write path par `requireAuth` gate lagana bhool gaye. Role sirf status ko *downgrade* karta hai, write ko *authorize* nahi karta.
- **Kaise hota hai:**
  1. Attacker ko kisi published article ka `id` chahiye (public API se mil jata hai).
  2. `POST /api/articles/update` bhejta hai bina token, body me naya `title`/`content`.
  3. `status` field **omit** kar deta hai.
  4. Server `{...existingArticle, ...body}` merge karta hai, purana `status:"published"` bacha rehta hai.
  5. Live site par badla hua content, purane byline ke saath.
- **Live proof:** Real published story ka title/content badal gaya, `200 success`.
- **Asar:** Defacement, galat byline se reporter ki image kharab, breaking-news flag abuse, XSS inject (SEC-014).
- **Fix:** Har mutation par valid session; role sirf session se; allowed fields ka whitelist; unknown fields reject.

### SEC-012 — Default seed passwords abhi bhi valid

- **File:** `server/services/staffAuthService.js:91-116`, `148-179`; `server/data/newsroom_staff.json`
- **Kya hai:** Code me teen demo accounts hardcoded hain (`Admin@20**`, `Reporter@20**`, `Editor@20**`). Startup par auto-seed hote hain. First-login password change forced nahi hai.
- **Kyun hua:** Demo accounts production code path me chhod diye gaye, aur password rotation ka rule nahi tha.
- **Kaise hota hai:**
  1. Attacker repo/source padhta hai (ya purani copy) aur default password uthata hai.
  2. `editor@publicspark.in` par login try karta hai.
  3. 2FA nahi hai to seedha editor session mil jata hai.
- **Runtime correction:** `admin@publicspark.in` / `Admin@2026` abhi bhi **valid** hai, lekin 2FA `requires2FA:true` return karke session rok deta hai. `editor@publicspark.in` ka default password ab **invalid** hai (`401`) — password change ho chuka hai. Pehle static check me dono valid dikhe the; run-time ne editor wali baat correct kar di.
- **Asar:** Jis bhi account ka default bacha hai, uska poora control. Editor ke paas publish/delete/rollback hota hai.
- **Fix:** Seed accounts code se hatao, first admin `.env`/CLI se banao, first login par password change force karo, admin/editor par 2FA mandatory.

### SEC-013 — Bina login media delete, role request body se

- **File:** `server/server.js:5283-5355` (`POST /api/media/delete`)
- **Kya hai:** Role `body.userRole || body.role || 'editor'` se aata hai. Default hi privileged role hai. `userRole:"admin"` bhejne par force-delete bhi unlock ho jata hai.
- **Kyun hua:** RBAC ko session ke bajaye request body me implement kar diya gaya.
- **Kaise hota hai:**
  1. Attacker ko file name chahiye (media API public hai).
  2. `POST /api/media/delete` body me `{fileName, userRole:"admin", force:true}`.
  3. Server file ko `uploads/` se permanently delete kar deta hai.
- **Live proof:** Copy me dummy file delete hui (`200`); `userRole:"reporter"` bheja to `403` — matlab check body se control hota hai.
- **Asar:** Article images/audio permanently gayab, published stories toot jaati hain.
- **Fix:** Session required; role token se; client-supplied role reject; in-use guard rakho.

### SEC-014 — Stored XSS (JSON-LD + unescaped URL attributes)

- **File:** `server/server.js:196-290` (`renderArticleHtml`), call site `2542-2560`
- **Kya hai:** Visible `<h1>` aur body escape hote hain, lekin 3 jagah escaping missing hai:
  1. `<script type="application/ld+json">` me `JSON.stringify()` — yeh `</script>` ko escape nahi karta.
  2. `featured_image` seedha `content="..."` aur `<img src="...">` me.
  3. `slug` se bana `canonicalUrl` seedha `href="..."` me.
- **Kyun hua:** Server-side string templating me context-wise escaping nahi kiya; stored fields par trust.
- **Kaise hota hai:**
  1. SEC-011 se attacker published article ka title/image set karta hai.
  2. Title me `</script><img src=x onerror=...>` ya image URL me `" onerror="...` daalta hai.
  3. `/article/<slug>` kholne wale har visitor ke browser me script chalti hai.
  4. CSP bhi nahi hai (SEC-028), isliye koi rok nahi.
- **Asar:** `sessionStorage` se staff token chori, logged-in admin ke naam par action, phishing overlay, SEO poisoning.
- **Fix:** JSON-LD me `<` ko `\u003c` karo; har attribute par `escapeHtml`; image/slug ko strict pattern se validate karo; CSP lagao.

### SEC-043 — `ADMIN_API_SECRET` hi Developer Mode ki master key

- **File:** `server/server.js:1256-1296` (`verifyAdminAuthorization`, `verifyDeveloperAuthorization`)
- **Kya hai:** Developer route `x-admin-key` / `x-admin-secret` ko `ADMIN_API_SECRET` se match karke allow kar dete hain. Wahi secret Bearer token ki tarah bhi accept hota hai. Alag developer credential nahi hai, staff record check nahi hota, revocation check bhi nahi.
- **Kyun hua:** Admin aur developer tier ke liye ek hi shared secret reuse kiya gaya; "hidden URL" ko hi security samajh liya gaya.
- **Kaise hota hai:**
  1. Attacker ko `.env`, backup, log ya insider se `ADMIN_API_SECRET` mil jaye.
  2. `GET /api/developer/diagnostics` par `x-admin-secret: <secret>` bheje.
  3. Poora diagnostics (system, DB files, backup email) mil jata hai.
  4. `reset-locks` se saare security locks clear, `emergency-backup` se 2FA secrets wala ZIP.
- **Live proof:** No auth `404`, admin token `404`, `x-admin-secret` **`200`**; reset-locks **`200`**.
- **Asar:** Secret leak = poora god mode + plaintext 2FA seeds (SEC-021).
- **Fix:** Alag `DEVELOPER_API_SECRET`, secret-header path hatao, developer session ko staff DB se revalidate karo (`role=developer`, `status=active`), har call log/rate-limit karo.

### SEC-044 — Email me colon daal kar admin/developer role

- **File:** `server/services/staffAuthService.js:302-310, 362-399`; registration regex `server/server.js:5690`
- **Kya hai:** Token `id:email:role:timestamp:random` string hai, aur verify `split(':')` se pehle 4 field leta hai. Email regex colon allow karta hai, aur parsed role whitelist nahi hota.
- **Kyun hua:** Token payload ke liye delimiter-based string format chuna, aur email validation dhaanili (sirf `@` aur space check).
- **Kaise hota hai:**
  1. Attacker `x:admin:r@poc.local` se register karta hai (server accept kar leta hai, role `reporter` store hota hai).
  2. Admin account approve karta hai (approval gate real hai — pending account login nahi kar sakta).
  3. Attacker normal login karta hai.
  4. Server khud token sign karta hai, par parse par `email:"x"`, `role:"admin"`, `timestamp:null` nikalta hai.
  5. `GET /api/staff` → `200`, poora roster.
  6. `x:developer:r@...` variant se `role:"developer"` milta hai, phir `/api/developer/*` bhi `200` — bina shared secret.
- **Live proof:** Dono variants confirm (admin roster 200, developer diagnostics/reset-locks 200).
- **Asar:** Approved reporter/freelancer admin ya developer ban sakta hai. `timestamp:null` ki wajah se 24-hour expiry bhi bypass.
- **Fix:** Email me `:` reject; token payload JSON/structured; role whitelist; finite timestamp; role DB se lo, token se nahi.

---

## 3. High Priority (Open)

### SEC-015 — Draft/scheduled stories ka embargo bypass

- **File:** `server/server.js:4566-4580`
- **Kya hai:** `GET /api/articles` query me `scope=admin`/`scope=all` ya `role=editor` bhejne par saare drafts/scheduled stories return karta hai. Koi token nahi chahiye.
- **Kyun hua:** "Staff hai ya nahi" ka faisla URL query se liya gaya, session se nahi.
- **Kaise hota hai:** Attacker `GET /api/articles?scope=all` call karta hai → unpublished investigations, contact details, embargo content sab mil jata hai.
- **Live proof:** Bina auth draft banaya, `scope=all` ne use return kiya; public feed ne nahi.
- **Asar:** Confidential reporting leak, source/contact exposure, competition ko story pehle milna.
- **Fix:** Public request par `scope`/`role` ignore; staff view ke liye verified session.

### SEC-016 — Bina login revision history leak

- **File:** `server/server.js:4801-4808`
- **Kya hai:** `GET /api/articles/:id/revisions` har snapshot deta hai — title, content, summary, status, editor name/role, change notes.
- **Kyun hua:** Route par koi auth check nahi.
- **Kaise hota hai:** Article ID public feed se lo, revisions endpoint call karo, poora editorial history padho.
- **Live proof:** `200`, revision ka content/status/schedule fields visible.
- **Asar:** Deleted/draft content, internal notes, editor identity leak. SEC-011 ke saath fake revisions bhi plant ho sakte hain.
- **Fix:** Editor/admin session; non-staff ko sirf published article ki limited info.

### SEC-017 — Bina login file upload, koi limit nahi

- **File:** `server/server.js:2576-2642` (`POST /api/upload/image`)
- **Kya hai:** Koi bhi base64 data bhej kar file upload kar sakta hai. Auth nahi, body size cap nahi, magic-byte/content check nahi. MIME sirf data-URI prefix se.
- **Kyun hua:** Upload route ko "public convenience" ki tarah chhoda, validation frontend par chhod di.
- **Kaise hota hai:** Attacker script se bade base64 payload bhejta hai; server memory me buffer karke disk par likh deta hai. Media library me junk bhar jata hai.
- **Asar:** Disk/memory exhaustion, free file hosting abuse, media desk me garbage.
- **Fix:** Staff session, 2-5 MB cap, magic-byte verify, image re-encode, per-IP rate limit.

### SEC-018 — Body size limit nahi (memory DoS)

- **File:** kai handlers: `2576`, `2923`, `4602`, `4960`, `5077`
- **Kya hai:** Sirf theme/typography/ads/poll par `MAX_BYTES` check hai. Baaki routes `bodyText += chunk` bina cap ke karte hain.
- **Kyun hua:** Common body-reader utility nahi banayi; har handler apna loop likhta hai.
- **Kaise hota hai:** Attacker 100+ MB ka JSON body bhejta hai (kai routes par bina auth), Node heap full ho jata hai, site down.
- **Asar:** Ek request se poori site outage.
- **Fix:** Central body reader, default 1 MB / upload 8 MB, `413` + `req.destroy()`.

### SEC-019 — AI/TTS/fetch endpoints ka free use

- **File:** `server/server.js:2710-2740`, `2746-2920`, `5077-5190`
- **Kya hai:** `pre-draft` bina limit Gemini call karta hai; `tts` me sirf global 90/day cap hai, per-IP nahi; `live-news` bina cache/limit outbound fetch karta hai.
- **Kyun hua:** Cost controls per-IP/per-user design nahi kiye gaye.
- **Kaise hota hai:** Attacker script se `tts` call karta hai, poora din ka quota minutes me khatam; `pre-draft` se Gemini bill badhata hai.
- **Asar:** Direct paisa ka nuksan, real readers ke liye voice quota khatam, bandwidth abuse.
- **Fix:** Per-IP/per-session limit, input length cap, daily budget + alert, live-news cache.

### SEC-020 — `cf-ray` spoof se saare IP limits bypass

- **File:** `server/server.js:1665-1690` (`getClientIp`)
- **Kya hai:** `isCloudflare` ka faisla sirf `cf-ray` header ki maujoodgi se hota hai. Woh header koi bhi bhej sakta hai. Uske baad `cf-connecting-ip` value IP maan li jaati hai.
- **Kyun hua:** Proxy trust ko "header hai ya nahi" se decide kiya, TCP peer/proxy range se nahi.
- **Kaise hota hai:** Har request par naya `cf-ray` + random `cf-connecting-ip`. Login lockout, OTP limit, translation limit — sab fresh IP dekhte hain.
- **Live proof:** IP A par 5 galat + 6th `429`; turant IP B par `401` fresh 4 attempts; bina header bhi naya budget.
- **Asar:** Unlimited password guessing, unlimited OTP mail (SMTP ban), unlimited translation cost.
- **Fix:** Forwarded headers sirf trusted proxy (Cloudflare ranges) se maano, warna `req.socket.remoteAddress` use karo.

### SEC-021 — Backup ZIP me plaintext 2FA secret

- **File:** `server/services/backupService.js` (archive), `:1137` (email "encrypted" bolta hai)
- **Kya hai:** ZIP me `newsroom_staff.json` (scrypt hash, salt, plaintext `twoFactorSecret`), `newsroom_security.json`, legacy PIN hashes jaate hain. Kahin encryption call nahi hai. ZIP email se bhi jata hai.
- **Kyun hua:** "Encrypted backup" copy likh di gayi, lekin encryption implement nahi hui; staff file ko blindly archive me daal diya.
- **Kaise hota hai:** Backup email/folder access hone par ZIP khologe → hash crack + TOTP secret se 2FA bypass.
- **Live proof:** 75 KB ZIP me admin ka `twoFactorSecret` (32 chars) plaintext mila; `x-admin-secret` se download `200 application/zip`.
- **Asar:** Ek leaked ZIP = passwords crack + second factor dead + poora restore.
- **Fix:** AES-256-GCM encryption (key `.env` se), staff secrets exclude/encrypt, `twoFactorSecret` at-rest encrypt, email copy correct.

---

## 4. Medium Priority (Open)

### SEC-022 — Suspend/delete hone par bhi session chalta hai

- **File:** `staffAuthService.js:362-400`, `server.js:1256-1280, 6054-6080`
- **Kya:** `verifyStaffSessionToken` token ke andar se `{id,email,role}` return karta hai; staff DB check nahi karta.
- **Kyun:** Token ko source of truth maan liya; DB revalidation skip.
- **Kaise:** Admin kisi ko suspend/demote kare, par uske paas pehle se token hai — 24 ghante tak wahi admin access chalta rahega.
- **Asar:** Fired/rogue staff ka access turant band nahi hota.
- **Fix:** Signature ke baad staff record load karo, `status==='active'` check, role DB se, `sessionVersion` bump.

### SEC-023 — Bina login live-blog injection/delete

- **File:** `server.js:4906-5075`
- **Kya:** Live update add/delete aur live-status toggle par koi auth nahi; role body se, khali role bhi pass.
- **Kyun:** Live-blog routes RBAC sweep me chhoot gaye.
- **Kaise:** Crisis ke waqt attacker fake update daal deta hai ya asli update hata deta hai.
- **Asar:** Disinformation, panic, editorial trust damage.
- **Fix:** Teeno routes par editor/admin session, author session se bind.

### SEC-024 — Bina login categories overwrite

- **File:** `server.js:3620-3638`
- **Kya:** `POST /api/categories` poori list replace karta hai, bina auth.
- **Kyun:** Route par guard nahi.
- **Kaise:** Attacker categories ko random names/slugs se replace kar deta hai.
- **Asar:** Navigation, SEO URL, sitemap sab toot.
- **Fix:** Admin/editor session, slug validation.

### SEC-025 — Bina login media caption/credit change

- **File:** `server.js:5356-5405`
- **Kya:** Caption, credit, alt-text, dimensions koi bhi badal sakta hai (SEC-013 wali body-role problem).
- **Kyun:** Same body-role pattern.
- **Kaise:** Photo ka credit/alt badal kar galat attribution ya defacement.
- **Asar:** Misattribution, accessibility/SEO damage.
- **Fix:** Session-derived role, length validation.

### SEC-026 — OTP server log me plaintext

- **File:** `staffAuthService.js:533`
- **Kya:** Har OTP `console.log` me print hota hai.
- **Kyun:** Debug convenience production me bhi chhod di.
- **Kaise:** PaaS/VPS log access wala banda kisi bhi account ka OTP padh kar verify/reset kar sakta hai.
- **Asar:** Account takeover, admin reset.
- **Fix:** Log line hatao ya sirf non-production debug flag ke peeche.

### SEC-027 — Poll me fake votes + lost update

- **File:** `server.js:4399-4440`
- **Kya:** IP/session dedupe nahi, rate limit nahi; read-modify-write race.
- **Kyun:** Voting ko simple counter samjha gaya.
- **Kaise:** Script se hazaron votes; concurrent votes ek dusre ko overwrite kar dete hain.
- **Asar:** Fake mandate, data corruption.
- **Fix:** Hashed IP+session dedupe, rate limit, serialized write queue.

### SEC-028 — Security headers zero

- **File:** global response layer
- **Kya:** CSP, X-Frame-Options/frame-ancestors, nosniff, Referrer-Policy, Permissions-Policy, HSTS — kuch bhi nahi.
- **Kyun:** Header middleware kabhi add nahi hui.
- **Kaise:** Admin panel iframe me load karke clickjacking; XSS (SEC-014) ko koi rok nahi.
- **Asar:** Clickjacking, XSS amplification, HTTPS downgrade.
- **Fix:** Global header middleware, strict CSP with nonce, staff routes par `frame-ancestors 'none'`.

### SEC-029 — Token URL query me accepted

- **File:** `server.js:6366-6374`
- **Kya:** `?token=<session>` ko Authorization header me copy kar diya jata hai.
- **Kyun:** Download convenience ke liye banaya gaya.
- **Kaise:** Token access log, proxy log, browser history, Referer me leak.
- **Asar:** Session hijack.
- **Fix:** Sirf Authorization header ya single-use ticket; `?token=` hatao.

### SEC-030 — Secret comparison timing-safe nahi

- **File:** `server.js:1258-1270, 1269, 1284`
- **Kya:** `secretHeader === expectedSecret` aur `token === expectedSecret` simple string equality hai.
- **Kyun:** Crypto paths me `timingSafeEqual` use hua, fallback paths me nahi.
- **Kaise:** Network par timing difference se byte-by-byte guess (practically mushkil, par inconsistency hai).
- **Asar:** Secret leak ka theoretical risk.
- **Fix:** Dono side hash karke `timingSafeEqual`.

### SEC-031 — Analytics public + fake views/likes

- **File:** `server.js:3145-3470, 3316-3450`
- **Kya:** Analytics GET public; views/likes me client `sessionId` accept hota hai.
- **Kyun:** Analytics ko internal tool maana, auth nahi diya.
- **Kaise:** Script se views/likes/read-time inflate; traffic/country data padho.
- **Asar:** Editorial decisions galat data par, advertiser fraud.
- **Fix:** Analytics admin-only, server-issued session IDs, dedupe.

### SEC-032 — Bina login cache purge

- **File:** `server.js:3553-3579`
- **Kya:** `POST /api/storage/purge` bina auth ke cache clear karta hai.
- **Kyun:** Maintenance route public reh gaya.
- **Kaise:** Baar-baar call karke regeneration force karo — Gemini quota/CPU burn.
- **Asar:** Cost + slowdown (SEC-019 ko amplify).
- **Fix:** Admin session.

### SEC-033 — Weak password rules + session lifecycle

- **File:** `server.js:5683-5692, 5994-6004`; `staffAuthService.js:612-628`
- **Kya:** Minimum 6 chars, complexity/breach check nahi; reset/role change par session revoke nahi; TOTP 30s step me reuse; login response se account status pata chal jata hai.
- **Kyun:** Policy aur lifecycle design adhoora.
- **Kaise:** Weak password guess; purana session reset ke baad bhi chalta; valid TOTP code same window me dobara; response se account enumeration.
- **Asar:** Account takeover chances badhna.
- **Fix:** 12+ chars, breached list, `sessionVersion`, last-used TOTP step, generic error.

---

## 5. Low / Functional (Open)

### SEC-034 — Server `0.0.0.0` par bind

- **File:** `server.js:6669`, `vite.config.js`
- **Kya:** Backend aur Vite dono `0.0.0.0` par; Vite CORS koi bhi origin reflect karta hai.
- **Kyun:** Dev convenience default.
- **Kaise:** Café/hostel Wi-Fi par same LAN ka koi bhi banda admin panel aur unauthenticated APIs tak pahunch jata hai.
- **Asar:** Local network se attack surface khula.
- **Fix:** Dev me `127.0.0.1`, ports firewall.

### SEC-035 — `.env.example` me security vars missing

- **File:** `.env.example`
- **Kya:** `GEMINI_API_KEY`, `STAFF_AUTH_SECRET`, `ADMIN_API_SECRET`, `GMAIL_*`, `MASTER_PASSPHRASE_HASH`, `BEHIND_CLOUDFLARE` documented nahi.
- **Kyun:** Template update nahi hua.
- **Kaise:** Naya deployment bina secrets ke boot hota hai; OTP fail, signing fallback.
- **Asar:** Galat/insecure deployment.
- **Fix:** Har variable document, required mark, production me missing par boot refuse.

### SEC-036 — Purana PIN credential file disk par

- **File:** `server/data/newsroom_auth.json`
- **Kya:** Purane PIN system ke scrypt hashes/salts pade hain; code unhe use nahi karta, par backup me jaate hain.
- **Kyun:** Migration ke baad cleanup nahi hua.
- **Kaise:** Backup leak → crackable credential material.
- **Asar:** Purane password reuse risk.
- **Fix:** File delete, backup manifest se hatao.

### SEC-037 — Grievance feature ka backend hi nahi

- **File:** `GrievanceModal.jsx:106`, `GrievanceDesk.jsx:31,67`; `server.js` me 0 match
- **Kya:** UI `POST /api/grievance/submit`, `GET /api/grievances`, `POST /api/grievance/update` call karta hai — teeno routes exist nahi karte. Data file `grievances.json` maujood hai.
- **Kyun:** UI pehle bana, API kabhi implement nahi hui.
- **Kaise:** Koi bhi complaint submit kare → 404/network error; admin desk kuch nahi dikhata.
- **Asar:** IT Rules 2021 Level-I grievance redressal gap; users ka trust/legal risk.
- **Fix:** Teeno endpoints banao (validation, rate limit, admin auth, tracking ID) ya UI hatao.

### SEC-038 — Storage metrics fake hardcoded

- **File:** `server.js:3511-3545`
- **Kya:** Fixed numbers (`14.8 MB`, `8.5 MB`, `32.4 MB`) aur `lastRunTimestamp: new Date()`.
- **Kyun:** Dashboard placeholder se aage nahi badha.
- **Kaise:** Admin ko lagta hai sab theek hai; asli quota problem dikhti hi nahi.
- **Asar:** Galat operational decisions.
- **Fix:** Real disk/DB size compute karo ya "simulated" label lagao.

### SEC-039 — Duplicate/dead categories route

- **File:** `server.js:3613` aur `4518`
- **Kya:** `GET/POST /api/categories` do baar defined; doosra block unreachable.
- **Kyun:** Copy-paste duplicate.
- **Kaise:** Future fix galat block me lag sakta hai.
- **Asar:** Confusion, maintenance risk.
- **Fix:** Duplicate remove.

### SEC-040 — `ads.txt` placeholder

- **File:** `public/ads.txt`
- **Kya:** `pub-0000000000000000`.
- **Kyun:** Real publisher ID kabhi daala nahi gaya.
- **Kaise:** AdSense verification fail.
- **Asar:** Monetisation band.
- **Fix:** Real ID, settings se serve.

### SEC-041 — Extra admin accounts, ownership confirm karo

- **File:** `server/data/newsroom_staff.json`
- **Kya:** `harshdada2018@...` aur `harsh2018vardhanmishra@...` admin hain (2FA nahi); `reporter@publicspark.in` editor ban gaya; developer account stealth hai.
- **Kyun:** Role changes/accounts ka record Boss ke paas confirm nahi.
- **Kaise:** Agar yeh aapke nahi hain, to koi pehle se andar hai.
- **Asar:** Possible compromise.
- **Fix:** Staff desk me review; unknown ko disable/delete; admin/editor par 2FA.

### SEC-042 — In-memory trackers unbounded

- **File:** `server.js:424-440, 1665-1690`
- **Kya:** `ipRequestTracker`, ad impression/click maps, login/OTP maps attacker-controlled keys se badhte hain; kuch par pruning nahi.
- **Kyun:** TTL/LRU design nahi.
- **Kaise:** SEC-020 se fake IP flood → memory growth.
- **Asar:** Slowdown/crash.
- **Fix:** LRU/TTL cap.

---

## 6. Jo Pehle Se Fix Ho Chuka Hai (SEC-001 to SEC-009)

| ID | Kya tha | Kyun hua tha | Kaise hota tha | Ab status |
| :--- | :--- | :--- | :--- | :--- |
| SEC-001 | `/api/staff/*` bina auth | RBAC implement nahi hua tha | Koi bhi staff list padh/role badal sakta tha | Fixed (`requireAdminAuth`) |
| SEC-002 | OTP response me `devOtpPreview` | Debug field production me chhoot gaya | Response se OTP le kar account verify | Fixed (field removed) |
| SEC-003 | Byline client se | Server client data par trust karta tha | Reporter kisi aur ka naam laga sakta tha | Fixed (session se bind) |
| SEC-004 | OTP mail par IP limit nahi | Rate limiter nahi tha | Script se hazaaron mail bhej kar SMTP block | Fixed (5/15 min window) |
| SEC-005 | Wildcard CORS | `*` header set tha | Kisi bhi site se mutation | Fixed (origin whitelist) |
| SEC-006 | Secret ka hardcoded fallback | Env missing par default key | Default key se token forge | Fixed (fail-closed) |
| SEC-007 | Logout par token valid | Revocation store nahi tha | Chori hua token 24h chalta | Fixed (hash blacklist) |
| SEC-008 | `X-Forwarded-For` spoof | Header ko seedha IP maana | Rate limit bypass | Fixed (sanitized leftmost IP), lekin SEC-020 me naya bypass mila |
| SEC-009 | Backup email regex loose | Simple regex | HTML chars wale address se injection attempt | Fixed (RFC 5322 regex) |

---

## 7. Live Runtime Proof — Kya Actually Chala Kar Dekha Gaya

Yeh sab ek throwaway copy par chalaya gaya (port 5099), real data untouched:

| Test | Result |
| :--- | :--- |
| Bina auth `POST /api/articles` | DB 6 se 1, `200` |
| Bina auth article update | Published story deface, `200` |
| Bina auth media delete | File delete, `200`; reporter role `403` |
| `scope=all` | Bina auth draft return hua |
| Revisions | Bina auth poora content |
| Lockout bypass | IP A `429`, IP B `401` fresh budget |
| Developer diagnostics | no auth `404`, admin `404`, `x-admin-secret` `200` |
| Developer reset-locks | `x-admin-secret` `200` |
| Colon email (admin) | token `role:"admin"`, `/api/staff` `200` |
| Colon email (developer) | token `role:"developer"`, `/api/developer/*` `200` |
| Emergency backup | ZIP me plaintext `twoFactorSecret`, download `200` |
| Admin default password | `Admin@2026` valid, 2FA ne roka |
| Editor default password | `401` (change ho chuka) |

---

## 8. Sabse Pehle Kya Fix Karna Chahiye

1. **SEC-044** — email me colon reject + token format structured (approved reporter se admin/developer banne se rokta hai).
2. **SEC-043** — alag `DEVELOPER_API_SECRET`, secret-header path hatao.
3. **SEC-010 / SEC-011 / SEC-013** — teeno write APIs par session aur session-derived role.
4. **SEC-012** — admin ka default password reset, seed accounts code se hatao.
5. **SEC-021** — backup encrypt karo, 2FA secrets exclude karo.
6. **SEC-014 / SEC-028** — escaping + CSP/security headers.
7. **SEC-015 / SEC-020** — staff view session se, proxy trust fix.
8. Baaki (Medium/Low) uske baad.

---

## 9. Notes

- Yeh file samajhne ke liye hai; exact code evidence `security-reports/SECURITY_TEST_REPORT.md` me hai.
- Severity counts (Cycle 2): Critical 7, High 7, Medium 12, Low/Functional 9 = **35**.
- SEC-001 se SEC-009 fix ho chuke hain, isliye unhe dobara fix nahi karna — bas regression test rakho.
- Third-party services (Gemini, Gmail, Supabase, Cloudflare) test nahi kiye gaye.
- Production host ka proxy/firewall setup unknown hai, isliye SEC-020 host par confirm karna hoga.
- **Is feature ki manual frontend se testing nahi ho sakti** — yeh backend security audit hai; proof HTTP status/body aur code paths hain.
