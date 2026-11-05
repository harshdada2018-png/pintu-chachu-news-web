import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Clock, Radio, CheckCircle, AlertCircle, Image as ImageIcon, Flame, ExternalLink, RefreshCw } from 'lucide-react';
import MediaLibraryDesk from './MediaLibraryDesk';

/**
 * LiveUpdatesModal Component
 * Task 23 (Subtopic B): Fast micro-update editor posting timestamped bullets without full page reload.
 * Conforms to Rule 4 (Universal Responsive Design) & Sovereign Broadsheet Design System.
 */
export default function LiveUpdatesModal({ article, onClose, onUpdatesChanged, currentRole = 'admin' }) {
  const [updates, setUpdates] = useState(Array.isArray(article?.live_updates) ? article.live_updates : []);
  const [liveStatus, setLiveStatus] = useState(article?.live_status || 'active');
  const [isLoading, setIsLoading] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [filterKeyEventsOnly, setFilterKeyEventsOnly] = useState(false);

  // Form states
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [timestamp, setTimestamp] = useState(() => {
    return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  });
  const [isKeyEvent, setIsKeyEvent] = useState(false);
  const [mediaUrl, setMediaUrl] = useState('');
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);

  // Fetch latest updates on mount
  useEffect(() => {
    let isMounted = true;
    const fetchLatest = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/articles/${encodeURIComponent(article.id)}/live-updates`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.success) {
            setUpdates(data.live_updates || []);
            setLiveStatus(data.live_status || 'active');
          }
        }
      } catch (err) {
        console.error('Failed to fetch live updates:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchLatest();
    return () => { isMounted = false; };
  }, [article.id]);

  // Handle Post New Micro-Update
  const handlePostUpdate = async (e) => {
    e.preventDefault();
    if (!headline.trim() && !body.trim()) {
      setErrorMessage('Please provide a headline or bullet description for this update.');
      return;
    }

    setIsPosting(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/articles/${encodeURIComponent(article.id)}/live-updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headline: headline.trim(),
          body: body.trim(),
          timestamp: timestamp.trim() || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
          is_key_event: isKeyEvent,
          media_url: mediaUrl.trim() || null,
          author: currentRole === 'reporter' ? 'Field Reporter' : 'Editorial Desk'
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to post live update.');
      }

      // Update local state
      const updatedList = data.live_updates || [data.update, ...updates];
      setUpdates(updatedList);
      if (onUpdatesChanged) {
        onUpdatesChanged(updatedList);
      }

      // Reset form fields
      setHeadline('');
      setBody('');
      setIsKeyEvent(false);
      setMediaUrl('');
      setTimestamp(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }));
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsPosting(false);
    }
  };

  // Handle Delete Update
  const handleDeleteUpdate = async (updateId) => {
    if (!window.confirm('Are you sure you want to remove this live update? This cannot be undone.')) {
      return;
    }

    try {
      const res = await fetch(`/api/articles/${encodeURIComponent(article.id)}/live-updates/${encodeURIComponent(updateId)}`, {
        method: 'DELETE'
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete update.');
      }

      const updatedList = data.live_updates || updates.filter(u => u.id !== updateId);
      setUpdates(updatedList);
      if (onUpdatesChanged) {
        onUpdatesChanged(updatedList);
      }
    } catch (err) {
      alert(`Error deleting update: ${err.message}`);
    }
  };

  const displayedUpdates = filterKeyEventsOnly
    ? updates.filter(u => u.is_key_event)
    : updates;

  return (
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
      padding: '0.75rem',
      overflowY: 'auto'
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: '4px',
        border: '1px solid var(--border-medium)',
        width: '100%',
        maxWidth: '850px',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
        overflow: 'hidden'
      }}>
        {/* Header Bar */}
        <div style={{
          padding: '1rem 1.25rem',
          borderBottom: '1px solid var(--border-medium)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-primary)',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: '800',
                textTransform: 'uppercase',
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
                background: liveStatus === 'active' ? '#FEE2E2' : '#E5E7EB',
                color: liveStatus === 'active' ? '#B91C1C' : '#4B5563',
                border: liveStatus === 'active' ? '1px solid #F87171' : '1px solid #D1D5DB',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}>
                <Radio size={12} />
                {liveStatus === 'active' ? 'Live Blog: Active' : 'Live Blog: Concluded'}
              </span>
              <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-subtle)' }}>
                {updates.length} Updates Posted
              </span>
            </div>
            <h3 style={{
              fontSize: '1.05rem',
              fontWeight: '800',
              color: 'var(--text-main)',
              margin: '0.35rem 0 0 0',
              lineHeight: 1.3
            }}>
              {article.title}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="btn btn-outline"
            style={{
              minWidth: '44px',
              minHeight: '44px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.5rem',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
            title="Close Drawer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1 }}>
          {errorMessage && (
            <div style={{
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              color: '#991B1B',
              padding: '0.75rem 1rem',
              borderRadius: '4px',
              marginBottom: '1rem',
              fontSize: '0.85rem',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <AlertCircle size={16} />
              {errorMessage}
            </div>
          )}

          {/* Micro-Update Fast Editor Form */}
          <div style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-medium)',
            borderRadius: '4px',
            padding: '1rem',
            marginBottom: '1.5rem'
          }}>
            <h4 style={{
              fontSize: '0.9rem',
              fontWeight: '800',
              textTransform: 'uppercase',
              color: 'var(--text-main)',
              margin: '0 0 0.85rem 0',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}>
              <Plus size={15} color="var(--brand-primary)" /> Post New Live Micro-Update
            </h4>

            <form onSubmit={handlePostUpdate}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: '700', display: 'block', marginBottom: '0.25rem' }}>
                    Timestamp / Time Marker:
                  </label>
                  <input
                    type="text"
                    value={timestamp}
                    onChange={(e) => setTimestamp(e.target.value)}
                    placeholder="e.g. 10:45 AM or Just now"
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '4px',
                      border: '1px solid var(--border-medium)',
                      fontSize: '16px',
                      fontWeight: '600',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: '700', display: 'block', marginBottom: '0.25rem' }}>
                    Update Headline / One-Liner:
                  </label>
                  <input
                    type="text"
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder="e.g. Vote counting leads updated in Constituency 4"
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '4px',
                      border: '1px solid var(--border-medium)',
                      fontSize: '16px',
                      fontWeight: '700',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: '700', display: 'block', marginBottom: '0.25rem' }}>
                  Bullet Content / Body Details:
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Enter detailed micro-update, score, statement, or ground report..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '4px',
                    border: '1px solid var(--border-medium)',
                    fontSize: '16px',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '700' }}>
                  <input
                    type="checkbox"
                    checked={isKeyEvent}
                    onChange={(e) => setIsKeyEvent(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span>Mark as Key Highlight (Breaking Development)</span>
                </label>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setIsMediaPickerOpen(true)}
                    className="btn btn-outline"
                    style={{
                      minHeight: '36px',
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.78rem',
                      fontWeight: '700',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <ImageIcon size={14} /> {mediaUrl ? 'Change Image' : 'Attach Photo'}
                  </button>
                  {mediaUrl && (
                    <button
                      type="button"
                      onClick={() => setMediaUrl('')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--accent-crimson)',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: '700'
                      }}
                    >
                      Remove Photo
                    </button>
                  )}
                </div>
              </div>

              {mediaUrl && (
                <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#FFFFFF', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-medium)' }}>
                  <img src={mediaUrl} alt="Update attachment" style={{ width: '60px', height: '40px', objectFit: 'cover', borderRadius: '2px' }} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}>
                    {mediaUrl}
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  disabled={isPosting}
                  className="btn btn-primary"
                  style={{
                    minHeight: '44px',
                    padding: '0.6rem 1.25rem',
                    fontSize: '0.9rem',
                    fontWeight: '800',
                    background: '#0E2A47',
                    color: '#FFFFFF',
                    borderRadius: '4px',
                    cursor: isPosting ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem'
                  }}
                >
                  <Plus size={16} />
                  {isPosting ? 'Posting Update...' : 'Post Live Update'}
                </button>
              </div>
            </form>
          </div>

          {/* Updates Stream Listing */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: '800', margin: 0 }}>
                  Timeline Updates ({updates.length})
                </h4>
                {isLoading && <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>Syncing...</span>}
              </div>

              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => setFilterKeyEventsOnly(false)}
                  style={{
                    minHeight: '32px',
                    padding: '0.3rem 0.65rem',
                    fontSize: '0.75rem',
                    fontWeight: '800',
                    borderRadius: '4px',
                    border: !filterKeyEventsOnly ? '1px solid #0E2A47' : '1px solid var(--border-medium)',
                    background: !filterKeyEventsOnly ? '#0E2A47' : '#FFFFFF',
                    color: !filterKeyEventsOnly ? '#FFFFFF' : 'var(--text-main)',
                    cursor: 'pointer'
                  }}
                >
                  All ({updates.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterKeyEventsOnly(true)}
                  style={{
                    minHeight: '32px',
                    padding: '0.3rem 0.65rem',
                    fontSize: '0.75rem',
                    fontWeight: '800',
                    borderRadius: '4px',
                    border: filterKeyEventsOnly ? '1px solid #B91C1C' : '1px solid var(--border-medium)',
                    background: filterKeyEventsOnly ? '#B91C1C' : '#FFFFFF',
                    color: filterKeyEventsOnly ? '#FFFFFF' : 'var(--text-main)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                >
                  <Flame size={12} /> Highlights ({updates.filter(u => u.is_key_event).length})
                </button>
              </div>
            </div>

            {displayedUpdates.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '2.5rem 1rem',
                background: 'var(--bg-secondary)',
                borderRadius: '4px',
                border: '1px dashed var(--border-medium)'
              }}>
                <Clock size={28} color="var(--text-subtle)" style={{ margin: '0 auto 0.5rem auto', display: 'block' }} />
                <p style={{ margin: 0, fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                  No live updates found in this view.
                </p>
                <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-subtle)' }}>
                  Use the form above to publish real-time minute-by-minute updates to readers.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {displayedUpdates.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      background: '#FFFFFF',
                      border: item.is_key_event ? '1.5px solid #F87171' : '1px solid var(--border-medium)',
                      borderLeft: item.is_key_event ? '4px solid #DC2626' : '1px solid var(--border-medium)',
                      borderRadius: '4px',
                      padding: '0.85rem 1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.45rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.35rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: '800',
                          color: '#B91C1C',
                          background: '#FEE2E2',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}>
                          <Clock size={11} /> {item.timestamp}
                        </span>
                        {item.is_key_event && (
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: '800',
                            color: '#991B1B',
                            background: '#FECACA',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            textTransform: 'uppercase'
                          }}>
                            Key Highlight
                          </span>
                        )}
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                          By {item.author || 'Editorial Staff'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteUpdate(item.id)}
                        title="Delete Update"
                        style={{
                          minWidth: '32px',
                          minHeight: '32px',
                          background: 'none',
                          border: '1px solid #FECACA',
                          borderRadius: '4px',
                          color: '#DC2626',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0.25rem'
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    <h5 style={{ fontSize: '0.95rem', fontWeight: '800', margin: '0.15rem 0 0 0', color: 'var(--text-main)' }}>
                      {item.headline}
                    </h5>

                    {item.body && (
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-body)', margin: 0, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                        {item.body}
                      </p>
                    )}

                    {item.media_url && (
                      <div style={{ marginTop: '0.35rem' }}>
                        <img
                          src={item.media_url}
                          alt={item.headline}
                          style={{ maxHeight: '180px', maxWidth: '100%', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border-light)' }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Media Picker Modal if user clicks Attach Photo */}
      {isMediaPickerOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          zIndex: 10070,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            background: 'var(--bg-surface)',
            borderRadius: '4px',
            width: '100%',
            maxWidth: '1000px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border-medium)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: '800', fontSize: '0.95rem' }}>Select Image for Live Update</span>
              <button
                type="button"
                onClick={() => setIsMediaPickerOpen(false)}
                className="btn btn-outline"
                style={{ minWidth: '32px', minHeight: '32px', padding: '0.25rem 0.5rem' }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <MediaLibraryDesk
                currentRole={currentRole}
                onSelectAssetForStory={(asset) => {
                  setMediaUrl(asset.url);
                  setIsMediaPickerOpen(false);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

