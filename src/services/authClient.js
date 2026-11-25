/**
 * Staff Auth Client Service
 * Handles Newsroom Staff authentication:
 * - Email + Password Login
 * - Self-Service Journalist Application (Register)
 * - 5-Minute OTP Verification & Password Reset
 * - Session Management with 30-Minute Inactivity Auto-Logout
 * - Instant token destruction on window/tab close (sessionStorage)
 */

const SESSION_TOKEN_KEY = 'ps_newsroom_session_token_v1';
const SESSION_ROLE_KEY = 'ps_newsroom_session_role_v1';
const SESSION_NAME_KEY = 'ps_newsroom_session_name_v1';
const SESSION_EMAIL_KEY = 'ps_newsroom_session_email_v1';
const LAST_ACTIVITY_KEY = 'ps_newsroom_last_activity_v1';

// 30 Minutes Inactivity Timeout in milliseconds
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

let watchdogTimerId = null;
let onTimeoutCallback = null;

export function getSessionToken() {
  try {
    return sessionStorage.getItem(SESSION_TOKEN_KEY);
  } catch (_e) {
    return null;
  }
}

export function getAuthHeaders() {
  const token = getSessionToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getSessionRole() {
  try {
    return sessionStorage.getItem(SESSION_ROLE_KEY) || 'visitor';
  } catch (_e) {
    return 'visitor';
  }
}

export function getSessionStaffName() {
  try {
    return sessionStorage.getItem(SESSION_NAME_KEY) || '';
  } catch (_e) {
    return '';
  }
}

export function getSessionStaffEmail() {
  try {
    return sessionStorage.getItem(SESSION_EMAIL_KEY) || '';
  } catch (_e) {
    return '';
  }
}

export function setStaffSession(token, role, name, email) {
  try {
    sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    sessionStorage.setItem(SESSION_ROLE_KEY, role);
    sessionStorage.setItem(SESSION_NAME_KEY, name || '');
    sessionStorage.setItem(SESSION_EMAIL_KEY, email || '');
    sessionStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  } catch (_e) {
    // SessionStorage catch
  }
}

export async function clearStaffSession() {
  const token = getSessionToken();
  if (token) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (_e) {
      // Offline fallback: continue local session destruction
    }
  }
  try {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    sessionStorage.removeItem(SESSION_ROLE_KEY);
    sessionStorage.removeItem(SESSION_NAME_KEY);
    sessionStorage.removeItem(SESSION_EMAIL_KEY);
    sessionStorage.removeItem(LAST_ACTIVITY_KEY);
  } catch (_e) {
    // SessionStorage catch
  }
}

export function recordUserActivity() {
  try {
    if (sessionStorage.getItem(SESSION_TOKEN_KEY)) {
      sessionStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    }
  } catch (_e) {
    // SessionStorage catch
  }
}

/**
 * Initialize 30-minute inactivity watchdog listeners
 */
export function initInactivityWatchdog(onLogout) {
  onTimeoutCallback = onLogout;

  const activityEvents = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
  const handleUserActivity = () => {
    recordUserActivity();
  };

  activityEvents.forEach(evt => {
    window.addEventListener(evt, handleUserActivity, { passive: true });
  });

  if (watchdogTimerId) clearInterval(watchdogTimerId);
  watchdogTimerId = setInterval(() => {
    const token = getSessionToken();
    if (!token) return;

    let lastActive = Date.now();
    try {
      const stored = sessionStorage.getItem(LAST_ACTIVITY_KEY);
      if (stored) lastActive = parseInt(stored, 10);
    } catch (_e) {
      lastActive = Date.now();
    }

    const elapsed = Date.now() - lastActive;
    if (elapsed >= INACTIVITY_TIMEOUT_MS) {
      console.warn('[Staff Auth Watchdog] 30 minutes of inactivity detected. Auto-logging out.');
      clearStaffSession();
      if (typeof onTimeoutCallback === 'function') {
        onTimeoutCallback('inactivity');
      }
    }
  }, 30000);

  return () => {
    activityEvents.forEach(evt => {
      window.removeEventListener(evt, handleUserActivity);
    });
    if (watchdogTimerId) clearInterval(watchdogTimerId);
  };
}

