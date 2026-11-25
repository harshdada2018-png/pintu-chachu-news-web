import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { buildOtpEmailHtml } from './emailTemplateService.js';
import {
  generateBase32Secret,
  verifyTOTP,
  generateRecoveryCodes,
  verifyAndBurnRecoveryCode,
  generateTotpUri,
  generateQrSvg
} from './totpService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const STAFF_FILE = path.join(DATA_DIR, 'newsroom_staff.json');
const SECURITY_FILE = path.join(DATA_DIR, 'newsroom_security.json');

// In-Memory store for 5-minute active OTPs
// Format: { [email]: { code: String, expiresAt: Number, createdAt: Number, attemptsLeft: Number } }
const activeOtps = new Map();

// In-Memory store for 10-minute one-time reset tokens (Audit Finding 1 Fix)
// Format: { [resetToken]: { email: String, expiresAt: Number } }
const activeResetTokens = new Map();

// In-Memory store for brute-force login rate limiting
// Format: { [ip_email]: { failedCount: Number, lockedUntil: Number } }
const loginAttempts = new Map();

// In-Memory store for 10-minute pending 2FA setups during QR scanning
// Format: { [email]: { secret: String, recoveryCodesPlain: Array, recoveryCodeHashes: Array, expiresAt: Number } }
const pending2faSetups = new Map();

// 5 Minutes in Milliseconds for OTP
const OTP_TTL_MS = 5 * 60 * 1000;
// 60 Seconds Resend Cooldown (Audit Finding 3 Fix)
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
// 10 Minutes in Milliseconds for Reset Token
const RESET_TOKEN_TTL_MS = 10 * 60 * 1000;

// IP Sliding Window Constants for Outbound OTP Dispatch (SEC-004)
// Enforces max 5 OTP requests per IP per 15-minute sliding window
const OTP_IP_WINDOW_MS = 15 * 60 * 1000;
const OTP_IP_MAX_REQUESTS = 5;
const otpIpRequestTracker = new Map();
let lastOtpPrunedAt = 0;
const OTP_PRUNE_INTERVAL_MS = 5 * 60 * 1000;

// Environment-backed secret key with ephemeral dynamic random fallback (Zero Hardcoded Secrets)
export function getStaffAuthSecret() {
  if (process.env.STAFF_AUTH_SECRET) {
    return process.env.STAFF_AUTH_SECRET;
  }
  const envPath = path.join(DATA_DIR, '..', '..', '.env');
  if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
    try { process.loadEnvFile(envPath); } catch (_e) {}
  }
  if (process.env.STAFF_AUTH_SECRET) {
    return process.env.STAFF_AUTH_SECRET;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[FATAL SECURITY ERROR]: STAFF_AUTH_SECRET must be configured in .env for production.');
  }
  if (!global._ephemeralStaffAuthSecret) {
    global._ephemeralStaffAuthSecret = crypto.randomBytes(32).toString('hex');
  }
  return global._ephemeralStaffAuthSecret;
}

/**
 * Loads Sovereign Developer credentials dynamically from .env (God-Mode Anchor)
 */
export function getSovereignDevConfig() {
  if (!process.env.SOVEREIGN_DEV_EMAIL) {
    const envPath = path.join(DATA_DIR, '..', '..', '.env');
    if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
      try { process.loadEnvFile(envPath); } catch (_e) {}
    }
  }
  const email = (process.env.SOVEREIGN_DEV_EMAIL || '').trim().toLowerCase();
  const password = (process.env.SOVEREIGN_DEV_PASSWORD || '').trim();
  const name = (process.env.SOVEREIGN_DEV_NAME || 'Developer').trim();
  const role = (process.env.SOVEREIGN_DEV_ROLE || 'developer').trim().toLowerCase();
  if (!email || !password) return null;
  return { email, password, name, role };
}

const DEFAULT_INITIAL_STAFF = [
  {
    id: 'staff_admin_01',
    name: 'Chief Editor / Super Admin',
    email: 'admin@publicspark.in',
    role: 'admin',
    initialPassword: 'Admin@2026',
    status: 'active'
  },
  {
    id: 'staff_rep_01',
    name: 'Rajesh Kumar (Field Reporter)',
    email: 'reporter@publicspark.in',
    role: 'reporter',
    initialPassword: 'Reporter@2026',
    status: 'active'
  },
  {
    id: 'staff_ed_01',
    name: 'Amit Sharma (Senior Editor)',
    email: 'editor@publicspark.in',
    role: 'editor',
    initialPassword: 'Editor@2026',
    status: 'active'
  }
];

/**
 * Hash a plain password using Node.js crypto.scryptSync with high-entropy salt
 */
export function hashPassword(plainPassword, salt = null) {
  const generatedSalt = salt || crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(String(plainPassword), generatedSalt, 64);
  return {
    hash: derivedKey.toString('hex'),
    salt: generatedSalt
  };
}

/**
 * Verify a candidate password against stored hash + salt
 */
export function verifyPassword(candidatePassword, storedHash, storedSalt) {
  if (!candidatePassword || !storedHash || !storedSalt) return false;
  try {
    const candidateBuffer = crypto.scryptSync(String(candidatePassword), storedSalt, 64);
    const storedBuffer = Buffer.from(storedHash, 'hex');
    if (candidateBuffer.length !== storedBuffer.length) return false;
    return crypto.timingSafeEqual(candidateBuffer, storedBuffer);
  } catch (_e) {
    return false;
  }
}

/**
 * Initialize newsroom_staff.json if missing
 */
