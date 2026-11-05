# PublicSpark — Updates & Feature List (Ads section + poori site)

Ye list "kya-kya banana hai" ki hai. Fixes ki alag file `FIXES.md` hai.
Priority: **P0** = pehle (foundation) · **P1** = launch ke aas-paas · **P2** = launch ke baad · **Later** = bade/long-term.
Security ka kaam abhi roka hua hai: jahan "(security phase)" likha hai wo us time uthana hai.

---

# PART A — ADS SECTION (Admin)

## A1. One-click buttons (jo tumne maanga)
- [ ] **"Poori site pe lagao" (Make Global)** — ad card pe ek button, ek click mein ad ka scope global ho jata hai. (P1)
- [ ] **"Sirf is article mein"** — wapas article-only kar do. (P1)
- [ ] **"Is category mein"** — jaise sirf Sports ya Business. (P1)
- [ ] Button dabane se pehle confirm + "ye ad ~N pages pe dikhega" + **Undo**. (P1)
- Dabane par sirf `scope` badalta hai, ad dobara copy nahi hota.

## A2. Ad ke scope aur rules
- [ ] Scope: article / category / global. (P1)
- [ ] **Exclude list:** "in articles mein mat dikhao". (P1)
- [ ] Start date aur end date; date khatam hote hi slot apne aap AdSense pe wapas. (P1)
- [ ] Status: active / paused / expired. (P1)
- [ ] Priority: ek slot pe kai ad ho to kaun pehle. (P2)

## A3. Per-article ad control
- [ ] Har article pe, har slot ke liye: **Inherit (default) / Custom ad / Off**. (P1)
- [ ] Article pe **"No ads"** master switch. (P1)
- [ ] **Sensitive tag** (haadse, crime): global sponsor ads wahan apne aap exclude. (P1)
- [ ] Kuch set na ho to global ad dikhe, wo bhi na ho to AdSense. (P1)

Slot mein kaun jeetega (upar se neeche): No-ads switch → article ka apna ad / off → category ad → global ad → AdSense.

## A4. Slot manager
- [ ] Slots: header, article ke andar (N-th paragraph ke baad), sidebar, footer, home list ke beech, mobile sticky bottom. (P1)
- [ ] Har slot: AdSense / Direct sponsor / Off. (P1)
- [ ] Desktop aur mobile ke liye alag setting. (P2)
- [ ] Ad slot ki height pehle se fix (page kude nahi), lazy-load. (P1)
- [ ] Headline ke upar ad nahi. (P1)

## A5. Sponsor / campaign manager
- [ ] Campaign banao: sponsor ka naam, **image + link** (HTML/script nahi), "Sponsored" label, dates, slots. (P1)
- [ ] Campaign list (search + filters: active / expired / scope). (P1)
- [ ] Preview: article pe ad kaisa dikhega, live kiye bina. (P2)
- [ ] Sponsor ko bhejne ke liye report: impressions, clicks, CTR, PDF/CSV export. (P2)

## A6. AdSense settings
- [ ] Publisher ID (strict format `ca-pub-` + 16 digits). (P1)
- [ ] `ads.txt` auto-sync (file mein `pub-XXXX` format, `ca-` nahi) + extra lines edit karne ka option. (P1)
- [ ] Auto-Ads toggle (default OFF jab tak approval na ho; manual slots behtar). (P1)
- [ ] Error / login / khali pages pe ads band. (P1)
- [ ] Consent banner (EEA/UK readers ke liye). (P2)
- [ ] Publisher ID sirf super-admin badle + dubara password/2FA + audit log + email alert. (security phase)

## A7. Admin ki article list
- [ ] Search: title, slug, article ID. (P1)
- [ ] Filters: category, language, status, reporter, date, **ads status** (Inherit / Custom / Off). (P1)
- [ ] Bulk select: kai articles pe ek saath "ads off" ya campaign lagao. (P2)
- [ ] Pagination (20-20), search me debounce, server-side search. (P1)

## A8. Ads reports
- [ ] Article-wise, slot-wise, campaign-wise impressions aur clicks. (P2)
- [ ] AdSense kamayi ka estimate (manual entry ya AdSense report se). (P2)
- [ ] Kaun sa slot/page best perform karta hai. (P2)

---

# PART B — POORI SITE

## B1. Foundation (pehle ye, warna baaki sab demo hai)  — P0
- [ ] Real database (Supabase) wire karo, mock data hatao.
- [ ] Fake analytics / fake storage numbers hatao.
- [ ] Unofficial translation/TTS endpoints hatao.
- [ ] Real login + roles (reporter / editor / admin), header dropdown hatao. (security phase)
- [ ] Backend ka cloud deploy; audio/images ke liye object storage + CDN URL.
- [ ] Translation sirf server pe; cache key `(articleId, lang, contentHash)`.
- [ ] Translation/TTS ke liye **free, bina card wale** providers; ek article+language ke liye sirf ek call, lazy (jab user maange tabhi), phir cache.
- [ ] Counters batch mein save (har view pe DB write nahi).
- [ ] Backup export + keep-alive.

