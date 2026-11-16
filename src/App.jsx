import React, { useState, useEffect } from 'react';
import Header from './components/common/Header';
import LoadingSplash from './components/common/LoadingSplash';
import ToastNotice from './components/common/ToastNotice';
import ArticleReader from './components/public/ArticleReader';
import ReporterWorkspace from './components/reporter/ReporterWorkspace';
import EditorWorkspace from './components/editor/EditorWorkspace';
import AdminWorkspace from './components/admin/AdminWorkspace';
import SearchPage from './components/public/SearchPage';
import LegalModal from './components/common/LegalModal';
import PartnerUnit from './components/common/PartnerUnit';
import { fetchAdSettings } from './services/monetizationService';
import { MOCK_ARTICLES, MOCK_CATEGORIES } from './services/mockData';
import { getCachedNews, saveNewsToCache, getCachedCategories, saveCategoriesToCache } from './services/cacheService';
import { translateArticle, translateHeadlinesOnly, SUPPORTED_LANGUAGES } from './services/translationService';
import { speakTextWithNaturalVoice, stopAudioSpeech } from './services/speechEngine';
import { DEFAULT_REGIONAL_FONTS } from './components/admin/VisualFontPicker';
import { DEFAULT_THEME_PALETTE } from './components/admin/ColorPaletteCustomizer';
import { t, translateCategoryName } from './services/uiTranslations';
import { getWhatsAppShareUrl } from './services/shareService';
import { getOfflineArticles, removeArticleOffline, syncLegacyBookmarks, getOfflineStorageMetrics } from './services/bookmarkStorageService';
import { calculateReadingTime } from './utils/readingTime';
import { Clock, Eye, Sparkles, TrendingUp, Flame, ShieldCheck, Volume2, Pause, Play, Heart, Bookmark, Send, Share2, BarChart3, Vote, X, VolumeX, ThumbsUp, ThumbsDown, HelpCircle, Newspaper, Check, Radio } from 'lucide-react';

