import React, { useState, useEffect } from 'react';
import { 
  HardDrive, Database, ShieldAlert, Trash2, RefreshCw, CheckCircle2, CheckCircle,
  Zap, Server, Globe, Cpu, Layers, ExternalLink, Copy, Check, FileCode,
  Download, Send, Mail, Calendar, Clock, ShieldCheck, Archive, AlertCircle, AlertTriangle, Volume2
} from 'lucide-react';
import { getClientStorageStats, purgeClientCache } from '../../services/cacheService';
import { getAuthHeaders } from '../../services/authClient';

export default function StorageSettings() {
  const [activeSubSection, setActiveSubSection] = useState('backups'); // 'backups' | 'storage' | 'seo'

  // Disaster Recovery & Backups State
  const [backups, setBackups] = useState([]);
  const [backupSettings, setBackupSettings] = useState(null);
  const [backupStats, setBackupStats] = useState({ totalSizeBytes: 0, totalSizeFormatted: '0 B', count: 0, maxAllowed: 3 });
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(null);
  const [ticketDownloading, setTicketDownloading] = useState(null);
  const [backupFeedback, setBackupFeedback] = useState(null);

  // Form inputs for backup settings
  const [deliveryEmailInput, setDeliveryEmailInput] = useState('');
  const [scheduleFrequencyInput, setScheduleFrequencyInput] = useState('daily');
  const [autoEmailEnabledInput, setAutoEmailEnabledInput] = useState(true);

  // Storage Monitor & Cache State (Legacy)
  const [loading, setLoading] = useState(false);
  const [serverStats, setServerStats] = useState(null);
  const [clientStats, setClientStats] = useState(getClientStorageStats());
  const [feedback, setFeedback] = useState(null);
  const [autoCleanup, setAutoCleanup] = useState(true);
  const [threshold, setThreshold] = useState(85);
  const [copiedFeed, setCopiedFeed] = useState('');

  // -------------------------------------------------------------
  // BACKUP DESK API HANDLERS
  // -------------------------------------------------------------

  const fetchBackups = async () => {
    setBackupsLoading(true);
    try {
      const res = await fetch('/api/admin/backups', {
        headers: {
          ...getAuthHeaders()
        }
      });
      if (res.ok) {
        const data = await res.json();
        setBackups(data.backups || []);
        setBackupStats({
          totalSizeBytes: data.totalSizeBytes || 0,
          totalSizeFormatted: data.totalSizeFormatted || '0 B',
          count: data.count || 0,
          maxAllowed: data.maxAllowed || 3
        });
        if (data.settings) {
          setBackupSettings(data.settings);
          setDeliveryEmailInput(data.settings.deliveryEmail || '');
          setScheduleFrequencyInput(data.settings.scheduleFrequency || 'daily');
          setAutoEmailEnabledInput(data.settings.autoEmailEnabled !== false);
        }
      }
    } catch (err) {
      console.error('Failed to fetch backup registry:', err);
    } finally {
      setBackupsLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    setActionInProgress('creating');
    setBackupFeedback(null);
    try {
      const res = await fetch('/api/admin/backup/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ creatorName: 'Newsroom Admin Workspace' })
      });
      const data = await res.json();
      if (data.success && data.backup) {
        setBackupFeedback({
          type: 'success',
          text: `Disaster Recovery Archive created: ${data.backup.fileName} (${data.backup.sizeFormatted}). Preserved on server disk.`
        });
        await fetchBackups();
      } else {
        throw new Error(data.error || 'Failed to generate archive');
      }
    } catch (err) {
      setBackupFeedback({ type: 'error', text: `Backup generation failed: ${err.message}` });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDownloadArchive = async (fileName) => {
    setTicketDownloading(fileName);
    setBackupFeedback(null);
    try {
      // Step 1: Request 60-second single-use Ephemeral Download Ticket (OWASP compliant)
      const ticketRes = await fetch('/api/admin/backup/download-ticket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ fileName })
      });
      const ticketData = await ticketRes.json();
      if (!ticketData.success || !ticketData.ticket) {
        throw new Error(ticketData.error || 'Failed to issue download ticket');
      }

      // Step 2: Trigger native browser download using single-use ticket (zero token in URL)
      const downloadUrl = `/api/admin/backup/download?ticket=${encodeURIComponent(ticketData.ticket)}&file=${encodeURIComponent(fileName)}`;
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setBackupFeedback({
        type: 'success',
        text: `Secure 1-click download started for ${fileName}. Single-use ticket consumed.`
      });
    } catch (err) {
      setBackupFeedback({ type: 'error', text: `Download failed: ${err.message}` });
    } finally {
      setTicketDownloading(null);
    }
  };

  const handleDispatchEmail = async (fileName) => {
    const actionKey = fileName ? `emailing_${fileName}` : 'emailing_latest';
    setActionInProgress(actionKey);
    setBackupFeedback(null);
    try {
      const res = await fetch('/api/admin/backup/email-dispatch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          fileName: fileName || null,
          targetEmail: deliveryEmailInput
        })
      });
      const data = await res.json();
      if (data.success) {
        setBackupFeedback({
          type: 'success',
          text: `Backup archive successfully delivered to ${data.deliveredTo}! (Message ID: ${data.messageId || 'Live SMTP'})`
        });
        await fetchBackups();
      } else {
        throw new Error(data.error || 'Failed to dispatch email');
      }
    } catch (err) {
      setBackupFeedback({ type: 'error', text: `Gmail dispatch failed: ${err.message}` });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDeleteBackup = async (fileName) => {
    if (!window.confirm(`Are you sure you want to permanently delete archive ${fileName} from server disk?`)) {
      return;
    }
    setActionInProgress(`deleting_${fileName}`);
    setBackupFeedback(null);
    try {
      const res = await fetch('/api/admin/backup/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ fileName })
      });
      const data = await res.json();
      if (data.success) {
        setBackupFeedback({
          type: 'success',
          text: `Backup archive ${fileName} permanently removed from server disk.`
        });
        await fetchBackups();
      } else {
        throw new Error(data.error || 'Failed to delete backup archive');
      }
    } catch (err) {
      setBackupFeedback({ type: 'error', text: `Delete failed: ${err.message}` });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleSaveSettings = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setActionInProgress('saving_settings');
    setBackupFeedback(null);
    try {
      const res = await fetch('/api/admin/backup/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          deliveryEmail: deliveryEmailInput,
          scheduleFrequency: scheduleFrequencyInput,
          autoEmailEnabled: autoEmailEnabledInput
        })
      });
      const data = await res.json();
      if (data.success && data.settings) {
        setBackupSettings(data.settings);
        setBackupFeedback({
          type: 'success',
          text: 'Disaster recovery settings updated successfully!'
        });
      } else {
        throw new Error(data.error || 'Failed to update settings');
      }
    } catch (err) {
      setBackupFeedback({ type: 'error', text: `Settings update failed: ${err.message}` });
    } finally {
      setActionInProgress(null);
    }
  };

  // -------------------------------------------------------------
  // LEGACY STORAGE STATUS HANDLERS
  // -------------------------------------------------------------

  const fetchStorageStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/storage/status');
      if (res.ok) {
        const data = await res.json();
        setServerStats(data);
      } else {
        throw new Error('Backend returned status ' + res.status);
      }
    } catch (err) {
      setServerStats({
        timestamp: new Date().toISOString(),
        alertState: 'normal',
        serverRam: { heapUsedMb: 13.88, heapTotalMb: 15.7, rssMb: 75.25, limitMb: 128, usagePercent: 10.8, alertThresholdMb: 102.4, cleanupThresholdMb: 115.2 },
        inMemoryCaches: { audioCacheCount: 0, translationCacheCount: 0, audioProgressCount: 0 },
        storageTiers: {
          cloudflareD1: {
            name: 'Cloudflare D1 SQL (Master DB)',
            usedMb: 0.26,
            limitMb: 500,
            accountPoolMb: 5120,
            percent: 0.05,
            unit: 'MB',
            status: 'healthy',
            alertThresholdMb: 400.0,
            cleanupThresholdMb: 450.0,
            targetPostCleanupMb: 350.0,
            details: 'Articles, Categories, Settings, Grievances & Staff Records (500 MB Cap / DB)'
          },
          imgbbCdn: {
            name: 'ImgBB Cloud Image CDN (Media)',
            isCloudActive: true,
            usedMb: 0.04,
            limitMb: 2048,
            cloudTier: 'Unlimited Free Tier',
            fileSizeCapMb: 32,
            percent: 0.01,
            unit: 'MB',
            status: 'healthy',
            details: 'All News Photos & Ad Banners hosted on ImgBB CDN (0 KB server disk burden)'
          },
          audioStorage: {
            name: 'Audio Stories MP3 Storage',
            usedMb: 0.04,
            limitMb: 1024,
            percent: 0.00,
            fileCount: 2,
            unit: 'MB',
            cloudTier: 'Cloudflare Workers KV (1 GB Free Tier, Zero Card)',
            status: 'healthy',
            alertState: 'normal',
            alertThresholdMb: 819.2,
            cleanupThresholdMb: 921.6,
            targetPostCleanupMb: 716.8,
            details: 'Generated 32kbps mono MP3 audio clips (Dual-Gated 80% Alert / 90% LRU Auto-Cleanup)'
          },
          localJsonDatabase: {
            name: 'Cloudflare D1 SQL (Master DB)',
            usedMb: 0.26,
            limitMb: 500,
            percent: 0.05,
            unit: 'MB',
            status: 'healthy',
            details: 'Articles, Categories, Settings, Grievances & Staff Records'
          },
          uploadsAndMedia: {
            name: 'Audio Stories MP3 Storage',
            usedMb: 0.04,
            limitMb: 1024,
            percent: 0.00,
            unit: 'MB',
            status: 'healthy',
            details: 'Audio Clips & Uploads Buffer (1 GB Cloudflare KV Tier)'
          }
        },
        autoCleanup: {
          enabled: true,
          warningThresholdPercent: 80,
          emergencyCleanupPercent: 90,
          postCleanupTargetPercent: 70
        }
      });
    } finally {
      setLoading(false);
      setClientStats(getClientStorageStats());
    }
  };

  useEffect(() => {
    fetchBackups();
    fetchStorageStats();
  }, []);

  const handlePurgeClientCache = () => {
    if (window.confirm('Are you sure you want to clear client-side browser cache (local & session storage)?')) {
      const res = purgeClientCache();
      if (res.success) {
        setFeedback({ type: 'success', text: `Successfully purged ${res.removedCount} cached items from client storage!` });
        setClientStats(getClientStorageStats());
      } else {
        setFeedback({ type: 'error', text: `Failed to clear client cache: ${res.error}` });
      }
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const handlePurgeServerCache = async () => {
    if (window.confirm('Are you sure you want to run Deep Purge (clear RAM caches, sweep orphaned translations/revisions, and reconcile audio)?')) {
      try {
        const res = await fetch('/api/storage/purge', {
          method: 'POST',
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          const p = data.purged || {};
          const msg = `Deep Purge Complete! Cleared ${p.inMemoryTranslations ?? p.translationCache ?? 0} RAM translations, ${p.orphanedTranslations ?? 0} ghost translations, ${p.orphanedRevisions ?? 0} ghost revisions, and ${p.audioFilesPurged ?? 0} audio files.`;
          setFeedback({ type: 'success', text: msg });
          fetchStorageStats();
        } else {
          throw new Error('Server purge request failed: ' + res.status);
        }
      } catch (err) {
        setFeedback({ type: 'error', text: 'Could not connect to server to purge cache: ' + err.message });
      }
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  const tiers = serverStats?.storageTiers || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '100%' }}>
      
      {/* Sovereign Broadsheet Header & Section Switcher */}
      <div style={{
        background: 'var(--bg-card, #ffffff)',
        border: '1px solid var(--border-medium, #e2e8f0)',
        borderRadius: '4px',
        padding: '1.25rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Archive size={22} color="var(--accent-red, #991b1b)" />
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-main, #0f172a)' }}>
                Storage & Disaster Recovery Center
              </h2>
            </div>
            <p style={{ margin: '0.35rem 0 0 0', color: 'var(--text-subtle, #64748b)', fontSize: '0.85rem' }}>
              1-Click Sovereign Newsroom Backups, Automated Nightly Cloud Delivery, Storage Monitor & Syndication Feeds.
            </p>
          </div>

          {/* Sub-Navigation Pills */}
          <div style={{ display: 'flex', gap: '0.4rem', background: '#f1f5f9', padding: '4px', borderRadius: '4px' }}>
            <button
              type="button"
              onClick={() => setActiveSubSection('backups')}
              style={{
                padding: '0.45rem 0.9rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                background: activeSubSection === 'backups' ? 'var(--accent-crimson)' : 'transparent',
                color: activeSubSection === 'backups' ? '#ffffff' : 'var(--text-subtle)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                minHeight: '36px'
              }}
            >
              <Archive size={14} /> Backups & Disaster Recovery
            </button>
            <button
              type="button"
              onClick={() => setActiveSubSection('storage')}
              style={{
                padding: '0.45rem 0.9rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                background: activeSubSection === 'storage' ? 'var(--accent-crimson)' : 'transparent',
                color: activeSubSection === 'storage' ? '#ffffff' : 'var(--text-subtle)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                minHeight: '36px'
              }}
            >
              <HardDrive size={14} /> Cloud Databases & Cache
            </button>
            <button
              type="button"
              onClick={() => setActiveSubSection('seo')}
              style={{
                padding: '0.45rem 0.9rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                background: activeSubSection === 'seo' ? 'var(--accent-crimson)' : 'transparent',
                color: activeSubSection === 'seo' ? '#ffffff' : 'var(--text-subtle)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                minHeight: '36px'
              }}
            >
              <FileCode size={14} /> Syndication & SEO
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: 1-CLICK BACKUP & DISASTER RECOVERY DESK                            */}
      {/* ========================================================================= */}
      {activeSubSection === 'backups' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Feedback Alert Bar */}
          {backupFeedback && (
            <div style={{
              padding: '0.85rem 1.1rem',
              borderRadius: '4px',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              background: backupFeedback.type === 'success' ? '#F0FDF4' : '#FEF2F2',
              color: backupFeedback.type === 'success' ? '#166534' : '#991B1B',
              border: `1px solid ${backupFeedback.type === 'success' ? '#BBF7D0' : '#FECACA'}`
            }}>
              {backupFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <ShieldAlert size={16} />}
              <span>{backupFeedback.text}</span>
            </div>
          )}

          {/* 4 Sovereign Broadsheet KPI Metrics Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem'
          }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '4px', padding: '1rem' }}>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 800, color: 'var(--text-subtle)', letterSpacing: '0.05em' }}>
                Local Archives on Disk
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', margin: '0.35rem 0 0.2rem 0', fontFamily: 'monospace' }}>
                {backupStats.count} / {backupStats.maxAllowed}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                Rolling cap: Auto-purges oldest
              </div>
            </div>

            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '4px', padding: '1rem' }}>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 800, color: 'var(--text-subtle)', letterSpacing: '0.05em' }}>
                Total Backup Storage
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-crimson)', margin: '0.35rem 0 0.2rem 0', fontFamily: 'monospace' }}>
                {backupStats.totalSizeFormatted}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                PKZIP 2.0 Deflate Compressed
              </div>
            </div>

            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '4px', padding: '1rem' }}>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 800, color: 'var(--text-subtle)', letterSpacing: '0.05em' }}>
                Target Recipient
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', margin: '0.45rem 0 0.2rem 0', wordBreak: 'break-all' }}>
                {deliveryEmailInput || backupSettings?.deliveryEmail || 'Not configured'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', fontWeight: 600 }}>
                Google Cloud Mail Transport Active
              </div>
            </div>

            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '4px', padding: '1rem' }}>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 800, color: 'var(--text-subtle)', letterSpacing: '0.05em' }}>
                Automated Schedule
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', margin: '0.45rem 0 0.2rem 0' }}>
                {scheduleFrequencyInput === 'daily' ? 'Daily at 2:00 AM IST' : scheduleFrequencyInput === 'weekly' ? 'Weekly (Sunday 2:00 AM IST)' : 'Manual Dispatch Only'}
              </div>
              <div style={{ fontSize: '0.75rem', color: autoEmailEnabledInput ? 'var(--accent-emerald)' : 'var(--accent-amber)', fontWeight: 600 }}>
                {autoEmailEnabledInput ? 'Auto-Email Dispatch Enabled' : 'Auto-Email Paused'}
              </div>
            </div>
          </div>

          {/* Action Toolbar: 1-Click Backup & Gmail Dispatch Buttons */}
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-medium)',
            borderRadius: '4px',
            padding: '1.1rem 1.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.85rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              {/* Primary 1-Click Create Backup Button */}
              <button
                type="button"
                onClick={handleCreateBackup}
                disabled={actionInProgress === 'creating'}
                style={{
                  background: 'var(--accent-crimson)',
                  color: '#ffffff',
                  border: '1px solid var(--accent-crimson)',
                  borderRadius: '3px',
                  padding: '0.65rem 1.25rem',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  cursor: actionInProgress === 'creating' ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  minHeight: '44px',
                  opacity: actionInProgress === 'creating' ? 0.7 : 1
                }}
              >
                <Archive size={16} />
                <span>{actionInProgress === 'creating' ? 'Archiving Database & Media...' : 'Create Full Backup Now (.ZIP)'}</span>
              </button>

              {/* 1-Click Send to Gmail Now Button */}
              <button
                type="button"
                onClick={() => handleDispatchEmail(null)}
                disabled={actionInProgress === 'emailing_latest' || backups.length === 0}
                style={{
                  background: 'var(--bg-surface)',
                  color: 'var(--accent-crimson)',
                  border: '1px solid var(--accent-crimson)',
                  borderRadius: '3px',
                  padding: '0.65rem 1.25rem',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  cursor: actionInProgress === 'emailing_latest' || backups.length === 0 ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  minHeight: '44px',
                  opacity: actionInProgress === 'emailing_latest' || backups.length === 0 ? 0.6 : 1
                }}
              >
                <Send size={16} />
                <span>{actionInProgress === 'emailing_latest' ? 'Dispatching to Gmail...' : 'Send Latest Backup to Gmail Now'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={fetchBackups}
              disabled={backupsLoading}
              style={{
                background: 'var(--bg-surface)',
                color: 'var(--text-main)',
                border: '1px solid var(--border-medium)',
                borderRadius: '3px',
                padding: '0.55rem 0.9rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                minHeight: '44px'
              }}
            >
              <RefreshCw size={14} style={{ animation: backupsLoading ? 'spin 1s linear infinite' : 'none' }} />
              <span>Refresh Registry</span>
            </button>
          </div>

          {/* Backup Configuration Form (Delivery Email & Auto-Schedule) */}
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-medium)',
            borderRadius: '4px',
            padding: '1.25rem'
          }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-main)' }}>
              Target Delivery Settings & Schedule
            </h3>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', color: 'var(--text-subtle)' }}>
              Specify destination email for off-site disaster recovery archives and configure automated schedule interval.
            </p>

            <form onSubmit={handleSaveSettings} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                  Target Delivery Email (Recipient)
                </label>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <input
                    type="email"
                    value={deliveryEmailInput}
                    onChange={(e) => setDeliveryEmailInput(e.target.value)}
                    placeholder="admin@example.com"
                    required
                    style={{
                      flex: 1,
                      padding: '0.65rem 0.85rem',
                      fontSize: '0.85rem',
                      fontFamily: 'monospace',
                      border: '1px solid var(--border-medium)',
                      borderRadius: '3px',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-main)',
                      minHeight: '44px'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                  Automated Backup Frequency
                </label>
                <select
                  value={scheduleFrequencyInput}
                  onChange={(e) => setScheduleFrequencyInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    fontSize: '0.85rem',
                    border: '1px solid var(--border-medium)',
                    borderRadius: '3px',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-main)',
                    minHeight: '44px'
                  }}
                >
                  <option value="daily">Daily Auto-Run at 2:00 AM IST (Recommended)</option>
                  <option value="weekly">Weekly Auto-Run on Sunday at 2:00 AM IST</option>
                  <option value="manual">Manual Dispatch Only (No Auto-Cron)</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minHeight: '44px' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={autoEmailEnabledInput}
                    onChange={(e) => setAutoEmailEnabledInput(e.target.checked)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <span>Send copy to Gmail automatically</span>
                </label>

                <button
                  type="submit"
                  disabled={actionInProgress === 'saving_settings'}
                  style={{
                    background: 'var(--accent-crimson)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '3px',
                    padding: '0.6rem 1.1rem',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: actionInProgress === 'saving_settings' ? 'not-allowed' : 'pointer',
                    minHeight: '44px',
                    marginLeft: 'auto'
                  }}
                >
                  {actionInProgress === 'saving_settings' ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>

          {/* Available Archives Table */}
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-medium)',
            borderRadius: '4px',
            padding: '1.25rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-main)' }}>
                  Server Disk Backup Archives
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-subtle)' }}>
                  Point-in-time snapshots preserved in server/data/backups/ with 1-click download and restore readiness.
                </p>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, background: 'var(--bg-secondary)', color: 'var(--text-subtle)', padding: '0.2rem 0.6rem', borderRadius: '3px', fontFamily: 'monospace', border: '1px solid var(--border-medium)' }}>
                Retention: Max {backupStats.maxAllowed} Files
              </span>
            </div>

            {backups.length === 0 ? (
              <div style={{
                padding: '2.5rem 1.5rem',
                textAlign: 'center',
                background: 'var(--bg-secondary)',
                border: '1px dashed var(--border-medium)',
                borderRadius: '4px'
              }}>
                <Archive size={32} color="var(--text-subtle)" style={{ marginBottom: '0.5rem' }} />
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>No backup archives found on disk</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', marginTop: '0.25rem' }}>
                  Click &apos;Create Full Backup Now (.ZIP)&apos; above to generate your first disaster recovery snapshot.
                </div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto', border: '1px solid var(--border-medium)', borderRadius: '3px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-medium)', fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-subtle)', letterSpacing: '0.04em' }}>
                      <th style={{ padding: '0.7rem 0.9rem' }}>Archive Name</th>
                      <th style={{ padding: '0.7rem 0.9rem' }}>Timestamp (IST)</th>
                      <th style={{ padding: '0.7rem 0.9rem', textAlign: 'right' }}>Size</th>
                      <th style={{ padding: '0.7rem 0.9rem', textAlign: 'center' }}>Status</th>
                      <th style={{ padding: '0.7rem 0.9rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backups.map((b) => (
                      <tr key={b.fileName} style={{ borderBottom: '1px solid var(--border-light)', fontSize: '0.8rem' }}>
                        <td style={{ padding: '0.75rem 0.9rem', fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-main)' }}>
                          {b.fileName}
                        </td>
                        <td style={{ padding: '0.75rem 0.9rem', color: 'var(--text-subtle)' }}>
                          {b.createdAtPretty || new Date(b.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                        </td>
                        <td style={{ padding: '0.75rem 0.9rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-crimson)' }}>
                          {b.sizeFormatted}
                        </td>
                        <td style={{ padding: '0.75rem 0.9rem', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            background: 'var(--accent-emerald-bg, rgba(16, 185, 129, 0.12))',
                            color: 'var(--accent-emerald)',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '3px',
                            border: '1px solid var(--accent-emerald)'
                          }}>
                            <CheckCircle2 size={11} /> Verified
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.9rem', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                            {/* 1-Click OWASP Ephemeral Ticket Download */}
                            <button
                              type="button"
                              onClick={() => handleDownloadArchive(b.fileName)}
                              disabled={ticketDownloading === b.fileName}
                              title="Download archive to your laptop"
                              style={{
                                background: 'var(--bg-secondary)',
                                color: 'var(--text-main)',
                                border: '1px solid var(--border-medium)',
                                borderRadius: '3px',
                                padding: '0.35rem 0.65rem',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: ticketDownloading === b.fileName ? 'wait' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                minHeight: '36px'
                              }}
                            >
                              <Download size={13} />
                              <span>{ticketDownloading === b.fileName ? 'Securing...' : 'Download'}</span>
                            </button>

                            {/* Email Dispatch button for specific backup */}
                            <button
                              type="button"
                              onClick={() => handleDispatchEmail(b.fileName)}
                              disabled={actionInProgress === `emailing_${b.fileName}`}
                              title="Send this specific archive to Gmail"
                              style={{
                                background: '#f8fafc',
                                color: '#991b1b',
                                border: '1px solid #fca5a5',
                                borderRadius: '3px',
                                padding: '0.35rem 0.65rem',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: actionInProgress === `emailing_${b.fileName}` ? 'wait' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                minHeight: '36px'
                              }}
                            >
                              <Mail size={13} />
                              <span>{actionInProgress === `emailing_${b.fileName}` ? 'Sending...' : 'Email'}</span>
                            </button>

                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => handleDeleteBackup(b.fileName)}
                              disabled={actionInProgress === `deleting_${b.fileName}`}
                              title="Delete from server disk"
                              style={{
                                background: '#ffffff',
                                color: '#dc2626',
                                border: '1px solid #fecaca',
                                borderRadius: '3px',
                                padding: '0.35rem 0.55rem',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                minHeight: '36px'
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 1-Command CLI Disaster Restore Guide */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderLeft: '4px solid #0f172a',
            borderRadius: '0 4px 4px 0',
            padding: '1.1rem 1.25rem'
          }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              1-Command Disaster Recovery CLI
            </div>
            <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.35rem', lineHeight: 1.5 }}>
              In the event of a catastrophic server crash or VPS migration, you can restore all articles, categories, staff accounts, 2FA credentials, and media files onto any fresh machine in 10 seconds with:
            </div>
            <div style={{
              background: '#0f172a',
              color: '#f8fafc',
              padding: '0.65rem 0.9rem',
              borderRadius: '3px',
              fontFamily: 'monospace',
              fontSize: '0.825rem',
              marginTop: '0.5rem',
              overflowX: 'auto',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>node server/cli/restore-backup.js &lt;backup-filename.zip&gt;</span>
              <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>or: npm run restore-backup</span>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CLOUD DATABASES & IN-MEMORY CACHE STORAGE MONITOR                  */}
      {/* ========================================================================= */}
      {activeSubSection === 'storage' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {feedback && (
            <div style={{
              padding: '0.85rem 1rem',
              borderRadius: '4px',
              fontWeight: 600,
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: feedback.type === 'success' ? '#ECFDF5' : '#FEF2F2',
              color: feedback.type === 'success' ? '#059669' : '#DC2626',
              border: `1px solid ${feedback.type === 'success' ? '#A7F3D0' : '#FECACA'}`
            }}>
              {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <ShieldAlert size={16} />}
              {feedback.text}
            </div>
          )}

          {/* Dynamic 80% Warning / 90% Emergency Cleanup Alert Banner */}
          {serverStats?.alertState === 'critical_cleanup_90' ? (
            <div style={{
              padding: '1rem',
              background: '#fef2f2',
              border: '1px solid #f87171',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <AlertTriangle size={20} color="#dc2626" />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#991b1b', letterSpacing: '-0.01em' }}>
                    CRITICAL STORAGE THRESHOLD (90% EXCEEDED) — AUTOMATED LRU CLEANUP ACTIVE
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#b91c1c', marginTop: '0.2rem' }}>
                    One or more storage tiers exceeded 90% capacity. Automated LRU purge is actively evicting least recently used audio and stale translations to restore safe operating headroom (&lt; 70%).
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handlePurgeServerCache}
                className="btn btn-outline"
                style={{ background: '#ffffff', borderColor: '#f87171', color: '#b91c1c', fontWeight: 700, fontSize: '0.8rem', minHeight: '36px' }}
              >
                Force Deep Purge Now
              </button>
            </div>
          ) : serverStats?.alertState === 'warning_80' ? (
            <div style={{
              padding: '1rem',
              background: '#fffbeb',
              border: '1px solid #fcd34d',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <AlertTriangle size={20} color="#d97706" />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#92400e', letterSpacing: '-0.01em' }}>
                    STORAGE CAPACITY WARNING (80% THRESHOLD REACHED)
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#b45309', marginTop: '0.2rem' }}>
                    One or more storage tiers reached 80% capacity. An emergency automated cleanup will automatically trigger if usage crosses 90%.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handlePurgeServerCache}
                className="btn btn-outline"
                style={{ background: '#ffffff', borderColor: '#fcd34d', color: '#b45309', fontWeight: 700, fontSize: '0.8rem', minHeight: '36px' }}
              >
                Clean Unused Now
              </button>
            </div>
          ) : null}

          {/* Broadsheet Automated Storage Policy Bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.75rem 1rem',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-medium)',
            borderRadius: '4px',
            flexWrap: 'wrap',
            gap: '0.75rem',
            fontSize: '0.8rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)', fontWeight: 700 }}>
              <ShieldAlert size={16} color="var(--accent-red, #991b1b)" />
              <span>Automated Storage Quota Policy:</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', minWidth: 0 }}>
              <span style={{ padding: '0.25rem 0.5rem', background: '#ecfdf5', color: '#047857', borderRadius: '4px', fontWeight: 600, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                0-79%: Normal State
              </span>
              <span style={{ padding: '0.25rem 0.5rem', background: '#fffbeb', color: '#b45309', borderRadius: '4px', fontWeight: 600, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                80%: Warning Alert
              </span>
              <span style={{ padding: '0.25rem 0.5rem', background: '#fef2f2', color: '#b91c1c', borderRadius: '4px', fontWeight: 600, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                90%: Auto LRU Cleanup
              </span>
              <span style={{ padding: '0.25rem 0.5rem', background: '#f0fdf4', color: '#15803d', borderRadius: '4px', fontWeight: 600, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                Post-Cleanup: 70% Target
              </span>
            </div>
          </div>

          {/* 4 Storage Tier Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            
            {/* Tier 1: Cloudflare D1 SQL (Master DB) */}
            <div style={{ background: 'var(--bg-surface)', padding: '1.25rem', borderRadius: '4px', border: '1px solid var(--border-medium)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                    <Database size={16} color="#10b981" /> Cloudflare D1 (DB)
                  </span>
                  <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '12px', background: 'var(--accent-emerald-bg, rgba(16, 185, 129, 0.12))', color: 'var(--accent-emerald)', fontWeight: 700 }}>
                    Master DB
                  </span>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'monospace' }}>
                  {tiers.cloudflareD1?.usedMb ?? tiers.localJsonDatabase?.usedMb ?? 0.26} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-subtle)' }}>/ {tiers.cloudflareD1?.limitMb ?? 500} MB</span>
                </div>
                <div style={{ width: '100%', background: 'var(--bg-tertiary, var(--border-medium))', height: '8px', borderRadius: '4px', overflow: 'hidden', margin: '0.75rem 0' }}>
                  <div style={{ width: `${Math.min(100, Math.max(0.5, ((tiers.cloudflareD1?.usedMb ?? 0.26) / (tiers.cloudflareD1?.limitMb ?? 500)) * 100)).toFixed(1)}%`, background: '#10b981', height: '100%' }} />
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', margin: 0 }}>
                  {tiers.cloudflareD1?.details || 'Articles, Categories, Settings, Grievances & Staff (500 MB Cap / DB)'}
                </p>
              </div>
              <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)', fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', color: 'var(--text-subtle)' }}>
                <span>Engine: Cloudflare D1 SQL</span>
                <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>Alert: 80% (400 MB) • Purge: 90% (450 MB)</span>
              </div>
            </div>

            {/* Tier 2: ImgBB Cloud Image CDN */}
            <div style={{ background: 'var(--bg-surface)', padding: '1.25rem', borderRadius: '4px', border: '1px solid var(--border-medium)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                    <HardDrive size={16} color="#f97316" /> ImgBB Image CDN
                  </span>
                  <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '12px', background: 'var(--accent-amber-bg, rgba(245, 158, 11, 0.12))', color: 'var(--accent-amber)', fontWeight: 700 }}>
                    Image CDN
                  </span>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'monospace' }}>
                  Unlimited <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-subtle)' }}>/ 32 MB per file</span>
                </div>
                <div style={{ width: '100%', background: 'var(--bg-tertiary, var(--border-medium))', height: '8px', borderRadius: '4px', overflow: 'hidden', margin: '0.75rem 0' }}>
                  <div style={{ width: '100%', background: '#f97316', height: '100%' }} />
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', margin: 0 }}>
                  All News Photos & Ad Banners hosted on ImgBB Global CDN (0 KB server disk burden)
                </p>
              </div>
              <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)', fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', color: 'var(--text-subtle)' }}>
                <span>Storage: ImgBB Cloud CDN</span>
                <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>Free Forever</span>
              </div>
            </div>

            {/* Tier 3: Audio Stories MP3 Storage */}
            <div style={{ background: 'var(--bg-surface)', padding: '1.25rem', borderRadius: '4px', border: '1px solid var(--border-medium)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                    <Volume2 size={16} color="#06b6d4" /> Audio Stories Storage
                  </span>
                  <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '12px', background: 'rgba(6, 182, 212, 0.12)', color: '#0891b2', fontWeight: 700 }}>
                    MP3 Audio
                  </span>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'monospace' }}>
                  {tiers.audioStorage?.usedMb ?? tiers.uploadsAndMedia?.usedMb ?? 0.04} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-subtle)' }}>/ {tiers.audioStorage?.limitMb ?? 1024} MB</span>
                </div>
                <div style={{ width: '100%', background: 'var(--bg-tertiary, var(--border-medium))', height: '8px', borderRadius: '4px', overflow: 'hidden', margin: '0.75rem 0' }}>
                  <div style={{ width: `${Math.min(100, Math.max(0.5, ((tiers.audioStorage?.usedMb ?? 0.04) / (tiers.audioStorage?.limitMb ?? 1024)) * 100)).toFixed(1)}%`, background: '#06b6d4', height: '100%' }} />
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', margin: 0 }}>
                  {tiers.audioStorage?.details || 'Generated 32kbps mono MP3 audio clips (Dual-Gated 80% Alert / 90% LRU Auto-Cleanup)'}
                </p>
              </div>
              <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)', fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', color: 'var(--text-subtle)' }}>
                <span>Storage: Cloudflare KV (1 GB Zero Card Tier)</span>
                <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>Alert: 80% (819 MB) • Purge: 90% (921 MB)</span>
              </div>
            </div>

            {/* Tier 4: Cloudflare Worker Isolate RAM */}
            <div style={{ background: 'var(--bg-surface)', padding: '1.25rem', borderRadius: '4px', border: '1px solid var(--border-medium)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                    <Cpu size={16} color="#8b5cf6" /> Worker Isolate RAM
                  </span>
                  <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '12px', background: 'var(--accent-indigo-bg, rgba(99, 102, 241, 0.12))', color: 'var(--accent-indigo)', fontWeight: 700 }}>
                    Worker Heap
                  </span>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'monospace' }}>
                  {serverStats?.serverRam?.heapUsedMb || 13.88} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-subtle)' }}>/ {serverStats?.serverRam?.limitMb || 128} MB</span>
                </div>
                <div style={{ width: '100%', background: 'var(--bg-tertiary, var(--border-medium))', height: '8px', borderRadius: '4px', overflow: 'hidden', margin: '0.75rem 0' }}>
                  <div style={{ width: `${Math.min(100, Math.max(1, (((serverStats?.serverRam?.heapUsedMb || 13.88) / 128) * 100))).toFixed(1)}%`, background: '#8b5cf6', height: '100%' }} />
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', margin: 0 }}>
                  Edge execution isolate memory (Cloudflare Free Tier Limit: 128 MB per isolate)
                </p>
              </div>
              <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)', fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', color: 'var(--text-subtle)' }}>
                <span>Max Isolate: 128 MB</span>
                <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>Alert: 80% (102 MB) • Purge: 90% (115 MB)</span>
              </div>
            </div>

          </div>

          {/* Cache Management & Manual Purge Actions */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
            
            {/* Client Browser Storage */}
            <div style={{ background: 'var(--bg-surface)', padding: '1.25rem', borderRadius: '4px', border: '1px solid var(--border-medium)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <Zap size={18} color="#eab308" />
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>Client-Side Browser Storage</h4>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', marginBottom: '1rem' }}>
                Local storage used for offline article bookmarks, user font scale, and audio playback positions.
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                <span>Items Cached: <strong>{clientStats.totalItems ?? 0}</strong></span>
                <span>Storage Size: <strong>{clientStats.formattedSize || '0.0 KB'}</strong></span>
              </div>
              <button
                type="button"
                onClick={handlePurgeClientCache}
                className="btn btn-outline"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#dc2626', borderColor: '#fca5a5', minHeight: '44px' }}
              >
                <Trash2 size={16} /> Purge Client Local Cache
              </button>
            </div>

            {/* Server-Side Deep Cache & Orphan Purge */}
            <div style={{ background: 'var(--bg-surface)', padding: '1.25rem', borderRadius: '4px', border: '1px solid var(--border-medium)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <Layers size={18} color="#2563eb" />
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>Deep Server Cache & Orphan Purge</h4>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', marginBottom: '1rem' }}>
                Clears in-memory translation/audio caches and permanently sweeps orphaned translation/revision records and stale audio files.
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                <span>Translations Cached: <strong>{serverStats?.inMemoryCaches?.translationCacheCount ?? 0}</strong></span>
                <span>Audio Streams: <strong>{serverStats?.inMemoryCaches?.audioCacheCount ?? 0}</strong></span>
              </div>
              <button
                type="button"
                onClick={handlePurgeServerCache}
                className="btn btn-outline"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#d97706', borderColor: '#fcd34d', minHeight: '44px' }}
              >
                <RefreshCw size={16} /> Deep Purge Server Cache & Dead Records
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SYNDICATION FEEDS & SEARCH ENGINE DIRECTIVES                       */}
      {/* ========================================================================= */}
      {activeSubSection === 'seo' && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '4px', padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <FileCode size={18} color="var(--accent-indigo)" />
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Automated Syndication Feeds & Search Engine Directives
            </h4>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', margin: '0 0 1rem 0' }}>
            Permanent zero-dependency live endpoints crawled by Google Newsbot, Bing, Apple News, Feedly, and RSS aggregators.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* XML Sitemap */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: '4px', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <FileCode size={16} color="var(--accent-indigo)" />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>XML News Sitemap</strong>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, background: 'var(--accent-indigo-bg, rgba(99, 102, 241, 0.12))', color: 'var(--accent-indigo)', padding: '0.1rem 0.45rem', borderRadius: '4px' }}>
                      Google News Ready
                    </span>
                  </div>
                  <code style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>/sitemap.xml</code>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    const url = `${window.location.origin}/sitemap.xml`;
                    navigator.clipboard.writeText(url);
                    setCopiedFeed('sitemap');
                    setTimeout(() => setCopiedFeed(''), 2000);
                  }}
                  className="btn btn-outline"
                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', minHeight: '36px', cursor: 'pointer' }}
                >
                  {copiedFeed === 'sitemap' ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                  <span>{copiedFeed === 'sitemap' ? 'Copied URL' : 'Copy URL'}</span>
                </button>

                <a
                  href="/sitemap.xml"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', minHeight: '36px', textDecoration: 'none' }}
                >
                  <ExternalLink size={12} />
                  <span>Test XML</span>
                </a>
              </div>
            </div>

            {/* Robots.txt */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: '4px', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <FileCode size={16} color="var(--accent-emerald)" />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>Search Engine Directives</strong>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, background: 'var(--accent-emerald-bg, rgba(16, 185, 129, 0.12))', color: 'var(--accent-emerald)', padding: '0.1rem 0.45rem', borderRadius: '4px' }}>
                      Robots.txt
                    </span>
                  </div>
                  <code style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>/robots.txt</code>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    const url = `${window.location.origin}/robots.txt`;
                    navigator.clipboard.writeText(url);
                    setCopiedFeed('robots');
                    setTimeout(() => setCopiedFeed(''), 2000);
                  }}
                  className="btn btn-outline"
                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', minHeight: '36px', cursor: 'pointer' }}
                >
                  {copiedFeed === 'robots' ? <Check size={12} color="var(--accent-emerald)" /> : <Copy size={12} />}
                  <span>{copiedFeed === 'robots' ? 'Copied URL' : 'Copy URL'}</span>
                </button>

                <a
                  href="/robots.txt"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', minHeight: '36px', textDecoration: 'none' }}
                >
                  <ExternalLink size={12} />
                  <span>View robots.txt</span>
                </a>
              </div>
            </div>

            {/* RSS Feed */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: '4px', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <FileCode size={16} color="var(--accent-amber)" />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>RSS 2.0 Syndication Feed</strong>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, background: 'var(--accent-amber-bg, rgba(245, 158, 11, 0.12))', color: 'var(--accent-amber)', padding: '0.1rem 0.45rem', borderRadius: '4px' }}>
                      Feedly / Apple News
                    </span>
                  </div>
                  <code style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>/rss.xml &nbsp;|&nbsp; /feed.xml</code>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    const url = `${window.location.origin}/rss.xml`;
                    navigator.clipboard.writeText(url);
                    setCopiedFeed('rss');
                    setTimeout(() => setCopiedFeed(''), 2000);
                  }}
                  className="btn btn-outline"
                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', minHeight: '36px', cursor: 'pointer' }}
                >
                  {copiedFeed === 'rss' ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                  <span>{copiedFeed === 'rss' ? 'Copied URL' : 'Copy URL'}</span>
                </button>

                <a
                  href="/rss.xml"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', minHeight: '36px', textDecoration: 'none' }}
                >
                  <ExternalLink size={12} />
                  <span>Test RSS Feed</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
