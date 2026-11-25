import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, X, BookOpen, AlertCircle, CheckCircle, 
  Copy, Check, FileText, ChevronDown, ChevronUp, Scale, Clock, Send
} from 'lucide-react';
import { t } from '../../services/uiTranslations';

/**
 * PublicSpark Newsroom — Statutory Grievance Redressal Modal (Task 29 Subtopic A)
 * Built in compliance with Part III, Rule 11 of the Information Technology
 * (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021 (India).
 * Features an on-demand statutory laws accordion and clean minimalist broadsheet form.
 */
export default function GrievanceModal({
  isOpen,
  onClose,
  initialArticle = null,
  currentLanguage = 'hi'
}) {
  const [formData, setFormData] = useState({
    complainant_name: '',
    complainant_email: '',
    complainant_phone: '',
    article_title: '',
    article_url: '',
    article_id: '',
    category: '',
    description: '',
    declaration_agreed: false
  });

  const [showLegalSections, setShowLegalSections] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedTicketId, setCopiedTicketId] = useState(false);

  // Initialize form state when modal opens or initialArticle changes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        complainant_name: '',
        complainant_email: '',
        complainant_phone: '',
        article_title: initialArticle?.title || '',
        article_url: typeof window !== 'undefined' ? (initialArticle ? `${window.location.origin}/article/${initialArticle.slug || initialArticle.id}` : window.location.href) : '',
        article_id: initialArticle?.id ? String(initialArticle.id) : '',
        category: '',
        description: '',
        declaration_agreed: false
      });
      setShowLegalSections(false);
      setSubmissionResult(null);
      setErrorMessage('');
      setCopiedTicketId(false);
    }
  }, [isOpen, initialArticle]);

  // Keyboard accessibility: Escape key closes modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!formData.complainant_name.trim()) {
      setErrorMessage('Please provide your full legal name.');
      return;
    }
    if (!formData.complainant_email.trim() || !formData.complainant_email.includes('@')) {
      setErrorMessage('Please provide a valid email address.');
      return;
    }
    if (!formData.category) {
      setErrorMessage('Please select a statutory grievance category.');
      return;
    }
    if (!formData.description.trim() || formData.description.trim().length < 20) {
      setErrorMessage('Please describe your grievance with specific facts (minimum 20 characters).');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/grievance/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSubmissionResult(data);
      } else {
        setErrorMessage(data.error || 'Failed to submit grievance. Please try again.');
      }
    } catch (err) {
      setErrorMessage('Network error: Unable to reach grievance server. ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyTicket = () => {
    if (submissionResult?.tracking_id && typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(submissionResult.tracking_id);
      setCopiedTicketId(true);
      setTimeout(() => setCopiedTicketId(false), 2500);
    }
  };

  return (
    <div 
      className="grievance-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="grievance-modal-title"
    >
      <div 
        className="grievance-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="grievance-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div className="grievance-icon-wrap">
              <ShieldCheck size={20} color="var(--accent-crimson)" />
            </div>
            <div>
              <h2 id="grievance-modal-title" className="grievance-modal-title">
                Statutory Grievance Redressal
              </h2>
              <span className="grievance-modal-subtitle">
                IT Rules 2021 India • Designated Officer: Rajesh Sharma
              </span>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="grievance-close-btn"
            aria-label="Close Grievance Modal"
            title="Close (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="grievance-modal-body">
          {submissionResult ? (
            /* Submission Success View & Official Statutory Acknowledgment Receipt */
            <div className="grievance-receipt-card">
              <div className="grievance-receipt-icon">
                <CheckCircle size={48} color="var(--accent-emerald)" />
              </div>

              <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                Formal Grievance Registered
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: '1.6' }}>
                Your grievance has been formally logged and routed to the PublicSpark Grievance Redressal Officer in accordance with Part III of the Information Technology Rules, 2021.
              </p>

              {/* Unique Ticket ID Box */}
              <div className="grievance-ticket-box">
                <span style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-subtle)' }}>
                  Statutory Tracking Ticket ID
                </span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <code className="grievance-ticket-code">{submissionResult.tracking_id}</code>
                  <button 
                    onClick={handleCopyTicket}
                    className="grievance-copy-btn"
                    title="Copy Ticket ID"
                  >
                    {copiedTicketId ? <Check size={14} color="var(--accent-emerald)" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              {/* Statutory Timelines Table */}
              <div className="grievance-timelines-grid">
                <div className="grievance-timeline-item">
                  <Clock size={16} color="var(--accent-indigo)" />
                  <div>
                    <div style={{ fontWeight: '800', fontSize: '0.8rem', color: 'var(--text-main)' }}>24-Hour Receipt Acknowledgment</div>
                    <div style={{ fontSize: '0.725rem', color: 'var(--text-subtle)' }}>Official confirmation dispatched to {formData.complainant_email}</div>
                  </div>
                </div>

                <div className="grievance-timeline-item">
                  <Scale size={16} color="var(--accent-emerald)" />
                  <div>
                    <div style={{ fontWeight: '800', fontSize: '0.8rem', color: 'var(--text-main)' }}>15-Day Statutory Disposal</div>
                    <div style={{ fontSize: '0.725rem', color: 'var(--text-subtle)' }}>Deadline: {new Date(submissionResult.disposal_deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                <button 
                  onClick={onClose}
                  className="btn btn-outline"
                  style={{ padding: '0.55rem 1.75rem', minHeight: '44px', fontWeight: '700' }}
                >
                  Close Receipt
                </button>
              </div>
            </div>
          ) : (
            /* Grievance Submission Form */
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* On-Demand Statutory Media Laws & Sections Button (Boss's Command) */}
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => setShowLegalSections(!showLegalSections)}
                  className="grievance-legal-toggle-btn"
                  aria-expanded={showLegalSections}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Scale size={16} color="var(--accent-indigo)" />
                    <span style={{ fontWeight: '800', fontSize: '0.825rem', color: 'var(--text-main)' }}>
                      View Statutory Media Laws & Sections (कानूनी धाराएं व नियम)
                    </span>
                  </div>
                  {showLegalSections ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {showLegalSections && (
                  <div className="grievance-legal-content">
                    <h4 style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                      Legal Framework Governing Digital News (India)
                    </h4>
                    <ul style={{ fontSize: '0.775rem', color: 'var(--text-muted)', lineHeight: '1.6', paddingLeft: '1.15rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <li>
                        <strong>Rule 11, Information Technology Rules 2021:</strong> Publishers of news and current affairs content must establish a Level-I Grievance Redressal Mechanism headed by an Indian-resident Grievance Officer.
                      </li>
                      <li>
                        <strong>Press Council of India (PCI) Norms:</strong> Mandates adherence to accuracy, fairness, right of reply, and avoidance of scurrilous or unverified accusations.
                      </li>
                      <li>
                        <strong>Defamation Exceptions (BNS Section 356 / IPC Section 499):</strong> Imputation of truth made in good faith for public good does not constitute defamation.
                      </li>
                      <li>
                        <strong>Protection of Minor Victims (POCSO Act Sec 23):</strong> Strict prohibition against publishing any details revealing identity of minors involved in sexual assault proceedings.
                      </li>
                      <li>
                        <strong>Contempt of Courts Act, 1971:</strong> Fair and temperate reporting of judicial proceedings conducted in open court does not constitute contempt.
                      </li>
                      <li>
                        <strong>Legal Notice on Malicious Complaints (BNS Section 217 / IPC 182):</strong> Filing false, fabricated, or malicious complaints to harass bona fide journalists may attract statutory penalties.
                      </li>
                    </ul>
                  </div>
                )}
              </div>

              {errorMessage && (
                <div className="grievance-error-banner">
                  <AlertCircle size={16} color="var(--accent-crimson)" style={{ flexShrink: 0 }} />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Complainant Identity Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
                <div className="grievance-field-group">
                  <label htmlFor="complainant_name" className="grievance-label">
                    Full Legal Name (पूरा नाम) <span style={{ color: 'var(--accent-crimson)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    id="complainant_name"
                    name="complainant_name"
                    value={formData.complainant_name}
                    onChange={handleChange}
                    placeholder="e.g. Rajeshwar Singh"
                    required
                    className="grievance-input"
                  />
                </div>

                <div className="grievance-field-group">
                  <label htmlFor="complainant_email" className="grievance-label">
                    Email Address (ईमेल) <span style={{ color: 'var(--accent-crimson)' }}>*</span>
                  </label>
                  <input
                    type="email"
                    id="complainant_email"
                    name="complainant_email"
                    value={formData.complainant_email}
                    onChange={handleChange}
                    placeholder="e.g. rajeshwar@example.com"
                    required
                    className="grievance-input"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
                <div className="grievance-field-group">
                  <label htmlFor="complainant_phone" className="grievance-label">
                    Mobile / Phone Number (फ़ोन नंबर)
                  </label>
                  <input
                    type="tel"
                    id="complainant_phone"
                    name="complainant_phone"
                    value={formData.complainant_phone}
                    onChange={handleChange}
                    placeholder="+91 9876543210"
                    className="grievance-input"
                  />
                </div>

                <div className="grievance-field-group">
                  <label htmlFor="category" className="grievance-label">
                    Grievance Category (शिकायत का प्रकार) <span style={{ color: 'var(--accent-crimson)' }}>*</span>
                  </label>
                  <select
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    required
                    className="grievance-select"
                  >
                    <option value="">-- Select Statutory Category --</option>
                    <option value="Factual Inaccuracy / Misleading Data">Factual Inaccuracy / Misleading Data (तथ्यों की गलती)</option>
                    <option value="Defamation / Reputation Harm">Defamation / Unsubstantiated Allegation (मानहानि)</option>
                    <option value="Breach of Personal Privacy">Breach of Personal Privacy (व्यक्तिगत निजता का उल्लंघन)</option>
                    <option value="Hate Speech / Public Harmony">Hate Speech / Public Disharmony (भड़काऊ सामग्री)</option>
                    <option value="POCSO / Identity Disclosure">POCSO / Minor Identity Protection Violation (नाबालिग पहचान)</option>
                    <option value="Copyright / IP Infringement">Copyright / Media Plagiarism (कॉपीराइट उल्लंघन)</option>
                    <option value="Other Press Council Code Breach">Other PCI Code of Ethics Violation (अन्य आचार संहिता उल्लंघन)</option>
                  </select>
                </div>
              </div>

              {/* Article Link / Title Reference */}
              <div className="grievance-field-group">
                <label htmlFor="article_title" className="grievance-label">
                  Referenced Article / Story (संबंधित समाचार का शीर्षक या लिंक)
                </label>
                <input
                  type="text"
                  id="article_title"
                  name="article_title"
                  value={formData.article_title}
                  onChange={handleChange}
                  placeholder="Paste article URL or enter headline"
                  className="grievance-input"
                />
              </div>

              {/* Detailed Grounds & Objections */}
              <div className="grievance-field-group">
                <label htmlFor="description" className="grievance-label">
                  Specific Objections & Grounds (विस्तृत शिकायत व आपत्ति) <span style={{ color: 'var(--accent-crimson)' }}>*</span>
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="State the exact paragraphs, statements, or claims you object to, and provide factual justification..."
                  rows={4}
                  required
                  className="grievance-textarea"
                />
              </div>

              {/* Bottom Notice & Acknowledgment Note (Boss's Command) */}
              <div className="grievance-notice-box">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <FileText size={16} color="var(--accent-amber)" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.5', margin: 0 }}>
                    <strong>Statutory Notice:</strong> Before submitting a formal complaint, please review the applicable Indian Media Laws and IT Rules 2021 via the section button above. Genuine grievances are acknowledged within 24 hours and disposed of within 15 days by our Grievance Officer. Frivolous or malicious complaints filed without factual basis may attract appropriate legal action under applicable laws.
                  </p>
                </div>

                <label className="grievance-checkbox-label">
                  <input
                    type="checkbox"
                    name="declaration_agreed"
                    checked={formData.declaration_agreed}
                    onChange={handleChange}
                    required
                  />
                  <span>
                    I declare that the information provided is true, accurate, based on genuine facts, and filed in good faith.
                  </span>
                </label>
              </div>

              {/* Submit Action */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.25rem' }}>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-outline"
                  style={{ padding: '0.65rem 1.25rem', minHeight: '44px' }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || !formData.declaration_agreed}
                  className="btn btn-primary"
                  style={{ 
                    padding: '0.65rem 1.5rem', 
                    minHeight: '44px',
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.45rem',
                    background: 'var(--accent-crimson)',
                    color: '#ffffff',
                    opacity: (!formData.declaration_agreed || isSubmitting) ? 0.6 : 1,
                    cursor: (!formData.declaration_agreed || isSubmitting) ? 'not-allowed' : 'pointer'
                  }}
                >
                  <Send size={15} />
                  <span>{isSubmitting ? 'Registering...' : 'Submit Formal Grievance'}</span>
                </button>
              </div>

            </form>
          )}
        </div>
      </div>
    </div>
  );
}
