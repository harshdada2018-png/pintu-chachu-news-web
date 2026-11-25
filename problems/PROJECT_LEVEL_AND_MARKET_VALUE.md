# Project Level & Market Value Assessment

**Project:** PublicSpark Newsroom
**Date:** 20 Nov 2026
**Method:** Live inspection (Lighthouse, network timing, DOM/meta analysis) + code metrics + published 2026 market pricing guides
**Code change:** ZERO

> Saare prices **published market ranges** hain (sources neeche), quote nahi. Actual quote scope par depend karta hai.

---

## 0. Seedha jawab

**Design "cheap" nahi lag raha — yeh mid-level custom editorial design hai, template nahi.**
**Par production readiness cheap level ki hai** — placeholder content, toote ad/video, SEO basics missing.

| Dimension | Level | Score |
| :--- | :--- | :--- |
| Visual design | Mid-level custom (template se upar, premium agency se neeche) | **7 / 10** |
| Typography & design system | Strong, deliberate | **8 / 10** |
| Frontend engineering | Kaam karta hai, par bundle bhaari aur structure monolith | **5.5 / 10** |
| Backend engineering | Feature-rich, par 6,684-line single file | **5 / 10** |
| SEO fundamentals | Basic cheezein missing | **4 / 10** |
| Accessibility | Lighthouse 90, decent | **7 / 10** |
| Security | 35 open findings, 9 live-proven | **2 / 10** |
| Content / production polish | Test data live hai | **3 / 10** |

**Overall: ek ambitious custom build jo 70% premium lagta hai aur 30% jagah demo/test jaisa.**

---

## 1. Objective data (maine measure kiya, andaaza nahi)

### Lighthouse (live site)

| Category | Score |
| :--- | :--- |
| Accessibility | **90 / 100** |
| Best Practices | **100 / 100** |
| SEO | **83 / 100** |

### Page weight & runtime

| Metric | Value |
| :--- | :--- |
| JS bundle | **1,080 KB** (single chunk, no code splitting) |
| CSS | 63 KB |
| Total transfer (homepage) | ~1,140 KB |
| Requests | 23-27 |
| Font faces loaded | **947** (Google Fonts, ~30 families) |
| DOMContentLoaded (localhost) | 144 ms |
| Load (localhost) | 151 ms |

> Localhost timing real network ko represent nahi karta. Asli users ke liye 1.08 MB JS + 947 fonts mobile par 3-6 second le sakta hai.

### SEO / meta (live DOM se)

| Check | Result |
| :--- | :--- |
| `<h1>` count on homepage | **0** |
| Meta description | **missing** |
| Canonical URL | **missing** |
| Open Graph tags | **missing** |
| `<html lang>` | `en` — par content Hindi hai |
| JSON-LD on homepage | 0 (article pages par hai) |
| Images with alt | 11/11 (achha) |

### Code size

| Part | Files | Lines |
| :--- | :--- | :--- |
| Frontend (`src/`) | 51 | **37,084** |
| Backend (`server/`) | 10 | **10,696** |
| **Total** | 61 | **47,780** |
| Largest file | `server/server.js` | 6,684 |

### Security (pehle ke audit se)

| Metric | Value |
| :--- | :--- |
| Total findings | 44 |
| Open | 35 |
| Live-proven attacks | 9 |
| Critical open | 7 |

---

## 2. Design level — kyun "cheap nahi" hai

Yeh cheezein template se nahi aati:

1. **Custom design system** — `src/index.css` me tokens: palette, typography scale, radii, shadows, transitions. 3,867 lines hand-written CSS.
2. **Editorial typography** — Playfair Display headlines + Plus Jakarta Sans body. Yeh deliberate broadsheet choice hai, default Inter/Roboto nahi.
3. **Anti-AI-slop discipline** — zero emoji, `shadow-glow: none`, radii 2-8px, comment literally likha hai "Replacing Bulky SaaS Bubble Curves".
4. **Dual theme** — light + dark, dono properly tokenized, image glare shield bhi.
5. **Section architecture** — masthead, breaking ticker, category nav, lead + bento grid, video rail, fact-check badges, footer desks.
6. **28 components** — public reader, search, saved stories, TTS player, admin desks, editor/reporter workspaces.
7. **Hindi-first typography** — Devanagari + Nastaliq fonts load hote hain, multi-language support.

**Conclusion:** yeh ₹9,999 wala WordPress theme nahi hai. Kisi ne design par soch-samajh kar mehnat ki hai.

---

## 3. Design level — kyun "premium" nahi hai

Premium agency ka bar yahan fail hota hai:

