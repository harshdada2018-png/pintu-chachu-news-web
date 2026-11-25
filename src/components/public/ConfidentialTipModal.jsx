import React, { useState, useEffect } from 'react';
import {
  X, ShieldCheck, EyeOff, Send, Search, Copy, Check,
  AlertCircle, CheckCircle2, FileText, Lock
} from 'lucide-react';

const TIP_CATEGORIES = [
  { id: 'corruption', label: 'भ्रष्टाचार / रिश्वतखोरी (Corruption)' },
  { id: 'crime', label: 'अपराध / क्राइम सूचना (Crime)' },
  { id: 'scam', label: 'घोटाला / धोखाधड़ी (Scam / Fraud)' },
  { id: 'public_issue', label: 'जनसमस्या / प्रशासनिक लापरवाही (Public Issue)' },
  { id: 'other', label: 'अन्य गोपनीय सूचना (Other)' }
];

const STATUS_LABELS = {
  pending_review: { label: 'समीक्षा प्रतीक्षारत (Pending Review)', tone: 'neutral' },
  under_investigation: { label: 'संपादकीय जांच जारी है (Under Investigation)', tone: 'crimson' },
  verified_published: { label: 'सत्यापित एवं प्रकाशित (Verified & Published)', tone: 'dark' },
  dismissed: { label: 'प्रकरण बंद (Closed / Unverified)', tone: 'neutral' }
};

/**
 * PublicSpark Sovereign Anonymous Whistleblower & Confidential Tip Modal (Task 43 Subtopic B)
 * Zero-trace crime/corruption reporting form with Tracking ID receipt & anonymous status checker.
 */