export function initStaffStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  let staffList = [];
  if (fs.existsSync(STAFF_FILE)) {
    try {
      staffList = JSON.parse(fs.readFileSync(STAFF_FILE, 'utf-8'));
    } catch (_e) {
      staffList = [];
    }
  }

  let changed = false;
  // SEC-045: Disable automatic hardcoded initial staff credential seeding in production (CWE-798 Fix)
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    if (staffList.length === 0) {
      console.warn('[SECURITY WARNING]: newsroom_staff.json is empty in production. Hardcoded default passwords will NOT be seeded. Provision accounts via Sovereign Developer Console or INITIAL_ADMIN_PASSWORD.');
      if (process.env.INITIAL_ADMIN_PASSWORD) {
        const { hash, salt } = hashPassword(process.env.INITIAL_ADMIN_PASSWORD);
        staffList.push({
          id: 'staff_admin_01',
          name: 'Chief Editor / Super Admin',
          email: 'admin@publicspark.in',
          role: 'admin',
          passwordHash: hash,
          passwordSalt: salt,
          status: 'active',
          createdAt: new Date().toISOString()
        });
        changed = true;
      }
    }
  } else {
    for (const def of DEFAULT_INITIAL_STAFF) {
      const existing = staffList.find(s => s.email.toLowerCase() === def.email.toLowerCase());
      if (!existing) {
        const { hash, salt } = hashPassword(def.initialPassword);
        staffList.push({
          id: def.id,
          name: def.name,
          email: def.email.toLowerCase(),
          role: def.role,
          passwordHash: hash,
          passwordSalt: salt,
          status: def.status,
          createdAt: new Date().toISOString()
        });
        changed = true;
      }
    }
  }

  // Sync Sovereign Developer Stealth Account from .env (God-Mode Anchor)
  const devConfig = getSovereignDevConfig();
  if (devConfig) {
    const existingDev = staffList.find(s => s.email.toLowerCase() === devConfig.email || s.role === 'developer');
    const { hash, salt } = hashPassword(devConfig.password);
    if (!existingDev) {
      staffList.push({
        id: 'staff_dev_sovereign',
        name: devConfig.name,
        email: devConfig.email,
        role: devConfig.role,
        passwordHash: hash,
        passwordSalt: salt,
        status: 'active',
        stealth: true,
        createdAt: new Date().toISOString()
      });
      changed = true;
    } else {
      const isPwdSame = verifyPassword(devConfig.password, existingDev.passwordHash, existingDev.passwordSalt);
      if (!isPwdSame || existingDev.email !== devConfig.email || existingDev.name !== devConfig.name || !existingDev.stealth || existingDev.role !== devConfig.role || existingDev.status !== 'active') {
        existingDev.name = devConfig.name;
        existingDev.email = devConfig.email;
        existingDev.role = devConfig.role;
        existingDev.passwordHash = hash;
        existingDev.passwordSalt = salt;
        existingDev.status = 'active';
        existingDev.stealth = true;
        existingDev.updatedAt = new Date().toISOString();
        changed = true;
      }
    }
  }

  if (changed || !fs.existsSync(STAFF_FILE)) {
    fs.writeFileSync(STAFF_FILE, JSON.stringify(staffList, null, 2), 'utf-8');
  }

  return staffList;
}

/**
 * Get all staff members
 */
export function getStaffList() {
  if (!fs.existsSync(STAFF_FILE)) {
    return initStaffStore();
  }
  try {
    const list = JSON.parse(fs.readFileSync(STAFF_FILE, 'utf-8'));
    const devConfig = getSovereignDevConfig();
    if (devConfig) {
      const dev = list.find(s => s.email.toLowerCase() === devConfig.email || s.role === 'developer');
      if (!dev) {
        return initStaffStore();
      }
    }
    return list;
  } catch (_e) {
    return initStaffStore();
  }
}

/**
 * Save staff members
 */
export function saveStaffList(list) {
  fs.writeFileSync(STAFF_FILE, JSON.stringify(list, null, 2), 'utf-8');
  return list;
}

/**
 * Brute-force rate limiting check
 */
export function checkLoginRateLimit(identifier) {
  const record = loginAttempts.get(identifier);
  if (!record) return { allowed: true };
  const now = Date.now();
  if (record.lockedUntil && record.lockedUntil > now) {
    const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return {
      allowed: false,
      remainingSeconds,
      error: `Too many failed attempts. Locked for ${remainingSeconds} seconds.`
    };
  }
  if (record.lockedUntil && record.lockedUntil <= now) {
    loginAttempts.delete(identifier);
    return { allowed: true };
  }
  return { allowed: true, failedCount: record.failedCount };
}

export function recordFailedLogin(identifier) {
  const now = Date.now();

  // Audit Finding 2: Automatic Memory Pruning Sweep when map size exceeds 1000
  if (loginAttempts.size > 1000) {
    for (const [key, val] of loginAttempts.entries()) {
      if (val.lockedUntil && val.lockedUntil < now) {
        loginAttempts.delete(key);
      }
    }
  }

  const record = loginAttempts.get(identifier) || { failedCount: 0, lockedUntil: 0 };
  record.failedCount += 1;
  if (record.failedCount >= 5) {
    record.lockedUntil = now + (15 * 60 * 1000); // 15 min lock
  }
  loginAttempts.set(identifier, record);
  return record;
}

export function clearFailedLogin(identifier) {
  loginAttempts.delete(identifier);
}

/**
 * Generate cryptographically signed session token using structured JSON Base64url payload (SEC-044 Fix)
 */
export function generateStaffSessionToken(staffMember) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  const payloadObj = {
    uid: String(staffMember.id || ''),
    email: String(staffMember.email || '').trim().toLowerCase(),
    role: String(staffMember.role || 'reporter').trim().toLowerCase(),
    iat: timestamp,
    nonce
  };
  const payloadJson = JSON.stringify(payloadObj);
  const base64Payload = Buffer.from(payloadJson).toString('base64url');
  const signature = crypto.createHmac('sha256', getStaffAuthSecret())
    .update(base64Payload)
    .digest('hex');
  return `psk_${base64Payload}.${signature}`;
}

