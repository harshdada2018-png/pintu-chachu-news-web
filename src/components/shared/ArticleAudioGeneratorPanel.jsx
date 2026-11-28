import React, { useState, useEffect, useCallback } from 'react';
import {
  Volume2, Sparkles, CheckCircle2, AlertCircle, Loader2,
  RefreshCw, Play, Square, Database, Languages
} from 'lucide-react';
import {
  fetchArticleAudioStatus,
  runSequentialArticleAudioPipeline
} from '../../services/cloudAudioService';

const INITIAL_STEPS = [
  {
    id: 'warm',
    label: 'Step 1: Wake & Verify Audio Compression Worker',
    status: 'pending',
    detail: 'Render FFmpeg libopus (32 kbps WebM) / local worker check'
  },
  {
    id: 'translate_hi',
    label: 'Step 2: Hindi (HI) Translation -> Backend Cache',
    status: 'pending',
    detail: 'Saves Hindi headline, summary & body in backend D1 cache'
  },
  {
    id: 'audio_hi',
    label: 'Step 3: Hindi (HI) Audio -> WebM Compress -> D1 (HI)',
    status: 'pending',
    detail: 'Synthesizes HI voice, compresses via FFmpeg & stores in DB_AUDIO_HI'
  },
  {
    id: 'translate_en',
    label: 'Step 4: English (EN) Translation -> Backend Cache',
    status: 'pending',
    detail: 'Saves English headline, summary & body in backend D1 cache'
  },
  {
    id: 'audio_en',
    label: 'Step 5: English (EN) Audio -> WebM Compress -> D1 (EN)',
    status: 'pending',
    detail: 'Synthesizes EN voice, compresses via FFmpeg & stores in DB_AUDIO_EN'
  }
];

function formatKb(bytes) {
  const n = Number(bytes || 0);
  if (!n) return '0 KB';
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  return `${(n / 1024).toFixed(1)} KB`;
}

function getMimeShortLabel(mimeType) {
  const m = String(mimeType || '').toLowerCase();
  if (m.includes('webm')) return 'WebM';
  if (m.includes('mpeg') || m.includes('mp3')) return 'MP3';
  if (m.includes('ogg')) return 'OGG';
  return 'WAV';
}

