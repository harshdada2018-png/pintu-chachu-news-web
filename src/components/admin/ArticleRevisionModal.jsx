import React, { useState, useEffect } from 'react';
import { 
  History, RotateCcw, X, Clock, User, FileText, 
  Check, AlertCircle, ShieldCheck, Eye, Layers, ArrowLeft
} from 'lucide-react';
import { 
  fetchArticleRevisions, 
  rollbackArticleRevision, 
  formatRevisionTime, 
  computeWordDelta 
} from '../../services/revisionService';

/**
 * PublicSpark Newsroom — Article Revision History & 1-Click Rollback Desk (Task 21)
 * Sovereign broadsheet design for auditing past edits and restoring previous versions
 */
export default function ArticleRevisionModal({ 
  article, 
  currentRole = 'editor', 
  currentUser = null,
  onClose, 
  onRollbackSuccess 
}) {
  const [revisions, setRevisions] = useState([]);
  const [selectedRevisionId, setSelectedRevisionId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [confirmingRollback, setConfirmingRollback] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');

  const isReporter = (currentRole || '').toLowerCase() === 'reporter';
  const editorName = currentUser?.name || (currentRole === 'admin' ? 'Administrator' : 'Editor');

  // Load revisions on mount
  useEffect(() => {
    let isMounted = true;
    async function loadRevisions() {
      if (!article?.id) return;
      setIsLoading(true);
      setErrorMessage('');
      try {
        const list = await fetchArticleRevisions(article.id);
        if (isMounted) {
          setRevisions(list);
          if (list.length > 0) {
            setSelectedRevisionId(list[0].revisionId);
          }
        }
      } catch (err) {
        if (isMounted) {
          setErrorMessage('Could not load revision history: ' + err.message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    loadRevisions();
    return () => { isMounted = false; };
  }, [article?.id]);

  const selectedRev = revisions.find(r => r.revisionId === selectedRevisionId) || revisions[0] || null;
  const isLatestRevision = selectedRev && revisions.length > 0 && selectedRev.revisionId === revisions[0].revisionId;

  // Current live article stats
  const currentContent = typeof article?.content === 'string' ? article.content : '';
  const currentWordCount = currentContent.trim().split(/\s+/).filter(Boolean).length;

  const handleTriggerRollback = async () => {
    if (!selectedRev || isLatestRevision || isReporter) return;
    setIsRollingBack(true);
    setErrorMessage('');
    try {
      const result = await rollbackArticleRevision(
        article.id,
        selectedRev.revisionId,
        currentRole,
        editorName
      );

      if (result.success) {
        setFeedbackMessage(`Successfully restored story to version saved on ${formatRevisionTime(selectedRev.timestamp)}.`);
        setConfirmingRollback(false);
        if (Array.isArray(result.revisions)) {
          setRevisions(result.revisions);
          setSelectedRevisionId(result.revisions[0]?.revisionId || selectedRev.revisionId);
        }
        if (onRollbackSuccess && result.article) {
          onRollbackSuccess(result.article);
        }
      }
    } catch (err) {
      setErrorMessage(err.message || 'Rollback failed.');
    } finally {
      setIsRollingBack(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(15, 23, 42, 0.72)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1rem'
    }}>
      <div style={{
        background: 'var(--bg-surface)',
        width: '100%',
        maxWidth: '1040px',
        maxHeight: '92vh',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-medium)',
        boxShadow: '0 20px 45px rgba(0, 0, 0, 0.28)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '1rem 1.25rem',
          borderBottom: '1px solid var(--border-light)',
          background: 'var(--bg-secondary)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <History size={18} color="var(--accent-indigo)" />
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-main)' }}>
                Article Revision History & Rollback Desk
              </h3>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: '700',
                padding: '0.15rem 0.5rem',
                borderRadius: '4px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-subtle)'
              }}>
                {revisions.length} {revisions.length === 1 ? 'Snapshot' : 'Snapshots'}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-subtle)', maxWidth: '720px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Story: "{article?.title || 'Untitled'}"
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn btn-outline"
            style={{ padding: '0.4rem', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Close Revisions Modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Feedback / Error Alerts */}
        {feedbackMessage && (
          <div style={{ background: '#ECFDF5', borderBottom: '1px solid #A7F3D0', padding: '0.65rem 1.25rem', color: '#065F46', fontSize: '0.8rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Check size={16} color="#059669" />
            <span>{feedbackMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div style={{ background: '#FEF2F2', borderBottom: '1px solid #FECACA', padding: '0.65rem 1.25rem', color: '#991B1B', fontSize: '0.8rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={16} color="#DC2626" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Modal Body: Split View (Timeline on Left, Inspector on Right) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 340px) 1fr',
          flex: '1 1 auto',
          minHeight: 0,
          overflow: 'hidden'
        }}>
          {/* Left Column: Revision Timeline List */}
          <div style={{
            borderRight: '1px solid var(--border-light)',
            background: 'var(--bg-secondary)',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0
          }}>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-light)', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Version Timeline (Newest to Oldest)
            </div>

            <div style={{ flex: '1 1 auto', overflowY: 'auto', padding: '0.65rem' }}>
              {isLoading ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-subtle)', fontSize: '0.82rem' }}>
                  Loading revision timeline...
                </div>
              ) : revisions.length === 0 ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-subtle)', fontSize: '0.82rem' }}>
                  No past revisions recorded yet. Revisions are created automatically upon every story edit.
                </div>
              ) : (
                revisions.map((rev, idx) => {
                  const isSelected = rev.revisionId === selectedRevisionId;
                  const isLatest = idx === 0;
                  const versionNum = revisions.length - idx;

                  return (
                    <div
                      key={rev.revisionId}
                      onClick={() => { setSelectedRevisionId(rev.revisionId); setConfirmingRollback(false); }}
                      style={{
                        padding: '0.75rem 0.85rem',
                        marginBottom: '0.5rem',
                        borderRadius: 'var(--radius-sm)',
                        border: isSelected ? '1.5px solid var(--accent-blue)' : '1px solid var(--border-light)',
                        background: isSelected ? 'var(--bg-surface)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: isSelected ? '0 2px 8px rgba(0, 0, 0, 0.05)' : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: '800',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            background: isLatest ? '#DBEAFE' : 'var(--bg-secondary)',
                            color: isLatest ? '#1D4ED8' : 'var(--text-main)',
                            border: '1px solid var(--border-light)'
                          }}>
                            v{versionNum} {isLatest && '(Live)'}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', fontWeight: '600' }}>
                            {formatRevisionTime(rev.timestamp)}
                          </span>
                        </div>
                      </div>

                      <div style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {rev.changeNote || 'Story content updated'}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.7rem', color: 'var(--text-subtle)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                          <User size={11} /> {rev.authorName} ({rev.editorRole})
                        </span>
                        <span>•</span>
                        <span>{rev.wordCount} words</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Selected Snapshot Inspector */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            background: 'var(--bg-surface)'
          }}>
            {selectedRev ? (
              <>
                {/* Snapshot Meta Bar */}
                <div style={{
                  padding: '0.85rem 1.25rem',
                  borderBottom: '1px solid var(--border-light)',
                  background: 'var(--bg-secondary)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-main)' }}>
                        Snapshot Saved: {formatRevisionTime(selectedRev.timestamp)}
                      </span>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: '700',
                        padding: '0.1rem 0.45rem',
                        borderRadius: '4px',
                        background: selectedRev.status === 'published' ? '#D1FAE5' : '#FEF3C7',
                        color: selectedRev.status === 'published' ? '#065F46' : '#92400E'
                      }}>
                        Status: {selectedRev.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>
                      Saved by: <strong style={{ color: 'var(--text-main)' }}>{selectedRev.authorName}</strong> ({selectedRev.editorRole}) • Change note: <em>"{selectedRev.changeNote}"</em>
                    </div>
                  </div>

                  {/* Metrics Badge */}
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '0.74rem',
                      fontWeight: '700',
                      padding: '0.25rem 0.6rem',
                      borderRadius: '4px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-main)'
                    }}>
                      Words: {selectedRev.wordCount} ({computeWordDelta(currentWordCount, selectedRev.wordCount)})
                    </span>
                    <span style={{
                      fontSize: '0.74rem',
                      fontWeight: '700',
                      padding: '0.25rem 0.6rem',
                      borderRadius: '4px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-subtle)'
                    }}>
                      Chars: {selectedRev.charCount}
                    </span>
                  </div>
                </div>

                {/* Snapshot Content Viewer */}
                <div style={{ flex: '1 1 auto', overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
                  {/* Category Pill */}
                  <div style={{ marginBottom: '0.65rem' }}>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: '800',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'var(--accent-crimson)',
                      borderBottom: '2px solid var(--accent-crimson)',
                      paddingBottom: '2px'
                    }}>
                      {selectedRev.category || 'General'}
                    </span>
                  </div>

                  {/* Headline Preview */}
                  <h2 style={{
                    fontSize: '1.35rem',
                    fontWeight: '800',
                    lineHeight: '1.35',
                    color: 'var(--text-main)',
                    margin: '0 0 0.5rem 0'
                  }}>
                    {selectedRev.title}
                  </h2>

                  {/* Standfirst / Subtitle Preview */}
                  {selectedRev.sub_title && (
                    <div style={{
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      color: 'var(--text-muted)',
                      fontStyle: 'italic',
                      lineHeight: '1.45',
                      marginBottom: '1rem',
                      borderLeft: '3px solid var(--accent-blue)',
                      paddingLeft: '0.75rem'
                    }}>
                      {selectedRev.sub_title}
                    </div>
                  )}

                  {/* Teaser Summary if any */}
                  {selectedRev.summary && (
                    <div style={{
                      background: 'var(--bg-secondary)',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.78rem',
                      color: 'var(--text-subtle)',
                      marginBottom: '1rem',
                      border: '1px solid var(--border-light)'
                    }}>
                      <strong>Summary:</strong> {selectedRev.summary}
                    </div>
                  )}

                  {/* Story Body Copy Preview */}
                  <div style={{
                    fontSize: '0.9rem',
                    lineHeight: '1.65',
                    color: 'var(--text-main)',
                    whiteSpace: 'pre-wrap',
                    background: 'var(--bg-secondary)',
                    padding: '1rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-light)',
                    fontFamily: 'serif'
                  }}>
                    {selectedRev.content || '(Empty story body)'}
                  </div>
                </div>

                {/* Action Bar Footer */}
                <div style={{
                  padding: '0.85rem 1.25rem',
                  borderTop: '1px solid var(--border-light)',
                  background: 'var(--bg-secondary)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '1rem'
                }}>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-subtle)' }}>
                    {isLatestRevision ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#059669', fontWeight: '700' }}>
                        <Check size={14} /> This snapshot is identical to the current active story.
                      </span>
                    ) : (
                      <span>Rollback restores headline, subtitle, body copy, and metadata to this snapshot.</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {isReporter ? (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        color: '#92400E',
                        background: '#FEF3C7',
                        padding: '0.4rem 0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid #FDE68A'
                      }}>
                        <ShieldCheck size={14} /> Editorial Gate: Reporters view-only
                      </div>
                    ) : isLatestRevision ? (
                      <button
                        type="button"
                        disabled
                        className="btn btn-outline"
                        style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', opacity: 0.6, cursor: 'not-allowed' }}
                      >
                        Currently Active Version
                      </button>
                    ) : confirmingRollback ? (
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => setConfirmingRollback(false)}
                          className="btn btn-outline"
                          style={{ padding: '0.5rem 0.85rem', fontSize: '0.78rem' }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleTriggerRollback}
                          disabled={isRollingBack}
                          className="btn btn-primary"
                          style={{
                            padding: '0.5rem 1rem',
                            fontSize: '0.8rem',
                            fontWeight: '800',
                            background: 'var(--accent-crimson)',
                            borderColor: 'var(--accent-crimson)',
                            color: '#ffffff',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem'
                          }}
                        >
                          <RotateCcw size={14} />
                          {isRollingBack ? 'Restoring...' : 'Confirm Rollback'}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmingRollback(true)}
                        className="btn btn-primary"
                        style={{
                          padding: '0.5rem 1.15rem',
                          fontSize: '0.8rem',
                          fontWeight: '800',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem'
                        }}
                      >
                        <RotateCcw size={14} /> Rollback to This Version
                      </button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-subtle)', fontSize: '0.85rem' }}>
                Select a revision from the left column to inspect and compare snapshots.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