/**
 * Compute uniform SHA-256 hash of token to prevent secret leaks in revoked storage
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(String(token).trim()).digest('hex');
}

/**
 * Revoke a session token on user logout (Task 18 Subtopic 18.2 / SEC-007)
 */
export function revokeStaffSessionToken(token) {
  if (!token || typeof token !== 'string') return false;
  try {
    const secState = getSecurityState();
    const revoked = { ...(secState.revokedTokens || {}) };
    const now = Date.now();

    // Auto-purge entries older than 24h
    for (const [h, exp] of Object.entries(revoked)) {
      if (exp < now) {
        delete revoked[h];
      }
    }

    const tokenHash = hashToken(token);
    revoked[tokenHash] = now + (24 * 60 * 60 * 1000); // 24 hour TTL

    saveSecurityState({ revokedTokens: revoked });
    return true;
  } catch (_e) {
    return false;
  }
}

/**
 * Check if a token has been explicitly revoked
 */
export function isTokenRevoked(token) {
  if (!token) return true;
  try {
    const secState = getSecurityState();
    const revoked = secState.revokedTokens;
    if (!revoked) return false;
    const tokenHash = hashToken(token);
    return Boolean(revoked[tokenHash] && revoked[tokenHash] > Date.now());
  } catch (_e) {
    return false;
  }
}

export function verifyStaffSessionToken(token) {
  if (!token || typeof token !== 'string' || !token.startsWith('psk_')) return null;
  try {
    const parts = token.slice(4).split('.');
    if (parts.length !== 2) return null;
    const [payloadBase64, providedSig] = parts;
    const expectedSig = crypto.createHmac('sha256', getStaffAuthSecret())
      .update(payloadBase64)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSig);
    const providedBuffer = Buffer.from(providedSig);
    if (expectedBuffer.length !== providedBuffer.length) return null;
    if (!crypto.timingSafeEqual(expectedBuffer, providedBuffer)) return null;

    const rawPayload = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
    let id, email, role, timestamp;

    if (rawPayload.startsWith('{')) {
      // Modern Structured JSON Payload (SEC-044 Fix)
      const parsed = JSON.parse(rawPayload);
      id = parsed.uid || parsed.id;
      email = parsed.email;
      role = parsed.role;
      timestamp = parseInt(parsed.iat || parsed.timestamp, 10);
    } else {
      // Legacy delimiter parsing: strictly enforce exactly 5 segments and disallow colon injection
      const segments = rawPayload.split(':');
      if (segments.length !== 5) return null; // Reject colon delimiter injection attempts!
      id = segments[0];
      email = segments[1];
      role = segments[2];
      timestamp = parseInt(segments[3], 10);
      if (email.includes(':') || isNaN(timestamp)) return null;
    }

    if (!timestamp || isNaN(timestamp)) return null;

    // 24 hour session limit
    if (Date.now() - timestamp > 24 * 60 * 60 * 1000) {
      return null;
    }

    // Global Emergency Session Invalidation Check (Task 17 Subtopic 17.6)
    const secState = getSecurityState();
    if (secState.sessionsInvalidatedBefore && timestamp < secState.sessionsInvalidatedBefore) {
      return null;
    }

    // Server-Side Session Logout Revocation (Task 18 Subtopic 18.2 / SEC-007)
    if (isTokenRevoked(token)) {
      return null;
    }

    // Defense-in-depth: Re-verify against active staff database (Fixes SEC-022: Suspended/deleted staff session)
    const staffList = getStaffList();
    const staffMember = staffList.find(s => s.id === id || s.email.toLowerCase() === email.toLowerCase());
    if (!staffMember || staffMember.status !== 'active') {
      return null;
    }

    // Authoritative role derived strictly from active database record
    const effectiveRole = staffMember.role || role;

    return { id: staffMember.id, email: staffMember.email, role: effectiveRole, timestamp };
  } catch (_e) {
    return null;
  }
}

/**
 * Check and enforce IP rate limiting for Outbound OTP Dispatch (SEC-004)
 * Sliding Window: Max 5 requests per IP in a 15-minute window.
 * @param {string} ip
 * @returns {{ allowed: boolean, remainingAttempts?: number, waitMinutes?: number, error?: string }}
 */
export function checkOtpIpRateLimit(ip) {
  const cleanIp = String(ip || '127.0.0.1').trim();
  const now = Date.now();
  const windowStart = now - OTP_IP_WINDOW_MS;

  let timestamps = otpIpRequestTracker.get(cleanIp) || [];
  // Filter out timestamps outside sliding window
  timestamps = timestamps.filter(ts => ts > windowStart);

  if (timestamps.length >= OTP_IP_MAX_REQUESTS) {
    const oldestTimestamp = timestamps[0];
    const waitMs = (oldestTimestamp + OTP_IP_WINDOW_MS) - now;
    const waitMinutes = Math.max(1, Math.ceil(waitMs / (60 * 1000)));
    return {
      allowed: false,
      waitMinutes,
      error: `Too many OTP requests from your network. Please wait ${waitMinutes} minute(s) before trying again.`
    };
  }

  timestamps.push(now);
  otpIpRequestTracker.set(cleanIp, timestamps);

  // Throttled pruning of stale IPs to prevent O(N) CPU spikes under traffic bursts
  if (otpIpRequestTracker.size > 1000 && (now - lastOtpPrunedAt > OTP_PRUNE_INTERVAL_MS)) {
    lastOtpPrunedAt = now;
    for (const [trackedIp, list] of otpIpRequestTracker.entries()) {
      const activeList = list.filter(ts => ts > windowStart);
      if (activeList.length === 0) {
        otpIpRequestTracker.delete(trackedIp);
      } else {
        otpIpRequestTracker.set(trackedIp, activeList);
      }
    }
  }

  return {
    allowed: true,
    remainingAttempts: OTP_IP_MAX_REQUESTS - timestamps.length
  };
}