## B2. SEO aur speed (traffic ka sabse bada lever)  — P1
- [ ] SSR/prerender (article page ka poora HTML Google ko mile).
- [ ] Har article ka title, description, Open Graph, NewsArticle structured data.
- [ ] News sitemap, `hreflang` har language ke liye, robots.txt.
- [ ] Google News Publisher Center me site add.
- [ ] Core Web Vitals: tez load, image WebP, lazy-load.
- [ ] Translated pages ke liye noindex/limited-ads policy (AdSense/Google risk).

## B3. Content workflow (reporter se publish tak)
- [ ] Reporter article likhe → draft → editor approve → publish. (P0)
- [ ] Naya article by default **draft**. (P0)
- [ ] Likhte hi auto-generated **"In 30 seconds" highlights** aur structure (writer ko extra kaam nahi). (P1)
- [ ] Scheduled publish, breaking-news flag, pinned/top story. (P1)
- [ ] Corrections log (kya galat tha, kab sudhara). (P2)
- [ ] Draft autosave, edit history. (P2)

## B4. Reader features
- [ ] Language switcher (20 languages), URL mein language (`/hi/...`). (P0)
- [ ] **Listen** (audio): pehle headline, thodi der ruko, phir "In 30 seconds", phir poora article. Sirf headline/highlights/body padho (caption, credits, buttons, tags, error text nahi). (P1)
- [ ] Listen player: speed, pause/resume, language badalne par purani audio band. (P1)
- [ ] Public search (Pagefind/Orama, server cost zero). (P1)
- [ ] Bookmarks, reading history, text size, dark mode. (P2)
- [ ] WhatsApp/Telegram share button, copy link. (P1)
- [ ] PWA: install, offline padho, low-data mode. (P2)
- [ ] Web push notification (breaking news). (P2)

## B5. Distribution (traffic laane ke raaste)
- [ ] WhatsApp Channel, Telegram channel/bot. (P2)
- [ ] Roz ka audio bulletin + podcast RSS feed. (P2)
- [ ] RSS feeds (category-wise). (P2)
- [ ] Newsletter (email). (Later)
- [ ] YouTube Shorts ke liye clips. (Later)

## B6. Hyperlocal (asli moat)
- [ ] Zila / tehsil level categories. (P2)
- [ ] Local reporters ka network, citizen reporter submissions with moderation. (Later)

## B7. Trust aur policy pages (AdSense approval ke liye bhi zaroori)
- [ ] About, Contact, Privacy Policy, Terms, Editorial/Corrections policy, Disclaimer. (P0)
- [ ] Har article pe author, date, sources. (P1)
- [ ] "Confirmed / unconfirmed" label jahan zaroori ho. (P2)
- [ ] Copyright policy: sirf apna content ya headline+link; doosron ka poora article nahi. (P0)

## B8. Analytics dashboard
- [ ] Real numbers: per-article views, read time, country-wise, trending (din/hafta/mahina). (P1)
- [ ] Country sirf header se; na mile to "unknown". (P0)
- [ ] Raw IP store nahi. (P0)
- [ ] Top articles, top languages, traffic source. (P2)

## B9. Admin panel (full power)
- [ ] Users aur roles manage. (P1)
- [ ] Article approve/publish/unpublish/delete. (P1)
- [ ] Languages on/off. (P1)
- [ ] Cache purge, storage/quota monitor (real numbers). (P1)
- [ ] Audit log (kisne kya badla), 2FA. (security phase)
- [ ] Settings: site name, logo, social links. (P2)

## B10. Migration (purani publicspark.in se)
- [ ] Naya site same domain pe, purana tab tak band mat karo jab tak naya ready na ho. (P1)
- [ ] Purane URLs ke 301 redirects (Google ka indexed traffic bachane ke liye). (P1)
- [ ] AdSense account/PAN/bank **agency ke naam** par. (P0)
- [ ] AdSense dobara apply karne se pehle: pichle reject hone ka reason fix. (P1)

## B11. Security phase (jab shuru karo)
- [ ] Auth + RLS, har endpoint pe role check, CORS sirf apne domain.
- [ ] `/api/tts` article ID se text khud nikaale, rate limit.
- [ ] Sponsor banner me image+link hi, HTML/script nahi; sab input sanitize.
- [ ] `/api/storage/purge` aur analytics endpoints admin-only.
- [ ] Secrets sirf `.env`, kabhi code/chat me nahi.
- [ ] DPDP ke hisaab se privacy (raw IP nahi, consent).

## B12. Product banane ka plan (long-term)  — Later
- [ ] Multi-tenant: ek software, kai news agencies, har ek ka apna theme/logo/domain/admin.
- [ ] White-label setup fee + monthly fee model.
- [ ] Code ka ownership/resell haq likhit me apne paas.

---

## Kaam ka sahi order
1. **B1 Foundation** (+ B7 policy pages, B10 AdSense account agency ke naam).
2. **B2 SEO/speed** + **B3 content workflow** + **B4 Listen/search**.
3. **A1-A7 Ads section** (security phase ke saath).
4. **B8 analytics**, **B9 admin**.
5. **B5 distribution**, **B6 hyperlocal**, phir **B12 product**.
