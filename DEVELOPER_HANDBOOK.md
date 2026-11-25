# PublicSpark Newsroom: Developer & Security Terminal Handbook

> **Document Version**: v1.0 (Production-Ready)  
> **Release Date**: 16 November 2026  
> **Security Clearance**: Sovereign System Owner (Boss / Harsh Mishra)  
> **Master Emergency Passphrase**: Stored Offline by System Owner (Confidential)  
> **Cryptographic Protection**: SHA-256 (`652c396ac75da2038108462202dbf5c83977b55f0d4526356b64001ef343c57d`)  
> **PDF Version**: [DEVELOPER_HANDBOOK.pdf](file:///d:/my%20projects/pintu%20chachu%20news%20web/DEVELOPER_HANDBOOK.pdf)

---

## Table of Contents
1. [Chapter 1: Daily Development & Server Operations](#chapter-1-daily-development--server-operations)
2. [Chapter 2: Master Passphrase Security Architecture](#chapter-2-master-passphrase-security-architecture)
3. [Chapter 3: Emergency Disaster Recovery CLI (Local Terminal)](#chapter-3-emergency-disaster-recovery-cli-local-terminal)
4. [Chapter 4: Production Cloudflare D1 Serverless Operations](#chapter-4-production-cloudflare-d1-serverless-operations)
5. [Chapter 5: VPS Scale Migration & SSH Terminal Operations](#chapter-5-vps-scale-migration--ssh-terminal-operations)
6. [Chapter 6: 4-Layer Cyber Incident Response Protocol](#chapter-6-4-layer-cyber-incident-response-protocol)
7. [Chapter 7: Developer Terminal Cheat-Sheet](#chapter-7-developer-terminal-cheat-sheet)

---

## Chapter 1: Daily Development & Server Operations

PublicSpark Newsroom ek sovereign full-stack application hai jisme do primary processes chalte hain:
1. **Frontend Client**: React 19 + Vite (Port 5173)
2. **Backend Proxy Server**: Node.js API (Port 5000)

### 1.1 Website Ko Local Computer Par Chalu Karna

Apne computer par website chalane ke liye do terminal tabs ki zaroorat hoti hai:

#### Terminal 1: Backend API Server Start Karna (Port 5000)
```bash
npm run server
```
*Screen par output:*
```
[Server Env] Loaded environment variables from .env
[Analytics Engine] Seeded 25537 raw view events & 75 daily stats.
PublicSpark Newsroom Backend Proxy running at http://localhost:5000
```

#### Terminal 2: Frontend Vite Server Start Karna (Port 5173)
```bash
npm run dev
```
*Screen par output:*
```
VITE v8.3.0 ready in 597 ms

➜  Local:   http://localhost:5173/
➜  Network: http://192.168.x.x:5173/ (Mobile phone live testing ke liye)
```
Ab browser me `http://localhost:5173/` open karke website dekh sakte hain.

### 1.2 Code Quality & Build Verification Commands

#### OxLint Fast Code Quality Linter
```bash
npm run lint
```
57+ files ko scan karke syntax ya variable errors check karta hai. Output `0 errors` aana chahiye.

#### Vite Production Build Compiler
```bash
npm run build
```
Frontend ko minify karke production bundle (`dist/`) banata hai. Clean exit code 0 ka matlab code production deployment ke liye ready hai.

---

## Chapter 2: Master Passphrase Security Architecture

PublicSpark Newsroom me standard email/password aur Google 2FA ke upar ek **Sovereign Master Passphrase** banaya gaya hai. Iska purpose hai: jab sabhi passwords, phones, ya tokens fail ho jayein, tab bhi system owner bina GUI ke direct terminal se control reclaim kar sake.

### 2.1 Passphrase Ka Nirman
```
[YOUR_MASTER_PASSPHRASE]
```
- **Length**: 14 characters
- **Variety**: Lowercase (`m, f, q, v, x`), Uppercase (`K, W`), Digits (`9, 7, 4, 2, 8`), Special Symbols (`#`, `@`)
- **Mathematical Entropy**: 85+ bits. Brute-force se guess karne me ek modern supercomputer ko ~2,400 saal lagenge.

### 2.2 Cryptographic One-Way Hash Storage
Security best practices ke mutabiq, plain passphrase code me store nahi hota. Iska SHA-256 hash derive kiya gaya hai:
```
MASTER_PASSPHRASE_HASH=652c396ac75da2038108462202dbf5c83977b55f0d4526356b64001ef343c57d
```
Ye hash `.env` aur `server/services/staffAuthService.js` me locked hai. Terminal verification `crypto.timingSafeEqual()` buffer comparison se hoti hai taaki timing side-channel attacks na ho sakein.

---

## Chapter 3: Emergency Disaster Recovery CLI (Local Terminal)

> **Important Windows / PowerShell Rule**:
> Passphrase me `#` aur `@` symbols hain. PowerShell me hamesha **double quotes** lagakar chalayein: `"<passphrase>"`.

### Command 1: System & Account Status Check Karna
```bash
npm run lockdown "<passphrase>" status
```
*Poore system ka live audit print karega: Global lockdown status, Super Admin 2FA state, aur sabhi 6 staff accounts ki summary.*

### Command 2: Super Admin Ka 2FA Wipe Karna (Phone Gum Hone Par)
```bash
npm run lockdown "<passphrase>" reset-2fa
```
*Phone kharab hone, Google Authenticator app delete hone, ya codes reject hone par Super Admin ka 2FA wipe karke direct password login restore karega.*

### Command 3: Super Admin Password Restore Karna (Admin@2026)
```bash
npm run lockdown "<passphrase>" reset-password
```
*Super Admin password wapas default `Admin@2026` par reset kar dega aur account ko `active` enforce karega.*

### Command 4: Dunia Ke Sabhi Logins Ko 0ms Me Kill Karna
```bash
npm run lockdown "<passphrase>" revoke-sessions
```
*Server clock par global session invalidation cutoff lagata hai. Kisi bhi attacker ya device par chal raha active session token instantly dead ho jayega.*

### Command 5: Complete Emergency Lockdown (All Actions in One)
```bash
npm run lockdown "<passphrase>" emergency-all
```
*Ek sath 3 kaam karega: Sabhi active sessions kill + password reset + 2FA wipe.*

### Command 6: Interactive Number Menu Chalana
```bash
npm run lockdown "<passphrase>"
```
*Terminal par 1 se 7 tak ka interactive menu aayega. Number type karke Enter dabayein.*

---

## Chapter 4: Production Cloudflare D1 Serverless Operations

Cloudflare serverless platform hai, isliye is par control ke 2 tareeqe hote hain:

### Tareeqa A: Apne Laptop Ke Terminal Se (Wrangler CLI)
Terminal Aapke apne laptop me hi khulega aur Cloudflare ke live cloud database me changes karega:

#### Live D1 Database Par 2FA Reset Query:
```bash
npx wrangler d1 execute publicspark-db --remote --command="UPDATE newsroom_staff SET two_factor_enabled = 0, two_factor_secret = NULL WHERE email = 'admin@publicspark.in';"
```

#### Live D1 Database Par Sabhi Active Logins Kill Karna:
```bash
npx wrangler d1 execute publicspark-db --remote --command="UPDATE newsroom_staff SET tokens_invalidated_before = strftime('%s', 'now') * 1000;"
```

### Tareeqa B: Mobile Phone Ya Chrome Browser Se (Web Console)
Bina terminal ke mobile phone ke Chrome browser se 1 minute me rescue:
1. Chrome me open karein: `https://dash.cloudflare.com`
2. Menu me **Storage & Databases** -> **D1** select karein.
3. Database `publicspark-db` par click karein.
4. **"Console"** tab par click karein.
5. Ye SQL paste karke **"Execute"** button dabayein:
```sql
UPDATE newsroom_staff 
SET two_factor_enabled = 0, 
    two_factor_secret = NULL, 
    two_factor_recovery_codes = '[]',
    tokens_invalidated_before = strftime('%s', 'now') * 1000,
    status = 'active'
WHERE email = 'admin@publicspark.in';
```

---

## Chapter 5: VPS Scale Migration & SSH Terminal Operations

Jab traffic lakhon me pahunch jaye aur Aap backend ko Cloudflare se dedicated VPS (Hostinger, Hetzner, AWS) par transfer karenge:

### 5.1 VPS Par SSH Login
```bash
ssh root@your-vps-ip-address
```

### 5.2 Live VPS Par Emergency Lockdown Chalana
```bash
cd /var/www/publicspark
npm run lockdown "<passphrase>" emergency-all
```

### 5.3 Live VPS Server Process Management (PM2)
| Task | Terminal Command |
| :--- | :--- |
| Server ko 24/7 background me start karna | `pm2 start server/server.js --name "publicspark-api"` |
| Server ka live status dekhna | `pm2 status` |
| Live traffic logs dekhna | `pm2 logs publicspark-api` |
| Server restart karna | `pm2 restart publicspark-api` |

---

## Chapter 6: 4-Layer Cyber Incident Response Protocol

Agar kabhi suspicious activity dikhe ya account takeover ka shaq ho:

### Layer 1: Attacker Ko Bahar Phekna (0 Seconds)
```bash
npm run lockdown "<passphrase>" emergency-all
```
*Attacker ka session instantly expire, site se bahar, aur uska phone unlinked.*

### Layer 2: Cloudflare Under Attack Mode Active Karna
Cloudflare Dashboard me jakar **"Under Attack Mode"** ON karein. Sabhi automated bots, DDoS flooding aur malicious scripts block ho jayenge.

### Layer 3: Clean Data 1-Click Me Restore Karna
Task 19 Auto-Backup Desk ke clean `.zip` backup se database files (`articles.json`, `settings.json`) restore karein.

### Layer 4: Fresh 2FA Pairing & Strong Password
Admin Desk me login karke apna personal phone dobara fresh QR code se scan karein aur naya password set karein.

---

## Chapter 7: Developer Terminal Cheat-Sheet

| Category | Goal / Action | Exact Terminal Command |
| :--- | :--- | :--- |
| **Development** | Backend API Server Start (Port 5000) | `npm run server` |
| **Development** | Frontend Vite Server Start (Port 5173) | `npm run dev` |
| **Quality Check** | Fast Linter Test (0 errors verify) | `npm run lint` |
| **Quality Check** | Production Compilation Build Test | `npm run build` |
| **Security CLI** | Security Status & Accounts Audit | `npm run lockdown "<passphrase>" status` |
| **Security CLI** | Emergency 2FA Wipe / Reset | `npm run lockdown "<passphrase>" reset-2fa` |
| **Security CLI** | Emergency Password Restore (Admin@2026) | `npm run lockdown "<passphrase>" reset-password` |
| **Security CLI** | Kill All Logins Globally (0ms) | `npm run lockdown "<passphrase>" revoke-sessions` |
| **Security CLI** | Complete Emergency Lockdown (All-in-one) | `npm run lockdown "<passphrase>" emergency-all` |
| **Security CLI** | Export Cloudflare D1 SQL Script | `npm run lockdown "<passphrase>" sql-export` |
| **Security CLI** | Interactive Menu (Numbered 1-7) | `npm run lockdown "<passphrase>"` |
| **Live Cloudflare** | Live D1 Database 2FA Reset | `npx wrangler d1 execute publicspark-db --remote --command="..."` |
| **Live VPS** | VPS SSH Login | `ssh root@your-vps-ip` |

---
*PublicSpark Sovereign Media Architecture • Designed and Engineered natively with Zero Paid Dependencies • Verified November 2026*

