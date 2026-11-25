import React, { useState, useEffect, useCallback } from 'react';
import {
  EyeOff, ShieldCheck, Search, RefreshCw, FileText, Trash2,
  ExternalLink, X, Clock, MapPin, Building2, CheckCircle2, AlertCircle
} from 'lucide-react';
import { getAuthHeaders } from '../../services/authClient';

const CATEGORY_LABELS = {
  corruption: 'Corruption / Bribery',
  crime: 'Crime Report',
  scam: 'Scam / Fraud',
  public_issue: 'Public Issue',
  other: 'Other Confidential'
};

const STATUS_LABELS = {
  pending_review: 'Pending Review',
  under_investigation: 'Under Investigation',
  verified_published: 'Verified & Published',
  dismissed: 'Dismissed / Closed'
};

/**
 * Admin-Only Confidential Whistleblower & News Tip Investigation Desk (Task 43 Subtopic C)
 * Strictly restricted to Admin & Developer roles.
 */
export default function ConfidentialTipsDesk({ onShowToast, onConvertTipToDraft }) {
  const [tips, setTips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Inspect & Update Modal State
  const [selectedTip, setSelectedTip] = useState(null);
  const [editStatus, setEditStatus] = useState('pending_review');
  const [editNote, setEditNote] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchTips = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/tips', {
        headers: { ...getAuthHeaders() }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTips(Array.isArray(data.tips) ? data.tips : []);
      } else {
        onShowToast?.(data.error || 'Failed to load confidential tips.', 'error');
      }
    } catch (_err) {
      onShowToast?.('Network error loading confidential tips.', 'error');
    } finally {
      setLoading(false);
    }
  }, [onShowToast]);

  useEffect(() => {
    fetchTips();
  }, [fetchTips]);

  const handleOpenInspect = (tip) => {
    setSelectedTip(tip);
    setEditStatus(tip.status || 'pending_review');
    setEditNote(tip.editorialNote || '');
  };

  const handleSaveStatus = async (e) => {
    e.preventDefault();
    if (!selectedTip) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/tips/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          id: selectedTip.id,
          status: editStatus,
          editorialNote: editNote.trim()
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTips(prev => prev.map(t => (t.id === selectedTip.id ? data.tip : t)));
        setSelectedTip(data.tip);
        onShowToast?.('Tip investigation status updated.', 'success');
      } else {
        onShowToast?.(data.error || 'Failed to update tip status.', 'error');
      }
    } catch (_err) {
      onShowToast?.('Network error updating tip.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTip = async (tip) => {
    if (!window.confirm(`Delete confidential tip ${tip.trackingId}? This cannot be undone.`)) return;
    try {
      const res = await fetch('/api/admin/tips/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ id: tip.id })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTips(prev => prev.filter(t => t.id !== tip.id));
        if (selectedTip?.id === tip.id) setSelectedTip(null);
        onShowToast?.(`Tip ${tip.trackingId} deleted.`, 'success');
      } else {
        onShowToast?.(data.error || 'Failed to delete tip.', 'error');
      }
    } catch (_err) {
      onShowToast?.('Network error deleting tip.', 'error');
    }
  };

  const handleConvertClick = async (tip) => {
    try {
      await fetch('/api/admin/tips/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          id: tip.id,
          status: 'under_investigation',
          editorialNote: tip.editorialNote || 'Converted to draft story for editorial verification.'
        })
      });
      setTips(prev => prev.map(t => (t.id === tip.id ? { ...t, status: 'under_investigation' } : t)));
    } catch (_err) {
      // Non-blocking status sync
    }
    onConvertTipToDraft?.(tip);
  };

  const filteredTips = tips.filter(tip => {
    const matchesStatus = statusFilter === 'all' || tip.status === statusFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery = !q ||
      String(tip.trackingId || '').toLowerCase().includes(q) ||
      String(tip.title || '').toLowerCase().includes(q) ||
      String(tip.location || '').toLowerCase().includes(q) ||
      String(tip.involvedEntities || '').toLowerCase().includes(q) ||
      String(tip.details || '').toLowerCase().includes(q);
    return matchesStatus && matchesQuery;
  });

  const stats = {
    total: tips.length,
    pending: tips.filter(t => t.status === 'pending_review').length,
    investigating: tips.filter(t => t.status === 'under_investigation').length,
    published: tips.filter(t => t.status === 'verified_published').length
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header Card */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-medium)',
        borderTop: '4px solid var(--accent-crimson)',
        borderRadius: 'var(--radius-md)',
        padding: '1.25rem 1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
          <EyeOff size={24} color="var(--accent-crimson)" style={{ flexShrink: 0 }} />
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '900', color: 'var(--text-main)' }}>
              Admin-Only Confidential Tips Desk (Gupt Suchna)
            </h2>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.825rem', color: 'var(--text-subtle)' }}>
              Zero-trace whistleblower submissions. Strictly restricted to Executive Super Admin &amp; Developer.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={fetchTips}
          disabled={loading}
          className="btn btn-outline"
          style={{ minHeight: '44px', padding: '0.5rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: '700' }}
        >
          <RefreshCw size={15} className={loading ? 'spin-animation' : ''} />
          <span>{loading ? 'Refreshing...' : 'Refresh Desk'}</span>
        </button>
      </div>

      {/* 4 KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.85rem' }}>
        {[
          { label: 'Total Tips Received', val: stats.total, accent: false },
          { label: 'Pending Review', val: stats.pending, accent: true },
          { label: 'Under Investigation', val: stats.investigating, accent: true },
          { label: 'Verified & Published', val: stats.published, accent: false }
        ].map((kpi) => (
          <div
            key={kpi.label}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-sm)',
              padding: '1rem',
              minWidth: 0
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>
              {kpi.label}
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: '900', color: kpi.accent ? 'var(--accent-crimson)' : 'var(--text-main)', marginTop: '0.25rem' }}>
              {kpi.val}
            </div>
          </div>
        ))}
      </div>

      {/* Search & Status Filters */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-medium)',
        borderRadius: 'var(--radius-md)',
        padding: '1rem 1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 240px' }}>
            <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)' }} />
            <input
              type="text"
              placeholder="Search by Tracking ID, title, location, or details..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem 0.55rem 2.2rem',
                fontSize: '1rem',
                borderRadius: '4px',
                border: '1px solid var(--border-medium)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-main)',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'All' },
              { id: 'pending_review', label: 'Pending' },
              { id: 'under_investigation', label: 'Investigating' },
              { id: 'verified_published', label: 'Published' },
              { id: 'dismissed', label: 'Dismissed' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                style={{
                  padding: '0.45rem 0.85rem',
                  minHeight: '36px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-medium)',
                  background: statusFilter === tab.id ? 'var(--accent-crimson)' : 'var(--bg-secondary)',
                  color: statusFilter === tab.id ? '#ffffff' : 'var(--text-main)',
                  fontSize: '0.775rem',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tips List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-subtle)', background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)' }}>
            Loading confidential tips...
          </div>
        ) : filteredTips.length === 0 ? (
          <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-subtle)', background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)' }}>
            <ShieldCheck size={32} color="var(--accent-crimson)" style={{ marginBottom: '0.5rem' }} />
            <div style={{ fontWeight: '800', color: 'var(--text-main)' }}>No confidential tips match this filter.</div>
            <div style={{ fontSize: '0.825rem', marginTop: '0.25rem' }}>Incoming public whistleblower tips will appear here securely.</div>
          </div>
        ) : (
          filteredTips.map(tip => (
            <div
              key={tip.id}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                borderLeft: '4px solid var(--accent-crimson)',
                borderRadius: 'var(--radius-sm)',
                padding: '1rem 1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: '900', fontSize: '0.85rem', color: 'var(--accent-crimson)', background: 'var(--bg-secondary)', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
                    {tip.trackingId}
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-main)', border: '1px solid var(--border-medium)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                    {CATEGORY_LABELS[tip.category] || tip.category}
                  </span>
                </div>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: '800',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '4px',
                  background: tip.status === 'pending_review' || tip.status === 'under_investigation' ? 'var(--accent-crimson)' : 'var(--text-main)',
                  color: '#ffffff'
                }}>
                  {STATUS_LABELS[tip.status] || tip.status}
                </span>
              </div>

              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '900', color: 'var(--text-main)', wordBreak: 'break-word' }}>
                {tip.title}
              </h3>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 1rem', fontSize: '0.8rem', color: 'var(--text-subtle)' }}>
                {tip.location && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <MapPin size={13} /> {tip.location}
                  </span>
                )}
                {tip.incidentDate && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Clock size={13} /> {tip.incidentDate}
                  </span>
                )}
                {tip.involvedEntities && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Building2 size={13} /> {tip.involvedEntities}
                  </span>
                )}
                <span>Contact: <strong>{tip.optionalContact || 'Anonymous (Gupt)'}</strong></span>
              </div>

              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: '1.6', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {tip.details.length > 260 ? `${tip.details.slice(0, 260)}...` : tip.details}
              </p>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                  Submitted: {new Date(tip.submittedAt).toLocaleString()}
                </span>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => handleOpenInspect(tip)}
                    style={{
                      padding: '0.45rem 0.85rem',
                      minHeight: '36px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-medium)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-main)',
                      fontSize: '0.8rem',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Inspect &amp; Update Status
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConvertClick(tip)}
                    style={{
                      padding: '0.45rem 0.85rem',
                      minHeight: '36px',
                      borderRadius: '4px',
                      border: 'none',
                      background: 'var(--accent-crimson)',
                      color: '#ffffff',
                      fontSize: '0.8rem',
                      fontWeight: '800',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <FileText size={14} />
                    <span>Convert to Draft Story</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteTip(tip)}
                    aria-label={`Delete ${tip.trackingId}`}
                    style={{
                      padding: '0.45rem 0.65rem',
                      minHeight: '36px',
                      minWidth: '36px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-medium)',
                      background: 'transparent',
                      color: 'var(--accent-crimson)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Inspect & Investigation Modal */}
      {selectedTip && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.72)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.75rem'
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedTip(null); }}
        >
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-dark)',
            borderTop: '4px solid var(--accent-crimson)',
            borderRadius: '4px',
            width: '100%',
            maxWidth: '660px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
              <div>
                <span style={{ fontFamily: 'monospace', fontWeight: '900', color: 'var(--accent-crimson)', fontSize: '0.9rem' }}>
                  {selectedTip.trackingId}
                </span>
                <h3 style={{ margin: '0.2rem 0 0 0', fontSize: '1.1rem', fontWeight: '900', color: 'var(--text-main)' }}>
                  {selectedTip.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTip(null)}
                style={{ background: 'none', border: '1px solid var(--border-medium)', borderRadius: '4px', minWidth: '44px', minHeight: '44px', cursor: 'pointer', color: 'var(--text-main)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '0.85rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '4px', fontSize: '0.875rem', lineHeight: '1.7', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text-main)' }}>
              {selectedTip.details}
            </div>

            {selectedTip.evidenceUrl && (
              <div style={{ fontSize: '0.85rem' }}>
                <strong>Evidence Link: </strong>
                <a href={selectedTip.evidenceUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-crimson)', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', wordBreak: 'break-all' }}>
                  <span>{selectedTip.evidenceUrl}</span>
                  <ExternalLink size={13} />
                </a>
              </div>
            )}

            <form onSubmit={handleSaveStatus} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '800', marginBottom: '0.35rem', color: 'var(--text-main)' }}>
                  Investigation Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', fontSize: '1rem', borderRadius: '4px', border: '1px solid var(--border-medium)', background: 'var(--bg-secondary)', color: 'var(--text-main)' }}
                >
                  <option value="pending_review">Pending Review</option>
                  <option value="under_investigation">Under Investigation</option>
                  <option value="verified_published">Verified &amp; Published</option>
                  <option value="dismissed">Dismissed / Closed</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '800', marginBottom: '0.35rem', color: 'var(--text-main)' }}>
                  Public Status Note (Visible to whistleblower when checking Tracking ID)
                </label>
                <textarea
                  rows={3}
                  maxLength={1000}
                  placeholder="e.g. हमारी संपादकीय टीम दस्तावेजों की जांच कर रही है..."
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', fontSize: '1rem', borderRadius: '4px', border: '1px solid var(--border-medium)', background: 'var(--bg-secondary)', color: 'var(--text-main)', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => handleConvertClick(selectedTip)}
                  style={{ padding: '0.6rem 1rem', minHeight: '44px', borderRadius: '4px', border: '1px solid var(--border-medium)', background: 'var(--bg-secondary)', color: 'var(--text-main)', fontWeight: '700', cursor: 'pointer' }}
                >
                  Convert to Draft Story
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ padding: '0.6rem 1.25rem', minHeight: '44px', borderRadius: '4px', border: 'none', background: 'var(--accent-crimson)', color: '#ffffff', fontWeight: '800', cursor: saving ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <CheckCircle2 size={15} />
                  <span>{saving ? 'Saving...' : 'Save Status'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