export default function ArticleAudioGeneratorPanel({
  article,
  compact = false,
  disabled = false,
  onAudioGenerated
}) {
  const articleId = article?.id ? String(article.id) : '';
  const [prevArticleId, setPrevArticleId] = useState(articleId);
  const [statusData, setStatusData] = useState(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState(() => INITIAL_STEPS.map((s) => ({ ...s })));
  const [pipelineError, setPipelineError] = useState('');
  const [pipelineSuccessMsg, setPipelineSuccessMsg] = useState('');
  const [previewLang, setPreviewLang] = useState(null);
  const [previewStamp, setPreviewStamp] = useState(0);

  if (prevArticleId !== articleId) {
    setPrevArticleId(articleId);
    setStatusData(null);
    setSteps(INITIAL_STEPS.map((s) => ({ ...s })));
    setPipelineError('');
    setPipelineSuccessMsg('');
    setPreviewLang(null);
  }

  const loadStatus = useCallback(async () => {
    if (!articleId) return;
    setIsLoadingStatus(true);
    try {
      const data = await fetchArticleAudioStatus(articleId);
      if (data && data.success) {
        setStatusData(data);
      }
    } finally {
      setIsLoadingStatus(false);
    }
  }, [articleId]);

  useEffect(() => {
    let cancelled = false;
    if (!articleId) return () => { cancelled = true; };

    fetchArticleAudioStatus(articleId).then((data) => {
      if (!cancelled && data && data.success) {
        setStatusData(data);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [articleId]);

  const handleTogglePreview = (lang) => {
    if (previewLang === lang) {
      setPreviewLang(null);
    } else {
      setPreviewLang(lang);
      setPreviewStamp(Date.now());
    }
  };

  const handleGenerate = async (forceRegenerate = false) => {
    if (!articleId || isRunning || disabled) return;
    setIsRunning(true);
    setPipelineError('');
    setPipelineSuccessMsg('');
    setPreviewLang(null);

    try {
      const result = await runSequentialArticleAudioPipeline({
        articleId,
        article,
        forceRegenerate,
        onStepUpdate: ({ steps: updatedSteps }) => {
          setSteps(updatedSteps.map((s) => ({ ...s })));
        }
      });

      if (result.success) {
        const hiSize = formatKb(result.hi?.size_bytes);
        const enSize = formatKb(result.en?.size_bytes);
        setPipelineSuccessMsg(
          `Completed 1-by-1: HI (${hiSize} ${getMimeShortLabel(result.hi?.mime_type)}) & EN (${enSize} ${getMimeShortLabel(result.en?.mime_type)}) cached in D1 shards.`
        );
        setPreviewStamp(Date.now());
        await loadStatus();
        if (onAudioGenerated) {
          onAudioGenerated(result);
        }
      } else {
        setPipelineError(result.error || 'Sequential audio generation stopped cleanly.');
        await loadStatus();
      }
    } catch (err) {
      setPipelineError(err.message || 'Audio pipeline error');
    } finally {
      setIsRunning(false);
    }
  };

  if (!articleId) return null;

  const hiReady = Boolean(statusData?.hi?.cached);
  const enReady = Boolean(statusData?.en?.cached);
  const bothReady = hiReady && enReady;
  const sanitizedId = articleId.replace(/[^a-zA-Z0-9-_]/g, '_');

  const previewRawUrl = previewLang
    ? (statusData?.[previewLang]?.audioUrl || `/api/tts/audio/${sanitizedId}_${previewLang}_full_story`)
    : '';
  const previewSrc = previewRawUrl
    ? `${previewRawUrl}${previewRawUrl.includes('?') ? '&' : '?'}t=${previewStamp}`
    : '';

  return (
    <div
      style={{
        marginBottom: compact ? '0.25rem' : '1.5rem',
        background: 'var(--bg-secondary, #F8FAFC)',
        border: '1px solid var(--border-medium, #CBD5E1)',
        borderRadius: 'var(--radius-sm)',
        padding: compact ? '0.85rem' : 'clamp(0.85rem, 2vw, 1.1rem)',
        minWidth: 0,
        boxSizing: 'border-box'
      }}
    >
      {/* Header Row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.75rem',
          flexWrap: 'wrap',
          borderBottom: '1px solid var(--border-light, #E2E8F0)',
          paddingBottom: '0.65rem',
          marginBottom: '0.75rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
          <Volume2 size={18} color="var(--accent-blue, #0E2A47)" style={{ flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <h4
              style={{
                margin: 0,
                fontSize: '0.9rem',
                fontWeight: '900',
                color: 'var(--text-main, #0F172A)',
                textTransform: 'uppercase',
                letterSpacing: '0.02em'
              }}
            >
              Article Audio Generator (HI + EN)
            </h4>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-subtle, #475569)', marginTop: '0.15rem' }}>
              {statusData?.renderConfigured
                ? 'Render FFmpeg 16 kbps WebM Opus Compression Active'
                : 'Edge / Local Node Sequential Pipeline Ready'}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={loadStatus}
          disabled={isLoadingStatus || isRunning}
          className="btn btn-outline"
          title="Refresh D1 Audio Cache Status"
          style={{
            minHeight: '36px',
            minWidth: '36px',
            padding: '0.35rem 0.65rem',
            fontSize: '0.75rem',
            fontWeight: '700',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem'
          }}
        >
          <RefreshCw size={14} className={isLoadingStatus ? 'spin-animation' : ''} />
          <span>Status</span>
        </button>
      </div>

      {/* Shard & Translation Status Badges */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))',
          gap: '0.6rem',
          marginBottom: '0.85rem'
        }}
      >
        {/* HI Audio Status Box */}
        <div
          style={{
            background: 'var(--bg-surface, #FFFFFF)',
            border: `1px solid ${hiReady ? '#86EFAC' : 'var(--border-light, #E2E8F0)'}`,
            borderRadius: '4px',
            padding: '0.6rem 0.75rem',
            minWidth: 0
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: '800', color: 'var(--text-main, #0F172A)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              <Languages size={13} color="var(--accent-blue, #0E2A47)" /> Hindi (HI) Audio
            </span>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: '800',
                padding: '0.12rem 0.45rem',
                borderRadius: '999px',
                background: hiReady ? '#DCFCE7' : '#FEF3C7',
                color: hiReady ? '#166534' : '#92400E'
              }}
            >
              {hiReady ? 'READY IN D1' : 'NOT CACHED'}
            </span>
          </div>
          <div style={{ fontSize: '0.73rem', color: 'var(--text-subtle, #475569)', marginTop: '0.35rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <Database size={11} />
              {hiReady
                ? `${formatKb(statusData.hi.sizeBytes)} · ${getMimeShortLabel(statusData.hi.mimeType)} · ${statusData.hi.shard || 'DB_AUDIO_HI'}`
                : `${statusData?.translations?.hiCached ? 'Text Cached · ' : ''}Target: ${statusData?.hi?.shard || 'DB_AUDIO_HI'}`}
            </span>
            {hiReady && (
              <button
                type="button"
                onClick={() => handleTogglePreview('hi')}
                style={{
                  minHeight: '32px',
                  padding: '0.15rem 0.5rem',
                  fontSize: '0.72rem',
                  fontWeight: '800',
                  borderRadius: '4px',
                  border: '1px solid var(--accent-blue, #0E2A47)',
                  background: previewLang === 'hi' ? 'var(--accent-blue, #0E2A47)' : 'var(--bg-surface, #FFFFFF)',
                  color: previewLang === 'hi' ? '#FFFFFF' : 'var(--accent-blue, #0E2A47)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}
              >
                {previewLang === 'hi' ? <Square size={10} /> : <Play size={10} />}
                <span>{previewLang === 'hi' ? 'Close' : 'Preview'}</span>
              </button>
            )}
          </div>
        </div>

        {/* EN Audio Status Box */}
        <div
          style={{
            background: 'var(--bg-surface, #FFFFFF)',
            border: `1px solid ${enReady ? '#86EFAC' : 'var(--border-light, #E2E8F0)'}`,
            borderRadius: '4px',
            padding: '0.6rem 0.75rem',
            minWidth: 0
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: '800', color: 'var(--text-main, #0F172A)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              <Languages size={13} color="var(--accent-blue, #0E2A47)" /> English (EN) Audio
            </span>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: '800',
                padding: '0.12rem 0.45rem',
                borderRadius: '999px',
                background: enReady ? '#DCFCE7' : '#FEF3C7',
                color: enReady ? '#166534' : '#92400E'
              }}
            >
              {enReady ? 'READY IN D1' : 'NOT CACHED'}
            </span>
          </div>
          <div style={{ fontSize: '0.73rem', color: 'var(--text-subtle, #475569)', marginTop: '0.35rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <Database size={11} />
              {enReady
                ? `${formatKb(statusData.en.sizeBytes)} · ${getMimeShortLabel(statusData.en.mimeType)} · ${statusData.en.shard || 'DB_AUDIO_EN'}`
                : `${statusData?.translations?.enCached ? 'Text Cached · ' : ''}Target: ${statusData?.en?.shard || 'DB_AUDIO_EN'}`}
            </span>
            {enReady && (
              <button
                type="button"
                onClick={() => handleTogglePreview('en')}
                style={{
                  minHeight: '32px',
                  padding: '0.15rem 0.5rem',
                  fontSize: '0.72rem',
                  fontWeight: '800',
                  borderRadius: '4px',
                  border: '1px solid var(--accent-blue, #0E2A47)',
                  background: previewLang === 'en' ? 'var(--accent-blue, #0E2A47)' : 'var(--bg-surface, #FFFFFF)',
                  color: previewLang === 'en' ? '#FFFFFF' : 'var(--accent-blue, #0E2A47)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}
              >
                {previewLang === 'en' ? <Square size={10} /> : <Play size={10} />}
                <span>{previewLang === 'en' ? 'Close' : 'Preview'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Inline Cached Audio Preview Player */}
      {previewLang && previewSrc && (
        <div
          style={{
            marginBottom: '0.85rem',
            padding: '0.55rem 0.75rem',
            background: 'var(--bg-surface, #FFFFFF)',
            border: '1px solid var(--border-medium, #CBD5E1)',
            borderRadius: '4px'
          }}
        >
          <div style={{ fontSize: '0.74rem', fontWeight: '800', color: 'var(--text-main, #0E2A47)', marginBottom: '0.35rem' }}>
            Cached Preview: {previewLang.toUpperCase()} Full Story
          </div>
          <audio
            key={`${sanitizedId}_${previewLang}_${previewStamp}`}
            controls
            autoPlay
            preload="none"
            src={previewSrc}
            style={{ width: '100%', height: '38px' }}
          />
        </div>
      )}

      {/* Primary Action Controls */}
      <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => handleGenerate(false)}
          disabled={isRunning || disabled}
          className="btn btn-primary"
          style={{
            minHeight: '44px',
            padding: '0.55rem 1.15rem',
            backgroundColor: bothReady ? '#0F766E' : '#0E2A47',
            borderColor: bothReady ? '#0F766E' : '#0E2A47',
            color: '#FFFFFF',
            fontWeight: '800',
            fontSize: '0.84rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            opacity: (isRunning || disabled) ? 0.7 : 1,
            cursor: (isRunning || disabled) ? 'not-allowed' : 'pointer'
          }}
        >
          {isRunning ? <Loader2 size={16} className="spin-animation" /> : <Sparkles size={16} />}
          <span>
            {isRunning
              ? 'Generating 1-by-1 (HI -> EN)...'
              : (bothReady ? 'Re-verify Cached Audio (HI + EN)' : 'Generate Audio (HI + EN)')}
          </span>
        </button>

        {bothReady && !isRunning && (
          <button
            type="button"
            onClick={() => handleGenerate(true)}
            disabled={disabled}
            className="btn btn-outline"
            style={{
              minHeight: '44px',
              padding: '0.55rem 0.95rem',
              fontWeight: '700',
              fontSize: '0.8rem',
              borderColor: 'var(--accent-crimson, #991B1B)',
              color: 'var(--accent-crimson, #991B1B)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <RefreshCw size={14} />
            <span>Force Regenerate Both</span>
          </button>
        )}
      </div>

      {/* Sequential 1-by-1 Step Progress List */}
      <div
        style={{
          marginTop: '0.85rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem'
        }}
      >
        {steps.map((step) => {
          const isStepRunning = step.status === 'running';
          const isStepDone = step.status === 'done';
          const isStepError = step.status === 'error';

          return (
            <div
              key={step.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.55rem',
                padding: '0.45rem 0.65rem',
                borderRadius: '4px',
                background: isStepError
                  ? '#FEF2F2'
                  : isStepDone
                  ? '#F0FDF4'
                  : isStepRunning
                  ? '#EFF6FF'
                  : 'var(--bg-surface, #FFFFFF)',
                border: `1px solid ${
                  isStepError
                    ? '#FECACA'
                    : isStepDone
                    ? '#BBF7D0'
                    : isStepRunning
                    ? '#BFDBFE'
                    : 'var(--border-light, #E2E8F0)'
                }`,
                minWidth: 0
              }}
            >
              <div style={{ paddingTop: '2px', flexShrink: 0 }}>
                {isStepRunning && <Loader2 size={15} color="#1D4ED8" className="spin-animation" />}
                {isStepDone && <CheckCircle2 size={15} color="#15803D" />}
                {isStepError && <AlertCircle size={15} color="#DC2626" />}
                {step.status === 'pending' && (
                  <span
                    style={{
                      display: 'inline-block',
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      border: '2px solid #94A3B8'
                    }}
                  />
                )}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: '800',
                    color: isStepError ? '#991B1B' : isStepDone ? '#166534' : 'var(--text-main, #0F172A)',
                    overflowWrap: 'anywhere'
                  }}
                >
                  {step.label}
                </div>
                <div
                  style={{
                    fontSize: '0.72rem',
                    color: isStepError ? '#B91C1C' : (isStepDone ? '#15803D' : isStepRunning ? '#1E40AF' : 'var(--text-subtle, #475569)'),
                    marginTop: '0.1rem',
                    overflowWrap: 'anywhere'
                  }}
                >
                  {step.detail}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {pipelineSuccessMsg && (
        <div
          style={{
            marginTop: '0.75rem',
            padding: '0.55rem 0.75rem',
            borderRadius: '4px',
            background: '#DCFCE7',
            border: '1px solid #86EFAC',
            color: '#166534',
            fontSize: '0.78rem',
            fontWeight: '700'
          }}
        >
          {pipelineSuccessMsg}
        </div>
      )}

      {pipelineError && (
        <div
          style={{
            marginTop: '0.75rem',
            padding: '0.55rem 0.75rem',
            borderRadius: '4px',
            background: '#FEE2E2',
            border: '1px solid #FCA5A5',
            color: '#991B1B',
            fontSize: '0.78rem',
            fontWeight: '700'
          }}
        >
          {pipelineError}
        </div>
      )}
    </div>
  );
}