const WhatsAppIcon = ({ size = 18, color = '#ffffff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
  </svg>
);

const InstagramIcon = ({ size = 18, color = '#ffffff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
  </svg>
);

const FacebookIcon = ({ size = 18, color = '#ffffff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
  </svg>
);

const XTwitterIcon = ({ size = 18, color = '#ffffff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

function parseRouteFromUrl() {
  try {
    const pathname = window.location.pathname;
    const search = window.location.search;
    if (pathname.startsWith('/article/')) {
      const slug = decodeURIComponent(pathname.replace(/^\/article\//, '').split('/')[0]);
      if (slug) return { view: 'article', idOrSlug: slug };
    }
    if (pathname.startsWith('/news/')) {
      const slug = decodeURIComponent(pathname.replace(/^\/news\//, '').split('/')[0]);
      if (slug) return { view: 'article', idOrSlug: slug };
    }
    if (search.includes('article=')) {
      const params = new URLSearchParams(search);
      const id = params.get('article');
      if (id) return { view: 'article', idOrSlug: id };
    }
    if (pathname === '/search') return { view: 'search' };
    if (pathname === '/reporter') return { view: 'reporter' };
    if (pathname === '/editor') return { view: 'editor' };
    if (pathname === '/admin') return { view: 'admin' };
  } catch (e) {}
  return { view: 'home' };
}

export default function App() {
  const [theme, setTheme] = useState('light');
  const [isLoading, setIsLoading] = useState(false);

  // Failsafe Watchdog: Ensure loading screen NEVER stays for more than 1.5 seconds
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      setIsLoading(false);
      try { sessionStorage.setItem('ps_splash_shown', 'true'); } catch (e) {}
    }, 1500);
    return () => clearTimeout(safetyTimer);
  }, []);
  const [currentRole, setCurrentRole] = useState('visitor'); // visitor | reporter | editor | admin
  const [activeView, setActiveView] = useState(() => parseRouteFromUrl().view); // home | article | reporter | editor | admin | search
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedArticle, setSelectedArticle] = useState(() => {
    const route = parseRouteFromUrl();
    if (route.view === 'article' && route.idOrSlug) {
      const cached = getCachedNews();
      const articles = cached?.articles || MOCK_ARTICLES;
      return articles.find(a => a.id === route.idOrSlug || a.slug === route.idOrSlug) || null;
    }
    return null;
  });

  // Mandatory 5 Legal Pages Modal for Google AdSense Compliance
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState('privacy');

  // Multi-Language State (Default: Hindi 'hi')
  const [currentLanguage, setCurrentLanguage] = useState('hi');
  const [isTranslating, setIsTranslating] = useState(false);

  // Floating Audio Player State
  const [playingArticleId, setPlayingArticleId] = useState(null);
  const [playingArticle, setPlayingArticle] = useState(null);

  // Live Daily Reader Poll State (Managed via Admin Desk & Backend Synced)
  const [pollData, setPollData] = useState({
    enabled: false,
    id: 'poll-default-v1',
    question: 'क्या आप मानते हैं कि AI न्यूज़ रीडर डिजिटल पत्रकारिता की गति और विश्वसनीयता को बढ़ाते हैं?',
    options: [
      { id: 'opt-1', label: 'हाँ, बिल्कुल (Yes, absolutely)', votes: 1420 },
      { id: 'opt-2', label: 'नहीं, मानवीय संपादक ज़रूरी हैं (No, human editors are vital)', votes: 410 },
      { id: 'opt-3', label: 'तटस्थ / अनिश्चित (Neutral / Unsure)', votes: 121 }
    ],
    totalVotes: 1951
  });
  const [userVotedChoice, setUserVotedChoice] = useState(null);

  // Fetch active poll on mount
  useEffect(() => {
    fetch('/api/poll')
      .then(res => res.json())
      .then(data => {
        if (data) {
          setPollData(prev => ({
            ...prev,
            ...data,
            enabled: Boolean(data.enabled && data.question)
          }));
          if (data.id) {
            const savedVote = localStorage.getItem(`ps_news_poll_vote_${data.id}`);
            if (savedVote) {
              setUserVotedChoice(savedVote);
            }
          }
        }
      })
      .catch(err => console.warn('[Poll] Fallback to default:', err));
  }, []);

  const handlePollVote = async (optionId) => {
    if (userVotedChoice || !pollData || !pollData.enabled) return;

    setUserVotedChoice(optionId);
    if (pollData.id) {
      localStorage.setItem(`ps_news_poll_vote_${pollData.id}`, optionId);
    }

    setToastMessage(`${t('voteRecorded', currentLanguage)} - ${t('dailyReaderPoll', currentLanguage)}`);
    setIsToastOpen(true);

    try {
      const res = await fetch('/api/poll/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionId })
      });
      const data = await res.json();
      if (data && data.poll) {
        setPollData(data.poll);
      }
    } catch (err) {
      console.warn('[Poll Vote] Sync error:', err);
    }
  };

  // Toast & Bookmark State
  const [toastMessage, setToastMessage] = useState('');
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [bookmarkRefresh, setBookmarkRefresh] = useState(0);

  // Dynamic Configurable Social Channel URLs
  const DEFAULT_SOCIAL_LINKS = {
    whatsapp: 'https://whatsapp.com',
    instagram: 'https://instagram.com',
    facebook: 'https://facebook.com',
    twitter: 'https://x.com'
  };

  const DEFAULT_TYPOGRAPHY = {
    headingFont: 'Playfair Display',
    bodyFont: 'Plus Jakarta Sans',
    headingScale: 100,
    headingWeight: 700,
    bodySize: 16,
    bodyWeight: 400,
    mobileHeadingScale: 85,
    mobileBodySize: 15,
    regionalFonts: DEFAULT_REGIONAL_FONTS
  };

  const [socialLinks, setSocialLinks] = useState(() => {
    try {
      const cached = localStorage.getItem('ps_social_links');
      return cached ? JSON.parse(cached) : DEFAULT_SOCIAL_LINKS;
    } catch (e) {
      return DEFAULT_SOCIAL_LINKS;
    }
  });

  const [typography, setTypography] = useState(() => {
    try {
      const cached = localStorage.getItem('ps_typography_settings');
      return cached ? JSON.parse(cached) : DEFAULT_TYPOGRAPHY;
    } catch (e) {
      return DEFAULT_TYPOGRAPHY;
    }
  });

  // Apply typography live to document root CSS variables (Seamless per-language font switching)
  useEffect(() => {
    const root = document.documentElement;
    const regional = typography.regionalFonts?.[currentLanguage];
    const hFont = (regional && regional.headingFont) ? regional.headingFont : (typography.headingFont || 'Playfair Display');
    const isSerif = [
      'Playfair Display', 'Rozha One', 'Noto Serif Devanagari', 'Merriweather',
      'Cinzel', 'DM Serif Display', 'Prata', 'PT Serif', 'Crimson Pro', 'Yatra One',
      'Noto Serif Bengali', 'Noto Serif Tamil', 'Noto Serif Telugu', 'Noto Serif Gujarati',
      'Noto Serif Kannada', 'Noto Serif Malayalam', 'Noto Serif Gurmukhi', 'Noto Nastaliq Urdu'
    ].includes(hFont);
    root.style.setProperty('--font-serif', `'${hFont}', ${isSerif ? 'Georgia, serif' : 'sans-serif'}`);

    const bFont = (regional && regional.bodyFont) ? regional.bodyFont : (typography.bodyFont || 'Plus Jakarta Sans');
    const isBodySerif = [
      'Merriweather', 'Lora', 'PT Serif', 'Crimson Pro', 'Noto Serif Devanagari',
      'Prata', 'Noto Serif Bengali', 'Noto Serif Tamil', 'Noto Serif Telugu',
      'Noto Serif Gujarati', 'Noto Serif Kannada', 'Noto Serif Malayalam', 'Noto Serif Gurmukhi'
    ].includes(bFont);
    root.style.setProperty('--font-sans', `'${bFont}', ${isBodySerif ? 'Georgia, serif' : "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"}`);

    root.style.setProperty('--font-size-base', `${typography.bodySize || 16}px`);
    root.style.setProperty('--font-scale-heading', `${(typography.headingScale || 100) / 100}`);
    root.style.setProperty('--font-size-base-mobile', `${typography.mobileBodySize || 15}px`);
    root.style.setProperty('--font-scale-heading-mobile', `${(typography.mobileHeadingScale || 85) / 100}`);
    root.style.setProperty('--font-weight-heading', `${typography.headingWeight || 700}`);
    root.style.setProperty('--font-weight-body', `${typography.bodyWeight || 400}`);
  }, [typography, currentLanguage]);

  const [themePalette, setThemePalette] = useState(() => {
    try {
      const cached = localStorage.getItem('ps_theme_palette');
      return cached ? JSON.parse(cached) : DEFAULT_THEME_PALETTE;
    } catch (e) {
      return DEFAULT_THEME_PALETTE;
    }
  });

  // Apply dynamic color palette live to document root CSS variables and body element
  useEffect(() => {
    const root = document.documentElement;

    // SINGLE-THEME LOCK: In Dark Mode, remove all inline style overrides so the single,
    // scientifically calibrated Sovereign Eye-Comfort Dark Theme in CSS ([data-theme="dark"])
    // has 100% full authority without being polluted by day-mode customizations.
    if (theme === 'dark') {
      const propertiesToClear = [
        '--accent-indigo', '--gradient-accent', '--bg-primary', '--bg-surface',
        '--glass-bg', '--bg-secondary', '--gradient-bento-hero', '--text-main',
        '--border-dark', '--text-muted', '--text-subtle', '--accent-crimson',
        '--accent-crimson-hover', '--accent-crimson-bg', '--accent-blue',
        '--border-light', '--glass-border', '--border-medium'
      ];
      propertiesToClear.forEach(p => root.style.removeProperty(p));
      document.body.style.backgroundColor = '';
      document.body.style.color = '';
      return;
    }

    // In Light / Day Mode: Apply custom or default theme palette
    if (!themePalette) return;
    if (themePalette.primary) {
      root.style.setProperty('--accent-indigo', themePalette.primary);
      root.style.setProperty('--gradient-accent', themePalette.primary);
    }
    if (themePalette.bgPrimary) {
      root.style.setProperty('--bg-primary', themePalette.bgPrimary);
      document.body.style.backgroundColor = themePalette.bgPrimary;
    }
    if (themePalette.bgSurface) {
      root.style.setProperty('--bg-surface', themePalette.bgSurface);
      root.style.setProperty('--glass-bg', themePalette.bgSurface);
    }
    if (themePalette.bgSecondary) {
      root.style.setProperty('--bg-secondary', themePalette.bgSecondary);
      root.style.setProperty('--gradient-bento-hero', `linear-gradient(135deg, ${themePalette.bgSecondary} 0%, ${themePalette.bgSurface || '#FFFFFF'} 100%)`);
    }
    if (themePalette.textMain) {
      root.style.setProperty('--text-main', themePalette.textMain);
      root.style.setProperty('--border-dark', themePalette.textMain);
      document.body.style.color = themePalette.textMain;
    }
    if (themePalette.textMuted) root.style.setProperty('--text-muted', themePalette.textMuted);
    if (themePalette.textSubtle) root.style.setProperty('--text-subtle', themePalette.textSubtle);
    if (themePalette.accentCrimson) {
      root.style.setProperty('--accent-crimson', themePalette.accentCrimson);
      root.style.setProperty('--accent-crimson-hover', themePalette.accentCrimson);
      root.style.setProperty('--accent-crimson-bg', `${themePalette.accentCrimson}18`);
    }
    if (themePalette.accentBlue) root.style.setProperty('--accent-blue', themePalette.accentBlue);
    if (themePalette.borderLight) {
      root.style.setProperty('--border-light', themePalette.borderLight);
      root.style.setProperty('--glass-border', themePalette.borderLight);
    }
    if (themePalette.borderMedium) root.style.setProperty('--border-medium', themePalette.borderMedium);
  }, [themePalette, theme]);

  const handleUpdateTheme = (updatedTheme) => {
    setThemePalette(updatedTheme);
    localStorage.setItem('ps_theme_palette', JSON.stringify(updatedTheme));

    fetch('/api/settings/theme', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-admin-key': 'publicspark-admin-secret-key-2026'
      },
      body: JSON.stringify(updatedTheme)
    })
    .then(res => res.json())
    .then(data => {
      console.log('Backend Theme Palette persisted:', data);
    })
    .catch(err => console.error('Error persisting theme palette to backend:', err));

    setToastMessage('Color theme settings applied across platform.');
    setIsToastOpen(true);
  };

  const handleUpdateTypography = (updatedTypography) => {
    setTypography(updatedTypography);
    localStorage.setItem('ps_typography_settings', JSON.stringify(updatedTypography));

    fetch('/api/settings/typography', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-admin-key': 'publicspark-admin-secret-key-2026'
      },
      body: JSON.stringify(updatedTypography)
    })
    .then(res => res.json())
    .then(data => {
      console.log('Backend Typography persisted:', data);
    })
    .catch(err => console.error('Error persisting typography to backend:', err));

    setToastMessage('Typography & Font settings updated across platform.');
    setIsToastOpen(true);
  };

  const handleUpdateSocialLinks = (updatedLinks) => {
    setSocialLinks(updatedLinks);
    localStorage.setItem('ps_social_links', JSON.stringify(updatedLinks));

    fetch('/api/settings/social', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedLinks)
    })
    .then(res => res.json())
    .then(data => {
      console.log('Backend Social Links persisted:', data);
    })
    .catch(err => console.error('Error persisting social links to backend:', err));

    setToastMessage('Social Media Channel URLs saved to Backend Server!');
    setIsToastOpen(true);
  };

  const handleUpdateCategories = (updatedCategories) => {
    setCategories(updatedCategories);
    saveCategoriesToCache(updatedCategories);

    fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedCategories)
    })
    .then(res => res.json())
    .then(data => {
      console.log('Backend Categories persisted:', data);
    })
    .catch(err => console.error('Error persisting categories to backend:', err));
  };

  // Initial sync from backend server for social links & categories
  useEffect(() => {
    fetch('/api/settings/social')
      .then(res => res.json())
      .then(data => {
        if (data && typeof data === 'object' && Object.keys(data).length > 0) {
          setSocialLinks(data);
          localStorage.setItem('ps_social_links', JSON.stringify(data));
        }
      })
      .catch(err => console.warn('[Backend Sync] Social links offline fallback:', err.message));

    fetch('/api/settings/typography')
      .then(res => res.json())
      .then(data => {
        if (data && typeof data === 'object' && Object.keys(data).length > 0) {
          setTypography(data);
          localStorage.setItem('ps_typography_settings', JSON.stringify(data));
        }
      })
      .catch(err => console.warn('[Backend Sync] Typography offline fallback:', err.message));

    fetch('/api/settings/theme')
      .then(res => res.json())
      .then(data => {
        if (data && typeof data === 'object' && Object.keys(data).length > 0) {
          setThemePalette(data);
          localStorage.setItem('ps_theme_palette', JSON.stringify(data));
        }
      })
      .catch(err => console.warn('[Backend Sync] Theme offline fallback:', err.message));

    // Initial sync of ad settings
    fetchAdSettings().catch(err => console.warn('[Backend Sync] Ads offline fallback:', err.message));

    fetch('/api/categories')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setCategories(data);
          saveCategoriesToCache(data);
        }
      })
      .catch(err => console.warn('[Backend Sync] Categories offline fallback:', err.message));

    fetch('/api/articles?scope=all')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setBaseArticles(prev => {
            const serverIds = new Set(data.map(a => String(a.id)));
            // Retain any articles created by reporter locally that server hasn't persisted yet
            const localOnly = prev.filter(p => !serverIds.has(String(p.id)) && p.id && String(p.id).startsWith('art-'));
            
            // Sync any local-only articles to backend in background
            if (localOnly.length > 0) {
              localOnly.forEach(art => {
                fetch('/api/articles/update', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(art)
                }).catch(() => {});
              });
            }

            const merged = [...localOnly, ...data];
            saveNewsToCache(merged);
            syncLegacyBookmarks(merged);
            return merged;
          });
        }
      })
      .catch(err => console.warn('[Backend Sync] Articles offline fallback:', err.message));

    // Also hydrate legacy bookmarks from local cache if offline
    syncLegacyBookmarks(baseArticles);
  }, []);

  const getFormattedWhatsAppLink = (input) => {
    if (!input) return 'https://whatsapp.com';
    const trimmed = input.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    const digitsOnly = trimmed.replace(/[^\d]/g, '');
    return digitsOnly ? `https://wa.me/${digitsOnly}` : 'https://whatsapp.com';
  };

  const getFormattedInstagramLink = (input) => {
    if (!input) return 'https://instagram.com';
    const trimmed = input.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    const handle = trimmed.replace(/^@/, '');
    return handle ? `https://instagram.com/${handle}` : 'https://instagram.com';
  };

  const getFormattedFacebookLink = (input) => {
    if (!input) return 'https://facebook.com';
    const trimmed = input.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;

    // Check if input is a phone number or numeric ID (e.g. +919876543210, 9876543210, +91 98765 43210)
    const digitsOnly = trimmed.replace(/[^\d]/g, '');
    const isPhoneOrNumeric = /^[+\d\s\-()]+$/.test(trimmed) && digitsOnly.length >= 7;

    if (isPhoneOrNumeric) {
      return `https://facebook.com/${digitsOnly}`;
    }

    const handle = trimmed.replace(/^@/, '');
    return handle ? `https://facebook.com/${handle}` : 'https://facebook.com';
  };

  const getFormattedTwitterLink = (input) => {
    if (!input) return 'https://x.com';
    const trimmed = input.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    const handle = trimmed.replace(/^@/, '');
    return handle ? `https://x.com/${handle}` : 'https://x.com';
  };

  // Global Taxonomy Categories State
  const [categories, setCategories] = useState(() => {
    return getCachedCategories() || MOCK_CATEGORIES;
  });

  useEffect(() => {
    saveCategoriesToCache(categories);
  }, [categories]);

  // Raw & Translated Articles State Management
  const [baseArticles, setBaseArticles] = useState(() => {
    const cached = getCachedNews();
    return cached?.articles || MOCK_ARTICLES;
  });
  const [publishedArticles, setPublishedArticles] = useState(baseArticles);
  const [pendingArticles, setPendingArticles] = useState(() => {
    try {
      const raw = localStorage.getItem('ps_pending_articles_v1');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  });

  const [rejectedArticles, setRejectedArticles] = useState(() => {
    try {
      const raw = localStorage.getItem('ps_rejected_articles_v1');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('ps_pending_articles_v1', JSON.stringify(pendingArticles));
    } catch (e) {}
  }, [pendingArticles]);

  useEffect(() => {
    try {
      localStorage.setItem('ps_rejected_articles_v1', JSON.stringify(rejectedArticles));
    } catch (e) {}
  }, [rejectedArticles]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Save base articles to local cache
  useEffect(() => {
    saveNewsToCache(baseArticles);
  }, [baseArticles]);

  // Translate headlines only on front page when language changes
  useEffect(() => {
    let isSubscribed = true;

    async function applyHeadlineTranslation() {
      if (currentLanguage === 'hi') {
        setPublishedArticles(baseArticles);
        return;
      }

      setIsTranslating(true);
      try {
        const translatedHeadlines = await translateHeadlinesOnly(baseArticles, currentLanguage);
        if (isSubscribed) {
          setPublishedArticles(translatedHeadlines);
        }

        const langObj = SUPPORTED_LANGUAGES.find(l => l.code === currentLanguage || l.code.toLowerCase() === currentLanguage.toLowerCase());
        const langName = langObj ? (langObj.native || langObj.name) : currentLanguage;
        setToastMessage(`Headlines translated to ${langName}. Open any article for full translation.`);
        setIsToastOpen(true);
      } catch (err) {
        console.error('Headline translation error:', err);
      } finally {
        if (isSubscribed) setIsTranslating(false);
      }
    }

    applyHeadlineTranslation();

    return () => {
      isSubscribed = false;
    };
  }, [currentLanguage, baseArticles]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleSelectArticle = async (art) => {
    setSelectedArticle(art);
    setActiveView('article');
    const cleanSlug = art.slug || art.id;
    window.history.pushState({ articleId: art.id, slug: cleanSlug }, '', `/article/${cleanSlug}`);
    document.title = `${art.title} - PUBLIC SPARK`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigate = (view) => {
    setActiveView(view);
    if (view === 'home') {
      setSelectedArticle(null);
      window.history.pushState({}, '', '/');
      document.title = 'PUBLIC SPARK - Breaking News & Live Updates';
    } else {
      window.history.pushState({}, '', `/${view}`);
      document.title = `${view.charAt(0).toUpperCase() + view.slice(1)} - PUBLIC SPARK`;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRoleChange = (role) => {
    setCurrentRole(role);
    if (role === 'visitor') {
      handleNavigate('home');
    } else {
      handleNavigate(role);
    }
  };

  // Browser Back / Forward Button & Popstate Synchronization
  useEffect(() => {
    const handlePopState = () => {
      const route = parseRouteFromUrl();
      if (route.view === 'article' && route.idOrSlug) {
        const found = baseArticles.find(a => a.id === route.idOrSlug || a.slug === route.idOrSlug);
        if (found) {
          setSelectedArticle(found);
          setActiveView('article');
          document.title = `${found.title} - PUBLIC SPARK`;
          return;
        }
      }
      setSelectedArticle(null);
      setActiveView(route.view);
      if (route.view === 'home') {
        document.title = 'PUBLIC SPARK - Breaking News & Live Updates';
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [baseArticles]);

  // Synchronize deep-link route once base articles load from server (or offline store)
  useEffect(() => {
    const route = parseRouteFromUrl();
    if (route.view === 'article' && route.idOrSlug && !selectedArticle) {
      let found = baseArticles.find(a => a.id === route.idOrSlug || a.slug === route.idOrSlug);
      if (!found) {
        const offlineList = getOfflineArticles();
        found = offlineList.find(a => a.id === route.idOrSlug || a.slug === route.idOrSlug);
      }
      if (found) {
        setSelectedArticle(found);
        setActiveView('article');
        document.title = `${found.title} - PUBLIC SPARK`;
      }
    }
  }, [baseArticles, selectedArticle]);

  // 1-Click Quick Audio Reading Trigger for Homepage Cards
  const handleQuickAudioRead = (e, article) => {
    e.stopPropagation();

    if (playingArticleId === article.id) {
      stopAudioSpeech();
      setPlayingArticleId(null);
      setPlayingArticle(null);
    } else {
      stopAudioSpeech();
      const textToRead = `${article.title}. ${article.summary || article.content}`;
      setPlayingArticleId(article.id);
      setPlayingArticle(article);

      speakTextWithNaturalVoice({
        text: textToRead,
        langCode: currentLanguage,
        articleId: article.id,
        onStart: () => { setPlayingArticleId(article.id); setPlayingArticle(article); },
        onPlay: () => { setPlayingArticleId(article.id); setPlayingArticle(article); },
        onEnd: () => { setPlayingArticleId(null); setPlayingArticle(null); }
      });
    }
  };

  // Reporter publishes or submits an article (Publish dabate hi Hindi live)
  const handleAddNewArticle = (newArticle) => {
    if (newArticle.status === 'published') {
      const updated = [newArticle, ...baseArticles];
      setBaseArticles(updated);
      saveNewsToCache(updated);

      // Persist permanently to backend database (server/data/articles.json)
      fetch('/api/articles/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newArticle)
      })
      .then(res => res.json())
      .then(data => {
        console.log('[Backend Article Persisted]:', newArticle.id);
      })
      .catch(err => {
        console.warn('[Backend Article Persist Warning, cached in browser]:', err.message);
      });
    } else {
      setPendingArticles([newArticle, ...pendingArticles]);
      setToastMessage('समाचार Editor Desk पर समीक्षा के लिए भेज दिया गया है!');
      setIsToastOpen(true);
    }
  };

  // Editor approves story
  const handleApproveArticle = (articleId, updatedTitle, isBreaking, updatedLanguage, factCheck, sources) => {
    const target = pendingArticles.find(a => a.id === articleId);
    if (target) {
      const approvedStory = {
        ...target,
        title: updatedTitle || target.title,
        originalLanguage: updatedLanguage || target.originalLanguage || 'hi',
        status: 'published',
        is_breaking: isBreaking,
        published_at: 'Just now',
        fact_check: factCheck || target.fact_check || {
          verified: true,
          rating: 'Verified',
          desk: 'PublicSpark Editorial Desk',
          claim: 'Verified against institutional statements and reporter ground dispatches.',
          verified_at: 'Just now'
        },
        sources: sources || target.sources || []
      };

      const updatedBase = [approvedStory, ...baseArticles];
      setBaseArticles(updatedBase);
      saveNewsToCache(updatedBase);
      setPendingArticles(pendingArticles.filter(a => a.id !== articleId));

      // Persist permanently to backend database
      fetch('/api/articles/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(approvedStory)
      }).catch(err => console.warn('[Backend Story Persist Warning]:', err.message));

      setToastMessage(`Story approved & published live: "${approvedStory.title}"`);
      setIsToastOpen(true);
    }
  };

  // Editor rejects story with reason note
  const handleRejectArticle = (articleId, reasonNote) => {
    const target = pendingArticles.find(a => a.id === articleId);
    const rejectionReason = reasonNote || 'Editorial review requested changes before publication.';
    const rejectedStory = target ? {
      ...target,
      status: 'rejected',
      rejection_reason: rejectionReason,
      rejected_at: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    } : {
      id: articleId,
      status: 'rejected',
      rejection_reason: rejectionReason,
      rejected_at: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    };

    setRejectedArticles(prev => [rejectedStory, ...prev.filter(a => a.id !== articleId)]);
    setPendingArticles(prev => prev.filter(a => a.id !== articleId));
    setToastMessage('Story rejected & feedback sent back to reporter.');
    setIsToastOpen(true);
  };

  // Reporter resubmits revised story
  const handleResubmitArticle = (updatedStory) => {
    // Remove from rejectedArticles if present
    setRejectedArticles(prev => prev.filter(a => a.id !== updatedStory.id));
    // Add to pendingArticles for editor review
    setPendingArticles(prev => [updatedStory, ...prev.filter(a => a.id !== updatedStory.id)]);
    setToastMessage('संशोधित समाचार Editor Desk पर पुनः समीक्षा के लिए भेज दिया गया है!');
    setIsToastOpen(true);
  };

  // Subscribe to offline bookmarks changes across all components
  useEffect(() => {
    const handleBookmarkChange = () => {
      setBookmarkRefresh(prev => prev + 1);
    };
    window.addEventListener('ps_offline_bookmarks_changed', handleBookmarkChange);
    return () => window.removeEventListener('ps_offline_bookmarks_changed', handleBookmarkChange);
  }, []);

  const handleRemoveBookmark = (e, art) => {
    e.stopPropagation();
    removeArticleOffline(art.id);
    setBookmarkRefresh(prev => prev + 1);
    setToastMessage('Article removed from Bookmarks.');
    setIsToastOpen(true);
  };

  // Dedicated offline saved stories (instant access even with zero internet)
  const offlineArticlesList = activeCategory === 'bookmarks' ? getOfflineArticles() : [];

  // Filter articles by active category or offline bookmarks (Guarded by Reader Embargo)
  const displayedArticles = activeCategory === 'bookmarks'
    ? offlineArticlesList
    : publishedArticles.filter(art => {
        // Public Reader Embargo Guard: Hide drafts and future-scheduled stories from reader view
        if (art.status === 'hidden' || art.status === 'draft') return false;
        if (art.status === 'scheduled') {
          if (art.scheduledPublishTime && new Date(art.scheduledPublishTime).getTime() <= Date.now()) {
            return true;
          }
          return false;
        }
        return activeCategory === 'all' ? true : art.category_slug === activeCategory;
      });

  const heroArticle = displayedArticles[0];
  const secondaryArticles = displayedArticles.slice(1, 3);
  const remainingArticles = displayedArticles.slice(3);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Animated Loading Splash Screen */}
      {isLoading && (
        <LoadingSplash onFinished={() => {
          setIsLoading(false);
          try { sessionStorage.setItem('ps_splash_shown', 'true'); } catch (e) {}
        }} />
      )}

      {/* Header with Masthead, Language Selector & Category Nav */}
      <Header 
        currentRole={currentRole}
        onRoleChange={handleRoleChange}
        theme={theme}
        onToggleTheme={toggleTheme}
        activeCategory={activeCategory}
        onSelectCategory={setActiveCategory}
        activeView={activeView}
        onNavigate={handleNavigate}
        currentLanguage={currentLanguage}
        onLanguageChange={setCurrentLanguage}
        isTranslating={isTranslating}
        categories={categories}
        articles={baseArticles}
      />

      {/* Main Content Area */}
      <main style={{ flex: 1 }}>
        {/* PUBLIC HOME PAGE */}
        {activeView === 'home' && (
          <div className="container" style={{ padding: '1.5rem 1.25rem' }}>
            
            {/* DEDICATED BOOKMARKS VIEW */}
            {activeCategory === 'bookmarks' ? (
              <div style={{ padding: '1rem 0 3rem 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', borderBottom: '2px solid #f59e0b', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-main)', margin: 0 }}>
                    <Bookmark size={24} color="#f59e0b" fill="#f59e0b" /> {t('savedBookmarks', currentLanguage)} ({displayedArticles.length})
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-subtle)', background: 'var(--bg-secondary)', padding: '0.2rem 0.55rem', borderRadius: '4px', border: '1px solid var(--border-medium)', fontFamily: 'var(--font-mono)' }}>
                      {getOfflineStorageMetrics().formattedSize} • Offline Storage
                    </span>
                  </div>
                </div>

                {displayedArticles.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '2rem' }}>
                    {displayedArticles.map((art) => (
                      <div key={art.id} className="story-card-secondary" onClick={() => handleSelectArticle(art)} style={{ cursor: 'pointer' }}>
                        <div className="img-container" style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {art.featured_image ? (
                            <img src={art.featured_image} alt={art.title} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                          ) : (
                            <Newspaper size={32} color="var(--text-subtle)" />
                          )}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0.6rem 0' }}>
                          <span className="story-category-tag">{translateCategoryName(art.category, currentLanguage)}</span>
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            <button 
                              onClick={(e) => handleQuickAudioRead(e, art)}
                              className="btn btn-outline"
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                            >
                              {playingArticleId === art.id ? <Pause size={12} /> : <Volume2 size={12} />}
                              {playingArticleId === art.id ? t('playing', currentLanguage) : t('listen', currentLanguage)}
                            </button>
                            <button 
                              onClick={(e) => handleRemoveBookmark(e, art)}
                              className="btn"
                              style={{ padding: '0.2rem 0.65rem', fontSize: '0.7rem', borderRadius: '20px', background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                              title={t('remove', currentLanguage)}
                            >
                              <X size={11} /> {t('remove', currentLanguage)}
                            </button>
                          </div>
                        </div>
                        <h3 className="story-card-title" style={{ fontSize: '1.1rem', fontWeight: '800', lineHeight: '1.35', marginBottom: '0.5rem' }}>{art.title}</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: '0.75rem' }}>
                          {art.excerpt}
                        </p>
                        <div className="story-meta" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-subtle)', flexWrap: 'wrap' }}>
                          <span>{t('byAuthor', currentLanguage)} {art.author?.name || 'Editorial Desk'}</span>
                          <span>• <Clock size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> {art.reading_time_mins || calculateReadingTime(art.content || '', currentLanguage)} {t('minsRead', currentLanguage)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-subtle)', background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px dashed #f59e0b', margin: '1rem 0' }}>
                    <Bookmark size={48} color="#f59e0b" style={{ marginBottom: '0.75rem' }} />
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                      {t('noSavedBookmarks', currentLanguage)}
                    </h3>
                    <p style={{ fontSize: '0.9rem', maxWidth: '440px', margin: '0 auto', lineHeight: '1.5' }}>
                      {t('noSavedBookmarksDesc', currentLanguage)}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* STANDARD CATEGORY & NEWSPAPER 3-COLUMN LAYOUT */
              <>
                {/* Header Broadsheet Leaderboard Ad Slot */}
                <PartnerUnit position="header" category={activeCategory} />

                {heroArticle ? (
                  <div className="news-grid-lead">
                    {/* Main Hero Column */}
                    <div className="story-card-hero" onClick={() => handleSelectArticle(heroArticle)} style={{ cursor: 'pointer' }}>
                      <div className="img-container">
                        {heroArticle.featured_image ? (
                          <img src={heroArticle.featured_image} alt={heroArticle.title} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: 'var(--text-subtle)' }}>
                            <Newspaper size={44} />
                          </div>
                        )}
                        {heroArticle.video_url && (
                          <div style={{ position: 'absolute', bottom: '12px', right: '12px', background: 'rgba(197, 34, 31, 0.92)', color: '#fff', padding: '0.25rem 0.65rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.35rem', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                            <Play size={12} fill="#fff" /> VIDEO
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span className="story-category-tag">{translateCategoryName(heroArticle.category, currentLanguage)}</span>
                          {heroArticle.format === 'live' && (
                            <span 
                              className="badge badge-live"
                              style={{
                                background: (heroArticle.live_status || 'active') === 'active' ? '#DC2626' : '#4B5563',
                                color: '#FFFFFF',
                                fontWeight: '800',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                              }}
                            >
                              <Radio size={11} /> {(heroArticle.live_status || 'active') === 'active' ? 'LIVE BLOG' : 'LIVE CONCLUDED'}
                            </span>
                          )}
                          {heroArticle.is_breaking && (
                            <span className="badge badge-live"><Flame size={12} /> {t('breaking', currentLanguage)}</span>
                          )}
                        </div>

                        {/* 1-Click Audio Reader & WhatsApp Smart Share Triggers */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <button 
                            onClick={(e) => handleQuickAudioRead(e, heroArticle)}
                            className="btn btn-outline"
                            style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                            title={t('listenToStory', currentLanguage)}
                          >
                            {playingArticleId === heroArticle.id ? <Pause size={12} color="var(--accent-crimson)" /> : <Volume2 size={12} color="var(--accent-crimson)" />}
                            <span className="hide-on-mobile">{playingArticleId === heroArticle.id ? t('playing', currentLanguage) : t('listen', currentLanguage)}</span>
                          </button>

                          <a
                            href={getWhatsAppShareUrl(heroArticle, currentLanguage)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="btn btn-outline"
                            style={{
                              padding: '0.25rem 0.6rem',
                              fontSize: '0.75rem',
                              borderRadius: 'var(--radius-sm)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              color: '#15803D',
                              borderColor: '#86EFAC',
                              background: '#F0FDF4',
                              textDecoration: 'none',
                              fontWeight: '700'
                            }}
                            title="Share on WhatsApp (व्हाट्सएप बुलेटिन शेयर करें)"
                          >
                            <WhatsAppIcon size={13} color="#15803D" />
                            <span className="hide-on-mobile">WhatsApp</span>
                          </a>
                        </div>
                      </div>

                      <h2 className="story-card-title">{heroArticle.title}</h2>
                      {(heroArticle.summary || heroArticle.sub_title || heroArticle.excerpt) && (
                        <p className="story-excerpt" style={{ margin: '0.25rem 0 0.5rem 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {heroArticle.summary || heroArticle.sub_title || heroArticle.excerpt}
                        </p>
                      )}
                      <div className="story-meta" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.8rem' }}>
                        <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>{t('byAuthor', currentLanguage)} {heroArticle.author?.name || 'Staff Reporter'}</span>
                        <span>• {heroArticle.published_at}</span>
                        <span>• <Clock size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> {heroArticle.reading_time_mins || calculateReadingTime(heroArticle.content || '', currentLanguage)} {t('minsRead', currentLanguage)}</span>
                      </div>
                    </div>

                    {/* Secondary Column */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {secondaryArticles.map((art) => (
                        <div key={art.id} className="story-card-secondary" onClick={() => handleSelectArticle(art)} style={{ cursor: 'pointer' }}>
                          <div className="secondary-card-img-wrap">
                            <div className="img-container">
                              {art.featured_image ? (
                                <img src={art.featured_image} alt={art.title} loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: 'var(--text-subtle)' }}>
                                  <Newspaper size={24} />
                                </div>
                              )}
                              {art.video_url && (
                                <div style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(197, 34, 31, 0.9)', color: '#fff', padding: '0.15rem 0.45rem', borderRadius: '3px', fontSize: '0.65rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <Play size={10} fill="#fff" />
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="secondary-card-content">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                              <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                                <span className="story-category-tag">{translateCategoryName(art.category, currentLanguage)}</span>
                                {art.format === 'live' && (
                                  <span 
                                    className="badge badge-live"
                                    style={{
                                      background: (art.live_status || 'active') === 'active' ? '#DC2626' : '#4B5563',
                                      color: '#FFFFFF',
                                      fontWeight: '800',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.2rem',
                                      padding: '0.1rem 0.35rem',
                                      fontSize: '0.65rem'
                                    }}
                                  >
                                    <Radio size={9} /> {(art.live_status || 'active') === 'active' ? 'LIVE' : 'CONCLUDED'}
                                  </span>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <button 
                                  onClick={(e) => handleQuickAudioRead(e, art)}
                                  className="btn btn-outline"
                                  style={{ padding: '0.15rem 0.45rem', fontSize: '0.7rem', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                >
                                  {playingArticleId === art.id ? <Pause size={11} /> : <Volume2 size={11} />}
                                  <span className="hide-on-mobile">{playingArticleId === art.id ? t('playing', currentLanguage) : t('listen', currentLanguage)}</span>
                                </button>
                                <a
                                  href={getWhatsAppShareUrl(art, currentLanguage)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="btn btn-outline"
                                  style={{
                                    padding: '0.15rem 0.4rem',
                                    fontSize: '0.7rem',
                                    borderRadius: 'var(--radius-sm)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    color: '#15803D',
                                    borderColor: '#86EFAC',
                                    background: '#F0FDF4',
                                    textDecoration: 'none'
                                  }}
                                  title="Share on WhatsApp"
                                >
                                  <WhatsAppIcon size={11} color="#15803D" />
                                </a>
                              </div>
                            </div>
                            <h3 className="story-card-title">{art.title}</h3>
                            <div className="story-meta" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.35rem', fontSize: '0.75rem' }}>
                              <span>{art.published_at}</span>
                              <span>• <Clock size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> {art.reading_time_mins || calculateReadingTime(art.content || '', currentLanguage)} {t('minsRead', currentLanguage)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Opinion & Trending Column */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      <div className="opinion-box">
                        <div className="opinion-header">
                          <Sparkles size={14} /> {t('editorsSpotlight', currentLanguage)}
                        </div>
                        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.15rem', fontWeight: 'var(--font-weight-heading, 800)', lineHeight: '1.35', cursor: 'pointer', marginBottom: '0.6rem' }} onClick={() => handleSelectArticle(publishedArticles[3] || heroArticle)}>
                          {(publishedArticles[3] || heroArticle)?.title}
                        </h3>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', fontWeight: '600' }}>
                          {t('byAuthor', currentLanguage)} {(publishedArticles[3] || heroArticle)?.author?.name || 'Kabir Roy, Editor-in-Chief'}
                        </div>
                      </div>

                      <div className="trending-widget">
                        <h4 style={{ fontSize: '0.8rem', fontWeight: '900', textTransform: 'uppercase', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-crimson)', letterSpacing: '0.08em' }}>
                          <TrendingUp size={15} /> {t('topTrendingStories', currentLanguage)}
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {publishedArticles.slice(1, 4).map((art, idx) => (
                            <div key={art.id} className="trending-item" onClick={() => handleSelectArticle(art)} style={{ cursor: 'pointer' }}>
                              <span className="trending-rank">0{idx + 1}</span>
                              <div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 'var(--font-weight-heading, 800)', lineHeight: '1.3' }}>{art.title}</div>
                                <div style={{ fontSize: '0.725rem', color: 'var(--text-subtle)', marginTop: '0.2rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                  <span>{translateCategoryName(art.category, currentLanguage)}</span>
                                  <span>•</span>
                                  <span>{art.published_at}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Interactive Daily Public Voice Poll Widget (Controlled via Admin Desk) */}
                      {pollData && pollData.enabled && (
                        <div style={{ 
                          background: 'var(--bg-surface)', 
                          border: '1px solid var(--border-medium)', 
                          borderRadius: 'var(--radius-bento)', 
                          padding: '1.25rem',
                          boxShadow: 'var(--shadow-sm)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-indigo)', fontSize: '0.8rem', fontWeight: '800', textTransform: 'uppercase', marginBottom: '0.6rem', letterSpacing: '0.05em' }}>
                            <BarChart3 size={15} /> {t('dailyReaderPoll', currentLanguage)}
                          </div>
                          <h4 style={{ fontSize: '0.95rem', fontWeight: '800', lineHeight: '1.35', marginBottom: '1rem', color: 'var(--text-main)', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                            "{pollData.question}"
                          </h4>

                          {!userVotedChoice ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              {pollData.options.map((opt, i) => {
                                const dotColor = i === 0 ? 'var(--accent-indigo)' : i === 1 ? 'var(--accent-crimson)' : 'var(--text-subtle)';
                                return (
                                  <button
                                    key={opt.id}
                                    onClick={() => handlePollVote(opt.id)}
                                    className="btn btn-outline"
                                    style={{
                                      width: '100%',
                                      justifyContent: 'flex-start',
                                      padding: '0.5rem 0.85rem',
                                      fontSize: '0.85rem',
                                      fontWeight: '700',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.5rem',
                                      textAlign: 'left'
                                    }}
                                  >
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: dotColor, flexShrink: 0 }}></div>
                                    <span style={{ flex: 1, wordBreak: 'break-word', overflowWrap: 'break-word' }}>{opt.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                              {(() => {
                                const totalVotes = pollData.options.reduce((sum, o) => sum + (o.votes || 0), 0);
                                return (
                                  <>
                                    {pollData.options.map((opt, i) => {
                                      const pct = totalVotes > 0 ? Math.round(((opt.votes || 0) / totalVotes) * 100) : 0;
                                      const barColor = i === 0 ? 'var(--accent-indigo)' : i === 1 ? 'var(--accent-crimson)' : 'var(--accent-amber)';
                                      const isChosen = userVotedChoice === opt.id;

                                      return (
                                        <div key={opt.id}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: '800', marginBottom: '0.2rem', gap: '0.5rem' }}>
                                            <span style={{ color: isChosen ? 'var(--accent-indigo)' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', wordBreak: 'break-word' }}>
                                              {opt.label} ({opt.votes || 0})
                                              {isChosen && <span style={{ fontSize: '0.68rem', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-indigo)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>आपकी पसंद</span>}
                                            </span>
                                            <span style={{ color: 'var(--text-subtle)', flexShrink: 0 }}>{pct}%</span>
                                          </div>
                                          <div style={{ height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                                            <div style={{ width: `${pct}%`, height: '100%', background: barColor, transition: 'width 0.5s ease' }}></div>
                                          </div>
                                        </div>
                                      );
                                    })}

                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--accent-emerald)', fontWeight: '700', marginTop: '0.4rem', textAlign: 'center' }}>
                                      <Check size={14} />
                                      <span>{t('voteRecorded', currentLanguage)} ({totalVotes.toLocaleString()} {t('readersVoted', currentLanguage)})</span>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Sidebar Sticky Unit Placement */}
                      <PartnerUnit position="sidebar" category={activeCategory} />
                    </div>
                  </div>
                ) : (
                  <div style={{ margin: '2rem 0' }}>
                    {/* Editorial Dispatch Card for Empty Section */}
                    <div style={{ 
                      padding: '3rem 2rem', 
                      textAlign: 'center', 
                      background: 'var(--bg-surface)', 
                      borderRadius: 'var(--radius-md)', 
                      border: '1px solid var(--border-medium)', 
                      boxShadow: 'var(--shadow-sm)',
                      maxWidth: '680px',
                      margin: '0 auto 3rem auto'
                    }}>
                      <div style={{ display: 'inline-flex', padding: '0.75rem', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.08)', color: 'var(--accent-indigo)', marginBottom: '1rem' }}>
                        <Newspaper size={32} />
                      </div>
                      <h3 style={{ fontSize: '1.35rem', fontWeight: '900', color: 'var(--text-main)', marginBottom: '0.5rem', fontFamily: 'var(--font-serif)' }}>
                        {translateCategoryName(categories?.find(c => c.slug === activeCategory)?.name || activeCategory, currentLanguage)}: {t('reportingInProgress', currentLanguage)}
                      </h3>
                      <p style={{ fontSize: '0.925rem', color: 'var(--text-muted)', maxWidth: '480px', margin: '0 auto 1.5rem auto', lineHeight: '1.6' }}>
                        {t('reportingInProgressDesc', currentLanguage)}
                      </p>
                      <button 
                        onClick={() => setActiveCategory('all')} 
                        className="btn btn-primary"
                        style={{ padding: '0.55rem 1.25rem', fontSize: '0.85rem', fontWeight: '700', borderRadius: '30px' }}
                      >
                        {t('topStories', currentLanguage)}
                      </button>
                    </div>

                    {/* Fallback Live Stream Grid so page is NEVER empty */}
                    <div style={{ borderTop: '2px solid var(--border-dark)', paddingTop: '2rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '0.9rem', fontWeight: '900', color: 'var(--accent-crimson)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <Flame size={16} /> {t('topTrendingStories', currentLanguage)}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '2rem' }}>
                        {publishedArticles.slice(0, 6).map((art) => (
                          <div key={art.id} className="story-card-secondary" onClick={() => handleSelectArticle(art)} style={{ cursor: 'pointer' }}>
                            <div className="secondary-card-img-wrap">
                              <div className="img-container">
                                <img src={art.featured_image} alt={art.title} loading="lazy" />
                              </div>
                            </div>
                            <div className="secondary-card-content">
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                  <span className="story-category-tag">{translateCategoryName(art.category, currentLanguage)}</span>
                                  {art.format === 'live' && (
                                    <span 
                                      className="badge badge-live"
                                      style={{
                                        background: (art.live_status || 'active') === 'active' ? '#DC2626' : '#4B5563',
                                        color: '#FFFFFF',
                                        fontWeight: '800',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.2rem',
                                        padding: '0.1rem 0.35rem',
                                        fontSize: '0.65rem'
                                      }}
                                    >
                                      <Radio size={9} /> {(art.live_status || 'active') === 'active' ? 'LIVE' : 'CONCLUDED'}
                                    </span>
                                  )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  {art.video_url && (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'var(--accent-crimson)', color: '#fff', fontSize: '0.65rem', fontWeight: '800', padding: '2px 6px', borderRadius: 'var(--radius-sm)', textTransform: 'uppercase' }}>
                                      <Play size={10} fill="#fff" /> Video
                                    </span>
                                  )}
                                  <button 
                                    onClick={(e) => handleQuickAudioRead(e, art)}
                                    className="btn btn-outline"
                                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                                  >
                                    {playingArticleId === art.id ? <Pause size={12} /> : <Volume2 size={12} />}
                                    {playingArticleId === art.id ? t('playing', currentLanguage) : t('listen', currentLanguage)}
                                  </button>
                                </div>
                              </div>
                              <h3 className="story-card-title">{art.title}</h3>
                              <div className="story-meta" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span>{art.author?.name || 'Staff Reporter'}</span>
                                <span>•</span>
                                <span>{art.published_at}</span>
                                <span>•</span>
                                <span><Clock size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> {art.reading_time_mins || calculateReadingTime(art.content || '', currentLanguage)} {t('minsRead', currentLanguage)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Homepage Feed In-Stream Ad Slot */}
                <PartnerUnit position="home_feed" category={activeCategory} />

                {/* Editorial Video Reel Section (Strictly Conditional: Renders ONLY if articles have video_url) */}
                {(() => {
                  const videoArticles = (publishedArticles || []).filter(a => a.video_url && a.video_url.trim());
                  if (videoArticles.length === 0) return null;
                  return (
                    <section className="video-reel-section" style={{ margin: '2.5rem 0' }}>
                      <div className="video-reel-header">
                        <h3 className="video-reel-title">
                          <Play size={18} fill="var(--accent-crimson)" color="var(--accent-crimson)" />
                          <span>{currentLanguage === 'hi' ? 'वीडियो रिपोर्ट व विशेष कवरेज' : 'Video Coverage & Ground Reports'}</span>
                        </h3>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', fontWeight: '700' }}>
                          {videoArticles.length} {currentLanguage === 'hi' ? 'वीडियो उपलब्ध' : 'Videos Available'}
                        </span>
                      </div>
                      <div className="video-grid">
                        {videoArticles.map((art) => (
                          <div key={art.id} className="video-card" onClick={() => handleSelectArticle(art)}>
                            <div className="video-thumbnail-wrap">
                              {art.featured_image ? (
                                <img src={art.featured_image} alt={art.title} loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: 'var(--text-subtle)', background: 'var(--bg-secondary)' }}>
                                  <Newspaper size={24} />
                                </div>
                              )}
                              <div className="video-play-overlay">
                                <Play size={18} fill="#FFFFFF" color="#FFFFFF" style={{ marginLeft: '2px' }} />
                              </div>
                            </div>
                            <div>
                              <span className="story-category-tag">{translateCategoryName(art.category, currentLanguage)}</span>
                              <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '1rem', fontWeight: '800', lineHeight: '1.35', marginTop: '0.35rem', color: 'var(--text-main)' }}>
                                {art.title}
                              </h4>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: '0.35rem' }}>
                                {art.author?.name || 'PublicSpark Desk'} • {art.published_at}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })()}

                {/* Remaining Grid Stories */}
                {remainingArticles.length > 0 && (
                  <div style={{ padding: '2.5rem 0' }}>
                    <h3 className="headline" style={{ fontSize: '1.75rem', fontWeight: '900', marginBottom: '1.75rem', borderBottom: '2px solid var(--border-dark)', paddingBottom: '0.6rem' }}>
                      {t('verifiedEditorialStream', currentLanguage)}
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '2rem' }}>
                      {remainingArticles.map((art) => (
                        <div key={art.id} className="story-card-secondary" onClick={() => handleSelectArticle(art)} style={{ cursor: 'pointer' }}>
                          <div className="secondary-card-img-wrap">
                            <div className="img-container">
                              {art.featured_image ? (
                                <img src={art.featured_image} alt={art.title} loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: 'var(--text-subtle)' }}>
                                  <Newspaper size={24} />
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="secondary-card-content">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span className="story-category-tag">{translateCategoryName(art.category, currentLanguage)}</span>
                                {art.format === 'live' && (
                                  <span 
                                    className="badge badge-live"
                                    style={{
                                      background: (art.live_status || 'active') === 'active' ? '#DC2626' : '#4B5563',
                                      color: '#FFFFFF',
                                      fontWeight: '800',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.2rem',
                                      padding: '0.1rem 0.35rem',
                                      fontSize: '0.65rem'
                                    }}
                                  >
                                    <Radio size={9} /> {(art.live_status || 'active') === 'active' ? 'LIVE' : 'CONCLUDED'}
                                  </span>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                {art.video_url && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'var(--accent-crimson)', color: '#fff', fontSize: '0.65rem', fontWeight: '800', padding: '2px 6px', borderRadius: 'var(--radius-sm)', textTransform: 'uppercase' }}>
                                    <Play size={10} fill="#fff" /> Video
                                  </span>
                                )}
                                <button 
                                  onClick={(e) => handleQuickAudioRead(e, art)}
                                  className="btn btn-outline"
                                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                                >
                                  {playingArticleId === art.id ? <Pause size={12} /> : <Volume2 size={12} />}
                                  {playingArticleId === art.id ? t('playing', currentLanguage) : t('listen', currentLanguage)}
                                </button>
                              </div>
                            </div>
                            <h3 className="story-card-title">{art.title}</h3>
                            <div className="story-meta" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                              <span>{art.author?.name || 'Staff Reporter'}</span>
                              <span>•</span>
                              <span>{art.published_at}</span>
                              <span>•</span>
                              <span><Clock size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> {art.reading_time_mins || calculateReadingTime(art.content || '', currentLanguage)} {t('minsRead', currentLanguage)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ARTICLE DETAIL READER VIEW */}
        {activeView === 'article' && (
          <ArticleReader 
            article={selectedArticle}
            articles={baseArticles}
            onBack={() => handleNavigate('home')} 
            onSelectArticle={handleSelectArticle}
            currentLanguage={currentLanguage}
            onShowToast={(msg) => { setToastMessage(msg); setIsToastOpen(true); }}
          />
        )}

        {/* SEARCH PAGE VIEW */}
        {activeView === 'search' && (
          <SearchPage 
            articles={publishedArticles}
            categories={categories}
            onSelectArticle={handleSelectArticle}
            onBack={() => handleNavigate('home')}
            currentLanguage={currentLanguage}
          />
        )}

        {/* WORKSPACE DESKS */}
        {activeView === 'reporter' && (
          <ReporterWorkspace 
            categories={categories}
            onAddNewArticle={handleAddNewArticle}
            onResubmitArticle={handleResubmitArticle}
            pendingArticles={pendingArticles}
            rejectedArticles={rejectedArticles}
            publishedArticles={baseArticles}
          />
        )}

        {activeView === 'editor' && (
          <EditorWorkspace 
            pendingArticles={pendingArticles}
            onApproveArticle={handleApproveArticle}
            onRejectArticle={handleRejectArticle}
          />
        )}

        {activeView === 'admin' && (
          <AdminWorkspace 
            currentRole={currentRole}
            articles={baseArticles}
            onUpdateArticles={(updated) => { setBaseArticles(updated); saveNewsToCache(updated); }}
            categories={categories}
            onUpdateCategories={handleUpdateCategories}
            socialLinks={socialLinks}
            onUpdateSocialLinks={handleUpdateSocialLinks}
            typography={typography}
            onUpdateTypography={handleUpdateTypography}
            themePalette={themePalette}
            onUpdateTheme={handleUpdateTheme}
            onShowToast={(msg) => { setToastMessage(msg); setIsToastOpen(true); }}
            onSelectArticle={handleSelectArticle}
          />
        )}
      </main>

      {/* Toast Notice Notification */}
      <ToastNotice 
        message={toastMessage} 
        isOpen={isToastOpen} 
        onClose={() => setIsToastOpen(false)} 
      />

      {/* Broadsheet Footer Leaderboard Ad Slot */}
      <PartnerUnit position="footer" category={activeCategory} />

      {/* Footer */}
      <footer style={{ background: 'var(--bg-surface)', borderTop: '3px double var(--border-dark)', padding: '3rem 0 1.5rem 0', marginTop: '4rem' }}>
        <div className="container">
          <div className="footer-grid">
            <div>
              <img src="/logo.png" alt="PUBLIC SPARK Logo" style={{ height: '60px', width: 'auto', objectFit: 'contain', marginBottom: '0.75rem' }} />
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', maxWidth: '420px', lineHeight: '1.6', marginBottom: '1.25rem' }}>
                An independent, zero-cost digital news platform built on open technologies, human editorial integrity, and transparent reporting.
              </p>

              {/* Official Social Media Channel Icons */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                {/* WhatsApp */}
                <a 
                  href={getFormattedWhatsAppLink(socialLinks.whatsapp)} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    width: '38px', 
                    height: '38px', 
                    borderRadius: '50%', 
                    background: '#25D366', 
                    color: '#ffffff', 
                    boxShadow: '0 2px 8px rgba(37, 211, 102, 0.3)',
                    transition: 'transform 0.2s ease',
                    textDecoration: 'none'
                  }}
                  title="Follow on WhatsApp"
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-3px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <WhatsAppIcon size={18} color="#ffffff" />
                </a>

                {/* Instagram */}
                <a 
                  href={getFormattedInstagramLink(socialLinks.instagram)} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    width: '38px', 
                    height: '38px', 
                    borderRadius: '50%', 
                    background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)', 
                    color: '#ffffff', 
                    boxShadow: '0 2px 8px rgba(220, 39, 67, 0.3)',
                    transition: 'transform 0.2s ease',
                    textDecoration: 'none'
                  }}
                  title="Follow on Instagram"
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-3px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <InstagramIcon size={18} color="#ffffff" />
                </a>

                {/* Facebook */}
                <a 
                  href={getFormattedFacebookLink(socialLinks.facebook)} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    width: '38px', 
                    height: '38px', 
                    borderRadius: '50%', 
                    background: '#1877F2', 
                    color: '#ffffff', 
                    boxShadow: '0 2px 8px rgba(24, 119, 242, 0.3)',
                    transition: 'transform 0.2s ease',
                    textDecoration: 'none'
                  }}
                  title="Follow on Facebook"
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-3px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <FacebookIcon size={18} color="#ffffff" />
                </a>

                {/* X (Twitter) */}
                <a 
                  href={getFormattedTwitterLink(socialLinks.twitter)} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    width: '38px', 
                    height: '38px', 
                    borderRadius: '50%', 
                    background: '#000000', 
                    color: '#ffffff', 
                    border: '1px solid var(--border-medium)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                    transition: 'transform 0.2s ease',
                    textDecoration: 'none'
                  }}
                  title="Follow on X (Twitter)"
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-3px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <XTwitterIcon size={18} color="#ffffff" />
                </a>
              </div>
            </div>
            <div>
              <h4 style={{ fontSize: '0.85rem', fontWeight: '900', textTransform: 'uppercase', color: 'var(--text-subtle)', marginBottom: '0.85rem', letterSpacing: '0.08em' }}>
                Editorial Desks
              </h4>
              <ul style={{ listStyle: 'none', fontSize: '0.875rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <li>India Desk</li>
                <li>Technology Desk</li>
                <li>Climate & Environment</li>
                <li>Opinion & Analysis</li>
              </ul>
            </div>
            <div>
              <h4 style={{ fontSize: '0.85rem', fontWeight: '900', textTransform: 'uppercase', color: 'var(--text-subtle)', marginBottom: '0.85rem', letterSpacing: '0.08em' }}>
                About & Standards
              </h4>
              <ul style={{ listStyle: 'none', fontSize: '0.875rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <li>
                  <button onClick={() => { setLegalModalTab('about'); setIsLegalModalOpen(true); }} style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', font: 'inherit', cursor: 'pointer', textAlign: 'left' }} onMouseEnter={(e) => e.target.style.color = 'var(--accent-indigo)'} onMouseLeave={(e) => e.target.style.color = 'inherit'}>
                    About PublicSpark
                  </button>
                </li>
                <li>
                  <button onClick={() => { setLegalModalTab('ethics'); setIsLegalModalOpen(true); }} style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', font: 'inherit', cursor: 'pointer', textAlign: 'left' }} onMouseEnter={(e) => e.target.style.color = 'var(--accent-indigo)'} onMouseLeave={(e) => e.target.style.color = 'inherit'}>
                    Editorial Code & Fact-Check
                  </button>
                </li>
                <li>
                  <button onClick={() => { setLegalModalTab('contact'); setIsLegalModalOpen(true); }} style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', font: 'inherit', cursor: 'pointer', textAlign: 'left' }} onMouseEnter={(e) => e.target.style.color = 'var(--accent-indigo)'} onMouseLeave={(e) => e.target.style.color = 'inherit'}>
                    Contact & Grievance Redressal
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h4 style={{ fontSize: '0.85rem', fontWeight: '900', textTransform: 'uppercase', color: 'var(--text-subtle)', marginBottom: '0.85rem', letterSpacing: '0.08em' }}>
                Legal & Compliance
              </h4>
              <ul style={{ listStyle: 'none', fontSize: '0.875rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <li>
                  <button onClick={() => { setLegalModalTab('privacy'); setIsLegalModalOpen(true); }} style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', font: 'inherit', cursor: 'pointer', textAlign: 'left' }} onMouseEnter={(e) => e.target.style.color = 'var(--accent-indigo)'} onMouseLeave={(e) => e.target.style.color = 'inherit'}>
                    Privacy Policy (AdSense & Cookies)
                  </button>
                </li>
                <li>
                  <button onClick={() => { setLegalModalTab('terms'); setIsLegalModalOpen(true); }} style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', font: 'inherit', cursor: 'pointer', textAlign: 'left' }} onMouseEnter={(e) => e.target.style.color = 'var(--accent-indigo)'} onMouseLeave={(e) => e.target.style.color = 'inherit'}>
                    Terms of Service
                  </button>
                </li>
              </ul>
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1.25rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-subtle)' }}>
            © 2026 PublicSpark Newsroom Platform. All rights reserved. Built with precision for human journalism.
          </div>
        </div>
      {/* Floating Broadsheet Audio Mini-Player Bar */}
      {playingArticleId && (
        <div className="floating-broadsheet-audio">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', overflow: 'hidden', flex: 1 }}>
            {/* Audio Equalizer animation bars */}
            <div className="equalizer-container" style={{ flexShrink: 0 }}>
              <div className="equalizer-bar"></div>
              <div className="equalizer-bar"></div>
              <div className="equalizer-bar"></div>
              <div className="equalizer-bar"></div>
            </div>

            <div style={{ overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.7rem', fontWeight: '800', color: 'var(--accent-indigo)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <Volume2 size={12} /> {t('nowReadingAudio', currentLanguage)}
              </div>
              <div style={{ fontSize: '0.875rem', fontWeight: '800', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-main)' }}>
                {playingArticle?.title || 'Playing News Article...'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            <button
              onClick={() => {
                stopAudioSpeech();
                setPlayingArticleId(null);
                setPlayingArticle(null);
              }}
              className="btn btn-primary"
              style={{ padding: '0.35rem 0.8rem', fontSize: '0.75rem', borderRadius: '20px' }}
            >
              {t('stopAudio', currentLanguage)}
            </button>
            <button
              onClick={() => {
                stopAudioSpeech();
                setPlayingArticleId(null);
                setPlayingArticle(null);
              }}
              style={{ background: 'none', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer', padding: '0.2rem' }}
              title="Close Audio Bar"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      </footer>

      {/* Mandatory 5 Legal Pages Modal for Google AdSense Compliance */}
      <LegalModal 
        isOpen={isLegalModalOpen} 
        onClose={() => setIsLegalModalOpen(false)} 
        initialTab={legalModalTab} 
        currentLanguage={currentLanguage} 
      />

      {/* Mobile Sticky Anchor Ad Slot (Automatically active only on mobile when enabled) */}
      <PartnerUnit position="mobile_footer" category={activeCategory} />
    </div>
  );
}
