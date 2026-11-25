import React, { useState, useEffect } from 'react';
import { getAuthHeaders } from '../../services/authClient';
import {
  Scale, ShieldCheck, Clock, AlertTriangle, CheckCircle2,
  XCircle, Search, RefreshCw, FileText, ExternalLink,
  ChevronRight, X, Send, User, Mail, Phone, Calendar, AlertCircle
} from 'lucide-react';

/**
 * PublicSpark Newsroom — Statutory Grievance Review Desk (Task 29 Subtopic B)
 * Official administrative control desk for Level-I Grievance Redressal
 * under Part III, Rule 11 of the Information Technology Rules, 2021 (India).
 */
export default function GrievanceDesk({ onShowToast }) {
  const [grievances, setGrievances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedGrievance, setSelectedGrievance] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Resolution form state for active modal docket
  const [resolutionStatus, setResolutionStatus] = useState('under_review');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolvedBy, setResolvedBy] = useState('Rajesh Sharma (Grievance Officer)');

  const fetchGrievances = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch('/api/grievances', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setGrievances(Array.isArray(data) ? data : (data.grievances || []));
      } else {
        console.error('Failed to fetch grievances:', res.statusText);
      }
    } catch (err) {
      console.error('Error fetching grievances:', err);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchGrievances();
  }, []);

  const handleOpenReview = (grv) => {
    setSelectedGrievance(grv);
    setResolutionStatus(grv.status === 'pending' ? 'under_review' : grv.status);
    setResolutionNotes(grv.resolution_notes || '');
    setResolvedBy(grv.resolved_by || 'Rajesh Sharma (Grievance Officer)');
  };

  const handleCloseReview = () => {
    setSelectedGrievance(null);
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (!selectedGrievance) return;

    setIsUpdating(true);
    try {
      const res = await fetch('/api/grievance/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          id: selectedGrievance.id,
          status: resolutionStatus,
          resolution_notes: resolutionNotes,
          resolved_by: resolvedBy
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (onShowToast) onShowToast(`Grievance ${selectedGrievance.id} updated to ${resolutionStatus.toUpperCase()}`);
        setGrievances(prev => prev.map(g => g.id === selectedGrievance.id ? data.grievance : g));
        setSelectedGrievance(data.grievance);
      } else {
        alert(data.error || 'Failed to update grievance disposition.');
      }
    } catch (err) {
      alert('Network error updating grievance: ' + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  // Helper calculations for statutory urgency metrics
  const now = new Date();
  const totalCount = grievances.length;
  const pendingList = grievances.filter(g => g.status === 'pending');
  const underReviewList = grievances.filter(g => g.status === 'under_review');
  const resolvedList = grievances.filter(g => g.status === 'resolved');
  const rejectedList = grievances.filter(g => g.status === 'rejected');

  // Overdue acknowledgments (pending beyond 24 hours)
  const overdueAckCount = pendingList.filter(g => {
    if (!g.acknowledgment_deadline) return false;
    return new Date(g.acknowledgment_deadline) < now;
  }).length;

  // Filtered grievances list
  const filteredGrievances = grievances.filter(g => {
    const matchesStatus = statusFilter === 'all' || g.status === statusFilter;
    const matchesCat = categoryFilter === 'all' || g.category === categoryFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery = !q ||
      (g.id && g.id.toLowerCase().includes(q)) ||
      (g.complainant_name && g.complainant_name.toLowerCase().includes(q)) ||
      (g.complainant_email && g.complainant_email.toLowerCase().includes(q)) ||
      (g.article_title && g.article_title.toLowerCase().includes(q)) ||
      (g.description && g.description.toLowerCase().includes(q));

    return matchesStatus && matchesCat && matchesQuery;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: '#FEF3C7', color: '#92400E', padding: '0.2rem 0.55rem', borderRadius: '4px', fontSize: '0.725rem', fontWeight: '800', textTransform: 'uppercase' }}>
            <Clock size={12} color="#D97706" /> Pending Action
          </span>
        );
      case 'under_review':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: '#EEF2FF', color: '#3730A3', padding: '0.2rem 0.55rem', borderRadius: '4px', fontSize: '0.725rem', fontWeight: '800', textTransform: 'uppercase' }}>
            <RefreshCw size={12} color="#4F46E5" /> Under Review
          </span>
        );
      case 'resolved':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: '#ECFDF5', color: '#065F46', padding: '0.2rem 0.55rem', borderRadius: '4px', fontSize: '0.725rem', fontWeight: '800', textTransform: 'uppercase' }}>
            <CheckCircle2 size={12} color="#059669" /> Disposed / Resolved
          </span>
        );
      case 'rejected':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: '#F3F4F6', color: '#4B5563', padding: '0.2rem 0.55rem', borderRadius: '4px', fontSize: '0.725rem', fontWeight: '800', textTransform: 'uppercase' }}>
            <XCircle size={12} color="#6B7280" /> Dismissed / Frivolous
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  const getCategoryLabel = (cat) => {
    const map = {
      factual_inaccuracy: 'Factual Inaccuracy',
      defamation: 'Defamation / Reputational Harm',
      privacy_breach: 'Privacy Violation',
      pci_code: 'Press Council Ethics Breach',
      hate_speech: 'Hate Speech / Social Harmony',
      copyright: 'Copyright / Source Attributions',
      other: 'Other Editorial Objection'
    };
    return map[cat] || cat;
  };

  const formatDeadline = (isoString) => {
    if (!isoString) return 'N/A';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Desk Masthead & Statutory Officer Credentials */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <Scale size={20} color="var(--accent-crimson)" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'var(--text-main)', margin: 0 }}>
              Statutory Grievance Review Desk (शिकायत निवारण डेस्क)
            </h2>
          </div>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-subtle)', margin: 0, lineHeight: '1.5' }}>
            Compliance with Part III, Rule 11 of the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021 (India).
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', padding: '0.45rem 0.75rem', fontSize: '0.775rem' }}>
            <span style={{ color: 'var(--text-subtle)' }}>Designated Officer: </span>
            <strong style={{ color: 'var(--text-main)' }}>Rajesh Sharma</strong>
            <span style={{ color: 'var(--text-muted)' }}> (Head of Standards)</span>
          </div>

          <button
            type="button"
            onClick={() => fetchGrievances(true)}
            disabled={refreshing}
            className="btn btn-outline"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', minHeight: '36px' }}
            title="Refresh grievances list"
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            <span>{refreshing ? 'Syncing...' : 'Sync Docket'}</span>
          </button>
        </div>
      </div>

      {/* Statutory Urgency & Disposal KPI Telemetry Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.85rem' }}>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.775rem', fontWeight: '700', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Registered
            </span>
            <FileText size={16} color="var(--text-subtle)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: '900', color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
            {totalCount}
          </div>
          <div style={{ fontSize: '0.725rem', color: 'var(--text-subtle)', marginTop: '0.2rem' }}>
            All-time complaint tickets
          </div>
        </div>

        <div style={{ background: overdueAckCount > 0 ? '#FEF2F2' : 'var(--bg-surface)', border: overdueAckCount > 0 ? '1px solid #F87171' : '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.775rem', fontWeight: '700', color: overdueAckCount > 0 ? '#991B1B' : 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Awaiting Action (24h)
            </span>
            <Clock size={16} color={overdueAckCount > 0 ? '#DC2626' : 'var(--accent-amber)'} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: '900', color: overdueAckCount > 0 ? '#DC2626' : 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
            {pendingList.length}
          </div>
          <div style={{ fontSize: '0.725rem', color: overdueAckCount > 0 ? '#991B1B' : 'var(--text-subtle)', marginTop: '0.2rem', fontWeight: overdueAckCount > 0 ? '700' : 'normal' }}>
            {overdueAckCount > 0 ? `${overdueAckCount} overdue beyond 24h deadline!` : 'Mandatory 24h acknowledgment clock'}
          </div>
        </div>

        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.775rem', fontWeight: '700', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Under Investigation
            </span>
            <RefreshCw size={16} color="var(--accent-indigo)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: '900', color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
            {underReviewList.length}
          </div>
          <div style={{ fontSize: '0.725rem', color: 'var(--text-subtle)', marginTop: '0.2rem' }}>
            Active editorial fact-checking
          </div>
        </div>

        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.775rem', fontWeight: '700', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Statutory Disposal (15d)
            </span>
            <CheckCircle2 size={16} color="#059669" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: '900', color: '#059669', fontFamily: 'var(--font-mono)' }}>
            {resolvedList.length}
          </div>
          <div style={{ fontSize: '0.725rem', color: 'var(--text-subtle)', marginTop: '0.2rem' }}>
            Disposed within 15 days mandate
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', padding: '0.85rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1', minWidth: '240px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={15} color="var(--text-subtle)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search by ticket ID, complainant name, email, or story..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '0.45rem 0.65rem 0.45rem 2rem', fontSize: '0.825rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', color: 'var(--text-main)', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: '0.45rem 0.65rem', fontSize: '0.8rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', color: 'var(--text-main)' }}
          >
            <option value="all">All Statuses ({totalCount})</option>
            <option value="pending">Pending ({pendingList.length})</option>
            <option value="under_review">Under Review ({underReviewList.length})</option>
            <option value="resolved">Resolved ({resolvedList.length})</option>
            <option value="rejected">Dismissed ({rejectedList.length})</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ padding: '0.45rem 0.65rem', fontSize: '0.8rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', color: 'var(--text-main)' }}
          >
            <option value="all">All Categories</option>
            <option value="factual_inaccuracy">Factual Inaccuracy</option>
            <option value="defamation">Defamation</option>
            <option value="privacy_breach">Privacy Breach</option>
            <option value="pci_code">PCI Code Violation</option>
          </select>
        </div>
      </div>

      {/* Grievances List / Docket Table */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-subtle)' }}>
            <RefreshCw size={24} className="spin" style={{ margin: '0 auto 0.75rem auto', display: 'block' }} />
            <span>Loading statutory grievance docket...</span>
          </div>
        ) : filteredGrievances.length === 0 ? (
          <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
            <ShieldCheck size={36} color="var(--accent-indigo)" style={{ margin: '0 auto 0.75rem auto', opacity: 0.8 }} />
            <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', margin: '0 0 0.35rem 0' }}>
              No Complaints Match Current Filter
            </h4>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-subtle)', margin: 0 }}>
              The grievance registry is currently clean or no complaints match your query.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.825rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-medium)', color: 'var(--text-subtle)', fontWeight: '800', textTransform: 'uppercase', fontSize: '0.725rem', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Ticket ID</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Complainant</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Category & Story</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Submitted At</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Statutory Deadlines</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredGrievances.map((grv) => {
                  const isOverdue = grv.status === 'pending' && grv.acknowledgment_deadline && new Date(grv.acknowledgment_deadline) < now;
                  return (
                    <tr
                      key={grv.id}
                      style={{ borderBottom: '1px solid var(--border-light)', transition: 'background 0.15s ease' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Ticket ID */}
                      <td style={{ padding: '0.85rem 1rem', fontFamily: 'var(--font-mono)', fontWeight: '800', color: 'var(--accent-indigo)' }}>
                        {grv.id}
                      </td>

                      {/* Complainant Info */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ fontWeight: '700', color: 'var(--text-main)' }}>{grv.complainant_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>{grv.complainant_email}</div>
                        {grv.complainant_phone && (
                          <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>{grv.complainant_phone}</div>
                        )}
                      </td>

                      {/* Category & Story */}
                      <td style={{ padding: '0.85rem 1rem', maxWidth: '280px' }}>
                        <div style={{ fontWeight: '700', color: 'var(--text-main)', marginBottom: '0.2rem' }}>
                          {getCategoryLabel(grv.category)}
                        </div>
                        {grv.article_title ? (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {grv.article_title}
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            General platform grievance
                          </div>
                        )}
                      </td>

                      {/* Submitted At */}
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                        {formatDeadline(grv.submitted_at)}
                      </td>

                      {/* Statutory Deadlines */}
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.75rem' }}>
                        {grv.status === 'pending' ? (
                          <div style={{ color: isOverdue ? '#DC2626' : '#D97706', fontWeight: '700' }}>
                            {isOverdue ? 'Ack Overdue!' : `Ack by ${formatDeadline(grv.acknowledgment_deadline)}`}
                          </div>
                        ) : (
                          <div style={{ color: '#059669', fontWeight: '600' }}>
                            Acknowledged
                          </div>
                        )}
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', marginTop: '0.15rem' }}>
                          Disposal: {formatDeadline(grv.disposal_deadline)}
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        {getStatusBadge(grv.status)}
                      </td>

                      {/* Action */}
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenReview(grv)}
                          className="btn btn-outline"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.775rem', fontWeight: '700', minHeight: '32px', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                        >
                          <span>Review</span>
                          <ChevronRight size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review & Resolution Modal Docket */}
      {selectedGrievance && (
        <div
          className="admin-modal-overlay"
          onClick={handleCloseReview}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.7)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
        >
          <div
            className="admin-modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', width: '100%', maxWidth: '680px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}
          >
            {/* Modal Header */}
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-medium)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Scale size={18} color="var(--accent-crimson)" />
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '900', color: 'var(--text-main)' }}>
                    Statutory Grievance Docket: {selectedGrievance.id}
                  </h3>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: '0.2rem' }}>
                  Submitted on {formatDeadline(selectedGrievance.submitted_at)}
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseReview}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', padding: '0.35rem' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              {/* Complainant Particulars Card */}
              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '0.85rem' }}>
                <div style={{ fontSize: '0.725rem', fontWeight: '800', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
                  Complainant Identity
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem', fontSize: '0.825rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-subtle)' }}>Name: </span>
                    <strong style={{ color: 'var(--text-main)' }}>{selectedGrievance.complainant_name}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-subtle)' }}>Email: </span>
                    <a href={`mailto:${selectedGrievance.complainant_email}`} style={{ color: 'var(--accent-indigo)' }}>
                      {selectedGrievance.complainant_email}
                    </a>
                  </div>
                  {selectedGrievance.complainant_phone && (
                    <div>
                      <span style={{ color: 'var(--text-subtle)' }}>Phone: </span>
                      <span style={{ color: 'var(--text-main)' }}>{selectedGrievance.complainant_phone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Subject Article Details */}
              {selectedGrievance.article_title && (
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '0.85rem' }}>
                  <div style={{ fontSize: '0.725rem', fontWeight: '800', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>
                    Targeted Editorial Story
                  </div>
                  <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                    {selectedGrievance.article_title}
                  </div>
                  {selectedGrievance.article_url && (
                    <a
                      href={selectedGrievance.article_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: '0.775rem', color: 'var(--accent-indigo)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none' }}
                    >
                      <ExternalLink size={13} /> Inspect Story Page
                    </a>
                  )}
                </div>
              )}

              {/* Objections Statement */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: '0.775rem', fontWeight: '800', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Specific Objections & Factual Grounds ({getCategoryLabel(selectedGrievance.category)})
                  </label>
                  <span style={{ fontSize: '0.725rem', color: 'var(--text-subtle)' }}>
                    Factual Claims
                  </span>
                </div>
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', padding: '0.85rem', fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                  {selectedGrievance.description}
                </div>
              </div>

              {/* Statutory Timelines Tracker */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem' }}>
                <div>
                  <span style={{ color: '#64748B' }}>24h Acknowledgment Deadline:</span>
                  <div style={{ fontWeight: '700', color: '#1E293B', marginTop: '0.15rem' }}>
                    {formatDeadline(selectedGrievance.acknowledgment_deadline)}
                  </div>
                </div>
                <div>
                  <span style={{ color: '#64748B' }}>15-Day Statutory Disposal:</span>
                  <div style={{ fontWeight: '700', color: '#1E293B', marginTop: '0.15rem' }}>
                    {formatDeadline(selectedGrievance.disposal_deadline)}
                  </div>
                </div>
              </div>

              {/* Formal Officer Disposition Form */}
              <form onSubmit={handleUpdateStatus} style={{ borderTop: '1px solid var(--border-medium)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <ShieldCheck size={16} color="var(--accent-crimson)" />
                  <span>Grievance Officer Disposition & Resolution Order</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '0.3rem' }}>
                      Disposition Status <span style={{ color: 'var(--accent-crimson)' }}>*</span>
                    </label>
                    <select
                      value={resolutionStatus}
                      onChange={(e) => setResolutionStatus(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem 0.65rem', fontSize: '0.825rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', color: 'var(--text-main)' }}
                    >
                      <option value="pending">Pending Action (प्राप्त - लंबित)</option>
                      <option value="under_review">Under Review / Editorial Investigation (जांच जारी)</option>
                      <option value="resolved">Resolved / Action Taken (निस्तारित - सुधार किया गया)</option>
                      <option value="rejected">Dismissed / Frivolous (खारिज - आधारहीन)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '0.3rem' }}>
                      Signing Grievance Officer
                    </label>
                    <input
                      type="text"
                      value={resolvedBy}
                      onChange={(e) => setResolvedBy(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem 0.65rem', fontSize: '0.825rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', color: 'var(--text-main)' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '0.3rem' }}>
                    Formal Resolution Notes / Editorial Action Order (आधिकारिक निस्तारण आदेश)
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Document specific verification findings, corrections applied (e.g. Corrigendum appended to article on date), or factual basis for dismissing objection..."
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.825rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', color: 'var(--text-main)', lineHeight: '1.5', boxSizing: 'border-box' }}
                  />
                </div>

                {selectedGrievance.resolved_at && (
                  <div style={{ fontSize: '0.725rem', color: '#059669', fontStyle: 'italic' }}>
                    Last resolved / disposed at: {formatDeadline(selectedGrievance.resolved_at)}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={handleCloseReview}
                    className="btn btn-outline"
                    style={{ padding: '0.55rem 1rem', minHeight: '40px' }}
                  >
                    Close
                  </button>

                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="btn btn-primary"
                    style={{ padding: '0.55rem 1.25rem', minHeight: '40px', background: 'var(--accent-crimson)', color: '#fff', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <Send size={14} />
                    <span>{isUpdating ? 'Saving Order...' : 'Save & Update Docket'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

