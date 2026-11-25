# Roadmap: Har Dimension ko 8+ Tak Kaise Le Jayen

**Project:** PublicSpark Newsroom
**Date:** 20 Nov 2026
**Code change:** ZERO (yeh plan hai)
**Target:** Visual 8+, Typography 8.5+, Frontend 8+, Backend 8+, SEO 8+, A11y 8+, Security 8+, Polish 8+

---

## 0. Pehle ek honest correction

Pichhle report me maine likha tha "JS bundle 1,080 KB". Woh **uncompressed** hai.

| Metric | Actual |
| :--- | :--- |
| JS uncompressed | 1,080 KB |
| **JS gzipped** | **264 KB** |
| CSS gzipped | 10.75 KB |
| Font faces | **947** |

Yani bundle size alone frontend ko 5.5 par nahi le jata. Asli wajah hai:
- 947 font faces (30+ Google Fonts families)
- single chunk, koi code splitting nahi
- 37,084 frontend lines, jinme `App.jsx` 2,025 aur `AdminWorkspace.jsx` 3,924 lines
- inline styles + 3,867-line global CSS ka mix
- koi error boundary / loading / empty state system nahi

Yeh correction important hai kyunki galat number par optimize karna time waste hai.

---

## 1. "8+" ka objective definition

Har dimension ke liye acceptance criteria pehle fix karte hain, warna score subjective rahega.

| Dimension | 8+ ka matlab (measurable) |
| :--- | :--- |
| Visual design | Zero broken asset, zero placeholder content, all states (empty/loading/error) designed, 360/768/1024/1440 verified, light+dark checked |
| Typography & system | ≤ 3 font families, heading hierarchy complete (H1-H6), line-length 60-75ch, no CLS from fonts, tokens documented |
| Frontend | Initial JS < 180 KB gzip, route-level splitting, lint clean, zero console errors, no file > 400 lines, error boundaries |
| Backend | No file > 600 lines, central middleware, every mutating route validated, structured logs, error handling, tests |
| SEO | Lighthouse SEO 100, H1 on every page, meta+OG+canonical, valid JSON-LD, sitemap verified |
| Accessibility | Lighthouse A11y 100, full keyboard nav, AA contrast, screen reader pass, focus visible |
| Security | 0 critical/high open, all fixes retested, secrets rotated, VAPT pass |
| Production polish | Real content, all endpoints 200, monitoring, restore-tested backup, staging/prod separated |

---

## 2. Scorecard tracker

| Dimension | Ab | Target | Gap | Effort (hours) |
| :--- | :--- | :--- | :--- | :--- |
| Visual design | B+ 7 | 8.5 | 1.5 | 30-50 |
| Typography & system | A- 8 | 9 | 1 | 20-30 |
| Frontend engineering | B- 5.5 | 8 | 2.5 | 60-100 |
| Backend engineering | B- 5 | 8 | 3 | 80-120 |
| SEO | C- 4 | 9 | 5 | 10-20 |
| Accessibility | B 7 | 8.5 | 1.5 | 15-25 |
| Security | F 2 | 8 | 6 | 80-150 |
| Production polish | D 3 | 8.5 | 5.5 | 20-30 |
| **Total** | **B-** | **A-** | — | **315-525** |

**Realistic timeline:** 8-12 weeks solo (40 hrs/week), ya 4-6 weeks 2 logon ke saath.

**Cost (agar hire karo):** ₹4,00,000 – ₹10,00,000 @ ₹1,200-2,500/hr.
(Pichhla ₹2-7L estimate sirf "fixes" ka tha; yeh poora refactor hai.)

---

## 3. SEO: 4 → 9 (sabse sasta, sabse bada jump)

**Ab kya galat hai:**
- Homepage par `<h1>` = 0
- Meta description, canonical, OG tags = missing
- `<html lang="en">` jabki content Hindi
- JSON-LD sirf article pages par, homepage par nahi
- Sitemap/robots routes server me hain (`server.js:2508`, `2519`) — content verify nahi hua