export default function ConfidentialTipModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('submit'); // 'submit' | 'status'

  // Submission Form State
  const [category, setCategory] = useState('corruption');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [incidentDate, setIncidentDate] = useState('');
  const [involvedEntities, setInvolvedEntities] = useState('');
  const [details, setDetails] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [optionalContact, setOptionalContact] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [receipt, setReceipt] = useState(null); // { trackingId, status, submittedAt }
  const [copiedId, setCopiedId] = useState(false);

  // Status Checker State
  const [lookupId, setLookupId] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [lookupResult, setLookupResult] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleResetForm = () => {
    setCategory('corruption');
    setTitle('');
    setLocation('');
    setIncidentDate('');
    setInvolvedEntities('');
    setDetails('');
    setEvidenceUrl('');
    setOptionalContact('');
    setSubmitError('');
    setReceipt(null);
    setCopiedId(false);
  };

  const handleSubmitTip = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (title.trim().length < 5) {
      setSubmitError('कृपया विषय/शीर्षक कम से कम 5 अक्षरों में लिखें।');
      return;
    }
    if (details.trim().length < 20) {
      setSubmitError('कृपया पूरी जानकारी कम से कम 20 अक्षरों में विस्तार से लिखें।');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/tips/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          title: title.trim(),
          location: location.trim(),
          incidentDate: incidentDate.trim(),
          involvedEntities: involvedEntities.trim(),
          details: details.trim(),
          evidenceUrl: evidenceUrl.trim(),
          optionalContact: optionalContact.trim()
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setReceipt(data);
        setLookupId(data.trackingId);
      } else {
        setSubmitError(data.error || 'सूचना भेजने में समस्या आई। कृपया पुनः प्रयास करें।');
      }
    } catch (_err) {
      setSubmitError('नेटवर्क त्रुटि: सर्वर से संपर्क नहीं हो सका।');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckStatus = async (e) => {
    e.preventDefault();
    const cleaned = lookupId.trim().toUpperCase();
    if (!cleaned) {
      setLookupError('कृपया अपनी Tracking ID दर्ज करें (जैसे: TIP-4829-A1B2)।');
      return;
    }
    setLookupError('');
    setLookupResult(null);
    setLookupLoading(true);
    try {
      const res = await fetch(`/api/tips/status/${encodeURIComponent(cleaned)}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setLookupResult(data);
      } else {
        setLookupError(data.error || 'इस Tracking ID से कोई सूचना नहीं मिली।');
      }
    } catch (_err) {
      setLookupError('नेटवर्क त्रुटि: स्थिति जांचने में समस्या आई।');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleCopyTrackingId = () => {
    if (!receipt?.trackingId) return;
    navigator.clipboard.writeText(receipt.trackingId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const inputStyle = {
    width: '100%',
    padding: '0.65rem 0.85rem',
    fontSize: '1rem',
    borderRadius: '4px',
    border: '1px solid var(--border-medium)',
    background: 'var(--bg-secondary)',
    color: 'var(--text-main)',
    boxSizing: 'border-box'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.825rem',
    fontWeight: '800',
    color: 'var(--text-main)',
    marginBottom: '0.35rem'
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Confidential News Tip Desk"
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
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-dark)',
          borderTop: '4px solid var(--accent-crimson)',
          borderRadius: '4px',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '1rem 1.25rem',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.75rem',
          position: 'sticky',
          top: 0,
          background: 'var(--bg-surface)',
          zIndex: 2
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
            <EyeOff size={20} color="var(--accent-crimson)" style={{ flexShrink: 0 }} />
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '900', color: 'var(--text-main)' }}>
                गुप्त सूचना केंद्र (Confidential News Tip)
              </h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                अपराध, भ्रष्टाचार या जनहित की सूचना बिना पहचान बताए भेजें
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Confidential Tip Modal"
            style={{
              background: 'none',
              border: '1px solid var(--border-medium)',
              borderRadius: '4px',
              minWidth: '44px',
              minHeight: '44px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-main)',
              flexShrink: 0
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Mode Switch Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-light)',
          background: 'var(--bg-secondary)',
          padding: '0.4rem 1.25rem',
          gap: '0.5rem',
          flexWrap: 'wrap'
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('submit')}
            style={{
              padding: '0.5rem 1rem',
              minHeight: '44px',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '800',
              fontSize: '0.85rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: activeTab === 'submit' ? 'var(--accent-crimson)' : 'transparent',
              color: activeTab === 'submit' ? '#ffffff' : 'var(--text-main)'
            }}
          >
            <FileText size={15} />
            <span>पूरी जानकारी भेजें</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('status')}
            style={{
              padding: '0.5rem 1rem',
              minHeight: '44px',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '800',
              fontSize: '0.85rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: activeTab === 'status' ? 'var(--accent-crimson)' : 'transparent',
              color: activeTab === 'status' ? '#ffffff' : 'var(--text-main)'
            }}
          >
            <Search size={15} />
            <span>जांच की स्थिति देखें</span>
          </button>
        </div>

        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Zero-Trace Guarantee Banner */}
          <div style={{
            padding: '0.85rem 1rem',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-medium)',
            borderLeft: '3px solid var(--accent-crimson)',
            borderRadius: '4px',
            fontSize: '0.825rem',
            lineHeight: '1.6',
            color: 'var(--text-main)',
            display: 'flex',
            gap: '0.65rem',
            alignItems: 'flex-start'
          }}>
            <ShieldCheck size={18} color="var(--accent-crimson)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>100% गुप्त एवं सुरक्षित (Zero-Trace Anonymity):</strong> आपकी पहचान, नाम, IP पता या डिवाइस की कोई भी जानकारी सर्वर पर सेव नहीं की जाती। यह जानकारी केवल मुख्य संपादक/एडमिन के सुरक्षित डेस्क तक जाती है। हमारी टीम पूरी जांच (Investigation) एवं तथ्य-पुष्टि के बाद ही खबर को सार्वजनिक करेगी।
            </div>
          </div>

          {activeTab === 'submit' && !receipt && (
            <form onSubmit={handleSubmitTip} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              {submitError && (
                <div style={{
                  padding: '0.75rem 1rem',
                  background: 'rgba(184, 29, 19, 0.08)',
                  border: '1px solid var(--accent-crimson)',
                  borderRadius: '4px',
                  color: 'var(--accent-crimson)',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{submitError}</span>
                </div>
              )}

              <div>
                <label htmlFor="tip-category" style={labelStyle}>विषय श्रेणी (Category) *</label>
                <select
                  id="tip-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={inputStyle}
                >
                  {TIP_CATEGORIES.map(c => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="tip-title" style={labelStyle}>मुख्य विषय / शीर्षक (Subject / Title) *</label>
                <input
                  id="tip-title"
                  type="text"
                  required
                  maxLength={200}
                  placeholder="संक्षेप में बताएं मामला क्या है (कम से कम 5 अक्षर)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
                <div style={{ minWidth: 0 }}>
                  <label htmlFor="tip-location" style={labelStyle}>स्थान / शहर / जिला (Location)</label>
                  <input
                    id="tip-location"
                    type="text"
                    maxLength={150}
                    placeholder="जैसे: भोपाल, मध्य प्रदेश"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div style={{ minWidth: 0 }}>
                  <label htmlFor="tip-date" style={labelStyle}>घटना की तारीख / समय (Incident Date)</label>
                  <input
                    id="tip-date"
                    type="text"
                    maxLength={50}
                    placeholder="जैसे: 20 नवंबर 2026 या पिछले सप्ताह"
                    value={incidentDate}
                    onChange={(e) => setIncidentDate(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="tip-entities" style={labelStyle}>शामिल विभाग / व्यक्ति / संस्था (Involved Department or Persons)</label>
                <input
                  id="tip-entities"
                  type="text"
                  maxLength={300}
                  placeholder="किस विभाग, अधिकारी या संस्था से जुड़ा मामला है (वैकल्पिक)"
                  value={involvedEntities}
                  onChange={(e) => setInvolvedEntities(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label htmlFor="tip-details" style={{ ...labelStyle, marginBottom: 0 }}>
                    पूरी जानकारी एवं विस्तृत विवरण (Complete Details) *
                  </label>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                    {details.length} / 8000
                  </span>
                </div>
                <textarea
                  id="tip-details"
                  required
                  rows={6}
                  maxLength={8000}
                  placeholder="यहाँ पूरी बात विस्तार से लिखें — क्या हुआ, कब हुआ, कैसे हुआ और कौन-कौन से तथ्य या सबूत उपलब्ध हैं..."
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: '140px', lineHeight: '1.6' }}
                />
              </div>

              <div>
                <label htmlFor="tip-evidence" style={labelStyle}>सबूत / दस्तावेज़ लिंक (Evidence Link — Optional)</label>
                <input
                  id="tip-evidence"
                  type="url"
                  maxLength={500}
                  placeholder="https://... (Google Drive, ImgBB फोटो या वीडियो लिंक यदि हो)"
                  value={evidenceUrl}
                  onChange={(e) => setEvidenceUrl(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label htmlFor="tip-contact" style={labelStyle}>वैकल्पिक संपर्क (Optional Contact — न चाहें तो खाली छोड़ दें)</label>
                <input
                  id="tip-contact"
                  type="text"
                  maxLength={150}
                  placeholder="पूरी तरह वैकल्पिक: गुमनाम रहने के लिए इसे खाली छोड़ दें"
                  value={optionalContact}
                  onChange={(e) => setOptionalContact(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '0.65rem 1.25rem',
                    minHeight: '44px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-medium)',
                    background: 'transparent',
                    color: 'var(--text-main)',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  रद्द करें
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '0.65rem 1.5rem',
                    minHeight: '44px',
                    borderRadius: '4px',
                    border: 'none',
                    background: 'var(--accent-crimson)',
                    color: '#ffffff',
                    fontWeight: '800',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <Send size={16} />
                  <span>{submitting ? 'सुरक्षित भेजा जा रहा है...' : 'गुप्त सूचना सुरक्षित भेजें'}</span>
                </button>
              </div>
            </form>
          )}

          {activeTab === 'submit' && receipt && (
            <div style={{
              padding: '1.25rem',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-medium)',
              borderRadius: '4px',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.9rem',
              textAlign: 'center'
            }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <CheckCircle2 size={36} color="var(--accent-crimson)" />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '900', color: 'var(--text-main)' }}>
                आपकी सूचना सुरक्षित प्राप्त हो गई है
              </h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                आपकी पहचान पूरी तरह गोपनीय रखी गई है। इस गुप्त Tracking ID को संभाल कर रखें — इसकी मदद से आप बिना अपनी पहचान बताए जांच की प्रगति देख सकते हैं:
              </p>

              <div style={{
                padding: '0.85rem 1rem',
                background: 'var(--bg-surface)',
                border: '2px dashed var(--accent-crimson)',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                flexWrap: 'wrap'
              }}>
                <Lock size={18} color="var(--accent-crimson)" />
                <strong style={{ fontSize: '1.25rem', letterSpacing: '0.08em', color: 'var(--text-main)', fontFamily: 'monospace' }}>
                  {receipt.trackingId}
                </strong>
                <button
                  type="button"
                  onClick={handleCopyTrackingId}
                  style={{
                    padding: '0.45rem 0.85rem',
                    minHeight: '36px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-medium)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-main)',
                    fontWeight: '700',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  {copiedId ? <Check size={14} color="var(--accent-crimson)" /> : <Copy size={14} />}
                  <span>{copiedId ? 'कॉपी हो गया' : 'ID कॉपी करें'}</span>
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap', paddingTop: '0.25rem' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('status')}
                  style={{
                    padding: '0.6rem 1.1rem',
                    minHeight: '44px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-medium)',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-main)',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  स्टेटस जांचें
                </button>
                <button
                  type="button"
                  onClick={handleResetForm}
                  style={{
                    padding: '0.6rem 1.1rem',
                    minHeight: '44px',
                    borderRadius: '4px',
                    border: 'none',
                    background: 'var(--accent-crimson)',
                    color: '#ffffff',
                    fontWeight: '800',
                    cursor: 'pointer'
                  }}
                >
                  एक और सूचना भेजें
                </button>
              </div>
            </div>
          )}

          {activeTab === 'status' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <form onSubmit={handleCheckStatus} style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Tracking ID दर्ज करें (जैसे: TIP-4829-A1B2)"
                  value={lookupId}
                  onChange={(e) => setLookupId(e.target.value)}
                  style={{ ...inputStyle, flex: '1 1 220px', fontFamily: 'monospace' }}
                />
                <button
                  type="submit"
                  disabled={lookupLoading}
                  style={{
                    padding: '0.65rem 1.25rem',
                    minHeight: '44px',
                    borderRadius: '4px',
                    border: 'none',
                    background: 'var(--accent-crimson)',
                    color: '#ffffff',
                    fontWeight: '800',
                    cursor: lookupLoading ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <Search size={16} />
                  <span>{lookupLoading ? 'खोज रहा है...' : 'स्थिति देखें'}</span>
                </button>
              </form>

              {lookupError && (
                <div style={{
                  padding: '0.75rem 1rem',
                  background: 'rgba(184, 29, 19, 0.08)',
                  border: '1px solid var(--accent-crimson)',
                  borderRadius: '4px',
                  color: 'var(--accent-crimson)',
                  fontSize: '0.85rem',
                  fontWeight: '700'
                }}>
                  {lookupError}
                </div>
              )}

              {lookupResult && (
                <div style={{
                  padding: '1rem',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: '4px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <strong style={{ fontFamily: 'monospace', fontSize: '0.95rem', color: 'var(--text-main)' }}>
                      {lookupResult.trackingId}
                    </strong>
                    <span style={{
                      padding: '0.25rem 0.65rem',
                      borderRadius: '4px',
                      fontSize: '0.775rem',
                      fontWeight: '800',
                      background: lookupResult.status === 'under_investigation' ? 'var(--accent-crimson)' : 'var(--text-main)',
                      color: '#ffffff'
                    }}>
                      {(STATUS_LABELS[lookupResult.status] || { label: lookupResult.status }).label}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-subtle)' }}>
                    प्राप्त: {new Date(lookupResult.submittedAt).toLocaleString()} • अंतिम अपडेट: {new Date(lookupResult.updatedAt).toLocaleString()}
                  </div>
                  {lookupResult.editorialNote && (
                    <div style={{
                      marginTop: '0.25rem',
                      padding: '0.65rem 0.85rem',
                      background: 'var(--bg-surface)',
                      borderLeft: '3px solid var(--accent-crimson)',
                      fontSize: '0.85rem',
                      color: 'var(--text-main)'
                    }}>
                      <strong>संपादकीय टिप्पणी:</strong> {lookupResult.editorialNote}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