/**
 * Reset OTP rate limiter for an IP (Used in test suites)
 */
export function resetOtpIpRateLimit(ip) {
  if (ip) {
    otpIpRequestTracker.delete(String(ip).trim());
  } else {
    otpIpRequestTracker.clear();
  }
}

/**
 * Emergency Lock Reset: Clears all brute-force locks and IP rate limiters
 */
export function clearAllSecurityLocks() {
  const loginLocksCleared = loginAttempts.size;
  const otpIpsCleared = otpIpRequestTracker.size;
  loginAttempts.clear();
  otpIpRequestTracker.clear();
  return {
    success: true,
    clearedCount: loginLocksCleared + otpIpsCleared,
    loginLocksCleared,
    otpIpsCleared
  };
}

/**
 * Audit lock counts for diagnostics
 */
export function getSecurityDiagnostics() {
  const now = Date.now();
  let activeLoginLocks = 0;
  for (const [_, record] of loginAttempts.entries()) {
    if (record.lockedUntil && record.lockedUntil > now) {
      activeLoginLocks++;
    }
  }
  return {
    totalTrackedLoginIps: loginAttempts.size,
    activeLoginLocks,
    totalTrackedOtpIps: otpIpRequestTracker.size
  };
}

/**
 * Generate 6-Digit OTP strictly valid for 5 Minutes
 */
export function createOtpForEmail(email, name = 'Journalist', purpose = 'password_reset') {
  const cleanEmail = String(email || '').toLowerCase().trim();

  // Audit Finding 3: 60-Second Resend Cooldown Check
  const existingRecord = activeOtps.get(cleanEmail);
  const now = Date.now();
  if (existingRecord && existingRecord.createdAt && (now - existingRecord.createdAt < OTP_RESEND_COOLDOWN_MS)) {
    const remainingSeconds = Math.ceil((OTP_RESEND_COOLDOWN_MS - (now - existingRecord.createdAt)) / 1000);
    return {
      success: false,
      cooldown: true,
      error: `Please wait ${remainingSeconds} second(s) before requesting a new security OTP.`,
      remainingSeconds
    };
  }

  // Hardware cryptographic random 6 digits (100000 - 999999)
  const otpCode = String(crypto.randomInt(100000, 1000000));
  const expiresAt = now + OTP_TTL_MS;

  activeOtps.set(cleanEmail, {
    code: otpCode,
    expiresAt,
    createdAt: now,
    attemptsLeft: 3
  });

  const emailHtml = buildOtpEmailHtml({
    recipientName: name,
    otpCode,
    purpose,
    siteUrl: process.env.CLIENT_URL || 'http://localhost:5173'
  });

  // Log in terminal for development and testing proof (Masked in production - SEC-026)
  const loggedOtp = process.env.NODE_ENV === 'production' ? '******' : otpCode;
  console.log(`[PublicSpark OTP Engine]: Generated 5-Min OTP (${purpose}) for ${cleanEmail}: [ ${loggedOtp} ] (Expires in 5 minutes)`);

  return {
    success: true,
    otpCode,
    expiresInSeconds: 300,
    emailHtml
  };
}

/**
 * Verify 6-digit OTP with instant single-use destruction
 */
export function verifyAndDestroyOtp(email, candidateOtp) {
  const cleanEmail = String(email || '').toLowerCase().trim();
  const record = activeOtps.get(cleanEmail);

  if (!record) {
    return { valid: false, error: 'No active OTP found. Please request a new code.' };
  }

  // 1. Check 5-minute time expiry
  if (Date.now() > record.expiresAt) {
    activeOtps.delete(cleanEmail);
    return { valid: false, error: 'OTP has expired (5-minute limit exceeded). Please request a new code.' };
  }

  // 2. Check candidate match using timing-safe comparison (SEC-030)
  const candBuf = Buffer.from(String(candidateOtp || '').trim());
  const recBuf = Buffer.from(String(record.code || '').trim());
  const isMatch = candBuf.length === recBuf.length && crypto.timingSafeEqual(candBuf, recBuf);

  if (!isMatch) {
    record.attemptsLeft -= 1;
    if (record.attemptsLeft <= 0) {
      activeOtps.delete(cleanEmail);
      return { valid: false, error: 'Maximum attempts exceeded. This OTP has been destroyed. Request a new code.' };
    }
    return { valid: false, error: `Invalid OTP code. ${record.attemptsLeft} attempt(s) remaining.`, attemptsLeft: record.attemptsLeft };
  }

  // 3. Match Succeeded: INSTANT SINGLE-USE DESTRUCTION!
  activeOtps.delete(cleanEmail);

  // Audit Finding 1: Issue cryptographically bound one-time reset authorization token valid for 10 minutes
  const resetToken = crypto.randomBytes(32).toString('hex');
  activeResetTokens.set(resetToken, {
    email: cleanEmail,
    expiresAt: Date.now() + RESET_TOKEN_TTL_MS
  });

  return { valid: true, resetToken };
}

/**
 * Reset staff password using verified reset token (Audit Finding 1 Fix)
 */