**Kya karna hai:**

| # | Kaam | File |
| :--- | :--- | :--- |
| 1 | Har page par exactly ek `<h1>`; section titles `h2`, cards `h3` | `App.jsx`, `Header.jsx`, `ArticleReader.jsx` |
| 2 | Runtime `<title>`, `<meta name="description">`, `<link rel="canonical">` set karo route ke hisaab se | `App.jsx` layout effect |
| 3 | OG + Twitter card tags (title, description, image, type) | same |
| 4 | `document.documentElement.lang` ko active language se bind karo (`hi`, `en`, `ur`...) | `App.jsx` |
| 5 | Homepage par `WebSite` + `Organization` JSON-LD | `renderArticleHtml` ke pattern se |
| 6 | Sitemap me sirf published + `lastmod` sahi; robots me sitemap line | `server.js:2508-2528` |
| 7 | Breadcrumb JSON-LD article pages par | `renderArticleHtml` |
| 8 | Canonical slug validation (SEC-014 ke saath) | `server.js:196-290` |

**Verify:** Lighthouse SEO = 100; `curl` se meta tags check; Rich Results Test se JSON-LD valid.

**Effort:** 10-20 hours. **Risk:** Low.

---

## 4. Production polish: 3 → 8.5 (turant dikhne wala farq)

**Ab kya galat hai:**

| Problem | Evidence |
| :--- | :--- |
| Broken sponsor banner (404) | `settings.json:107` → `/uploads/test_banner.webp` missing |
| Test data live | `settings.json:109` "Audit Test Sponsor Updated" |
| "Hello" published headline | `/api/articles` data |
| Khaali AdSense box public | homepage sidebar |
| "Video unavailable" | article page YouTube embed |
| "Advertisment" spelling | sponsored label |
| Duplicate language/theme controls | 2 header rows |
| "allNews" brand label | mobile/tablet header |
| Unsplash hotlinked images | article API data |
| Footer ke upar 200px+ gap | layout |
| Floating widget header ke peeche cut | z-index |

**Kya karna hai:**

1. **Content purge** — test articles ("Hello"), test sponsor, test banners delete. Published feed me sirf real content.
2. **Asset validation** — ad/sponsor image URL agar 404 de to unit hide karo, broken image na dikhao.
3. **Ad slot policy** — AdSense live na ho to slot render hi na karo (`if (!adsenseClientId) return null`).
4. **Video embed validation** — YouTube ID ko `noembed`/oEmbed se check karo, invalid ho to embed hatao.
5. **Error/empty states** — har list ke liye: loading skeleton, empty message, error retry.
6. **Header cleanup** — ek hi language selector + ek hi theme toggle.
7. **Brand fix** — "allNews" → "PublicSpark" ya menu label.
8. **Image strategy** — apni images upload karo ya local cache; Unsplash hotlink hatao.
9. **Layout fixes** — footer gap, floating widget z-index, tablet columns.

**Verify:** Har page manually 360/768/1024/1440 par dekho; console me zero 404; `document.querySelectorAll('img')` me koi broken naturalWidth=0 na ho.

**Effort:** 20-30 hours. **Risk:** Low.

---

## 5. Visual design: 7 → 8.5

**Kyun 7 hai:** broken states aur placeholder content design ko sasta dikha rahe hain. Design language khud strong hai.

**Kya karna hai:**

| # | Kaam |
| :--- | :--- |
| 1 | Section 4 ka poora cleanup (yeh 60% gap cover karta hai) |
| 2 | Tablet (768-1024) grid: `auto-fit/minmax` se khaali columns khatam |
| 3 | Spacing rhythm audit — section padding 8pt scale par |
| 4 | Card hover/focus/active states consistent |
| 5 | Skeleton loaders (layout shift zero) |
| 6 | Empty states ka design (saved stories, search no-result, media library) |
| 7 | 360px par text truncation aur touch targets 44px verify |
| 8 | Dark mode me har section visually verify (ab tak nahi kiya) |

