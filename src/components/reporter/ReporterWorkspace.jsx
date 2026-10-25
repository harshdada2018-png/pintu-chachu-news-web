import React, { useState, useEffect } from 'react';
import { PenTool, Upload, FileText, Send, CheckCircle, Clock, AlertCircle, Image as ImageIcon, Sparkles, Plus, Trash2, Check, RefreshCw, Languages, Lock } from 'lucide-react';
import { MOCK_CATEGORIES } from '../../services/mockData';
import { compressImageToWebP } from '../../services/mediaService';
import { SUPPORTED_LANGUAGES } from '../../services/translationService';

export default function ReporterWorkspace({ onAddNewArticle, categories }) {
  const activeCategories = categories && categories.length > 0 ? categories : MOCK_CATEGORIES;
  const [activeTab, setActiveTab] = useState('create');
  
  const DRAFT_KEY = 'ps_reporter_draft_v1';

  // Restore saved draft on initialization if available
  const initialDraft = (() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  })();

  // Language Gate: Mandatory selection before writing
  const [originalLanguage, setOriginalLanguage] = useState(initialDraft?.originalLanguage || '');

  // Strict 5 Form Fields per User Specification with Draft Persistence + Optional Video
  const [title, setTitle] = useState(initialDraft?.title || '');
  const [content, setContent] = useState(initialDraft?.content || '');
  const [category, setCategory] = useState(initialDraft?.category || activeCategories[0]?.name || 'National');
  const [tags, setTags] = useState(initialDraft?.tags || 'News, Ground Report, Verified');
  const [videoUrl, setVideoUrl] = useState(initialDraft?.videoUrl || '');
  
  // Image with Caption & Credit
  const [imagePreview, setImagePreview] = useState(initialDraft?.imagePreview || null);
  const [imageCaption, setImageCaption] = useState(initialDraft?.imageCaption || '');
  const [mediaCredits, setMediaCredits] = useState(initialDraft?.mediaCredits || 'PublicSpark Bureau');
  const [isCompressing, setIsCompressing] = useState(false);
  const [isImageReady, setIsImageReady] = useState(!!initialDraft?.imagePreview);
  const [imageStats, setImageStats] = useState(null);

  // Pre-Publish AI "In 30 Seconds" 2-3 Points & Hindi Spelling Verification
  const [highlights, setHighlights] = useState(initialDraft?.highlights || []);
  const [isDraftingAi, setIsDraftingAi] = useState(false);
  const [spellingNote, setSpellingNote] = useState('');
  const [improvedTitleSuggestion, setImprovedTitleSuggestion] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [hasDraftRestored, setHasDraftRestored] = useState(!!(initialDraft && (initialDraft.originalLanguage || initialDraft.title || initialDraft.content)));

  // Real-time draft auto-save to localStorage
  useEffect(() => {
    if (originalLanguage || title.trim() || content.trim() || imagePreview || videoUrl) {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
          originalLanguage,
          title,
          content,
          category,
          tags,
          videoUrl,
          imagePreview: imagePreview && imagePreview.length < 500000 ? imagePreview : null,
          imageCaption,
          mediaCredits,
          highlights,
          savedAt: Date.now()
        }));
      } catch (e) {
        console.warn('Draft auto-save error:', e);
      }
    }
  }, [originalLanguage, title, content, category, tags, videoUrl, imagePreview, imageCaption, mediaCredits, highlights]);

  const handleDiscardDraft = () => {
    if (window.confirm('क्या आप सचमुच इस अनसेव्ड ड्राफ्ट को हटाना चाहते हैं?')) {
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch (e) {}
      setOriginalLanguage('');
      setTitle('');
      setContent('');
      setVideoUrl('');
      setImageCaption('');
      setImagePreview(null);
      setIsImageReady(false);
      setHighlights([]);
      setSpellingNote('');
      setImprovedTitleSuggestion('');
      setHasDraftRestored(false);
    }
  };

  // Submissions list with LocalStorage persistence
  const [myStories, setMyStories] = useState(() => {
    try {
      const raw = localStorage.getItem('ps_reporter_my_stories_v1');
      return raw ? JSON.parse(raw) : [
        {
          id: 'my-1',
          title: 'ISRO का नया कीर्तिमान: स्वदेशी उपग्रह प्रणाली स्थापित',
          category: 'Science & Environment',
          status: 'published',
          updated_at: 'आज, 14:20 IST'
        }
      ];
    } catch(e) {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('ps_reporter_my_stories_v1', JSON.stringify(myStories));
    } catch(e) {}
  }, [myStories]);

  // Image Upload Processing
  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setIsCompressing(true);
      setIsImageReady(false);
      const result = await compressImageToWebP(file, 200, 1200);
      setImageStats({
        originalKB: result.originalKB,
        compressedKB: result.compressedKB,
        savedPercent: Math.max(0, Math.round(((result.originalKB - result.compressedKB) / result.originalKB) * 100))
      });

      // Upload compressed WebP to backend for persistent standalone URL
      let finalImageUrl = result.dataUrl;
      try {
        const uploadRes = await fetch('/api/upload/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: result.dataUrl,
            articleId: 'reporter'
          })
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          if (uploadData && uploadData.url) {
            finalImageUrl = uploadData.url;
          }
        }
      } catch (uploadErr) {
        console.warn('[Image Upload Backend Fallback to local DataURL]:', uploadErr.message);
      }

      setImagePreview(finalImageUrl);
      setIsImageReady(true);
      if (!imageCaption && title) {
        setImageCaption(title);
      }
    } catch (err) {
      console.error('Image upload error:', err);
      alert('Failed to process image. Please try another file.');
    } finally {
      setIsCompressing(false);
    }
  };

  // Pre-Publish Single-Call AI Generator (2-3 Points + Hindi Spell Check)
  const handleGeneratePreDraft = async () => {
    if (!title.trim() || !content.trim()) {
      alert('कृपया पहले शीर्षक (Headline) और समाचार विवरण (Body) लिखें।');
      return;
    }

    try {
      setIsDraftingAi(true);
      const res = await fetch('/api/article/pre-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          body: content
        })
      });

      if (!res.ok) {
        throw new Error('AI Pre-draft service failed');
      }

      const data = await res.json();
      if (data && data.highlights && data.highlights.length > 0) {
        setHighlights(data.highlights);
        if (data.improvedTitle && data.improvedTitle !== title) {
          setImprovedTitleSuggestion(data.improvedTitle);
        } else {
          setImprovedTitleSuggestion('');
        }
        setSpellingNote(data.correctionsNote || 'हिंदी वर्तनी और व्याकरण की जांच पूर्ण: सब कुछ सही है।');
      }
    } catch (err) {
      console.error('[AI Pre-draft Error]', err);
      // Fallback simple highlight extract if AI fails
      const paras = content.split(/\n+/).filter(p => p.trim());
      setHighlights([
        paras[0] ? paras[0].slice(0, 120) + '...' : title,
        'विस्तृत और सत्यापित समाचार रिपोर्ट।'
      ]);
      setSpellingNote('ऑफलाइन मोड: स्वतः सारांश बिंदु बनाए गए।');
    } finally {
      setIsDraftingAi(false);
    }
  };

  const handleHighlightChange = (index, val) => {
    const updated = [...highlights];
    updated[index] = val;
    setHighlights(updated);
  };

  const handleAddHighlightPoint = () => {
    if (highlights.length < 5) {
      setHighlights([...highlights, '']);
    }
  };

  const handleRemoveHighlightPoint = (index) => {
    setHighlights(highlights.filter((_, i) => i !== index));
  };

  const handleApplyImprovedTitle = () => {
    if (improvedTitleSuggestion) {
      setTitle(improvedTitleSuggestion);
      setImprovedTitleSuggestion('');
    }
  };

  // Publish Story Immediately Live
  const handlePublishStory = (e) => {
    e.preventDefault();
    if (!originalLanguage) {
      alert('कृपया पहले समाचार की भाषा (Article Language) चुनें। बिना भाषा चुने समाचार सबमिट नहीं किया जा सकता।');
      return;
    }
    if (!title.trim() || !content.trim()) {
      alert('कृपया शीर्षक और मुख्य समाचार भरें।');
      return;
    }

    // Default highlights if not generated yet
    const finalHighlights = highlights.filter(h => h && h.trim().length > 0);
    if (finalHighlights.length === 0) {
      finalHighlights.push(content.slice(0, 140) + '...');
    }

    const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);

    const newStory = {
      id: `art-${Date.now()}`,
      originalLanguage: originalLanguage,
      title: title.trim(),
      sub_title: finalHighlights[0] || '',
      category,
      category_slug: category.toLowerCase().replace(/\s+/g, '-'),
      content: content.trim(),
      summary: finalHighlights[0] || content.slice(0, 140) + '...',
      highlights: finalHighlights,
      tags: tagList,
      format: videoUrl.trim() ? 'video' : 'standard',
      video_url: videoUrl.trim() || null,
      featured_image: imagePreview || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=80',
      image_caption: imageCaption || title,
      media_credits: mediaCredits || 'PublicSpark Bureau',
      author: {
        name: 'संवाददाता (Staff Reporter)',
        role: 'Field Reporter',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'
      },
      status: 'pending', // SENT TO EDITOR DESK FOR EDITORIAL REVIEW
      is_breaking: false,
      views_count: 1,
      reading_time_mins: Math.max(1, Math.ceil(content.length / 500)),
      published_at: 'Just now'
    };

    onAddNewArticle(newStory);
    setMyStories([
      {
        id: newStory.id,
        title: newStory.title,
        category: newStory.category,
        originalLanguage: newStory.originalLanguage,
        status: 'pending',
        updated_at: 'Just now'
      },
      ...myStories
    ]);

    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (e) {}
    setHasDraftRestored(false);

    setStatusMessage('समाचार समीक्षा के लिए Editor Desk पर भेज दिया गया है! एडिटर के अप्रूव करते ही यह लाइव हो जाएगा।');
    setTitle('');
    setContent('');
    setVideoUrl('');
    setImageCaption('');
    setMediaCredits('PublicSpark Bureau');
    setTags('News, Ground Report, Verified');
    setImagePreview(null);
    setIsImageReady(false);
    setHighlights([]);
    setSpellingNote('');
    setImprovedTitleSuggestion('');

    setTimeout(() => setStatusMessage(''), 6000);
  };

  return (
    <div className="container" style={{ padding: '2rem 1.25rem' }}>
      {/* Reporter Desk Header */}
      <div className="workspace-header" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className="workspace-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <PenTool color="var(--accent-crimson)" /> Writer Desk (समाचार लेखन)
            </h2>
            <p style={{ color: 'var(--text-subtle)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
              सरल फ़ॉर्म: हेडलाइन, बॉडी, फ़ोटो (कैप्शन व क्रेडिट), कैटेगरी और टैग्स भरें।
            </p>
          </div>
          <div style={{ background: '#FEF3C7', color: '#92400E', padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Clock size={14} /> Workflow: Reporter → Editor Desk Review → Live
          </div>
        </div>
      </div>

      {hasDraftRestored && (
        <div style={{ background: '#EFF6FF', color: '#1E40AF', border: '1px solid #BFDBFE', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem', fontSize: '0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600' }}>
            <Clock size={16} color="#2563EB" /> आपका पिछला अनसेव्ड ड्राफ्ट सुरक्षित है और रीस्टोर कर लिया गया है।
          </span>
          <button
            type="button"
            onClick={handleDiscardDraft}
            style={{ background: 'transparent', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '800', textDecoration: 'underline' }}
          >
            ड्राफ्ट हटाएं (Discard)
          </button>
        </div>
      )}

      {statusMessage && (
        <div style={{ background: '#ECFDF5', color: 'var(--accent-emerald)', border: '1px solid var(--accent-emerald)', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle size={18} /> {statusMessage}
        </div>
      )}

      {/* Grid Layout */}
      <div className="workspace-grid">
        {/* Sidebar Nav */}
        <div className="workspace-sidebar">
          <button 
            onClick={() => setActiveTab('create')} 
            className={`sidebar-nav-link ${activeTab === 'create' ? 'active' : ''}`}
            style={{ width: '100%' }}
          >
            <PenTool size={16} /> नया समाचार लिखें (Create)
          </button>
          <button 
            onClick={() => setActiveTab('my-submissions')} 
            className={`sidebar-nav-link ${activeTab === 'my-submissions' ? 'active' : ''}`}
            style={{ width: '100%' }}
          >
            <FileText size={16} /> प्रकाशित समाचार ({myStories.length})
          </button>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'create' ? (
            <form onSubmit={handlePublishStory} style={{ background: 'var(--bg-surface)', padding: '1.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }}>
                समाचार विवरण (Article Details)
              </h3>

              {/* STEP 1: MANDATORY LANGUAGE GATE */}
              <div style={{
                marginBottom: '1.75rem',
                padding: '1.25rem',
                background: originalLanguage ? 'var(--bg-secondary)' : 'var(--bg-surface)',
                border: originalLanguage ? '1px solid var(--accent-indigo)' : '2px dashed var(--accent-crimson)',
                borderRadius: 'var(--radius-md)',
                boxShadow: originalLanguage ? 'none' : '0 4px 14px rgba(220, 38, 38, 0.08)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Languages size={18} color={originalLanguage ? 'var(--accent-indigo)' : 'var(--accent-crimson)'} />
                    <span style={{ fontWeight: '800', fontSize: '0.95rem', color: 'var(--text-main)' }}>
                      चरण 1: समाचार की भाषा चुनें (Step 1: Select Article Language) *
                    </span>
                  </div>
                  {originalLanguage ? (
                    <span style={{
                      background: 'var(--accent-emerald-bg, #ECFDF5)',
                      color: 'var(--accent-emerald)',
                      border: '1px solid var(--accent-emerald)',
                      padding: '0.25rem 0.65rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.8rem',
                      fontWeight: '800',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}>
                      <Check size={14} /> चयनित भाषा: {SUPPORTED_LANGUAGES.find(l => l.code === originalLanguage)?.native || originalLanguage} ({SUPPORTED_LANGUAGES.find(l => l.code === originalLanguage)?.name || ''})
                    </span>
                  ) : (
                    <span style={{
                      background: '#FEF2F2',
                      color: 'var(--accent-crimson)',
                      border: '1px solid #FCA5A5',
                      padding: '0.25rem 0.65rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.8rem',
                      fontWeight: '800',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}>
                      <Lock size={14} /> भाषा चुनना अनिवार्य है (Mandatory)
                    </span>
                  )}
                </div>

                <p style={{ fontSize: '0.825rem', color: 'var(--text-subtle)', marginBottom: '0.75rem' }}>
                  जिस भाषा में आप समाचार लिख रहे हैं, उसे यहाँ चुनें। जब तक भाषा नहीं चुनी जाएगी, नीचे दिए गए फ़ील्ड लॉक रहेंगे।
                </p>

                {/* Language selection pills / grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                  gap: '0.5rem'
                }}>
                  {SUPPORTED_LANGUAGES.map((lang) => {
                    const isSelected = originalLanguage === lang.code;
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => setOriginalLanguage(lang.code)}
                        style={{
                          padding: '0.5rem 0.65rem',
                          borderRadius: 'var(--radius-sm)',
                          border: isSelected ? '2px solid var(--accent-indigo)' : '1px solid var(--border-medium)',
                          background: isSelected ? 'var(--accent-indigo)' : 'var(--bg-surface)',
                          color: isSelected ? '#FFFFFF' : 'var(--text-main)',
                          fontWeight: isSelected ? '800' : '600',
                          fontSize: '0.825rem',
                          cursor: 'pointer',
                          textAlign: 'center',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.15rem',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <span style={{ fontSize: '0.9rem' }}>{lang.native}</span>
                        <span style={{ fontSize: '0.7rem', opacity: isSelected ? 0.9 : 0.65 }}>{lang.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {!originalLanguage && (
                <div style={{
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  color: '#991B1B',
                  padding: '0.85rem 1.1rem',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  fontWeight: '700',
                  fontSize: '0.875rem'
                }}>
                  <Lock size={18} color="#DC2626" />
                  <span>कृपया ऊपर दी गई सूची में से पहले समाचार की भाषा चुनें। भाषा चुने बिना समाचार लिखना संभव नहीं है।</span>
                </div>
              )}

              {/* 1. Headline */}
              <div style={{ marginBottom: '1.25rem', opacity: originalLanguage ? 1 : 0.55 }}>
                <label style={{ display: 'block', fontWeight: '700', fontSize: '0.875rem', marginBottom: '0.4rem' }}>
                  हेडलाइन (Headline) * {!originalLanguage && <span style={{ color: 'var(--accent-crimson)', fontSize: '0.8rem' }}>(भाषा चुनें)</span>}
                </label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={originalLanguage ? "मुख्य समाचार की हेडलाइन लिखें..." : "पहले ऊपर भाषा चुनें..."}
                  disabled={!originalLanguage}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', fontFamily: 'var(--font-serif)', fontSize: '1.15rem', fontWeight: '700', cursor: originalLanguage ? 'text' : 'not-allowed', background: originalLanguage ? 'var(--bg-surface)' : 'var(--bg-secondary)' }}
                  required
                />
              </div>

              {/* Spelling Suggestion Banner */}
              {improvedTitleSuggestion && (
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--accent-indigo)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.775rem', fontWeight: '800', color: 'var(--accent-indigo)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Sparkles size={14} /> सुझाई गई शुद्ध वर्तनी:
                    </span>
                    <div style={{ fontSize: '0.95rem', fontWeight: '700', marginTop: '0.1rem' }}>
                      {improvedTitleSuggestion}
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={handleApplyImprovedTitle}
                    className="btn btn-primary"
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                  >
                    <Check size={14} /> लागू करें (Apply)
                  </button>
                </div>
              )}

              {/* 2. Article Body Text */}
              <div style={{ marginBottom: '1.5rem', opacity: originalLanguage ? 1 : 0.55 }}>
                <label style={{ display: 'block', fontWeight: '700', fontSize: '0.875rem', marginBottom: '0.4rem' }}>
                  समाचार का पूरा विवरण (Article Body) * {!originalLanguage && <span style={{ color: 'var(--accent-crimson)', fontSize: '0.8rem' }}>(भाषा चुनें)</span>}
                </label>
                <textarea 
                  rows={9} 
                  value={content} 
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={originalLanguage ? "यहाँ पूरा समाचार लिखें..." : "समाचार लिखने के लिए पहले ऊपर भाषा चुनें..."}
                  disabled={!originalLanguage}
                  style={{ width: '100%', padding: '0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', fontSize: '0.95rem', lineHeight: '1.6', cursor: originalLanguage ? 'text' : 'not-allowed', background: originalLanguage ? 'var(--bg-surface)' : 'var(--bg-secondary)' }}
                  required
                />
              </div>

              {/* Pre-Publish AI Draft Box ("In 30 seconds" highlights & spell check) */}
              <div style={{ marginBottom: '1.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', padding: '1.25rem', borderRadius: 'var(--radius-sm)', opacity: originalLanguage ? 1 : 0.55 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: '800', fontSize: '0.9rem' }}>
                    <Sparkles size={16} color="var(--accent-indigo)" />
                    <span>"In 30 seconds" मुख्य बिंदु (Gemini AI ड्राफ्ट)</span>
                  </div>
                  <button 
                    type="button"
                    onClick={handleGeneratePreDraft}
                    disabled={!originalLanguage || isDraftingAi}
                    className="btn btn-outline"
                    style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem', borderColor: 'var(--accent-indigo)', color: 'var(--accent-indigo)', cursor: originalLanguage ? 'pointer' : 'not-allowed' }}
                  >
                    {isDraftingAi ? (
                      <>
                        <RefreshCw size={13} className="spin-animation" /> ड्राफ्ट बन रहा है...
                      </>
                    ) : (
                      <>
                        <Sparkles size={13} /> AI से बिंदु व वर्तनी जांचें
                      </>
                    )}
                  </button>
                </div>

                {spellingNote && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', marginBottom: '0.75rem', fontStyle: 'italic' }}>
                    {spellingNote}
                  </div>
                )}

                {/* Editable Highlights List */}
                {highlights.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {highlights.map((point, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--accent-indigo)', minWidth: '20px' }}>
                          {idx + 1}.
                        </span>
                        <input 
                          type="text"
                          value={point}
                          disabled={!originalLanguage}
                          onChange={(e) => handleHighlightChange(idx, e.target.value)}
                          placeholder={`बिंदु ${idx + 1}...`}
                          style={{ flex: 1, padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', fontSize: '0.875rem' }}
                        />
                        <button 
                          type="button"
                          onClick={() => handleRemoveHighlightPoint(idx)}
                          style={{ background: 'none', border: 'none', color: 'var(--accent-crimson)', cursor: 'pointer', padding: '0.2rem' }}
                          title="हटाएं"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    {highlights.length < 4 && (
                      <button 
                        type="button" 
                        onClick={handleAddHighlightPoint}
                        disabled={!originalLanguage}
                        style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--accent-indigo)', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.25rem' }}
                      >
                        <Plus size={14} /> नया बिंदु जोड़ें
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.825rem', color: 'var(--text-subtle)', padding: '0.5rem 0' }}>
                    ऊपर <strong>"AI से बिंदु व वर्तनी जांचें"</strong> पर क्लिक करें। Gemini आपके लिए 2-3 मुख्य बिंदु बनाएगा जिन्हें आप यहाँ बदल सकते हैं।
                  </div>
                )}
              </div>

              {/* 3. Featured Image (Upload + Caption + Credit) */}
              <div style={{ marginBottom: '1.5rem', background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-medium)', opacity: originalLanguage ? 1 : 0.55 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: '700', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                  <ImageIcon size={18} /> फ़ोटो अपलोड (Image with Caption & Credit)
                </label>
                <input 
                  type="file" 
                  accept="image/*" 
                  disabled={!originalLanguage}
                  onChange={handleImageChange}
                  style={{ marginBottom: '0.75rem', cursor: originalLanguage ? 'pointer' : 'not-allowed' }}
                />
                
                {isCompressing && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--accent-amber)', fontWeight: '600', marginBottom: '0.5rem' }}>
                    फास्ट लोडिंग के लिए WebP में संपीड़ित हो रहा है...
                  </div>
                )}

                {imagePreview && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <img src={imagePreview} alt="Preview" style={{ height: '140px', borderRadius: 'var(--radius-sm)', objectFit: 'cover' }} />
                    {imageStats && (
                      <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: '#047857', background: '#ECFDF5', padding: '0.25rem 0.6rem', borderRadius: '4px', border: '1px solid #A7F3D0', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Check size={13} /> WebP संपीड़ित: {imageStats.compressedKB} KB (मूल: {imageStats.originalKB} KB — {imageStats.savedPercent}% हल्की)
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: '700', fontSize: '0.8rem', marginBottom: '0.3rem' }}>
                      फ़ोटो कैप्शन (Caption)
                    </label>
                    <input 
                      type="text"
                      value={imageCaption}
                      disabled={!originalLanguage}
                      onChange={(e) => setImageCaption(e.target.value)}
                      placeholder="फ़ोटो के बारे में 1 पंक्ति..."
                      style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: '700', fontSize: '0.8rem', marginBottom: '0.3rem' }}>
                      फ़ोटो क्रेडिट (Media Credit)
                    </label>
                    <input 
                      type="text"
                      value={mediaCredits}
                      disabled={!originalLanguage}
                      onChange={(e) => setMediaCredits(e.target.value)}
                      placeholder="e.g. PTI / Special Correspondent"
                      style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>
              </div>

              {/* 4 & 5. Category & Tags */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.75rem', opacity: originalLanguage ? 1 : 0.55 }}>
                <div>
                  <label style={{ display: 'block', fontWeight: '700', fontSize: '0.875rem', marginBottom: '0.4rem' }}>
                    श्रेणी (Category) *
                  </label>
                  <select 
                    value={category} 
                    disabled={!originalLanguage}
                    onChange={(e) => setCategory(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', fontSize: '0.9rem', cursor: originalLanguage ? 'pointer' : 'not-allowed' }}
                  >
                    {activeCategories.map((cat) => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: '700', fontSize: '0.875rem', marginBottom: '0.4rem' }}>
                    टैग्स (Tags, comma separated)
                  </label>
                  <input 
                    type="text" 
                    value={tags} 
                    disabled={!originalLanguage}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="e.g. राजनीति, संसद, विकास"
                    style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', fontSize: '0.9rem', cursor: originalLanguage ? 'text' : 'not-allowed' }}
                  />
                </div>
              </div>

              {/* Optional YouTube Video Embed URL */}
              <div style={{ marginBottom: '1.75rem', opacity: originalLanguage ? 1 : 0.55 }}>
                <label style={{ display: 'block', fontWeight: '700', fontSize: '0.875rem', marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                  यूट्यूब वीडियो लिंक (YouTube Video URL — ऐच्छिक / Optional)
                </label>
                <input 
                  type="url"
                  value={videoUrl}
                  disabled={!originalLanguage}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=... या https://youtu.be/..."
                  style={{ width: '100%', padding: '0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', fontSize: '0.875rem', cursor: originalLanguage ? 'text' : 'not-allowed', background: originalLanguage ? 'var(--bg-surface)' : 'var(--bg-secondary)' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', display: 'block', marginTop: '0.3rem' }}>
                  यदि इस समाचार की वीडियो कवरेज है, तो यूट्यूब लिंक यहाँ डालें। वीडियो न होने पर इसे खाली छोड़ दें।
                </span>
              </div>

              {/* Publish Action Button */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderTop: '1px solid var(--border-light)', paddingTop: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <button 
                    type="submit" 
                    disabled={!originalLanguage}
                    className="btn btn-primary" 
                    style={{
                      padding: '0.8rem 1.8rem',
                      fontSize: '1rem',
                      fontWeight: '800',
                      background: originalLanguage ? 'var(--accent-indigo)' : 'var(--border-medium)',
                      borderColor: originalLanguage ? 'var(--accent-indigo)' : 'var(--border-medium)',
                      color: originalLanguage ? '#FFFFFF' : 'var(--text-subtle)',
                      cursor: originalLanguage ? 'pointer' : 'not-allowed'
                    }}
                  >
                    {originalLanguage ? <Send size={18} /> : <Lock size={18} />} Submit to Editor (संपादक के पास भेजें)
                  </button>
                  <button
                    type="button"
                    onClick={handleDiscardDraft}
                    style={{ background: 'transparent', border: '1px solid var(--border-medium)', padding: '0.6rem 1rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: 'var(--text-subtle)', cursor: 'pointer' }}
                  >
                    नया फॉर्म खाली करें (Clear Form)
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-subtle)', fontSize: '0.8rem' }}>
                  <Check size={14} color="var(--accent-emerald)" /> ऑटो-सेव ड्राफ्ट चालू है (Auto-Saved)
                </div>
              </div>
            </form>
          ) : (
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>शीर्षक (Headline)</th>
                    <th>कैटेगरी</th>
                    <th>स्थिति (Status)</th>
                    <th>समय</th>
                  </tr>
                </thead>
                <tbody>
                  {myStories.map((story) => (
                    <tr key={story.id}>
                      <td style={{ fontWeight: '700' }}>{story.title}</td>
                      <td>
                        <span className="story-category-tag">{story.category}</span>
                      </td>
                      <td>
                        <span 
                          className="badge" 
                          style={story.status === 'published' 
                            ? { background: '#ECFDF5', color: 'var(--accent-emerald)', border: '1px solid #A7F3D0' } 
                            : { background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }}
                        >
                          {story.status === 'published' ? <CheckCircle size={12} /> : <Clock size={12} />}
                          {story.status === 'published' ? ' Live on Site' : ' Pending Editor Review'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-subtle)', fontSize: '0.85rem' }}>
                        {story.updated_at}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