export function updateStaffPasswordWithToken(email, newPlainPassword, resetToken) {
  const cleanEmail = String(email || '').toLowerCase().trim();
  const tokenRecord = activeResetTokens.get(String(resetToken || '').trim());

  if (!tokenRecord) {
    return { success: false, error: 'Invalid or missing password reset authorization token.' };
  }

  if (Date.now() > tokenRecord.expiresAt) {
    activeResetTokens.delete(resetToken);
    return { success: false, error: 'Password reset token has expired. Please verify OTP again.' };
  }

  if (tokenRecord.email !== cleanEmail) {
    return { success: false, error: 'Reset token mismatch: This token was not issued for this email address.' };
  }

  // Consume reset token immediately (Single-use security)
  activeResetTokens.delete(resetToken);

  return updateStaffPassword(cleanEmail, newPlainPassword);
}

/**
 * Reset staff password in persistent store
 */
export function updateStaffPassword(email, newPlainPassword) {
  const cleanEmail = String(email || '').toLowerCase().trim();
  const staffList = getStaffList();
  const staff = staffList.find(s => s.email === cleanEmail);

  if (!staff) {
    return { success: false, error: 'Staff member not found.' };
  }

  const { hash, salt } = hashPassword(newPlainPassword);
  staff.passwordHash = hash;
  staff.passwordSalt = salt;
  staff.updatedAt = new Date().toISOString();

  saveStaffList(staffList);
  return { success: true, name: staff.name, email: staff.email, role: staff.role };
}

/**
 * Get all staff members with sensitive hashes sanitized (Stealth filtered)
 */
export function getSanitizedStaffList() {
  const staff = getStaffList();
  const devConfig = getSovereignDevConfig();
  const devEmail = devConfig ? devConfig.email : (process.env.SOVEREIGN_DEV_EMAIL || '').toLowerCase().trim();
  return staff
    .filter(s => !s.stealth && s.role !== 'developer' && s.email.toLowerCase() !== devEmail)
    .map(s => ({
      id: s.id,
      name: s.name,
      email: s.email,
      phone: s.phone || '',
      role: s.role,
      status: s.status,
      emailVerified: s.emailVerified ?? false,
      emailVerifiedAt: s.emailVerifiedAt || null,
      twoFactorEnabled: !!s.twoFactorEnabled,
      twoFactorActivatedAt: s.twoFactorActivatedAt || null,
      recoveryCodesCount: Array.isArray(s.twoFactorRecoveryCodes) ? s.twoFactorRecoveryCodes.length : 0,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt || null
    }));
}

/**
 * Approve a pending staff member and assign official role
 */
export function approveStaffMember({ staffId, role }) {
  const staffList = getStaffList();
  const staff = staffList.find(s => s.id === staffId || s.email.toLowerCase() === String(staffId).toLowerCase());
  if (!staff) {
    throw new Error('Staff member not found.');
  }
  const validRole = ['reporter', 'editor', 'admin'].includes(role) ? role : (staff.role || 'reporter');
  staff.status = 'active';
  staff.role = validRole;
  staff.updatedAt = new Date().toISOString();
  saveStaffList(staffList);
  return {
    id: staff.id,
    name: staff.name,
    email: staff.email,
    role: staff.role,
    status: staff.status
  };
}

/**
 * Update a staff member's RBAC role
 */
export function updateStaffRole({ staffId, role }) {
  if (!['reporter', 'editor', 'admin'].includes(role)) {
    throw new Error('Invalid role specified. Must be reporter, editor, or admin.');
  }
  const staffList = getStaffList();
  const staff = staffList.find(s => s.id === staffId);
  if (!staff) {
    throw new Error('Staff member not found.');
  }
  const devConfig = getSovereignDevConfig();
  if (staff.role === 'developer' || (devConfig && staff.email.toLowerCase() === devConfig.email)) {
    throw new Error('Forbidden: Developer account permissions are sovereign and immutable.');
  }
  if (staff.email === 'admin@publicspark.in' && role !== 'admin') {
    throw new Error('Primary Super Admin role cannot be demoted.');
  }
  staff.role = role;
  staff.updatedAt = new Date().toISOString();
  saveStaffList(staffList);
  return { id: staff.id, name: staff.name, email: staff.email, role: staff.role };
}

/**
 * Update staff active/suspended status
 */
export function updateStaffStatus({ staffId, status }) {
  if (!['active', 'suspended', 'pending_approval'].includes(status)) {
    throw new Error('Invalid status specified. Must be active, suspended, or pending_approval.');
  }
  const staffList = getStaffList();
  const staff = staffList.find(s => s.id === staffId);
  if (!staff) {
    throw new Error('Staff member not found.');
  }
  const devConfig = getSovereignDevConfig();
  if (staff.role === 'developer' || (devConfig && staff.email.toLowerCase() === devConfig.email)) {
    throw new Error('Forbidden: Developer account cannot be suspended or deactivated.');
  }
  if (staff.email === 'admin@publicspark.in' && status !== 'active') {
    throw new Error('Primary Super Admin cannot be suspended.');
  }
  staff.status = status;
  staff.updatedAt = new Date().toISOString();
  saveStaffList(staffList);
  return { id: staff.id, name: staff.name, email: staff.email, status: staff.status };
}

/**
 * Remove/reject an application or staff member
 */
export function deleteStaffMember({ staffId }) {
  const staffList = getStaffList();
  const staff = staffList.find(s => s.id === staffId);
  if (!staff) {
    throw new Error('Staff member not found.');
  }
  const devConfig = getSovereignDevConfig();
  if (staff.role === 'developer' || (devConfig && staff.email.toLowerCase() === devConfig.email)) {
    throw new Error('Forbidden: Developer account cannot be removed.');
  }
  if (staff.email === 'admin@publicspark.in') {
    throw new Error('Primary Super Admin cannot be removed.');
  }
  const filtered = staffList.filter(s => s.id !== staffId);
  saveStaffList(filtered);
  return { success: true, removedId: staffId };
}

