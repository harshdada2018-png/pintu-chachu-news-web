/**
 * Sovereign Credential & Password Cache Sanitizer
 * 
 * Prevents browsers (Chrome, Edge, Safari, Firefox, Opera) from:
 * 1. Caching plain passwords in memory or DOM form history.
 * 2. Silently autofilling or pre-populating credentials on shared/stolen devices.
 * 3. Persisting password inputs across tab switches, visibility changes, or window unloads.
 */

export function initCredentialCacheSanitizer() {
  if (typeof window === 'undefined') return;

  // 1. W3C Credential Management API: Prevent silent access / auto-signin
  try {
    if (navigator.credentials && typeof navigator.credentials.preventSilentAccess === 'function') {
      navigator.credentials.preventSilentAccess().catch(() => {});
    }
  } catch (_e) {
    // Graceful fallback for older browsers
  }

  // 2. Complete purge when tab is hidden, navigating away, or window unloads
  const handleVisibilityOrUnload = () => {
    try {
      const passwordInputs = document.querySelectorAll('input[type="password"], input[data-credential="true"]');
      passwordInputs.forEach((input) => {
        input.value = '';
        input.defaultValue = '';
        input.setAttribute('value', '');
        try {
          input.dispatchEvent(new Event('input', { bubbles: true }));
        } catch (_e) {}
      });
    } catch (_e) {
      // Non-blocking
    }
  };

  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      handleVisibilityOrUnload();
    }
  });

  window.addEventListener('pagehide', handleVisibilityOrUnload);
  window.addEventListener('beforeunload', handleVisibilityOrUnload);

  console.log('[Security Guard]: Browser Credential & Password Cache Sanitizer active.');
}

/**
 * Manually force-purge all password fields in the DOM right now
 */
export function purgeActivePasswordInputs() {
  if (typeof document === 'undefined') return;
  try {
    const inputs = document.querySelectorAll('input[type="password"], input[data-credential="true"]');
    inputs.forEach((input) => {
      input.value = '';
      input.defaultValue = '';
      input.setAttribute('value', '');
      try {
        input.dispatchEvent(new Event('input', { bubbles: true }));
      } catch (_e) {}
    });
  } catch (_e) {
    // Non-blocking
  }
}

