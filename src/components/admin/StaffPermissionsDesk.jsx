import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Users, UserCheck, ShieldCheck, AlertCircle, CheckCircle2,
  Search, RefreshCw, KeyRound, Trash2, Mail, Phone, Calendar,
  ShieldAlert, Check, X, Lock, Download, Copy, Smartphone, Key,
  Eye, EyeOff
} from 'lucide-react';
import { fetch2faStatus, setup2faInitiate, confirm2faSetup, getSessionToken, getSessionRole } from '../../services/authClient';

/**
 * PublicSpark Newsroom — Staff, Journalist & Permissions Desk (Task 17 Subtopic 17.4 & 17.5)
 * Allows Super Admin to review pending journalist applications,
 * grant editorial roles (Reporter, Editor, Admin), suspend/reactivate accounts,
 * configure RFC 6238 Google Authenticator 2FA, and manage security credentials.
 */
export default function StaffPermissionsDesk({ onShowToast }) {
  const [staffList, setStaffList] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState(null);

  // Two-Factor Authentication (2FA) State (Subtopic 17.5)
  const [twoFactorStatus, setTwoFactorStatus] = useState({ enabled: false, remainingRecoveryCodes: 0, activatedAt: null });
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [setupData, setSetupData] = useState(null); // { secret, qrSvg, uri, recoveryCodes }
  const [setupConfirmCode, setSetupConfirmCode] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);

  // Password reset modal state
  const [resetModalStaff, setResetModalStaff] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetSuccessMsg, setResetSuccessMsg] = useState('');
  const [resetErrorMsg, setResetErrorMsg] = useState('');

  // Email change modal state
  const [emailModalStaff, setEmailModalStaff] = useState(null);
  const [newEmailInput, setNewEmailInput] = useState('');
  const [emailSuccessMsg, setEmailSuccessMsg] = useState('');
  const [emailErrorMsg, setEmailErrorMsg] = useState('');
  const currentRole = getSessionRole();

  // High-Privilege Administrator Escalation Confirmation state (Boss Requirement)
  const [adminEscalationTarget, setAdminEscalationTarget] = useState(null); // { staff, previousRole }

  // Memory Leak Prevention: Refs for Clipboard Feedback Timers (Critic Defect 5 Fix)
  const copiedCodesTimerRef = useRef(null);
  const copiedSecretTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (copiedCodesTimerRef.current) clearTimeout(copiedCodesTimerRef.current);
      if (copiedSecretTimerRef.current) clearTimeout(copiedSecretTimerRef.current);
    };
  }, []);

  const getAuthHeaders = useCallback(() => {
    const token = getSessionToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }, []);

  const fetchStaff = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch('/api/staff', {
        headers: { ...getAuthHeaders() }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.staff)) {
          setStaffList(data.staff);
        }
      } else {
        if (onShowToast) onShowToast('Failed to load newsroom staff list.', 'error');
      }
    } catch (err) {
      console.error('Error fetching staff list:', err);
      if (onShowToast) onShowToast('Network error while loading staff.', 'error');
    } finally {
      if (isManual) setRefreshing(false);
    }
  }, [onShowToast, getAuthHeaders]);

  const load2faStatus = useCallback(async () => {
    try {
      const data = await fetch2faStatus();
      if (data && data.success) {
        setTwoFactorStatus({
          enabled: !!data.enabled,
          remainingRecoveryCodes: data.remainingRecoveryCodes || 0,
          activatedAt: data.activatedAt || null
        });
      }
    } catch (_err) {
      // Non-blocking
    }
  }, []);

  useEffect(() => {
    fetchStaff();
    load2faStatus();
  }, [fetchStaff, load2faStatus]);

  // Defense-in-depth: Never display stealth or developer accounts
  const visibleStaffList = useMemo(() => {
    return staffList.filter(s => !s.stealth && s.role !== 'developer');
  }, [staffList]);

  // Derived metrics
  const pendingStaff = useMemo(() => visibleStaffList.filter(s => s.status === 'pending_approval'), [visibleStaffList]);
  const activeStaff = useMemo(() => visibleStaffList.filter(s => s.status === 'active'), [visibleStaffList]);
  const suspendedStaff = useMemo(() => visibleStaffList.filter(s => s.status === 'suspended'), [visibleStaffList]);

  // Filtered staff list for directory
  const filteredStaff = useMemo(() => {
    return visibleStaffList.filter(staff => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        staff.name?.toLowerCase().includes(q) ||
        staff.email?.toLowerCase().includes(q) ||
        staff.phone?.toLowerCase().includes(q) ||
        staff.role?.toLowerCase().includes(q);

      const matchesRole = roleFilter === 'all' ||
        (roleFilter === 'pending' && staff.status === 'pending_approval') ||
        (roleFilter === 'suspended' && staff.status === 'suspended') ||
        (roleFilter === 'active' && staff.status === 'active') ||
        staff.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [visibleStaffList, searchQuery, roleFilter]);

  // Handler: Approve staff member
  const handleApprove = async (staffId, role) => {
    setActionLoading(`approve_${staffId}`);
    try {
      const res = await fetch('/api/staff/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ staffId, role })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (onShowToast) onShowToast(data.message, 'success');
        fetchStaff();
      } else {
        alert(data.error || 'Failed to approve applicant.');
      }
    } catch (_err) {
      alert('Network error while approving applicant.');
    } finally {
      setActionLoading(null);
    }
  };

  // Handler: Select Role Interceptor with Administrator Confirmation Guard
  const handleRoleSelectChange = (staff, newRole) => {
    if (newRole === 'admin' && staff.role !== 'admin') {
      // Trigger High-Privilege Security Confirmation Modal
      setAdminEscalationTarget({ staff, previousRole: staff.role });
      return;
    }
    executeRoleChange(staff.id, newRole);
  };

  // Handler: Execute role update via API
  const executeRoleChange = async (staffId, newRole) => {
    setActionLoading(`role_${staffId}`);
    try {
      const res = await fetch('/api/staff/update-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ staffId, role: newRole })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (onShowToast) onShowToast(data.message, 'success');
        setStaffList(prev => prev.map(s => s.id === staffId ? { ...s, role: newRole } : s));
      } else {
        alert(data.error || 'Failed to update role.');
      }
    } catch (_err) {
      alert('Network error while updating role.');
    } finally {
      setActionLoading(null);
      setAdminEscalationTarget(null);
    }
  };

  // Handler: Toggle status (active/suspended)
  const handleToggleStatus = async (staffId, currentStatus) => {
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
    const confirmMsg = nextStatus === 'suspended'
      ? 'Are you sure you want to suspend this staff member? They will not be able to log in.'
      : 'Are you sure you want to re-activate this staff member?';

    if (!window.confirm(confirmMsg)) return;

    setActionLoading(`status_${staffId}`);
    try {
      const res = await fetch('/api/staff/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ staffId, status: nextStatus })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (onShowToast) onShowToast(data.message, 'success');
        setStaffList(prev => prev.map(s => s.id === staffId ? { ...s, status: nextStatus } : s));
      } else {
        alert(data.error || 'Failed to update status.');
      }
    } catch (_err) {
      alert('Network error while updating status.');
    } finally {
      setActionLoading(null);
    }
  };

  // Handler: Delete staff / reject application
  const handleDelete = async (staffId, staffName) => {
    if (!window.confirm(`Are you sure you want to delete ${staffName} from the newsroom records? This action cannot be undone.`)) {
      return;
    }

    setActionLoading(`delete_${staffId}`);
    try {
      const res = await fetch('/api/staff/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ staffId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (onShowToast) onShowToast('Staff member / application deleted successfully.', 'info');
        setStaffList(prev => prev.filter(s => s.id !== staffId));
      } else {
        alert(data.error || 'Failed to delete staff member.');
      }
    } catch (_err) {
      alert('Network error while deleting staff member.');
    } finally {
      setActionLoading(null);
    }
  };

  // Handler: Admin Reset Password
  const handleAdminResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setResetErrorMsg('Password must be at least 6 characters long.');
      return;
    }
    setResetErrorMsg('');
    setResetSuccessMsg('');
    setActionLoading('reset_submitting');

    try {
      const res = await fetch('/api/staff/admin-reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ staffId: resetModalStaff.id, newPassword })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResetSuccessMsg(`Password for ${resetModalStaff.name} has been successfully updated!`);
        setTimeout(() => {
          setResetModalStaff(null);
          setNewPassword('');
          setResetSuccessMsg('');
        }, 1500);
      } else {
        setResetErrorMsg(data.error || 'Failed to reset password.');
      }
    } catch (_err) {
      setResetErrorMsg('Network error while resetting password.');
    } finally {
      setActionLoading(null);
    }
  };

  // Handler: Update Staff Email (Executive Super Admin restricted strictly to Developer)
  const handleUpdateStaffEmail = async (e) => {
    e.preventDefault();
    const cleanedEmail = String(newEmailInput || '').trim().toLowerCase();
    if (!/^[^\s@:]+@[^\s@:]+\.[^\s@:]+$/.test(cleanedEmail)) {
      setEmailErrorMsg('Please enter a valid email address.');
      return;
    }
    setEmailErrorMsg('');
    setEmailSuccessMsg('');
    setActionLoading('email_submitting');

    try {
      const res = await fetch('/api/staff/update-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ staffId: emailModalStaff.id, newEmail: cleanedEmail })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEmailSuccessMsg(`Email updated to ${cleanedEmail} successfully.`);
        await fetchStaff();
        setTimeout(() => {
          setEmailModalStaff(null);
          setNewEmailInput('');
          setEmailSuccessMsg('');
        }, 1200);
      } else {
        setEmailErrorMsg(data.error || 'Failed to update email.');
      }
    } catch (_err) {
      setEmailErrorMsg('Network error while updating email.');
    } finally {
      setActionLoading(null);
    }
  };

  // Handlers: Two-Factor Authentication Setup & Emergency Codes
  const handleStart2faSetup = async () => {
    setSetupLoading(true);
    setSetupError('');
    setShowSecretKey(false);
    try {
      const res = await setup2faInitiate();
      if (res && res.success) {
        setSetupData(res);
        setSetupModalOpen(true);
        setSetupConfirmCode('');
      } else {
        if (onShowToast) onShowToast(res.error || 'Failed to initialize 2FA setup.', 'error');
      }
    } catch (_err) {
      if (onShowToast) onShowToast('Network error initializing 2FA setup.', 'error');
    } finally {
      setSetupLoading(false);
    }
  };

  const handleConfirm2fa = async (e) => {
    e.preventDefault();
    if (!setupConfirmCode.trim() || setupConfirmCode.trim().length !== 6) {
      setSetupError('Please enter the full 6-digit verification code from Google Authenticator.');
      return;
    }
    setSetupLoading(true);
    setSetupError('');
    setShowSecretKey(false);
    try {
      const res = await confirm2faSetup(setupConfirmCode.trim());
      if (res && res.success) {
        if (onShowToast) onShowToast('Google Authenticator 2FA activated successfully!', 'success');
        setSetupModalOpen(false);
        load2faStatus();
        fetchStaff();
      } else {
        setSetupError(res.error || 'Invalid 6-digit code. Check your phone time and try again.');
      }
    } catch (_err) {
      setSetupError('Network error confirming 2FA setup.');
    } finally {
      setSetupLoading(false);
    }
  };

  const handleDownloadRecoveryCodes = () => {
    if (!setupData || !Array.isArray(setupData.recoveryCodes)) return;
    const content = [
      '=================================================================',
      'PUBLICSPARK NEWSROOM — SUPER ADMIN EMERGENCY RECOVERY CODES',
      '=================================================================',
      `Generated for: ${setupData.accountName || 'admin@publicspark.in'}`,
      `Date Generated: ${new Date().toISOString()}`,
      '',
      'INSTRUCTIONS:',
      '- Each code below can be used ONCE to log into PublicSpark if you lose access to your Google Authenticator phone.',
      '- Once a code is used, it is permanently burned and cannot be used again.',
      '- Store this file securely in an encrypted vault or print it and store in a physical safe.',
      '',
      'EMERGENCY RECOVERY CODES (10 SINGLE-USE CODES):',
      '-----------------------------------------------------------------',
      ...setupData.recoveryCodes.map((code, idx) => `${String(idx + 1).padStart(2, '0')}. ${code}`),
      '-----------------------------------------------------------------',
      'NOTE: For security, these codes will never be displayed in the application again.'
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `publicspark-recovery-codes-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    if (onShowToast) onShowToast('Emergency recovery codes downloaded successfully.', 'success');
  };

  const handleCopyCodes = () => {
    if (!setupData || !Array.isArray(setupData.recoveryCodes)) return;
    navigator.clipboard.writeText(setupData.recoveryCodes.join('\n'));
    setCopiedCodes(true);
    if (copiedCodesTimerRef.current) clearTimeout(copiedCodesTimerRef.current);
    copiedCodesTimerRef.current = setTimeout(() => setCopiedCodes(false), 2000);
    if (onShowToast) onShowToast('All 10 recovery codes copied to clipboard.', 'success');
  };

  const handleCopySecret = () => {
    if (!setupData || !setupData.secret) return;
    navigator.clipboard.writeText(setupData.secret);
    setCopiedSecret(true);
    if (copiedSecretTimerRef.current) clearTimeout(copiedSecretTimerRef.current);
    copiedSecretTimerRef.current = setTimeout(() => setCopiedSecret(false), 2000);
    if (onShowToast) onShowToast('Setup key copied to clipboard.', 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 1. Header & Live KPI Metrics */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-medium)',
        borderRadius: 'var(--radius-md)',
        padding: '1.25rem',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'var(--text-main)', margin: '0 0 0.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={20} style={{ color: 'var(--accent-indigo)' }} />
              Newsroom Staff & Editorial Permissions Desk
            </h2>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Review journalist applications, assign newsroom permissions (Reporter, Editor, Admin), suspend accounts, or manage security.
            </p>
          </div>
          <button
            onClick={() => fetchStaff(true)}
            disabled={refreshing}
            className="btn"
            style={{
              padding: '0.45rem 0.85rem',
              fontSize: '0.8rem',
              fontWeight: '700',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-medium)',
              cursor: refreshing ? 'not-allowed' : 'pointer'
            }}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh Directory'}</span>
          </button>
        </div>

        {/* 4 KPI Counters */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
          <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Members</div>
            <div style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--text-main)', marginTop: '0.2rem' }}>{visibleStaffList.length}</div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--accent-emerald)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Staff</div>
            <div style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--accent-emerald)', marginTop: '0.2rem' }}>{activeStaff.length}</div>
          </div>
          <div style={{
            background: pendingStaff.length > 0 ? 'rgba(180, 83, 9, 0.08)' : 'var(--bg-secondary)',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-sm)',
            border: pendingStaff.length > 0 ? '1px solid rgba(180, 83, 9, 0.3)' : '1px solid var(--border-light)'
          }}>
            <div style={{ fontSize: '0.7rem', fontWeight: '800', color: pendingStaff.length > 0 ? 'var(--accent-amber)' : 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Pending Approvals
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: '900', color: pendingStaff.length > 0 ? 'var(--accent-amber)' : 'var(--text-main)', marginTop: '0.2rem' }}>
              {pendingStaff.length}
            </div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Suspended Accounts</div>
            <div style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{suspendedStaff.length}</div>
          </div>
        </div>
      </div>

      {/* 1B. Super Admin Two-Factor Authentication (2FA) Security Control Card */}
      <div style={{
        background: 'var(--bg-surface)',
        border: twoFactorStatus.enabled ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(234, 88, 12, 0.35)',
        borderRadius: 'var(--radius-md)',
        padding: '1.25rem',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              background: twoFactorStatus.enabled ? 'rgba(16, 185, 129, 0.12)' : 'rgba(234, 88, 12, 0.12)',
              color: twoFactorStatus.enabled ? 'var(--accent-emerald)' : 'var(--accent-amber)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Smartphone size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)' }}>
                  Two-Factor Authentication (Google Authenticator)
                </h3>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: '800',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '12px',
                  background: twoFactorStatus.enabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(234, 88, 12, 0.15)',
                  color: twoFactorStatus.enabled ? 'var(--accent-emerald)' : 'var(--accent-amber)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}>
                  {twoFactorStatus.enabled ? 'Active (Protected)' : 'Not Configured'}
                </span>
              </div>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {twoFactorStatus.enabled
                  ? 'Your administrative login is protected by 6-digit Time-Based OTPs and single-use emergency recovery codes.'
                  : 'Protect the newsroom admin desk against stolen credentials and phishing by pairing your Google Authenticator app.'}
              </p>
            </div>
          </div>

          <div>
            {!twoFactorStatus.enabled ? (
              <button
                onClick={handleStart2faSetup}
                disabled={setupLoading}
                className="btn btn-primary"
                type="button"
                style={{
                  padding: '0.55rem 1.15rem',
                  fontSize: '0.85rem',
                  fontWeight: '800',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  background: 'var(--brand-navy)',
                  color: '#FFFFFF',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: setupLoading ? 'not-allowed' : 'pointer'
                }}
              >
                <Smartphone size={16} />
                <span>{setupLoading ? 'Generating QR...' : 'Set Up Google Authenticator'}</span>
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: '4px',
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.8rem',
                  color: 'var(--text-main)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem'
                }}>
                  <Key size={14} style={{ color: 'var(--accent-amber)' }} />
                  <span>Emergency Recovery Codes: <strong>{twoFactorStatus.remainingRecoveryCodes} of 10 remaining</strong></span>
                </div>
              </div>
            )}
          </div>
        </div>

        {twoFactorStatus.enabled && (
          <div style={{
            fontSize: '0.75rem',
            color: 'var(--text-subtle)',
            background: 'var(--bg-secondary)',
            padding: '0.6rem 0.85rem',
            borderRadius: '4px',
            border: '1px dashed var(--border-medium)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem'
          }}>
            <span>
              <strong>Account Protection:</strong> In-app 2FA reset is permanently disabled to prevent unauthorized account takeover. If all recovery codes are exhausted or phone is replaced, emergency restoration can only be performed offline by the system owner.
            </span>
          </div>
        )}
      </div>

      {/* 2. Pending Journalist Applications (Action Required) */}
      <div style={{
        background: 'var(--bg-surface)',
        border: pendingStaff.length > 0 ? '1.5px solid var(--accent-amber)' : '1px solid var(--border-medium)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{
          padding: '0.85rem 1.25rem',
          background: pendingStaff.length > 0 ? 'rgba(180, 83, 9, 0.08)' : 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={18} style={{ color: pendingStaff.length > 0 ? 'var(--accent-amber)' : 'var(--accent-emerald)' }} />
            <span style={{ fontWeight: '900', fontSize: '0.95rem', color: 'var(--text-main)' }}>
              Pending Journalist Applications
            </span>
            <span style={{
              background: pendingStaff.length > 0 ? 'var(--accent-amber)' : 'var(--border-medium)',
              color: '#FFFFFF',
              fontSize: '0.75rem',
              fontWeight: '800',
              padding: '0.15rem 0.55rem',
              borderRadius: '12px'
            }}>
              {pendingStaff.length} Action{pendingStaff.length === 1 ? '' : 's'} Required
            </span>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', fontWeight: '600' }}>
            Pre-verified via 5-min Gmail Security Passcode (OTP)
          </span>
        </div>

        <div style={{ padding: '1rem 1.25rem' }}>
          {pendingStaff.length === 0 ? (
            <div style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              <CheckCircle2 size={32} style={{ color: 'var(--accent-emerald)', margin: '0 auto 0.5rem auto', display: 'block' }} />
              <strong>All journalist applications have been reviewed.</strong> No pending approvals right now.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {pendingStaff.map(applicant => (
                <div
                  key={applicant.id}
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: '900', fontSize: '1rem', color: 'var(--text-main)' }}>
                          {applicant.name}
                        </span>
                        <span style={{
                          background: 'rgba(16, 185, 129, 0.12)',
                          color: 'var(--accent-emerald)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          fontSize: '0.7rem',
                          fontWeight: '800',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}>
                          <Check size={12} /> Email Verified
                        </span>
                        <span style={{
                          background: 'rgba(99, 102, 241, 0.12)',
                          color: 'var(--accent-indigo)',
                          fontSize: '0.7rem',
                          fontWeight: '800',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          textTransform: 'uppercase'
                        }}>
                          Requested: {applicant.role || 'reporter'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.35rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Mail size={13} /> {applicant.email}
                        </span>
                        {applicant.phone && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            <Phone size={13} /> {applicant.phone}
                          </span>
                        )}
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Calendar size={13} /> Applied: {applicant.createdAt ? new Date(applicant.createdAt).toLocaleDateString() : 'Recent'}
                        </span>
                      </div>
                    </div>

                    {/* Action Approval Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => handleApprove(applicant.id, 'editor')}
                        disabled={actionLoading === `approve_${applicant.id}`}
                        type="button"
                        style={{
                          background: 'var(--accent-indigo)',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0.5rem 0.85rem',
                          fontSize: '0.8rem',
                          fontWeight: '800',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          minHeight: '38px'
                        }}
                      >
                        <ShieldCheck size={14} />
                        <span>Approve as Editor</span>
                      </button>

                      <button
                        onClick={() => handleApprove(applicant.id, 'reporter')}
                        disabled={actionLoading === `approve_${applicant.id}`}
                        type="button"
                        style={{
                          background: 'var(--accent-emerald)',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0.5rem 0.85rem',
                          fontSize: '0.8rem',
                          fontWeight: '800',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          minHeight: '38px'
                        }}
                      >
                        <UserCheck size={14} />
                        <span>Approve as Reporter</span>
                      </button>

                      <button
                        onClick={() => handleDelete(applicant.id, applicant.name)}
                        disabled={actionLoading === `delete_${applicant.id}`}
                        type="button"
                        style={{
                          background: 'transparent',
                          color: 'var(--accent-crimson)',
                          border: '1px solid rgba(220, 38, 38, 0.4)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0.5rem 0.75rem',
                          fontSize: '0.8rem',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          minHeight: '38px'
                        }}
                      >
                        <X size={14} />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. Newsroom Team Directory & Access Control Table */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-medium)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)'
      }}>
        {/* Table Filters & Search */}
        <div style={{
          padding: '1rem 1.25rem',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '900', color: 'var(--text-main)' }}>
              Official Newsroom Directory & Role Permissions ({filteredStaff.length})
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
              Instant RBAC Role Propagation & Security Controls
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', flex: '1 1 240px' }}>
              <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)' }} />
              <input
                type="text"
                placeholder="Search staff by name, email, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem 0.5rem 2.2rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-medium)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-main)',
                  fontSize: '0.825rem',
                  boxBox: 'border-box'
                }}
              />
            </div>

            {/* Filter Pills */}
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: 'All Members' },
                { id: 'admin', label: 'Admins' },
                { id: 'editor', label: 'Editors' },
                { id: 'reporter', label: 'Reporters' },
                { id: 'pending', label: `Pending (${pendingStaff.length})` },
                { id: 'suspended', label: 'Suspended' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setRoleFilter(tab.id)}
                  type="button"
                  style={{
                    padding: '0.45rem 0.75rem',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid',
                    borderColor: roleFilter === tab.id ? 'var(--accent-indigo)' : 'var(--border-medium)',
                    background: roleFilter === tab.id ? 'var(--accent-indigo)' : 'var(--bg-secondary)',
                    color: roleFilter === tab.id ? '#FFFFFF' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Desktop Directory Table (critic defect 3 fix: hidden on <= 768px screens) */}
        <div className="staff-desktop-table-view" style={{ overflowX: 'auto', width: '100%' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'auto' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-medium)' }}>
                <th style={{ padding: '0.7rem 0.65rem', fontSize: '0.725rem', fontWeight: '800', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>Staff Member</th>
                <th style={{ padding: '0.7rem 0.65rem', fontSize: '0.725rem', fontWeight: '800', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>Access Role</th>
                <th style={{ padding: '0.7rem 0.65rem', fontSize: '0.725rem', fontWeight: '800', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '0.7rem 0.65rem', fontSize: '0.725rem', fontWeight: '800', color: 'var(--text-subtle)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Joined</th>
                <th style={{ padding: '0.7rem 0.65rem', fontSize: '0.725rem', fontWeight: '800', color: 'var(--text-subtle)', textTransform: 'uppercase', textAlign: 'right' }}>Security Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No newsroom staff members match your search criteria.
                  </td>
                </tr>
              ) : (
                filteredStaff.map(staff => {
                  const isPrimaryAdmin = staff.email === 'admin@publicspark.in';
                  return (
                    <tr key={staff.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      {/* Name & Contact */}
                      <td style={{ padding: '0.75rem 0.65rem', maxWidth: '240px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: staff.role === 'admin' ? 'var(--accent-crimson)' : (staff.role === 'editor' ? 'var(--accent-indigo)' : 'var(--accent-emerald)'),
                            color: '#FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: '900',
                            fontSize: '0.8rem',
                            flexShrink: 0
                          }}>
                            {staff.name ? staff.name.charAt(0).toUpperCase() : 'S'}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: '800', color: 'var(--text-main)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem' }}>
                              <span>{staff.name}</span>
                              {isPrimaryAdmin && (
                                <span style={{ fontSize: '0.625rem', background: 'var(--accent-crimson)', color: '#FFF', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: '800', whiteSpace: 'nowrap' }}>
                                  MASTER ADMIN
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '0.1rem', wordBreak: 'break-word' }}>
                              {staff.email}
                              {staff.phone ? ` • ${staff.phone}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role Selector Dropdown */}
                      <td style={{ padding: '0.75rem 0.65rem' }}>
                        {isPrimaryAdmin ? (
                          <span style={{ fontWeight: '800', color: 'var(--accent-crimson)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                            Executive Super Admin
                          </span>
                        ) : (
                          <select
                            value={staff.role}
                            onChange={(e) => handleRoleSelectChange(staff, e.target.value)}
                            disabled={actionLoading === `role_${staff.id}` || staff.status === 'pending_approval'}
                            style={{
                              padding: '0.35rem 0.5rem',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border-medium)',
                              background: 'var(--bg-secondary)',
                              color: 'var(--text-main)',
                              fontWeight: '700',
                              fontSize: '0.775rem',
                              cursor: 'pointer',
                              maxWidth: '175px'
                            }}
                          >
                            <option value="reporter">Field Reporter (Writer)</option>
                            <option value="editor">Desk Editor (Publisher)</option>
                            <option value="admin">Newsroom Administrator</option>
                          </select>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: '800',
                          background: staff.status === 'active'
                            ? 'rgba(16, 185, 129, 0.12)'
                            : (staff.status === 'suspended' ? 'rgba(220, 38, 38, 0.12)' : 'rgba(234, 88, 12, 0.12)'),
                          color: staff.status === 'active'
                            ? 'var(--accent-emerald)'
                            : (staff.status === 'suspended' ? 'var(--accent-crimson)' : 'var(--accent-amber)')
                        }}>
                          <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: staff.status === 'active'
                              ? 'var(--accent-emerald)'
                              : (staff.status === 'suspended' ? 'var(--accent-crimson)' : 'var(--accent-amber)')
                          }} />
                          {staff.status === 'active' ? 'Active' : (staff.status === 'suspended' ? 'Suspended' : 'Pending Approval')}
                        </span>
                      </td>

                      {/* Joined Date */}
                      <td style={{ padding: '0.75rem 0.65rem', fontSize: '0.75rem', color: 'var(--text-subtle)', whiteSpace: 'nowrap' }}>
                        {staff.createdAt ? new Date(staff.createdAt).toLocaleDateString() : 'Initial Setup'}
                      </td>

                      {/* Security Actions */}
                      <td style={{ padding: '0.75rem 0.65rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '0.35rem' }}>
                          {/* Reset Password Button */}
                          <button
                            onClick={() => {
                              setResetModalStaff(staff);
                              setNewPassword('');
                              setResetErrorMsg('');
                              setResetSuccessMsg('');
                            }}
                            type="button"
                            title="Reset Staff Password"
                            style={{
                              padding: '0.35rem 0.55rem',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border-medium)',
                              background: 'var(--bg-secondary)',
                              color: 'var(--text-main)',
                              cursor: 'pointer',
                              fontSize: '0.725rem',
                              fontWeight: '700',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              whiteSpace: 'nowrap',
                              minHeight: '32px'
                            }}
                          >
                            <KeyRound size={12} />
                            <span>Reset Pass</span>
                          </button>

                          {/* Change Email (Admin email strictly Developer-only) */}
                          {(currentRole === 'developer' || staff.role !== 'admin') && (
                            <button
                              onClick={() => {
                                setEmailModalStaff(staff);
                                setNewEmailInput(staff.email);
                                setEmailErrorMsg('');
                                setEmailSuccessMsg('');
                              }}
                              type="button"
                              title="Change Staff Email"
                              style={{
                                padding: '0.35rem 0.55rem',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--border-medium)',
                                background: 'var(--bg-secondary)',
                                color: 'var(--text-main)',
                                cursor: 'pointer',
                                fontSize: '0.725rem',
                                fontWeight: '700',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                whiteSpace: 'nowrap',
                                minHeight: '32px'
                              }}
                            >
                              <Mail size={12} />
                              <span>Change Email</span>
                            </button>
                          )}

                          {/* Toggle Suspend / Active */}
                          {!isPrimaryAdmin && staff.status !== 'pending_approval' && (
                            <button
                              onClick={() => handleToggleStatus(staff.id, staff.status)}
                              disabled={actionLoading === `status_${staff.id}`}
                              type="button"
                              title={staff.status === 'active' ? 'Suspend Account' : 'Reactivate Account'}
                              style={{
                                padding: '0.35rem 0.55rem',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid',
                                borderColor: staff.status === 'active' ? 'rgba(220, 38, 38, 0.4)' : 'rgba(16, 185, 129, 0.4)',
                                background: 'transparent',
                                color: staff.status === 'active' ? 'var(--accent-crimson)' : 'var(--accent-emerald)',
                                cursor: 'pointer',
                                fontSize: '0.725rem',
                                fontWeight: '700',
                                whiteSpace: 'nowrap',
                                minHeight: '32px'
                              }}
                            >
                              {staff.status === 'active' ? 'Suspend' : 'Activate'}
                            </button>
                          )}

                          {/* Delete Staff Member */}
                          {!isPrimaryAdmin && (
                            <button
                              onClick={() => handleDelete(staff.id, staff.name)}
                              disabled={actionLoading === `delete_${staff.id}`}
                              type="button"
                              title="Delete Staff Record"
                              style={{
                                padding: '0.35rem 0.5rem',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid rgba(220, 38, 38, 0.3)',
                                background: 'transparent',
                                color: 'var(--accent-crimson)',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minWidth: '32px',
                                minHeight: '32px'
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Directory Cards (critic defect 3 fix: rendered on screens <= 768px, zero horizontal scrolling) */}
        <div className="staff-mobile-cards-view" style={{ padding: '0.85rem', flexDirection: 'column', gap: '0.85rem' }}>
          {filteredStaff.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No newsroom staff members match your search criteria.
            </div>
          ) : (
            filteredStaff.map(staff => {
              const isPrimaryAdmin = staff.email === 'admin@publicspark.in';
              return (
                <div
                  key={`mobile_${staff.id}`}
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.85rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}
                >
                  {/* Top: Avatar, Name, Email, Status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: staff.role === 'admin' ? 'var(--accent-crimson)' : (staff.role === 'editor' ? 'var(--accent-indigo)' : 'var(--accent-emerald)'),
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '900',
                        fontSize: '0.85rem',
                        flexShrink: 0
                      }}>
                        {staff.name ? staff.name.charAt(0).toUpperCase() : 'S'}
                      </div>
                      <div>
                        <div style={{ fontWeight: '800', color: 'var(--text-main)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                          {staff.name}
                          {isPrimaryAdmin && (
                            <span style={{ fontSize: '0.62rem', background: 'var(--accent-crimson)', color: '#FFF', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: '800' }}>
                              MASTER ADMIN
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {staff.email}
                          {staff.phone ? ` • ${staff.phone}` : ''}
                        </div>
                      </div>
                    </div>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '12px',
                      fontSize: '0.72rem',
                      fontWeight: '800',
                      background: staff.status === 'active'
                        ? 'rgba(16, 185, 129, 0.12)'
                        : (staff.status === 'suspended' ? 'rgba(220, 38, 38, 0.12)' : 'rgba(234, 88, 12, 0.12)'),
                      color: staff.status === 'active'
                        ? 'var(--accent-emerald)'
                        : (staff.status === 'suspended' ? 'var(--accent-crimson)' : 'var(--accent-amber)')
                    }}>
                      <span style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: staff.status === 'active'
                          ? 'var(--accent-emerald)'
                          : (staff.status === 'suspended' ? 'var(--accent-crimson)' : 'var(--accent-amber)')
                      }} />
                      {staff.status === 'active' ? 'Active' : (staff.status === 'suspended' ? 'Suspended' : 'Pending')}
                    </span>
                  </div>

                  {/* Middle: Role Selector & Joined Date */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', paddingTop: '0.4rem', borderTop: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                      Joined: {staff.createdAt ? new Date(staff.createdAt).toLocaleDateString() : 'Initial'}
                    </div>
                    <div style={{ minWidth: '150px' }}>
                      {isPrimaryAdmin ? (
                        <span style={{ fontWeight: '800', color: 'var(--accent-crimson)', fontSize: '0.8rem' }}>
                          Executive Super Admin
                        </span>
                      ) : (
                        <select
                          value={staff.role}
                          onChange={(e) => handleRoleSelectChange(staff, e.target.value)}
                          disabled={actionLoading === `role_${staff.id}` || staff.status === 'pending_approval'}
                          style={{
                            width: '100%',
                            padding: '0.4rem 0.55rem',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-medium)',
                            background: 'var(--bg-surface)',
                            color: 'var(--text-main)',
                            fontWeight: '700',
                            fontSize: '0.8rem',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="reporter">Field Reporter (Writer)</option>
                          <option value="editor">Desk Editor (Publisher)</option>
                          <option value="admin">Newsroom Administrator</option>
                        </select>
                      )}
                    </div>
                  </div>

                  {/* Bottom: Action Buttons */}
                  <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', justifyContent: 'flex-end', paddingTop: '0.4rem', borderTop: '1px solid var(--border-light)' }}>
                    <button
                      onClick={() => {
                        setResetModalStaff(staff);
                        setNewPassword('');
                        setResetErrorMsg('');
                        setResetSuccessMsg('');
                      }}
                      type="button"
                      title="Reset Staff Password"
                      style={{
                        padding: '0.4rem 0.65rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-medium)',
                        background: 'var(--bg-surface)',
                        color: 'var(--text-main)',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        minHeight: '36px'
                      }}
                    >
                      <KeyRound size={13} />
                      <span>Reset Pass</span>
                    </button>

                    {(currentRole === 'developer' || staff.role !== 'admin') && (
                      <button
                        onClick={() => {
                          setEmailModalStaff(staff);
                          setNewEmailInput(staff.email);
                          setEmailErrorMsg('');
                          setEmailSuccessMsg('');
                        }}
                        type="button"
                        title="Change Staff Email"
                        style={{
                          padding: '0.4rem 0.65rem',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-medium)',
                          background: 'var(--bg-surface)',
                          color: 'var(--text-main)',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          minHeight: '36px'
                        }}
                      >
                        <Mail size={13} />
                        <span>Change Email</span>
                      </button>
                    )}

                    {!isPrimaryAdmin && staff.status !== 'pending_approval' && (
                      <button
                        onClick={() => handleToggleStatus(staff.id, staff.status)}
                        disabled={actionLoading === `status_${staff.id}`}
                        type="button"
                        style={{
                          padding: '0.4rem 0.65rem',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid',
                          borderColor: staff.status === 'active' ? 'rgba(220, 38, 38, 0.4)' : 'rgba(16, 185, 129, 0.4)',
                          background: 'transparent',
                          color: staff.status === 'active' ? 'var(--accent-crimson)' : 'var(--accent-emerald)',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          minHeight: '36px'
                        }}
                      >
                        {staff.status === 'active' ? 'Suspend' : 'Activate'}
                      </button>
                    )}

                    {!isPrimaryAdmin && (
                      <button
                        onClick={() => handleDelete(staff.id, staff.name)}
                        disabled={actionLoading === `delete_${staff.id}`}
                        type="button"
                        style={{
                          padding: '0.4rem 0.65rem',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid rgba(220, 38, 38, 0.3)',
                          background: 'transparent',
                          color: 'var(--accent-crimson)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          minHeight: '36px'
                        }}
                      >
                        <Trash2 size={13} />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 4. Password Reset Modal */}
      {resetModalStaff && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setResetModalStaff(null);
          }}
        >
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-md)',
            padding: '1.5rem',
            width: '100%',
            maxWidth: '440px',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <KeyRound size={20} style={{ color: 'var(--accent-crimson)' }} />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '900', color: 'var(--text-main)' }}>
                  Admin Password Reset
                </h3>
              </div>
              <button
                onClick={() => setResetModalStaff(null)}
                type="button"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Set a new secure password or temporary passcode for <strong>{resetModalStaff.name}</strong> ({resetModalStaff.email}).
            </p>

            {resetErrorMsg && (
              <div style={{ background: 'rgba(220, 38, 38, 0.1)', color: 'var(--accent-crimson)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', fontWeight: '700', marginBottom: '1rem' }}>
                {resetErrorMsg}
              </div>
            )}

            {resetSuccessMsg && (
              <div style={{ background: 'rgba(16, 185, 129, 0.12)', color: 'var(--accent-emerald)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={16} /> {resetSuccessMsg}
              </div>
            )}

            <form onSubmit={handleAdminResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                  New Password (Minimum 6 Characters)
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)' }} />
                  <input
                    type="text"
                    required
                    name="ps_admin_reset_credential"
                    autoComplete="new-password"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    data-credential="true"
                    placeholder="Enter new password (e.g. Reporter@2026)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem 0.6rem 2.2rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-medium)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-main)',
                      fontSize: '0.875rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setResetModalStaff(null)}
                  style={{
                    padding: '0.55rem 1rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-medium)',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontWeight: '700',
                    fontSize: '0.85rem'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'reset_submitting'}
                  style={{
                    padding: '0.55rem 1.25rem',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: 'var(--accent-crimson)',
                    color: '#FFFFFF',
                    cursor: 'pointer',
                    fontWeight: '800',
                    fontSize: '0.85rem'
                  }}
                >
                  {actionLoading === 'reset_submitting' ? 'Updating...' : 'Save New Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4B. Change Staff Email Modal */}
      {emailModalStaff && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setEmailModalStaff(null);
          }}
        >
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-md)',
            padding: '1.5rem',
            width: '100%',
            maxWidth: '440px',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Mail size={20} style={{ color: 'var(--accent-crimson)' }} />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '900', color: 'var(--text-main)' }}>
                  Change Account Email
                </h3>
              </div>
              <button
                onClick={() => setEmailModalStaff(null)}
                type="button"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', minWidth: '32px', minHeight: '32px' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Update login email for <strong>{emailModalStaff.name}</strong> ({emailModalStaff.role.toUpperCase()}). Current email: <strong>{emailModalStaff.email}</strong>.
            </p>

            {emailErrorMsg && (
              <div style={{ background: 'rgba(220, 38, 38, 0.1)', color: 'var(--accent-crimson)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', fontWeight: '700', marginBottom: '1rem' }}>
                {emailErrorMsg}
              </div>
            )}

            {emailSuccessMsg && (
              <div style={{ background: 'rgba(16, 185, 129, 0.12)', color: 'var(--accent-emerald)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={16} /> {emailSuccessMsg}
              </div>
            )}

            <form onSubmit={handleUpdateStaffEmail} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                  New Email Address (Gmail)
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)' }} />
                  <input
                    type="email"
                    required
                    placeholder="Enter new Gmail address"
                    value={newEmailInput}
                    onChange={(e) => setNewEmailInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem 0.6rem 2.2rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-medium)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-main)',
                      fontSize: '1rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setEmailModalStaff(null)}
                  style={{
                    padding: '0.55rem 1rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-medium)',
                    background: 'transparent',
                    color: 'var(--text-main)',
                    cursor: 'pointer',
                    fontWeight: '700',
                    fontSize: '0.85rem',
                    minHeight: '44px'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'email_submitting'}
                  style={{
                    padding: '0.55rem 1.25rem',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: 'var(--accent-crimson)',
                    color: '#FFFFFF',
                    cursor: 'pointer',
                    fontWeight: '800',
                    fontSize: '0.85rem',
                    minHeight: '44px'
                  }}
                >
                  {actionLoading === 'email_submitting' ? 'Saving...' : 'Save New Email'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Security Confirmation Modal for Newsroom Administrator Promotion */}
      {adminEscalationTarget && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(4px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setAdminEscalationTarget(null);
          }}
        >
          <div style={{
            background: 'var(--bg-surface)',
            border: '2px solid var(--accent-crimson)',
            borderRadius: 'var(--radius-md)',
            padding: '1.5rem',
            width: '100%',
            maxWidth: '490px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            boxSizing: 'border-box'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem', marginBottom: '1rem' }}>
              <div style={{
                background: 'rgba(220, 38, 38, 0.12)',
                color: 'var(--accent-crimson)',
                padding: '0.65rem',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <ShieldAlert size={28} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.15rem', fontWeight: '900', color: 'var(--text-main)' }}>
                  Confirm Administrator Promotion
                </h3>
                <span style={{ fontSize: '0.725rem', fontWeight: '900', color: 'var(--accent-crimson)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Critical Security Confirmation Notice
                </span>
              </div>
              <button
                onClick={() => setAdminEscalationTarget(null)}
                type="button"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.85rem',
              marginBottom: '1rem',
              fontSize: '0.85rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--text-subtle)' }}>Target Member:</span>
                <span style={{ fontWeight: '800', color: 'var(--text-main)' }}>{adminEscalationTarget.staff.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--text-subtle)' }}>Email:</span>
                <span style={{ fontWeight: '700', color: 'var(--text-muted)' }}>{adminEscalationTarget.staff.email}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-subtle)' }}>Role Escalation:</span>
                <span style={{ fontWeight: '900', color: 'var(--accent-crimson)' }}>
                  {String(adminEscalationTarget.previousRole || 'reporter').toUpperCase()} → NEWSROOM ADMINISTRATOR
                </span>
              </div>
            </div>

            <div style={{
              background: 'rgba(220, 38, 38, 0.08)',
              border: '1px solid rgba(220, 38, 38, 0.3)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.85rem',
              marginBottom: '1.25rem',
              fontSize: '0.825rem',
              color: 'var(--text-main)',
              lineHeight: 1.5
            }}>
              <strong style={{ color: 'var(--accent-crimson)' }}>High Authority Warning:</strong> You are about to grant this staff member sovereign control over the PublicSpark Newsroom. Administrators have the power to:
              <ul style={{ margin: '0.4rem 0 0 1.1rem', padding: 0, color: 'var(--text-muted)' }}>
                <li>Edit, unpublish, or permanently delete any live article</li>
                <li>Alter editorial taxonomy, statutory grievance dockets, and brand theme</li>
                <li>Manage commercial ad slots, sponsor rates, and campaign archives</li>
                <li>Approve, promote, suspend, or reset credentials of other staff</li>
              </ul>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setAdminEscalationTarget(null)}
                style={{
                  padding: '0.55rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-medium)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-main)',
                  fontWeight: '700',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  minHeight: '40px'
                }}
              >
                Cancel (Keep as {adminEscalationTarget.previousRole})
              </button>
              <button
                type="button"
                onClick={() => executeRoleChange(adminEscalationTarget.staff.id, 'admin')}
                disabled={actionLoading === `role_${adminEscalationTarget.staff.id}`}
                style={{
                  padding: '0.55rem 1.25rem',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: 'var(--accent-crimson)',
                  color: '#FFFFFF',
                  fontWeight: '900',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  minHeight: '40px'
                }}
              >
                <ShieldCheck size={16} />
                <span>{actionLoading === `role_${adminEscalationTarget.staff.id}` ? 'Granting...' : 'Yes, Make Administrator'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2FA Setup Pairing Modal (RFC 6238 TOTP + 10 Recovery Codes) */}
      {setupModalOpen && setupData && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            zIndex: 12000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSetupModalOpen(false);
          }}
        >
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
            {/* Header */}
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
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '900', color: 'var(--text-main)', fontFamily: 'var(--font-headline, Georgia, serif)' }}>
                    Pair Google Authenticator
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Time-Based One-Time Password Protection
                  </p>
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
              <div style={{ fontSize: '0.75rem', fontWeight: '900', textTransform: 'uppercase', color: 'var(--brand-navy, var(--accent-indigo))', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                Step 1: Scan QR Code with Authenticator App
              </div>
              <p style={{ margin: '0 0 0.85rem 0', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Open Google Authenticator (or any standard TOTP app) on your smartphone, tap <strong>"+"</strong> and scan the code below:
              </p>

              <div style={{
                display: 'flex',
                gap: '1rem',
                alignItems: 'center',
                flexWrap: 'wrap',
                background: 'var(--bg-secondary)',
                padding: '1rem',
                borderRadius: '6px',
                border: '1px solid var(--border-medium)'
              }}>
                {/* QR Code SVG */}
                <div
                  style={{
                    background: '#FFFFFF',
                    padding: '8px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-medium)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 'clamp(140px, 38vw, 180px)',
                    height: 'clamp(140px, 38vw, 180px)',
                    maxWidth: '100%',
                    flexShrink: 0
                  }}
                  dangerouslySetInnerHTML={{ __html: setupData.qrSvg }}
                />

                {/* Manual Secret Key Fallback with Masking */}
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-subtle)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                    Cannot scan? Enter setup key manually:
                  </div>
                  <div style={{
                    background: 'var(--bg-surface)',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '4px',
                    border: '1px solid var(--border-medium)',
                    fontFamily: 'monospace',
                    fontSize: '0.9rem',
                    fontWeight: '800',
                    color: 'var(--text-main)',
                    letterSpacing: showSecretKey ? '0.08em' : '0.2em',
                    wordBreak: 'break-all',
                    marginBottom: '0.5rem',
                    userSelect: showSecretKey ? 'all' : 'none'
                  }}>
                    {showSecretKey ? setupData.secret : '•••• •••• •••• •••• •••• •••• •••• ••••'}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setShowSecretKey(!showSecretKey)}
                      style={{
                        padding: '0.4rem 0.75rem',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-medium)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        color: 'var(--text-main)'
                      }}
                      title={showSecretKey ? 'Mask Secret Key' : 'Reveal Secret Key'}
                    >
                      {showSecretKey ? <EyeOff size={13} /> : <Eye size={13} />}
                      <span>{showSecretKey ? 'Mask Key' : 'Reveal Key'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCopySecret}
                      style={{
                        padding: '0.4rem 0.75rem',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-medium)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        color: 'var(--text-main)'
                      }}
                    >
                      <Copy size={13} />
                      <span>{copiedSecret ? 'Copied to Clipboard!' : 'Copy Setup Key'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* STEP 2: Emergency Recovery Codes */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '900', textTransform: 'uppercase', color: 'var(--accent-amber)', letterSpacing: '0.05em' }}>
                  Step 2: Save Emergency Recovery Codes (Mandatory)
                </div>
                <div style={{ display: 'flex', gap: '0.45rem' }}>
                  <button
                    type="button"
                    onClick={handleDownloadRecoveryCodes}
                    style={{
                      padding: '0.35rem 0.65rem',
                      fontSize: '0.75rem',
                      fontWeight: '800',
                      background: 'var(--accent-amber)',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <Download size={13} />
                    <span>Download (.txt)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyCodes}
                    style={{
                      padding: '0.35rem 0.65rem',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-main)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <Copy size={13} />
                    <span>{copiedCodes ? 'Copied!' : 'Copy All'}</span>
                  </button>
                </div>
              </div>

              <p style={{ margin: '0 0 0.65rem 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                If your phone is lost, stolen, or broken, each of these 10 one-time recovery codes can unlock your account once:
              </p>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                gap: '0.4rem',
                background: 'var(--bg-secondary)',
                padding: '0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border-medium)'
              }}>
                {setupData.recoveryCodes.map((code, idx) => (
                  <div
                    key={idx}
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '0.85rem',
                      fontWeight: '800',
                      padding: '0.3rem 0.5rem',
                      background: 'var(--bg-surface)',
                      borderRadius: '4px',
                      border: '1px solid var(--border-light)',
                      textAlign: 'center',
                      color: 'var(--text-main)'
                    }}
                  >
                    {code}
                  </div>
                ))}
              </div>
            </div>

            {/* STEP 3: Confirm with 6-digit Authenticator Code */}
            <form onSubmit={handleConfirm2fa} style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: '900', textTransform: 'uppercase', color: 'var(--accent-emerald)', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                Step 3: Enter 6-Digit Code from Authenticator
              </div>
              <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Enter the active 6-digit code showing in your phone app to verify pairing:
              </p>

              <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  maxLength={6}
                  inputMode="numeric"
                  value={setupConfirmCode}
                  onChange={(e) => setSetupConfirmCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  required
                  style={{
                    padding: '0.65rem',
                    fontSize: '1.4rem',
                    fontWeight: '900',
                    fontFamily: 'monospace',
                    letterSpacing: '0.3em',
                    textAlign: 'center',
                    width: '160px',
                    border: '2px solid var(--border-medium)',
                    borderRadius: '4px',
                    boxSizing: 'border-box',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-main)'
                  }}
                />

                <button
                  type="submit"
                  disabled={setupLoading || setupConfirmCode.length !== 6}
                  style={{
                    flex: 1,
                    minHeight: '46px',
                    padding: '0.65rem 1.25rem',
                    borderRadius: '4px',
                    border: 'none',
                    background: (setupLoading || setupConfirmCode.length !== 6) ? 'var(--text-subtle)' : 'var(--accent-emerald)',
                    color: '#FFFFFF',
                    fontSize: '0.9rem',
                    fontWeight: '800',
                    cursor: (setupLoading || setupConfirmCode.length !== 6) ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <CheckCircle2 size={16} />
                  <span>{setupLoading ? 'Verifying Code...' : 'Confirm & Activate 2FA'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

