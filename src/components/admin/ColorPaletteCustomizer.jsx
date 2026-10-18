import React, { useState, useMemo, useEffect } from 'react';
import { 
  Palette, 
  Sliders, 
  Check, 
  RotateCcw, 
  Eye, 
  Search, 
  CheckCircle2, 
  Layers,
  ArrowRight
} from 'lucide-react';

export const DEFAULT_THEME_PALETTE = {
  primary: '#121212',
  bgPrimary: '#FBFBF9',
  bgSurface: '#FFFFFF',
  bgSecondary: '#F3F2EE',
  textMain: '#121212',
  textMuted: '#4A4A4A',
  textSubtle: '#737373',
  accentCrimson: '#B81D13',
  accentBlue: '#0D5B8C',
  borderLight: '#E8E6DF',
  borderMedium: '#D5D2C7'
};

export default function ColorPaletteCustomizer({ currentTheme, onSaveTheme }) {
  const [presets, setPresets] = useState([]);
  const [isLoadingPresets, setIsLoadingPresets] = useState(true);
  const [localTheme, setLocalTheme] = useState(() => currentTheme || DEFAULT_THEME_PALETTE);
  const [searchQuery, setSearchQuery] = useState('');
  const [activePresetId, setActivePresetId] = useState('custom');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Fetch presets dynamically from Backend API (Zero hardcoded presets in frontend)
  useEffect(() => {
    fetch('/api/presets')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.themePresets) && data.themePresets.length > 0) {
          setPresets(data.themePresets);
          if (currentTheme) {
            const found = data.themePresets.find(p => p.colors.bgPrimary === currentTheme.bgPrimary && p.colors.primary === currentTheme.primary);
            if (found) setActivePresetId(found.id);
          }
        }
      })
      .catch(err => console.warn('[Backend Presets] Fetch error:', err))
      .finally(() => setIsLoadingPresets(false));
  }, []);

  // Synchronize localTheme with incoming currentTheme prop from backend/parent
  useEffect(() => {
    if (currentTheme) {
      setLocalTheme(currentTheme);
      setHasUnsavedChanges(false);
      if (presets.length > 0) {
        const found = presets.find(
          p => p.colors.bgPrimary === currentTheme.bgPrimary && p.colors.primary === currentTheme.primary
        );
        setActivePresetId(found ? found.id : 'custom');
      }
    }
  }, [currentTheme, presets]);

  const filteredPresets = useMemo(() => {
    if (!searchQuery.trim()) return presets;
    const q = searchQuery.toLowerCase();
    return presets.filter(
      p => p.name.toLowerCase().includes(q) || 
           (p.beat && p.beat.toLowerCase().includes(q)) || 
           (p.description && p.description.toLowerCase().includes(q))
    );
  }, [presets, searchQuery]);

  // Manual selection: updates preview only, does NOT auto-save to backend
  const handleSelectPreset = (preset) => {
    setLocalTheme(preset.colors);
    setActivePresetId(preset.id);
    setHasUnsavedChanges(true);
    setFeedbackMsg(`Previewing "${preset.name}". Click "Save & Apply Palette" to publish.`);
  };

  // Manual custom color change: updates preview only, does NOT auto-save to backend
  const handleCustomColorChange = (key, value) => {
    const updated = { ...localTheme, [key]: value };
    setLocalTheme(updated);
    setActivePresetId('custom');
    setHasUnsavedChanges(true);
  };

  // Manual reset: updates preview only, does NOT auto-save to backend
  const handleResetDefault = () => {
    const def = presets[0] || { colors: DEFAULT_THEME_PALETTE, id: 'broadsheet' };
    setLocalTheme(def.colors);
    setActivePresetId(def.id);
    setHasUnsavedChanges(true);
    setFeedbackMsg('Preview reset to default. Click "Save & Apply Palette" to publish.');
  };

  // Explicit Save & Publish Action
  const handleSaveActiveTheme = () => {
    if (onSaveTheme) {
      onSaveTheme(localTheme);
    }
    setHasUnsavedChanges(false);
    setFeedbackMsg('Color theme saved and published across platform.');
    setTimeout(() => setFeedbackMsg(''), 4000);
  };

  const colorFields = [
    { key: 'primary', label: 'Primary Brand Color', desc: 'Main navigation accent, key interactive elements, and brand identity.' },
    { key: 'bgPrimary', label: 'Canvas / Background', desc: 'Primary background canvas for the entire platform.' },
    { key: 'bgSurface', label: 'Card Surface', desc: 'Background color of news cards, modals, and containers.' },
    { key: 'bgSecondary', label: 'Secondary Surface', desc: 'Section backdrops, sidebars, and input fills.' },
    { key: 'textMain', label: 'Headings & Main Ink', desc: 'Article headlines, titles, and primary reading text.' },
    { key: 'textMuted', label: 'Body Text', desc: 'Article body paragraphs and secondary descriptions.' },
    { key: 'textSubtle', label: 'Metadata & Timestamps', desc: 'Publication dates, author credits, and subtle metrics.' },
    { key: 'accentCrimson', label: 'Breaking News Alert', desc: 'Urgent breaking news banners, live indicators, and critical badges.' },
    { key: 'accentBlue', label: 'Category & Action Links', desc: 'Category tags, external source links, and secondary buttons.' },
    { key: 'borderMedium', label: 'Card Borders & Dividers', desc: 'Structural lines separating stories and layout modules.' }
  ];

  return (
    <div style={{ background: 'var(--bg-surface)', padding: '1.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
      
      {/* Top Header Row with Prominent Save & Reset Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.55rem', margin: 0, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            <Palette size={20} color="var(--accent-indigo)" /> Editorial Color Harmonies & Themes
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-subtle)', marginTop: '0.35rem', lineHeight: 1.5 }}>
            Select from 10 industry-standard editorial color harmonies, or customize individual brand tones with real-time live site preview.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {hasUnsavedChanges && (
            <span style={{
              fontSize: '0.75rem',
              fontWeight: '800',
              padding: '0.35rem 0.65rem',
              borderRadius: '20px',
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#d97706',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}>
              ● Unsaved Changes (Preview Active)
            </span>
          )}
          <button
            type="button"
            onClick={handleSaveActiveTheme}
            className="btn btn-primary"
            style={{
              padding: '0.5rem 1.15rem',
              fontSize: '0.825rem',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              boxShadow: hasUnsavedChanges ? '0 2px 10px rgba(0, 0, 0, 0.2)' : 'none'
            }}
          >
            <Check size={15} /> Save & Apply Palette
          </button>
          <button
            type="button"
            onClick={handleResetDefault}
            className="btn btn-outline"
            style={{ padding: '0.5rem 0.9rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RotateCcw size={14} /> Reset Default
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div style={{ padding: '0.75rem 1rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-emerald)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <CheckCircle2 size={16} /> {feedbackMsg}
        </div>
      )}

      {/* Main 2-Column Suite Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 1.25fr) minmax(360px, 1fr)', gap: '1.75rem', alignItems: 'start' }}>
        
        {/* COLUMN 1: 10 Curated Editorial Color Harmonies */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          <div style={{ background: 'var(--bg-secondary)', padding: '1rem 1.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-subtle)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Curated Harmonies
              </span>
              <div style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--text-main)', marginTop: '0.1rem' }}>
                10 Professional Newsroom Presets
              </div>
            </div>

            <div style={{ position: 'relative', width: '220px' }}>
              <Search size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)' }} />
              <input
                type="text"
                placeholder="Search palettes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.4rem 0.65rem 0.4rem 2rem',
                  fontSize: '0.8rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-medium)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-main)'
                }}
              />
            </div>
          </div>

          {/* Preset Cards List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filteredPresets.map((preset) => {
              const isSelected = activePresetId === preset.id;
              const { primary, bgPrimary, bgSurface, textMain, accentCrimson, accentBlue } = preset.colors;

              return (
                <div
                  key={preset.id}
                  style={{
                    background: isSelected ? 'var(--bg-surface)' : 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-sm)',
                    border: isSelected ? '2px solid var(--accent-indigo)' : '1px solid var(--border-medium)',
                    padding: '1.1rem 1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    boxShadow: isSelected ? '0 4px 16px rgba(0, 0, 0, 0.08)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: '800', fontSize: '0.95rem', color: 'var(--text-main)' }}>
                          {preset.name}
                        </span>
                        {isSelected && (
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: '800',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '12px',
                            background: 'var(--accent-indigo)',
                            color: '#FFFFFF',
                            letterSpacing: '0.04em'
                          }}>
                            ACTIVE
                          </span>
                        )}
                      </div>
                      {preset.beat && (
                        <div style={{
                          display: 'inline-block',
                          fontSize: '0.68rem',
                          fontWeight: '700',
                          color: 'var(--text-subtle)',
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border-light)',
                          padding: '0.12rem 0.45rem',
                          borderRadius: '4px',
                          marginTop: '0.25rem',
                          letterSpacing: '0.03em',
                          textTransform: 'uppercase'
                        }}>
                          {preset.beat}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className={`btn ${isSelected ? 'btn-primary' : 'btn-outline'}`}
                      style={{
                        padding: '0.4rem 0.85rem',
                        fontSize: '0.78rem',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {isSelected ? <Check size={13} /> : <ArrowRight size={13} />}
                      {isSelected ? 'Applied' : 'Apply Palette'}
                    </button>
                  </div>

                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.45 }}>
                    {preset.description}
                  </p>

                  {/* Visual Color Chips Row */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: 'var(--bg-surface)',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-light)'
                  }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-subtle)', marginRight: '0.25rem', textTransform: 'uppercase' }}>
                      Swatches:
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <div title={`Primary: ${primary}`} style={{ width: '22px', height: '22px', borderRadius: '4px', background: primary, border: '1px solid rgba(0,0,0,0.1)' }} />
                      <div title={`Canvas: ${bgPrimary}`} style={{ width: '22px', height: '22px', borderRadius: '4px', background: bgPrimary, border: '1px solid rgba(0,0,0,0.15)' }} />
                      <div title={`Surface: ${bgSurface}`} style={{ width: '22px', height: '22px', borderRadius: '4px', background: bgSurface, border: '1px solid rgba(0,0,0,0.15)' }} />
                      <div title={`Ink: ${textMain}`} style={{ width: '22px', height: '22px', borderRadius: '4px', background: textMain, border: '1px solid rgba(0,0,0,0.1)' }} />
                      <div title={`Breaking: ${accentCrimson}`} style={{ width: '22px', height: '22px', borderRadius: '4px', background: accentCrimson, border: '1px solid rgba(0,0,0,0.1)' }} />
                      <div title={`Accent: ${accentBlue}`} style={{ width: '22px', height: '22px', borderRadius: '4px', background: accentBlue, border: '1px solid rgba(0,0,0,0.1)' }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* COLUMN 2: Custom Color Controls & Sticky Real-Time Live Preview Desk */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'sticky', top: '1rem' }}>
          
          {/* Section A: Live Preview Desk */}
          <div style={{
            background: 'var(--bg-secondary)',
            padding: '1.25rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-medium)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <Eye size={15} color="var(--accent-indigo)" /> Real-Time Live Preview
              </div>
              <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-subtle)' }}>
                {activePresetId === 'custom' ? 'Custom Configuration' : (presets.find(p => p.id === activePresetId)?.name || 'Custom Palette')}
              </span>
            </div>

            {/* Miniature News Website Simulation Container */}
            <div style={{
              background: localTheme.bgPrimary,
              borderRadius: '8px',
              border: `1px solid ${localTheme.borderMedium}`,
              overflow: 'hidden',
              boxShadow: '0 4px 14px rgba(0,0,0,0.06)'
            }}>
              {/* Simulated Header */}
              <div style={{
                background: localTheme.bgSurface,
                borderBottom: `1px solid ${localTheme.borderLight}`,
                padding: '0.65rem 0.9rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: localTheme.primary }} />
                  <span style={{ fontWeight: '900', fontSize: '0.85rem', color: localTheme.textMain, letterSpacing: '-0.02em' }}>
                    PUBLICSPARK
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.65rem', fontSize: '0.68rem', fontWeight: '700', color: localTheme.textSubtle }}>
                  <span>National</span>
                  <span>Economy</span>
                  <span>Technology</span>
                </div>
              </div>

              {/* Simulated Breaking News Strip */}
              <div style={{
                background: localTheme.accentCrimson,
                color: '#FFFFFF',
                padding: '0.35rem 0.9rem',
                fontSize: '0.68rem',
                fontWeight: '800',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                letterSpacing: '0.02em'
              }}>
                <span style={{ background: 'rgba(0,0,0,0.25)', padding: '0.1rem 0.35rem', borderRadius: '3px', textTransform: 'uppercase' }}>
                  BREAKING
                </span>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Headline Alert: Markets open higher following economic reform announcement.
                </span>
              </div>

              {/* Simulated Main Story Card */}
              <div style={{ padding: '0.9rem' }}>
                <div style={{
                  background: localTheme.bgSurface,
                  borderRadius: '6px',
                  border: `1px solid ${localTheme.borderLight}`,
                  padding: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '0.64rem',
                      fontWeight: '800',
                      color: localTheme.accentBlue,
                      background: `${localTheme.accentBlue}18`,
                      padding: '0.15rem 0.45rem',
                      borderRadius: '4px',
                      textTransform: 'uppercase'
                    }}>
                      INVESTIGATION
                    </span>
                    <span style={{ fontSize: '0.65rem', color: localTheme.textSubtle }}>
                      12 MINS AGO
                    </span>
                  </div>

                  <h4 style={{
                    fontSize: '0.95rem',
                    fontWeight: '800',
                    color: localTheme.textMain,
                    margin: 0,
                    lineHeight: 1.35
                  }}>
                    Global Clean Energy Initiative Achieves Historic Milestone in Quarter Three
                  </h4>

                  <p style={{
                    fontSize: '0.76rem',
                    color: localTheme.textMuted,
                    margin: 0,
                    lineHeight: 1.45
                  }}>
                    Comprehensive analysis reveals a remarkable surge in sustainable energy production, setting new benchmarks for public infrastructure.
                  </p>

                  <div style={{
                    borderTop: `1px solid ${localTheme.borderLight}`,
                    paddingTop: '0.45rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.68rem',
                    color: localTheme.textSubtle
                  }}>
                    <span>By Special Correspondent</span>
                    <span style={{ color: localTheme.primary, fontWeight: '700' }}>Read Full Report →</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section B: Custom Color Inputs & Fine-Tuning */}
          <div style={{
            background: 'var(--bg-secondary)',
            padding: '1.25rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-medium)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '1rem' }}>
              <Sliders size={15} color="var(--accent-indigo)" /> Custom Color Fine-Tuning
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {colorFields.map((field) => (
                <div
                  key={field.key}
                  style={{
                    background: 'var(--bg-surface)',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem'
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-main)' }}>
                      {field.label}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', marginTop: '0.1rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {field.desc}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    <input
                      type="text"
                      value={localTheme[field.key] || '#000000'}
                      onChange={(e) => handleCustomColorChange(field.key, e.target.value)}
                      style={{
                        width: '80px',
                        padding: '0.3rem 0.45rem',
                        fontSize: '0.75rem',
                        fontFamily: 'monospace',
                        fontWeight: '700',
                        borderRadius: '4px',
                        border: '1px solid var(--border-medium)',
                        background: 'var(--bg-main)',
                        color: 'var(--text-main)',
                        textAlign: 'center'
                      }}
                    />

                    {/* Native Color Picker Swatch */}
                    <div style={{
                      position: 'relative',
                      width: '32px',
                      height: '32px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-medium)',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      background: localTheme[field.key] || '#000000'
                    }}>
                      <input
                        type="color"
                        value={localTheme[field.key] || '#000000'}
                        onChange={(e) => handleCustomColorChange(field.key, e.target.value)}
                        style={{
                          position: 'absolute',
                          top: '-10px',
                          left: '-10px',
                          width: '50px',
                          height: '50px',
                          cursor: 'pointer',
                          opacity: 0
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleSaveActiveTheme}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '0.875rem',
                fontWeight: '800',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                marginTop: '1.25rem'
              }}
            >
              <Check size={16} /> Save & Apply Palette
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