**Verify:** 4 widths × 2 themes = 8 screenshots; koi horizontal scroll nahi; Lighthouse CLS < 0.1.

**Effort:** 30-50 hours. **Risk:** Low.

---

## 6. Typography & design system: 8 → 9

**Kyun 8 hai:** fonts 30+ families load ho rahe hain (947 faces), heading hierarchy missing, token docs nahi.

**Kya karna hai:**

1. **Font strategy** — 30+ families se 3-4 par aao (Playfair, Plus Jakarta, ek Devanagari, ek Nastaliq). Baaki `@font-face` hatao. `index.html:33` ka giant Google Fonts URL rewrite karo.
2. **Subsetting + preload** — `font-display: swap`, critical fonts `<link rel="preload">`.
3. **Type scale** — ek documented scale (1.25 ratio) tokens me.
4. **Heading hierarchy** — H1-H6 ka size/weight/line-height map.
5. **Reading measure** — article body 60-75ch, line-height 1.6-1.75.
6. **CLS zero** — font swap par layout shift na ho (size-adjust fallback).
7. **Token documentation** — `DESIGN.md` me palette, type, spacing, radii.

**Verify:** DevTools Network me font requests ≤ 6; Lighthouse CLS < 0.05; `document.fonts.size` ~10-20 (947 se).

**Effort:** 20-30 hours. **Risk:** Low-Medium (visual regression).

---

## 7. Accessibility: 7 → 8.5

**Kyun 7 hai:** Lighthouse 90 — matlab kuch cheezein missing hain, par detail nahi nikali.

**Pehla kadam:** Lighthouse ka detailed report nikaalo (axe ya Lighthouse JSON) — exact failing rules list karo. Guess mat karo.

**Phir yeh standard list:**

| # | Kaam |
| :--- | :--- |
| 1 | Contrast AA — muted text (`#68737D`) aur dark mode tokens verify |
| 2 | Focus visible — har interactive element par `:focus-visible` ring |
| 3 | Keyboard nav — modals me focus trap, Esc close, Tab order |
| 4 | Skip link — "Skip to content" |
| 5 | Form labels — har input par `<label>` ya `aria-label` |
| 6 | Icon buttons — `aria-label` (search, theme, menu, share) |
| 7 | Live regions — toast/notification `aria-live` |
| 8 | `prefers-reduced-motion` — ticker aur animations respect karein |
| 9 | Images — alt text meaningful (abhi 11/11 hai, par quality check) |
| 10 | Heading order — H1 se shuru, skip nahi |

**Verify:** Lighthouse A11y = 100; keyboard-only ek full flow (search → article → save); screen reader (NVDA) se homepage.

**Effort:** 15-25 hours. **Risk:** Low.

---

## 8. Security: 2 → 8 (sabse bada kaam)

Yeh already detailed plan hai (`SECURITY_ISSUES_LIST.md` + pichhla remediation plan). Yahan sirf 8+ ka criteria:

**8+ ka matlab:**
- 0 critical, 0 high open
- Har fix ka PoC retest pass
- Secrets rotated (`ADMIN_API_SECRET`, `STAFF_AUTH_SECRET`)
- Purane backups + `newsroom_auth.json` delete
- Security headers live (CSP enforce)
- Negative tests CI me
- Independent VAPT pass (₹50K-1.5L)

**Order:**

| Phase | Kaam | Findings | Hours |
| :--- | :--- | :--- | :--- |
| 1 | Auth core + developer tier + write routes | 044, 043, 010, 011, 013, 022, 029, 030 | 25-35 |
| 2 | Exposure + XSS + headers + backups + IP trust | 012, 014, 015, 016, 020, 021, 028 | 25-40 |
| 3 | Uploads, body limits, rate limits, cost | 017, 018, 019, 042 | 15-25 |
| 4 | Medium/low batch + ops | 023-027, 031-036, 038-040 | 15-25 |
| 5 | Tests + retest + VAPT | — | 15-25 |

