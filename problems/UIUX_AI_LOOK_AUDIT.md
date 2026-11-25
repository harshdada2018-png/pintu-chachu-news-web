# UI/UX Audit — "AI Jaisa Lag Raha Hai Ya Nahi"

**Project:** PublicSpark Newsroom
**Date:** 20 Nov 2026
**Method:** Live app (`http://127.0.0.1:5000`) par visual inspection — 800px (tablet, native), 375px (mobile, iframe), 1440px (desktop, iframe), plus article page.
**Code change:** ZERO. Sirf inspection.

---

## 0. Verdict (seedha jawab)

**Design ki taraf se "AI slop" nahi hai. Layout aur typography genuinely editorial broadsheet lagte hain.**

**Par content aur placeholders ki wajah se app "demo/test" jaisa lagta hai** — `Hello` headline, `Audit Test Sponsor` ad, toota hua banner, khaali AdSense box, "Video unavailable". Yeh AI-look se zyada "unfinished product" ka signal hai.

| Category | Status |
| :--- | :--- |
| Visual design language (colors, type, spacing) | PASS |
| Anti-AI-slop checklist | PASS |
| Content readiness | FAIL |
| Broken elements | FAIL (5 jagah) |
| Header/navigation clarity | MEDIUM issue (duplicate controls) |
| Admin panel | Not checked (login + 2FA chahiye) |

---

## 1. Design system — jo achha hai (evidence ke saath)

Yeh cheezein deliberately design ki gayi hain, AI default nahi:

| Cheez | Evidence |
| :--- | :--- |
| Newsprint palette (warm canvas, obsidian ink) | `src/index.css:14-40` |
| Serif headlines (Playfair Display) + sans body (Plus Jakarta Sans) | `src/index.css:4-5` |
| Small radii — `2px`, `4px`, `6px`, `8px` | `src/index.css:48-54` (comment: "Replacing Bulky SaaS Bubble Curves") |
| `--shadow-glow: none` | `src/index.css:59` |
| Koi emoji nahi (poore `src/` me zero) | scan confirmed |
| Gradient soup nahi — sirf 3 real gradients (1 social button, 1 admin header, 1 subtle hero) | scan confirmed |
| Float/bob animation nahi | sirf functional floating audio widget |
| Glassmorphism nahi — sirf 4 chhote `blur(3-4px)` overlays | scan confirmed |
| Light + dark dono themes properly tokenized | `src/index.css:66-102` |

**Yeh checklist pass hai.** Yani jo "AI-generated website" ki pehchaan hoti hai (purple gradient hero, glass cards, floating blobs, emoji bullets, 24px rounded everything) — woh is project me nahi hai.

---

## 2. Problems — jo "AI/test" jaisa feel dete hain

### U-01 — Sponsored ad banner toota hua hai (har page par)
**Severity:** High (har page par visible)

Screenshot me har jagah broken image icon dikh raha hai.

**Root cause:**
```
server/data/settings.json:107  "sponsorBannerUrl": "/uploads/test_banner.webp"
server/data/settings.json:109  "sponsorName": "Audit Test Sponsor Updated"
```
`/uploads/test_banner.webp` file exist nahi karti — `server/data/uploads/` me sirf ek `.mp3` hai. Isliye browser 404 deta hai.

**Asar:** Site "under construction" lagti hai; ad revenue section broken.

---

### U-02 — Test/audit data live hai
**Severity:** High (credibility)

Public site par yeh dikh raha hai:

| Kahan | Kya |
| :--- | :--- |
| Sponsored unit | "Advertisment by **Audit Test Sponsor Updated**" |
| Sidebar story | Headline literally **"Hello"** (published) |
| Article page | "FACT-CHECK: VERIFIED (Press Information Bureau (PIB) / ISRO Media Desk)" |

"Hello" ek published article hai — API response me `status: "published"`. Yeh demo/testing ka content hai jo live feed me hai.