| Gap | Evidence |
| :--- | :--- |
| Homepage par H1 hi nahi | `h1count: 0` |
| Meta description / OG / canonical missing | live DOM check |
| `lang="en"` jabki content Hindi | live DOM check |
| 947 font faces load ho rahe hain | performance measurement |
| 1.08 MB single JS chunk | build output (`>500 kB` warning) |
| Duplicate language + theme controls | 2 header rows |
| Tablet (800px) par khaali right columns | screenshots |
| Placeholder content live | "Hello" headline, "Audit Test Sponsor" |
| Broken sponsor banner (404) | `settings.json:107` |
| Broken YouTube embed | article page |
| Khaali AdSense box public ko dikh raha | homepage sidebar |
| Unsplash hotlinked images | article API data |

Yeh sab **production polish** ke gaps hain, design language ke nahi.

---

## 4. Market comparison — India 2026 published rates

### News website / portal

| Type | Published range | Source |
| :--- | :--- | :--- |
| Basic news website | ₹25,000 – ₹60,000 | Winggosoft (Oct 2026) |
| Professional news website | ₹60,000 – ₹1,50,000 | Winggosoft |
| **Custom news portal** | **₹1,50,000 – ₹4,00,000+** | Winggosoft |
| **Advanced news platform** | **₹4,00,000 – ₹10,00,000+** | Winggosoft |
| Enterprise news platform | ₹10,00,000+ | Winggosoft |
| News portal (freelancer start) | ₹20,000 se | BtechWaleTech (Sep 2026) |
| Custom newsroom features | ₹60,000 se | BtechWaleTech |
| WordPress portal packages | ₹6,000 – ₹25,000 | 7k Network / NewsPortalDevelopment |

### Custom web app / SaaS

| Type | Range | Source |
| :--- | :--- | :--- |
| Custom web application | ₹3,00,000 – ₹25,00,000+ | ANAY (Nov 2026) |
| Custom web app (developer) | ₹2,00,000 – ₹20,00,000+ | SitesPlaced (Jun 2026) |
| Custom web app / SaaS MVP (freelancer) | ₹1,50,000 – ₹6,00,000 | Innovatrix (May 2026) |
| Custom web app / SaaS MVP (boutique agency) | ₹3,00,000 – ₹12,00,000 | Innovatrix |
| Custom web app / SaaS MVP (mid-market agency) | ₹8,00,000 – ₹25,00,000 | Innovatrix |

### Design only (UI/UX)

| Scope | Range | Source |
| :--- | :--- | :--- |
| Website UI/UX (5-15 pages) | ₹15,000 – ₹60,000 | Kode Studio |
| Full website design (5-7 pages) | ₹80,000 – ₹2,50,000+ | Gleam Studio |
| Web app / dashboard design | ₹50,000 – ₹2,50,000+ | Kode Studio |
| Design system | ₹1,00,000 – ₹7,00,000 | Gleam / DevXAI |
| UX audit | ₹15,000 – ₹75,000 | Kode Studio / DevXAI |

### Security (VAPT)

| Scope | Range | Source |
| :--- | :--- | :--- |
| Web app VAPT (typical SaaS) | ₹40,000 – ₹1,50,000 | TCSA (Jun 2026) |
| Web app VAPT (5-8 roles) | ₹1,20,000 – ₹3,50,000 | CyberSigma |
| Professional band (manual) | ₹1,00,000 – ₹3,00,000 | Cybersecify |
| Basic scan + manual | ₹4,999 – ₹14,999 | Secuvexa |

### Hourly rates

| Who | Rate |
| :--- | :--- |
| Tier-2 freelancer | ₹300 – ₹1,200/hr |
| Metro senior freelancer | ₹1,500 – ₹4,000/hr |
| Boutique agency | ₹1,500 – ₹3,500/hr |
| Mid-market agency | ₹2,500 – ₹5,500/hr |
| Design (senior) | ₹500 – ₹2,500/hr |

---

## 5. Is project ki market value (estimate)

### A. Aaj yeh feature-set market se banwao (as-is scope)

Scope: public news site + multi-role CMS + 2FA/OTP + live blog + polls + analytics + ads + media library + AI TTS/translation + backup/restore + 47,780 LOC.

| Route | Estimate | Note |
| :--- | :--- | :--- |
| Senior freelancer (3-5 mahine) | **₹3,00,000 – ₹6,00,000** | High variance, delivery risk |
| Boutique agency (3-4 mahine) | **₹6,00,000 – ₹12,00,000** | PM + QA + design + dev |
| Mid-market agency | **₹10,00,000 – ₹20,00,000** | Overkill for this scope |
| WordPress portal (equivalent features) | ₹50,000 – ₹1,50,000 | Par custom admin/AI/2FA nahi milega |
| Cheapest template route | ₹25,000 – ₹60,000 | Feature parity nahi |