/**
 * API: Login Staff with Email + Password
 */
export async function loginStaff(email, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();
  if (res.ok && data.success) {
    if (data.requires2FA) {
      return {
        success: true,
        requires2FA: true,
        tempToken: data.tempToken,
        email: data.email,
        name: data.name,
        role: data.role,
        message: data.message
      };
    }
    setStaffSession(data.token, data.role, data.name, data.email);
    return { success: true, role: data.role, name: data.name, email: data.email, token: data.token };
  }

  return {
    success: false,
    error: data.error || 'Authentication failed.',
    remainingAttempts: data.remainingAttempts,
    locked: data.locked,
    remainingSeconds: data.remainingSeconds,
    status: data.status
  };
}

/**
 * API: Step 1 - Send 5-Minute OTP for Journalist Application (Email Ownership Verification)
 */
export async function sendRegistrationOtp({ name, email, password, phone, role }) {
  const res = await fetch('/api/auth/register/send-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, phone, role })
  });
  return await res.json();
}

/**
 * API: Step 2 - Verify Gmail OTP & Submit Application for Super Admin Approval
 */
export async function verifyAndSubmitRegistration({ name, email, password, phone, role, otpCode }) {
  const res = await fetch('/api/auth/register/verify-and-submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, phone, role, otpCode })
  });
  return await res.json();
}

/**
 * API: Register New Journalist (Application - Legacy/Direct wrapper with OTP)
 */
export async function registerStaff({ name, email, password, phone, role, otpCode }) {
  const res = await fetch('/api/auth/register/verify-and-submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, phone, role, otpCode })
  });
  return await res.json();
}

/**
 * API: Request 5-Minute OTP for Forgot Password
 */
export async function sendResetOtp(email) {
  const res = await fetch('/api/auth/forgot-password/send-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  return await res.json();
}

/**
 * API: Verify 5-Minute OTP
 */
export async function verifyResetOtp(email, otp) {
  const res = await fetch('/api/auth/forgot-password/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp })
  });
  return await res.json();
}

/**
 * API: Reset Password with Verified Reset Token
 */
export async function resetPasswordWithToken(email, newPassword, resetToken) {
  const res = await fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, newPassword, resetToken })
  });
  return await res.json();
}

/**
 * API: Step 2 - Verify 6-Digit TOTP or Emergency Recovery Code during Login
 */
export async function verify2faLogin({ tempToken, code, isRecoveryCode = false }) {
  const res = await fetch('/api/auth/2fa/verify-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tempToken, code, isRecoveryCode })
  });

  const data = await res.json();
  if (res.ok && data.success) {
    setStaffSession(data.token, data.role, data.name, data.email);
    return {
      success: true,
      role: data.role,
      name: data.name,
      email: data.email,
      token: data.token,
      usedRecoveryCode: data.usedRecoveryCode,
      remainingRecoveryCodes: data.remainingRecoveryCodes
    };
  }

  return {
    success: false,
    error: data.error || '2FA verification failed.',
    expired: data.expired || false
  };
}

/**
 * API: Get 2FA Status for Logged-In Admin
 */
export async function fetch2faStatus() {
  const token = getSessionToken();
  const res = await fetch('/api/auth/2fa/status', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return await res.json();
}

/**
 * API: Initiate 2FA Enrollment (Get Secret, QR SVG & 10 Recovery Codes)
 */
export async function setup2faInitiate() {
  const token = getSessionToken();
  const res = await fetch('/api/auth/2fa/setup', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return await res.json();
}

/**
 * API: Confirm 2FA Pairing with First 6-Digit TOTP Code
 */
export async function confirm2faSetup(code) {
  const token = getSessionToken();
  const res = await fetch('/api/auth/2fa/confirm-setup', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ code })
  });
  return await res.json();
}
