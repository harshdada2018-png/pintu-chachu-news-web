import React, { useState, useEffect, useRef } from 'react';
import { PenTool, FileText, Send, CheckCircle, Clock, AlertCircle, Image as ImageIcon, Sparkles, Plus, Trash2, Check, RefreshCw, Languages, Lock, FolderOpen, X, Radio, Edit3, XCircle, ShieldCheck } from 'lucide-react';
import { MOCK_CATEGORIES } from '../../services/mockData';
import { compressImageToWebP } from '../../services/mediaService';
import { SUPPORTED_LANGUAGES } from '../../services/translationService';
import MediaLibraryDesk from '../admin/MediaLibraryDesk';

export default function ReporterWorkspace({ 
  onAddNewArticle, 
  categories,
  onResubmitArticle,
  pendingArticles = [],
  rejectedArticles = [],
  publishedArticles = []
}) {
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
  const [format, setFormat] = useState(initialDraft?.format || 'standard');
  const [liveStatus, setLiveStatus] = useState(initialDraft?.liveStatus || 'active');
  
  // Image with Caption & Credit
  const [imagePreview, setImagePreview] = useState(initialDraft?.imagePreview || null);
  const [imageCaption, setImageCaption] = useState(initialDraft?.imageCaption || '');
  const [mediaCredits, setMediaCredits] = useState(initialDraft?.mediaCredits || 'PublicSpark Bureau');
  const [isCompressing, setIsCompressing] = useState(false);
  const [imageStats, setImageStats] = useState(null);
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);

  // Pre-Publish AI "In 30 Seconds" 2-3 Points & Hindi Spelling Verification
  const [highlights, setHighlights] = useState(initialDraft?.highlights || []);
  const [isDraftingAi, setIsDraftingAi] = useState(false);
  const [spellingNote, setSpellingNote] = useState('');
  const [improvedTitleSuggestion, setImprovedTitleSuggestion] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [hasDraftRestored, setHasDraftRestored] = useState(!!(initialDraft && (initialDraft.originalLanguage || initialDraft.title || initialDraft.content)));

  // Task 25 Subtopic B: Reporter Citations & Official Sources
  const [sources, setSources] = useState(initialDraft?.sources || []);
  const [newSourceTitle, setNewSourceTitle] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [newSourceType, setNewSourceType] = useState('Official Press Note');
  const [newSourcePublisher, setNewSourcePublisher] = useState('');

  const REPORTER_SOURCE_PRESETS = [
    {
      label: 'PIB Press Release',
      title: 'Press Information Bureau (PIB) New Delhi',
      url: 'https://pib.gov.in',
      type: 'Official Press Release',
      publisher: 'PIB Govt of India'
    },
    {
      label: 'Gazette Order',
      title: 'Government Gazette Notification',
      url: 'https://egazette.gov.in',
      type: 'Government Gazette',
      publisher: 'Govt of India'
    },
    {
      label: 'Police / Admin Note',
      title: 'Police Department / District Admin Press Note',
      url: 'https://ips.gov.in',
      type: 'Official Press Note',
      publisher: 'District Administration'
    },
    {
      label: 'PTI Dispatch',
      title: 'Press Trust of India (PTI) Wire',
      url: 'https://ptinews.com',
      type: 'News Agency Dispatch',
      publisher: 'PTI'
    }
  ];

  const handleAddSource = () => {
    if (!newSourceTitle.trim()) {
      alert('कृपया स्रोत या संदर्भ का शीर्षक भरें।');
      return;
    }
    const newSrc = {
      id: `src-${Date.now()}`,
      title: newSourceTitle.trim(),
      url: newSourceUrl.trim() || 'https://pib.gov.in',
      type: newSourceType,
      publisher: newSourcePublisher.trim() || 'Ground Administration',
      accessed_at: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    };
    setSources(prev => [...prev, newSrc]);
    setNewSourceTitle('');
    setNewSourceUrl('');
    setNewSourcePublisher('');
  };

  const handleRemoveSource = (srcId) => {
    setSources(prev => prev.filter(s => s.id !== srcId));
  };

  const applySourcePreset = (preset) => {
    setNewSourceTitle(preset.title);
    setNewSourceUrl(preset.url);
    setNewSourceType(preset.type);
    setNewSourcePublisher(preset.publisher);
  };

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
          format,
          liveStatus,
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
  }, [originalLanguage, title, content, category, tags, videoUrl, format, liveStatus, imagePreview, imageCaption, mediaCredits, highlights]);

  const handleDiscardDraft = () => {
    if (window.confirm('क्या आप सचमुच इस अनसेव्ड ड्राफ्ट को हटाना चाहते हैं?')) {
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch (e) {}
      setOriginalLanguage('');
      setTitle('');
      setContent('');
      setVideoUrl('');
      setFormat('standard');
      setLiveStatus('active');
      setImageCaption('');
      setImagePreview(null);
      setIsImageReady(false);
      setHighlights([]);
      setSpellingNote('');
      setImprovedTitleSuggestion('');
      setHasDraftRestored(false);
      setSources([]);
    }
  };

  // Active story being edited after editor rejection/revision request
  const [editingStoryId, setEditingStoryId] = useState(null);
  const [rejectionNotice, setRejectionNotice] = useState('');

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
    } catch {
      return [];
    }
  });

  // Keep myStories synchronized with App-level status changes (Rejection, Approval/Publishing, Review queue)
  const isFirstSyncRef = useRef(true);
  useEffect(() => {
    if (isFirstSyncRef.current) {
      isFirstSyncRef.current = false;
      if (rejectedArticles.length === 0 && pendingArticles.length === 0 && publishedArticles.length === 0) {
        return;
      }
    }
    setMyStories(prevStories => {
      let hasChanges = false;
      const updated = prevStories.map(story => {
        // 1. Check if rejected by editor
        const rejectedMatch = rejectedArticles.find(r => r.id === story.id);
        if (rejectedMatch) {
          if (story.status !== 'rejected' || story.rejection_reason !== rejectedMatch.rejection_reason) {
            hasChanges = true;
            return {
              ...story,
              ...rejectedMatch,
              status: 'rejected',
              rejection_reason: rejectedMatch.rejection_reason || 'Editorial review requested changes before publication.'
            };
          }
          return story;
        }

        // 2. Check if published
        const publishedMatch = publishedArticles.find(p => p.id === story.id);
        if (publishedMatch) {
          if (story.status !== 'published') {
            hasChanges = true;
            return {
              ...story,
              ...publishedMatch,
              status: 'published',
              rejection_reason: null
            };
          }
          return story;
        }

        // 3. Check if pending review
        const pendingMatch = pendingArticles.find(p => p.id === story.id);
        if (pendingMatch) {
          if (story.status !== 'pending') {
            hasChanges = true;
            return {
              ...story,
              ...pendingMatch,
              status: 'pending',
              rejection_reason: null
            };
          }
          return story;
        }

        return story;
      });

      // Ensure any rejected article is present in reporter's desk list
      rejectedArticles.forEach(rej => {
        if (!updated.some(s => s.id === rej.id)) {
          updated.unshift({
            ...rej,
            status: 'rejected',
            rejection_reason: rej.rejection_reason || 'Editorial review requested changes before publication.'
          });
          hasChanges = true;
        }
      });

      return hasChanges ? updated : prevStories;
    });
  }, [rejectedArticles, pendingArticles, publishedArticles]);

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

  const handleEditStory = (story) => {
    setEditingStoryId(story.id);
    setRejectionNotice(story.rejection_reason || '');
    setOriginalLanguage(story.originalLanguage || 'hi');
    setTitle(story.title || '');
    setContent(story.content || '');
    setCategory(story.category || activeCategories[0]?.name || 'National');
    setTags(Array.isArray(story.tags) ? story.tags.join(', ') : (story.tags || 'News, Ground Report, Verified'));
    setVideoUrl(story.video_url || story.videoUrl || '');
    setFormat(story.format || 'standard');
    setLiveStatus(story.live_status || 'active');
    setImagePreview(story.featured_image || story.imagePreview || null);
    setIsImageReady(!!(story.featured_image || story.imagePreview));
    setImageCaption(story.image_caption || story.imageCaption || '');
    setMediaCredits(story.media_credits || story.mediaCredits || 'PublicSpark Bureau');
    setHighlights(story.highlights || []);
    setSources(Array.isArray(story.sources) ? story.sources : []);
    setSpellingNote('');
    setImprovedTitleSuggestion('');
    setActiveTab('create');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEditing = () => {
    setEditingStoryId(null);
    setRejectionNotice('');
    setTitle('');
    setContent('');
    setVideoUrl('');
    setFormat('standard');
    setLiveStatus('active');
    setImageCaption('');
    setMediaCredits('PublicSpark Bureau');
    setTags('News, Ground Report, Verified');
    setImagePreview(null);
    setIsImageReady(false);
    setHighlights([]);
    setSources([]);
    setSpellingNote('');
    setImprovedTitleSuggestion('');
  };

  // Publish or Resubmit Story to Editor
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

    const storyPayload = {
      id: editingStoryId || `art-${Date.now()}`,
      originalLanguage: originalLanguage,
      title: title.trim(),
      sub_title: finalHighlights[0] || '',
      category,
      category_slug: category.toLowerCase().replace(/\s+/g, '-'),
      content: content.trim(),
      summary: finalHighlights[0] || content.slice(0, 140) + '...',
      highlights: finalHighlights,
      tags: tagList,
      format: format || (videoUrl.trim() ? 'video' : 'standard'),
      live_status: format === 'live' ? liveStatus : null,
      live_updates: [],
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
      rejection_reason: null,
      is_breaking: false,
      views_count: 1,
      reading_time_mins: Math.max(1, Math.ceil(content.length / 500)),
      published_at: 'Just now',
      fact_check: {
        verified: true,
        rating: 'Under Review',
        desk: 'Field Reporter Ground Submission',
        claim: 'Ground report and local administration statements filed for editorial verification.',
        verified_at: 'Pending Editor Approval'
      },
      sources: sources
    };

    if (editingStoryId) {
      // Resubmit revised story
      if (onResubmitArticle) {
        onResubmitArticle(storyPayload);
      }
      setMyStories(prev => prev.map(s => s.id === editingStoryId ? { ...s, ...storyPayload, status: 'pending', rejection_reason: null, updated_at: 'अभी-अभी' } : s));
      setStatusMessage('संशोधित समाचार समीक्षा के लिए पुनः Editor Desk पर भेज दिया गया है!');
      setEditingStoryId(null);
      setRejectionNotice('');
    } else {
      // Fresh submission
      onAddNewArticle(storyPayload);
      setMyStories([
        {
          ...storyPayload,
          status: 'pending',
          updated_at: 'Just now'
        },
        ...myStories
      ]);
      setStatusMessage('समाचार समीक्षा के लिए Editor Desk पर भेज दिया गया है! एडिटर के अप्रूव करते ही यह लाइव हो जाएगा।');
    }

    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (e) {}
    setHasDraftRestored(false);

    setTitle('');
    setContent('');
    setVideoUrl('');
    setFormat('standard');
    setLiveStatus('active');
    setImageCaption('');
    setMediaCredits('PublicSpark Bureau');
    setTags('News, Ground Report, Verified');
    setImagePreview(null);
    setIsImageReady(false);
    setHighlights([]);
    setSources([]);
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
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <FileText size={16} /> मेरी रिपोर्ट्स ({myStories.length})
            </span>
            {myStories.some(s => s.status === 'rejected') && (
              <span style={{ background: '#DC2626', color: '#FFFFFF', borderRadius: '10px', fontSize: '0.7rem', padding: '0.1rem 0.45rem', fontWeight: '800' }}>
                {myStories.filter(s => s.status === 'rejected').length} सुधार
              </span>
            )}
          </button>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'create' ? (
            <form onSubmit={handlePublishStory} style={{ background: 'var(--bg-surface)', padding: '1.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
              {editingStoryId && (
                <div style={{
                  background: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  borderRadius: 'var(--radius-sm)',
                  padding: '1rem',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#991B1B', fontWeight: '800', fontSize: '0.95rem' }}>
                      <AlertCircle size={18} color="#DC2626" />
                      <span>संपादक के निर्देशानुसार संशोधन मोड (Revision Mode):</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCancelEditing}
                      style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '700', textDecoration: 'underline' }}
                    >
                      संशोधन रद्द करें (Cancel)
                    </button>
                  </div>
                  <div style={{ background: '#FFFFFF', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid #FECACA', fontSize: '0.9rem', color: '#7F1D1D', lineHeight: '1.45' }}>
                    <strong>Editor Feedback:</strong> {rejectionNotice || 'कृपया इस समाचार की समीक्षा कर आवश्यक सुधार करें और पुनः सबमिट करें।'}
                  </div>
                </div>
              )}
              <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }}>
                {editingStoryId ? 'समाचार विवरण में सुधार (Revise Article Details)' : 'समाचार विवरण (Article Details)'}
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

                {/* Language selection dropdown box */}
                <div style={{ position: 'relative', width: '100%' }}>
                  <select
                    value={originalLanguage}
                    onChange={(e) => setOriginalLanguage(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.7rem 0.9rem',
                      borderRadius: 'var(--radius-sm)',
                      border: originalLanguage ? '1.5px solid var(--accent-indigo)' : '1.5px solid var(--border-medium)',
                      fontSize: '0.925rem',
                      fontWeight: '700',
                      background: 'var(--bg-surface)',
                      color: originalLanguage ? 'var(--text-main)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      outline: 'none',
                      appearance: 'auto',
                      WebkitAppearance: 'menulist'
                    }}
                  >
                    <option value="" disabled>-- भाषा चुनें (Select Article Language) --</option>
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.native} ({lang.name})
                      </option>
                    ))}
                  </select>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: '700', fontSize: '0.875rem', margin: 0 }}>
                    <ImageIcon size={18} /> फ़ोटो अपलोड (Image with Caption & Credit)
                  </label>
                  <button
                    type="button"
                    disabled={!originalLanguage}
                    onClick={() => setIsMediaPickerOpen(true)}
                    className="btn btn-outline"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontSize: '0.75rem',
                      fontWeight: '800',
                      padding: '0.25rem 0.65rem',
                      background: 'var(--bg-secondary)',
                      borderColor: 'var(--accent-blue)',
                      color: 'var(--accent-blue)',
                      cursor: originalLanguage ? 'pointer' : 'not-allowed'
                    }}
                  >
                    <FolderOpen size={14} /> मीडिया लाइब्रेरी से चुनें
                  </button>
                </div>
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
                  <div style={{ marginBottom: '0.75rem', position: 'relative', display: 'inline-block' }}>
                    <img src={imagePreview} alt="Preview" style={{ height: '140px', borderRadius: 'var(--radius-sm)', objectFit: 'cover' }} />
                    <button
                      type="button"
                      onClick={() => {
                        setImagePreview(null);
                        setIsImageReady(false);
                        setImageStats(null);
                      }}
                      style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        background: 'rgba(0,0,0,0.7)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '3px',
                        padding: '2px 5px',
                        fontSize: '0.7rem',
                        cursor: 'pointer'
                      }}
                      title="फ़ोटो हटाएं"
                    >
                      <X size={12} />
                    </button>
                    {imageStats && (
                      <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: '#047857', background: '#ECFDF5', padding: '0.25rem 0.6rem', borderRadius: '4px', border: '1px solid #A7F3D0', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Check size={13} /> WebP संपीड़ित: {imageStats.compressedKB} KB (मूल: {imageStats.originalKB} KB — {imageStats.savedPercent}% हल्की)
                      </div>
                    )}
                  </div>
                )}

                <div className="reporter-grid-2col" style={{ marginTop: '0.5rem' }}>
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
              <div className="reporter-grid-2col" style={{ marginBottom: '1.75rem', opacity: originalLanguage ? 1 : 0.55 }}>
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

              {/* Story Format & Live Blog Selector (Task 23 Subtopic A) */}
              <div style={{
                marginBottom: '1.75rem',
                background: format === 'live' ? '#FEF2F2' : 'var(--bg-secondary)',
                border: format === 'live' ? '1px solid #FCA5A5' : '1px solid var(--border-medium)',
                padding: '1rem',
                borderRadius: 'var(--radius-sm)',
                opacity: originalLanguage ? 1 : 0.55
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: '700', fontSize: '0.875rem', margin: 0, color: format === 'live' ? '#991B1B' : 'var(--text-main)' }}>
                    <Radio size={16} color={format === 'live' ? '#DC2626' : 'var(--text-subtle)'} />
                    स्टोरी का फॉर्मेट (Story Format & Presentation Mode)
                  </label>
                  {format === 'live' && (
                    <span style={{ fontSize: '0.7rem', fontWeight: '800', color: liveStatus === 'active' ? '#B91C1C' : '#4B5563', background: liveStatus === 'active' ? '#FEE2E2' : '#E5E7EB', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                      {liveStatus === 'active' ? 'Live Active' : 'Concluded'}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: format === 'live' ? '0.65rem' : '0' }}>
                  <button
                    type="button"
                    disabled={!originalLanguage}
                    onClick={() => setFormat('standard')}
                    className="btn"
                    style={{
                      padding: '0.4rem 0.85rem',
                      fontSize: '0.8rem',
                      fontWeight: '700',
                      borderRadius: '4px',
                      border: format === 'standard' ? '1px solid #0E2A47' : '1px solid var(--border-medium)',
                      background: format === 'standard' ? '#0E2A47' : '#FFFFFF',
                      color: format === 'standard' ? '#FFFFFF' : 'var(--text-main)',
                      cursor: originalLanguage ? 'pointer' : 'not-allowed'
                    }}
                  >
                    सामान्य समाचार (Standard)
                  </button>

                  <button
                    type="button"
                    disabled={!originalLanguage}
                    onClick={() => { setFormat('live'); setLiveStatus('active'); }}
                    className="btn"
                    style={{
                      padding: '0.4rem 0.85rem',
                      fontSize: '0.8rem',
                      fontWeight: '800',
                      borderRadius: '4px',
                      border: format === 'live' ? '1px solid #DC2626' : '1px solid var(--border-medium)',
                      background: format === 'live' ? '#DC2626' : '#FFFFFF',
                      color: format === 'live' ? '#FFFFFF' : 'var(--text-main)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      cursor: originalLanguage ? 'pointer' : 'not-allowed'
                    }}
                  >
                    <Radio size={13} /> लाइव ब्लॉग (Live Timeline)
                  </button>

                  <button
                    type="button"
                    disabled={!originalLanguage}
                    onClick={() => setFormat('video')}
                    className="btn"
                    style={{
                      padding: '0.4rem 0.85rem',
                      fontSize: '0.8rem',
                      fontWeight: '700',
                      borderRadius: '4px',
                      border: format === 'video' ? '1px solid #0E2A47' : '1px solid var(--border-medium)',
                      background: format === 'video' ? '#0E2A47' : '#FFFFFF',
                      color: format === 'video' ? '#FFFFFF' : 'var(--text-main)',
                      cursor: originalLanguage ? 'pointer' : 'not-allowed'
                    }}
                  >
                    वीडियो स्टोरी (Video)
                  </button>
                </div>

                {format === 'live' && (
                  <div style={{ borderTop: '1px solid #FCA5A5', paddingTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#7F1D1D' }}>
                      कवरेज की स्थिति (Status):
                    </span>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        type="button"
                        onClick={() => setLiveStatus('active')}
                        style={{
                          padding: '0.2rem 0.5rem',
                          fontSize: '0.72rem',
                          fontWeight: '800',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          border: liveStatus === 'active' ? '1px solid #DC2626' : '1px solid #E5E7EB',
                          background: liveStatus === 'active' ? '#DC2626' : '#FFFFFF',
                          color: liveStatus === 'active' ? '#FFFFFF' : '#374151'
                        }}
                      >
                        Live Active (चालू है)
                      </button>
                      <button
                        type="button"
                        onClick={() => setLiveStatus('concluded')}
                        style={{
                          padding: '0.2rem 0.5rem',
                          fontSize: '0.72rem',
                          fontWeight: '800',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          border: liveStatus === 'concluded' ? '1px solid #4B5563' : '1px solid #E5E7EB',
                          background: liveStatus === 'concluded' ? '#4B5563' : '#FFFFFF',
                          color: liveStatus === 'concluded' ? '#FFFFFF' : '#374151'
                        }}
                      >
                        Concluded (समाप्त)
                      </button>
                    </div>
                  </div>
                )}
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

              {/* Task 25 Subtopic B: Reporter Ground Sources & Citations Box */}
              <div style={{
                marginBottom: '1.75rem',
                background: '#F8FAFC',
                border: '1px solid #CBD5E1',
                padding: '1.1rem',
                borderRadius: 'var(--radius-sm)',
                opacity: originalLanguage ? 1 : 0.55
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem', flexWrap: 'wrap', gap: '0.4rem', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: '800', fontSize: '0.9rem', margin: 0, color: '#0E2A47' }}>
                    <FileText size={17} color="#0E2A47" />
                    स्रोत एवं आधिकारिक संदर्भ (Official Sources & Citations — ऐच्छिक)
                  </label>
                  <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#059669', background: '#ECFDF5', padding: '0.15rem 0.5rem', borderRadius: '4px', border: '1px solid #A7F3D0' }}>
                    <ShieldCheck size={12} color="#059669" /> {sources.length} स्रोत जुड़े
                  </span>
                </div>

                <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.78rem', color: '#64748B', lineHeight: '1.4' }}>
                  यदि यह समाचार किसी पुलिस प्रेस नोट, सरकारी अधिसूचना, या अधिकृत एजेंसी रिपोर्ट पर आधारित है, तो उसका लिंक यहाँ जोड़ें। यह पाठकों को विश्वसनीयता (Credibility Box) में दिखेगा।
                </p>

                {/* Sources list */}
                {sources.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
                    {sources.map(src => (
                      <div
                        key={src.id}
                        style={{
                          background: '#FFFFFF',
                          border: '1px solid #E2E8F0',
                          borderRadius: '4px',
                          padding: '0.5rem 0.75rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: '800', background: '#DBEAFE', color: '#1E40AF', padding: '0.1rem 0.4rem', borderRadius: '3px' }}>
                              {src.type}
                            </span>
                            <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#0F172A' }}>
                              {src.title}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '0.1rem' }}>
                            {src.publisher} • {src.url}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveSource(src.id)}
                          style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', padding: '0.2rem' }}
                          title="हटाएं"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Quick Presets */}
                <div style={{ marginBottom: '0.65rem' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '0.3rem' }}>
                    त्वरित प्रीसेट (1-क्लिक ऑटो-फिल):
                  </span>
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    {REPORTER_SOURCE_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        disabled={!originalLanguage}
                        onClick={() => applySourcePreset(preset)}
                        className="btn btn-outline"
                        style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', background: '#FFFFFF', borderColor: '#CBD5E1', color: '#334155', cursor: 'pointer' }}
                      >
                        + {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Add Form */}
                <div style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '4px', padding: '0.65rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <div>
                      <label style={{ fontSize: '0.7rem', fontWeight: '700', display: 'block', marginBottom: '0.2rem', color: '#334155' }}>दस्तावेज़ / स्रोत का नाम</label>
                      <input
                        type="text"
                        value={newSourceTitle}
                        disabled={!originalLanguage}
                        onChange={(e) => setNewSourceTitle(e.target.value)}
                        placeholder="e.g. जिला पुलिस अधीक्षक प्रेस नोट"
                        style={{ width: '100%', padding: '0.45rem', borderRadius: '3px', border: '1px solid #94A3B8', fontSize: '0.78rem', background: '#FFFFFF' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.7rem', fontWeight: '700', display: 'block', marginBottom: '0.2rem', color: '#334155' }}>वेब लिंक / पोर्टल URL</label>
                      <input
                        type="url"
                        value={newSourceUrl}
                        disabled={!originalLanguage}
                        onChange={(e) => setNewSourceUrl(e.target.value)}
                        placeholder="https://..."
                        style={{ width: '100%', padding: '0.45rem', borderRadius: '3px', border: '1px solid #94A3B8', fontSize: '0.78rem', background: '#FFFFFF' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem', alignItems: 'flex-end' }}>
                    <div>
                      <label style={{ fontSize: '0.7rem', fontWeight: '700', display: 'block', marginBottom: '0.2rem', color: '#334155' }}>प्रकार (Classification)</label>
                      <select
                        value={newSourceType}
                        disabled={!originalLanguage}
                        onChange={(e) => setNewSourceType(e.target.value)}
                        style={{ width: '100%', padding: '0.45rem', borderRadius: '3px', border: '1px solid #94A3B8', fontSize: '0.78rem', background: '#FFFFFF' }}
                      >
                        <option value="Official Press Note">Official Press Note (प्रेस नोट)</option>
                        <option value="Government Gazette">Government Gazette (राजपत्र)</option>
                        <option value="Judicial Order">Judicial Order (अदालत आदेश)</option>
                        <option value="News Agency Dispatch">News Agency Wire (PTI/ANI)</option>
                        <option value="Official Notification">Official Notification (मंत्रालय)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.7rem', fontWeight: '700', display: 'block', marginBottom: '0.2rem', color: '#334155' }}>संबंधित विभाग / संस्था</label>
                      <input
                        type="text"
                        value={newSourcePublisher}
                        disabled={!originalLanguage}
                        onChange={(e) => setNewSourcePublisher(e.target.value)}
                        placeholder="e.g. जिला पुलिस विभाग"
                        style={{ width: '100%', padding: '0.45rem', borderRadius: '3px', border: '1px solid #94A3B8', fontSize: '0.78rem', background: '#FFFFFF' }}
                      />
                    </div>

                    <button
                      type="button"
                      disabled={!originalLanguage || !newSourceTitle.trim()}
                      onClick={handleAddSource}
                      className="btn btn-outline"
                      style={{
                        padding: '0.45rem 0.85rem',
                        fontSize: '0.78rem',
                        fontWeight: '800',
                        background: newSourceTitle.trim() ? '#0E2A47' : '#E2E8F0',
                        color: newSourceTitle.trim() ? '#FFFFFF' : '#94A3B8',
                        borderColor: newSourceTitle.trim() ? '#0E2A47' : '#CBD5E1',
                        minHeight: '34px',
                        cursor: newSourceTitle.trim() ? 'pointer' : 'not-allowed',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      <Plus size={14} /> संदर्भ जोड़ें
                    </button>
                  </div>
                </div>
              </div>

              {/* Publish Action Button */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderTop: '1px solid var(--border-light)', paddingTop: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <button 
                    type="submit" 
                    disabled={!originalLanguage}
                    className="btn btn-primary" 
                    style={{
                      padding: '0.8rem 1.8rem',
                      fontSize: '1rem',
                      fontWeight: '800',
                      background: !originalLanguage 
                        ? 'var(--border-medium)' 
                        : (editingStoryId ? '#DC2626' : 'var(--accent-indigo)'),
                      borderColor: !originalLanguage 
                        ? 'var(--border-medium)' 
                        : (editingStoryId ? '#DC2626' : 'var(--accent-indigo)'),
                      color: originalLanguage ? '#FFFFFF' : 'var(--text-subtle)',
                      cursor: originalLanguage ? 'pointer' : 'not-allowed',
                      minHeight: '44px'
                    }}
                  >
                    {!originalLanguage ? (
                      <><Lock size={18} /> भाषा चुनें (Select Language)</>
                    ) : editingStoryId ? (
                      <><RefreshCw size={18} /> Update & Resubmit to Editor (संशोधित समाचार पुनः भेजें)</>
                    ) : (
                      <><Send size={18} /> Submit to Editor (संपादक के पास भेजें)</>
                    )}
                  </button>
                  {editingStoryId ? (
                    <button
                      type="button"
                      onClick={handleCancelEditing}
                      style={{ background: 'transparent', border: '1px solid var(--border-medium)', padding: '0.6rem 1rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: '#DC2626', cursor: 'pointer', minHeight: '38px', fontWeight: '700' }}
                    >
                      संशोधन रद्द करें (Cancel Editing)
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleDiscardDraft}
                      style={{ background: 'transparent', border: '1px solid var(--border-medium)', padding: '0.6rem 1rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: 'var(--text-subtle)', cursor: 'pointer', minHeight: '38px' }}
                    >
                      नया फॉर्म खाली करें (Clear Form)
                    </button>
                  )}
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
                    <th style={{ textAlign: 'right' }}>कार्य (Actions)</th>
                  </tr>
                </thead>
                <tbody>
                  {myStories.map((story) => (
                    <tr key={story.id}>
                      <td style={{ fontWeight: '700', maxWidth: '340px' }}>
                        <div>{story.title}</div>
                        {story.status === 'rejected' && story.rejection_reason && (
                          <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: '#991B1B', background: '#FEF2F2', padding: '0.35rem 0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid #FECACA', lineHeight: '1.35' }}>
                            <strong>एडिटर निर्देश:</strong> {story.rejection_reason}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="story-category-tag">{story.category}</span>
                      </td>
                      <td>
                        {story.status === 'published' ? (
                          <span className="badge" style={{ background: '#ECFDF5', color: 'var(--accent-emerald)', border: '1px solid #A7F3D0' }}>
                            <CheckCircle size={12} /> Live on Site
                          </span>
                        ) : story.status === 'rejected' ? (
                          <span className="badge" style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FCA5A5', fontWeight: '700' }}>
                            <XCircle size={12} /> Changes Requested (Rejected)
                          </span>
                        ) : (
                          <span className="badge" style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }}>
                            <Clock size={12} /> Pending Editor Review
                          </span>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-subtle)', fontSize: '0.85rem' }}>
                        {story.updated_at || 'हाल ही में'}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => handleEditStory(story)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.45rem 0.85rem',
                            background: story.status === 'rejected' ? '#DC2626' : 'var(--accent-indigo)',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.82rem',
                            fontWeight: '700',
                            cursor: 'pointer',
                            minHeight: '34px',
                            boxShadow: story.status === 'rejected' ? '0 1px 3px rgba(220, 38, 38, 0.3)' : 'none'
                          }}
                          title={story.status === 'rejected' ? 'संपादक के निर्देशानुसार सुधारें और पुनः सबमिट करें' : 'संपादित करें'}
                        >
                          <Edit3 size={13} />
                          <span>{story.status === 'rejected' ? 'सुधारें व पुनः भेजें (Edit & Resubmit)' : 'सुधारें (Edit)'}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Task 22 Subtopic C: 1-Click Insert from Media Library Picker */}
      {isMediaPickerOpen && (
        <div className="admin-modal-overlay" style={{ zIndex: 1200 }}>
          <div className="admin-modal-dialog" style={{ maxWidth: '980px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ImageIcon size={18} color="var(--accent-blue)" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '900', textTransform: 'uppercase' }}>
                  मीडिया लाइब्रेरी से फ़ोटो चुनें (Choose from Media Library)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMediaPickerOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)' }}
              >
                <X size={18} />
              </button>
            </div>

            <MediaLibraryDesk
              currentRole="Reporter"
              onSelectAssetForStory={(asset) => {
                setImagePreview(asset.url);
                setIsImageReady(true);
                if (asset.caption) setImageCaption(asset.caption);
                if (asset.credit) setMediaCredits(asset.credit);
                setIsMediaPickerOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