**Effort:** 80-150 hours. **Risk:** High (auth touch karta hai) — isliye tests pehle.

---

## 9. Frontend engineering: 5.5 → 8

**Kyun 5.5 hai:**
- single JS chunk (264 KB gzip), koi route splitting nahi
- `App.jsx` 2,025 lines, `AdminWorkspace.jsx` 3,924 lines
- inline styles + global CSS mix
- koi error boundary nahi
- koi frontend test nahi

**Kya karna hai:**

| # | Kaam | Impact |
| :--- | :--- | :--- |
| 1 | **Route-level code splitting** — `React.lazy` + `Suspense` admin/editor/reporter ke liye | Initial JS 264 KB → < 180 KB |
| 2 | **Vendor chunk** — react, lucide alag chunk | Caching better |
| 3 | **Big files todo** — `AdminWorkspace` ko 8-10 desks me split (already components hain, wiring nikalo) | Maintainability |
| 4 | **Error boundary** — har major route par | Crash par white screen nahi |
| 5 | **Data layer** — fetch calls `src/services/*` me centralize (kuch hain, sab karo) | Consistency |
| 6 | **Loading/empty/error states** — ek reusable component | UX + perceived speed |
| 7 | **Inline styles → CSS modules/tokens** — dheere dheere, ek section at a time | Consistency |
| 8 | **Lint clean** — `npm run lint` zero warnings | Quality gate |
| 9 | **Tests** — Vitest + React Testing Library, critical flows (login, publish, media delete) | Regression safety |
| 10 | **Bundle budget** — CI me fail agar > 180 KB gzip | Future-proof |

**Verify:** build output me initial chunk < 180 KB gzip; zero console errors; lint clean; 10+ tests pass.

**Effort:** 60-100 hours. **Risk:** Medium.

**Important:** Refactor se pehle tests likho. Bina tests ke 3,924-line file todo dena regression invite karta hai.

---

## 10. Backend engineering: 5 → 8

**Kyun 5 hai:**
- `server.js` 6,684 lines, 108 routes
- 47 duplicate body-reader loops
- 19 `fs.writeFileSync` (no atomic write, no lock)
- koi router/middleware structure nahi
- koi structured logging nahi
- koi backend test nahi

**Kya karna hai:**

| # | Kaam | Detail |
| :--- | :--- | :--- |
| 1 | **Router split** | `routes/articles.js`, `routes/media.js`, `routes/staff.js`, `routes/ads.js`, `routes/analytics.js`... `server.js` sirf bootstrap |
| 2 | **Central middleware** | auth, body limit, rate limit, headers, error handler, request log |
| 3 | **Body reader** | 47 loops → 1 `readBody(req, {maxBytes})` |
| 4 | **Validation layer** | zod/joi ya hand-rolled schema per route; unknown fields reject |
| 5 | **Storage layer** | atomic write (tmp + fsync + rename) + per-file queue |
| 6 | **Structured logs** | JSON logs with request id; OTP/secrets kabhi log na ho |
| 7 | **Error handling** | try/catch wrapper, 500 par generic message, details server par |
| 8 | **Graceful shutdown** | SIGTERM par in-flight requests finish |
| 9 | **Tests** | Node test runner / Vitest — route contract tests + auth tests |
| 10 | **Health endpoint** | `/health` with DB + disk status |

**Verify:** koi file > 600 lines nahi; 20+ tests pass; route contract test 108 routes cover kare; graceful restart me data loss zero.

**Effort:** 80-120 hours. **Risk:** High (behaviour change) — strangler pattern follow karo: ek route group at a time, tests ke saath.

---

## 11. 12-week execution plan

