import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Terminal, ShieldAlert, RefreshCw, HardDrive, Cpu, Database,
  Lock, Unlock, CheckCircle2, AlertTriangle, Download, Search,
  Activity, Clock, Server, FileText, Check, ShieldCheck,
  Smartphone, Key, Eye, EyeOff, Copy, X, AlertCircle
} from 'lucide-react';
import {
  fetch2faStatus,
  setup2faInitiate,
  confirm2faSetup,
  getAuthHeaders
} from '../../services/authClient';

/**
 * PublicSpark Newsroom - Sovereign Developer Emergency Access & Rescue Desk (Task 34)
 * Provides God-Mode system diagnostics, brute-force IP rate-limit clearance,
 * JSON database integrity scanning, point-in-time PKZIP emergency snapshots,
 * and RFC 6238 Google Authenticator 2FA hardware enrollment for the Sovereign Developer account.
 * Adheres strictly to Rule 4 (Broadsheet Sovereign UX, 360px responsive, zero emojis).
 */
export default function DeveloperRescueDesk({ onShowToast }) {
  const [diagnostics, setDiagnostics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null); // 'locks' | 'verify' | 'backup' | 'refresh'
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLogs, setActionLogs] = useState(() => [
    {
      id: 1,
      timestamp: new Date().toLocaleTimeString(),
      type: 'info',
      message: 'Sovereign Developer Rescue Gateway initialized. God-Mode telemetry active.'
    }
  ]);

  // Two-Factor Authentication (2FA) State
  const [twoFactorStatus, setTwoFactorStatus] = useState({ enabled: false, remainingRecoveryCodes: 0, activatedAt: null });
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [setupData, setSetupData] = useState(null); // { secret, qrSvg, uri, recoveryCodes }
  const [setupConfirmCode, setSetupConfirmCode] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);

  const copiedCodesTimerRef = useRef(null);
  const copiedSecretTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (copiedCodesTimerRef.current) clearTimeout(copiedCodesTimerRef.current);
      if (copiedSecretTimerRef.current) clearTimeout(copiedSecretTimerRef.current);
    };
  }, []);

  const addLog = useCallback((type, message) => {
    setActionLogs(prev => [
      {
        id: Date.now() + Math.random(),
        timestamp: new Date().toLocaleTimeString(),
        type,
        message
      },
      ...prev.slice(0, 49) // Keep last 50 entries
    ]);
  }, []);

  // 1. Fetch Diagnostics Telemetry
  const fetchDiagnostics = useCallback(async (isManual = false) => {
    if (isManual) setActionLoading('refresh');
    else setLoading(true);

    try {
      const res = await fetch('/api/developer/diagnostics', {
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Access Denied or Server Error`);
      }

      const data = await res.json();
      if (data.success) {
        setDiagnostics(data);
        if (isManual) {
          addLog('success', 'Diagnostics telemetry refreshed successfully.');
          if (onShowToast) onShowToast('System telemetry updated.');
        }
      } else {
        throw new Error(data.error || 'Failed to parse telemetry');
      }
    } catch (err) {
      console.error('[DeveloperRescueDesk] Telemetry fetch error:', err);
      addLog('error', `Telemetry error: ${err.message}`);
      if (onShowToast) onShowToast(`Error: ${err.message}`);
    } finally {
      setLoading(false);
      setActionLoading(null);
    }
  }, [addLog, onShowToast]);

  // 2. Fetch Developer 2FA Status
  const load2faStatus = useCallback(async () => {
    try {
      const res = await fetch2faStatus();
      if (res && res.success) {
        setTwoFactorStatus({
          enabled: Boolean(res.enabled),
          remainingRecoveryCodes: res.remainingRecoveryCodes || 0,
          activatedAt: res.activatedAt || null
        });
      }
    } catch (err) {
      console.error('[DeveloperRescueDesk] Failed to load 2FA status:', err);
    }
  }, []);

  useEffect(() => {
    fetchDiagnostics();
    load2faStatus();
  }, [fetchDiagnostics, load2faStatus]);

  // 3. Initiate 2FA Enrollment
  const handleStart2faSetup = async () => {
    setSetupLoading(true);
    setSetupError('');
    try {
      const res = await setup2faInitiate();
      if (res && res.success) {
        setSetupData(res);
        setSetupModalOpen(true);
        setSetupConfirmCode('');
      } else {
        throw new Error(res.error || 'Failed to initialize 2FA pairing');
      }
    } catch (err) {
      if (onShowToast) onShowToast(`2FA Setup Error: ${err.message}`);
    } finally {
      setSetupLoading(false);
    }
  };

  // 4. Confirm 2FA Enrollment with first TOTP Code
  const handleConfirm2fa = async (e) => {
    e.preventDefault();
    if (!setupConfirmCode.trim() || setupConfirmCode.trim().length !== 6) {
      setSetupError('Please enter the full 6-digit verification code from Google Authenticator.');
      return;
    }

    setSetupLoading(true);
    setSetupError('');
    try {
      const res = await confirm2faSetup(setupConfirmCode.trim());
      if (res && res.success) {
        setTwoFactorStatus({
          enabled: true,
          remainingRecoveryCodes: res.remainingRecoveryCodes || 10,
          activatedAt: res.activatedAt || new Date().toISOString()
        });
        setSetupModalOpen(false);
        addLog('success', 'Google Authenticator 2FA successfully activated on Sovereign Developer account.');
        if (onShowToast) onShowToast('Google Authenticator 2FA enforced successfully.');
      } else {
        throw new Error(res.error || 'Verification failed');
      }
    } catch (err) {
      setSetupError(err.message || 'Verification failed. Please check the code.');
    } finally {
      setSetupLoading(false);
    }
  };

  const handleCopySecret = () => {
    if (setupData?.secret) {
      navigator.clipboard.writeText(setupData.secret);
      setCopiedSecret(true);
      if (copiedSecretTimerRef.current) clearTimeout(copiedSecretTimerRef.current);
      copiedSecretTimerRef.current = setTimeout(() => setCopiedSecret(false), 2000);
      if (onShowToast) onShowToast('2FA Secret Key copied to clipboard.');
    }
  };

  const handleCopyCodes = () => {
    if (setupData?.recoveryCodes) {
      navigator.clipboard.writeText(setupData.recoveryCodes.join('\n'));
      setCopiedCodes(true);
      if (copiedCodesTimerRef.current) clearTimeout(copiedCodesTimerRef.current);
      copiedCodesTimerRef.current = setTimeout(() => setCopiedCodes(false), 2000);
      if (onShowToast) onShowToast('Recovery codes copied to clipboard.');
    }
  };

  const handleDownloadCodes = () => {
    if (!setupData?.recoveryCodes) return;
    const content = [
      'PUBLICSPARK NEWSROOM - SOVEREIGN DEVELOPER EMERGENCY RECOVERY CODES',
      'Account: sinigamihacker@gmail.com',
      `Generated: ${new Date().toISOString()}`,
      '',
      'Each recovery code can be used ONCE in place of your Google Authenticator code.',
      'Keep this file safe and offline.',
      '',
      ...setupData.recoveryCodes.map((code, i) => `${i + 1}. ${code}`),
      '',
      '----------------------------------------------------------------------'
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `publicspark-developer-recovery-codes-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (onShowToast) onShowToast('Recovery codes file downloaded.');
  };

  // Action 1: Reset All Security Locks & Unblock IPs
  const handleResetLocks = async () => {
    if (!window.confirm('Confirm Reset: Clear all brute-force login attempts, OTP cooldowns, and rate-limited IP addresses?')) {
      return;
    }

    setActionLoading('locks');
    try {
      const res = await fetch('/api/developer/reset-locks', {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await res.json();

      if (data.success) {
        const cleared = data.result?.clearedCount ?? 0;
        addLog('success', `Security locks reset: ${cleared} lock(s) and tracked IP entries cleared.`);
        if (onShowToast) onShowToast(`Success: ${cleared} security lock(s) reset.`);
        fetchDiagnostics();
      } else {
        throw new Error(data.error || 'Failed to clear security locks');
      }
    } catch (err) {
      addLog('error', `Security reset failed: ${err.message}`);
      if (onShowToast) onShowToast(`Reset Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Action 2: Deep Database Integrity Verification
  const handleVerifyDatabase = async () => {
    setActionLoading('verify');
    try {
      const res = await fetch('/api/developer/verify-database', {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await res.json();

      if (data.success) {
        const { verifiedCount, corruptCount, totalFiles } = data;
        if (corruptCount === 0) {
          addLog('success', `Deep Database Scan Complete: All ${verifiedCount}/${totalFiles} JSON tables 100% valid.`);
          if (onShowToast) onShowToast(`Database 100% Intact (${verifiedCount} files).`);
        } else {
          addLog('error', `WARNING: ${corruptCount} corrupted JSON table(s) detected during scan!`);
          if (onShowToast) onShowToast(`Alert: ${corruptCount} corrupt table(s) found!`);
        }
        fetchDiagnostics();
      } else {
        throw new Error(data.error || 'Database scan failed');
      }
    } catch (err) {
      addLog('error', `Database verification failed: ${err.message}`);
      if (onShowToast) onShowToast(`Scan Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Action 3: Trigger Immediate Emergency Snapshot
  const handleEmergencyBackup = async () => {
    setActionLoading('backup');
    try {
      const res = await fetch('/api/developer/emergency-backup', {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await res.json();

      if (data.success && data.backup) {
        addLog('success', `Emergency Snapshot Generated: ${data.backup.fileName} (${data.backup.sizeFormatted}).`);
        if (onShowToast) onShowToast(`Emergency Snapshot Created (${data.backup.sizeFormatted}).`);
        fetchDiagnostics();
      } else {
        throw new Error(data.error || 'Snapshot generation failed');
      }
    } catch (err) {
      addLog('error', `Emergency backup failed: ${err.message}`);
      if (onShowToast) onShowToast(`Backup Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Filtered Database Files
  const filteredFiles = useMemo(() => {
    if (!diagnostics?.database?.files) return [];
    if (!searchQuery.trim()) return diagnostics.database.files;
    const q = searchQuery.toLowerCase().trim();
    return diagnostics.database.files.filter(f => f.file.toLowerCase().includes(q));
  }, [diagnostics, searchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '100%' }}>
      {/* HEADER SECTION */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-md)',
        padding: '1.25rem 1.5rem',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            background: 'var(--text-main)',
            color: 'var(--bg-surface)',
            width: '42px',
            height: '42px',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Terminal size={22} strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h2 style={{
                fontSize: '1.25rem',
                fontWeight: '900',
                letterSpacing: '-0.02em',
                margin: 0,
                color: 'var(--text-main)',
                fontFamily: 'var(--font-heading)'
              }}>
                Developer Emergency Access & Diagnostics Desk
              </h2>
              <span style={{
                background: 'var(--bg-contrast)',
                color: 'var(--text-main)',
                fontSize: '0.65rem',
                fontWeight: '900',
                textTransform: 'uppercase',
                padding: '0.15rem 0.5rem',
                borderRadius: '3px',
                border: '1px solid var(--border-light)'
              }}>
                God-Mode L4
              </span>
            </div>
            <p style={{
              fontSize: '0.825rem',
              color: 'var(--text-subtle)',
              margin: '0.2rem 0 0 0'
            }}>
              Direct server telemetry, database integrity scans, emergency snapshots, and security lock clearance.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => fetchDiagnostics(true)}
            disabled={actionLoading !== null}
            className="btn-broadsheet"
            style={{
              padding: '0.5rem 0.85rem',
              fontSize: '0.8rem',
              fontWeight: '700',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              minHeight: '36px',
              cursor: actionLoading !== null ? 'not-allowed' : 'pointer'
            }}
            type="button"
          >
            <RefreshCw size={14} className={actionLoading === 'refresh' ? 'spin' : ''} />
            Refresh Telemetry
          </button>
        </div>
      </div>

      {/* KPI STATUS CARDS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1rem',
        width: '100%'
      }}>
        {/* Card 1: Server Runtime */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-subtle)' }}>
              Server Runtime
            </span>
            <Server size={16} color="var(--accent-crimson)" />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--text-main)', lineHeight: 1 }}>
            {diagnostics ? diagnostics.system.uptimePretty : '...'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <span>Node: <strong>{diagnostics?.system?.nodeVersion || 'Node.js'}</strong> ({diagnostics?.system?.platform || 'os'})</span>
            <span>Process PID: <strong>{diagnostics?.system?.pid || '...'}</strong></span>
          </div>
        </div>

        {/* Card 2: Memory Usage */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-subtle)' }}>
              RAM Memory
            </span>
            <Cpu size={16} color="var(--accent-crimson)" />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--text-main)', lineHeight: 1 }}>
            {diagnostics?.system?.memory?.heapUsedFormatted || '...'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <span>Heap Total: <strong>{diagnostics?.system?.memory?.heapTotalFormatted || '...'}</strong></span>
            <span>Resident Set (RSS): <strong>{diagnostics?.system?.memory?.rssFormatted || '...'}</strong></span>
          </div>
        </div>

        {/* Card 3: Security Lock State */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-subtle)' }}>
              Security Locks
            </span>
            {diagnostics?.security?.activeLoginLocks > 0 ? (
              <ShieldAlert size={16} color="var(--accent-crimson)" />
            ) : (
              <ShieldCheck size={16} color="#10b981" />
            )}
          </div>
          <div style={{
            fontSize: '1.4rem',
            fontWeight: '900',
            color: diagnostics?.security?.activeLoginLocks > 0 ? 'var(--accent-crimson)' : 'var(--text-main)',
            lineHeight: 1
          }}>
            {diagnostics?.security?.activeLoginLocks > 0
              ? `${diagnostics.security.activeLoginLocks} Active Lock(s)`
              : 'All Nominal'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <span>Tracked Login IPs: <strong>{diagnostics?.security?.totalTrackedLoginIps ?? 0}</strong></span>
            <span>Tracked OTP IPs: <strong>{diagnostics?.security?.totalTrackedOtpIps ?? 0}</strong></span>
          </div>
        </div>

        {/* Card 4: Database Health */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-subtle)' }}>
              Database Integrity
            </span>
            <Database size={16} color="var(--accent-crimson)" />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--text-main)', lineHeight: 1 }}>
            {diagnostics?.database?.allValid ? '100% Intact' : 'Attention Required'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <span>Total JSON Tables: <strong>{diagnostics?.database?.totalFiles ?? 0}</strong></span>
            <span>Backups Stored: <strong>{diagnostics?.backups?.totalBackups ?? 0} archives</strong></span>
          </div>
        </div>
      </div>

      {/* SOVEREIGN TWO-FACTOR AUTHENTICATION (2FA) CARD */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-md)',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-sm)',
              background: twoFactorStatus.enabled ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              color: twoFactorStatus.enabled ? '#10b981' : 'var(--accent-crimson)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Smartphone size={22} strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>
                  Sovereign Google Authenticator 2FA (RFC 6238 TOTP)
                </h3>
                <span style={{
                  fontSize: '0.675rem',
                  fontWeight: '900',
                  textTransform: 'uppercase',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '3px',
                  background: twoFactorStatus.enabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: twoFactorStatus.enabled ? '#10b981' : 'var(--accent-crimson)',
                  border: `1px solid ${twoFactorStatus.enabled ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                }}>
                  {twoFactorStatus.enabled ? 'Active & Enforced' : 'Inactive (Password Only)'}
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', margin: '0.2rem 0 0 0' }}>
                Hardware-grade time-based one-time password required on every developer login alongside the 30-char master key.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {twoFactorStatus.enabled ? (
              <button
                onClick={handleStart2faSetup}
                disabled={setupLoading}
                className="btn-broadsheet"
                style={{
                  padding: '0.65rem 1rem',
                  fontSize: '0.825rem',
                  fontWeight: '700',
                  minHeight: '44px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  cursor: setupLoading ? 'not-allowed' : 'pointer'
                }}
                type="button"
              >
                <RefreshCw size={14} className={setupLoading ? 'spin' : ''} />
                Rotate 2FA Keys / Re-Pair
              </button>
            ) : (
              <button
                onClick={handleStart2faSetup}
                disabled={setupLoading}
                className="btn-broadsheet"
                style={{
                  background: 'var(--text-main)',
                  color: 'var(--bg-surface)',
                  padding: '0.65rem 1.15rem',
                  fontSize: '0.85rem',
                  fontWeight: '800',
                  minHeight: '44px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: setupLoading ? 'not-allowed' : 'pointer'
                }}
                type="button"
              >
                <ShieldCheck size={16} />
                {setupLoading ? 'Preparing...' : 'Configure Google Authenticator 2FA'}
              </button>
            )}
          </div>
        </div>

        {twoFactorStatus.enabled && (
          <div style={{
            background: 'var(--bg-contrast)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.75rem 1rem',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.775rem',
            color: 'var(--text-subtle)',
            gap: '0.5rem'
          }}>
            <div>
              Activated: <strong style={{ color: 'var(--text-main)' }}>{twoFactorStatus.activatedAt ? new Date(twoFactorStatus.activatedAt).toLocaleString() : 'Active'}</strong>
            </div>
            <div>
              Remaining Emergency Recovery Codes: <strong style={{ color: 'var(--text-main)' }}>{twoFactorStatus.remainingRecoveryCodes} of 10</strong>
            </div>
          </div>
        )}
      </div>

      {/* QUICK EMERGENCY RESCUE ACTIONS */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-md)',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Activity size={18} color="var(--accent-crimson)" />
          <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0 }}>
            Emergency Rescue & Maintenance Operations
          </h3>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '0.85rem'
        }}>
          {/* Action 1: Reset Locks */}
          <button
            onClick={handleResetLocks}
            disabled={actionLoading !== null}
            className="btn-broadsheet"
            style={{
              padding: '0.85rem 1rem',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              fontWeight: '700',
              fontSize: '0.875rem',
              border: '1px solid var(--border-light)',
              cursor: actionLoading !== null ? 'not-allowed' : 'pointer'
            }}
            type="button"
          >
            <Unlock size={16} color="var(--accent-crimson)" />
            {actionLoading === 'locks' ? 'Clearing Locks...' : 'Reset All Security Locks & Unblock IPs'}
          </button>

          {/* Action 2: Deep Database Scan */}
          <button
            onClick={handleVerifyDatabase}
            disabled={actionLoading !== null}
            className="btn-broadsheet"
            style={{
              padding: '0.85rem 1rem',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              fontWeight: '700',
              fontSize: '0.875rem',
              border: '1px solid var(--border-light)',
              cursor: actionLoading !== null ? 'not-allowed' : 'pointer'
            }}
            type="button"
          >
            <Database size={16} color="var(--accent-crimson)" />
            {actionLoading === 'verify' ? 'Auditing JSON Tables...' : 'Deep Database Integrity Scan'}
          </button>

          {/* Action 3: Immediate Snapshot */}
          <button
            onClick={handleEmergencyBackup}
            disabled={actionLoading !== null}
            className="btn-broadsheet"
            style={{
              padding: '0.85rem 1rem',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              fontWeight: '700',
              fontSize: '0.875rem',
              border: '1px solid var(--border-light)',
              cursor: actionLoading !== null ? 'not-allowed' : 'pointer'
            }}
            type="button"
          >
            <Download size={16} color="var(--accent-crimson)" />
            {actionLoading === 'backup' ? 'Creating Snapshot...' : 'Immediate Emergency Snapshot (.ZIP)'}
          </button>
        </div>
      </div>

      {/* DATABASE FILES HEALTH TABLE */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-md)',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0 }}>
              Database Tables & Data Store Files ({diagnostics?.database?.totalFiles ?? 0})
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
              Real-time audit of physical JSON storage records in server/data directory.
            </span>
          </div>

          <div style={{
            position: 'relative',
            minWidth: '220px',
            maxWidth: '100%'
          }}>
            <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)' }} />
            <input
              type="text"
              placeholder="Search data files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem 0.75rem 0.45rem 2.2rem',
                fontSize: '0.825rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-contrast)',
                color: 'var(--text-main)'
              }}
            />
          </div>
        </div>

        {/* Responsive Table Wrapper */}
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.825rem',
            textAlign: 'left'
          }}>
            <thead>
              <tr style={{
                borderBottom: '2px solid var(--border-light)',
                color: 'var(--text-subtle)',
                fontSize: '0.725rem',
                fontWeight: '900',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                <th style={{ padding: '0.65rem 0.75rem' }}>File Name</th>
                <th style={{ padding: '0.65rem 0.75rem' }}>Record Count</th>
                <th style={{ padding: '0.65rem 0.75rem' }}>Size</th>
                <th style={{ padding: '0.65rem 0.75rem' }}>Integrity</th>
                <th style={{ padding: '0.65rem 0.75rem' }}>Last Modified</th>
              </tr>
            </thead>
            <tbody>
              {filteredFiles.map((f) => (
                <tr
                  key={f.file}
                  style={{
                    borderBottom: '1px solid var(--border-light)',
                    color: 'var(--text-main)'
                  }}
                >
                  <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'monospace', fontWeight: '700' }}>
                    {f.file}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem' }}>
                    <span style={{
                      background: 'var(--bg-contrast)',
                      padding: '0.15rem 0.45rem',
                      borderRadius: '3px',
                      fontSize: '0.75rem',
                      fontWeight: '700'
                    }}>
                      {f.records} {f.records === 1 ? 'item' : 'items'}
                    </span>
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-subtle)' }}>
                    {f.sizeFormatted}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem' }}>
                    {f.valid ? (
                      <span style={{
                        color: '#10b981',
                        fontWeight: '700',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: '0.75rem'
                      }}>
                        <Check size={14} strokeWidth={3} /> Valid
                      </span>
                    ) : (
                      <span style={{
                        color: 'var(--accent-crimson)',
                        fontWeight: '700',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: '0.75rem'
                      }}>
                        <AlertTriangle size={14} /> Corrupt
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-subtle)', fontSize: '0.75rem' }}>
                    {f.mtime ? new Date(f.mtime).toLocaleString() : 'N/A'}
                  </td>
                </tr>
              ))}
              {filteredFiles.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-subtle)' }}>
                    No database files matched your query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* LIVE EMERGENCY ACTION LOG CONSOLE */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-md)',
        padding: '1.25rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={16} color="var(--accent-crimson)" />
            <h3 style={{ fontSize: '0.95rem', fontWeight: '800', margin: 0 }}>
              Live Diagnostics & Action Audit Log
            </h3>
          </div>
          <button
            onClick={() => setActionLogs([])}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-subtle)',
              fontSize: '0.75rem',
              fontWeight: '700',
              cursor: 'pointer',
              padding: '0.2rem 0.4rem'
            }}
            type="button"
          >
            Clear Log
          </button>
        </div>

        <div style={{
          background: 'var(--bg-contrast)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-light)',
          padding: '0.75rem',
          maxHeight: '160px',
          overflowY: 'auto',
          fontFamily: 'monospace',
          fontSize: '0.775rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem'
        }}>
          {actionLogs.map((log) => (
            <div key={log.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              <span style={{ color: 'var(--text-subtle)', flexShrink: 0 }}>[{log.timestamp}]</span>
              <span style={{
                color: log.type === 'error'
                  ? 'var(--accent-crimson)'
                  : log.type === 'success'
                  ? '#10b981'
                  : 'var(--text-main)'
              }}>
                {log.message}
              </span>
            </div>
          ))}
          {actionLogs.length === 0 && (
            <span style={{ color: 'var(--text-subtle)' }}>No recent action logs.</span>
          )}
        </div>
      </div>

      {/* 2FA ENROLLMENT MODAL */}
      {setupModalOpen && setupData && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem',
          boxSizing: 'border-box'
        }}>
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-md)',
            padding: 'clamp(1rem, 3vw, 1.5rem)',
            width: 'min(94vw, 560px)',
            maxWidth: '560px',
            maxHeight: 'min(90vh, 720px)',
            overflowY: 'auto',
            boxShadow: 'var(--shadow-lg)',
            boxSizing: 'border-box'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '6px',
                  background: 'rgba(14, 42, 71, 0.12)',
                  color: 'var(--brand-navy, var(--accent-indigo))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Smartphone size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Pair Google Authenticator</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>Sovereign Developer Account Security</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSetupModalOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', padding: '6px' }}
              >
                <X size={20} />
              </button>
            </div>

            {setupError && (
              <div style={{
                marginBottom: '1rem',
                padding: '0.75rem',
                borderRadius: '4px',
                background: 'rgba(197, 34, 31, 0.08)',
                border: '1px solid rgba(197, 34, 31, 0.3)',
                color: 'var(--accent-crimson)',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{setupError}</span>
              </div>
            )}

            {/* STEP 1: QR Code & Manual Key */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.825rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-main)' }}>
                Step 1: Scan QR Code with Google Authenticator
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', margin: '0 0 0.75rem 0' }}>
                Open Google Authenticator (or any TOTP app) on your phone, tap &quot;+&quot;, and scan the QR code below.
              </p>
              
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '1rem',
                background: '#FFFFFF',
                borderRadius: '6px',
                border: '1px solid var(--border-medium)',
                marginBottom: '0.75rem'
              }}>
                <div
                  dangerouslySetInnerHTML={{ __html: setupData.qrSvg }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                />
              </div>

              {/* Manual Entry Key */}
              <div style={{
                background: 'var(--bg-contrast)',
                border: '1px solid var(--border-light)',
                borderRadius: '4px',
                padding: '0.65rem 0.85rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-subtle)' }}>
                    Can&apos;t scan? Enter Secret Key manually:
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSecretKey(prev => !prev)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', fontSize: '0.725rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    {showSecretKey ? <EyeOff size={13} /> : <Eye size={13} />}
                    {showSecretKey ? 'Hide' : 'Reveal'}
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <code style={{
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    color: 'var(--text-main)',
                    wordBreak: 'break-all'
                  }}>
                    {showSecretKey ? setupData.secret : '•••• •••• •••• •••• •••• ••••'}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopySecret}
                    className="btn-broadsheet"
                    style={{ padding: '0.3rem 0.65rem', fontSize: '0.725rem', display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
                  >
                    {copiedSecret ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                    {copiedSecret ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>

            {/* STEP 2: Emergency Recovery Codes */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.825rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Step 2: Save 10 Emergency Recovery Codes
                </span>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    type="button"
                    onClick={handleCopyCodes}
                    className="btn-broadsheet"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    {copiedCodes ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                    {copiedCodes ? 'Copied' : 'Copy All'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadCodes}
                    className="btn-broadsheet"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Download size={12} />
                    Download TXT
                  </button>
                </div>
              </div>
              <p style={{ fontSize: '0.725rem', color: 'var(--text-subtle)', margin: '0 0 0.5rem 0' }}>
                If you ever lose access to your phone, each code can be used ONCE to sign in.
              </p>
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '0.35rem',
                background: 'var(--bg-contrast)',
                border: '1px solid var(--border-light)',
                borderRadius: '4px',
                padding: '0.65rem',
                fontFamily: 'monospace',
                fontSize: '0.75rem'
              }}>
                {setupData.recoveryCodes.map((c, i) => (
                  <div key={c} style={{ color: 'var(--text-main)', padding: '0.15rem 0.35rem' }}>
                    <span style={{ color: 'var(--text-subtle)', marginRight: '6px' }}>{i + 1}.</span>
                    <strong>{c}</strong>
                  </div>
                ))}
              </div>
            </div>

            {/* STEP 3: Confirm 6-Digit Code */}
            <form onSubmit={handleConfirm2fa}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 800, marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                  Step 3: Enter 6-digit Code from Authenticator
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={setupConfirmCode}
                  onChange={(e) => setSetupConfirmCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '0.65rem 1rem',
                    fontSize: '1.25rem',
                    fontWeight: 900,
                    letterSpacing: '0.3em',
                    textAlign: 'center',
                    borderRadius: '4px',
                    border: '2px solid var(--border-medium)',
                    background: 'var(--bg-contrast)',
                    color: 'var(--text-main)',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setSetupModalOpen(false)}
                  disabled={setupLoading}
                  className="btn-broadsheet"
                  style={{ padding: '0.65rem 1rem', fontSize: '0.85rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={setupLoading || setupConfirmCode.length !== 6}
                  className="btn-broadsheet"
                  style={{
                    background: 'var(--text-main)',
                    color: 'var(--bg-surface)',
                    padding: '0.65rem 1.25rem',
                    fontSize: '0.85rem',
                    fontWeight: 800,
                    cursor: (setupLoading || setupConfirmCode.length !== 6) ? 'not-allowed' : 'pointer'
                  }}
                >
                  {setupLoading ? 'Verifying...' : 'Verify & Enforce 2FA'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
