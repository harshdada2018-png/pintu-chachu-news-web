import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings, Users, FolderTree, DollarSign, Plus, Trash2, CheckCircle2,
  BarChart2, HardDrive, Share2, Newspaper, Eye, EyeOff, Edit3,
  Radio, Search, Flame, Sparkles, X, RefreshCw, RotateCcw, Check, ExternalLink, ShieldAlert,
  Type, Sliders, Globe, Languages, MapPin, Palette, Monitor, Smartphone, BarChart3,
  Clock, ShieldCheck, History, Image as ImageIcon, FileText, Scale,
  Terminal, Volume2
} from 'lucide-react';
import ArticleRevisionModal from './ArticleRevisionModal';
import ArticleAudioGeneratorPanel from '../shared/ArticleAudioGeneratorPanel';
import MediaLibraryDesk from './MediaLibraryDesk';
import LiveUpdatesModal from './LiveUpdatesModal';
import GrievanceDesk from './GrievanceDesk';
import DeveloperRescueDesk from './DeveloperRescueDesk';
import ConfidentialTipsDesk from './ConfidentialTipsDesk';

/**
 * Format ISO / datetime-local string to clean Indian standard readable format (e.g. 4 Nov 2026, 07:00 AM)
 */
function formatDisplayDateTime(dtStr) {
  if (!dtStr) return '';
  try {
    const d = new Date(dtStr);
    if (isNaN(d.getTime())) return dtStr;
    return d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return dtStr;
  }
}