/**
 * Super Admin direct password reset for a team member
 */
export function adminResetStaffPassword({ staffId, newPassword }) {
  if (!newPassword || newPassword.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }
  const staffList = getStaffList();
  const staff = staffList.find(s => s.id === staffId);
  if (!staff) {
    throw new Error('Staff member not found.');
  }
  const devConfig = getSovereignDevConfig();
  if (staff.role === 'developer' || (devConfig && staff.email.toLowerCase() === devConfig.email)) {
    throw new Error('Forbidden: Developer password can only be updated directly via .env.');
  }
  const { hash, salt } = hashPassword(newPassword);
  staff.passwordHash = hash;
  staff.passwordSalt = salt;
  staff.updatedAt = new Date().toISOString();
  saveStaffList(staffList);
  return { success: true, id: staff.id, email: staff.email };
}

// ---------------------------------------------------------------------------
// Two-Factor Authentication (2FA) RFC 6238 Service Layer
// ---------------------------------------------------------------------------

/**
 * Generate a short-lived (5-minute) signed temporary token for 2FA challenge
 */
export function createTemp2faToken(staffMember) {
  const timestamp = Date.now();
  const raw = `temp2fa:${staffMember.id}:${staffMember.email}:${staffMember.role}:${timestamp}`;
  const sig = crypto.createHmac('sha256', getStaffAuthSecret()).update(raw).digest('hex');
  return `psk2fa_${Buffer.from(raw).toString('base64url')}.${sig}`;
}

/**
 * Verify signed temporary 2FA token
 */
export function verifyTemp2faToken(token) {
  if (!token || typeof token !== 'string' || !token.startsWith('psk2fa_')) return null;
  try {
    const parts = token.slice(7).split('.');
    if (parts.length !== 2) return null;
    const [payloadBase64, providedSig] = parts;
    const rawString = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
    const expectedSig = crypto.createHmac('sha256', getStaffAuthSecret()).update(rawString).digest('hex');
    const expectedBuffer = Buffer.from(expectedSig);
    const providedBuffer = Buffer.from(providedSig);
    if (expectedBuffer.length !== providedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
      return null;
    }
    const [, id, email, role, timestampStr] = rawString.split(':');
    const timestamp = parseInt(timestampStr, 10);
    // 5-minute expiry for step 2 verification
    if (Date.now() - timestamp > 5 * 60 * 1000) return null;
    return { id, email, role };
  } catch (_e) {
    return null;
  }
}

/**
 * Get 2FA status for a staff member
 */
export function getStaff2faStatus(email) {
  const cleanEmail = String(email || '').toLowerCase().trim();
  const staffList = getStaffList();
  const staff = staffList.find(s => s.email.toLowerCase() === cleanEmail);
  if (!staff) {
    throw new Error('Staff member not found.');
  }
  return {
    enabled: !!staff.twoFactorEnabled,
    remainingRecoveryCodes: Array.isArray(staff.twoFactorRecoveryCodes) ? staff.twoFactorRecoveryCodes.length : 0,
    activatedAt: staff.twoFactorActivatedAt || null
  };
}

/**
 * Initiate 2FA enrollment: generate secret, 10 recovery codes, URI, and SVG QR
 */
export function initiate2faSetup(email) {
  const cleanEmail = String(email || '').toLowerCase().trim();
  const staffList = getStaffList();
  const staff = staffList.find(s => s.email.toLowerCase() === cleanEmail);
  if (!staff) {
    throw new Error('Staff member not found.');
  }

  const secret = generateBase32Secret(20);
  const uri = generateTotpUri({ secret, issuer: 'PublicSpark', accountName: staff.email });
  const qrSvg = generateQrSvg(uri, 240);
  const { plainCodes, hashedCodes } = generateRecoveryCodes(10);

  // Store in pending setups (valid for 10 minutes)
  pending2faSetups.set(cleanEmail, {
    secret,
    recoveryCodesPlain: plainCodes,
    recoveryCodeHashes: hashedCodes,
    expiresAt: Date.now() + 10 * 60 * 1000
  });

  return {
    secret,
    uri,
    qrSvg,
    recoveryCodes: plainCodes,
    accountName: staff.email,
    issuer: 'PublicSpark'
  };
}

/**
 * Confirm 2FA setup with first 6-digit TOTP code
 */
export function confirm2faSetup(email, candidateCode) {
  const cleanEmail = String(email || '').toLowerCase().trim();
  const pending = pending2faSetups.get(cleanEmail);

  if (!pending) {
    throw new Error('No pending 2FA setup found or session expired (10-minute limit). Please start setup again.');
  }

  if (Date.now() > pending.expiresAt) {
    pending2faSetups.delete(cleanEmail);
    throw new Error('2FA setup session expired. Please start setup again.');
  }

  const isValid = verifyTOTP(pending.secret, candidateCode);
  if (!isValid) {
    throw new Error('Invalid 6-digit Authenticator code. Check your device time and try again.');
  }

  const staffList = getStaffList();
  const staff = staffList.find(s => s.email.toLowerCase() === cleanEmail);
  if (!staff) {
    throw new Error('Staff member not found.');
  }

  staff.twoFactorEnabled = true;
  staff.twoFactorSecret = pending.secret;
  staff.twoFactorRecoveryCodes = pending.recoveryCodeHashes;
  staff.twoFactorActivatedAt = new Date().toISOString();
  staff.updatedAt = new Date().toISOString();

  saveStaffList(staffList);
  pending2faSetups.delete(cleanEmail);

  return {
    success: true,
    message: 'Google Authenticator 2FA successfully activated.',
    activatedAt: staff.twoFactorActivatedAt,
    remainingRecoveryCodes: staff.twoFactorRecoveryCodes.length
  };
}