| Week | Focus | Result |
| :--- | :--- | :--- |
| 1 | Content purge + broken assets + SEO basics + header cleanup | Polish 3→7, SEO 4→7, Visual 7→8 |
| 2 | Security Phase 1 (auth core, developer tier, write routes) | Security 2→4 |
| 3 | Security Phase 2 (XSS, headers, backups, IP trust) | Security 4→6 |
| 4 | Security Phase 3-4 + secrets rotation + cleanup | Security 6→7.5 |
| 5 | SEO finish + accessibility pass + typography (fonts) | SEO 9, A11y 8, Typography 8.5 |
| 6 | Frontend: code splitting + error boundaries + states | Frontend 5.5→7 |
| 7 | Frontend: big file split + tests | Frontend 7→8 |
| 8 | Backend: middleware + body reader + validation | Backend 5→6.5 |
| 9 | Backend: router split (articles, media, staff) | Backend 6.5→7.5 |
| 10 | Backend: remaining routes + tests + logs | Backend 8 |
| 11 | Visual polish + dark mode + 360px + screenshot matrix | Visual 8.5 |
| 12 | Regression, VAPT retest, docs, monitoring, final scorecard | Sab 8+ |

**Parallel possible:** Weeks 6-10 me ek banda frontend, ek backend.

---

## 12. Do cheezein jo order bigaad sakti hain

1. **Refactor before tests** — 6,684-line file todne se pehle route contract tests likho, warna pata nahi chalega kya toota.
2. **Security last me karna** — security pehle karo, kyunki woh live risk hai. Baaki sab baad me.

---

## 13. Verification protocol (score kaise prove karein)

Har phase ke baad yeh chalao aur result report me likho:

| Check | Command / Tool | Pass criteria |
| :--- | :--- | :--- |
| SEO | Lighthouse | 100 |
| A11y | Lighthouse + axe | 100 / 0 violations |
| Bundle | `vite build` output | initial < 180 KB gzip |
| Fonts | `document.fonts.size`, Network | ≤ 6 requests |
| Broken assets | console + `img.naturalWidth` | 0 |
| Frontend tests | `npm test` | 100% pass |
| Backend tests | `npm test` | 100% pass |
| Security | PoC retest suite | 0 fail |
| Responsive | 360/768/1024/1440 screenshots | no overflow, no empty column |
| Dark mode | same 4 widths | no contrast issue |
| Backend files | `wc -l` | max 600 |
| Frontend files | `wc -l` | max 400 |

---

## 14. Bottom line

- **8+ possible hai** — 315-525 hours ka kaam hai, 8-12 weeks solo.
- **Sabse sasta jump:** SEO (10-20 hrs) aur Polish (20-30 hrs) — 2 dimensions ek hafte me 8+.
- **Sabse mehnga:** Backend (80-120 hrs) aur Security (80-150 hrs).
- **Sabse risky:** backend refactor — tests pehle.
- **Design already 7-8 par hai** — usme sirf polish baaki hai, rebuild nahi.

**Agar budget/time kam hai:** pehle Week 1 + Security Phase 1 karo. Usse site turant professional dikhegi aur live risk band hoga. Baaki refactor baad me.

---

## 15. Sources / basis

- Live measurements: Lighthouse (A11y 90, BP 100, SEO 83), resource timing, DOM meta inspection
- Code metrics: 47,780 LOC, `server.js` 6,684 lines, 108 routes, 47 body loops, 19 `writeFileSync`
- Security: `security-reports/SECURITY_TEST_REPORT.md` (35 open, 9 live-proven)
- Integration: `problems/BACKEND_INTEGRATION_REPORT.md`
- UI/UX: `problems/UIUX_AI_LOOK_AUDIT.md`
- Market rates: `problems/PROJECT_LEVEL_AND_MARKET_VALUE.md`
- Standards: OWASP ASVS/WSTG, NIST SP 800-63B-4, WCAG 2.1 AA, Core Web Vitals