**Asar:** Koi bhi visitor dekhe to turant pata chal jata hai ki site test data par chal rahi hai. Trust zero.

---

### U-03 — Spelling mistake: "Advertisment"
**Severity:** Low (par har page par)

Sahi spelling **"Advertisement"** hai. Yeh label har sponsored unit par render hota hai.

---

### U-04 — Khaali AdSense placeholder box public ko dikh raha hai
**Severity:** High (looks unfinished)

Homepage par ek bada 300×600 grey box hai jisme likha hai:

```
SIDEBAR 300×600
Google AdSense Unit Active • Ready for Live Deployment
```

Yeh **developer placeholder** hai, lekin live visitors ko dikh raha hai. AdSense abhi live nahi hai, to box khaali chhodne ke bajaye hide karna chahiye.

**Asar:** Sabse zyada "unfinished/AI template" wala signal yahi hai.

---

### U-05 — Article page par "Video unavailable"
**Severity:** High (core content page)

Article ke andar YouTube embed hai jo kehta hai:

```
YouTube — Video unavailable
This video is unavailable
```

Yeh placeholder video ID ki wajah se hai. Har article me embed hai to har article par yeh error dikhega.

**Asar:** Reading experience tootti hai; user ko lagta hai page kharab hai.

---

### U-06 — Header me duplicate controls
**Severity:** Medium (UX confusion)

Tablet/desktop par do header rows hain aur dono me same controls repeat ho rahe hain:

| Control | Row 1 (utility bar) | Row 2 (main header) |
| :--- | :--- | :--- |
| Language | `हिंदी (Hindi)` dropdown | `हिंदी` pill |
| Theme | `डार्क` button | moon icon |
| Search | — | search icon (nav me alag bhi) |

**Asar:** User confuse hota hai kaunsa control asli hai; vertical space waste hota hai (4 bars: utility + masthead + ticker + nav).

**Fix:** Ek hi jagah rakho — mobile par utility bar hide, desktop par row 2 ka duplicate hatao.

---

### U-07 — Brand inconsistency: "allNews"
**Severity:** Medium

Tablet/mobile header me hamburger ke saath **"allNews"** likha hai, jabki brand "PUBLIC SPARK" hai. Yeh generic label brand identity todta hai aur template jaisa lagta hai.

---

### U-08 — Images sab Unsplash se hotlinked hain
**Severity:** Medium (content + dependency)

Article images:
```
https://images.unsplash.com/photo-1589829545856-...   (Lady Justice statue)
https://images.unsplash.com/photo-1504711434969-...   (newspapers stack)
https://images.unsplash.com/photo-1517976487492-...   (rocket launch)
https://images.unsplash.com/photo-1466611653911-...   (wind turbines)
```

**Do problems:**
1. Yeh **generic stock photos** hain — isliye content "AI-generated news" jaisa lagta hai, chahe design editorial ho.
2. Images third-party (Unsplash) par depend karti hain — woh URL badle ya rate-limit kare to site toot jayegi. Original reporting ke liye yeh acceptable nahi.

---

### U-09 — Tablet width (800px) par bade khaali gaps
**Severity:** Medium (layout)

800px par 2-column grid banta hai, par kai rows me right column poori khaali rehti hai:

- Editorial section: 1 card left, right side blank
- Video section: 1 card left (~420px), right side ~450px blank
- Sidebar ad ke neeche bada blank area

**Asar:** Page adhoora aur unbalanced lagta hai.

**Fix:** Tablet range me single-column karo, ya `auto-fit/minmax` use karo taaki card available width le.

---

### U-10 — Floating audio widget sticky header ke peeche cut ho raha hai
**Severity:** Low

Article page par top-left me ek white pill (audio/progress widget) ka hissa header ke neeche chhup jata hai. Z-index/offset issue.

---