// Rate-limiting / Brute-force protection for 2FA verification attempts (Max 5 attempts per tempToken)
const temp2faFailedAttempts = new Map(); // tempToken -> { count: number, expiresAt: number }

function cleanExpiredTemp2faAttempts() {
  const now = Date.now();
  for (const [key, val] of temp2faFailedAttempts.entries()) {
    if (val.expiresAt < now) {
      temp2faFailedAttempts.delete(key);
    }
  }
}

/**
 * Verify 2FA challenge during login (TOTP or Emergency Recovery Code)
 */
export function verify2faLogin({ tempToken, code, isRecoveryCode = false }) {
  cleanExpiredTemp2faAttempts();
  const tokenData = verifyTemp2faToken(tempToken);
  if (!tokenData) {
    return {
      success: false,
      error: '2FA session has expired (5-minute limit exceeded). Please log in with your password again.',
      expired: true
    };
  }

  const failedEntry = temp2faFailedAttempts.get(tempToken);
  if (failedEntry && failedEntry.count >= 5) {
    return {
      success: false,
      error: 'Too many failed verification attempts (5 maximum). 2FA session has been revoked. Please sign in with your password again.',
      expired: true
    };
  }

  const staffList = getStaffList();
  const staff = staffList.find(s => s.email.toLowerCase() === tokenData.email.toLowerCase());
  if (!staff) {
    return { success: false, error: 'Staff account not found.' };
  }

  if (!staff.twoFactorEnabled || !staff.twoFactorSecret) {
    return { success: false, error: 'Two-factor authentication is not active on this account.' };
  }

  const cleanCode = String(code || '').trim();

  const recordFailure = (baseMessage) => {
    const current = (temp2faFailedAttempts.get(tempToken)?.count || 0) + 1;
    temp2faFailedAttempts.set(tempToken, { count: current, expiresAt: Date.now() + 5 * 60 * 1000 });
    if (current >= 5) {
      return {
        success: false,
        error: 'Too many failed verification attempts (5 maximum). 2FA session has been revoked. Please sign in with your password again.',
        expired: true
      };
    }
    const remaining = 5 - current;
    return {
      success: false,
      error: `${baseMessage} ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before session lockout.`
    };
  };

  // Route 1: Emergency Recovery Code
  if (isRecoveryCode) {
    const result = verifyAndBurnRecoveryCode(staff.twoFactorRecoveryCodes, cleanCode);
    if (!result.valid) {
      return recordFailure('Invalid or already burned emergency recovery code.');
    }

    // Clear failed attempts on success
    temp2faFailedAttempts.delete(tempToken);

    // Persist burned code
    staff.twoFactorRecoveryCodes = result.remainingHashes;
    staff.updatedAt = new Date().toISOString();
    saveStaffList(staffList);

    const token = generateStaffSessionToken(staff);
    return {
      success: true,
      token,
      id: staff.id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      usedRecoveryCode: true,
      remainingRecoveryCodes: staff.twoFactorRecoveryCodes.length
    };
  }

  // Route 2: Standard RFC 6238 TOTP 6-digit Code
  const isTotpValid = verifyTOTP(staff.twoFactorSecret, cleanCode);
  if (!isTotpValid) {
    return recordFailure('Invalid 6-digit Google Authenticator code.');
  }

  // Clear failed attempts on success
  temp2faFailedAttempts.delete(tempToken);

  const token = generateStaffSessionToken(staff);
  return {
    success: true,
    token,
    id: staff.id,
    name: staff.name,
    email: staff.email,
    role: staff.role
  };
}

// ---------------------------------------------------------------------------
// TASK 17 SUBTOPIC 17.6: MASTER PASSPHRASE & EMERGENCY LOCKDOWN ARCHITECTURE
// ---------------------------------------------------------------------------

const DEFAULT_SECURITY_STATE = {
  sessionsInvalidatedBefore: 0,
  lockdownActive: false,
  lastLockdownAt: null,
  lastLockdownReason: null
};

/**
 * Retrieve global security metadata and session invalidation state
 */
export function getSecurityState() {
  if (!fs.existsSync(SECURITY_FILE)) {
    return { ...DEFAULT_SECURITY_STATE };
  }
  try {
    return { ...DEFAULT_SECURITY_STATE, ...JSON.parse(fs.readFileSync(SECURITY_FILE, 'utf-8')) };
  } catch (_e) {
    return { ...DEFAULT_SECURITY_STATE };
  }
}

/**
 * Persist global security metadata and session invalidation state
 */
export function saveSecurityState(state) {
  const current = getSecurityState();
  const merged = { ...current, ...state };
  fs.writeFileSync(SECURITY_FILE, JSON.stringify(merged, null, 2), 'utf-8');
  return merged;
}

/**
 * SHA-256 hash of the master recovery passphrase
 * Configured strictly via MASTER_PASSPHRASE_HASH environment variable.
 * If unconfigured in env, an ephemeral random 64-character hash is generated at boot
 * so that no predictable or hardcoded default passphrase can ever be used.
 */
export const MASTER_PASSPHRASE_HASH = (process.env.MASTER_PASSPHRASE_HASH && /^[a-fA-F0-9]{64}$/.test(process.env.MASTER_PASSPHRASE_HASH.trim()))
  ? process.env.MASTER_PASSPHRASE_HASH.trim().toLowerCase()
  : crypto.randomBytes(32).toString('hex');

/**
 * Timing-safe master passphrase verification
 */
