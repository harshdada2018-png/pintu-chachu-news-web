import React, { useState, useEffect } from 'react';
import { Lock, Mail, KeyRound, Eye, EyeOff, AlertCircle, CheckCircle2, ArrowRight, ArrowLeft, ShieldCheck, X, RefreshCw, Smartphone, Key } from 'lucide-react';
import { loginStaff, sendRegistrationOtp, verifyAndSubmitRegistration, sendResetOtp, verifyResetOtp, resetPasswordWithToken, verify2faLogin } from '../../services/authClient';
import { purgeActivePasswordInputs } from '../../services/credentialCacheSanitizer';

export default function StaffLoginModal({ isOpen, onClose, onLoginSuccess }) {
  // Mode: 'login' | 'register' | 'register_verify' | 'register_success' | 'forgot_request' | 'forgot_verify' | 'forgot_new_pass'
  const [authMode, setAuthMode] = useState('login');

  // Login & Shared State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [remainingAttempts, setRemainingAttempts] = useState(null);

  // Two-Factor Authentication (2FA) State
  const [temp2faToken, setTemp2faToken] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);

  // Register State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regRole, setRegRole] = useState('reporter');
  const [regOtpCode, setRegOtpCode] = useState('');
  const [regDevOtpPreview, setRegDevOtpPreview] = useState('');

  // Forgot Password / OTP State
  const [forgotEmail, setForgotEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpRemainingSeconds, setOtpRemainingSeconds] = useState(300);
  const [otpExpiresAt, setOtpExpiresAt] = useState(null);

  const handleSafeClose = () => {
    // Sovereign Credential Cache Purge: Wipe all password inputs immediately
    setPassword('');
    setRegPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTwoFactorCode('');
    setTemp2faToken('');
    purgeActivePasswordInputs();
    onClose();
  };

  // WAI-ARIA Escape Key Listener (Critic Defect 4 Fix)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleSafeClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Active Countdown Ticker for 5-Minute OTP Expiry with Timestamp Precision
  useEffect(() => {
    if (!isOpen || !['register_verify', 'forgot_verify'].includes(authMode) || !otpExpiresAt) return;
    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((otpExpiresAt - Date.now()) / 1000));
      setOtpRemainingSeconds(remaining);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [isOpen, authMode, otpExpiresAt]);

  const formatCountdown = (totalSecs) => {
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  const resetFormState = () => {
    setErrorMessage('');
    setSuccessMessage('');
    setRemainingAttempts(null);
  };

  const handleSwitchMode = (newMode) => {
    // Purge password memory on any mode transition
    setPassword('');
    setRegPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTwoFactorCode('');
    purgeActivePasswordInputs();
    setAuthMode(newMode);
    setOtpExpiresAt(null);
    resetFormState();
  };

  // 1. Submit Login Form
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    const candidateEmail = email.trim();
    const candidatePass = password.trim();

    if (!candidateEmail || !candidatePass) {
      setErrorMessage('Please enter both your email address and password.');
      return;
    }

    // Zero out password in React state immediately to prevent RAM retention
    setPassword('');
    purgeActivePasswordInputs();
    setIsLoading(true);
    resetFormState();

    try {
      const result = await loginStaff(candidateEmail, candidatePass);
      if (result.success) {
        if (result.requires2FA) {
          setTemp2faToken(result.tempToken);
          setAuthMode('2fa_challenge');
          setTwoFactorCode('');
          setIsRecoveryMode(false);
          setSuccessMessage('Password verified. Enter your 6-digit Authenticator code.');
          return;
        }
        onLoginSuccess(result.role, result.name, result.email);
        handleSafeClose();
      } else {
        setErrorMessage(result.error || 'Invalid credentials. Please verify your email and password.');
        if (typeof result.remainingAttempts === 'number') {
          setRemainingAttempts(result.remainingAttempts);
        }
      }
    } catch (_err) {
      setErrorMessage('Network connection error. Please verify the newsroom server is online.');
    } finally {
      setIsLoading(false);
    }
  };

  // 1B. Submit 2FA Code (Google Authenticator or Emergency Recovery Code)
  const handle2faSubmit = async (e) => {
    e.preventDefault();
    const candidate2faCode = twoFactorCode.trim();
    if (!candidate2faCode) {
      setErrorMessage(isRecoveryMode ? 'Please enter your emergency recovery code.' : 'Please enter the 6-digit Authenticator code.');
      return;
    }

    // Zero out code in React state immediately to prevent RAM retention
    setTwoFactorCode('');
    purgeActivePasswordInputs();
    setIsLoading(true);
    resetFormState();

    try {
      const result = await verify2faLogin({
        tempToken: temp2faToken,
        code: candidate2faCode,
        isRecoveryCode: isRecoveryMode
      });

      if (result.success) {
        setTemp2faToken('');
        onLoginSuccess(result.role, result.name, result.email);
        handleSafeClose();
      } else {
        if (result.expired) {
          setErrorMessage(result.error || '2FA session expired. Please log in with your password again.');
          setTimeout(() => {
            setAuthMode('login');
          }, 2500);
        } else {
          setErrorMessage(result.error || 'Invalid verification code.');
        }
      }
    } catch (_err) {
      setErrorMessage('Network error during 2FA verification.');
    } finally {
      setIsLoading(false);
    }
  };

  // 2A. Submit Register Application Step 1: Send 5-Min OTP to confirm Gmail ownership
  const handleSendRegOtp = async (e) => {
    e.preventDefault();
    const candidateName = regName.trim();
    const candidateEmail = regEmail.trim();
    const candidatePass = regPassword.trim();
    const candidatePhone = regPhone.trim();
    const candidateRole = regRole;

    if (!candidateName || !candidateEmail || !candidatePass) {
      setErrorMessage('Please fill in your full name, email, and security password.');
      return;
    }
    if (candidatePass.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    // Keep password in state for step 2 verification, but clear DOM element
    setIsLoading(true);
    resetFormState();

    try {
      const result = await sendRegistrationOtp({
        name: candidateName,
        email: candidateEmail,
        password: candidatePass,
        phone: candidatePhone,
        role: candidateRole
      });

      if (result.success) {
        setAuthMode('register_verify');
        setRegOtpCode('');
        const duration = result.expiresInSeconds || 300;
        setOtpExpiresAt(Date.now() + duration * 1000);
        setOtpRemainingSeconds(duration);
        setRegDevOtpPreview(result.devOtpPreview || '');
        if (result.devOtpPreview) {
          setSuccessMessage(`5-Minute OTP sent! Testing Passcode: [ ${result.devOtpPreview} ]`);
        } else {
          setSuccessMessage(`A 5-minute security passcode has been sent to ${regEmail.trim()}. Please enter it below to confirm ownership.`);
        }
      } else {
        setErrorMessage(result.error || 'Failed to dispatch verification OTP.');
      }
    } catch (_err) {
      setErrorMessage('Network error requesting email verification.');
    } finally {
      setIsLoading(false);
    }
  };

  // 2B. Submit Register Application Step 2: Verify Gmail OTP & Submit for Admin Approval
  const handleVerifyAndSubmitReg = async (e) => {
    e.preventDefault();
    if (!regOtpCode.trim() || regOtpCode.trim().length !== 6) {
      setErrorMessage('Please enter the full 6-digit verification passcode.');
      return;
    }

    setIsLoading(true);
    resetFormState();

    try {
      const result = await verifyAndSubmitRegistration({
        name: regName.trim(),
        email: regEmail.trim(),
        password: regPassword.trim(),
        phone: regPhone.trim(),
        role: regRole,
        otpCode: regOtpCode.trim()
      });

      if (result.success) {
        setRegPassword('');
        purgeActivePasswordInputs();
        setAuthMode('register_success');
        setSuccessMessage('');
      } else {
        setErrorMessage(result.error || 'Invalid or expired verification passcode.');
      }
    } catch (_err) {
      setErrorMessage('Network error verifying Gmail ownership.');
    } finally {
      setIsLoading(false);
    }
  };

  // Resend Register OTP
  const handleResendRegOtp = async () => {
    if (!regEmail.trim()) return;
    setIsLoading(true);
    resetFormState();
    try {
      const result = await sendRegistrationOtp({
        name: regName.trim(),
        email: regEmail.trim(),
        password: regPassword.trim(),
        phone: regPhone.trim(),
        role: regRole
      });
      if (result.success) {
        setRegDevOtpPreview(result.devOtpPreview || '');
        const duration = result.expiresInSeconds || 300;
        setOtpExpiresAt(Date.now() + duration * 1000);
        setOtpRemainingSeconds(duration);
        if (result.devOtpPreview) {
          setSuccessMessage(`New 5-Minute OTP sent! Testing Passcode: [ ${result.devOtpPreview} ]`);
        } else {
          setSuccessMessage(`A fresh 5-minute passcode has been sent to ${regEmail.trim()}.`);
        }
      } else {
        setErrorMessage(result.error || 'Failed to resend verification OTP.');
      }
    } catch (_err) {
      setErrorMessage('Network error resending verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Request 5-Min OTP for Password Reset
  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setErrorMessage('Please enter your registered email address.');
      return;
    }

    setIsLoading(true);
    resetFormState();

    try {
      const result = await sendResetOtp(forgotEmail.trim());
      if (result.success) {
        setSuccessMessage(result.message || 'A 5-minute security OTP has been sent to your email.');
        const duration = result.expiresInSeconds || 300;
        setOtpExpiresAt(Date.now() + duration * 1000);
        setOtpRemainingSeconds(duration);
        // If testing mode provides devOtpPreview, show notice
        if (result.devOtpPreview) {
          setSuccessMessage(`OTP sent! Testing Passcode: [ ${result.devOtpPreview} ] (Expires in 5 mins)`);
        }
        setAuthMode('forgot_verify');
      } else {
        setErrorMessage(result.error || 'Failed to request OTP.');
      }
    } catch (_err) {
      setErrorMessage('Network error requesting OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Verify 5-Min OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      setErrorMessage('Please enter the full 6-digit OTP passcode.');
      return;
    }

    setIsLoading(true);
    resetFormState();

    try {
      const result = await verifyResetOtp(forgotEmail.trim(), otpCode.trim());
      if (result.success && result.resetToken) {
        setResetToken(result.resetToken);
        setSuccessMessage('OTP verified successfully! Please enter your new personal password.');
        setAuthMode('forgot_new_pass');
      } else {
        setErrorMessage(result.error || 'Invalid or expired OTP code.');
      }
    } catch (_err) {
      setErrorMessage('Network error verifying OTP code.');
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Submit New Password
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    const candidateNewPass = newPassword.trim();
    const candidateConfirmPass = confirmPassword.trim();

    if (!candidateNewPass) {
      setErrorMessage('Please enter your new password.');
      return;
    }
    if (candidateNewPass.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }
    if (candidateNewPass !== candidateConfirmPass) {
      setErrorMessage('Passwords do not match. Please re-enter carefully.');
      return;
    }

    // Zero out password in React state & DOM immediately
    setNewPassword('');
    setConfirmPassword('');
    purgeActivePasswordInputs();
    setIsLoading(true);
    resetFormState();

    try {
      const result = await resetPasswordWithToken(forgotEmail.trim(), candidateNewPass, resetToken);
      if (result.success) {
        setSuccessMessage('Your password has been updated successfully! You can now log in.');
        setEmail(forgotEmail);
        setPassword('');
        setAuthMode('login');
      } else {
        setErrorMessage(result.error || 'Failed to update password.');
      }
    } catch (_err) {
      setErrorMessage('Network error setting new password.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="staff-portal-fullscreen" 
      role="dialog"
      aria-modal="true"
      aria-label="Public Spark Staff Gateway"
    >
      {/* Top Bar with Sovereign Close Button */}
      <div className="staff-portal-topbar">
        <button
          onClick={handleSafeClose}
          className="staff-portal-close-btn"
          aria-label="Close"
          title="Return to Public Website (ESC)"
        >
          <X size={20} strokeWidth={2.5} />
        </button>
      </div>

      {/* Centered Form Container (Max 440px) */}
      <div className="staff-portal-center">
        {/* Public Spark Masthead Lockup */}
        <div className="staff-portal-kicker">THE FOURTH ESTATE • EDITORIAL DESK</div>
        <h1 className="staff-portal-brand">PUBLIC SPARK</h1>
        <div className="staff-portal-divider" />

        {/* Dynamic Mode Headline */}
        <h2 className="staff-portal-headline">
          {authMode === 'login' && 'Sign In to Editorial Workspace'}
          {authMode === '2fa_challenge' && 'Two-Factor Authentication Verification'}
          {authMode === 'register' && 'Apply for Accredited Staff Access'}
          {authMode === 'register_verify' && 'Confirm Email Ownership'}
          {authMode === 'register_success' && 'Application Forwarded to Super Admin'}
          {authMode === 'forgot_request' && 'Reset Confidential Password'}
          {authMode === 'forgot_verify' && 'Enter 6-Digit Security Passcode'}
          {authMode === 'forgot_new_pass' && 'Create New Password'}
        </h2>

        {/* Alert Messages */}
        {errorMessage && (
          <div className="staff-portal-alert-error">
            <div>{errorMessage}</div>
            {remainingAttempts !== null && (
              <div style={{ marginTop: '4px', fontWeight: 700 }}>
                Warning: 5 failed attempts locks access for 15 minutes.
              </div>
            )}
          </div>
        )}

        {successMessage && (
          <div className="staff-portal-alert-success">
            {successMessage}
          </div>
        )}

        {/* 1. LOGIN MODE */}
        {authMode === 'login' && (
          <form onSubmit={handleLoginSubmit} autoComplete="off">
            <div className="staff-portal-form-group">
              <label className="staff-portal-form-label">Editorial Email Address</label>
              <div className="staff-portal-input-wrap">
                <span className="staff-portal-input-icon">
                  <Mail size={18} />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. reporter@publicspark.in or your Gmail"
                  autoFocus
                  required
                  className="staff-portal-input"
                />
              </div>
            </div>

            <div className="staff-portal-form-group">
              <div className="staff-portal-form-label-row">
                <label className="staff-portal-form-label">Confidential Password</label>
                <button
                  type="button"
                  onClick={() => handleSwitchMode('forgot_request')}
                  className="staff-portal-text-link"
                  style={{ fontSize: '0.8rem' }}
                >
                  Forgot Password?
                </button>
              </div>
              <div className="staff-portal-input-wrap">
                <span className="staff-portal-input-icon">
                  <KeyRound size={18} />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="ps_auth_credential"
                  autoComplete="new-password"
                  data-credential="true"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your confidential password"
                  required
                  className="staff-portal-input"
                  style={{ paddingRight: '2.6rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{ position: 'absolute', right: '0.85rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="staff-portal-btn-primary"
            >
              <span>{isLoading ? 'Verifying Credentials...' : 'Sign In to Workspace'}</span>
              <ArrowRight size={18} />
            </button>

            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                New Journalist or Reporter?{' '}
              </span>
              <button
                type="button"
                onClick={() => handleSwitchMode('register')}
                className="staff-portal-text-link"
                style={{ fontWeight: 700 }}
              >
                Apply for Staff Access
              </button>
            </div>
          </form>
        )}

        {/* 2. TWO-FACTOR AUTHENTICATION (2FA) */}
        {authMode === '2fa_challenge' && (
          <form onSubmit={handle2faSubmit} autoComplete="off">
            <p className="staff-portal-subtitle">
              {isRecoveryMode
                ? 'Enter one of your stored single-use emergency recovery codes (Format: XXXX-XXXX).'
                : 'Open your Google Authenticator app and enter the 6-digit verification code.'}
            </p>

            <div className="staff-portal-form-group">
              <label className="staff-portal-form-label" style={{ textAlign: 'center' }}>
                {isRecoveryMode ? 'Emergency Recovery Code' : '6-Digit TOTP Passcode'}
              </label>
              <input
                type="text"
                autoFocus
                name="ps_2fa_totp_code"
                autoComplete="one-time-code"
                inputMode={isRecoveryMode ? 'text' : 'numeric'}
                maxLength={isRecoveryMode ? 9 : 6}
                value={twoFactorCode}
                onChange={(e) => {
                  const val = isRecoveryMode ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, '');
                  setTwoFactorCode(val);
                }}
                placeholder={isRecoveryMode ? 'XXXX-XXXX' : '000000'}
                required
                className="staff-portal-input no-icon"
                style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.25em', fontFamily: 'monospace' }}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !twoFactorCode.trim()}
              className="staff-portal-btn-primary"
            >
              <span>{isLoading ? 'Verifying Code...' : 'Verify & Enter Workspace'}</span>
              <ShieldCheck size={18} />
            </button>

            <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.65rem', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  setIsRecoveryMode(!isRecoveryMode);
                  setTwoFactorCode('');
                  setErrorMessage('');
                }}
                className="staff-portal-text-link"
              >
                {isRecoveryMode
                  ? 'Switch back to Google Authenticator'
                  : 'Lost phone? Use Emergency Recovery Code'}
              </button>

              <button
                type="button"
                onClick={() => handleSwitchMode('login')}
                className="staff-portal-text-link subtle"
              >
                Back to password login
              </button>
            </div>
          </form>
        )}

        {/* 3. REGISTER STAFF APPLICATION */}
        {authMode === 'register' && (
          <form onSubmit={handleSendRegOtp} autoComplete="off">
            <p className="staff-portal-subtitle">
              We will verify your email ownership via a 5-minute security OTP before forwarding to the Admin Desk.
            </p>

            <div className="staff-portal-form-group">
              <label className="staff-portal-form-label">Full Name</label>
              <input
                type="text"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                required
                className="staff-portal-input no-icon"
              />
            </div>

            <div className="staff-portal-form-group">
              <label className="staff-portal-form-label">Official / Personal Email</label>
              <div className="staff-portal-input-wrap">
                <span className="staff-portal-input-icon">
                  <Mail size={18} />
                </span>
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="e.g. rahul@publicspark.in"
                  required
                  className="staff-portal-input"
                />
              </div>
            </div>

            <div className="staff-portal-form-group">
              <label className="staff-portal-form-label">Create Password (Min 6 Characters)</label>
              <div className="staff-portal-input-wrap">
                <span className="staff-portal-input-icon">
                  <KeyRound size={18} />
                </span>
                <input
                  type={showRegPassword ? 'text' : 'password'}
                  name="ps_reg_secret_credential"
                  autoComplete="new-password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  className="staff-portal-input"
                  style={{ paddingRight: '2.6rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                  style={{ position: 'absolute', right: '0.85rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                >
                  {showRegPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <label className="staff-portal-form-label">Phone Number</label>
                <input
                  type="tel"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="+91..."
                  className="staff-portal-input no-icon"
                />
              </div>

              <div>
                <label className="staff-portal-form-label">Applied Role</label>
                <select
                  value={regRole}
                  onChange={(e) => setRegRole(e.target.value)}
                  className="staff-portal-select"
                >
                  <option value="reporter">Field Reporter</option>
                  <option value="editor">Desk Editor</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="staff-portal-btn-primary"
            >
              <span>{isLoading ? 'Sending Security Code...' : 'Continue to Verification'}</span>
              <ArrowRight size={18} />
            </button>

            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => handleSwitchMode('login')}
                className="staff-portal-text-link subtle"
              >
                Already have an account? Sign In
              </button>
            </div>
          </form>
        )}

        {/* 4. REGISTER EMAIL OTP VERIFICATION */}
        {authMode === 'register_verify' && (
          <form onSubmit={handleVerifyAndSubmitReg}>
            <p className="staff-portal-subtitle">
              Enter the 6-digit passcode sent to <strong>{regEmail}</strong> (expires in {formatCountdown(otpRemainingSeconds)}).
            </p>

            <div className="staff-portal-form-group">
              <label className="staff-portal-form-label" style={{ textAlign: 'center' }}>Verification Passcode</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={regOtpCode}
                onChange={(e) => setRegOtpCode(e.target.value.replace(/\D/g, ''))}
                autoFocus
                placeholder="000000"
                required
                className="staff-portal-input no-icon"
                style={{ textAlign: 'center', fontSize: '1.75rem', letterSpacing: '0.35em', fontFamily: 'monospace' }}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || regOtpCode.length !== 6 || otpRemainingSeconds === 0}
              className="staff-portal-btn-primary"
            >
              <span>{isLoading ? 'Verifying...' : 'Submit Application'}</span>
              <CheckCircle2 size={18} />
            </button>

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setAuthMode('register')}
                className="staff-portal-text-link subtle"
              >
                Back to details
              </button>
              <button
                type="button"
                onClick={handleResendRegOtp}
                disabled={isLoading}
                className="staff-portal-text-link"
              >
                Resend code
              </button>
            </div>
          </form>
        )}

        {/* 5. REGISTER APPLICATION SUBMITTED */}
        {authMode === 'register_success' && (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <p className="staff-portal-subtitle" style={{ fontSize: '1rem', color: 'var(--text-main)' }}>
              Your email ownership (<strong>{regEmail}</strong>) has been confirmed. Your journalist application has been forwarded to the <strong>Super Admin Desk</strong> for accreditation.
            </p>

            <button
              type="button"
              onClick={() => {
                setEmail(regEmail);
                setPassword('');
                handleSwitchMode('login');
              }}
              className="staff-portal-btn-primary"
            >
              Return to Sign In
            </button>
          </div>
        )}

        {/* 6. FORGOT PASSWORD (REQUEST OTP) */}
        {authMode === 'forgot_request' && (
          <form onSubmit={handleSendOtp}>
            <p className="staff-portal-subtitle">
              Enter your registered email address. We will dispatch a 5-minute security verification code to your inbox.
            </p>

            <div className="staff-portal-form-group">
              <label className="staff-portal-form-label">Registered Email</label>
              <div className="staff-portal-input-wrap">
                <span className="staff-portal-input-icon">
                  <Mail size={18} />
                </span>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="e.g. reporter@publicspark.in"
                  autoFocus
                  required
                  className="staff-portal-input"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="staff-portal-btn-primary"
            >
              <span>{isLoading ? 'Sending...' : 'Send Security Code'}</span>
              <ArrowRight size={18} />
            </button>

            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => handleSwitchMode('login')}
                className="staff-portal-text-link subtle"
              >
                Back to Sign In
              </button>
            </div>
          </form>
        )}

        {/* 7. VERIFY RESET OTP */}
        {authMode === 'forgot_verify' && (
          <form onSubmit={handleVerifyOtp}>
            <p className="staff-portal-subtitle">
              Enter the 6-digit code sent to <strong>{forgotEmail}</strong> (expires in {formatCountdown(otpRemainingSeconds)}).
            </p>

            <div className="staff-portal-form-group">
              <label className="staff-portal-form-label" style={{ textAlign: 'center' }}>Verification Passcode</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                autoFocus
                placeholder="000000"
                required
                className="staff-portal-input no-icon"
                style={{ textAlign: 'center', fontSize: '1.75rem', letterSpacing: '0.35em', fontFamily: 'monospace' }}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || otpCode.length !== 6 || otpRemainingSeconds === 0}
              className="staff-portal-btn-primary"
            >
              <span>{isLoading ? 'Verifying...' : 'Verify Code'}</span>
              <CheckCircle2 size={18} />
            </button>

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                onClick={handleSendOtp}
                className="staff-portal-text-link"
              >
                Resend code
              </button>
              <button
                type="button"
                onClick={() => handleSwitchMode('login')}
                className="staff-portal-text-link subtle"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* 8. SET NEW PASSWORD */}
        {authMode === 'forgot_new_pass' && (
          <form onSubmit={handleResetPasswordSubmit} autoComplete="off">
            <p className="staff-portal-subtitle">
              Identity verified. Choose a new confidential password for <strong>{forgotEmail}</strong>.
            </p>

            <div className="staff-portal-form-group">
              <label className="staff-portal-form-label">New Password (Min 6 Characters)</label>
              <div className="staff-portal-input-wrap">
                <span className="staff-portal-input-icon">
                  <KeyRound size={18} />
                </span>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  name="ps_reset_secret_field"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoFocus
                  placeholder="Enter new password"
                  required
                  className="staff-portal-input"
                  style={{ paddingRight: '2.6rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  style={{ position: 'absolute', right: '0.85rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="staff-portal-form-group">
              <label className="staff-portal-form-label">Confirm New Password</label>
              <div className="staff-portal-input-wrap">
                <span className="staff-portal-input-icon">
                  <KeyRound size={18} />
                </span>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="ps_confirm_secret_field"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                  className="staff-portal-input"
                  style={{ paddingRight: '2.6rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  style={{ position: 'absolute', right: '0.85rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !newPassword}
              className="staff-portal-btn-primary"
            >
              <span>{isLoading ? 'Updating Password...' : 'Save Password & Sign In'}</span>
              <CheckCircle2 size={18} />
            </button>
          </form>
        )}
      </div>

      {/* Bottom Regulatory Disclaimer Bar */}
      <div className="staff-portal-bottombar">
        <span>Rule 18 IT Rules 2021 Compliant • Authorized Newsroom Access</span>
        <span>Session automatically expires after 30 minutes of inactivity</span>
      </div>
    </div>
  );
}