### U-11 — Footer ke grievance links dead feature par jaate hain
**Severity:** Medium (ties to P-01)

Footer me:
- "Contact & Grievance Redressal"
- "File a Grievance (IT Rules 2021)"

Dono grievance modal kholte hain, aur us modal ka backend hi nahi hai (P-01). User submit karega → error.

---

### U-12 — Footer ke upar bada khaali gap
**Severity:** Low

Page ke end me ~250px blank space hai footer se pehle. Layout padding issue lagta hai.

---

## 3. Section-by-section verdict

| Section | Design | Content | Note |
| :--- | :--- | :--- | :--- |
| Top utility bar | PASS | PASS | Par row 2 se duplicate |
| Masthead (logo) | PASS | PASS | Center aligned, clean |
| Breaking ticker | PASS | PASS | Red bar, marquee, pause button |
| Main nav | PASS | PASS | Active state clear |
| Sponsored unit | FAIL | FAIL | Broken image + test data + typo |
| Lead story card | PASS | FAIL | Stock image, "Hello" headline |
| Sidebar stories | PASS | FAIL | Ek story "Hello" |
| Video section | PASS | FAIL | Empty right column |
| Sidebar ad | FAIL | FAIL | Khaali placeholder box |
| Footer | PASS | MEDIUM | Dead grievance links, big gap |
| Article page | PASS | FAIL | Broken YouTube embed |
| Dark mode | Not visually checked | — | Tokens maujood hain |

---

## 4. Priority fix list

| # | Kaam | Effort | Impact |
| :--- | :--- | :--- | :--- |
| 1 | Broken sponsor banner fix ya ad unit hide (U-01) | 15 min | High |
| 2 | "Audit Test Sponsor" + "Hello" article cleanup (U-02) | 20 min | High |
| 3 | AdSense placeholder box hide jab tak live na ho (U-04) | 20 min | High |
| 4 | Broken YouTube embeds remove/validate (U-05) | 1-2 ghante | High |
| 5 | Duplicate language/theme controls hatao (U-06) | 1 ghanta | Medium |
| 6 | Tablet layout single-column / auto-fit (U-09) | 1-2 ghante | Medium |
| 7 | "Advertisment" → "Advertisement" (U-03) | 2 min | Low |
| 8 | "allNews" branding fix (U-07) | 30 min | Medium |
| 9 | Image strategy: apni images ya local copies (U-08) | 2-4 ghante | Medium |
| 10 | Grievance backend (U-11) | P-01 ke saath | High |
| 11 | Floating widget z-index + footer gap (U-10, U-12) | 30 min | Low |

---

## 5. Jo check NAHI hua (honest)

1. **Admin panel** — login + 2FA chahiye, isliye Staff/Admin UI visually inspect nahi hui.
2. **Dark mode** — tokens verified hain, par visually screenshots nahi liye.
3. **360px mobile** — 375px dekha; 360px par ek extra 15px ka farq hai, ideally alag check.
4. **Real device touch targets** — sirf layout dekha, tap target size measure nahi kiya.
5. **Accessibility (screen reader, contrast)** — Lighthouse audit alag se chalana hoga.
6. **RTL / Urdu layout** — multi-language support hai, par RTL visually verify nahi kiya.

---

## 6. Summary

- **"AI jaisa design" nahi hai** — design system deliberate aur editorial hai. Yeh achhi khabar hai.
- **"AI/test jaisa content" hai** — `Hello`, `Audit Test Sponsor`, toota banner, khaali ad box, broken video. Yeh 5 cheezein hi poori site ka impression kharab kar rahi hain.
- Inme se 4 sirf **data cleanup** hain (15-20 min each), design change nahi.
- Layout ke 2 asli bugs hain: tablet par khaali columns (U-09) aur duplicate header controls (U-06).

---

**Status:** Inspection complete. Koi file modify nahi hui. Temporary helper server (port 4174) band kar diya gaya.