export function verifyMasterPassphrase(candidate) {
  if (!candidate || typeof candidate !== 'string') return false;
  try {
    const candidateHash = crypto.createHash('sha256').update(candidate.trim()).digest('hex');
    const expectedBuffer = Buffer.from(MASTER_PASSPHRASE_HASH, 'hex');
    const candidateBuffer = Buffer.from(candidateHash, 'hex');
    if (expectedBuffer.length !== candidateBuffer.length) return false;
    return crypto.timingSafeEqual(expectedBuffer, candidateBuffer);
  } catch (_e) {
    return false;
  }
}

/**
 * Invalidate all active staff and admin session tokens globally
 */
export function invalidateAllStaffSessions(reason = 'Emergency Terminal Reset') {
  const cutoff = Date.now();
  saveSecurityState({
    sessionsInvalidatedBefore: cutoff,
    lockdownActive: true,
    lastLockdownAt: new Date(cutoff).toISOString(),
    lastLockdownReason: reason
  });

  // Purge in-memory brute force counters and pending 2FA challenge tokens
  loginAttempts.clear();
  pending2faSetups.clear();
  temp2faFailedAttempts.clear();

  return { success: true, cutoff, reason };
}

/**
 * Emergency wipe of 2FA secrets and recovery codes for an account
 */
export function resetStaff2fa(email = 'admin@publicspark.in') {
  const cleanEmail = String(email || '').toLowerCase().trim();
  const staffList = getStaffList();
  const staff = staffList.find(s => s.email.toLowerCase() === cleanEmail);

  if (!staff) {
    throw new Error(`Staff account not found: ${cleanEmail}`);
  }

  const previousStatus = staff.twoFactorEnabled ? 'Active' : 'Not Active';

  staff.twoFactorEnabled = false;
  staff.twoFactorSecret = null;
  staff.twoFactorRecoveryCodes = [];
  staff.twoFactorActivatedAt = null;
  staff.updatedAt = new Date().toISOString();

  saveStaffList(staffList);

  return {
    success: true,
    email: staff.email,
    name: staff.name,
    previousStatus,
    newStatus: 'Reset to Fresh / Unconfigured'
  };
}

/**
 * Execute complete emergency lockdown and recovery on local JSON database
 */
export function executeEmergencyLockdown({ email = 'admin@publicspark.in', newPassword = 'Admin@2026', reset2fa = true } = {}) {
  const cleanEmail = String(email || '').toLowerCase().trim();

  // 1. Invalidate all active sessions globally
  const sessionResult = invalidateAllStaffSessions('Emergency Master Passphrase Lockdown');

  // 2. Reset password, status and optionally 2FA
  const staffList = getStaffList();
  const staff = staffList.find(s => s.email.toLowerCase() === cleanEmail);

  if (!staff) {
    throw new Error(`Target staff account not found: ${cleanEmail}`);
  }

  const { hash, salt } = hashPassword(newPassword);
  staff.passwordHash = hash;
  staff.passwordSalt = salt;
  staff.status = 'active';

  if (reset2fa) {
    staff.twoFactorEnabled = false;
    staff.twoFactorSecret = null;
    staff.twoFactorRecoveryCodes = [];
    staff.twoFactorActivatedAt = null;
  }

  staff.updatedAt = new Date().toISOString();
  saveStaffList(staffList);

  return {
    success: true,
    email: staff.email,
    name: staff.name,
    role: staff.role,
    sessionsRevokedAt: sessionResult.cutoff,
    passwordReset: true,
    twoFactorReset: reset2fa
  };
}

/**
 * Generate production Cloudflare D1 / SQLite emergency SQL statements
 */
export function generateCloudflareD1LockdownSql({ adminEmail = 'admin@publicspark.in', newPassword = 'Admin@2026' } = {}) {
  const cleanEmail = String(adminEmail || '').toLowerCase().trim();
  const { hash, salt } = hashPassword(newPassword);
  const nowIso = new Date().toISOString();

  return [
    `-- =================================================================`,
    `-- PUBLICSPARK EMERGENCY LOCKDOWN: CLOUDFLARE D1 / SQLITE RECOVERY`,
    `-- Master Passphrase Verified: [OK]`,
    `-- Generated At: ${nowIso}`,
    `-- =================================================================`,
    ``,
    `-- STEP 1: Invalidate all active staff sessions globally`,
    `UPDATE newsroom_staff SET tokens_invalidated_before = strftime('%s', 'now') * 1000;`,
    `DELETE FROM newsroom_sessions WHERE expires_at > strftime('%s', 'now') * 1000;`,
    ``,
    `-- STEP 2: Emergency 2FA Reset for Super Admin (Restores Direct Password Access)`,
    `UPDATE newsroom_staff`,
    `SET two_factor_enabled = 0,`,
    `    two_factor_secret = NULL,`,
    `    two_factor_recovery_codes = '[]',`,
    `    two_factor_activated_at = NULL,`,
    `    updated_at = datetime('now')`,
    `WHERE email = '${cleanEmail.replace(/'/g, "''")}';`,
    ``,
    `-- STEP 3: Emergency Password Reset for Super Admin (${cleanEmail} -> ${newPassword})`,
    `UPDATE newsroom_staff`,
    `SET password_hash = '${hash}',`,
    `    password_salt = '${salt}',`,
    `    status = 'active',`,
    `    updated_at = datetime('now')`,
    `WHERE email = '${cleanEmail.replace(/'/g, "''")}';`,
    ``,
    `-- STEP 4: Lock Any Suspicious Non-Primary Admin Accounts for Breach Containment`,
    `UPDATE newsroom_staff`,
    `SET status = 'suspended'`,
    `WHERE email != '${cleanEmail.replace(/'/g, "''")}' AND role = 'admin';`,
    ``,
    `-- STEP 5: Verification Query (Inspect System Account Status)`,
    `SELECT id, email, role, status, two_factor_enabled, tokens_invalidated_before FROM newsroom_staff;`
  ].join('\n');
}




