import React, { useState } from 'react';
import { CheckCircle, Flame, Sparkles, XCircle, Clock, Eye, Edit3, ShieldAlert, Languages, Video, Play, X, AlertCircle, ShieldCheck, FileText, ExternalLink } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '../../services/translationService';

export default function EditorWorkspace({ pendingArticles, onApproveArticle, onRejectArticle }) {
  const [selectedArticle, setSelectedArticle] = useState(pendingArticles[0] || null);
  const [editedTitle, setEditedTitle] = useState(selectedArticle?.title || '');
  const [editedLanguage, setEditedLanguage] = useState(selectedArticle?.originalLanguage || 'hi');
  const [isBreaking, setIsBreaking] = useState(false);
  const [headlineSuggestions, setHeadlineSuggestions] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [factCheckRating, setFactCheckRating] = useState('Verified');
  const [factCheckDesk, setFactCheckDesk] = useState('PublicSpark Fact Desk');

  // Select article to review
  const handleSelectArticle = (art) => {
    setSelectedArticle(art);
    setEditedTitle(art.title);
    setEditedLanguage(art.originalLanguage || 'hi');
    setIsBreaking(art.is_breaking || false);
    setFactCheckRating(art.fact_check?.rating || 'Verified');
    setFactCheckDesk(art.fact_check?.desk || 'PublicSpark Fact Desk');
    setHeadlineSuggestions([]);
  };

  // Editorial Headline Assistance
  const handleGenerateHeadlines = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setHeadlineSuggestions([
        `Top Story: ${selectedArticle.title} — Key Takeaways & Impact`,
        `BREAKING: ${selectedArticle.title.split(':')[0] || selectedArticle.title}`,
        `In-Depth Report: ${selectedArticle.title}`
      ]);
    }, 500);
  };

  const handleApprove = () => {
    if (!selectedArticle) return;
    const finalFactCheck = {
      verified: true,
      rating: factCheckRating || 'Verified',
      desk: factCheckDesk || 'PublicSpark Fact Desk',
      claim: selectedArticle.fact_check?.claim || 'Verified against institutional statements and reporter ground dispatches.',
      verified_at: 'Just now',
      methodology: 'Cross-verified by Editor Desk prior to publication in accordance with Press Council of India standards.'
    };
    onApproveArticle(selectedArticle.id, editedTitle, isBreaking, editedLanguage, finalFactCheck, selectedArticle.sources || []);
    setSelectedArticle(null);
    setHeadlineSuggestions([]);
  };

  return (
    <div className="container" style={{ padding: '2rem 1.25rem' }}>
      {/* Editor Header */}
      <div className="workspace-header" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className="workspace-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle color="var(--accent-emerald)" /> Editorial Desk
            </h2>
            <p style={{ color: 'var(--text-subtle)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
              Review reporter submissions, refine headlines, mark breaking news, and publish stories.
            </p>
          </div>
          <div style={{ background: 'var(--accent-emerald-bg, rgba(16, 185, 129, 0.12))', color: 'var(--accent-emerald)', border: '1px solid var(--accent-emerald)', padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', fontWeight: '700' }}>
            Queue: {pendingArticles.length} Stories Awaiting Review
          </div>
        </div>
      </div>

      <div className="workspace-grid">
        {/* Submissions Queue List */}
        <div className="workspace-sidebar">
          <h4 style={{ fontSize: '0.85rem', fontWeight: '900', textTransform: 'uppercase', color: 'var(--text-subtle)', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
            Pending Review ({pendingArticles.length})
          </h4>
          {pendingArticles.length === 0 ? (
            <div style={{ 
              fontSize: '0.85rem', 
              color: 'var(--text-subtle)', 
              padding: '2rem 1rem', 
              textAlign: 'center', 
              background: 'var(--bg-surface)', 
              borderRadius: 'var(--radius-sm)', 
              border: '1px solid var(--border-light)' 
            }}>
              <CheckCircle size={24} color="var(--accent-emerald)" style={{ margin: '0 auto 0.5rem auto' }} />
              <div style={{ fontWeight: '700', color: 'var(--text-main)', marginBottom: '0.2rem' }}>Review Queue Clear</div>
              <div>All reporter submissions have been reviewed and dispatched.</div>
            </div>
          ) : (
            pendingArticles.map((art) => (
              <div 
                key={art.id} 
                onClick={() => handleSelectArticle(art)}
                style={{ 
                  padding: '0.85rem', 
                  borderRadius: 'var(--radius-sm)', 
                  border: '1px solid var(--border-light)', 
                  marginBottom: '0.5rem', 
                  cursor: 'pointer',
                  backgroundColor: selectedArticle?.id === art.id ? 'var(--bg-secondary)' : 'var(--bg-surface)',
                  borderLeft: selectedArticle?.id === art.id ? '3px solid var(--accent-crimson)' : '1px solid var(--border-light)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-crimson)', fontWeight: '700', textTransform: 'uppercase' }}>
                    {art.category}
                  </div>
                  {art.video_url && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', background: 'var(--accent-crimson)', color: '#fff', fontSize: '0.6rem', fontWeight: '800', padding: '1px 4px', borderRadius: '2px' }}>
                      <Play size={8} fill="#fff" /> Video
                    </span>
                  )}
                </div>
                <div style={{ fontWeight: '700', fontSize: '0.9rem', margin: '0.2rem 0 0.4rem 0', lineHeight: '1.3' }}>
                  {art.title}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                  By {art.author?.name || 'Reporter'} {art.author?.email ? `(${art.author.email})` : ''} • {art.published_at}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Selected Article Inspection & Action Panel */}
        <div>
          {selectedArticle ? (
            <div style={{ background: 'var(--bg-surface)', padding: '1.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
              {/* Category & Status */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span className="story-category-tag">{selectedArticle.category}</span>
                <span className="badge badge-live">
                  <Clock size={12} /> Pending Approval
                </span>
              </div>

              {/* Attached Video Coverage Indicator */}
              {selectedArticle.video_url && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1.25rem', background: 'rgba(239, 68, 68, 0.08)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: '700', color: 'var(--accent-crimson)' }}>
                    <Video size={16} /> Attached YouTube Coverage
                  </div>
                  <a 
                    href={selectedArticle.video_url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    style={{ fontSize: '0.75rem', color: 'var(--accent-crimson)', textDecoration: 'underline', fontWeight: '700' }}
                  >
                    View Original Video ↗
                  </a>
                </div>
              )}

              {/* Original / Source Language Selector */}
              <div style={{ marginBottom: '1.25rem', background: 'var(--bg-secondary)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)' }}>
                <label style={{ display: 'block', fontWeight: '800', fontSize: '0.85rem', marginBottom: '0.35rem', color: 'var(--text-main)' }}>
                  लेखन की मूल भाषा (Article Source Language)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Languages size={17} color="var(--accent-indigo)" />
                    <select
                      value={editedLanguage}
                      onChange={(e) => setEditedLanguage(e.target.value)}
                      style={{ padding: '0.45rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', fontSize: '0.875rem', fontWeight: '700', background: 'var(--bg-surface)', color: 'var(--text-main)' }}
                    >
                      {SUPPORTED_LANGUAGES.map(lang => (
                        <option key={lang.code} value={lang.code}>
                          {lang.native} ({lang.name})
                        </option>
                      ))}
                    </select>
                  </div>
                  <span style={{ fontSize: '0.775rem', color: 'var(--text-subtle)' }}>
                    (डाउनस्ट्रीम अनुवाद और आवाज़ इसी मूल भाषा के आधार पर होगी)
                  </span>
                </div>
              </div>

              {/* Editable Headline */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontWeight: '700', fontSize: '0.85rem', marginBottom: '0.3rem', color: 'var(--text-subtle)' }}>
                  Editorial Headline Adjustment
                </label>
                <input 
                  type="text" 
                  value={editedTitle} 
                  onChange={(e) => setEditedTitle(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', fontFamily: 'var(--font-serif)', fontSize: '1.25rem', fontWeight: '700' }}
                />
              </div>

              {/* Headline Assistant Box */}
              <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', border: '1px solid var(--border-medium)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-amber)' }}>
                    <Sparkles size={16} /> Headline Suggestions
                  </span>
                  <button 
                    onClick={handleGenerateHeadlines} 
                    className="btn btn-outline" 
                    style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                    disabled={isGenerating}
                  >
                    {isGenerating ? 'Generating...' : 'Suggest Variations'}
                  </button>
                </div>

                {headlineSuggestions.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-subtle)' }}>Click to apply alternative headline:</div>
                    {headlineSuggestions.map((sug, idx) => (
                      <button 
                        key={idx} 
                        onClick={() => setEditedTitle(sug)}
                        style={{ textAlign: 'left', background: 'var(--bg-surface)', padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer' }}
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Breaking News Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', background: 'var(--accent-crimson-bg)', padding: '0.8rem 1rem', borderRadius: 'var(--radius-sm)' }}>
                <input 
                  type="checkbox" 
                  id="breakingToggle" 
                  checked={isBreaking} 
                  onChange={(e) => setIsBreaking(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="breakingToggle" style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--accent-crimson)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Flame size={16} /> Mark Story as BREAKING NEWS (Publish to Homepage Ticker)
                </label>
              </div>

              {/* Story Content Preview */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: '700', marginBottom: '0.5rem' }}>Reporter Article Draft Body:</h4>
                <div style={{ background: 'var(--bg-primary)', padding: '1rem', borderRadius: 'var(--radius-sm)', fontSize: '0.95rem', lineHeight: '1.6', maxHeight: '250px', overflowY: 'auto' }}>
                  {selectedArticle.content}
                </div>
              </div>

              {/* Task 25: Editorial Fact-Check Verification & Sources Review */}
              <div style={{
                marginBottom: '1.5rem',
                background: '#F8FAFC',
                border: '1px solid #CBD5E1',
                padding: '1.1rem',
                borderRadius: 'var(--radius-sm)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.65rem', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.5rem' }}>
                  <ShieldCheck size={18} color="#059669" />
                  <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: '900', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                    Editorial Fact-Check Certification & Sources (सत्यापन प्रमाणन)
                  </h4>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: '800', display: 'block', marginBottom: '0.25rem', color: '#334155' }}>
                      Editorial Verification Rating
                    </label>
                    <select
                      value={factCheckRating}
                      onChange={(e) => setFactCheckRating(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #94A3B8', fontSize: '0.82rem', fontWeight: '700', background: '#FFFFFF' }}
                    >
                      <option value="Verified">Verified (प्रमाणित तथ्य)</option>
                      <option value="Official Statement">Official Statement (आधिकारिक बयान)</option>
                      <option value="Government Gazette">Government Gazette (राजपत्र अधिसूचना)</option>
                      <option value="Ground Report">Ground Report (मैदानी जांच)</option>
                      <option value="Under Review">Under Review (समीक्षाधीन)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: '800', display: 'block', marginBottom: '0.25rem', color: '#334155' }}>
                      Certified By Desk / Bureau
                    </label>
                    <input
                      type="text"
                      value={factCheckDesk}
                      onChange={(e) => setFactCheckDesk(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #94A3B8', fontSize: '0.82rem', background: '#FFFFFF' }}
                    />
                  </div>
                </div>

                {/* Reporter's cited sources */}
                <div style={{ borderTop: '1px dashed #CBD5E1', paddingTop: '0.65rem' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#0E2A47', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.4rem' }}>
                    <FileText size={14} /> Attached Primary Sources ({Array.isArray(selectedArticle.sources) ? selectedArticle.sources.length : 0})
                  </span>
                  {Array.isArray(selectedArticle.sources) && selectedArticle.sources.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {selectedArticle.sources.map((src, idx) => (
                        <div key={idx} style={{ background: '#FFFFFF', padding: '0.45rem 0.65rem', borderRadius: '4px', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                          <div>
                            <span style={{ fontWeight: '800', color: '#1E40AF', marginRight: '0.4rem' }}>[{src.type || 'Source'}]</span>
                            <span style={{ fontWeight: '700' }}>{src.title}</span>
                          </div>
                          {src.url && (
                            <a href={src.url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                              <span>Link</span> <ExternalLink size={12} />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.75rem', color: '#64748B', fontStyle: 'italic' }}>
                      Reporter attached no custom sources. Standard institutional citations (PIB / Gazette) will be applied.
                    </div>
                  )}
                </div>
              </div>

              {/* Action Approval Buttons */}
              <div style={{ display: 'flex', gap: '1rem', borderTop: '1px solid var(--border-light)', paddingTop: '1.25rem', flexWrap: 'wrap' }}>
                <button 
                  onClick={handleApprove} 
                  className="btn btn-primary" 
                  style={{ padding: '0.7rem 1.4rem', backgroundColor: 'var(--accent-emerald)' }}
                >
                  <CheckCircle size={16} /> Approve & Publish Story Immediately
                </button>
                <button 
                  onClick={() => setIsRejectModalOpen(true)} 
                  className="btn btn-outline" 
                  style={{ padding: '0.7rem 1.2rem', color: 'var(--accent-crimson)', borderColor: 'var(--accent-crimson)' }}
                >
                  <XCircle size={16} /> Request Changes / Reject
                </button>
              </div>
            </div>
          ) : (
            <div style={{ background: 'var(--bg-surface)', padding: '3.5rem 2rem', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'inline-flex', padding: '0.75rem', borderRadius: '50%', background: 'rgba(197, 34, 31, 0.08)', color: 'var(--accent-crimson)', marginBottom: '1rem' }}>
                <Edit3 size={28} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '0.4rem', fontFamily: 'var(--font-serif)' }}>
                Editorial Review Desk
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto' }}>
                Select any pending story from the left queue to inspect facts, fine-tune headlines, review video/media, and approve for instant publication.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Editorial Rejection & Changes Request Modal */}
      {isRejectModalOpen && selectedArticle && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(14, 42, 71, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10050,
          padding: '1rem'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '4px',
            border: '1px solid var(--border-medium)',
            width: '100%',
            maxWidth: '560px',
            padding: '1.5rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-medium)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: 'var(--accent-crimson)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <XCircle size={18} /> Request Changes / Reject Submission
              </h3>
              <button
                type="button"
                onClick={() => { setIsRejectModalOpen(false); setRejectionReason(''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              Story: <strong>"{selectedArticle.title}"</strong>
            </p>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '700', display: 'block', marginBottom: '0.35rem' }}>
                Feedback & Reason for Reporter:
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Specify what needs correction (e.g. Please verify source, add police quote, rewrite headline...)"
                rows={4}
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  borderRadius: '4px',
                  border: '1px solid var(--border-medium)',
                  fontSize: '16px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Quick Presets */}
            <div style={{ marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-subtle)', display: 'block', marginBottom: '0.35rem' }}>
                Quick Presets:
              </span>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {[
                  'Fact verification needed from official sources',
                  'Headline needs revision to reflect balanced reporting',
                  'Please provide primary source quotes and witness accounts',
                  'Spelling, grammar or formatting corrections required'
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setRejectionReason(preset)}
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: '600',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '3px',
                      border: '1px solid var(--border-medium)',
                      background: 'var(--bg-secondary)',
                      cursor: 'pointer'
                    }}
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => { setIsRejectModalOpen(false); setRejectionReason(''); }}
                className="btn btn-outline"
                style={{ minHeight: '36px', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onRejectArticle(selectedArticle.id, rejectionReason.trim() || 'Editorial review requested changes before publication.');
                  setIsRejectModalOpen(false);
                  setRejectionReason('');
                  setSelectedArticle(null);
                }}
                className="btn"
                style={{
                  minHeight: '36px',
                  padding: '0.5rem 1.25rem',
                  fontSize: '0.85rem',
                  fontWeight: '800',
                  background: '#DC2626',
                  color: '#FFFFFF',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Confirm Rejection & Send Feedback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
