import React, { useState } from 'react';
import { CheckCircle, Flame, Sparkles, XCircle, Clock, Eye, Edit3, ShieldAlert } from 'lucide-react';

export default function EditorWorkspace({ pendingArticles, onApproveArticle, onRejectArticle }) {
  const [selectedArticle, setSelectedArticle] = useState(pendingArticles[0] || null);
  const [editedTitle, setEditedTitle] = useState(selectedArticle?.title || '');
  const [isBreaking, setIsBreaking] = useState(false);
  const [headlineSuggestions, setHeadlineSuggestions] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Select article to review
  const handleSelectArticle = (art) => {
    setSelectedArticle(art);
    setEditedTitle(art.title);
    setIsBreaking(art.is_breaking || false);
    setHeadlineSuggestions([]);
  };

  // Editorial Headline Assistance
  const handleGenerateHeadlines = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setHeadlineSuggestions([
        `🔥 ${selectedArticle.title} — Key Takeaways & Impact`,
        `BREAKING: ${selectedArticle.title.split(':')[0] || selectedArticle.title}`,
        `In-Depth Report: ${selectedArticle.title}`
      ]);
    }, 500);
  };

  const handleApprove = () => {
    if (!selectedArticle) return;
    onApproveArticle(selectedArticle.id, editedTitle, isBreaking);
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
          <div style={{ background: '#ECFDF5', color: 'var(--accent-emerald)', padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', fontWeight: '700' }}>
            Queue: {pendingArticles.length} Stories Awaiting Review
          </div>
        </div>
      </div>

      <div className="workspace-grid">
        {/* Submissions Queue List */}
        <div className="workspace-sidebar">
          <h4 style={{ fontSize: '0.85rem', fontWeight: '900', textTransform: 'uppercase', color: 'var(--text-subtle)', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
            Pending Review
          </h4>
          {pendingArticles.length === 0 ? (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-subtle)', fontStyle: 'italic', padding: '1rem 0' }}>
              No pending articles in review queue.
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
                <div style={{ fontSize: '0.75rem', color: 'var(--accent-crimson)', fontWeight: '700', textTransform: 'uppercase' }}>
                  {art.category}
                </div>
                <div style={{ fontWeight: '700', fontSize: '0.9rem', margin: '0.2rem 0 0.4rem 0', lineHeight: '1.3' }}>
                  {art.title}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                  By {art.author?.name || 'Reporter'} • {art.published_at}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span className="story-category-tag">{selectedArticle.category}</span>
                <span className="badge badge-live">
                  <Clock size={12} /> Pending Approval
                </span>
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

              {/* Action Approval Buttons */}
              <div style={{ display: 'flex', gap: '1rem', borderTop: '1px solid var(--border-light)', paddingTop: '1.25rem' }}>
                <button 
                  onClick={handleApprove} 
                  className="btn btn-primary" 
                  style={{ padding: '0.7rem 1.4rem', backgroundColor: 'var(--accent-emerald)' }}
                >
                  <CheckCircle size={16} /> Approve & Publish Story Immediately
                </button>
                <button 
                  onClick={() => onRejectArticle(selectedArticle.id)} 
                  className="btn btn-outline" 
                  style={{ padding: '0.7rem 1.2rem', color: 'var(--accent-crimson)', borderColor: 'var(--accent-crimson)' }}
                >
                  <XCircle size={16} /> Request Changes / Reject
                </button>
              </div>
            </div>
          ) : (
            <div style={{ background: 'var(--bg-surface)', padding: '3rem', borderRadius: 'var(--radius-md)', textAlign: 'center', color: 'var(--text-subtle)' }}>
              Select a story from the left queue to review and publish.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