**Realistic custom replacement cost: ₹6L – ₹12L (agency), ₹3L – ₹6L (senior freelancer).**

### B. Design-only value

| Item | Estimate |
| :--- | :--- |
| Design system + 20+ templates + admin UI | **₹1,50,000 – ₹4,00,000** |
| Sirf public site UI (8-12 pages) | ₹80,000 – ₹2,50,000 |

### C. Isko market-standard banane ka cost (fixes)

| Kaam | Hours | Rate (₹1,200-2,500/hr) | Cost |
| :--- | :--- | :--- | :--- |
| Security fixes (35 findings) | 80-150 | — | **₹1,00,000 – ₹3,75,000** |
| UI/UX polish + content cleanup | 40-60 | — | ₹50,000 – ₹1,50,000 |
| SEO fixes (H1, meta, OG, canonical, lang, sitemap) | 10-20 | — | ₹15,000 – ₹50,000 |
| Performance (code splitting, fonts, images) | 20-30 | — | ₹25,000 – ₹75,000 |
| Testing + regression + documentation | 20-30 | — | ₹25,000 – ₹75,000 |
| **Total** | **170-290 hrs** | — | **₹2,15,000 – ₹7,25,000** |

Plus agar third-party VAPT karwana ho: **₹50,000 – ₹1,50,000** extra.

### D. Recurring cost (monthly/yearly)

| Item | Cost |
| :--- | :--- |
| VPS/cloud hosting (small news site) | ₹1,000 – ₹5,000/month |
| Domain | ₹800 – ₹1,200/year |
| SSL | ₹0 (Let's Encrypt) |
| Maintenance retainer (freelancer) | ₹8,000 – ₹25,000/month |
| Maintenance retainer (agency) | ₹25,000 – ₹75,000/month |
| SEO retainer | ₹10,000 – ₹20,000/month |
| Annual VAPT | ₹50,000 – ₹1,50,000/year |
| Backup storage + monitoring | ₹500 – ₹2,000/month |

**Yearly run cost: ₹1.5L – ₹6L** (maintenance + SEO + security + hosting, depends on vendor).

---

## 6. Final scorecard

| Dimension | Level | Market equivalent |
| :--- | :--- | :--- |
| Design language | **B+** | ₹1.5L-4L custom design |
| Frontend build | **B-** | Functional, performance gaps |
| Backend build | **B-** | Feature-rich monolith |
| Security | **F** | Enterprise standard se bahut neeche |
| SEO | **C-** | Basics missing |
| Content readiness | **D** | Placeholder data live |
| **Overall** | **B-** | ₹6L-12L agency build, par ₹2L-7L ki finishing baaki |

### Ek line me

**Yeh "cheap template" nahi hai — yeh ek ₹6-12 lakh ki custom build hai jo 70% taiyaar hai. Baaki 30% (security, SEO, polish, content) par ₹2-7 lakh ka kaam baaki hai. Design ki taraf se paisa waste nahi hua; engineering discipline aur finishing baaki hai.**

---

## 7. Honest limitations

1. Prices **published guides** se hain, kisi vendor ka quote nahi. Actual quote 30-50% upar/neeche ho sakta hai.
2. Effort hours **mera estimate** hain (code size aur finding count se), timesheet nahi.
3. Lighthouse **performance score** nahi mila (tool benchmark nahi chalata). Load time localhost ka hai, real network ka nahi.
4. Admin panel visually inspect nahi hua (login + 2FA chahiye).
5. Third-party costs (Gemini API, Gmail, Supabase, Cloudflare) isme shamil nahi.
6. "Market value" = **build cost**, resale value nahi. Resale market news portals ke liye alag hota hai.

---

## 8. Sources

- Winggosoft — News Website Development Cost in India 2026 (Oct 2026)
- Innovatrix Infotech — Freelancer vs Agency Web Development India 2026 (May 2026, updated Nov 2026)
- BtechWaleTech — News Portal Developer pricing (Sep 2026)
- ANAY — Website Development Cost in India 2026 (Nov 2026)
- SitesPlaced — Custom Website Cost 2026 (Jun 2026)
- Kode Studio — UI/UX Design Cost in India 2026 (Oct 2026)
- Gleam Studio — Design Services Cost India 2026
- DevXAI — UI/UX pricing 2026 (May 2026)
- TCSA — VAPT Cost India 2026 (Jun 2026)
- Cybersecify — Pentest Cost India 2026 (May 2026, updated Nov 2026)
- Secuvexa — Website Security Audit Cost India 2026 (Oct 2026)
- 7k Network, NewsPortalDevelopment, Black Hole Studio — portal packages
- Live measurements: Lighthouse, `performance.getEntriesByType('resource')`, DOM meta inspection