const WhatsAppIcon = ({ size = 16, color = '#25D366' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);

const InstagramIcon = ({ size = 16, color = '#dc2743' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

const FacebookIcon = ({ size = 16, color = '#1877F2' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

const XTwitterIcon = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

import { DEFAULT_NEWSROOM_CATEGORIES } from '../../services/taxonomyService';
import { getCachedCategories, saveCategoriesToCache, getCachedNews, saveNewsToCache } from '../../services/cacheService';
import { SUPPORTED_LANGUAGES } from '../../services/translationService';
import AnalyticsDashboard from './AnalyticsDashboard';
import StorageSettings from './StorageSettings';
import VisualFontPicker, { DEFAULT_REGIONAL_FONTS, LANGUAGE_PREVIEW_DATA } from './VisualFontPicker';
import ColorPaletteCustomizer from './ColorPaletteCustomizer';
import MonetizationDesk from './MonetizationDesk';
import PollManager from './PollManager';
import StaffPermissionsDesk from './StaffPermissionsDesk';
import { getAuthHeaders } from '../../services/authClient';

// Story Editor Modal Component (with Task 20 Future Auto-Publish Scheduler & Task 21 Revisions)
function StoryEditorModal({ article, categories, onClose, onSave, onOpenRevisions, currentRole = 'admin' }) {
  const isReporter = currentRole === 'reporter';
  const [formData, setFormData] = useState(() => ({
    id: article?.id || `art-${Date.now()}`,
    originalLanguage: article?.originalLanguage || (article ? 'hi' : ''),
    title: article?.title || '',
    sub_title: article?.sub_title || '',
    summary: article?.summary || '',
    content: article?.content || '',
    category: article?.category || 'India',
    category_slug: article?.category_slug || 'india',
    status: isReporter ? 'draft' : (article?.status || 'published'),
    scheduledPublishTime: article?.scheduledPublishTime || '',
    is_breaking: article?.is_breaking || false,
    format: article?.format || (article?.video_url ? 'video' : 'standard'),
    live_status: article?.live_status || 'active',
    featured_image: article?.featured_image || '',
    video_url: article?.video_url || '',
    image_caption: article?.image_caption || '',
    media_credits: article?.media_credits || 'PublicSpark News',
    author_name: article?.author?.name || (isReporter ? 'Staff Reporter' : 'Newsroom Admin'),
    author_role: article?.author?.role || (isReporter ? 'Reporter' : 'Executive Editor'),
    changeNote: '',
    fact_check_verified: article?.fact_check?.verified ?? true,
    fact_check_rating: article?.fact_check?.rating || 'Verified',
    fact_check_desk: article?.fact_check?.desk || 'PublicSpark Fact Desk',
    fact_check_claim: article?.fact_check?.claim || '',
    sources: Array.isArray(article?.sources) ? article.sources : []
  }));

  const [newSourceTitle, setNewSourceTitle] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [newSourceType, setNewSourceType] = useState('Official Press Release');
  const [newSourcePublisher, setNewSourcePublisher] = useState('');

  const SOURCE_PRESETS = [
    {
      label: 'PIB Release',
      title: 'Press Information Bureau (PIB) New Delhi',
      url: 'https://pib.gov.in',
      type: 'Official Press Release',
      publisher: 'Press Information Bureau, Govt of India'
    },
    {
      label: 'Gazette of India',
      title: 'The Gazette of India (Extraordinary Notification)',
      url: 'https://egazette.gov.in',
      type: 'Government Gazette',
      publisher: 'Ministry of Law & Justice, Govt of India'
    },
    {
      label: 'PTI Wire',
      title: 'Press Trust of India (PTI) National Dispatch',
      url: 'https://ptinews.com',
      type: 'News Agency Dispatch',
      publisher: 'PTI News Agency'
    },
    {
      label: 'Judicial Order',
      title: 'Supreme Court / High Court Judicial Order',
      url: 'https://main.sci.gov.in',
      type: 'Judicial Order',
      publisher: 'Judiciary of India'
    },
    {
      label: 'Govt Notification',
      title: 'State Government Administrative Notification',
      url: 'https://india.gov.in',
      type: 'Official Notification',
      publisher: 'Government Administration'
    }
  ];

  const handleAddSource = () => {
    if (!newSourceTitle.trim()) {
      alert('Please enter a source document or publication name.');
      return;
    }
    const newSrc = {
      id: `src-${Date.now()}`,
      title: newSourceTitle.trim(),
      url: newSourceUrl.trim() || 'https://pib.gov.in',
      type: newSourceType,
      publisher: newSourcePublisher.trim() || 'Official Bureau',
      accessed_at: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    };
    setFormData(prev => ({
      ...prev,
      sources: [...prev.sources, newSrc]
    }));
    setNewSourceTitle('');
    setNewSourceUrl('');
    setNewSourcePublisher('');
  };

  const handleRemoveSource = (srcId) => {
    setFormData(prev => ({
      ...prev,
      sources: prev.sources.filter(s => s.id !== srcId)
    }));
  };

  const applySourcePreset = (preset) => {
    setNewSourceTitle(preset.title);
    setNewSourceUrl(preset.url);
    setNewSourceType(preset.type);
    setNewSourcePublisher(preset.publisher);
  };

  const [presetImages, setPresetImages] = useState([]);
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);

  useEffect(() => {
    fetch('/api/presets')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.presetImages)) {
          setPresetImages(data.presetImages);
        }
      })
      .catch(err => console.warn('[Preset Images] Fallback:', err));
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.originalLanguage) {
      alert('Please select the article source language (मूल भाषा चुनें).');
      return;
    }
    if (!formData.title.trim()) {
      alert('Please enter a story headline.');
      return;
    }

    // Role Gate: Reporters can only save drafts
    let finalStatus = formData.status;
    let finalScheduledTime = formData.scheduledPublishTime;
    if (isReporter) {
      finalStatus = 'draft';
      finalScheduledTime = null;
    } else if (finalStatus === 'scheduled') {
      if (!finalScheduledTime) {
        alert('Please specify a target publication date and time for scheduled release.');
        return;
      }
      const schedMs = new Date(finalScheduledTime).getTime();
      if (isNaN(schedMs)) {
        alert('Please enter a valid scheduled date and time.');
        return;
      }
    }

    const selectedCat = categories.find(c => c.name.toLowerCase() === formData.category.toLowerCase());
    const category_slug = selectedCat ? selectedCat.slug : formData.category.toLowerCase().replace(/\s+/g, '-');

    const updatedStory = {
      ...article,
      ...formData,
      status: finalStatus,
      scheduledPublishTime: finalScheduledTime,
      category_slug,
      format: formData.format || (formData.video_url?.trim() ? 'video' : 'standard'),
      live_status: formData.format === 'live' ? (formData.live_status || 'active') : null,
      live_updates: article?.live_updates || [],
      video_url: formData.video_url?.trim() || null,
      author: {
        name: formData.author_name,
        role: formData.author_role,
        avatar: article?.author?.avatar || ''
      },
      published_at: finalStatus === 'scheduled'
        ? `Scheduled: ${formatDisplayDateTime(finalScheduledTime)}`
        : (article?.published_at || 'Just now'),
      views_count: article?.views_count || 0,
      likes_count: article?.likes_count || 0,
      fact_check: {
        verified: formData.fact_check_verified,
        rating: formData.fact_check_rating || 'Verified',
        desk: formData.fact_check_desk?.trim() || 'PublicSpark Fact Desk',
        claim: formData.fact_check_claim?.trim() || '',
        verified_at: article?.fact_check?.verified_at || 'Just now',
        methodology: 'Cross-verified against official gazette notifications and primary agency dispatches in accordance with Press Council of India standards.'
      },
      sources: formData.sources || [],
      userRole: currentRole
    };

    onSave(updatedStory);
  };

  return (
    <div className="admin-modal-overlay">
      <div className="admin-modal-dialog">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <Edit3 color="var(--accent-blue)" size={22} />
            {article ? 'Edit News Story' : 'Create Custom News Story'}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {article?.id && onOpenRevisions && (
              <button
                type="button"
                onClick={() => onOpenRevisions(article)}
                className="btn btn-outline"
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                title="View previous edit history and rollback snapshots"
              >
                <History size={13} /> View Revisions
              </button>
            )}
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer', padding: '0.4rem', borderRadius: '50%' }}
              title="Close modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          {/* Article Source Language Gate */}
          <div style={{
            background: formData.originalLanguage ? 'var(--bg-secondary)' : '#FEF2F2',
            border: formData.originalLanguage ? '1px solid var(--accent-indigo)' : '2px dashed var(--accent-crimson)',
            padding: '1rem',
            borderRadius: 'var(--radius-sm)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-main)', margin: 0 }}>
                <Languages size={17} color="var(--accent-indigo)" />
                Article Source Language (मूल भाषा) <span style={{ color: 'var(--accent-crimson)' }}>*</span>
              </label>
              {formData.originalLanguage ? (
                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--accent-emerald)', background: '#ECFDF5', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid #A7F3D0' }}>
                  Selected: {SUPPORTED_LANGUAGES.find(l => l.code === formData.originalLanguage)?.native} ({SUPPORTED_LANGUAGES.find(l => l.code === formData.originalLanguage)?.name})
                </span>
              ) : (
                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--accent-crimson)', background: '#FEF2F2', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid #FECACA' }}>
                  Mandatory Selection
                </span>
              )}
            </div>
            <select
              value={formData.originalLanguage}
              onChange={(e) => setFormData({ ...formData, originalLanguage: e.target.value })}
              style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', fontSize: '0.9rem', fontWeight: '700', background: 'var(--bg-surface)', color: 'var(--text-main)' }}
              required
            >
              <option value="" disabled>-- Select Story Language (भाषा चुनें) --</option>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.native} ({lang.name})
                </option>
              ))}
            </select>
          </div>

          <div style={{ opacity: formData.originalLanguage ? 1 : 0.55 }}>
            <label style={{ fontSize: '0.85rem', fontWeight: '800', display: 'block', marginBottom: '0.35rem', color: 'var(--text-main)' }}>
              Headline / News Title <span style={{ color: 'var(--accent-crimson)' }}>*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              disabled={!formData.originalLanguage}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder={formData.originalLanguage ? "Enter headline..." : "Select story language first..."}
              style={{ width: '100%', padding: '0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', fontSize: '0.95rem', fontWeight: '700', background: 'var(--bg-main)', color: 'var(--text-main)', cursor: formData.originalLanguage ? 'text' : 'not-allowed' }}
              required
            />
          </div>

          <div className="admin-modal-grid-2col" style={{ opacity: formData.originalLanguage ? 1 : 0.55 }}>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: '800', display: 'block', marginBottom: '0.35rem', color: 'var(--text-main)' }}>Category Taxonomy</label>
              <select
                value={formData.category}
                disabled={!formData.originalLanguage}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                style={{ width: '100%', padding: '0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', fontSize: '0.9rem', fontWeight: '700', background: 'var(--bg-main)', color: 'var(--text-main)', cursor: formData.originalLanguage ? 'pointer' : 'not-allowed' }}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: '800', display: 'block', marginBottom: '0.35rem', color: 'var(--text-main)' }}>
                Publishing & Editorial Status
              </label>
              {isReporter ? (
                <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', padding: '0.55rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#B45309', fontWeight: '800', fontSize: '0.8rem' }}>
                    <ShieldCheck size={15} />
                    <span>Status: Draft / Editorial Review</span>
                  </div>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.7rem', color: '#92400E', lineHeight: '1.3' }}>
                    Editorial Gate: Stories written by reporters are submitted as drafts. Only Editors and Admins can publish live or schedule future publication.
                  </p>
                </div>
              ) : (
                <select
                  value={formData.status}
                  disabled={!formData.originalLanguage}
                  onChange={(e) => {
                    const s = e.target.value;
                    setFormData(prev => ({
                      ...prev,
                      status: s,
                      scheduledPublishTime: s === 'scheduled' && !prev.scheduledPublishTime
                        ? new Date(Date.now() + 3600000).toISOString().slice(0, 16)
                        : prev.scheduledPublishTime
                    }));
                  }}
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-medium)',
                    fontSize: '0.85rem',
                    fontWeight: '800',
                    background: 'var(--bg-main)',
                    color: formData.status === 'published' 
                      ? 'var(--accent-emerald)' 
                      : formData.status === 'scheduled'
                        ? 'var(--accent-blue)'
                        : 'var(--accent-amber)',
                    cursor: formData.originalLanguage ? 'pointer' : 'not-allowed'
                  }}
                >
                  <option value="published">Show Live on Homepage (Published)</option>
                  <option value="scheduled">Schedule Future Auto-Publish (Timer)</option>
                  <option value="hidden">Save as Draft (Hidden from Readers)</option>
                </select>
              )}
            </div>
          </div>

          {/* Scheduled Publishing Timer Picker Box (Task 20) */}
          {!isReporter && formData.status === 'scheduled' && (
            <div style={{
              background: '#EFF6FF',
              border: '1px solid #93C5FD',
              padding: '0.85rem 1rem',
              borderRadius: 'var(--radius-sm)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: '800', color: '#1E40AF', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
                  <Clock size={16} color="#2563EB" />
                  Target Auto-Publish Date & Time:
                </label>
                {formData.scheduledPublishTime && (
                  <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#1D4ED8', background: '#DBEAFE', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                    Release: {formatDisplayDateTime(formData.scheduledPublishTime)}
                  </span>
                )}
              </div>
              <input
                type="datetime-local"
                value={formData.scheduledPublishTime ? formData.scheduledPublishTime.slice(0, 16) : ''}
                onChange={(e) => setFormData({ ...formData, scheduledPublishTime: e.target.value })}
                min={new Date().toISOString().slice(0, 16)}
                style={{ width: '100%', padding: '0.55rem', borderRadius: 'var(--radius-sm)', border: '1px solid #60A5FA', background: '#FFFFFF', fontSize: '0.88rem', fontWeight: '700', color: '#1E3A8A', boxSizing: 'border-box' }}
                required={formData.status === 'scheduled'}
              />
              <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.74rem', color: '#3B82F6', lineHeight: '1.4' }}>
                Auto-Publish Engine: The server clock will automatically flip this story to Live on the homepage at this exact minute. Readers will not see it before this time.
              </p>
            </div>
          )}

          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', background: 'var(--bg-secondary)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', opacity: formData.originalLanguage ? 1 : 0.55 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: '800', cursor: formData.originalLanguage ? 'pointer' : 'not-allowed', color: 'var(--accent-crimson)' }}>
              <input
                type="checkbox"
                checked={formData.is_breaking}
                disabled={!formData.originalLanguage}
                onChange={(e) => setFormData({ ...formData, is_breaking: e.target.checked })}
                style={{ width: '16px', height: '16px', accentColor: 'var(--accent-crimson)' }}
              />
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Flame size={16} /> Mark as Breaking News Ticker Story
              </span>
            </label>
          </div>

          {/* Story Format & Live Blog Selector (Task 23 Subtopic A) */}
          <div style={{
            background: formData.format === 'live' ? '#FEF2F2' : 'var(--bg-secondary)',
            border: formData.format === 'live' ? '1px solid #FCA5A5' : '1px solid var(--border-light)',
            padding: '0.85rem 1rem',
            borderRadius: 'var(--radius-sm)',
            transition: 'all 0.2s ease',
            opacity: formData.originalLanguage ? 1 : 0.55
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '800', color: formData.format === 'live' ? '#991B1B' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
                <Radio size={16} color={formData.format === 'live' ? '#DC2626' : 'var(--text-subtle)'} />
                Story Format & Presentation Mode:
              </label>
              {formData.format === 'live' && (
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: '800',
                  color: formData.live_status === 'active' ? '#B91C1C' : '#4B5563',
                  background: formData.live_status === 'active' ? '#FEE2E2' : '#E5E7EB',
                  border: formData.live_status === 'active' ? '1px solid #F87171' : '1px solid #D1D5DB',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                  textTransform: 'uppercase'
                }}>
                  {formData.live_status === 'active' ? 'Live Timeline Active' : 'Coverage Concluded'}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: formData.format === 'live' ? '0.75rem' : '0' }}>
              <button
                type="button"
                disabled={!formData.originalLanguage}
                onClick={() => setFormData({ ...formData, format: 'standard' })}
                className="btn"
                style={{
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  borderRadius: '4px',
                  border: formData.format === 'standard' ? '1px solid #0E2A47' : '1px solid var(--border-medium)',
                  background: formData.format === 'standard' ? '#0E2A47' : '#FFFFFF',
                  color: formData.format === 'standard' ? '#FFFFFF' : 'var(--text-main)',
                  cursor: formData.originalLanguage ? 'pointer' : 'not-allowed'
                }}
              >
                Standard Article
              </button>

              <button
                type="button"
                disabled={!formData.originalLanguage}
                onClick={() => setFormData({ ...formData, format: 'live', live_status: formData.live_status || 'active' })}
                className="btn"
                style={{
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.8rem',
                  fontWeight: '800',
                  borderRadius: '4px',
                  border: formData.format === 'live' ? '1px solid #DC2626' : '1px solid var(--border-medium)',
                  background: formData.format === 'live' ? '#DC2626' : '#FFFFFF',
                  color: formData.format === 'live' ? '#FFFFFF' : 'var(--text-main)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  cursor: formData.originalLanguage ? 'pointer' : 'not-allowed'
                }}
              >
                <Radio size={13} /> Live Blog (Timeline Mode)
              </button>

              <button
                type="button"
                disabled={!formData.originalLanguage}
                onClick={() => setFormData({ ...formData, format: 'video' })}
                className="btn"
                style={{
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  borderRadius: '4px',
                  border: formData.format === 'video' ? '1px solid #0E2A47' : '1px solid var(--border-medium)',
                  background: formData.format === 'video' ? '#0E2A47' : '#FFFFFF',
                  color: formData.format === 'video' ? '#FFFFFF' : 'var(--text-main)',
                  cursor: formData.originalLanguage ? 'pointer' : 'not-allowed'
                }}
              >
                Video Story
              </button>
            </div>

            {/* Live Blog Coverage Status Options */}
            {formData.format === 'live' && (
              <div style={{
                borderTop: '1px solid #FCA5A5',
                paddingTop: '0.65rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.5rem'
              }}>
                <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#7F1D1D' }}>
                  Coverage Status (Event Status):
                </span>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, live_status: 'active' })}
                    style={{
                      padding: '0.25rem 0.6rem',
                      fontSize: '0.72rem',
                      fontWeight: '800',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      border: formData.live_status === 'active' ? '1px solid #DC2626' : '1px solid #E5E7EB',
                      background: formData.live_status === 'active' ? '#DC2626' : '#FFFFFF',
                      color: formData.live_status === 'active' ? '#FFFFFF' : '#374151'
                    }}
                  >
                    Live Active (Ongoing)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, live_status: 'concluded' })}
                    style={{
                      padding: '0.25rem 0.6rem',
                      fontSize: '0.72rem',
                      fontWeight: '800',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      border: formData.live_status === 'concluded' ? '1px solid #4B5563' : '1px solid #E5E7EB',
                      background: formData.live_status === 'concluded' ? '#4B5563' : '#FFFFFF',
                      color: formData.live_status === 'concluded' ? '#FFFFFF' : '#374151'
                    }}
                  >
                    Coverage Concluded (Ended)
                  </button>
                </div>
              </div>
            )}
          </div>

          <div style={{ opacity: formData.originalLanguage ? 1 : 0.55 }}>
            <label style={{ fontSize: '0.85rem', fontWeight: '800', display: 'block', marginBottom: '0.35rem', color: 'var(--text-main)' }}>Short Summary Excerpt</label>
            <textarea
              rows={2}
              value={formData.summary}
              disabled={!formData.originalLanguage}
              onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
              placeholder="Brief teaser summary for card preview..."
              style={{ width: '100%', padding: '0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', fontSize: '0.875rem', background: 'var(--bg-main)', color: 'var(--text-main)', cursor: formData.originalLanguage ? 'text' : 'not-allowed' }}
            />
          </div>

          <div style={{ opacity: formData.originalLanguage ? 1 : 0.55 }}>
            <label style={{ fontSize: '0.85rem', fontWeight: '800', display: 'block', marginBottom: '0.35rem', color: 'var(--text-main)' }}>Full Article Body Content</label>
            <textarea
              rows={5}
              value={formData.content}
              disabled={!formData.originalLanguage}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Detailed news article body..."
              style={{ width: '100%', padding: '0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', fontSize: '0.875rem', fontFamily: 'monospace', background: 'var(--bg-main)', color: 'var(--text-main)', cursor: formData.originalLanguage ? 'text' : 'not-allowed' }}
            />
          </div>

          <div style={{ opacity: formData.originalLanguage ? 1 : 0.55 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
                Featured Cover Image
              </label>
              <button
                type="button"
                disabled={!formData.originalLanguage}
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
                  cursor: formData.originalLanguage ? 'pointer' : 'not-allowed'
                }}
              >
                <ImageIcon size={13} />
                <span>Choose from Media Library</span>
              </button>
            </div>

            <input
              type="text"
              value={formData.featured_image}
              disabled={!formData.originalLanguage}
              onChange={(e) => setFormData({ ...formData, featured_image: e.target.value })}
              placeholder="https://images.unsplash.com/... or /uploads/img_..."
              style={{ width: '100%', padding: '0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', fontSize: '0.85rem', background: 'var(--bg-main)', color: 'var(--text-main)', cursor: formData.originalLanguage ? 'text' : 'not-allowed' }}
            />

            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', alignSelf: 'center' }}>Presets:</span>
              {presetImages.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={!formData.originalLanguage}
                  onClick={() => setFormData({ ...formData, featured_image: preset.url })}
                  style={{
                    fontSize: '0.725rem',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '12px',
                    border: '1px solid var(--border-medium)',
                    background: formData.featured_image === preset.url ? 'var(--accent-blue)' : 'var(--bg-secondary)',
                    color: formData.featured_image === preset.url ? '#fff' : 'var(--text-subtle)',
                    cursor: formData.originalLanguage ? 'pointer' : 'not-allowed'
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {formData.featured_image && (
              <div style={{ marginTop: '0.6rem', height: '120px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-light)' }}>
                <img src={formData.featured_image} alt="Cover preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}

            {/* Photo Caption & Media Credit Inputs */}
            <div className="admin-modal-grid-2col" style={{ marginTop: '0.65rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: '800', display: 'block', marginBottom: '0.2rem', color: 'var(--text-subtle)' }}>
                  Photo Caption
                </label>
                <input
                  type="text"
                  value={formData.image_caption}
                  disabled={!formData.originalLanguage}
                  onChange={(e) => setFormData({ ...formData, image_caption: e.target.value })}
                  placeholder="Short line describing cover photo..."
                  style={{ width: '100%', padding: '0.45rem 0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', fontSize: '0.8rem', background: 'var(--bg-main)', color: 'var(--text-main)', cursor: formData.originalLanguage ? 'text' : 'not-allowed' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: '800', display: 'block', marginBottom: '0.2rem', color: 'var(--text-subtle)' }}>
                  Photo Credit / Source
                </label>
                <input
                  type="text"
                  value={formData.media_credits}
                  disabled={!formData.originalLanguage}
                  onChange={(e) => setFormData({ ...formData, media_credits: e.target.value })}
                  placeholder="e.g. PTI / Reuters / Staff Photo"
                  style={{ width: '100%', padding: '0.45rem 0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', fontSize: '0.8rem', background: 'var(--bg-main)', color: 'var(--text-main)', cursor: formData.originalLanguage ? 'text' : 'not-allowed' }}
                />
              </div>
            </div>
          </div>

          <div style={{ opacity: formData.originalLanguage ? 1 : 0.55 }}>
            <label style={{ fontSize: '0.85rem', fontWeight: '800', display: 'block', marginBottom: '0.35rem', color: 'var(--text-main)' }}>
              YouTube Video URL (Optional)
            </label>
            <input
              type="url"
              value={formData.video_url}
              disabled={!formData.originalLanguage}
              onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
              placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
              style={{ width: '100%', padding: '0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', fontSize: '0.85rem', background: 'var(--bg-main)', color: 'var(--text-main)', cursor: formData.originalLanguage ? 'text' : 'not-allowed' }}
            />
            <span style={{ fontSize: '0.725rem', color: 'var(--text-subtle)', display: 'block', marginTop: '0.2rem' }}>
              Leave blank if no video. When provided, an interactive video player embeds inside the article and marks the card with video play badge.
            </span>
          </div>

          <div className="admin-modal-grid-2col" style={{ opacity: formData.originalLanguage ? 1 : 0.55 }}>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: '800', display: 'block', marginBottom: '0.35rem', color: 'var(--text-main)' }}>Author Name</label>
              <input
                type="text"
                value={formData.author_name}
                disabled={!formData.originalLanguage}
                onChange={(e) => setFormData({ ...formData, author_name: e.target.value })}
                style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', fontSize: '0.85rem', background: 'var(--bg-main)', color: 'var(--text-main)', cursor: formData.originalLanguage ? 'text' : 'not-allowed' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: '800', display: 'block', marginBottom: '0.35rem', color: 'var(--text-main)' }}>Author Title / Designation</label>
              <input
                type="text"
                value={formData.author_role}
                disabled={!formData.originalLanguage}
                onChange={(e) => setFormData({ ...formData, author_role: e.target.value })}
                style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', fontSize: '0.85rem', background: 'var(--bg-main)', color: 'var(--text-main)', cursor: formData.originalLanguage ? 'text' : 'not-allowed' }}
              />
            </div>
          </div>

          {/* Task 25: Fact-Check & Official Sources Section */}
          <div style={{
            background: '#F8FAFC',
            border: '1px solid #CBD5E1',
            borderRadius: '4px',
            padding: '1rem',
            opacity: formData.originalLanguage ? 1 : 0.55
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.75rem', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.5rem' }}>
              <ShieldCheck size={18} color="#059669" />
              <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: '900', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                Fact-Check & Source Credibility Box (तथ्य सत्यापन एवं स्रोत)
              </h4>
            </div>

            {/* Subtopic A: Verification Rating & Verifying Desk */}
            <div className="admin-modal-grid-2col" style={{ marginBottom: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: '800', display: 'block', marginBottom: '0.25rem', color: '#334155' }}>
                  Verification Status (सत्यापन दर्जा)
                </label>
                <select
                  value={formData.fact_check_rating}
                  disabled={!formData.originalLanguage}
                  onChange={(e) => setFormData({ ...formData, fact_check_rating: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #94A3B8', fontSize: '0.82rem', fontWeight: '700', background: '#FFFFFF', color: '#0F172A' }}
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
                  Verifying Desk / Bureau (सत्यापनकर्ता ब्यूरो)
                </label>
                <input
                  type="text"
                  value={formData.fact_check_desk}
                  disabled={!formData.originalLanguage}
                  onChange={(e) => setFormData({ ...formData, fact_check_desk: e.target.value })}
                  placeholder="e.g. PublicSpark Fact Desk / PIB"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #94A3B8', fontSize: '0.82rem', background: '#FFFFFF', color: '#0F172A' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: '800', display: 'block', marginBottom: '0.25rem', color: '#334155' }}>
                Key Claim / Fact-Check Finding Note (विवेचना / दावा सत्यापन)
              </label>
              <input
                type="text"
                value={formData.fact_check_claim}
                disabled={!formData.originalLanguage}
                onChange={(e) => setFormData({ ...formData, fact_check_claim: e.target.value })}
                placeholder="e.g. Primary notifications, statistical records, and press briefings cross-checked."
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #94A3B8', fontSize: '0.82rem', background: '#FFFFFF', color: '#0F172A' }}
              />
            </div>

            {/* Subtopic B: Official Sources & Gazette Citations List & Adder */}
            <div style={{ marginTop: '1rem', borderTop: '1px dashed #CBD5E1', paddingTop: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#0E2A47', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <FileText size={15} /> Primary Sources & Gazette Citations ({formData.sources.length})
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>
                  Cited in public reader view
                </span>
              </div>

              {/* Current Sources */}
              {formData.sources.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginBottom: '0.75rem' }}>
                  {formData.sources.map((src) => (
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
                          <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#0F172A', wordBreak: 'break-word' }}>
                            {src.title}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748B', display: 'flex', gap: '0.6rem', marginTop: '0.15rem' }}>
                          <span>{src.publisher}</span>
                          <span>•</span>
                          <a href={src.url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB', textDecoration: 'none' }}>
                            {src.url}
                          </a>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveSource(src.id)}
                        className="btn btn-outline"
                        style={{ padding: '0.25rem 0.45rem', borderColor: '#FCA5A5', color: '#DC2626', minHeight: '32px' }}
                        title="Remove citation"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '0.75rem', color: '#64748B', fontStyle: 'italic', marginBottom: '0.75rem', padding: '0.4rem 0' }}>
                  No custom sources added yet. Standard institutional citations (PIB / Gazette) will be shown as defaults.
                </div>
              )}

              {/* Quick Presets */}
              <div style={{ marginBottom: '0.65rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '0.3rem' }}>
                  Quick Citation Presets (1-Click Auto-Fill):
                </span>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {SOURCE_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={!formData.originalLanguage}
                      onClick={() => applySourcePreset(preset)}
                      className="btn btn-outline"
                      style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', background: '#FFFFFF', borderColor: '#CBD5E1', color: '#334155', cursor: 'pointer' }}
                    >
                      + {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Add New Source Input Fields */}
              <div style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '4px', padding: '0.65rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: '700', display: 'block', marginBottom: '0.2rem', color: '#334155' }}>Source Document / Gazette Title</label>
                    <input
                      type="text"
                      value={newSourceTitle}
                      disabled={!formData.originalLanguage}
                      onChange={(e) => setNewSourceTitle(e.target.value)}
                      placeholder="e.g. Gazette of India Notification No. 42"
                      style={{ width: '100%', padding: '0.45rem', borderRadius: '3px', border: '1px solid #94A3B8', fontSize: '0.78rem', background: '#FFFFFF' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: '700', display: 'block', marginBottom: '0.2rem', color: '#334155' }}>Source Web Link / Document URL</label>
                    <input
                      type="url"
                      value={newSourceUrl}
                      disabled={!formData.originalLanguage}
                      onChange={(e) => setNewSourceUrl(e.target.value)}
                      placeholder="https://egazette.gov.in/..."
                      style={{ width: '100%', padding: '0.45rem', borderRadius: '3px', border: '1px solid #94A3B8', fontSize: '0.78rem', background: '#FFFFFF' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem', alignItems: 'flex-end' }}>
                  <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: '700', display: 'block', marginBottom: '0.2rem', color: '#334155' }}>Source Classification</label>
                    <select
                      value={newSourceType}
                      disabled={!formData.originalLanguage}
                      onChange={(e) => setNewSourceType(e.target.value)}
                      style={{ width: '100%', padding: '0.45rem', borderRadius: '3px', border: '1px solid #94A3B8', fontSize: '0.78rem', background: '#FFFFFF' }}
                    >
                      <option value="Government Gazette">Government Gazette (राजपत्र)</option>
                      <option value="Official Press Release">Official Press Release (प्रेस नोट)</option>
                      <option value="Judicial Order">Judicial Order (न्यायिक आदेश)</option>
                      <option value="News Agency Dispatch">News Agency Wire (PTI/ANI)</option>
                      <option value="Official Notification">Official Notification (मंत्रालय)</option>
                      <option value="Institutional Report">Institutional Report (संस्थागत रिपोर्ट)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: '700', display: 'block', marginBottom: '0.2rem', color: '#334155' }}>Publishing Authority / Ministry</label>
                    <input
                      type="text"
                      value={newSourcePublisher}
                      disabled={!formData.originalLanguage}
                      onChange={(e) => setNewSourcePublisher(e.target.value)}
                      placeholder="e.g. Ministry of Home Affairs"
                      style={{ width: '100%', padding: '0.45rem', borderRadius: '3px', border: '1px solid #94A3B8', fontSize: '0.78rem', background: '#FFFFFF' }}
                    />
                  </div>

                  <button
                    type="button"
                    disabled={!formData.originalLanguage || !newSourceTitle.trim()}
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
                    <Plus size={14} /> Add Citation
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Edit Summary / Change Note (Task 21) */}
          <div style={{ opacity: formData.originalLanguage ? 1 : 0.55 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: '800', display: 'block', marginBottom: '0.35rem', color: 'var(--text-main)' }}>
              Edit Summary / Change Note (Optional)
            </label>
            <input
              type="text"
              value={formData.changeNote || ''}
              disabled={!formData.originalLanguage}
              onChange={(e) => setFormData({ ...formData, changeNote: e.target.value })}
              placeholder="e.g. Factual correction in paragraph 2, headline revised..."
              style={{ width: '100%', padding: '0.55rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', fontSize: '0.82rem', background: 'var(--bg-main)', color: 'var(--text-main)', cursor: formData.originalLanguage ? 'text' : 'not-allowed' }}
            />
          </div>

          {/* Task 44.6 Subtopic C: Inline Sequential Audio Generator inside Story Editor */}
          {article?.id && !isReporter && (
            <div style={{ marginTop: '0.5rem' }}>
              <ArticleAudioGeneratorPanel
                article={{ ...article, ...formData, id: article.id }}
                compact
              />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
            <button type="button" onClick={onClose} className="btn btn-outline" style={{ padding: '0.6rem 1.25rem' }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={!formData.originalLanguage}
              className="btn btn-primary"
              style={{
                padding: '0.65rem 1.5rem',
                fontWeight: '800',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: formData.originalLanguage ? 'var(--accent-blue)' : 'var(--border-medium)',
                borderColor: formData.originalLanguage ? 'var(--accent-blue)' : 'var(--border-medium)',
                cursor: formData.originalLanguage ? 'pointer' : 'not-allowed'
              }}
            >
              <CheckCircle2 size={16} /> Save & Apply Story
            </button>
          </div>
        </form>

        {/* Task 22 Subtopic C: 1-Click Insert from Media Library Picker */}
        {isMediaPickerOpen && (
          <div className="admin-modal-overlay" style={{ zIndex: 1200 }}>
            <div className="admin-modal-dialog" style={{ maxWidth: '980px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.65rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ImageIcon size={18} color="var(--accent-blue)" />
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '900', textTransform: 'uppercase' }}>
                    Select Cover Photo from Media Library
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
                currentRole={currentRole}
                onSelectAssetForStory={(asset) => {
                  setFormData(prev => ({
                    ...prev,
                    featured_image: asset.url,
                    image_caption: asset.caption || prev.image_caption || '',
                    media_credits: asset.credit || prev.media_credits || 'PublicSpark News'
                  }));
                  setIsMediaPickerOpen(false);
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function cleanRssText(text) {
  if (!text) return '';
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<a\b[^>]*>.*?<\/a>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function AdminWorkspace({
  currentRole = 'admin',
  articles: propArticles,
  onUpdateArticles,
  categories: propCategories,
  onUpdateCategories,
  socialLinks,
  onUpdateSocialLinks,
  typography,
  onUpdateTypography,
  themePalette,
  onUpdateTheme,
  onShowToast,
  onSelectArticle,
  initialDesk
}) {
  const isReporter = currentRole === 'reporter';
  const [activeTab, setActiveTab] = useState(() => initialDesk || 'curation'); // default to News Control Desk
  const [categories, setCategories] = useState(() => {
    return propCategories || getCachedCategories() || DEFAULT_NEWSROOM_CATEGORIES;
  });
  const [articles, setArticles] = useState(() => {
    return propArticles || getCachedNews()?.articles || [];
  });

  const [localTypography, setLocalTypography] = useState(() => {
    return {
      headingFont: 'Playfair Display',
      bodyFont: 'Plus Jakarta Sans',
      headingScale: 100,
      headingWeight: 700,
      bodySize: 16,
      bodyWeight: 400,
      mobileHeadingScale: 85,
      mobileBodySize: 15,
      regionalFonts: DEFAULT_REGIONAL_FONTS,
      ...(typography || {})
    };
  });
  const [hasUnsavedTypographyChanges, setHasUnsavedTypographyChanges] = useState(false);
  const [deviceMode, setDeviceMode] = useState('desktop'); // 'desktop' | 'mobile'

  const [scopeMode, setScopeMode] = useState('global'); // 'global' | 'regional'
  const [selectedRegionalLang, setSelectedRegionalLang] = useState('hi'); // default to Hindi
  const [langSearchQuery, setLangSearchQuery] = useState('');

  const [prevTypography, setPrevTypography] = useState(typography);
  if (typography !== prevTypography) {
    setPrevTypography(typography);
    setLocalTypography(prev => ({
      ...prev,
      ...typography,
      headingWeight: typography?.headingWeight || prev.headingWeight || 700,
      bodyWeight: typography?.bodyWeight || prev.bodyWeight || 400,
      mobileHeadingScale: typography?.mobileHeadingScale || prev.mobileHeadingScale || 85,
      mobileBodySize: typography?.mobileBodySize || prev.mobileBodySize || 15,
      regionalFonts: typography?.regionalFonts || prev.regionalFonts || DEFAULT_REGIONAL_FONTS
    }));
    setHasUnsavedTypographyChanges(false);
  }

  // Sync state if props update from parent
  const [prevPropArticles, setPrevPropArticles] = useState(propArticles);
  if (propArticles !== prevPropArticles) {
    setPrevPropArticles(propArticles);
    if (propArticles) setArticles(propArticles);
  }

  const [filterStatus, setFilterStatus] = useState('all'); // all | published | hidden | live_feed
  const [searchQuery, setSearchQuery] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [editingCatId, setEditingCatId] = useState(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState('');

  // Live RSS / SauravTech News Feed State
  const [liveFeedItems, setLiveFeedItems] = useState([]);
  const [isLoadingLiveFeed, setIsLoadingLiveFeed] = useState(false);
  const [wireStreamKey, setWireStreamKey] = useState('google_hi');

  // Story Editor Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState(null);

  // Article Revision History & Rollback Modal State (Task 21)
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [revisionModalArticle, setRevisionModalArticle] = useState(null);

  // Live Blog Micro-Updates Desk Modal State (Task 23 Subtopic B)
  const [isLiveUpdatesModalOpen, setIsLiveUpdatesModalOpen] = useState(false);
  const [liveUpdatesModalArticle, setLiveUpdatesModalArticle] = useState(null);

  // Manual Article Audio Generator Modal State (Task 44.6 Subtopic C)
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);
  const [audioModalArticle, setAudioModalArticle] = useState(null);

  const [localSocialLinks, setLocalSocialLinks] = useState(() => {
    return socialLinks || {
      whatsapp: 'https://whatsapp.com',
      instagram: 'https://instagram.com',
      facebook: 'https://facebook.com',
      twitter: 'https://x.com'
    };
  });

  // Newsroom Staff Count
  const [staffCount, setStaffCount] = useState(0);

  useEffect(() => {
    fetch('/api/staff')
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.staff)) {
          setStaffCount(data.staff.length);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch Live News Stream (Google RSS & Topic Feeds)
  const fetchLiveNewsStream = useCallback((streamKey = wireStreamKey) => {
    setIsLoadingLiveFeed(true);
    let targetUrl = '/api/live-news?provider=google&topic=GENERAL&lang=hi';

    if (streamKey === 'google_en') {
      targetUrl = '/api/live-news?provider=google&topic=GENERAL&lang=en';
    } else if (streamKey.startsWith('google_topic_')) {
      const topic = streamKey.replace('google_topic_', '').toUpperCase();
      targetUrl = `/api/live-news?provider=google&topic=${topic}&lang=hi`;
    } else if (streamKey.startsWith('saurav_')) {
      const cat = streamKey.replace('saurav_', '');
      targetUrl = `/api/live-news?provider=saurav&category=${cat}`;
    }

    fetch(targetUrl)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (data.items && data.items.length > 0) {
          setLiveFeedItems(data.items);
          if (onShowToast) {
            onShowToast(`Fetched ${data.items.length} incoming live stories from news wire!`);
          }
        } else {
          // Automatic fallback to Google Top Stories RSS if specific topic returns 0
          fetch('/api/live-news?provider=google&topic=GENERAL&lang=hi')
            .then(r => r.json())
            .then(fallbackData => {
              if (fallbackData.items && fallbackData.items.length > 0) {
                setLiveFeedItems(fallbackData.items);
                if (onShowToast) onShowToast(`Fetched ${fallbackData.items.length} live stories!`);
              } else if (onShowToast) {
                onShowToast('Wire response received but no stories found.');
              }
            });
        }
      })
      .catch(err => {
        console.warn('Live news fetch error:', err);
        if (onShowToast) {
          onShowToast('Connection issue: backend server busy or unreachable. Please retry.');
        }
      })
      .finally(() => setIsLoadingLiveFeed(false));
  }, [wireStreamKey, onShowToast]);

  useEffect(() => {
    let isCancelled = false;
    fetch('/api/live-news?provider=google&topic=GENERAL&lang=hi')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!isCancelled && data && Array.isArray(data.items) && data.items.length > 0) {
          setLiveFeedItems(data.items);
        }
      })
      .catch(() => {});
    return () => { isCancelled = true; };
  }, []);

  // 1-Click Show/Hide Toggle (Guarded by Editorial RBAC & Scheduled Support)
  const handleToggleVisibility = (articleId) => {
    if (isReporter) {
      if (onShowToast) onShowToast('Editorial Gate: Reporters cannot toggle live publication. Please submit drafts for Editor review.');
      return;
    }
    const updated = articles.map(a => {
      if (a.id === articleId) {
        let nextStatus;
        let scheduledPublishTime = a.scheduledPublishTime;
        if (a.status === 'published') {
          nextStatus = 'hidden';
        } else if (a.status === 'scheduled') {
          // If scheduled, clicking Publish Now publishes immediately
          nextStatus = 'published';
          scheduledPublishTime = null;
        } else {
          nextStatus = 'published';
        }

        const updatedArt = { 
          ...a, 
          status: nextStatus, 
          scheduledPublishTime,
          published_at: nextStatus === 'published' ? 'Just now' : a.published_at,
          userRole: currentRole 
        };
        fetch('/api/articles/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify(updatedArt)
        }).catch(e => console.warn('Backend update error:', e));
        return updatedArt;
      }
      return a;
    });
    setArticles(updated);
    if (onUpdateArticles) onUpdateArticles(updated);
    saveNewsToCache(updated);

    const target = articles.find(a => a.id === articleId);
    const nextStatus = target?.status === 'published' ? 'Hidden from homepage' : 'Published live on homepage';
    setFeedbackMsg(`Article status updated: ${nextStatus}`);
    setTimeout(() => setFeedbackMsg(''), 3000);
  };

  // Save Article from Modal
  const handleSaveArticleModal = (savedStory) => {
    const existingIdx = articles.findIndex(a => a.id === savedStory.id);
    let updatedList;
    if (existingIdx >= 0) {
      updatedList = [...articles];
      updatedList[existingIdx] = savedStory;
    } else {
      updatedList = [savedStory, ...articles];
    }
    setArticles(updatedList);
    if (onUpdateArticles) onUpdateArticles(updatedList);
    saveNewsToCache(updatedList);

    fetch('/api/articles/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        ...savedStory,
        userRole: currentRole
      })
    }).catch(e => console.warn('Backend update error:', e));

    setIsEditModalOpen(false);
    setEditingArticle(null);
    setFeedbackMsg(`Successfully saved article: "${savedStory.title}"`);
    setTimeout(() => setFeedbackMsg(''), 3000);
  };

  // Article Revision & Rollback Handlers (Task 21)
  const handleOpenRevisionHistory = (art) => {
    setRevisionModalArticle(art);
    setIsRevisionModalOpen(true);
  };

  const handleRollbackSuccess = (restoredArticle) => {
    const updated = articles.map(a => a.id === restoredArticle.id ? restoredArticle : a);
    setArticles(updated);
    if (onUpdateArticles) onUpdateArticles(updated);
    saveNewsToCache(updated);
    setFeedbackMsg(`Article successfully rolled back: "${restoredArticle.title}"`);
    setTimeout(() => setFeedbackMsg(''), 3500);
  };

  // Delete Article
  const handleDeleteArticle = (articleId, title) => {
    if (window.confirm(`Are you sure you want to permanently delete "${title}"?`)) {
      const updatedList = articles.filter(a => a.id !== articleId);
      setArticles(updatedList);
      if (onUpdateArticles) onUpdateArticles(updatedList);
      saveNewsToCache(updatedList);

      fetch('/api/articles/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ id: articleId })
      }).catch(e => console.warn('Backend delete error:', e));

      setFeedbackMsg(`Deleted article "${title}".`);
      setTimeout(() => setFeedbackMsg(''), 3000);
    }
  };

  // Approve Live RSS Item
  const handleApproveLiveFeedItem = (item) => {
    const approvedStory = {
      ...item,
      status: 'published',
      published_at: 'Just now'
    };

    const updatedList = [approvedStory, ...articles];
    setArticles(updatedList);
    if (onUpdateArticles) onUpdateArticles(updatedList);
    saveNewsToCache(updatedList);

    fetch('/api/articles/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(approvedStory)
    }).catch(e => console.warn('Backend update error:', e));

    setLiveFeedItems(liveFeedItems.filter(i => i.id !== item.id));
    setFeedbackMsg(`Approved & Published live story: "${item.title.slice(0, 40)}..."`);
    setTimeout(() => setFeedbackMsg(''), 3000);
  };



  const handleAddCategory = (e) => {
    if (e) e.preventDefault();
    const trimmed = newCatName.trim();
    if (!trimmed) {
      alert('Please enter a valid category name.');
      return;
    }

    const isDuplicate = categories.some(
      c => c.name.toLowerCase() === trimmed.toLowerCase() || c.slug === trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    );

    if (isDuplicate) {
      alert(`Category "${trimmed}" already exists.`);
      return;
    }

    const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const newCategory = { id: `cat-${Date.now()}`, name: trimmed, slug };
    const updated = [...categories, newCategory];

    setCategories(updated);
    saveCategoriesToCache(updated);
    if (onUpdateCategories) {
      onUpdateCategories(updated);
    }

    // Persist directly to backend server
    fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(updated)
    }).catch(e => console.warn('Backend categories sync error:', e));

    setNewCatName('');
    setFeedbackMsg(`Added category "${trimmed}" successfully!`);
    setTimeout(() => setFeedbackMsg(''), 3000);
  };

  const handleStartEditCategory = (cat) => {
    setEditingCatId(cat.id);
    setEditingCatName(cat.name);
  };

  const handleCancelEditCategory = () => {
    setEditingCatId(null);
    setEditingCatName('');
  };

  const handleSaveEditCategory = (catId) => {
    const trimmed = editingCatName.trim();
    if (!trimmed) {
      alert('Category name cannot be empty.');
      return;
    }

    const isDuplicate = categories.some(
      c => c.id !== catId && (c.name.toLowerCase() === trimmed.toLowerCase() || c.slug === trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
    );

    if (isDuplicate) {
      alert(`Category "${trimmed}" already exists.`);
      return;
    }

    const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const updated = categories.map(c => c.id === catId ? { ...c, name: trimmed, slug } : c);

    setCategories(updated);
    saveCategoriesToCache(updated);
    if (onUpdateCategories) {
      onUpdateCategories(updated);
    }

    // Persist directly to backend server
    fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(updated)
    }).catch(e => console.warn('Backend categories sync error:', e));

    setEditingCatId(null);
    setEditingCatName('');
    setFeedbackMsg(`Updated category name to "${trimmed}".`);
    setTimeout(() => setFeedbackMsg(''), 3000);
  };

  const handleDeleteCategory = (catId) => {
    const target = categories.find(c => c.id === catId);
    if (!target) return;

    // Safety check if any articles belong to this category
    const articleCount = articles.filter(a => 
      (a.category_slug === target.slug || a.category?.toLowerCase() === target.name?.toLowerCase())
    ).length;

    if (articleCount > 0) {
      if (!window.confirm(`Notice: ${articleCount} article(s) are currently categorized as "${target.name}". Are you sure you want to delete this category?`)) {
        return;
      }
    }

    const updated = categories.filter(c => c.id !== catId);
    setCategories(updated);
    saveCategoriesToCache(updated);
    if (onUpdateCategories) {
      onUpdateCategories(updated);
    }

    // Persist directly to backend server
    fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(updated)
    }).catch(e => console.warn('Backend categories sync error:', e));

    setFeedbackMsg(`Removed category "${target.name}".`);
    setTimeout(() => setFeedbackMsg(''), 3000);
  };

  // Filtered Articles List (with Scheduled & Live Blog Filters Support)
  const filteredArticles = articles.filter(art => {
    if (filterStatus === 'published' && art.status !== 'published') return false;
    if (filterStatus === 'scheduled' && art.status !== 'scheduled') return false;
    if (filterStatus === 'live_blog' && art.format !== 'live') return false;
    if (filterStatus === 'hidden' && (art.status === 'published' || art.status === 'scheduled')) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return art.title.toLowerCase().includes(q) || (art.summary && art.summary.toLowerCase().includes(q));
    }
    return true;
  });

  const ADMIN_DESKS = [
    { id: 'curation', label: `Live News Control (${articles.length})`, shortLabel: `News (${articles.length})`, icon: Newspaper, group: 'Editorial & Content' },
    { id: 'media', label: 'Media Library', shortLabel: 'Media', icon: ImageIcon, group: 'Editorial & Content' },
    { id: 'poll', label: 'Daily Reader Poll', shortLabel: 'Reader Poll', icon: BarChart3, group: 'Editorial & Content' },
    { id: 'categories', label: `Categories (${categories.length})`, shortLabel: `Categories (${categories.length})`, icon: FolderTree, group: 'Editorial & Content' },
    { id: 'analytics', label: 'Analytics & Traffic', shortLabel: 'Analytics', icon: BarChart2, group: 'Editorial & Content' },
    { id: 'typography', label: 'Typography & Fonts', shortLabel: 'Typography', icon: Type, group: 'Design & Brand Identity' },
    { id: 'theme', label: 'Color Harmonies & Themes', shortLabel: 'Colors & Theme', icon: Palette, group: 'Design & Brand Identity' },
    { id: 'social', label: 'Social Channels Links', shortLabel: 'Social Links', icon: Share2, group: 'Design & Brand Identity' },
    { id: 'ads', label: 'Ad Slot Placements', shortLabel: 'Ad Slots', icon: DollarSign, group: 'Operations & Monetization' },
    { id: 'storage', label: 'Storage & Backups Desk', shortLabel: 'Backups', icon: HardDrive, group: 'Operations & Monetization' },
    { id: 'grievance', label: 'Statutory Grievances', shortLabel: 'Grievances', icon: Scale, group: 'Operations & Monetization' },
    ...((currentRole === 'admin' || currentRole === 'developer') ? [
      { id: 'tips', label: 'Confidential Tips (Gupt)', shortLabel: 'Gupt Tips', icon: EyeOff, group: 'Operations & Monetization' }
    ] : []),
    { id: 'users', label: `Team & Permissions ${staffCount > 0 ? `(${staffCount})` : ''}`, shortLabel: `Team ${staffCount > 0 ? `(${staffCount})` : ''}`, icon: Users, group: 'Operations & Monetization' },
    ...(currentRole === 'developer' ? [
      { id: 'developer', label: 'Developer Rescue & Diagnostics', shortLabel: 'Rescue Desk', icon: Terminal, group: 'Operations & Monetization' }
    ] : [])
  ];

  return (
    <div className="container admin-container">
      {/* Story Editor Modal */}
      {isEditModalOpen && (
        <StoryEditorModal
          article={editingArticle}
          categories={categories}
          currentRole={currentRole}
          onClose={() => { setIsEditModalOpen(false); setEditingArticle(null); }}
          onSave={handleSaveArticleModal}
          onOpenRevisions={handleOpenRevisionHistory}
        />
      )}

      {/* Article Revision History & Rollback Modal (Task 21) */}
      {isRevisionModalOpen && revisionModalArticle && (
        <ArticleRevisionModal
          article={revisionModalArticle}
          currentRole={currentRole}
          currentUser={currentUser}
          onClose={() => { setIsRevisionModalOpen(false); setRevisionModalArticle(null); }}
          onRollbackSuccess={handleRollbackSuccess}
        />
      )}

      {/* Live Blog Micro-Updates Desk Modal (Task 23 Subtopic B) */}
      {isLiveUpdatesModalOpen && liveUpdatesModalArticle && (
        <LiveUpdatesModal
          article={liveUpdatesModalArticle}
          currentRole={currentRole}
          onClose={() => {
            setIsLiveUpdatesModalOpen(false);
            setLiveUpdatesModalArticle(null);
          }}
          onUpdatesChanged={(newUpdates) => {
            setArticles(prev => prev.map(a => a.id === liveUpdatesModalArticle.id ? { ...a, live_updates: newUpdates } : a));
          }}
        />
      )}

      {/* Manual 1-by-1 Article Audio Generator Modal (Task 44.6 Subtopic C) */}
      {isAudioModalOpen && audioModalArticle && (
        <div
          className="admin-modal-overlay"
          style={{ zIndex: 10020 }}
          onClick={() => { setIsAudioModalOpen(false); setAudioModalArticle(null); }}
        >
          <div
            className="admin-modal-dialog"
            style={{ maxWidth: '680px', width: '95%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.65rem' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: '800', color: '#0E2A47', textTransform: 'uppercase' }}>
                  Sequential Audio Generator
                </div>
                <h3 style={{ margin: '0.15rem 0 0 0', fontSize: '1rem', fontWeight: '900', color: 'var(--text-main)', overflowWrap: 'anywhere' }}>
                  {audioModalArticle.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => { setIsAudioModalOpen(false); setAudioModalArticle(null); }}
                aria-label="Close audio generator modal"
                style={{
                  minWidth: '36px',
                  minHeight: '36px',
                  background: 'none',
                  border: '1px solid var(--border-light)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  color: 'var(--text-subtle)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <X size={18} />
              </button>
            </div>

            <ArticleAudioGeneratorPanel
              article={audioModalArticle}
              compact
              onAudioGenerated={(res) => {
                if (onShowToast && res?.success) {
                  onShowToast(`HI & EN WebM audio generated & cached in D1 shards for "${audioModalArticle.title}".`);
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Admin Masthead Header */}
      <div className="workspace-header" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ minWidth: 0, flex: '1 1 280px' }}>
            <h2 className="workspace-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: 'clamp(1.2rem, 4.5vw, 1.75rem)', margin: 0 }}>
              <Settings color="var(--accent-blue)" /> Newsroom Admin Control Desk
            </h2>
            <p style={{ color: 'var(--text-subtle)', fontSize: '0.875rem', marginTop: '0.25rem', lineHeight: '1.4' }}>
              Complete Admin authority to approve, edit, show, hide, or delete live news & external feeds.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => { setEditingArticle(null); setIsEditModalOpen(true); }}
              className="btn btn-primary"
              style={{ padding: '0.55rem 1rem', fontSize: '0.85rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Plus size={16} /> Create Custom Story
            </button>
            <div style={{ background: '#ECFDF5', color: 'var(--accent-emerald)', padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-emerald)', display: 'inline-block' }} />
              Admin Authority Active
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Header (<= 768px Only - Single Touch-Scrollable Row & Quick Dropdown) */}
      <div className="admin-mobile-nav show-on-mobile">
        {/* 1. Quick Dropdown Desk Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
            Select Desk:
          </span>
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
            className="admin-mobile-desk-select"
            aria-label="Select Newsroom Admin Desk"
          >
            <optgroup label="Editorial & Content">
              <option value="curation">Live News Control ({articles.length})</option>
              <option value="media">Media Library</option>
              <option value="poll">Daily Reader Poll</option>
              <option value="categories">Categories ({categories.length})</option>
              <option value="analytics">Analytics & Traffic</option>
            </optgroup>
            <optgroup label="Design & Brand Identity">
              <option value="typography">Typography & Fonts</option>
              <option value="theme">Color Harmonies & Themes</option>
              <option value="social">Social Channels Links</option>
            </optgroup>
            <optgroup label="Operations & Monetization">
              <option value="ads">Ad Slot Placements</option>
              <option value="storage">Storage & Cache</option>
              <option value="grievance">Statutory Grievances (IT Rules)</option>
              {(currentRole === 'admin' || currentRole === 'developer') && (
                <option value="tips">Confidential Tips (Admin Only)</option>
              )}
              <option value="users">Team & Permissions {staffCount > 0 ? `(${staffCount})` : ''}</option>
              {currentRole === 'developer' && (
                <option value="developer">Developer Rescue & Diagnostics</option>
              )}
            </optgroup>
          </select>
        </div>

        {/* 2. Touch-Scrollable Horizontal Pill Bar */}
        <div className="admin-mobile-pill-wrapper">
          <div className="admin-mobile-pill-bar">
            {ADMIN_DESKS.map(desk => {
              const Icon = desk.icon;
              const isActive = activeTab === desk.id;
              return (
                <button
                  key={desk.id}
                  onClick={() => setActiveTab(desk.id)}
                  className={`admin-mobile-pill-btn ${isActive ? 'active' : ''}`}
                  type="button"
                >
                  <Icon size={14} />
                  <span>{desk.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="workspace-grid">
        {/* Desktop Sidebar Nav (> 768px Only) */}
        <div className="workspace-sidebar hide-on-mobile" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-subtle)', marginBottom: '0.5rem', paddingLeft: '0.5rem' }}>
              Editorial & Content
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <button
                onClick={() => setActiveTab('curation')}
                className={`sidebar-nav-link ${activeTab === 'curation' ? 'active' : ''}`}
                style={{ width: '100%' }}
              >
                <Newspaper size={16} /> Live News Control ({articles.length})
              </button>
              <button
                onClick={() => setActiveTab('media')}
                className={`sidebar-nav-link ${activeTab === 'media' ? 'active' : ''}`}
                style={{ width: '100%' }}
              >
                <ImageIcon size={16} /> Media Library
              </button>
              <button
                onClick={() => setActiveTab('poll')}
                className={`sidebar-nav-link ${activeTab === 'poll' ? 'active' : ''}`}
                style={{ width: '100%' }}
              >
                <BarChart3 size={16} /> Daily Reader Poll
              </button>
              <button
                onClick={() => setActiveTab('categories')}
                className={`sidebar-nav-link ${activeTab === 'categories' ? 'active' : ''}`}
                style={{ width: '100%' }}
              >
                <FolderTree size={16} /> Categories ({categories.length})
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`sidebar-nav-link ${activeTab === 'analytics' ? 'active' : ''}`}
                style={{ width: '100%' }}
              >
                <BarChart2 size={16} /> Analytics & Traffic
              </button>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-subtle)', marginBottom: '0.5rem', paddingLeft: '0.5rem' }}>
              Design & Brand Identity
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <button
                onClick={() => setActiveTab('typography')}
                className={`sidebar-nav-link ${activeTab === 'typography' ? 'active' : ''}`}
                style={{ width: '100%' }}
              >
                <Type size={16} /> Typography & Fonts
              </button>
              <button
                onClick={() => setActiveTab('theme')}
                className={`sidebar-nav-link ${activeTab === 'theme' ? 'active' : ''}`}
                style={{ width: '100%' }}
              >
                <Palette size={16} /> Color Harmonies & Themes
              </button>
              <button
                onClick={() => setActiveTab('social')}
                className={`sidebar-nav-link ${activeTab === 'social' ? 'active' : ''}`}
                style={{ width: '100%' }}
              >
                <Share2 size={16} /> Social Channels Links
              </button>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-subtle)', marginBottom: '0.5rem', paddingLeft: '0.5rem' }}>
              Operations & Monetization
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <button
                onClick={() => setActiveTab('ads')}
                className={`sidebar-nav-link ${activeTab === 'ads' ? 'active' : ''}`}
                style={{ width: '100%' }}
              >
                <DollarSign size={16} /> Ad Slot Placements
              </button>
              <button
                onClick={() => setActiveTab('storage')}
                className={`sidebar-nav-link ${activeTab === 'storage' ? 'active' : ''}`}
                style={{ width: '100%' }}
              >
                <HardDrive size={16} /> Storage & Cache
              </button>
              <button
                onClick={() => setActiveTab('grievance')}
                className={`sidebar-nav-link ${activeTab === 'grievance' ? 'active' : ''}`}
                style={{ width: '100%' }}
              >
                <Scale size={16} /> Statutory Grievances
              </button>
              {(currentRole === 'admin' || currentRole === 'developer') && (
                <button
                  onClick={() => setActiveTab('tips')}
                  className={`sidebar-nav-link ${activeTab === 'tips' ? 'active' : ''}`}
                  style={{ width: '100%' }}
                >
                  <EyeOff size={16} /> Confidential Tips (Admin Only)
                </button>
              )}
              <button
                onClick={() => setActiveTab('users')}
                className={`sidebar-nav-link ${activeTab === 'users' ? 'active' : ''}`}
                style={{ width: '100%' }}
              >
                <Users size={16} /> Team & Permissions {staffCount > 0 ? `(${staffCount})` : ''}
              </button>
              {currentRole === 'developer' && (
                <button
                  onClick={() => setActiveTab('developer')}
                  className={`sidebar-nav-link ${activeTab === 'developer' ? 'active' : ''}`}
                  style={{ width: '100%' }}
                >
                  <Terminal size={16} /> Developer Rescue Desk
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="workspace-main" style={{ minWidth: 0 }}>
          {/* NEWS CONTROL & CURATION DESK */}
          {activeTab === 'curation' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {feedbackMsg && (
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-emerald)', padding: '0.65rem 1rem', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle2 size={16} /> {feedbackMsg}
                </div>
              )}

              {/* Filter & Toolbar Header */}
              <div className="admin-curation-toolbar">
                <div className="admin-filter-group">
                  <button
                    onClick={() => setFilterStatus('all')}
                    className={`btn ${filterStatus === 'all' ? 'btn-primary' : 'btn-outline'}`}
                  >
                    All Stories ({articles.length})
                  </button>
                  <button
                    onClick={() => setFilterStatus('published')}
                    className={`btn ${filterStatus === 'published' ? 'btn-primary' : 'btn-outline'}`}
                  >
                    Live on Site ({articles.filter(a => a.status === 'published').length})
                  </button>
                  <button
                    onClick={() => setFilterStatus('scheduled')}
                    className={`btn ${filterStatus === 'scheduled' ? 'btn-primary' : 'btn-outline'}`}
                    style={{
                      background: filterStatus === 'scheduled' ? '#1D4ED8' : undefined,
                      borderColor: filterStatus === 'scheduled' ? '#1D4ED8' : undefined,
                      color: filterStatus === 'scheduled' ? '#FFFFFF' : undefined
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Clock size={13} /> Scheduled ({articles.filter(a => a.status === 'scheduled').length})
                    </span>
                  </button>
                  <button
                    onClick={() => setFilterStatus('live_blog')}
                    className={`btn ${filterStatus === 'live_blog' ? 'btn-primary' : 'btn-outline'}`}
                    style={{
                      background: filterStatus === 'live_blog' ? '#DC2626' : undefined,
                      borderColor: filterStatus === 'live_blog' ? '#DC2626' : undefined,
                      color: filterStatus === 'live_blog' ? '#FFFFFF' : undefined
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Radio size={13} /> Live Blogs ({articles.filter(a => a.format === 'live').length})
                    </span>
                  </button>
                  <button
                    onClick={() => setFilterStatus('hidden')}
                    className={`btn ${filterStatus === 'hidden' ? 'btn-primary' : 'btn-outline'}`}
                  >
                    Hidden / Drafts ({articles.filter(a => a.status !== 'published' && a.status !== 'scheduled').length})
                  </button>
                  <button
                    onClick={() => {
                      setFilterStatus('live_feed');
                      if (liveFeedItems.length === 0) {
                        fetchLiveNewsStream(wireStreamKey);
                      }
                    }}
                    className={`btn ${filterStatus === 'live_feed' ? 'btn-primary' : 'btn-outline'}`}
                    style={{ background: filterStatus === 'live_feed' ? 'var(--accent-indigo)' : undefined, color: filterStatus === 'live_feed' ? '#fff' : undefined }}
                  >
                    Incoming RSS Wire ({liveFeedItems.length})
                  </button>
                </div>

                <div className="admin-curation-search">
                  <Search size={15} color="var(--text-subtle)" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter by headline..."
                    style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', fontSize: '0.825rem', background: 'var(--bg-main)', color: 'var(--text-main)', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* INCOMING LIVE RSS FEED SECTION */}
              {filterStatus === 'live_feed' ? (
                <div style={{ background: 'var(--bg-surface)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                  {/* Wire Section Header */}
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.35rem' }}>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, color: 'var(--text-main)' }}>
                        <Radio color="var(--accent-indigo)" size={20} /> Live Incoming External RSS Wire
                      </h3>
                      <span style={{ fontSize: '0.8rem', background: 'rgba(99, 102, 241, 0.12)', color: 'var(--accent-indigo)', padding: '0.2rem 0.65rem', borderRadius: '20px', fontWeight: '700' }}>
                        {liveFeedItems.length} Stories Loaded
                      </span>
                    </div>
                    <p style={{ fontSize: '0.825rem', color: 'var(--text-subtle)', margin: 0 }}>
                      Real-time breaking news items fetched directly from news wires. Admin must approve or edit before they appear live!
                    </p>
                  </div>

                  {/* Wire Controls Toolbar (Always visible, responsive, prominent Refresh button) */}
                  <div className="admin-wire-toolbar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 200px', maxWidth: '300px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-subtle)', whiteSpace: 'nowrap' }}>Channel:</span>
                      <select 
                        value={wireStreamKey}
                        onChange={(e) => { setWireStreamKey(e.target.value); fetchLiveNewsStream(e.target.value); }}
                        style={{ width: '100%', padding: '0.45rem 0.7rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', fontSize: '0.825rem', fontWeight: '700', background: 'var(--bg-surface)', color: 'var(--text-main)' }}
                      >
                        <option value="google_hi">India Headlines (Hindi)</option>
                        <option value="google_en">India Headlines (English)</option>
                        <option value="google_topic_entertainment">Entertainment & Cinema</option>
                        <option value="google_topic_technology">Technology & AI</option>
                        <option value="google_topic_business">Business & Economy</option>
                        <option value="google_topic_sports">Sports</option>
                        <option value="google_topic_science">Science & Climate</option>
                        <option value="google_topic_world">World News</option>
                      </select>
                    </div>

                    <button
                      onClick={() => fetchLiveNewsStream(wireStreamKey)}
                      disabled={isLoadingLiveFeed}
                      className="btn btn-primary"
                      style={{ padding: '0.45rem 1.15rem', fontSize: '0.825rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap', fontWeight: '800' }}
                    >
                      <RefreshCw size={15} className={isLoadingLiveFeed ? 'spin' : ''} />
                      {isLoadingLiveFeed ? 'Fetching Wire...' : 'Refresh Wire'}
                    </button>
                  </div>

                  {liveFeedItems.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {liveFeedItems.map((item) => (
                        <div 
                          key={item.id} 
                          onClick={() => { setEditingArticle({ ...item, status: 'published' }); setIsEditModalOpen(true); }}
                          style={{ 
                            background: 'var(--bg-secondary)', 
                            padding: '1.15rem', 
                            borderRadius: 'var(--radius-md)', 
                            border: '1px solid var(--border-light)', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '0.75rem',
                            cursor: 'pointer',
                            boxShadow: 'var(--shadow-sm)'
                          }}
                        >
                          {/* Top Badges Row */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                              <span style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent-indigo)', fontSize: '0.725rem', fontWeight: '800', padding: '0.2rem 0.55rem', borderRadius: '12px' }}>
                                PENDING APPROVAL
                              </span>
                              <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-subtle)' }}>
                                Source: {item.source} • {item.published_at}
                              </span>
                            </div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--accent-indigo)', fontWeight: '600' }}>
                              Click card to Edit & Customize
                            </span>
                          </div>

                          {/* Middle: Headline & Summary */}
                          <div>
                            <h4 style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-main)', lineHeight: '1.4', margin: '0 0 0.35rem 0' }}>
                              {item.title}
                            </h4>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-subtle)', lineHeight: '1.5', margin: 0 }}>
                              {cleanRssText(item.summary).slice(0, 220) || item.title}
                            </p>
                          </div>

                          {/* Bottom Action Buttons (Always clearly visible in every card) */}
                          <div 
                            className="admin-wire-actions"
                            style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem', marginTop: '0.25rem' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => handleApproveLiveFeedItem(item)}
                              className="btn btn-primary"
                              style={{ padding: '0.45rem 0.95rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'var(--accent-emerald)', borderColor: 'var(--accent-emerald)', fontWeight: '800' }}
                            >
                              <Check size={15} /> Approve & Publish Live
                            </button>
                            <button
                              onClick={() => { setEditingArticle({ ...item, status: 'published' }); setIsEditModalOpen(true); }}
                              className="btn btn-outline"
                              style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: '700' }}
                            >
                              <Edit3 size={14} /> Edit Story
                            </button>
                            {item.url && item.url !== '#' && (
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-outline"
                                style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }}
                              >
                                <ExternalLink size={14} /> Open Source
                              </a>
                            )}
                            <button
                              onClick={() => setLiveFeedItems(liveFeedItems.filter(i => i.id !== item.id))}
                              className="btn btn-outline"
                              title="Discard"
                              style={{ padding: '0.45rem 0.65rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: 'var(--accent-rose)' }}
                            >
                              <X size={14} /> Discard
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-subtle)', background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-medium)' }}>
                      <p style={{ margin: 0, fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-main)' }}>No pending live RSS wire items.</p>
                      <p style={{ margin: '0.4rem 0 1rem', fontSize: '0.8rem' }}>Click below to pull the latest breaking news stories from Google News Wire.</p>
                      <button
                        onClick={() => fetchLiveNewsStream(wireStreamKey)}
                        disabled={isLoadingLiveFeed}
                        className="btn btn-primary"
                        style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                      >
                        <RefreshCw size={15} className={isLoadingLiveFeed ? 'spin' : ''} />
                        {isLoadingLiveFeed ? 'Fetching Live Wire...' : 'Fetch Live News Wire Now'}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* MAIN STORED ARTICLES TABLE / CARDS */
                <div className="admin-articles-card">
                  <div className="admin-articles-header">
                    <span>All Newsroom Articles ({filteredArticles.length})</span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', fontWeight: '600' }}>
                      Click "Show / Hide" to control live site availability instantly.
                    </span>
                  </div>

                  {filteredArticles.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {filteredArticles.map((art) => {
                        const isLive = art.status === 'published';
                        return (
                          <div
                            key={art.id}
                            className="admin-article-item"
                            style={{
                              background: isLive ? 'transparent' : 'rgba(239, 68, 68, 0.03)'
                            }}
                          >
                            {/* Thumbnail & Title Details (Clickable) */}
                            <div 
                              className="admin-article-info"
                              onClick={() => { setEditingArticle(art); setIsEditModalOpen(true); }}
                              title="Click to Edit Story Details"
                            >
                              <div style={{ width: '80px', height: '60px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', flexShrink: 0, background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {art.featured_image ? (
                                  <img 
                                    src={art.featured_image} 
                                    alt={art.title} 
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                  />
                                ) : (
                                  <Newspaper size={18} color="var(--text-subtle)" />
                                )}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                                  <span style={{
                                    fontSize: '0.68rem',
                                    fontWeight: '800',
                                    padding: '0.12rem 0.45rem',
                                    borderRadius: '4px',
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-medium)',
                                    fontFamily: 'var(--font-mono)',
                                    color: 'var(--text-subtle)'
                                  }}>
                                    ID: {art.id}
                                  </span>

                                  {art.status === 'scheduled' ? (
                                    <span style={{
                                      fontSize: '0.7rem',
                                      fontWeight: '800',
                                      padding: '0.15rem 0.5rem',
                                      borderRadius: '10px',
                                      background: '#EFF6FF',
                                      color: '#1D4ED8',
                                      border: '1px solid #93C5FD',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.3rem'
                                    }}>
                                      <Clock size={11} /> SCHEDULED: {formatDisplayDateTime(art.scheduledPublishTime)}
                                    </span>
                                  ) : (
                                    <span style={{
                                      fontSize: '0.7rem',
                                      fontWeight: '800',
                                      padding: '0.15rem 0.5rem',
                                      borderRadius: '10px',
                                      background: isLive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                      color: isLive ? 'var(--accent-emerald)' : 'var(--accent-crimson)'
                                    }}>
                                      {isLive ? 'LIVE ON SITE' : 'HIDDEN (DRAFT)'}
                                    </span>
                                  )}

                                  {art.is_breaking && (
                                    <span style={{ fontSize: '0.7rem', fontWeight: '800', padding: '0.15rem 0.4rem', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.2)', color: 'var(--accent-crimson)' }}>
                                      BREAKING
                                    </span>
                                  )}

                                  {art.format === 'live' && (
                                    <span style={{
                                      fontSize: '0.7rem',
                                      fontWeight: '800',
                                      padding: '0.15rem 0.5rem',
                                      borderRadius: '10px',
                                      background: (art.live_status || 'active') === 'active' ? '#FEF2F2' : '#F3F4F6',
                                      color: (art.live_status || 'active') === 'active' ? '#DC2626' : '#4B5563',
                                      border: (art.live_status || 'active') === 'active' ? '1px solid #FCA5A5' : '1px solid #D1D5DB',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.25rem'
                                    }}>
                                      <Radio size={11} /> {(art.live_status || 'active') === 'active' ? 'LIVE BLOG (ACTIVE)' : 'LIVE BLOG (CONCLUDED)'}
                                    </span>
                                  )}

                                  <span style={{ fontSize: '0.75rem', color: 'var(--accent-blue)', fontWeight: '700' }}>
                                    {art.category}
                                  </span>
                                </div>

                                <div 
                                  style={{ 
                                    fontSize: '0.95rem', 
                                    fontWeight: '800', 
                                    color: 'var(--text-main)', 
                                    lineHeight: '1.35',
                                    transition: 'color 0.2s ease',
                                    wordBreak: 'break-word',
                                    overflowWrap: 'break-word'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-indigo)'}
                                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-main)'}
                                >
                                  {art.title} <span style={{ fontSize: '0.75rem', color: 'var(--accent-indigo)', opacity: 0.8 }}>(Click to Edit)</span>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: '0.2rem', wordBreak: 'break-word' }}>
                                  By {art.author?.name || 'Admin'} {art.author?.email ? `(${art.author.email})` : ''} • Published {art.published_at} • {art.views_count ? art.views_count.toLocaleString() : '120'} views
                                </div>
                              </div>
                            </div>

                            {/* Action Controls (Responsive Grid on Mobile) */}
                            <div className="admin-article-actions">
                              {/* Read Story Preview Button */}
                              {onSelectArticle && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); onSelectArticle(art); }}
                                  className="btn btn-outline"
                                  style={{
                                    padding: '0.4rem 0.75rem',
                                    fontSize: '0.78rem',
                                    fontWeight: '700',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.3rem'
                                  }}
                                  title="Read Story Preview"
                                >
                                  <Eye size={14} color="var(--accent-indigo)" /> Read Story
                                </button>
                              )}

                              {/* 1-Click Live Blog Status Toggle (Active vs Concluded) */}
                              {art.format === 'live' && !isReporter && (
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    const nextStatus = (art.live_status || 'active') === 'active' ? 'concluded' : 'active';
                                    try {
                                      const res = await fetch(`/api/articles/${encodeURIComponent(art.id)}/live-status`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ live_status: nextStatus, userRole: currentRole })
                                      });
                                      const data = await res.json();
                                      if (data.success) {
                                        setArticles(prev => prev.map(a => a.id === art.id ? { ...a, live_status: nextStatus } : a));
                                      }
                                    } catch (err) {
                                      console.error('Failed to toggle live status:', err);
                                    }
                                  }}
                                  className="btn btn-outline"
                                  style={{
                                    padding: '0.4rem 0.75rem',
                                    fontSize: '0.78rem',
                                    fontWeight: '800',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    borderColor: (art.live_status || 'active') === 'active' ? '#DC2626' : '#6B7280',
                                    color: (art.live_status || 'active') === 'active' ? '#DC2626' : '#4B5563',
                                    background: (art.live_status || 'active') === 'active' ? '#FEF2F2' : '#F3F4F6'
                                  }}
                                  title={(art.live_status || 'active') === 'active' ? 'Conclude live coverage' : 'Reactivate live coverage'}
                                >
                                  <Radio size={13} /> {(art.live_status || 'active') === 'active' ? 'Conclude Live' : 'Reactivate Live'}
                                </button>
                              )}

                              {art.format === 'live' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLiveUpdatesModalArticle(art);
                                    setIsLiveUpdatesModalOpen(true);
                                  }}
                                  className="btn btn-outline"
                                  style={{
                                    padding: '0.4rem 0.75rem',
                                    fontSize: '0.78rem',
                                    fontWeight: '800',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    borderColor: '#0E2A47',
                                    color: '#0E2A47',
                                    background: '#F0F4F8'
                                  }}
                                  title="Open Live Updates Timeline Desk"
                                >
                                  <Clock size={13} /> Live Updates ({art.live_updates?.length || 0})
                                </button>
                              )}

                              {/* Toggle Show/Hide or Publish Now Button */}
                              {art.status === 'scheduled' ? (
                                !isReporter && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleToggleVisibility(art.id); }}
                                    className="btn btn-primary"
                                    style={{
                                      padding: '0.4rem 0.8rem',
                                      fontSize: '0.78rem',
                                      fontWeight: '800',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.35rem',
                                      borderColor: 'var(--accent-emerald)',
                                      background: 'var(--accent-emerald)',
                                      color: '#fff'
                                    }}
                                    title="Publish this scheduled story live immediately"
                                  >
                                    <Check size={14} /> Publish Now
                                  </button>
                                )
                              ) : (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleToggleVisibility(art.id); }}
                                  disabled={isReporter}
                                  className={`btn ${isLive ? 'btn-outline' : 'btn-primary'}`}
                                  style={{
                                    padding: '0.4rem 0.8rem',
                                    fontSize: '0.78rem',
                                    fontWeight: '800',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    borderColor: isLive ? 'var(--accent-crimson)' : 'var(--accent-emerald)',
                                    color: isLive ? 'var(--accent-crimson)' : '#fff',
                                    background: isLive ? 'transparent' : 'var(--accent-emerald)',
                                    opacity: isReporter ? 0.6 : 1,
                                    cursor: isReporter ? 'not-allowed' : 'pointer'
                                  }}
                                  title={isReporter ? 'Editorial Gate: Reporters cannot toggle live status' : (isLive ? 'Hide from Site' : 'Show on Site')}
                                >
                                  {isLive ? <EyeOff size={14} /> : <Eye size={14} />}
                                  {isLive ? 'Hide from Site' : 'Show on Site'}
                                </button>
                              )}

                              {/* Edit Button */}
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingArticle(art); setIsEditModalOpen(true); }}
                                className="btn btn-outline"
                                style={{ padding: '0.4rem 0.75rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                              >
                                <Edit3 size={14} /> Edit Story
                              </button>

                              {/* Manual Generate Audio (HI + EN) Button (Task 44.6 Subtopic C) */}
                              {!isReporter && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAudioModalArticle(art);
                                    setIsAudioModalOpen(true);
                                  }}
                                  className="btn btn-outline"
                                  style={{
                                    minHeight: '36px',
                                    padding: '0.4rem 0.75rem',
                                    fontSize: '0.78rem',
                                    fontWeight: '800',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    borderColor: '#0E2A47',
                                    color: '#0E2A47',
                                    background: '#F8FAFC'
                                  }}
                                  title="Generate Hindi & English WebM Audio (1-by-1)"
                                >
                                  <Volume2 size={14} /> Audio (HI+EN)
                                </button>
                              )}

                              {/* Revisions & Rollback Button (Task 21) */}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleOpenRevisionHistory(art); }}
                                className="btn btn-outline"
                                style={{ padding: '0.4rem 0.75rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                                title="View version snapshots and 1-click rollback"
                              >
                                <History size={14} /> Revisions
                              </button>

                              {/* Delete Button */}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteArticle(art.id, art.title); }}
                                title="Delete Story"
                                style={{
                                  background: 'rgba(239, 68, 68, 0.08)',
                                  border: '1px solid rgba(239, 68, 68, 0.2)',
                                  color: 'var(--accent-crimson)',
                                  cursor: 'pointer',
                                  padding: '0.4rem 0.6rem',
                                  borderRadius: 'var(--radius-sm)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                              >
                                <Trash2 size={16} /> Delete
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-subtle)' }}>
                      No articles match your search/filter criteria.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'media' && (
            <MediaLibraryDesk
              currentRole={currentRole}
            />
          )}

          {activeTab === 'analytics' && <AnalyticsDashboard articles={articles} />}
          {activeTab === 'poll' && <PollManager />}
          {activeTab === 'storage' && <StorageSettings />}
          {activeTab === 'grievance' && <GrievanceDesk onShowToast={onShowToast} />}
          {activeTab === 'tips' && (currentRole === 'admin' || currentRole === 'developer') && (
            <ConfidentialTipsDesk
              onShowToast={onShowToast}
              onConvertTipToDraft={(tip) => {
                const draftContent = [
                  tip.location ? `**स्थान:** ${tip.location}` : '',
                  tip.incidentDate ? `**घटना की तारीख:** ${tip.incidentDate}` : '',
                  tip.involvedEntities ? `**शामिल विभाग/संस्था:** ${tip.involvedEntities}` : '',
                  tip.evidenceUrl ? `**सबूत लिंक:** ${tip.evidenceUrl}` : '',
                  '',
                  tip.details || ''
                ].filter(Boolean).join('\n');
                setEditingArticle({
                  title: tip.title || '',
                  summary: (tip.details || '').slice(0, 180),
                  category: categories[0]?.name || 'General',
                  status: 'draft',
                  content: draftContent,
                  originalLanguage: 'hi'
                });
                setIsEditModalOpen(true);
              }}
            />
          )}

          {activeTab === 'users' && <StaffPermissionsDesk onShowToast={onShowToast} />}

          {activeTab === 'developer' && <DeveloperRescueDesk onShowToast={onShowToast} />}

          {activeTab === 'categories' && (
            <div style={{ background: 'var(--bg-surface)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '1rem' }}>Manage News Taxonomy Categories</h3>

              {feedbackMsg && (
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-emerald)', padding: '0.65rem 1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.875rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle2 size={16} /> {feedbackMsg}
                </div>
              )}

              <form onSubmit={handleAddCategory} className="admin-cat-form" style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="New Category Name (e.g. Economy, Climate)"
                  style={{ flex: 1, padding: '0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)' }}
                />
                <button type="submit" className="btn btn-primary" style={{ padding: '0.65rem 1.2rem', cursor: 'pointer' }}>
                  <Plus size={16} /> Add Category
                </button>
              </form>

              <div className="admin-cat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.85rem' }}>
                {categories.map((cat) => {
                  const publishedCount = articles.filter(a => 
                    (a.category_slug === cat.slug || a.category?.toLowerCase() === cat.name?.toLowerCase()) && 
                    a.status === 'published'
                  ).length;

                  return (
                    <div
                      key={cat.id}
                      style={{
                        background: 'var(--bg-secondary)',
                        padding: '0.9rem 1rem',
                        borderRadius: 'var(--radius-sm)',
                        border: editingCatId === cat.id ? '1px solid var(--accent-blue)' : '1px solid var(--border-light)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '0.75rem',
                        minWidth: 0,
                        overflow: 'hidden'
                      }}
                    >
                      {editingCatId === cat.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                          <input
                            type="text"
                            value={editingCatName}
                            onChange={(e) => setEditingCatName(e.target.value)}
                            autoFocus
                            placeholder="Category Name"
                            style={{
                              padding: '0.45rem 0.65rem',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--accent-blue)',
                              fontSize: '0.9rem',
                              fontWeight: '700',
                              width: '100%',
                              background: 'var(--bg-surface)',
                              color: 'var(--text-main)'
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEditCategory(cat.id);
                              if (e.key === 'Escape') handleCancelEditCategory();
                            }}
                          />
                          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={() => handleSaveEditCategory(cat.id)}
                              className="btn btn-primary"
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                            >
                              <Check size={14} /> Save
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEditCategory}
                              className="btn"
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', border: '1px solid var(--border-medium)', background: 'transparent', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                            >
                              <X size={14} /> Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={{ minWidth: 0, flex: 1, wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                            <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-main)', lineHeight: '1.3' }}>
                              {cat.name}
                            </div>
                            {publishedCount > 0 ? (
                              <div style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', marginTop: '0.25rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <CheckCircle2 size={12} /> {publishedCount} {publishedCount === 1 ? 'Story' : 'Stories'} • Live on Website
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.75rem', color: '#d97706', marginTop: '0.25rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <ShieldAlert size={12} /> 0 Stories • Hidden from public until published
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={() => handleStartEditCategory(cat)}
                              title="Edit category name"
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-subtle)',
                                cursor: 'pointer',
                                padding: '0.35rem',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'var(--transition-fast)'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-blue)'}
                              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-subtle)'}
                            >
                              <Edit3 size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCategory(cat.id)}
                              title="Remove category"
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-subtle)',
                                cursor: 'pointer',
                                padding: '0.35rem',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'var(--transition-fast)'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-crimson)'}
                              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-subtle)'}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'ads' && (
            <MonetizationDesk onShowToast={onShowToast} articles={articles} categories={categories} />
          )}

          {activeTab === 'social' && (
            <div style={{ background: 'var(--bg-surface)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                    <Share2 color="var(--accent-crimson)" size={20} /> Social Channels Links Settings
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-subtle)', marginTop: '0.25rem' }}>
                    Configure WhatsApp, Instagram, Facebook, and X (Twitter) URLs displayed in the website footer.
                  </p>
                </div>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); if (onUpdateSocialLinks) onUpdateSocialLinks(localSocialLinks); setFeedbackMsg('Social channel links updated successfully!'); setTimeout(() => setFeedbackMsg(''), 3000); }} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {feedbackMsg && (
                  <div style={{ padding: '0.65rem 1rem', background: '#ECFDF5', color: 'var(--accent-emerald)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CheckCircle2 size={16} /> {feedbackMsg}
                  </div>
                )}

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.4rem', color: '#25D366' }}>
                    <WhatsAppIcon size={16} /> WhatsApp Channel URL or Mobile Number
                  </label>
                  <input
                    type="text"
                    value={localSocialLinks.whatsapp}
                    onChange={(e) => setLocalSocialLinks({ ...localSocialLinks, whatsapp: e.target.value })}
                    placeholder="Enter Phone Number (e.g. +919876543210) or Group/Channel URL"
                    style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.875rem' }}
                  />
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: '0.25rem' }}>
                    Supports full URLs (e.g. https://whatsapp.com/channel/...) or direct phone numbers (e.g. +919876543210 / 9876543210).
                  </div>
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.4rem', color: '#dc2743' }}>
                    <InstagramIcon size={16} /> Instagram Page URL or Username
                  </label>
                  <input
                    type="text"
                    value={localSocialLinks.instagram}
                    onChange={(e) => setLocalSocialLinks({ ...localSocialLinks, instagram: e.target.value })}
                    placeholder="Enter Username (e.g. @publicspark) or full Profile URL"
                    style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.875rem' }}
                  />
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: '0.25rem' }}>
                    Supports handle/username (e.g. @publicspark / publicspark) or full URL.
                  </div>
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.4rem', color: '#1877F2' }}>
                    <FacebookIcon size={16} /> Facebook Page URL, Phone Number or Handle
                  </label>
                  <input
                    type="text"
                    value={localSocialLinks.facebook}
                    onChange={(e) => setLocalSocialLinks({ ...localSocialLinks, facebook: e.target.value })}
                    placeholder="Enter Phone Number (e.g. +919876543210), Handle (e.g. @publicspark) or full Page URL"
                    style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.875rem' }}
                  />
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: '0.25rem' }}>
                    Supports mobile numbers (e.g. +919876543210), page/profile handles (e.g. @publicspark), or full URLs.
                  </div>
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                    <XTwitterIcon size={16} /> X (Twitter) Handle or Page URL
                  </label>
                  <input
                    type="text"
                    value={localSocialLinks.twitter}
                    onChange={(e) => setLocalSocialLinks({ ...localSocialLinks, twitter: e.target.value })}
                    placeholder="Enter Handle (e.g. @publicspark) or full URL"
                    style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.875rem' }}
                  />
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: '0.25rem' }}>
                    Supports handle/username (e.g. @publicspark / publicspark) or full URL.
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '0.65rem 1.25rem', fontSize: '0.875rem', fontWeight: '700', alignSelf: 'flex-start', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <CheckCircle2 size={16} /> Save Social Channel URLs
                </button>
              </form>
            </div>
          )}

          {/* TYPOGRAPHY & MULTI-LANGUAGE FONTS CUSTOMIZER DESK */}
          {activeTab === 'typography' && (() => {
            const activeRegional = localTypography.regionalFonts || DEFAULT_REGIONAL_FONTS;
            const activeLangFonts = activeRegional[selectedRegionalLang] || {
              headingFont: localTypography.headingFont || 'Playfair Display',
              bodyFont: localTypography.bodyFont || 'Plus Jakarta Sans'
            };

            const currentDisplayHeadFont = scopeMode === 'regional'
              ? (activeLangFonts.headingFont || localTypography.headingFont || 'Playfair Display')
              : (localTypography.headingFont || 'Playfair Display');

            const currentDisplayBodyFont = scopeMode === 'regional'
              ? (activeLangFonts.bodyFont || localTypography.bodyFont || 'Plus Jakarta Sans')
              : (localTypography.bodyFont || 'Plus Jakarta Sans');

            const selectedLangData = LANGUAGE_PREVIEW_DATA[selectedRegionalLang] || LANGUAGE_PREVIEW_DATA.hi;
            const allLanguagesList = Object.values(LANGUAGE_PREVIEW_DATA);

            const filteredLangs = allLanguagesList.filter(l => {
              if (!langSearchQuery) return true;
              const q = langSearchQuery.toLowerCase();
              return l.name.toLowerCase().includes(q) || l.native.toLowerCase().includes(q) || l.code.toLowerCase().includes(q);
            });

            const getWeightLabel = (w) => {
              const weightNum = Number(w) || 700;
              if (weightNum <= 400) return 'Regular';
              if (weightNum <= 500) return 'Medium';
              if (weightNum <= 600) return 'Semi-Bold';
              if (weightNum <= 700) return 'Bold';
              if (weightNum <= 800) return 'Extra Bold';
              return 'Ultra Black';
            };

            const handleMakeHeadlineFontGlobal = (targetFont) => {
              const currentReg = localTypography.regionalFonts || DEFAULT_REGIONAL_FONTS;
              const updatedRegional = {};
              Object.keys(DEFAULT_REGIONAL_FONTS).forEach(langKey => {
                updatedRegional[langKey] = {
                  ...(currentReg[langKey] || {}),
                  headingFont: targetFont
                };
              });

              const nextTypography = {
                ...localTypography,
                headingFont: targetFont,
                regionalFonts: updatedRegional
              };

              setLocalTypography(nextTypography);
              setHasUnsavedTypographyChanges(true);
              setFeedbackMsg(`Staged "${targetFont}" for headlines across all 18 languages. Click "Save & Apply Typography" at the top to publish across the site.`);
              setTimeout(() => setFeedbackMsg(''), 4500);
            };

            const handleMakeBodyFontGlobal = (targetFont) => {
              const currentReg = localTypography.regionalFonts || DEFAULT_REGIONAL_FONTS;
              const updatedRegional = {};
              Object.keys(DEFAULT_REGIONAL_FONTS).forEach(langKey => {
                updatedRegional[langKey] = {
                  ...(currentReg[langKey] || {}),
                  bodyFont: targetFont
                };
              });

              const nextTypography = {
                ...localTypography,
                bodyFont: targetFont,
                regionalFonts: updatedRegional
              };

              setLocalTypography(nextTypography);
              setHasUnsavedTypographyChanges(true);
              setFeedbackMsg(`Staged "${targetFont}" for article body copy across all 18 languages. Click "Save & Apply Typography" at the top to publish across the site.`);
              setTimeout(() => setFeedbackMsg(''), 4500);
            };

            const handleMakeBothFontsGlobal = (targetHeadFont, targetBodyFont) => {
              const updatedRegional = {};
              Object.keys(DEFAULT_REGIONAL_FONTS).forEach(langKey => {
                updatedRegional[langKey] = {
                  headingFont: targetHeadFont,
                  bodyFont: targetBodyFont
                };
              });

              const nextTypography = {
                ...localTypography,
                headingFont: targetHeadFont,
                bodyFont: targetBodyFont,
                regionalFonts: updatedRegional
              };

              setLocalTypography(nextTypography);
              setHasUnsavedTypographyChanges(true);
              setFeedbackMsg(`Staged "${targetHeadFont}" & "${targetBodyFont}" globally. Click "Save & Apply Typography" at the top to publish across the site.`);
              setTimeout(() => setFeedbackMsg(''), 4500);
            };

            const handleSaveActiveTypography = () => {
              if (onUpdateTypography) {
                onUpdateTypography(localTypography);
              }
              setHasUnsavedTypographyChanges(false);
              setFeedbackMsg('Typography settings successfully saved and published live across the entire website!');
              setTimeout(() => setFeedbackMsg(''), 4000);
            };

            const handleResetDefaultTypography = (autoSave = false) => {
              const defaults = {
                headingFont: 'Playfair Display',
                bodyFont: 'Plus Jakarta Sans',
                headingScale: 100,
                headingWeight: 800,
                bodySize: 16,
                bodyWeight: 400,
                mobileHeadingScale: 85,
                mobileBodySize: 15,
                regionalFonts: DEFAULT_REGIONAL_FONTS
              };
              setLocalTypography(defaults);
              if (autoSave && onUpdateTypography) {
                onUpdateTypography(defaults);
                setHasUnsavedTypographyChanges(false);
                setFeedbackMsg('Default typography (Playfair Display Extra Bold 800) saved and published live across the entire website!');
              } else {
                setHasUnsavedTypographyChanges(true);
                setFeedbackMsg('Staged default typography (Playfair Display Extra Bold 800). Click "Save & Apply Typography" to publish across the site.');
              }
              setTimeout(() => setFeedbackMsg(''), 4500);
            };

            return (
              <div className="admin-tab-card">
                {/* Top Header Row with Prominent Save & Reset Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, color: 'var(--text-main)' }}>
                      <Type color="var(--accent-indigo)" size={22} /> Typography & Multi-Language Font Suite
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-subtle)', marginTop: '0.35rem' }}>
                      Customize fonts freely. Live preview updates immediately on the right; click <strong>"Save & Apply Typography"</strong> at the top to publish live across the entire website.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {hasUnsavedTypographyChanges && (
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: '800',
                        padding: '0.35rem 0.65rem',
                        borderRadius: '20px',
                        background: 'rgba(245, 158, 11, 0.15)',
                        color: '#d97706',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}>
                        ● Unsaved Changes (Preview Active)
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleSaveActiveTypography}
                      className="btn btn-primary"
                      style={{
                        padding: '0.5rem 1.15rem',
                        fontSize: '0.825rem',
                        fontWeight: '800',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        boxShadow: hasUnsavedTypographyChanges ? '0 2px 12px rgba(99, 102, 241, 0.35)' : 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <Check size={16} /> Save & Apply Typography
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResetDefaultTypography(true)}
                      className="btn btn-outline"
                      style={{ padding: '0.5rem 0.9rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}
                      title="Reset and publish default Playfair Display Extra Bold (800) live across the entire website"
                    >
                      <RotateCcw size={14} /> Set as Default (Playfair Bold)
                    </button>
                  </div>
                </div>

                {feedbackMsg && (
                  <div style={{ padding: '0.75rem 1rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-emerald)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                    <CheckCircle2 size={16} /> {feedbackMsg}
                  </div>
                )}

                {/* DEVICE VIEWPORT MODE SELECTOR: DESKTOP (BADI SCREEN) VS MOBILE (CHHOTI SCREEN) */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--bg-secondary)',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-medium)',
                  marginBottom: '1rem',
                  flexWrap: 'wrap',
                  gap: '0.75rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: '900', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Sliders size={16} color="var(--accent-indigo)" /> Screen Targeting Mode:
                    </span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-subtle)' }}>
                      {deviceMode === 'desktop'
                        ? 'बड़ी स्क्रीन / Desktop View (Laptops & Desktops > 768px)'
                        : 'छोटी स्क्रीन / Mobile Phone View (Handheld Smartphones ≤ 768px)'}
                    </span>
                  </div>

                  {/* Segmented Device Switcher Pills */}
                  <div style={{
                    display: 'inline-flex',
                    background: 'var(--bg-surface)',
                    padding: '3px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-medium)',
                    gap: '3px'
                  }}>
                    <button
                      type="button"
                      onClick={() => setDeviceMode('desktop')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        padding: '0.45rem 1.15rem',
                        borderRadius: '6px',
                        fontSize: '0.82rem',
                        fontWeight: deviceMode === 'desktop' ? '900' : '600',
                        background: deviceMode === 'desktop' ? 'var(--accent-indigo)' : 'transparent',
                        color: deviceMode === 'desktop' ? '#fff' : 'var(--text-muted)',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: deviceMode === 'desktop' ? '0 2px 6px rgba(99, 102, 241, 0.25)' : 'none'
                      }}
                    >
                      <Monitor size={15} /> Desktop / बड़ी स्क्रीन
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeviceMode('mobile')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        padding: '0.45rem 1.15rem',
                        borderRadius: '6px',
                        fontSize: '0.82rem',
                        fontWeight: deviceMode === 'mobile' ? '900' : '600',
                        background: deviceMode === 'mobile' ? 'var(--accent-indigo)' : 'transparent',
                        color: deviceMode === 'mobile' ? '#fff' : 'var(--text-muted)',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: deviceMode === 'mobile' ? '0 2px 6px rgba(99, 102, 241, 0.25)' : 'none'
                      }}
                    >
                      <Smartphone size={15} /> Mobile / छोटी स्क्रीन
                    </button>
                  </div>
                </div>

                {/* PRIMARY ACTIONS: 1-CLICK MAKE GLOBAL VS REGIONAL WISE LIST */}
                <div className="typography-actions-layout">
                  {/* Action 1: Make Current Fonts Global across entire site */}
                  <button
                    type="button"
                    onClick={() => handleMakeBothFontsGlobal(currentDisplayHeadFont, currentDisplayBodyFont)}
                    style={{
                      padding: '0.9rem 1.15rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '2px solid var(--accent-indigo)',
                      background: 'rgba(99, 102, 241, 0.1)',
                      color: 'var(--accent-indigo)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.85rem',
                      textAlign: 'left',
                      boxShadow: '0 2px 8px rgba(99, 102, 241, 0.12)',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.18)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'; }}
                  >
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      background: 'var(--accent-indigo)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Globe size={22} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '900', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        Make Current Fonts Global
                        <span style={{ fontSize: '0.7rem', background: 'var(--accent-indigo)', color: '#fff', padding: '0.1rem 0.45rem', borderRadius: '10px' }}>1-CLICK</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: '0.15rem' }}>
                        Applies "{currentDisplayHeadFont}" (Headlines) & "{currentDisplayBodyFont}" (Body) to all 18 languages!
                      </div>
                    </div>
                  </button>

                  {/* Action 2: Regional / Language-Wise Customizer Toggle */}
                  <button
                    type="button"
                    onClick={() => setScopeMode(scopeMode === 'regional' ? 'global' : 'regional')}
                    style={{
                      padding: '0.9rem 1.15rem',
                      borderRadius: 'var(--radius-sm)',
                      border: scopeMode === 'regional' ? '2px solid var(--accent-emerald)' : '1px solid var(--border-medium)',
                      background: scopeMode === 'regional' ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-secondary)',
                      color: scopeMode === 'regional' ? 'var(--accent-emerald)' : 'var(--text-main)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.85rem',
                      textAlign: 'left',
                      boxShadow: scopeMode === 'regional' ? '0 4px 12px rgba(16, 185, 129, 0.15)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      background: scopeMode === 'regional' ? 'var(--accent-emerald)' : 'var(--bg-surface)',
                      color: scopeMode === 'regional' ? '#fff' : 'var(--text-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Languages size={22} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '900', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        Regional / Language-Wise List
                        {scopeMode === 'regional' ? (
                          <span style={{ fontSize: '0.7rem', background: 'var(--accent-emerald)', color: '#fff', padding: '0.1rem 0.45rem', borderRadius: '10px' }}>OPEN</span>
                        ) : (
                          <span style={{ fontSize: '0.7rem', background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', color: 'var(--text-subtle)', padding: '0.1rem 0.45rem', borderRadius: '10px' }}>SHOW LIST</span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: '0.15rem' }}>
                        {scopeMode === 'regional' ? 'Click to hide language list' : 'Click to select and customize fonts for specific languages'}
                      </div>
                    </div>
                  </button>
                </div>

                {/* 2-COLUMN MAIN DESK */}
                <div className="typography-desk-layout">
                  
                  {/* LEFT COLUMN: Controls, Pickers, Language Selector & Sliders */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* IF REGIONAL MODE: RENDER LANGUAGE SELECTION SHELF */}
                    {scopeMode === 'regional' && (
                      <div style={{
                        background: 'var(--bg-secondary)',
                        padding: '1.25rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--accent-emerald)',
                        boxShadow: '0 2px 8px rgba(16, 185, 129, 0.08)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div>
                            <div style={{ fontSize: '0.88rem', fontWeight: '900', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <MapPin size={16} color="var(--accent-emerald)" /> Select Language to Customize ({allLanguagesList.length} Supported)
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: '0.1rem' }}>
                              Click any language below to configure its headlines & body text fonts.
                            </div>
                          </div>
                          <span style={{ fontSize: '0.75rem', fontWeight: '800', background: 'var(--accent-emerald)', color: '#fff', padding: '0.2rem 0.6rem', borderRadius: '12px' }}>
                            Currently Editing: {selectedLangData.native} ({selectedLangData.name})
                          </span>
                        </div>

                        {/* Language Search */}
                        <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                          <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)' }} />
                          <input
                            type="text"
                            placeholder="Filter language (e.g. Hindi, Tamil, Bengali, Urdu)..."
                            value={langSearchQuery}
                            onChange={(e) => setLangSearchQuery(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '0.45rem 0.75rem 0.45rem 2.2rem',
                              fontSize: '0.8rem',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border-medium)',
                              background: 'var(--bg-surface)',
                              color: 'var(--text-main)'
                            }}
                          />
                        </div>

                        {/* Languages Grid Pills */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                          gap: '0.45rem',
                          maxHeight: '190px',
                          overflowY: 'auto',
                          paddingRight: '0.25rem'
                        }}>
                          {filteredLangs.map((lang) => {
                            const isSelected = selectedRegionalLang === lang.code;
                            return (
                              <button
                                key={lang.code}
                                type="button"
                                onClick={() => setSelectedRegionalLang(lang.code)}
                                style={{
                                  padding: '0.45rem 0.55rem',
                                  borderRadius: '6px',
                                  fontSize: '0.76rem',
                                  fontWeight: isSelected ? '800' : '600',
                                  border: isSelected ? '2px solid var(--accent-emerald)' : '1px solid var(--border-medium)',
                                  background: isSelected ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-surface)',
                                  color: isSelected ? 'var(--accent-emerald)' : 'var(--text-main)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: '0.15rem',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                <span style={{ fontSize: '0.72rem', fontWeight: '900', color: isSelected ? 'var(--accent-emerald)' : 'var(--text-subtle)', background: 'var(--bg-main)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>{lang.code.toUpperCase()}</span>
                                <span style={{ fontWeight: '800', lineHeight: 1.1 }}>{lang.native}</span>
                                <span style={{ fontSize: '0.66rem', color: 'var(--text-subtle)' }}>{lang.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    {/* 1. HEADINGS & TITLES SECTION */}
                    <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)' }}>
                      <VisualFontPicker
                        label={
                          scopeMode === 'regional'
                            ? `Headline Font for: ${selectedLangData.native} (${selectedLangData.name})`
                            : 'Headline & Title Font Family'
                        }
                        subtitle={
                          scopeMode === 'regional'
                            ? `Applied whenever readers view ${selectedLangData.name} articles & breaking news.`
                            : 'Applied to Breaking News, Hero banners, and Story Titles.'
                        }
                        value={currentDisplayHeadFont}
                        onChange={(newFont) => {
                          setHasUnsavedTypographyChanges(true);
                          if (scopeMode === 'regional') {
                            const currentReg = localTypography.regionalFonts || DEFAULT_REGIONAL_FONTS;
                            const currentLang = currentReg[selectedRegionalLang] || {
                              headingFont: localTypography.headingFont || 'Playfair Display',
                              bodyFont: localTypography.bodyFont || 'Plus Jakarta Sans'
                            };
                            setLocalTypography({
                              ...localTypography,
                              regionalFonts: {
                                ...currentReg,
                                [selectedRegionalLang]: {
                                  ...currentLang,
                                  headingFont: newFont
                                }
                              }
                            });
                          } else {
                            setLocalTypography({ ...localTypography, headingFont: newFont });
                          }
                        }}
                      />

                      {/* 1-CLICK MAKE HEADLINE FONT GLOBAL BUTTON */}
                      <div style={{
                        marginTop: '0.65rem',
                        marginBottom: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                        background: 'var(--bg-surface)',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border-light)'
                      }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', fontWeight: '600' }}>
                          Want <strong>"{currentDisplayHeadFont}"</strong> for ALL headlines across the whole site?
                        </span>
                        <button
                          type="button"
                          onClick={() => handleMakeHeadlineFontGlobal(currentDisplayHeadFont)}
                          style={{
                            padding: '0.4rem 0.85rem',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: '800',
                            border: '1px solid var(--accent-indigo)',
                            background: 'rgba(99, 102, 241, 0.1)',
                            color: 'var(--accent-indigo)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-indigo)'; e.currentTarget.style.color = '#fff'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'; e.currentTarget.style.color = 'var(--accent-indigo)'; }}
                        >
                          <Globe size={14} /> Make Headline Font Global (All 18 Languages)
                        </button>
                      </div>

                      {/* Heading Scale Controls (Responsive: Desktop vs Mobile) */}
                      {deviceMode === 'desktop' ? (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <Monitor size={15} color="var(--accent-indigo)" /> Desktop Headline Scale (बड़ी स्क्रीन):
                            </label>
                            <span style={{ fontSize: '0.85rem', fontWeight: '900', color: 'var(--accent-indigo)', background: 'var(--bg-surface)', padding: '0.15rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-medium)' }}>
                              {localTypography.headingScale || 100}% Scale
                            </span>
                          </div>

                          {/* Quick Preset Buttons for Desktop */}
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                            {[
                              { label: 'Compact', val: 85 },
                              { label: 'Standard', val: 100 },
                              { label: 'Large', val: 115 },
                              { label: 'Hero Bold', val: 130 },
                              { label: 'Maximum', val: 145 }
                            ].map((preset) => (
                              <button
                                key={preset.val}
                                type="button"
                                onClick={() => {
                                  setLocalTypography({ ...localTypography, headingScale: preset.val });
                                  setHasUnsavedTypographyChanges(true);
                                }}
                                style={{
                                  padding: '0.35rem 0.75rem',
                                  borderRadius: '20px',
                                  fontSize: '0.78rem',
                                  fontWeight: '700',
                                  border: '1px solid',
                                  borderColor: (localTypography.headingScale || 100) === preset.val ? 'var(--accent-indigo)' : 'var(--border-medium)',
                                  background: (localTypography.headingScale || 100) === preset.val ? 'var(--accent-indigo)' : 'var(--bg-surface)',
                                  color: (localTypography.headingScale || 100) === preset.val ? '#fff' : 'var(--text-main)',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                {preset.label} ({preset.val}%)
                              </button>
                            ))}
                          </div>

                          {/* Precision Range Slider for Desktop */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', fontWeight: '700' }}>80%</span>
                            <input
                              type="range"
                              min="80"
                              max="150"
                              step="5"
                              value={localTypography.headingScale || 100}
                              onChange={(e) => {
                                setLocalTypography({ ...localTypography, headingScale: Number(e.target.value) });
                                setHasUnsavedTypographyChanges(true);
                              }}
                              style={{ flex: 1, accentColor: 'var(--accent-indigo)', cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', fontWeight: '700' }}>150%</span>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div style={{
                            background: 'rgba(99, 102, 241, 0.08)',
                            borderLeft: '3px solid var(--accent-indigo)',
                            padding: '0.45rem 0.75rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            color: 'var(--text-main)',
                            marginBottom: '0.65rem'
                          }}>
                            <strong>Mobile Headline Scale</strong> applies to mobile screens (≤ 768px). Prevents awkward line wrapping on compact phone screens.
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <Smartphone size={15} color="var(--accent-indigo)" /> Mobile Headline Scale (छोटी स्क्रीन):
                            </label>
                            <span style={{ fontSize: '0.85rem', fontWeight: '900', color: 'var(--accent-indigo)', background: 'var(--bg-surface)', padding: '0.15rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-medium)' }}>
                              {localTypography.mobileHeadingScale || 85}% Scale
                            </span>
                          </div>

                          {/* Quick Preset Buttons for Mobile */}
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                            {[
                              { label: 'Compact', val: 75 },
                              { label: 'Standard', val: 85 },
                              { label: 'Balanced', val: 90 },
                              { label: 'Hero', val: 100 },
                              { label: 'Maximum', val: 110 }
                            ].map((preset) => (
                              <button
                                key={preset.val}
                                type="button"
                                onClick={() => {
                                  setLocalTypography({ ...localTypography, mobileHeadingScale: preset.val });
                                  setHasUnsavedTypographyChanges(true);
                                }}
                                style={{
                                  padding: '0.35rem 0.75rem',
                                  borderRadius: '20px',
                                  fontSize: '0.78rem',
                                  fontWeight: '700',
                                  border: '1px solid',
                                  borderColor: (localTypography.mobileHeadingScale || 85) === preset.val ? 'var(--accent-indigo)' : 'var(--border-medium)',
                                  background: (localTypography.mobileHeadingScale || 85) === preset.val ? 'var(--accent-indigo)' : 'var(--bg-surface)',
                                  color: (localTypography.mobileHeadingScale || 85) === preset.val ? '#fff' : 'var(--text-main)',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                {preset.label} ({preset.val}%)
                              </button>
                            ))}
                          </div>

                          {/* Precision Range Slider for Mobile */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', fontWeight: '700' }}>70%</span>
                            <input
                              type="range"
                              min="70"
                              max="115"
                              step="5"
                              value={localTypography.mobileHeadingScale || 85}
                              onChange={(e) => {
                                setLocalTypography({ ...localTypography, mobileHeadingScale: Number(e.target.value) });
                                setHasUnsavedTypographyChanges(true);
                              }}
                              style={{ flex: 1, accentColor: 'var(--accent-indigo)', cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', fontWeight: '700' }}>115%</span>
                          </div>
                        </div>
                      )}

                      {/* Headline Font Boldness / Weight Control - NO RAW NUMBERS */}
                      <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px dashed var(--border-medium)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <label style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            Headline Font Boldness:
                          </label>
                          {/* Dynamic descriptive badge rendered in that EXACT font thickness — ZERO numbers */}
                          <span style={{
                            fontSize: '0.85rem',
                            fontWeight: localTypography.headingWeight || 700,
                            color: 'var(--accent-indigo)',
                            background: 'var(--bg-surface)',
                            padding: '0.2rem 0.75rem',
                            borderRadius: '6px',
                            border: '1px solid var(--border-medium)',
                            transition: 'all 0.15s ease'
                          }}>
                            {getWeightLabel(localTypography.headingWeight || 700)}
                          </span>
                        </div>

                        {/* Quick Boldness Preset Chips — Buttons rendered in their actual thickness, ZERO numbers */}
                        <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                          {[
                            { label: 'Regular', val: 400 },
                            { label: 'Medium', val: 500 },
                            { label: 'Semi-Bold', val: 600 },
                            { label: 'Bold', val: 700 },
                            { label: 'Extra Bold', val: 800 },
                            { label: 'Ultra Black', val: 900 }
                          ].map((preset) => {
                            const isSelected = (localTypography.headingWeight || 700) === preset.val;
                            return (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() => {
                                  setLocalTypography({ ...localTypography, headingWeight: preset.val });
                                  setHasUnsavedTypographyChanges(true);
                                }}
                                style={{
                                  padding: '0.35rem 0.75rem',
                                  borderRadius: '20px',
                                  fontSize: '0.78rem',
                                  fontWeight: preset.val,
                                  border: '1px solid',
                                  borderColor: isSelected ? 'var(--accent-indigo)' : 'var(--border-medium)',
                                  background: isSelected ? 'var(--accent-indigo)' : 'var(--bg-surface)',
                                  color: isSelected ? '#fff' : 'var(--text-main)',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                {preset.label}
                              </button>
                            );
                          })}
                        </div>

                        {/* Continuous Boldness Slider Bar without any numeric labels */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', fontWeight: '400' }}>Slim / Regular</span>
                          <input
                            type="range"
                            min="400"
                            max="900"
                            step="50"
                            value={localTypography.headingWeight || 700}
                            onChange={(e) => {
                              setLocalTypography({ ...localTypography, headingWeight: Number(e.target.value) });
                              setHasUnsavedTypographyChanges(true);
                            }}
                            style={{ flex: 1, accentColor: 'var(--accent-indigo)', cursor: 'pointer' }}
                          />
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-main)', fontWeight: '900' }}>Maximum Bold</span>
                        </div>
                      </div>
                    </div>

                    {/* 2. BODY TEXT & ARTICLE READING SECTION */}
                    <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)' }}>
                      <VisualFontPicker
                        label={
                          scopeMode === 'regional'
                            ? `Body Font for: ${selectedLangData.native} (${selectedLangData.name})`
                            : 'Body Copy & Article Reading Font'
                        }
                        subtitle={
                          scopeMode === 'regional'
                            ? `Applied to ${selectedLangData.name} article paragraphs, summaries, and long reads.`
                            : 'Applied to article paragraphs, summaries, and long-form content.'
                        }
                        value={currentDisplayBodyFont}
                        onChange={(newFont) => {
                          setHasUnsavedTypographyChanges(true);
                          if (scopeMode === 'regional') {
                            const currentReg = localTypography.regionalFonts || DEFAULT_REGIONAL_FONTS;
                            const currentLang = currentReg[selectedRegionalLang] || {
                              headingFont: localTypography.headingFont || 'Playfair Display',
                              bodyFont: localTypography.bodyFont || 'Plus Jakarta Sans'
                            };
                            setLocalTypography({
                              ...localTypography,
                              regionalFonts: {
                                ...currentReg,
                                [selectedRegionalLang]: {
                                  ...currentLang,
                                  bodyFont: newFont
                                }
                              }
                            });
                          } else {
                            setLocalTypography({ ...localTypography, bodyFont: newFont });
                          }
                        }}
                      />

                      {/* 1-CLICK MAKE ARTICLE BODY FONT GLOBAL BUTTON */}
                      <div style={{
                        marginTop: '0.65rem',
                        marginBottom: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                        background: 'var(--bg-surface)',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border-light)'
                      }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', fontWeight: '600' }}>
                          Want <strong>"{currentDisplayBodyFont}"</strong> for ALL articles across the whole site?
                        </span>
                        <button
                          type="button"
                          onClick={() => handleMakeBodyFontGlobal(currentDisplayBodyFont)}
                          style={{
                            padding: '0.4rem 0.85rem',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: '800',
                            border: '1px solid var(--accent-emerald)',
                            background: 'rgba(16, 185, 129, 0.1)',
                            color: 'var(--accent-emerald)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-emerald)'; e.currentTarget.style.color = '#fff'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)'; e.currentTarget.style.color = 'var(--accent-emerald)'; }}
                        >
                          <Globe size={14} /> Make Article Font Global (All 18 Languages)
                        </button>
                      </div>

                      {/* Body Size Controls (Responsive: Desktop vs Mobile) */}
                      {deviceMode === 'desktop' ? (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <Monitor size={15} color="var(--accent-emerald)" /> Desktop Article Font Size (बड़ी स्क्रीन):
                            </label>
                            <span style={{ fontSize: '0.85rem', fontWeight: '900', color: 'var(--accent-emerald)', background: 'var(--bg-surface)', padding: '0.15rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-medium)' }}>
                              {localTypography.bodySize || 16}px Base Size
                            </span>
                          </div>

                          {/* Quick Preset Buttons for Desktop */}
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                            {[
                              { label: 'Compact', val: 14 },
                              { label: 'Standard', val: 16 },
                              { label: 'Editorial', val: 18 },
                              { label: 'Comfort', val: 20 },
                              { label: 'Large Read', val: 22 }
                            ].map((preset) => (
                              <button
                                key={preset.val}
                                type="button"
                                onClick={() => {
                                  setLocalTypography({ ...localTypography, bodySize: preset.val });
                                  setHasUnsavedTypographyChanges(true);
                                }}
                                style={{
                                  padding: '0.35rem 0.75rem',
                                  borderRadius: '20px',
                                  fontSize: '0.78rem',
                                  fontWeight: '700',
                                  border: '1px solid',
                                  borderColor: (localTypography.bodySize || 16) === preset.val ? 'var(--accent-emerald)' : 'var(--border-medium)',
                                  background: (localTypography.bodySize || 16) === preset.val ? 'var(--accent-emerald)' : 'var(--bg-surface)',
                                  color: (localTypography.bodySize || 16) === preset.val ? '#fff' : 'var(--text-main)',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                {preset.label} ({preset.val}px)
                              </button>
                            ))}
                          </div>

                          {/* Precision Range Slider for Desktop */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', fontWeight: '700' }}>12px</span>
                            <input
                              type="range"
                              min="12"
                              max="24"
                              step="1"
                              value={localTypography.bodySize || 16}
                              onChange={(e) => {
                                setLocalTypography({ ...localTypography, bodySize: Number(e.target.value) });
                                setHasUnsavedTypographyChanges(true);
                              }}
                              style={{ flex: 1, accentColor: 'var(--accent-emerald)', cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', fontWeight: '700' }}>24px</span>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div style={{
                            background: 'rgba(16, 185, 129, 0.08)',
                            borderLeft: '3px solid var(--accent-emerald)',
                            padding: '0.45rem 0.75rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            color: 'var(--text-main)',
                            marginBottom: '0.65rem'
                          }}>
                            <strong>Mobile Article Body Size</strong> applies to phone reading (≤ 768px). Calibrated for high legibility without overflowing screens.
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <Smartphone size={15} color="var(--accent-emerald)" /> Mobile Article Font Size (छोटी स्क्रीन):
                            </label>
                            <span style={{ fontSize: '0.85rem', fontWeight: '900', color: 'var(--accent-emerald)', background: 'var(--bg-surface)', padding: '0.15rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-medium)' }}>
                              {localTypography.mobileBodySize || 15}px Base Size
                            </span>
                          </div>

                          {/* Quick Preset Buttons for Mobile */}
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                            {[
                              { label: 'Compact', val: 13 },
                              { label: 'Standard', val: 14 },
                              { label: 'Editorial', val: 15 },
                              { label: 'Comfort', val: 16 },
                              { label: 'Large Read', val: 17 }
                            ].map((preset) => (
                              <button
                                key={preset.val}
                                type="button"
                                onClick={() => {
                                  setLocalTypography({ ...localTypography, mobileBodySize: preset.val });
                                  setHasUnsavedTypographyChanges(true);
                                }}
                                style={{
                                  padding: '0.35rem 0.75rem',
                                  borderRadius: '20px',
                                  fontSize: '0.78rem',
                                  fontWeight: '700',
                                  border: '1px solid',
                                  borderColor: (localTypography.mobileBodySize || 15) === preset.val ? 'var(--accent-emerald)' : 'var(--border-medium)',
                                  background: (localTypography.mobileBodySize || 15) === preset.val ? 'var(--accent-emerald)' : 'var(--bg-surface)',
                                  color: (localTypography.mobileBodySize || 15) === preset.val ? '#fff' : 'var(--text-main)',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                {preset.label} ({preset.val}px)
                              </button>
                            ))}
                          </div>

                          {/* Precision Range Slider for Mobile */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', fontWeight: '700' }}>12px</span>
                            <input
                              type="range"
                              min="12"
                              max="18"
                              step="1"
                              value={localTypography.mobileBodySize || 15}
                              onChange={(e) => {
                                setLocalTypography({ ...localTypography, mobileBodySize: Number(e.target.value) });
                                setHasUnsavedTypographyChanges(true);
                              }}
                              style={{ flex: 1, accentColor: 'var(--accent-emerald)', cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', fontWeight: '700' }}>18px</span>
                          </div>
                        </div>
                      )}

                      {/* Body Font Weight / Boldness Control - NO RAW NUMBERS */}
                      <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px dashed var(--border-medium)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <label style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-main)' }}>
                            Body Text Boldness:
                          </label>
                          <span style={{
                            fontSize: '0.85rem',
                            fontWeight: localTypography.bodyWeight || 400,
                            color: 'var(--accent-emerald)',
                            background: 'var(--bg-surface)',
                            padding: '0.2rem 0.75rem',
                            borderRadius: '6px',
                            border: '1px solid var(--border-medium)',
                            transition: 'all 0.15s ease'
                          }}>
                            {getWeightLabel(localTypography.bodyWeight || 400)}
                          </span>
                        </div>

                        {/* Quick Presets without numbers */}
                        <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                          {[
                            { label: 'Light', val: 300 },
                            { label: 'Regular', val: 400 },
                            { label: 'Medium', val: 500 },
                            { label: 'Semi-Bold', val: 600 }
                          ].map((preset) => {
                            const isSelected = (localTypography.bodyWeight || 400) === preset.val;
                            return (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() => {
                                  setLocalTypography({ ...localTypography, bodyWeight: preset.val });
                                  setHasUnsavedTypographyChanges(true);
                                }}
                                style={{
                                  padding: '0.35rem 0.75rem',
                                  borderRadius: '20px',
                                  fontSize: '0.78rem',
                                  fontWeight: preset.val,
                                  border: '1px solid',
                                  borderColor: isSelected ? 'var(--accent-emerald)' : 'var(--border-medium)',
                                  background: isSelected ? 'var(--accent-emerald)' : 'var(--bg-surface)',
                                  color: isSelected ? '#fff' : 'var(--text-main)',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                {preset.label}
                              </button>
                            );
                          })}
                        </div>

                        {/* Continuous Slider without numbers */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', fontWeight: '300' }}>Light / Clean</span>
                          <input
                            type="range"
                            min="300"
                            max="600"
                            step="50"
                            value={localTypography.bodyWeight || 400}
                            onChange={(e) => {
                              setLocalTypography({ ...localTypography, bodyWeight: Number(e.target.value) });
                              setHasUnsavedTypographyChanges(true);
                            }}
                            style={{ flex: 1, accentColor: 'var(--accent-emerald)', cursor: 'pointer' }}
                          />
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-main)', fontWeight: '700' }}>Strong / Bold</span>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* RIGHT COLUMN: STICKY LIVE INTERACTIVE PREVIEW DESK (DYNAMICS PER LANGUAGE & DEVICE) */}
                  <div style={{
                    position: 'sticky',
                    top: '1.5rem',
                    background: 'var(--bg-main)',
                    border: scopeMode === 'regional' ? '2px dashed var(--accent-emerald)' : '2px dashed var(--accent-indigo)',
                    padding: deviceMode === 'mobile' ? '1.25rem 0.75rem' : '1.5rem',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'all 0.2s ease'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.6rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: '900', textTransform: 'uppercase', color: scopeMode === 'regional' ? 'var(--accent-emerald)' : 'var(--accent-indigo)', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        Real-Time Live Preview ({scopeMode === 'regional' ? selectedLangData.native : 'Global Default'})
                      </span>

                      {/* Mini Switcher on Top of Preview for Convenient One-Click Toggling */}
                      <div style={{
                        display: 'inline-flex',
                        background: 'var(--bg-secondary)',
                        padding: '2px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-medium)',
                        gap: '2px'
                      }}>
                        <button
                          type="button"
                          onClick={() => setDeviceMode('desktop')}
                          style={{
                            padding: '0.2rem 0.55rem',
                            borderRadius: '4px',
                            fontSize: '0.72rem',
                            fontWeight: '800',
                            background: deviceMode === 'desktop' ? 'var(--accent-indigo)' : 'transparent',
                            color: deviceMode === 'desktop' ? '#fff' : 'var(--text-subtle)',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}
                          title="View Desktop Layout"
                        >
                          <Monitor size={12} /> Desktop
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeviceMode('mobile')}
                          style={{
                            padding: '0.2rem 0.55rem',
                            borderRadius: '4px',
                            fontSize: '0.72rem',
                            fontWeight: '800',
                            background: deviceMode === 'mobile' ? 'var(--accent-indigo)' : 'transparent',
                            color: deviceMode === 'mobile' ? '#fff' : 'var(--text-subtle)',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}
                          title="View 390px Mobile Phone Layout"
                        >
                          <Smartphone size={12} /> Mobile
                        </button>
                      </div>
                    </div>

                    {/* Mode Metric Subtitle Badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: '800', padding: '0.15rem 0.5rem', borderRadius: '4px', background: deviceMode === 'mobile' ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-secondary)', color: deviceMode === 'mobile' ? 'var(--accent-indigo)' : 'var(--text-main)', border: '1px solid var(--border-medium)' }}>
                        {deviceMode === 'mobile' ? 'Mobile Phone Simulation (390px)' : 'Desktop Broadsheet View'}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', fontWeight: '700' }}>
                        {deviceMode === 'desktop'
                          ? `${currentDisplayHeadFont} (${localTypography.headingScale || 100}%, ${getWeightLabel(localTypography.headingWeight || 700)}) • ${currentDisplayBodyFont} (${localTypography.bodySize || 16}px, ${getWeightLabel(localTypography.bodyWeight || 400)})`
                          : `${currentDisplayHeadFont} (${localTypography.mobileHeadingScale || 85}%) • ${currentDisplayBodyFont} (${localTypography.mobileBodySize || 15}px)`}
                      </span>
                    </div>

                    {/* PREVIEW CONTAINER: Adapts between standard card on desktop and authentic phone chassis on mobile */}
                    <div style={{
                      maxWidth: deviceMode === 'mobile' ? '390px' : '100%',
                      margin: deviceMode === 'mobile' ? '0 auto' : '0',
                      background: 'var(--bg-surface)',
                      border: deviceMode === 'mobile' ? '2px solid var(--border-dark)' : '1px solid var(--border-light)',
                      borderRadius: deviceMode === 'mobile' ? '28px' : 'var(--radius-sm)',
                      padding: deviceMode === 'mobile' ? '1.15rem 1rem 1rem' : '1.25rem',
                      boxShadow: deviceMode === 'mobile' ? '0 12px 36px rgba(0, 0, 0, 0.12)' : 'none',
                      transition: 'all 0.25s ease'
                    }}>
                      {/* Simulated Phone Top Speaker & Notch (Visible only in Mobile Mode) */}
                      {deviceMode === 'mobile' && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1rem' }}>
                          <div style={{
                            width: '48px',
                            height: '4px',
                            background: 'var(--border-medium)',
                            borderRadius: '3px'
                          }} />
                          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '0.62rem', color: 'var(--text-subtle)', fontWeight: '700', marginTop: '0.35rem', padding: '0 0.25rem' }}>
                            <span>9:41</span>
                            <span>5G ●●● 100%</span>
                          </div>
                        </div>
                      )}

                      {/* Regional / Language Headline or Global Hindi Headline */}
                      <div style={{ marginBottom: deviceMode === 'mobile' ? '0.85rem' : '1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: '800', background: scopeMode === 'regional' ? 'var(--accent-emerald)' : 'var(--accent-crimson)', color: '#fff', padding: '0.15rem 0.45rem', borderRadius: '4px', textTransform: 'uppercase' }}>
                            {scopeMode === 'regional' ? `BREAKING NEWS • ${selectedLangData.name.toUpperCase()}` : 'BREAKING HINDI HEADLINE'}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-subtle)', fontStyle: 'italic' }}>
                            {currentDisplayHeadFont}
                          </span>
                        </div>
                        <h2
                          dir={selectedLangData.isRtl && scopeMode === 'regional' ? 'rtl' : 'ltr'}
                          style={{
                            fontFamily: `'${currentDisplayHeadFont}', serif`,
                            fontSize: deviceMode === 'mobile'
                              ? `calc(1.3rem * ${(localTypography.mobileHeadingScale || 85) / 100})`
                              : `calc(1.65rem * ${(localTypography.headingScale || 100) / 100})`,
                            fontWeight: localTypography.headingWeight || 700,
                            color: 'var(--text-main)',
                            lineHeight: deviceMode === 'mobile' ? '1.3' : '1.25',
                            marginTop: '0.35rem',
                            marginBottom: '0.35rem',
                            textAlign: selectedLangData.isRtl && scopeMode === 'regional' ? 'right' : 'left',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {scopeMode === 'regional'
                            ? selectedLangData.headline
                            : 'चंद्रयान और सौर मिशन की सफलता पर पूरे देश में गर्व — विज्ञान का नया स्वर्णिम दौर'}
                        </h2>
                      </div>

                      {/* Secondary Headline (English Global or Language Region Info) */}
                      <div style={{ marginBottom: deviceMode === 'mobile' ? '0.85rem' : '1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: '800', background: 'var(--accent-blue)', color: '#fff', padding: '0.15rem 0.45rem', borderRadius: '4px', textTransform: 'uppercase' }}>
                            {scopeMode === 'regional' ? `REGIONAL COVERAGE • ${selectedLangData.region}` : 'ENGLISH GLOBAL HEADLINE'}
                          </span>
                        </div>
                        <h3
                          style={{
                            fontFamily: `'${currentDisplayHeadFont}', serif`,
                            fontSize: deviceMode === 'mobile'
                              ? `calc(1rem * ${(localTypography.mobileHeadingScale || 85) / 100})`
                              : `calc(1.2rem * ${(localTypography.headingScale || 100) / 100})`,
                            fontWeight: Math.max(400, (localTypography.headingWeight || 700) - 100),
                            color: 'var(--text-main)',
                            lineHeight: '1.3',
                            marginTop: '0.35rem',
                            marginBottom: '0.35rem',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          ISRO Milestone: Indigenous Satellite Grid Deployed into Polar Orbit for Agricultural Monitoring
                        </h3>
                      </div>

                      {/* Live Body Excerpt in Selected Language */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: '800', background: 'var(--bg-secondary)', color: 'var(--text-subtle)', padding: '0.15rem 0.45rem', borderRadius: '4px', textTransform: 'uppercase', display: 'inline-block' }}>
                            {scopeMode === 'regional' ? `ARTICLE BODY TEXT (${selectedLangData.native})` : 'ARTICLE BODY TEXT'}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-subtle)', fontStyle: 'italic' }}>
                            {deviceMode === 'mobile' ? `${localTypography.mobileBodySize || 15}px` : `${localTypography.bodySize || 16}px`}
                          </span>
                        </div>
                        <div
                          dir={selectedLangData.isRtl && scopeMode === 'regional' ? 'rtl' : 'ltr'}
                          style={{
                            fontFamily: `'${currentDisplayBodyFont}', sans-serif`,
                            fontSize: deviceMode === 'mobile'
                              ? `${localTypography.mobileBodySize || 15}px`
                              : `${localTypography.bodySize || 16}px`,
                            fontWeight: localTypography.bodyWeight || 400,
                            color: 'var(--text-muted)',
                            lineHeight: deviceMode === 'mobile' ? '1.58' : '1.65',
                            background: 'var(--bg-secondary)',
                            padding: deviceMode === 'mobile' ? '0.85rem' : '1.1rem',
                            borderRadius: 'var(--radius-sm)',
                            borderLeft: scopeMode === 'regional' ? '4px solid var(--accent-emerald)' : '4px solid var(--accent-indigo)',
                            textAlign: selectedLangData.isRtl && scopeMode === 'regional' ? 'right' : 'left',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {scopeMode === 'regional'
                            ? selectedLangData.excerpt
                            : 'देश भर में आधुनिक वैज्ञानिक तकनीकों और डिजिटल मीडिया क्रांति के साथ विश्वसनीय सूचना का आदान-प्रदान अब और अधिक सुगम हो गया है। Readers across all 18 supported regional languages can now experience authentic editorial reporting with crystal-clear typography tailored precisely to their reading comfort.'}
                        </div>
                      </div>

                      {/* Phone Bottom Home Bar Indicator (Visible only in Mobile Mode) */}
                      {deviceMode === 'mobile' && (
                        <div style={{
                          width: '110px',
                          height: '4px',
                          background: 'var(--border-medium)',
                          borderRadius: '2px',
                          margin: '1.25rem auto 0.25rem'
                        }} />
                      )}
                    </div>

                    {/* Informative footer pill */}
                    <div style={{ marginTop: '1rem', padding: '0.65rem 0.85rem', background: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '0.73rem', color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Sparkles size={14} color="var(--accent-indigo)" />
                      <span>
                        {deviceMode === 'mobile'
                          ? `Mobile phone mode simulates screen width ≤ 768px. Mobile headline scale (${localTypography.mobileHeadingScale || 85}%) & mobile body size (${localTypography.mobileBodySize || 15}px) apply live across phones.`
                          : `Desktop broadsheet mode simulates computer screens > 768px. Desktop scale (${localTypography.headingScale || 100}%) & body size (${localTypography.bodySize || 16}px) apply on laptops.`}
                      </span>
                    </div>

                  </div>

                </div>
              </div>
            );
          })()}

          {/* COLOR HARMONIES & THEMES CUSTOMIZER DESK */}
          {activeTab === 'theme' && (
            <ColorPaletteCustomizer
              currentTheme={themePalette}
              onSaveTheme={(updatedTheme) => {
                if (onUpdateTheme) onUpdateTheme(updatedTheme);
                if (onShowToast) onShowToast('Color harmony palette applied successfully.');
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
