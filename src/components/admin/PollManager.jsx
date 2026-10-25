import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  Plus, 
  Trash2, 
  RotateCcw, 
  Save, 
  HelpCircle, 
  ThumbsUp, 
  ThumbsDown, 
  Check, 
  AlertTriangle,
  Sparkles
} from 'lucide-react';

export default function PollManager() {
  const [poll, setPoll] = useState({
    enabled: true,
    id: 'poll-default-v1',
    question: 'क्या आप मानते हैं कि AI न्यूज़ रीडर डिजिटल पत्रकारिता की गति और विश्वसनीयता को बढ़ाते हैं?',
    options: [
      { id: 'opt-1', label: 'हाँ, बिल्कुल (Yes, absolutely)', votes: 1420 },
      { id: 'opt-2', label: 'नहीं, मानवीय संपादक ज़रूरी हैं (No, human editors are vital)', votes: 410 },
      { id: 'opt-3', label: 'तटस्थ / अनिश्चित (Neutral / Unsure)', votes: 121 }
    ],
    totalVotes: 1951
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [previewVoted, setPreviewVoted] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Fetch current poll from backend
  useEffect(() => {
    fetch('/api/poll')
      .then(res => res.json())
      .then(data => {
        if (data && data.question) {
          setPoll(data);
        }
      })
      .catch(err => {
        console.warn('[PollManager] Failed to fetch poll:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  // Update option label
  const handleOptionChange = (id, newLabel) => {
    setPoll(prev => ({
      ...prev,
      options: prev.options.map(opt => opt.id === id ? { ...opt, label: newLabel } : opt)
    }));
  };

  // Add new option
  const handleAddOption = () => {
    if (poll.options.length >= 5) {
      alert('Maximum 5 options allowed per poll.');
      return;
    }
    const newId = `opt-${Date.now().toString().slice(-4)}`;
    setPoll(prev => ({
      ...prev,
      options: [
        ...prev.options,
        { id: newId, label: `New Option ${prev.options.length + 1}`, votes: 0 }
      ]
    }));
  };

  // Delete option
  const handleDeleteOption = (id) => {
    if (poll.options.length <= 2) {
      alert('A poll requires at least 2 options.');
      return;
    }
    setPoll(prev => {
      const remaining = prev.options.filter(opt => opt.id !== id);
      const newTotal = remaining.reduce((sum, o) => sum + (o.votes || 0), 0);
      return {
        ...prev,
        options: remaining,
        totalVotes: newTotal
      };
    });
  };

  // Save changes to backend
  const handleSave = async (resetVotes = false) => {
    if (!poll.question.trim()) {
      alert('Poll question cannot be empty.');
      return;
    }
    const hasEmptyOption = poll.options.some(opt => !opt.label.trim());
    if (hasEmptyOption) {
      alert('All options must have text.');
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/poll/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': 'publicspark-admin-secret-key-2026'
        },
        body: JSON.stringify({
          enabled: poll.enabled,
          question: poll.question.trim(),
          options: poll.options,
          resetVotes: resetVotes
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');

      setPoll(data.poll);
      setFeedback({
        type: 'success',
        text: resetVotes 
          ? 'New poll activated & votes successfully reset to 0!' 
          : 'Poll configuration saved successfully & synced live to homepage!'
      });
      setShowResetConfirm(false);
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  const totalCalculatedVotes = poll.options.reduce((sum, o) => sum + (o.votes || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* HEADER ACTION BAR */}
      <div style={{
        background: 'var(--bg-surface)',
        padding: '1.25rem 1.5rem',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-medium)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              background: 'rgba(99, 102, 241, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-indigo)'
            }}>
              <BarChart3 size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'var(--text-main)', margin: 0 }}>
                Daily Reader Poll Manager (दैनिक पाठक पोल)
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', margin: '0.15rem 0 0 0' }}>
                Control live homepage public voting, customize question/options, and monitor reader engagement.
              </p>
            </div>
          </div>
        </div>

        {/* Master ON/OFF Switch & Save */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Toggle Switch */}
          <button
            type="button"
            onClick={() => {
              const nextState = !poll.enabled;
              setPoll(prev => ({ ...prev, enabled: nextState }));
            }}
            style={{
              padding: '0.5rem 0.9rem',
              borderRadius: 'var(--radius-sm)',
              border: poll.enabled ? '2px solid var(--accent-emerald)' : '1px solid var(--border-medium)',
              background: poll.enabled ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-secondary)',
              color: poll.enabled ? 'var(--accent-emerald)' : 'var(--text-subtle)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontSize: '0.85rem',
              fontWeight: '800',
              transition: 'all 0.15s ease'
            }}
            title={poll.enabled ? 'Click to disable and hide poll' : 'Click to enable and show poll'}
          >
            {poll.enabled ? <CheckCircle2 size={16} /> : <EyeOff size={16} />}
            <span>{poll.enabled ? 'Live on Site (सक्रिय)' : 'Hidden (निष्क्रिय)'}</span>
          </button>

          {/* Save Button */}
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={saving}
            className="btn btn-primary"
            style={{
              padding: '0.55rem 1.25rem',
              fontSize: '0.85rem',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              background: 'var(--accent-indigo)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: saving ? 'not-allowed' : 'pointer'
            }}
          >
            <Save size={16} />
            <span>{saving ? 'Saving...' : 'Save & Publish (सेव करें)'}</span>
          </button>
        </div>
      </div>

      {/* FEEDBACK BANNER */}
      {feedback && (
        <div style={{
          padding: '0.85rem 1.25rem',
          borderRadius: 'var(--radius-sm)',
          background: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
          border: `1px solid ${feedback.type === 'success' ? 'var(--accent-emerald)' : 'var(--accent-crimson)'}`,
          color: feedback.type === 'success' ? 'var(--accent-emerald)' : 'var(--accent-crimson)',
          fontSize: '0.875rem',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* MAIN 2-COLUMN SPLIT DESK (Responsive 1-Column on Mobile) */}
      <div className="poll-desk-layout">
        
        {/* LEFT COLUMN: EDIT FORM */}
        <div style={{
          background: 'var(--bg-surface)',
          padding: '1.5rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-medium)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem'
        }}>
          
          {/* Visibility Banner Status */}
          <div style={{
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-sm)',
            background: poll.enabled ? 'rgba(16, 185, 129, 0.08)' : 'rgba(100, 116, 139, 0.08)',
            borderLeft: `4px solid ${poll.enabled ? 'var(--accent-emerald)' : 'var(--text-subtle)'}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-main)' }}>
                Poll Status: {poll.enabled ? 'Active & Visible' : 'Disabled & Hidden'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                {poll.enabled 
                  ? 'Readers see this poll on the homepage sidebar.'
                  : 'Poll card is completely hidden from public view with zero empty space.'}
              </div>
            </div>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: '800',
              padding: '0.2rem 0.6rem',
              borderRadius: '999px',
              background: poll.enabled ? 'var(--accent-emerald)' : 'var(--text-subtle)',
              color: '#fff'
            }}>
              {poll.enabled ? 'LIVE' : 'OFF'}
            </span>
          </div>

          {/* 1. QUESTION INPUT */}
          <div>
            <label style={{
              fontSize: '0.88rem',
              fontWeight: '800',
              color: 'var(--text-main)',
              display: 'block',
              marginBottom: '0.4rem'
            }}>
              Poll Question (पोल का सवाल)
            </label>
            <textarea
              value={poll.question}
              onChange={(e) => setPoll({ ...poll, question: e.target.value })}
              rows={3}
              placeholder="e.g. क्या आप मानते हैं कि AI डिजिटल पत्रकारिता को बेहतर बना रहा है?"
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-medium)',
                background: 'var(--bg-main)',
                color: 'var(--text-main)',
                fontSize: '0.92rem',
                fontWeight: '600',
                lineHeight: '1.4',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
            <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', marginTop: '0.25rem' }}>
              Write in Hindi, English, or any regional language. Keep questions clear and thought-provoking.
            </div>
          </div>

          {/* 2. OPTIONS EDITOR */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <label style={{ fontSize: '0.88rem', fontWeight: '800', color: 'var(--text-main)' }}>
                Poll Options ({poll.options.length})
              </label>
              {poll.options.length < 5 && (
                <button
                  type="button"
                  onClick={handleAddOption}
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    color: 'var(--accent-indigo)',
                    background: 'rgba(99, 102, 241, 0.08)',
                    border: '1px solid var(--accent-indigo)',
                    padding: '0.25rem 0.6rem',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem'
                  }}
                >
                  <Plus size={14} /> Add Option
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {poll.options.map((opt, index) => {
                const pct = totalCalculatedVotes > 0 
                  ? Math.round(((opt.votes || 0) / totalCalculatedVotes) * 100) 
                  : 0;

                return (
                  <div
                    key={opt.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      background: 'var(--bg-secondary)',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-light)'
                    }}
                  >
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: '800',
                      color: 'var(--text-subtle)',
                      width: '24px',
                      textAlign: 'center',
                      flexShrink: 0
                    }}>
                      #{index + 1}
                    </span>

                    <input
                      type="text"
                      value={opt.label}
                      onChange={(e) => handleOptionChange(opt.id, e.target.value)}
                      placeholder={`Option ${index + 1} text`}
                      style={{
                        flex: 1,
                        padding: '0.45rem 0.65rem',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-medium)',
                        background: 'var(--bg-main)',
                        color: 'var(--text-main)'
                      }}
                    />

                    {/* Current Votes Badge */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      flexShrink: 0,
                      minWidth: '65px'
                    }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: '800', color: 'var(--text-main)' }}>
                        {opt.votes || 0} votes
                      </span>
                      <span style={{ fontSize: '0.68rem', fontWeight: '700', color: 'var(--accent-indigo)' }}>
                        {pct}%
                      </span>
                    </div>

                    {/* Delete Option Button */}
                    {poll.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteOption(opt.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--accent-crimson)',
                          cursor: 'pointer',
                          padding: '0.3rem',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                        title="Delete option"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. DANGER ZONE: RESET VOTES */}
          <div style={{
            borderTop: '1px solid var(--border-light)',
            paddingTop: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <div style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-main)' }}>
              New Poll Topic & Vote Reset
            </div>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-subtle)', margin: 0, lineHeight: 1.4 }}>
              When starting a brand new question, reset votes to 0 so all readers can cast fresh votes without old numbers carrying over.
            </p>

            {!showResetConfirm ? (
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                style={{
                  alignSelf: 'flex-start',
                  padding: '0.45rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-medium)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-main)',
                  fontSize: '0.78rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <RotateCcw size={14} /> Reset Votes for New Poll
              </button>
            ) : (
              <div style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid var(--accent-crimson)',
                padding: '0.85rem',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.6rem'
              }}>
                <div style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--accent-crimson)' }}>
                  Are you sure? This will wipe all {totalCalculatedVotes} votes back to 0.
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => handleSave(true)}
                    disabled={saving}
                    style={{
                      padding: '0.4rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--accent-crimson)',
                      color: '#fff',
                      border: 'none',
                      fontSize: '0.78rem',
                      fontWeight: '800',
                      cursor: saving ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Yes, Reset Votes to 0 & Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(false)}
                    style={{
                      padding: '0.4rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-main)',
                      color: 'var(--text-subtle)',
                      border: '1px solid var(--border-medium)',
                      fontSize: '0.78rem',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: REAL-TIME HOMEPAGE PREVIEW */}
        <div style={{
          position: 'sticky',
          top: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-subtle)' }}>
              Live Homepage Preview
            </span>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <button
                type="button"
                onClick={() => setPreviewVoted(false)}
                style={{
                  padding: '0.2rem 0.55rem',
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  borderRadius: '4px',
                  border: '1px solid',
                  borderColor: !previewVoted ? 'var(--accent-indigo)' : 'var(--border-medium)',
                  background: !previewVoted ? 'var(--accent-indigo)' : 'var(--bg-surface)',
                  color: !previewVoted ? '#fff' : 'var(--text-subtle)',
                  cursor: 'pointer'
                }}
              >
                Unvoted
              </button>
              <button
                type="button"
                onClick={() => setPreviewVoted(true)}
                style={{
                  padding: '0.2rem 0.55rem',
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  borderRadius: '4px',
                  border: '1px solid',
                  borderColor: previewVoted ? 'var(--accent-indigo)' : 'var(--border-medium)',
                  background: previewVoted ? 'var(--accent-indigo)' : 'var(--bg-surface)',
                  color: previewVoted ? '#fff' : 'var(--text-subtle)',
                  cursor: 'pointer'
                }}
              >
                Voted Results
              </button>
            </div>
          </div>

          {/* PREVIEW WIDGET CARD */}
          {!poll.enabled ? (
            <div style={{
              background: 'var(--bg-surface)',
              border: '2px dashed var(--border-medium)',
              borderRadius: 'var(--radius-bento)',
              padding: '2.5rem 1.5rem',
              textAlign: 'center',
              color: 'var(--text-subtle)'
            }}>
              <EyeOff size={32} style={{ margin: '0 auto 0.75rem auto', opacity: 0.5 }} />
              <div style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                Poll is Currently Hidden
              </div>
              <div style={{ fontSize: '0.75rem' }}>
                When switched off, the poll card does not appear on the website and no gap or blank area is left.
              </div>
            </div>
          ) : (
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-bento)',
              padding: '1.25rem',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                color: 'var(--accent-indigo)',
                fontSize: '0.8rem',
                fontWeight: '800',
                textTransform: 'uppercase',
                marginBottom: '0.6rem',
                letterSpacing: '0.05em'
              }}>
                <BarChart3 size={15} /> DAILY READER POLL
              </div>

              <h4 style={{
                fontSize: '0.95rem',
                fontWeight: '800',
                lineHeight: '1.35',
                marginBottom: '1rem',
                color: 'var(--text-main)'
              }}>
                "{poll.question}"
              </h4>

              {!previewVoted ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {poll.options.map((opt, i) => {
                    const iconColor = i === 0 ? 'var(--accent-indigo)' : i === 1 ? 'var(--accent-crimson)' : 'var(--text-subtle)';
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setPreviewVoted(true)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '0.55rem 0.85rem',
                          fontSize: '0.85rem',
                          fontWeight: '700',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-medium)',
                          background: 'var(--bg-main)',
                          color: 'var(--text-main)',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: iconColor, flexShrink: 0 }}></div>
                        <span style={{ flex: 1 }}>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {poll.options.map((opt, i) => {
                    const pct = totalCalculatedVotes > 0 
                      ? Math.round(((opt.votes || 0) / totalCalculatedVotes) * 100) 
                      : 0;
                    const barColor = i === 0 ? 'var(--accent-indigo)' : i === 1 ? 'var(--accent-crimson)' : 'var(--accent-amber)';

                    return (
                      <div key={opt.id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: '800', marginBottom: '0.2rem' }}>
                          <span style={{ color: 'var(--text-main)' }}>{opt.label} ({opt.votes || 0})</span>
                          <span style={{ color: 'var(--text-subtle)' }}>{pct}%</span>
                        </div>
                        <div style={{ height: '8px', background: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: barColor, transition: 'width 0.5s ease' }}></div>
                        </div>
                      </div>
                    );
                  })}

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem',
                    fontSize: '0.75rem',
                    color: 'var(--accent-emerald)',
                    fontWeight: '700',
                    marginTop: '0.4rem',
                    textAlign: 'center'
                  }}>
                    <Check size={14} />
                    <span>Vote Recorded ({totalCalculatedVotes.toLocaleString()} readers voted)</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STATS SUMMARY BOX */}
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-sm)',
            padding: '1rem',
            fontSize: '0.8rem',
            color: 'var(--text-subtle)',
            display: 'flex',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontWeight: '800', color: 'var(--text-main)', fontSize: '1.1rem' }}>
                {totalCalculatedVotes.toLocaleString()}
              </div>
              <div>Total Recorded Votes</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: '800', color: 'var(--text-main)', fontSize: '1.1rem' }}>
                {poll.options.length}
              </div>
              <div>Active Choices</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
