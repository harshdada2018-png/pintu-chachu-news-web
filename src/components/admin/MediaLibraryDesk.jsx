import React, { useState, useEffect, useRef } from 'react';
import {
  Image as ImageIcon, Upload, Search, RefreshCw, Copy, Check, Eye, Trash2,
  AlertTriangle, X, ExternalLink, CheckCircle2, SlidersHorizontal, ShieldAlert,
  Tag, Info
} from 'lucide-react';
import {
  getMediaAssets, uploadMediaAsset, deleteMediaAsset, updateMediaMetadata,
  formatFileSize, formatMediaDate
} from '../../services/mediaLibraryService';

const NEWS_AGENCY_PRESETS = [
  'PTI',
  'Reuters',
  'ANI',
  'PIB',
  'Staff Photographer',
  'AFP',
  'AP',
  'Press Release'
];

/**
 * PublicSpark Newsroom Media Library Desk (Task 22 Subtopic B)
 * Centralized sovereign photo archive with deep keyword search, caption/credit management,
 * and editorial role-based access control.
 */
export default function MediaLibraryDesk({ currentRole = 'editor', onSelectAssetForStory }) {
  const [assets, setAssets] = useState([]);
  const [stats, setStats] = useState({
    totalCount: 0,
    usedCount: 0,
    unusedCount: 0,
    withCaptionCount: 0,
    missingCreditCount: 0,
    totalSizeMb: '0.00 MB',
    avgSizeKb: '0 KB',
    storageLimitMb: 5000,
    storageUsedPct: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'used' | 'unused' | 'missing_credit' | 'has_caption'
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'oldest' | 'size_desc' | 'size_asc' | 'name_asc' | 'name_desc'
  const [copiedUrl, setCopiedUrl] = useState('');
  const [inspectAsset, setInspectAsset] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [forceDeleteChecked, setForceDeleteChecked] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState('');
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploadCredit, setUploadCredit] = useState('');
  const [uploadAltText, setUploadAltText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

  // Editable fields in inspection modal
  const [editCaption, setEditCaption] = useState('');
  const [editCredit, setEditCredit] = useState('');
  const [editAltText, setEditAltText] = useState('');
  const [savingMetadata, setSavingMetadata] = useState(false);

  const fileInputRef = useRef(null);

  const isReporter = currentRole === 'reporter';
  const isAdmin = currentRole === 'admin';
  const isEditor = currentRole === 'editor' || isAdmin;

  // Load assets from server
  const loadAssets = async () => {
    setLoading(true);
    try {
      const data = await getMediaAssets({
        q: searchQuery,
        filter: filterType,
        sort: sortBy
      });
      if (data && data.assets) {
        setAssets(data.assets);
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch (e) {
      console.error('[Media Desk Error]', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, [filterType, sortBy]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadAssets();
    }, 280);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Copy URL action
  const handleCopyUrl = (url) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    showToast('Image URL copied to clipboard');
    setTimeout(() => setCopiedUrl(''), 2200);
  };

  // File selection for upload modal
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setUploadPreview(ev.target.result);
    };
    reader.readAsDataURL(file);
    setIsUploadModalOpen(true);
  };

  // Submit Upload with Metadata
  const handleSubmitUpload = async (e) => {
    if (e) e.preventDefault();
    if (!uploadFile) return;

    setUploading(true);
    setUploadStatus('Compressing photo to WebP (< 200KB)...');

    try {
      const result = await uploadMediaAsset({
        file: uploadFile,
        caption: uploadCaption,
        credit: uploadCredit,
        altText: uploadAltText
      });

      if (result && result.success) {
        showToast(`Photo saved as ${result.file_name} (${result.size_kb} KB)`);
        setIsUploadModalOpen(false);
        setUploadFile(null);
        setUploadPreview('');
        setUploadCaption('');
        setUploadCredit('');
        setUploadAltText('');
        await loadAssets();
      } else {
        showToast(result.error || 'Upload failed');
      }
    } catch (err) {
      showToast(err.message || 'Error uploading photo');
    } finally {
      setUploading(false);
      setUploadStatus('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Open inspection modal
  const openInspector = (asset) => {
    setInspectAsset(asset);
    setEditCaption(asset.caption || '');
    setEditCredit(asset.credit || '');
    setEditAltText(asset.altText || '');
  };

  // Save metadata (Editor / Admin only)
  const handleSaveMetadata = async () => {
    if (!inspectAsset) return;
    if (isReporter) {
      showToast('Editorial Gate: Reporters cannot modify media metadata.');
      return;
    }

    setSavingMetadata(true);
    try {
      const res = await updateMediaMetadata(
        inspectAsset.fileName,
        {
          caption: editCaption,
          credit: editCredit,
          altText: editAltText
        },
        currentRole
      );

      if (res && res.success) {
        showToast('Media caption & credit updated');
        setInspectAsset({
          ...inspectAsset,
          caption: editCaption,
          credit: editCredit,
          altText: editAltText
        });
        await loadAssets();
      } else {
        showToast(res.error || 'Failed to update metadata');
      }
    } catch (err) {
      showToast(err.message || 'Failed to update metadata');
    } finally {
      setSavingMetadata(false);
    }
  };

  // Delete asset handler
  const handleDelete = async () => {
    if (!deleteTarget) return;

    if (isReporter) {
      showToast('Editorial Gate: Reporters cannot delete media assets.');
      return;
    }

    // Force delete check
    if (deleteTarget.hasConflict && forceDeleteChecked && !isAdmin) {
      showToast('Administrative Gate: Only Newsroom Administrators can force-delete in-use media assets.');
      return;
    }

    try {
      const result = await deleteMediaAsset(deleteTarget.fileName, forceDeleteChecked, currentRole);
      if (result && result.success) {
        showToast(`Asset "${deleteTarget.fileName}" deleted`);
        setDeleteTarget(null);
        setForceDeleteChecked(false);
        if (inspectAsset?.fileName === deleteTarget.fileName) {
          setInspectAsset(null);
        }
        await loadAssets();
      } else if (result.requiresForce) {
        setDeleteTarget({
          ...deleteTarget,
          hasConflict: true,
          usedInArticles: result.usedInArticles || []
        });
      } else {
        showToast(result.error || 'Failed to delete asset');
      }
    } catch (err) {
      showToast(err.message || 'Error deleting asset');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          background: 'var(--text-main)',
          color: 'var(--bg-main)',
          padding: '0.65rem 1.15rem',
          borderRadius: '4px',
          fontSize: '0.85rem',
          fontWeight: '700',
          boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          border: '1px solid var(--border-medium)'
        }}>
          <CheckCircle2 size={16} color="var(--accent-green, #10B981)" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Desk Masthead Banner */}
      <div style={{
        background: 'var(--bg-main)',
        border: '1px solid var(--border-medium)',
        padding: '1.25rem 1.5rem',
        borderRadius: 'var(--radius-sm)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
              <ImageIcon size={20} color="var(--accent-blue)" />
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '900', letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
                Centralized Media & Photo Assets Library
              </h2>
            </div>
            <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text-subtle)', maxWidth: '680px', lineHeight: '1.45' }}>
              Institutional photo repository indexing all assets in <code style={{ fontSize: '0.78rem', background: 'var(--bg-secondary)', padding: '0.1rem 0.35rem', borderRadius: '3px' }}>server/data/uploads/</code>. Features deep keyword search, editorial caption & photographer credit management, and active story usage tracking.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*"
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                fontSize: '0.825rem',
                padding: '0.55rem 1rem',
                fontWeight: '800'
              }}
            >
              <Upload size={14} />
              <span>Upload New Photo</span>
            </button>

            <button
              onClick={loadAssets}
              className="btn btn-outline"
              title="Refresh Media Index"
              style={{ padding: '0.55rem 0.75rem' }}
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* 4 Sovereign Metrics Badges */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '0.75rem',
          marginTop: '1.25rem',
          paddingTop: '1rem',
          borderTop: '1px solid var(--border-light)'
        }}>
          <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem 0.9rem', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-subtle)', display: 'block', marginBottom: '0.2rem' }}>
              Total Media Assets
            </span>
            <div style={{ fontSize: '1.35rem', fontWeight: '900', color: 'var(--text-main)' }}>
              {stats.totalCount}
            </div>
            <span style={{ fontSize: '0.675rem', color: 'var(--text-subtle)' }}>
              Avg Size: {stats.avgSizeKb || '0 KB'}
            </span>
          </div>

          <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem 0.9rem', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent-blue, #2563EB)', display: 'block', marginBottom: '0.2rem' }}>
              Used in Stories
            </span>
            <div style={{ fontSize: '1.35rem', fontWeight: '900', color: 'var(--accent-blue, #2563EB)' }}>
              {stats.usedCount}
            </div>
            <span style={{ fontSize: '0.675rem', color: 'var(--text-subtle)' }}>
              Unused: {stats.unusedCount}
            </span>
          </div>

          <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem 0.9rem', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.06em', color: stats.missingCreditCount > 0 ? '#B45309' : 'var(--text-subtle)', display: 'block', marginBottom: '0.2rem' }}>
              Missing Credit
            </span>
            <div style={{ fontSize: '1.35rem', fontWeight: '900', color: stats.missingCreditCount > 0 ? '#B45309' : 'var(--text-main)' }}>
              {stats.missingCreditCount}
            </div>
            <span style={{ fontSize: '0.675rem', color: 'var(--text-subtle)' }}>
              With Caption: {stats.withCaptionCount || 0}
            </span>
          </div>

          <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem 0.9rem', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-subtle)', display: 'block', marginBottom: '0.2rem' }}>
              Storage Consumed
            </span>
            <div style={{ fontSize: '1.1rem', fontWeight: '900', color: 'var(--text-main)' }}>
              {stats.totalSizeMb}
            </div>
            <span style={{ fontSize: '0.675rem', color: 'var(--text-subtle)' }}>
              {stats.storageUsedPct || 0}% of 5,000 MB Cloud Tier
            </span>
          </div>
        </div>
      </div>

      {/* Search, Filter Tabs & Sort Controls */}
      <div style={{
        background: 'var(--bg-main)',
        border: '1px solid var(--border-medium)',
        padding: '0.85rem 1rem',
        borderRadius: 'var(--radius-sm)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem'
      }}>
        {/* Left: Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilterType('all')}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: '16px',
              border: '1px solid',
              borderColor: filterType === 'all' ? 'var(--accent-blue)' : 'var(--border-medium)',
              background: filterType === 'all' ? 'var(--accent-blue)' : 'var(--bg-secondary)',
              color: filterType === 'all' ? '#fff' : 'var(--text-main)',
              fontSize: '0.78rem',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            All Photos ({stats.totalCount})
          </button>

          <button
            onClick={() => setFilterType('used')}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: '16px',
              border: '1px solid',
              borderColor: filterType === 'used' ? 'var(--accent-blue)' : 'var(--border-medium)',
              background: filterType === 'used' ? 'var(--accent-blue)' : 'var(--bg-secondary)',
              color: filterType === 'used' ? '#fff' : 'var(--text-main)',
              fontSize: '0.78rem',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            In-Use ({stats.usedCount})
          </button>

          <button
            onClick={() => setFilterType('unused')}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: '16px',
              border: '1px solid',
              borderColor: filterType === 'unused' ? 'var(--accent-blue)' : 'var(--border-medium)',
              background: filterType === 'unused' ? 'var(--accent-blue)' : 'var(--bg-secondary)',
              color: filterType === 'unused' ? '#fff' : 'var(--text-main)',
              fontSize: '0.78rem',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Unused ({stats.unusedCount})
          </button>

          <button
            onClick={() => setFilterType('missing_credit')}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: '16px',
              border: '1px solid',
              borderColor: filterType === 'missing_credit' ? '#B45309' : 'var(--border-medium)',
              background: filterType === 'missing_credit' ? '#FEF3C7' : 'var(--bg-secondary)',
              color: filterType === 'missing_credit' ? '#B45309' : 'var(--text-main)',
              fontSize: '0.78rem',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Missing Credit ({stats.missingCreditCount})
          </button>

          <button
            onClick={() => setFilterType('has_caption')}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: '16px',
              border: '1px solid',
              borderColor: filterType === 'has_caption' ? 'var(--accent-blue)' : 'var(--border-medium)',
              background: filterType === 'has_caption' ? 'var(--accent-blue)' : 'var(--bg-secondary)',
              color: filterType === 'has_caption' ? '#fff' : 'var(--text-main)',
              fontSize: '0.78rem',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            With Caption ({stats.withCaptionCount})
          </button>
        </div>

        {/* Right: Search & Sort */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', flexGrow: 1, justifyContent: 'flex-end' }}>
          <div style={{ position: 'relative', minWidth: '220px', maxWidth: '340px', flexGrow: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by caption, agency, story..."
              style={{
                width: '100%',
                padding: '0.45rem 0.65rem 0.45rem 2rem',
                fontSize: '0.825rem',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-medium)',
                borderRadius: '4px',
                color: 'var(--text-main)'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-subtle)'
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <SlidersHorizontal size={14} style={{ color: 'var(--text-subtle)' }} />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                padding: '0.45rem 0.65rem',
                fontSize: '0.8rem',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-medium)',
                borderRadius: '4px',
                color: 'var(--text-main)',
                cursor: 'pointer'
              }}
            >
              <option value="newest">Newest Uploads</option>
              <option value="oldest">Oldest Uploads</option>
              <option value="size_desc">Largest Size</option>
              <option value="size_asc">Smallest Size</option>
              <option value="name_asc">Name (A-Z)</option>
              <option value="name_desc">Name (Z-A)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Asset Grid */}
      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-subtle)' }}>
          <RefreshCw size={24} className="spin" style={{ marginBottom: '0.5rem', display: 'inline-block' }} />
          <p style={{ margin: 0, fontSize: '0.85rem' }}>Searching and indexing media assets...</p>
        </div>
      ) : assets.length === 0 ? (
        <div style={{
          background: 'var(--bg-main)',
          border: '1px dashed var(--border-medium)',
          borderRadius: 'var(--radius-sm)',
          padding: '3rem 2rem',
          textAlign: 'center'
        }}>
          <ImageIcon size={36} color="var(--text-subtle)" style={{ marginBottom: '0.75rem' }} />
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: '800' }}>
            No Media Assets Found
          </h3>
          <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.825rem', color: 'var(--text-subtle)', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
            {searchQuery
              ? `No photo matches "${searchQuery}". Try a different agency name or keyword.`
              : 'No assets found for the selected filter.'}
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-primary"
            style={{ fontSize: '0.825rem', padding: '0.5rem 1rem' }}
          >
            <Upload size={14} style={{ marginRight: '0.4rem' }} />
            <span>Upload Photo Now</span>
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '1rem'
        }}>
          {assets.map((asset) => {
            const isCopied = copiedUrl === asset.url;

            return (
              <div
                key={asset.id || asset.fileName}
                style={{
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-sm)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'border-color 0.15s ease'
                }}
              >
                {/* Thumbnail Container */}
                <div style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '16/9',
                  background: 'var(--bg-secondary)',
                  borderBottom: '1px solid var(--border-light)',
                  overflow: 'hidden'
                }}>
                  <img
                    src={asset.url}
                    alt={asset.caption || asset.fileName}
                    loading="lazy"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block'
                    }}
                  />

                  {/* Top-Left: Size Badge */}
                  <span style={{
                    position: 'absolute',
                    top: '8px',
                    left: '8px',
                    background: 'rgba(0,0,0,0.75)',
                    color: '#fff',
                    padding: '0.15rem 0.45rem',
                    borderRadius: '3px',
                    fontSize: '0.675rem',
                    fontWeight: '800',
                    letterSpacing: '0.04em'
                  }}>
                    {asset.sizeKb} KB
                  </span>

                  {/* Top-Right: Usage Status Pill */}
                  <span style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    background: asset.isUsed ? 'var(--accent-blue, #2563EB)' : 'rgba(0,0,0,0.65)',
                    color: '#fff',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '12px',
                    fontSize: '0.675rem',
                    fontWeight: '800'
                  }}>
                    {asset.usedInArticles?.length > 0
                      ? `${asset.usedInArticles.length} ${asset.usedInArticles.length === 1 ? 'Story' : 'Stories'}`
                      : (asset.usedInAds?.length > 0 ? 'Ad Banner' : 'Unused')}
                  </span>
                </div>

                {/* Card Content & Details */}
                <div style={{ padding: '0.75rem', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div
                    title={asset.fileName}
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: '800',
                      color: 'var(--text-main)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {asset.fileName}
                  </div>

                  {/* Caption Preview */}
                  {asset.caption ? (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-main)', fontStyle: 'italic', lineHeight: '1.3' }}>
                      "{asset.caption}"
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>
                      No editorial caption set.
                    </div>
                  )}

                  {/* Agency Credit Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.1rem' }}>
                    {asset.credit ? (
                      <span style={{
                        fontSize: '0.675rem',
                        fontWeight: '800',
                        color: 'var(--accent-blue)',
                        background: 'var(--bg-secondary)',
                        padding: '0.15rem 0.45rem',
                        borderRadius: '3px',
                        border: '1px solid var(--border-medium)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}>
                        <Tag size={10} />
                        <span>Source: {asset.credit}</span>
                      </span>
                    ) : (
                      <span style={{
                        fontSize: '0.65rem',
                        fontWeight: '800',
                        color: '#B45309',
                        background: '#FEF3C7',
                        padding: '0.12rem 0.4rem',
                        borderRadius: '3px',
                        border: '1px solid #FCD34D'
                      }}>
                        Missing Credit
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', marginTop: '0.2rem' }}>
                    {formatMediaDate(asset.uploadedAt)}
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div style={{
                  padding: '0.5rem 0.75rem',
                  borderTop: '1px solid var(--border-light)',
                  background: 'var(--bg-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.4rem'
                }}>
                  {onSelectAssetForStory && (
                    <button
                      onClick={() => onSelectAssetForStory(asset)}
                      className="btn btn-primary"
                      style={{ fontSize: '0.725rem', padding: '0.3rem 0.6rem', fontWeight: '800' }}
                    >
                      Insert
                    </button>
                  )}

                  <button
                    onClick={() => handleCopyUrl(asset.url)}
                    className="btn btn-outline"
                    title="Copy Image URL to Clipboard"
                    style={{
                      fontSize: '0.725rem',
                      padding: '0.3rem 0.55rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      background: isCopied ? 'var(--accent-green, #10B981)' : undefined,
                      color: isCopied ? '#fff' : undefined,
                      borderColor: isCopied ? 'var(--accent-green, #10B981)' : undefined
                    }}
                  >
                    {isCopied ? <Check size={12} /> : <Copy size={12} />}
                    <span>{isCopied ? 'Copied' : 'URL'}</span>
                  </button>

                  <button
                    onClick={() => openInspector(asset)}
                    className="btn btn-outline"
                    title="Inspect Photo, Caption & Credit"
                    style={{ fontSize: '0.725rem', padding: '0.3rem 0.55rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    <Eye size={12} />
                    <span>{isReporter ? 'Inspect' : 'Edit / Details'}</span>
                  </button>

                  {!isReporter && (
                    <button
                      onClick={() => setDeleteTarget(asset)}
                      className="btn btn-outline"
                      title={asset.isUsed && !isAdmin ? 'In-Use: Only Admins can force delete' : 'Delete Photo'}
                      style={{
                        fontSize: '0.725rem',
                        padding: '0.3rem 0.5rem',
                        color: 'var(--accent-red, #EF4444)',
                        borderColor: 'var(--border-medium)'
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Photo Modal with Caption & Credit Input */}
      {isUploadModalOpen && (
        <div className="admin-modal-overlay" style={{ zIndex: 1000 }}>
          <div className="admin-modal-dialog" style={{ maxWidth: '620px', width: '95%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Upload size={18} color="var(--accent-blue)" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '900', textTransform: 'uppercase' }}>
                  Upload Newsroom Photo
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setUploadFile(null);
                  setUploadPreview('');
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitUpload} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Image Preview */}
              {uploadPreview && (
                <div style={{
                  height: '180px',
                  background: 'var(--bg-secondary)',
                  borderRadius: '4px',
                  border: '1px solid var(--border-medium)',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <img src={uploadPreview} alt="Upload preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                </div>
              )}

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-subtle)', display: 'block', marginBottom: '0.25rem' }}>
                  Photo Caption (Description of Event / Subject)
                </label>
                <input
                  type="text"
                  value={uploadCaption}
                  onChange={(e) => setUploadCaption(e.target.value)}
                  placeholder="e.g. Finance Minister presenting Union Budget in Parliament"
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.65rem',
                    fontSize: '0.825rem',
                    background: 'var(--bg-main)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: '4px',
                    color: 'var(--text-main)'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-subtle)', display: 'block', marginBottom: '0.25rem' }}>
                  Photo Source / Credit (Agency or Staff Name)
                </label>
                <input
                  type="text"
                  value={uploadCredit}
                  onChange={(e) => setUploadCredit(e.target.value)}
                  placeholder="e.g. PTI / Reuters / Staff Photo"
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.65rem',
                    fontSize: '0.825rem',
                    background: 'var(--bg-main)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: '4px',
                    color: 'var(--text-main)',
                    marginBottom: '0.4rem'
                  }}
                />

                {/* Quick Agency Presets */}
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', alignSelf: 'center' }}>Presets:</span>
                  {NEWS_AGENCY_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setUploadCredit(preset)}
                      style={{
                        fontSize: '0.7rem',
                        padding: '0.15rem 0.45rem',
                        borderRadius: '3px',
                        border: '1px solid var(--border-medium)',
                        background: uploadCredit === preset ? 'var(--accent-blue)' : 'var(--bg-secondary)',
                        color: uploadCredit === preset ? '#fff' : 'var(--text-main)',
                        cursor: 'pointer'
                      }}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-subtle)', display: 'block', marginBottom: '0.25rem' }}>
                  Alt Text (SEO & Accessibility)
                </label>
                <input
                  type="text"
                  value={uploadAltText}
                  onChange={(e) => setUploadAltText(e.target.value)}
                  placeholder="Clear short visual description for screen readers"
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.65rem',
                    fontSize: '0.825rem',
                    background: 'var(--bg-main)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: '4px',
                    color: 'var(--text-main)'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsUploadModalOpen(false);
                    setUploadFile(null);
                    setUploadPreview('');
                  }}
                  className="btn btn-outline"
                  style={{ fontSize: '0.825rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="btn btn-primary"
                  style={{ fontSize: '0.825rem', fontWeight: '800' }}
                >
                  {uploading ? (uploadStatus || 'Uploading...') : 'Save to Media Library'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inspect & Edit Lightbox Modal */}
      {inspectAsset && (
        <div className="admin-modal-overlay" style={{ zIndex: 999 }}>
          <div className="admin-modal-dialog" style={{ maxWidth: '820px', width: '95%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ImageIcon size={18} color="var(--accent-blue)" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '900', textTransform: 'uppercase' }}>
                  {isReporter ? 'Media Asset Details' : 'Edit Media Asset & Attribution'}
                </h3>
              </div>
              <button
                onClick={() => setInspectAsset(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
              {/* Photo Display */}
              <div>
                <div style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  textAlign: 'center',
                  maxHeight: '360px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <img
                    src={inspectAsset.url}
                    alt={inspectAsset.caption || inspectAsset.fileName}
                    style={{ maxWidth: '100%', maxHeight: '360px', objectFit: 'contain' }}
                  />
                </div>
                <div style={{ marginTop: '0.65rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                  <button
                    onClick={() => handleCopyUrl(inspectAsset.url)}
                    className="btn btn-outline"
                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <Copy size={13} />
                    <span>Copy URL</span>
                  </button>
                  <a
                    href={inspectAsset.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline"
                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <ExternalLink size={13} />
                    <span>Open Fullscreen</span>
                  </a>
                </div>
              </div>

              {/* Metadata Details & Edit Form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
                  <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
                    <tbody>
                      <tr>
                        <td style={{ fontWeight: '800', color: 'var(--text-subtle)', paddingBottom: '0.35rem', width: '100px' }}>File Name:</td>
                        <td style={{ fontWeight: '700', color: 'var(--text-main)', paddingBottom: '0.35rem', wordBreak: 'break-all' }}>{inspectAsset.fileName}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: '800', color: 'var(--text-subtle)', paddingBottom: '0.35rem' }}>Disk Size:</td>
                        <td style={{ fontWeight: '700', color: 'var(--text-main)', paddingBottom: '0.35rem' }}>{inspectAsset.sizeKb} KB ({formatFileSize(inspectAsset.sizeBytes)})</td>
                      </tr>
                      {inspectAsset.width && inspectAsset.height && (
                        <tr>
                          <td style={{ fontWeight: '800', color: 'var(--text-subtle)', paddingBottom: '0.35rem' }}>Dimensions:</td>
                          <td style={{ fontWeight: '700', color: 'var(--text-main)', paddingBottom: '0.35rem' }}>{inspectAsset.width} × {inspectAsset.height} px</td>
                        </tr>
                      )}
                      <tr>
                        <td style={{ fontWeight: '800', color: 'var(--text-subtle)', paddingBottom: '0.35rem' }}>Uploaded:</td>
                        <td style={{ fontWeight: '700', color: 'var(--text-main)', paddingBottom: '0.35rem' }}>{formatMediaDate(inspectAsset.uploadedAt)}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: '800', color: 'var(--text-subtle)' }}>Usage State:</td>
                        <td style={{ fontWeight: '700', color: inspectAsset.isUsed ? 'var(--accent-blue)' : 'var(--text-subtle)' }}>
                          {inspectAsset.usedInArticles?.length > 0 ? `Used in ${inspectAsset.usedInArticles.length} Stories` : 'Unused'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Reporter RBAC Notice */}
                {isReporter && (
                  <div style={{
                    padding: '0.5rem 0.75rem',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    color: 'var(--text-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}>
                    <Info size={14} color="var(--accent-blue)" />
                    <span>Editorial Gate: Reporters can view photo metadata. Only Editors and Admins can modify captions or agency credits.</span>
                  </div>
                )}

                {/* Editable Caption & Credit Form */}
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-subtle)', display: 'block', marginBottom: '0.25rem' }}>
                    Photo Caption (Editorial Description)
                  </label>
                  <input
                    type="text"
                    value={editCaption}
                    disabled={isReporter}
                    onChange={(e) => setEditCaption(e.target.value)}
                    placeholder="Enter editorial description of photo..."
                    style={{
                      width: '100%',
                      padding: '0.45rem 0.65rem',
                      fontSize: '0.825rem',
                      background: 'var(--bg-main)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: '4px',
                      color: 'var(--text-main)',
                      marginBottom: '0.5rem',
                      opacity: isReporter ? 0.75 : 1
                    }}
                  />

                  <label style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-subtle)', display: 'block', marginBottom: '0.25rem' }}>
                    Media Credit / Agency Source
                  </label>
                  <input
                    type="text"
                    value={editCredit}
                    disabled={isReporter}
                    onChange={(e) => setEditCredit(e.target.value)}
                    placeholder="e.g. PTI / Reuters / Staff Photo"
                    style={{
                      width: '100%',
                      padding: '0.45rem 0.65rem',
                      fontSize: '0.825rem',
                      background: 'var(--bg-main)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: '4px',
                      color: 'var(--text-main)',
                      marginBottom: '0.35rem',
                      opacity: isReporter ? 0.75 : 1
                    }}
                  />

                  {/* Agency Presets */}
                  {!isReporter && (
                    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.65rem' }}>
                      {NEWS_AGENCY_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setEditCredit(preset)}
                          style={{
                            fontSize: '0.675rem',
                            padding: '0.12rem 0.4rem',
                            borderRadius: '3px',
                            border: '1px solid var(--border-medium)',
                            background: editCredit === preset ? 'var(--accent-blue)' : 'var(--bg-secondary)',
                            color: editCredit === preset ? '#fff' : 'var(--text-main)',
                            cursor: 'pointer'
                          }}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  )}

                  <label style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-subtle)', display: 'block', marginBottom: '0.25rem' }}>
                    Alt Text (Accessibility & SEO)
                  </label>
                  <input
                    type="text"
                    value={editAltText}
                    disabled={isReporter}
                    onChange={(e) => setEditAltText(e.target.value)}
                    placeholder="Short description for screen readers & search engines"
                    style={{
                      width: '100%',
                      padding: '0.45rem 0.65rem',
                      fontSize: '0.825rem',
                      background: 'var(--bg-main)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: '4px',
                      color: 'var(--text-main)',
                      marginBottom: '0.75rem',
                      opacity: isReporter ? 0.75 : 1
                    }}
                  />

                  {isEditor && (
                    <button
                      onClick={handleSaveMetadata}
                      disabled={savingMetadata}
                      className="btn btn-outline"
                      style={{ fontSize: '0.78rem', padding: '0.4rem 0.85rem', fontWeight: '800' }}
                    >
                      {savingMetadata ? 'Saving...' : 'Save Caption & Credits'}
                    </button>
                  )}
                </div>

                {/* Linked Stories Panel */}
                {inspectAsset.usedInArticles && inspectAsset.usedInArticles.length > 0 && (
                  <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.65rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-subtle)', marginBottom: '0.4rem' }}>
                      Active Stories Using This Asset ({inspectAsset.usedInArticles.length}):
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '120px', overflowY: 'auto' }}>
                      {inspectAsset.usedInArticles.map((art) => (
                        <div
                          key={art.id}
                          style={{
                            padding: '0.4rem 0.6rem',
                            background: 'var(--bg-secondary)',
                            borderRadius: '3px',
                            border: '1px solid var(--border-light)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-main)' }}>
                            {art.title}
                          </span>
                          <span style={{
                            fontSize: '0.65rem',
                            padding: '0.1rem 0.35rem',
                            borderRadius: '3px',
                            background: art.status === 'published' ? 'var(--accent-green, #10B981)' : 'var(--bg-main)',
                            color: art.status === 'published' ? '#fff' : 'var(--text-subtle)',
                            fontWeight: '800'
                          }}>
                            {art.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Safety Confirmation Modal */}
      {deleteTarget && (
        <div className="admin-modal-overlay" style={{ zIndex: 1000 }}>
          <div className="admin-modal-dialog" style={{ maxWidth: '520px', width: '92%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <AlertTriangle size={20} color="var(--accent-red, #EF4444)" />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '900', textTransform: 'uppercase', color: 'var(--accent-red, #EF4444)' }}>
                {deleteTarget.hasConflict ? 'Active Story Conflict' : 'Confirm Media Deletion'}
              </h3>
            </div>

            <p style={{ fontSize: '0.825rem', color: 'var(--text-main)', margin: '0 0 1rem 0', lineHeight: '1.45' }}>
              Are you sure you want to permanently delete <code style={{ fontWeight: '800' }}>{deleteTarget.fileName}</code> from the uploads directory?
            </p>

            {deleteTarget.hasConflict && (
              <div style={{
                background: '#FEF2F2',
                border: '1px solid #F87171',
                padding: '0.75rem',
                borderRadius: '4px',
                marginBottom: '1rem',
                color: '#991B1B',
                fontSize: '0.8rem'
              }}>
                <div style={{ fontWeight: '800', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <ShieldAlert size={15} />
                  <span>Safety Guard: Photo is currently active in {deleteTarget.usedInArticles?.length || 0} news stories:</span>
                </div>
                <div style={{ maxHeight: '90px', overflowY: 'auto', marginBottom: '0.5rem' }}>
                  {deleteTarget.usedInArticles?.map(a => (
                    <div key={a.id} style={{ fontSize: '0.75rem' }}>• {a.title} ({a.status})</div>
                  ))}
                </div>

                {!isAdmin ? (
                  <div style={{ fontWeight: '800', color: '#991B1B', marginTop: '0.4rem', borderTop: '1px solid #FCA5A5', paddingTop: '0.4rem' }}>
                    Administrative Gate: Editors can only delete unused media. Only Newsroom Administrators can force-delete in-use media assets.
                  </div>
                ) : (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: '800', marginTop: '0.4rem' }}>
                    <input
                      type="checkbox"
                      checked={forceDeleteChecked}
                      onChange={(e) => setForceDeleteChecked(e.target.checked)}
                    />
                    <span>Administrator Override: Force delete photo (stories will lose cover image).</span>
                  </label>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button
                onClick={() => {
                  setDeleteTarget(null);
                  setForceDeleteChecked(false);
                }}
                className="btn btn-outline"
                style={{ fontSize: '0.825rem' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteTarget.hasConflict && (!isAdmin || !forceDeleteChecked)}
                className="btn btn-danger"
                style={{
                  fontSize: '0.825rem',
                  opacity: deleteTarget.hasConflict && (!isAdmin || !forceDeleteChecked) ? 0.45 : 1,
                  cursor: deleteTarget.hasConflict && (!isAdmin || !forceDeleteChecked) ? 'not-allowed' : 'pointer',
                  background: 'var(--accent-red, #EF4444)',
                  color: '#fff',
                  border: 'none',
                  padding: '0.45rem 1rem',
                  borderRadius: '4px',
                  fontWeight: '800'
                }}
              >
                {deleteTarget.hasConflict ? 'Force Delete' : 'Delete File'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
