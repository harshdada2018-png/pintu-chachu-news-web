import React, { useState, useEffect } from 'react';
import Header from './components/common/Header';
import LoadingSplash from './components/common/LoadingSplash';
import ToastNotice from './components/common/ToastNotice';
import ArticleLink from './components/common/ArticleLink';
import ArticleReader from './components/public/ArticleReader';
import ReporterWorkspace from './components/reporter/ReporterWorkspace';
import EditorWorkspace from './components/editor/EditorWorkspace';
import AdminWorkspace from './components/admin/AdminWorkspace';
import SearchPage from './components/public/SearchPage';
import LegalModal from './components/common/LegalModal';
import GrievanceModal from './components/public/GrievanceModal';
import ConfidentialTipModal from './components/public/ConfidentialTipModal';
import SavedStoriesDrawer from './components/public/SavedStoriesDrawer';
import SearchDrawer from './components/public/SearchDrawer';
import CategoryShelvesSection from './components/public/CategoryShelvesSection';
import StaffLoginModal from './components/auth/StaffLoginModal';
import PartnerUnit from './components/common/PartnerUnit';
import { getSessionToken, getSessionRole, getSessionStaffName, getSessionStaffEmail, getAuthHeaders, clearStaffSession, initInactivityWatchdog } from './services/authClient';
import { initCredentialCacheSanitizer } from './services/credentialCacheSanitizer';
import { fetchAdSettings } from './services/monetizationService';
import { DEFAULT_NEWSROOM_CATEGORIES } from './services/taxonomyService';
import { getCachedNews, saveNewsToCache, getCachedCategories, saveCategoriesToCache } from './services/cacheService';
import { translateArticle, translateHeadlinesOnly, SUPPORTED_LANGUAGES, purgeCorruptedTranslationCache } from './services/translationService';
import { speakWithBrowserSpeechOnly, stopAudioSpeech, isAudioSupportedLanguage } from './services/speechEngine';
import { playTwoStageAudio, stopTwoStageAudio } from './services/geminiAudioEngine';
import { DEFAULT_REGIONAL_FONTS } from './components/admin/VisualFontPicker';
import { DEFAULT_THEME_PALETTE } from './components/admin/ColorPaletteCustomizer';
import { t, translateCategoryName } from './services/uiTranslations';
import { getWhatsAppShareUrl } from './services/shareService';
import { getOfflineArticles, removeArticleOffline, syncLegacyBookmarks, getOfflineStorageMetrics } from './services/bookmarkStorageService';
import { calculateReadingTime } from './utils/readingTime';
import { formatPublishedTime, resolveStableArticleIso } from './utils/dateFormatter';
import { Clock, Eye, Sparkles, TrendingUp, Flame, ShieldCheck, Volume2, Pause, Play, Heart, Bookmark, Send, Share2, BarChart3, Vote, X, VolumeX, ThumbsUp, ThumbsDown, HelpCircle, Newspaper, Check, Radio, Lock } from 'lucide-react';

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

function formatSeoDocumentTitle(rawTitle) {
  const clean = String(rawTitle || 'PUBLIC SPARK').replace(/\s+/g, ' ').trim();
  if (clean.length <= 52) return `${clean} - PUBLIC SPARK`;
  return `${clean.slice(0, 49).trimEnd()}... - PUBLIC SPARK`;
}

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
    if (pathname === '/' || pathname === '') return { view: 'home' };
    if (pathname === '/search') return { view: 'search' };
    if (pathname === '/saved') return { view: 'home' };
    if (pathname === '/desk') return { view: 'login' };
    if (pathname === '/reporter') return { view: 'reporter' };
    if (pathname === '/editor') return { view: 'editor' };
    if (pathname === '/admin') return { view: 'admin' };
    if (pathname === '/developer' || pathname === '/rescue') return { view: 'developer' };
    if (pathname === '/staff' || pathname === '/login') return { view: 'login' };
    return { view: 'notfound', missingPath: pathname };
  } catch (e) {}
  return { view: 'home' };
}

export default function App() {
  const [theme, setTheme] = useState('light');
  const [isLoading, setIsLoading] = useState(false);
  const [articlesResolved, setArticlesResolved] = useState(false);

  // Failsafe Watchdog: Ensure loading screen NEVER stays for more than 1.5 seconds
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      setIsLoading(false);
      try { sessionStorage.setItem('ps_splash_shown', 'true'); } catch (e) {}
    }, 1500);
    return () => clearTimeout(safetyTimer);
  }, []);

  // Newsroom Staff Auth & 30-Minute Inactivity Watchdog State
  const [currentRole, setCurrentRole] = useState(() => {
    const token = getSessionToken();
    if (token) {
      const savedRole = getSessionRole();
      return savedRole === 'reader' ? 'visitor' : savedRole;
    }
    return 'visitor';
  });
  const [staffName, setStaffName] = useState(() => getSessionStaffName());
  const [isStaffLoginOpen, setIsStaffLoginOpen] = useState(() => {
    const route = parseRouteFromUrl();
    const token = getSessionToken();
    if (route.view === 'login' && token) return false;
    if (route.view === 'login') return true;
    if (['reporter', 'editor', 'admin', 'developer'].includes(route.view) && !token) return true;
    return false;
  });
  const [activeView, setActiveView] = useState(() => {
    const route = parseRouteFromUrl();
    const token = getSessionToken();
    const savedRole = getSessionRole();
    if (['reporter', 'editor', 'admin', 'developer'].includes(route.view) && !token) {
      return 'home';
    }
    if (route.view === 'login') {
      if (token && savedRole !== 'visitor') {
        return savedRole;
      }
      return 'home';
    }
    return route.view;
  }); // home | article | reporter | editor | admin | search

  // Register 30-minute inactivity watchdog & Browser Credential Cache Sanitizer
  useEffect(() => {
    initCredentialCacheSanitizer();

    const cleanupWatchdog = initInactivityWatchdog((reason) => {
      if (reason === 'inactivity') {
        setCurrentRole('visitor');
        setStaffName('');
        setActiveView('home');
        window.history.pushState({}, '', '/');
        document.title = 'PUBLIC SPARK - Breaking News & Live Updates';
        setToastMessage('Security Notice: You have been logged out due to 30 minutes of inactivity.');
        setIsToastOpen(true);
      }
    });
    return cleanupWatchdog;
  }, []);

  const handleStaffLoginSuccess = (role, name) => {
    setCurrentRole(role);
    setStaffName(name);
    const targetView = role;
    setActiveView(targetView);
    window.history.pushState({ view: targetView }, '', `/${targetView}`);
    document.title = `${targetView.toUpperCase()} Workspace - PUBLIC SPARK`;
    setToastMessage(`Welcome, ${name}! Logged in as ${role.toUpperCase()}.`);
    setIsToastOpen(true);
    // Hydrate full staff article feed (drafts, pending, scheduled) post-login
    fetch('/api/articles?scope=all', { headers: getAuthHeaders() })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const TEST_IDS = new Set(['art-1', 'art-2', 'art-3', 'art-4']);
          setBaseArticles(data.filter(a => !TEST_IDS.has(String(a.id))));
        }
      })
      .catch(() => {});
  };

  const handleStaffLogout = () => {
    clearStaffSession();
    setCurrentRole('visitor');
    setStaffName('');
    setBaseArticles(prev => prev.filter(a => a.status === 'published' || !a.status));
    setActiveView('home');
    window.history.pushState({}, '', '/');
    document.title = 'PUBLIC SPARK - Breaking News & Live Updates';
    setToastMessage('Signed out of Newsroom Staff Workspace.');
    setIsToastOpen(true);
  };

  const handleOpenStaffLogin = () => {
    const token = getSessionToken();
    const savedRole = getSessionRole();
    if (token && savedRole !== 'visitor') {
      setActiveView(savedRole);
      window.history.pushState({ view: savedRole }, '', `/${savedRole}`);
      return;
    }
    if (window.location.pathname !== '/login') {
      window.history.pushState({}, '', '/login');
    }
    document.title = 'Newsroom Staff Login - PUBLIC SPARK';
    setIsStaffLoginOpen(true);
  };
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedArticle, setSelectedArticle] = useState(() => {
    const route = parseRouteFromUrl();
    if (route.view === 'article' && route.idOrSlug) {
      const cached = getCachedNews();
      const articles = cached?.articles || [];
      return articles.find(a => a.id === route.idOrSlug || a.slug === route.idOrSlug) || null;
    }
    return null;
  });

  // Mandatory 5 Legal Pages Modal for Google AdSense Compliance
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState('privacy');

  // Statutory Grievance Redressal Modal (IT Rules 2021 India - Task 29)
  const [isGrievanceModalOpen, setIsGrievanceModalOpen] = useState(false);
  const [isTipModalOpen, setIsTipModalOpen] = useState(false);
  const [grievanceArticle, setGrievanceArticle] = useState(null);

  const handleOpenGrievance = (article = null) => {
    setGrievanceArticle(article || null);
    setIsGrievanceModalOpen(true);
  };

  // Dedicated Saved Stories Reading Drawer State (Task 28 Subtopic B)
  const [isSavedDrawerOpen, setIsSavedDrawerOpen] = useState(false);

  // Left-Side Animated Search Drawer State (Task 39 Subtopic A)
  const [isSearchDrawerOpen, setIsSearchDrawerOpen] = useState(false);

  // Multi-Language State (Default: Hindi 'hi', initialized cleanly from whitelisted ?lang= param)
  const [currentLanguage, setCurrentLanguage] = useState(() => {
    try {
      const qLang = new URLSearchParams(window.location.search).get('lang');
      if (qLang) {
        const matched = SUPPORTED_LANGUAGES.find(l => l.code.toLowerCase() === qLang.trim().toLowerCase());
        if (matched) return matched.code;
      }
    } catch (_e) {}
    return 'hi';
  });
  const handleLanguageChange = (newLang) => {
    const matched = SUPPORTED_LANGUAGES.find(l => l.code.toLowerCase() === String(newLang || '').toLowerCase());
    const safeLang = matched ? matched.code : 'hi';
    setCurrentLanguage(safeLang);
    try {
      const u = new URL(window.location.href);
      if (safeLang === 'hi') u.searchParams.delete('lang');
      else u.searchParams.set('lang', safeLang);
      window.history.replaceState(window.history.state || {}, '', `${u.pathname}${u.search}`);
    } catch (_e) {}
  };
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

  const [localizedPoll, setLocalizedPoll] = useState(null);

  // Localize poll question & options whenever language changes
  useEffect(() => {
    if (!pollData || !pollData.enabled || !pollData.question) return;
    if (currentLanguage === 'hi') {
      setLocalizedPoll(pollData);
      return;
    }

    let isSubscribed = true;
    async function translatePoll() {
      try {
        const items = [
          { id: 'poll_q', title: pollData.question, summary: '' },
          ...pollData.options.map(o => ({ id: o.id, title: o.label, summary: '' }))
        ];
        const res = await fetch('/api/translate/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items,
            targetLang: currentLanguage,
            source_lang: 'hi'
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.items) && isSubscribed) {
            const map = new Map(data.items.map(it => [String(it.id), it.title]));
            setLocalizedPoll({
              ...pollData,
              question: map.get('poll_q') || pollData.question,
              options: pollData.options.map(o => ({
                ...o,
                label: map.get(String(o.id)) || o.label
              }))
            });
          }
        }
      } catch (e) {
        console.warn('[Poll Translation Error]', e);
      }
    }
    translatePoll();
    return () => { isSubscribed = false; };
  }, [currentLanguage, pollData]);

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
    headingWeight: 800,
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
      if (cached) {
        const parsed = JSON.parse(cached);
        // Automatically upgrade stale legacy caches ("Inter" or weight < 750) to the new sovereign Playfair Display default
        if (parsed.headingFont === 'Inter' || (parsed.headingWeight && parsed.headingWeight < 750)) {
          return DEFAULT_TYPOGRAPHY;
        }
        return parsed;
      }
      return DEFAULT_TYPOGRAPHY;
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
    root.style.setProperty('--font-serif', `'${hFont}', 'Playfair Display', 'Rozha One', ${isSerif ? 'Georgia, serif' : 'sans-serif'}`);

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
    root.style.setProperty('--font-weight-heading', `${typography.headingWeight || 800}`);
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
        ...getAuthHeaders()
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
        ...getAuthHeaders()
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
      headers: { 
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
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
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
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

    const articlesEndpoint = getSessionToken() ? '/api/articles?scope=all' : '/api/articles';
    fetch(articlesEndpoint, {
      headers: getAuthHeaders()
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const TEST_IDS = new Set(['art-1', 'art-2', 'art-3', 'art-4']);
          const cleanServerData = data.filter(a => !TEST_IDS.has(String(a.id)));
          setBaseArticles(prev => {
            const serverIds = new Set(cleanServerData.map(a => String(a.id)));
            // Retain any articles created by reporter locally that server hasn't persisted yet (excluding test articles)
            const localOnly = prev.filter(p => !TEST_IDS.has(String(p.id)) && !serverIds.has(String(p.id)) && p.id && String(p.id).startsWith('art-') && p.status === 'pending');
            
            // Sync any local-only articles to backend in background
            if (localOnly.length > 0) {
              localOnly.forEach(art => {
                fetch('/api/articles/update', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                  body: JSON.stringify(art)
                }).catch(() => {});
              });
            }

            const merged = [...cleanServerData, ...localOnly];
            saveNewsToCache(merged);
            syncLegacyBookmarks(merged);
            return merged;
          });
        }
      })
      .catch(err => console.warn('[Backend Sync] Articles offline fallback:', err.message))
      .finally(() => setArticlesResolved(true));

    // Task 33 Subtopic C: Purge any legacy poisoned translation caches
    purgeCorruptedTranslationCache();

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
    return getCachedCategories() || DEFAULT_NEWSROOM_CATEGORIES;
  });

  useEffect(() => {
    saveCategoriesToCache(categories);
  }, [categories]);

  // Raw & Translated Articles State Management
  const [baseArticles, setBaseArticles] = useState(() => {
    const cached = getCachedNews();
    const list = cached?.articles || [];
    return list.filter(a => a && !['art-1', 'art-2', 'art-3', 'art-4'].includes(String(a.id)));
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
      // Task 32: If all base articles already match currentLanguage, skip translation
      const needsTranslation = baseArticles.some(a => (a.originalLanguage || 'hi').toLowerCase() !== currentLanguage.toLowerCase());
      if (!needsTranslation) {
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
    // Task 32/33: Pure master article resolution to prevent translated card headline from polluting reader
    const masterArticle = baseArticles.find(a => String(a.id) === String(art.id)) || art;
    setSelectedArticle(masterArticle);
    setActiveView('article');
    const cleanSlug = masterArticle.slug || masterArticle.id;
    const langSuffix = currentLanguage && currentLanguage !== 'hi' ? `?lang=${encodeURIComponent(currentLanguage)}` : '';
    window.history.pushState({ articleId: masterArticle.id, slug: cleanSlug }, '', `/article/${cleanSlug}${langSuffix}`);
    document.title = formatSeoDocumentTitle(masterArticle.title);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigate = (view) => {
    // Route guard for staff views: Prompt login modal if unauthenticated
    if (['reporter', 'editor', 'admin'].includes(view) && !getSessionToken()) {
      setIsStaffLoginOpen(true);
      return;
    }

    setActiveView(view);
    if (view === 'home') {
      setSelectedArticle(null);
      const langSuffix = currentLanguage && currentLanguage !== 'hi' ? `?lang=${encodeURIComponent(currentLanguage)}` : '';
      window.history.pushState({}, '', `/${langSuffix}`);
      document.title = 'PUBLIC SPARK - Breaking News & Live Updates';
    } else {
      window.history.pushState({}, '', `/${view}`);
      document.title = `${view.charAt(0).toUpperCase() + view.slice(1)} - PUBLIC SPARK`;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRoleChange = (role) => {
    if (['reporter', 'editor', 'admin'].includes(role) && !getSessionToken()) {
      setIsStaffLoginOpen(true);
      return;
    }
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
      if (route.view === 'login') {
        const token = getSessionToken();
        const savedRole = getSessionRole();
        if (token && savedRole !== 'visitor') {
          setActiveView(savedRole);
          document.title = `${savedRole.toUpperCase()} Workspace - PUBLIC SPARK`;
          return;
        }
        setIsStaffLoginOpen(true);
        setActiveView('home');
        document.title = 'Newsroom Staff Login - PUBLIC SPARK';
        return;
      }
      if (route.view === 'article' && route.idOrSlug) {
        const found = baseArticles.find(a => a.id === route.idOrSlug || a.slug === route.idOrSlug);
        if (found) {
          setSelectedArticle(found);
          setActiveView('article');
          document.title = formatSeoDocumentTitle(found.title);
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
        document.title = formatSeoDocumentTitle(found.title);
      }
    }
  }, [baseArticles, selectedArticle]);

  // Synchronize document <head> SEO tags (lang, robots noindex on private desks, canonical, Open Graph, NewsArticle JSON-LD)
  useEffect(() => {
    try {
      document.documentElement.lang = currentLanguage || 'hi';

      const setMetaTag = (attrName, attrVal, content) => {
        let el = document.querySelector(`meta[${attrName}="${attrVal}"]`);
        if (!el) {
          el = document.createElement('meta');
          el.setAttribute(attrName, attrVal);
          document.head.appendChild(el);
        }
        el.setAttribute('content', content);
      };

      const isNotFoundState = activeView === 'notfound' || (activeView === 'article' && !selectedArticle && articlesResolved);
      const isPrivateWorkspace = isNotFoundState || isStaffLoginOpen || ['reporter', 'editor', 'admin', 'developer', 'login', 'desk'].includes(activeView);
      if (isNotFoundState) {
        document.title = 'Page Not Found (404) - PUBLIC SPARK';
      }
      setMetaTag(
        'name',
        'robots',
        isPrivateWorkspace ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
      );

      const origin = window.location.origin;
      const defaultDesc = 'PUBLIC SPARK - Independent Digital Newsroom. Unbiased journalism, verified fact-checks, multi-language coverage across India.';
      const defaultImg = `${origin}/logo.png`;

      let canonicalBaseUrl = `${origin}/`;
      let pageDesc = defaultDesc;
      let ogTitle = 'PUBLIC SPARK - Independent Digital Newsroom';
      let ogImg = defaultImg;

      let ldScript = document.getElementById('dynamic-news-jsonld');

      if (activeView === 'article' && selectedArticle) {
        const slugOrId = selectedArticle.slug || selectedArticle.id;
        canonicalBaseUrl = `${origin}/article/${encodeURIComponent(slugOrId)}`;
        ogTitle = selectedArticle.title || ogTitle;
        pageDesc = String(selectedArticle.summary || selectedArticle.content || defaultDesc)
          .replace(/<[^>]+>/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 160);
        const rawImg = String(selectedArticle.image || selectedArticle.featured_image || '');
        if (rawImg && !rawImg.startsWith('data:')) {
          ogImg = rawImg.startsWith('http') ? rawImg : `${origin}${rawImg.startsWith('/') ? '' : '/'}${rawImg}`;
        }

        if (!ldScript) {
          ldScript = document.createElement('script');
          ldScript.id = 'dynamic-news-jsonld';
          ldScript.type = 'application/ld+json';
          document.head.appendChild(ldScript);
        }
        const stablePublishedIso = resolveStableArticleIso(selectedArticle);
        const stableModifiedIso = selectedArticle.updatedAt && !Number.isNaN(Date.parse(selectedArticle.updatedAt))
          ? new Date(selectedArticle.updatedAt).toISOString()
          : (selectedArticle.updated_at && !Number.isNaN(Date.parse(selectedArticle.updated_at))
            ? new Date(selectedArticle.updated_at).toISOString()
            : stablePublishedIso);
        const selfCanonical = currentLanguage && currentLanguage !== 'hi'
          ? `${canonicalBaseUrl}?lang=${encodeURIComponent(currentLanguage)}`
          : canonicalBaseUrl;
        document.title = formatSeoDocumentTitle(selectedArticle.title);
        ldScript.textContent = JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'NewsArticle',
              mainEntityOfPage: { '@type': 'WebPage', '@id': selfCanonical },
              headline: String(selectedArticle.title || '').slice(0, 110),
              description: pageDesc,
              image: [ogImg],
              datePublished: stablePublishedIso,
              dateModified: stableModifiedIso,
              author: { '@type': 'Person', name: selectedArticle.author?.name || selectedArticle.author || 'PublicSpark Desk' },
              publisher: {
                '@type': 'NewsMediaOrganization',
                name: 'PUBLIC SPARK',
                logo: { '@type': 'ImageObject', url: defaultImg, width: 492, height: 210 }
              }
            },
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
                { '@type': 'ListItem', position: 2, name: String(selectedArticle.category || 'News'), item: `${origin}/` },
                { '@type': 'ListItem', position: 3, name: String(selectedArticle.title || 'Story').slice(0, 110), item: selfCanonical }
              ]
            }
          ]
        });
      } else {
        if (activeView === 'saved') canonicalBaseUrl = `${origin}/saved`;
        else if (activeView === 'search') canonicalBaseUrl = `${origin}/search`;
        if (ldScript) ldScript.remove();
      }

      const canonicalUrl = currentLanguage && currentLanguage !== 'hi'
        ? `${canonicalBaseUrl}?lang=${encodeURIComponent(currentLanguage)}`
        : canonicalBaseUrl;

      let canonicalEl = document.querySelector('link[rel="canonical"]');
      if (!canonicalEl) {
        canonicalEl = document.createElement('link');
        canonicalEl.setAttribute('rel', 'canonical');
        document.head.appendChild(canonicalEl);
      }
      canonicalEl.setAttribute('href', canonicalUrl);

      document.querySelectorAll('link[data-ps-hreflang="true"]').forEach(el => el.remove());
      if (!isPrivateWorkspace) {
        const appendHreflang = (langCode, href) => {
          const linkEl = document.createElement('link');
          linkEl.setAttribute('rel', 'alternate');
          linkEl.setAttribute('hreflang', langCode);
          linkEl.setAttribute('href', href);
          linkEl.setAttribute('data-ps-hreflang', 'true');
          document.head.appendChild(linkEl);
        };
        appendHreflang('x-default', canonicalBaseUrl);
        SUPPORTED_LANGUAGES.forEach(l => {
          const href = l.code === 'hi' ? canonicalBaseUrl : `${canonicalBaseUrl}?lang=${encodeURIComponent(l.code)}`;
          appendHreflang(l.code, href);
        });
      }

      setMetaTag('name', 'description', pageDesc);
      setMetaTag('property', 'og:title', ogTitle);
      setMetaTag('property', 'og:description', pageDesc);
      setMetaTag('property', 'og:image', ogImg);
      setMetaTag('property', 'og:url', canonicalUrl);
      setMetaTag('name', 'twitter:title', ogTitle);
      setMetaTag('name', 'twitter:description', pageDesc);
      setMetaTag('name', 'twitter:image', ogImg);
    } catch (_e) {
      // Non-blocking SEO head sync
    }
  }, [activeView, selectedArticle, currentLanguage, isStaffLoginOpen, articlesResolved]);

  const isAudioAllowed = isAudioSupportedLanguage(currentLanguage);

  // Stop active mini-player cleanly if reader switches to a non-audio language
  useEffect(() => {
    if (!isAudioAllowed && playingArticleId) {
      stopTwoStageAudio();
      stopAudioSpeech();
      setPlayingArticleId(null);
      setPlayingArticle(null);
    }
  }, [isAudioAllowed, playingArticleId]);

  // 1-Click Unified 1-Call Audio Trigger for Homepage Cards / Shelves / Drawers
  const handleQuickAudioRead = async (e, article) => {
    e.stopPropagation();

    if (!isAudioAllowed) {
      stopTwoStageAudio();
      stopAudioSpeech();
      setPlayingArticleId(null);
      setPlayingArticle(null);
      return;
    }

    if (playingArticleId === article.id) {
      stopTwoStageAudio();
      stopAudioSpeech();
      setPlayingArticleId(null);
      setPlayingArticle(null);
      return;
    }

    stopTwoStageAudio();
    stopAudioSpeech();

    const masterArticle = baseArticles.find(a => String(a.id) === String(article.id)) || article;
    const origLang = (masterArticle.originalLanguage || 'hi').toLowerCase();
    const targetLang = String(currentLanguage || 'hi').toLowerCase();
    let audioStory = masterArticle;

    if (targetLang !== origLang) {
      try {
        audioStory = await translateArticle(masterArticle, targetLang, { includeContent: true });
      } catch (_err) {}
    }

    setPlayingArticleId(article.id);
    setPlayingArticle(audioStory);

    const hl = Array.isArray(audioStory.highlights) && audioStory.highlights.length > 0
      ? audioStory.highlights
      : (audioStory.summary ? [audioStory.summary] : []);
    const fullText = [audioStory.title, ...hl, audioStory.content || ''].filter(Boolean).join('. ');

    playTwoStageAudio({
      articleId: article.id,
      lang: targetLang,
      title: audioStory.title || '',
      highlights: hl,
      body: audioStory.content || '',
      onStart: () => { setPlayingArticleId(article.id); setPlayingArticle(audioStory); },
      onPlay: () => { setPlayingArticleId(article.id); setPlayingArticle(audioStory); },
      onEnd: () => { setPlayingArticleId(null); setPlayingArticle(null); },
      onFallbackToBrowser: () => {
        speakWithBrowserSpeechOnly({
          text: fullText,
          langCode: targetLang,
          onStart: () => { setPlayingArticleId(article.id); setPlayingArticle(audioStory); },
          onPlay: () => { setPlayingArticleId(article.id); setPlayingArticle(audioStory); },
          onEnd: () => { setPlayingArticleId(null); setPlayingArticle(null); }
        });
      }
    });
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
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
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
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
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
        if (activeCategory === 'all') return true;
        const normActive = activeCategory.toLowerCase();
        const normSlug = (art.category_slug || '').toLowerCase();
        const normCat = (art.category || '').toLowerCase();
        const categoryObj = (categories || []).find(c => c.slug?.toLowerCase() === normActive || c.name?.toLowerCase() === normActive);
        const normCatObjName = (categoryObj?.name || '').toLowerCase();
        const normCatObjSlug = (categoryObj?.slug || '').toLowerCase();

        return (
          normSlug === normActive ||
          normCat === normActive ||
          (normCatObjName && normCat === normCatObjName) ||
          (normCatObjSlug && normSlug === normCatObjSlug)
        );
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
        onLanguageChange={handleLanguageChange}
        isTranslating={isTranslating}
        categories={categories}
        articles={publishedArticles}
        onOpenSavedDrawer={() => setIsSavedDrawerOpen(true)}
        onOpenSearchDrawer={() => setIsSearchDrawerOpen(true)}
        onOpenStaffLogin={handleOpenStaffLogin}
        onStaffLogout={handleStaffLogout}
        staffName={staffName}
      />

      {/* Main Content Area */}
      <main style={{ flex: 1 }}>
        {/* PUBLIC HOME PAGE */}
        {activeView === 'home' && (
          <div className="container" style={{ padding: '1.5rem 1.25rem' }}>
            <h1 className="sr-only">पब्लिक स्पार्क - स्वतंत्र डिजिटल न्यूज़रूम | PUBLIC SPARK</h1>
            
            {/* DEDICATED BOOKMARKS VIEW */}
            {activeCategory === 'bookmarks' ? (
              <div style={{ padding: '1rem 0 3rem 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', borderBottom: '2px solid var(--accent-crimson)', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-main)', margin: 0 }}>
                    <Bookmark size={24} color="var(--accent-crimson)" fill="var(--accent-crimson)" /> {t('savedBookmarks', currentLanguage)} ({displayedArticles.length})
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-subtle)', background: 'var(--bg-secondary)', padding: '0.2rem 0.55rem', borderRadius: '4px', border: '1px solid var(--border-medium)', fontFamily: 'var(--font-mono)' }}>
                      {getOfflineStorageMetrics().formattedSize} • {t('offlineStorage', currentLanguage) || 'ऑफ़लाइन संग्रहण'}
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
                            {isAudioAllowed && (
                              <button 
                                onClick={(e) => handleQuickAudioRead(e, art)}
                                className="btn btn-outline"
                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                              >
                                {playingArticleId === art.id ? <Pause size={12} /> : <Volume2 size={12} />}
                                {playingArticleId === art.id ? t('playing', currentLanguage) : t('listen', currentLanguage)}
                              </button>
                            )}
                            <button 
                              onClick={(e) => handleRemoveBookmark(e, art)}
                              className="btn"
                              style={{ padding: '0.2rem 0.65rem', fontSize: '0.7rem', borderRadius: '20px', background: 'var(--accent-crimson)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                              title={t('remove', currentLanguage)}
                            >
                              <X size={11} /> {t('remove', currentLanguage)}
                            </button>
                          </div>
                        </div>
                        <h3 className="story-card-title" style={{ fontSize: '1.1rem', fontWeight: '800', lineHeight: '1.35', marginBottom: '0.5rem' }}>
                          <ArticleLink article={art} onSelect={handleSelectArticle}>{art.title}</ArticleLink>
                        </h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: '0.75rem' }}>
                          {art.excerpt}
                        </p>
                        <div className="story-meta" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-subtle)', flexWrap: 'wrap' }}>
                          <span>{t('byAuthor', currentLanguage)} {art.author?.name || t('editorialDesk', currentLanguage) || 'संपादकीय डेस्क'}</span>
                          <span>• <Clock size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> {art.reading_time_mins || calculateReadingTime(art.content || '', currentLanguage)?.minutes || 1} {t('minsRead', currentLanguage)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-subtle)', background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--accent-crimson)', margin: '1rem 0' }}>
                    <Bookmark size={48} color="var(--accent-crimson)" style={{ marginBottom: '0.75rem' }} />
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
                          {isAudioAllowed && (
                            <button 
                              onClick={(e) => handleQuickAudioRead(e, heroArticle)}
                              className="btn btn-outline"
                              style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                              title={t('listenToStory', currentLanguage)}
                            >
                              {playingArticleId === heroArticle.id ? <Pause size={12} color="var(--accent-crimson)" /> : <Volume2 size={12} color="var(--accent-crimson)" />}
                              <span className="hide-on-mobile">{playingArticleId === heroArticle.id ? t('playing', currentLanguage) : t('listen', currentLanguage)}</span>
                            </button>
                          )}

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
                              color: 'var(--text-main)',
                              borderColor: 'var(--border-medium)',
                              background: 'var(--bg-surface)',
                              textDecoration: 'none',
                              fontWeight: '700'
                            }}
                            title="Share on WhatsApp (व्हाट्सएप बुलेटिन शेयर करें)"
                          >
                            <WhatsAppIcon size={13} color="var(--text-main)" />
                            <span className="hide-on-mobile">WhatsApp</span>
                          </a>
                        </div>
                      </div>

                      <h2 className="story-card-title">
                        <ArticleLink article={heroArticle} onSelect={handleSelectArticle}>{heroArticle.title}</ArticleLink>
                      </h2>
                      {(heroArticle.summary || heroArticle.sub_title || heroArticle.excerpt) && (
                        <p className="story-excerpt" style={{ margin: '0.25rem 0 0.5rem 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {heroArticle.summary || heroArticle.sub_title || heroArticle.excerpt}
                        </p>
                      )}
                      <div className="story-meta" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.8rem' }}>
                        <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>{t('byAuthor', currentLanguage)} {heroArticle.author?.name || 'Staff Reporter'}</span>
                        <span>• {formatPublishedTime(heroArticle.published_at, currentLanguage)}</span>
                        <span>• <Clock size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> {heroArticle.reading_time_mins || calculateReadingTime(heroArticle.content || '', currentLanguage)?.minutes || 1} {t('minsRead', currentLanguage)}</span>
                      </div>
                    </div>

                    {/* Secondary Column */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {secondaryArticles.length > 0 ? (
                        secondaryArticles.map((art) => (
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
                                  {isAudioAllowed && (
                                    <button 
                                      onClick={(e) => handleQuickAudioRead(e, art)}
                                      className="btn btn-outline"
                                      style={{ padding: '0.15rem 0.45rem', fontSize: '0.7rem', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                    >
                                      {playingArticleId === art.id ? <Pause size={11} /> : <Volume2 size={11} />}
                                      <span className="hide-on-mobile">{playingArticleId === art.id ? t('playing', currentLanguage) : t('listen', currentLanguage)}</span>
                                    </button>
                                  )}
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
                                      color: 'var(--text-main)',
                                      borderColor: 'var(--border-medium)',
                                      background: 'var(--bg-surface)',
                                      textDecoration: 'none'
                                    }}
                                    title="Share on WhatsApp"
                                  >
                                    <WhatsAppIcon size={11} color="var(--text-main)" />
                                  </a>
                                </div>
                              </div>
                              <h3 className="story-card-title">
                                <ArticleLink article={art} onSelect={handleSelectArticle}>{art.title}</ArticleLink>
                              </h3>
                              <div className="story-meta" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.35rem', fontSize: '0.75rem' }}>
                                <span>{formatPublishedTime(art.published_at, currentLanguage)}</span>
                                <span>• <Clock size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> {art.reading_time_mins || calculateReadingTime(art.content || '', currentLanguage)?.minutes || 1} {t('minsRead', currentLanguage)}</span>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{
                          background: 'var(--bg-surface)',
                          border: '1px dashed var(--border-medium)',
                          borderRadius: 'var(--radius-bento)',
                          padding: '1.75rem 1.25rem',
                          textAlign: 'center',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minHeight: '260px'
                        }}>
                          <Newspaper size={34} color="var(--accent-crimson)" style={{ marginBottom: '0.75rem', opacity: 0.85 }} />
                          <h4 style={{ fontSize: '0.925rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                            {t('editorialDesk', currentLanguage) || 'संपादकीय ब्यूरो'}
                          </h4>
                          <p style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', lineHeight: '1.5', maxWidth: '240px' }}>
                            {t('reportingInProgressDesc', currentLanguage) || 'हमारे संवाददाता इस विषय पर तथ्य व ज़मीनी रिपोर्ट जुटा रहे हैं। तब तक आज की मुख्य खबरें नीचे पढ़ें।'}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Opinion & Trending Column */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {publishedArticles[3] && (
                        <div className="opinion-box">
                          <div className="opinion-header">
                            <Sparkles size={14} /> {t('editorsSpotlight', currentLanguage)}
                          </div>
                          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.15rem', fontWeight: 'var(--font-weight-heading, 800)', lineHeight: '1.35', cursor: 'pointer', marginBottom: '0.6rem' }}>
                            <ArticleLink article={publishedArticles[3]} onSelect={handleSelectArticle}>{publishedArticles[3].title}</ArticleLink>
                          </h3>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', fontWeight: '600' }}>
                            {t('byAuthor', currentLanguage)} {publishedArticles[3]?.author?.name || t('editorialDesk', currentLanguage) || 'संपादकीय डेस्क'}
                          </div>
                        </div>
                      )}

                      {publishedArticles.length > 1 && (
                        <div className="trending-widget">
                          <h4 style={{ fontSize: '0.8rem', fontWeight: '900', textTransform: 'uppercase', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-crimson)', letterSpacing: '0.08em' }}>
                            <TrendingUp size={15} /> {t('topTrendingStories', currentLanguage)}
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {publishedArticles.slice(1, 4).map((art, idx) => (
                            <div key={art.id} className="trending-item" onClick={() => handleSelectArticle(art)} style={{ cursor: 'pointer' }}>
                              <span className="trending-rank">0{idx + 1}</span>
                              <div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 'var(--font-weight-heading, 800)', lineHeight: '1.3' }}>
                                  <ArticleLink article={art} onSelect={handleSelectArticle}>{art.title}</ArticleLink>
                                </div>
                                <div style={{ fontSize: '0.725rem', color: 'var(--text-subtle)', marginTop: '0.2rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                  <span>{translateCategoryName(art.category, currentLanguage)}</span>
                                  <span>•</span>
                                  <span>{formatPublishedTime(art.published_at, currentLanguage)}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      )}

                      {/* Interactive Daily Public Voice Poll Widget (Controlled via Admin Desk & Localized) */}
                      {(() => {
                        const activePoll = localizedPoll || pollData;
                        if (!activePoll || !activePoll.enabled) return null;
                        return (
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
                              "{activePoll.question}"
                            </h4>

                            {!userVotedChoice ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {activePoll.options.map((opt, i) => {
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
                                  const totalVotes = activePoll.options.reduce((sum, o) => sum + (o.votes || 0), 0);
                                  return (
                                    <>
                                      {activePoll.options.map((opt, i) => {
                                        const pct = totalVotes > 0 ? Math.round(((opt.votes || 0) / totalVotes) * 100) : 0;
                                        const barColor = i === 0 ? 'var(--accent-indigo)' : i === 1 ? 'var(--accent-crimson)' : 'var(--accent-amber)';
                                        const isChosen = userVotedChoice === opt.id;

                                        return (
                                          <div key={opt.id}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: '800', marginBottom: '0.2rem', gap: '0.5rem' }}>
                                              <span style={{ color: isChosen ? 'var(--accent-indigo)' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', wordBreak: 'break-word' }}>
                                                {opt.label} ({opt.votes || 0})
                                                {isChosen && <span style={{ fontSize: '0.68rem', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-indigo)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>{t('yourChoice', currentLanguage)}</span>}
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
                        );
                      })()}

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
                                {art.featured_image ? (
                                  <img src={art.featured_image} alt={art.title} loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: 'var(--text-subtle)', background: 'var(--bg-secondary)' }}>
                                    <Newspaper size={28} />
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
                                  {isAudioAllowed && (
                                    <button 
                                      onClick={(e) => handleQuickAudioRead(e, art)}
                                      className="btn btn-outline"
                                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                                    >
                                      {playingArticleId === art.id ? <Pause size={12} /> : <Volume2 size={12} />}
                                      {playingArticleId === art.id ? t('playing', currentLanguage) : t('listen', currentLanguage)}
                                    </button>
                                  )}
                                </div>
                              </div>
                              <h3 className="story-card-title">
                                <ArticleLink article={art} onSelect={handleSelectArticle}>{art.title}</ArticleLink>
                              </h3>
                              <div className="story-meta" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span>{art.author?.name || 'Staff Reporter'}</span>
                                <span>•</span>
                                <span>{formatPublishedTime(art.published_at, currentLanguage)}</span>
                                <span>•</span>
                                <span><Clock size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> {art.reading_time_mins || calculateReadingTime(art.content || '', currentLanguage)?.minutes || 1} {t('minsRead', currentLanguage)}</span>
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
                          <span>{t('videoCoverage', currentLanguage)}</span>
                        </h3>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', fontWeight: '700' }}>
                          {videoArticles.length} {t('videosAvailable', currentLanguage)}
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
                                <ArticleLink article={art} onSelect={handleSelectArticle}>{art.title}</ArticleLink>
                              </h4>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: '0.35rem' }}>
                                {art.author?.name || 'PublicSpark Desk'} • {formatPublishedTime(art.published_at, currentLanguage)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })()}

                {/* Newsroom Library — Dynamic Category Shelves Engine (Task 39 Subtopic B) */}
                {activeCategory === 'all' && (
                  <CategoryShelvesSection
                    categories={categories}
                    articles={publishedArticles}
                    currentLanguage={currentLanguage}
                    onSelectArticle={handleSelectArticle}
                    onSelectCategory={setActiveCategory}
                    onQuickAudioRead={isAudioAllowed ? handleQuickAudioRead : null}
                    playingArticleId={playingArticleId}
                  />
                )}

                {/* Remaining Grid Stories (Category Filter View when activeCategory !== 'all') */}
                {activeCategory !== 'all' && remainingArticles.length > 0 && (
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
                                {isAudioAllowed && (
                                  <button 
                                    onClick={(e) => handleQuickAudioRead(e, art)}
                                    className="btn btn-outline"
                                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                                  >
                                    {playingArticleId === art.id ? <Pause size={12} /> : <Volume2 size={12} />}
                                    {playingArticleId === art.id ? t('playing', currentLanguage) : t('listen', currentLanguage)}
                                  </button>
                                )}
                              </div>
                            </div>
                            <h3 className="story-card-title" style={{ fontSize: '1.1rem', lineHeight: '1.35', marginBottom: '0.5rem' }}>
                              <ArticleLink article={art} onSelect={handleSelectArticle}>{art.title}</ArticleLink>
                            </h3>
                            <div className="story-meta" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                              <span>{art.author?.name || 'Staff Reporter'}</span>
                              <span>•</span>
                              <span>{formatPublishedTime(art.published_at, currentLanguage)}</span>
                              <span>•</span>
                              <span><Clock size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> {art.reading_time_mins || calculateReadingTime(art.content || '', currentLanguage)?.minutes || 1} {t('minsRead', currentLanguage)}</span>
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
        {activeView === 'article' && selectedArticle && (
          <ArticleReader 
            article={selectedArticle}
            articles={baseArticles}
            onBack={() => handleNavigate('home')} 
            onSelectArticle={handleSelectArticle}
            currentLanguage={currentLanguage}
            onShowToast={(msg) => { setToastMessage(msg); setIsToastOpen(true); }}
            onOpenGrievance={handleOpenGrievance}
          />
        )}

        {/* 404 NOT FOUND VIEW (Prevents Soft-404 Homepage Mirroring on Invalid URLs / Slugs) */}
        {(activeView === 'notfound' || (activeView === 'article' && !selectedArticle && articlesResolved)) && (
          <div className="container" style={{ padding: '4rem 1.25rem', maxWidth: '680px', margin: '0 auto', textAlign: 'center' }}>
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-medium)',
              borderTop: '4px solid var(--accent-crimson)',
              borderRadius: '4px',
              padding: '2.5rem 1.5rem'
            }}>
              <div style={{ fontSize: '0.8rem', fontWeight: '800', letterSpacing: '0.1em', color: 'var(--accent-crimson)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                HTTP 404 • Not Found
              </div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: '900', color: 'var(--text-main)', margin: '0 0 0.75rem 0' }}>
                यह समाचार या पृष्ठ उपलब्ध नहीं है
              </h1>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', lineHeight: '1.6', margin: '0 auto 1.5rem auto', maxWidth: '480px' }}>
                The requested article or page could not be found. It may have been removed or the URL may be incorrect.
              </p>
              <button
                type="button"
                onClick={() => handleNavigate('home')}
                className="btn btn-primary"
                style={{ minHeight: '44px', padding: '0.65rem 1.5rem', fontWeight: '800', fontSize: '0.92rem' }}
              >
                मुख्य पृष्ठ पर लौटें (Back to Frontpage)
              </button>
            </div>
          </div>
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
            staffName={getSessionStaffName()}
            staffEmail={getSessionStaffEmail()}
          />
        )}

        {activeView === 'editor' && (
          <EditorWorkspace 
            pendingArticles={pendingArticles}
            publishedArticles={baseArticles}
            onApproveArticle={handleApproveArticle}
            onRejectArticle={handleRejectArticle}
            onShowToast={(msg) => { setToastMessage(msg); setIsToastOpen(true); }}
          />
        )}

        {(activeView === 'admin' || activeView === 'developer') && (
          <AdminWorkspace 
            currentRole={currentRole}
            initialDesk={currentRole === 'developer' || activeView === 'developer' ? 'developer' : 'curation'}
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
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', maxWidth: '420px', lineHeight: '1.7', marginBottom: '1.25rem' }}>
                पब्लिक स्पार्क आपको भ्रष्टाचार से संबंधित तथ्यात्मक खबरें, ज्योतिष, धर्म, पर्यटन आदि के बारे में संबंधित क्षेत्र के विशेषज्ञों के विचार और जानकारी उपलब्ध कराने का सशक्त माध्यम है।
              </p>

              {/* Official Social Media Channel Icons */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                {/* WhatsApp */}
                <a 
                  href={getFormattedWhatsAppLink(socialLinks.whatsapp)} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    width: '44px', 
                    height: '44px', 
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
                  <WhatsAppIcon size={20} color="#ffffff" />
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
                    width: '44px', 
                    height: '44px', 
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
                  <InstagramIcon size={20} color="#ffffff" />
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
                    width: '44px', 
                    height: '44px', 
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
                  <FacebookIcon size={20} color="#ffffff" />
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
                    width: '44px', 
                    height: '44px', 
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
                  <XTwitterIcon size={20} color="#ffffff" />
                </a>
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: '0.85rem', fontWeight: '900', textTransform: 'uppercase', color: 'var(--text-subtle)', marginBottom: '0.85rem', letterSpacing: '0.08em' }}>
                मानक व नीतियां (Standards)
              </h4>
              <ul style={{ listStyle: 'none', fontSize: '0.875rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <li>
                  <button type="button" className="footer-nav-link" onClick={() => { setLegalModalTab('ethics'); setIsLegalModalOpen(true); }}>
                    संपादकीय आचार संहिता (Ethics)
                  </button>
                </li>
                <li>
                  <button type="button" className="footer-nav-link" onClick={() => { setLegalModalTab('accessibility'); setIsLegalModalOpen(true); }}>
                    सुलभता व पाठक सहायता (Accessibility)
                  </button>
                </li>
                <li>
                  <button type="button" className="footer-nav-link" onClick={() => { setLegalModalTab('advertise'); setIsLegalModalOpen(true); }}>
                    विज्ञापन दें (Direct Sponsor)
                  </button>
                </li>
                <li>
                  <button type="button" className="footer-nav-link" onClick={() => { setLegalModalTab('contact'); setIsLegalModalOpen(true); }}>
                    शिकायत निवारण अधिकारी (IT Rules)
                  </button>
                </li>
                <li>
                  <button type="button" className="footer-nav-link" style={{ color: 'var(--accent-crimson)', fontWeight: 800 }} onClick={() => setIsTipModalOpen(true)}>
                    गुप्त सूचना / खबर भेजें (Send Tip)
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h4 style={{ fontSize: '0.85rem', fontWeight: '900', textTransform: 'uppercase', color: 'var(--text-subtle)', marginBottom: '0.85rem', letterSpacing: '0.08em' }}>
                विधिक व अनुपालन (Compliance)
              </h4>
              <ul style={{ listStyle: 'none', fontSize: '0.875rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <li>
                  <button type="button" className="footer-nav-link" onClick={() => { setLegalModalTab('terms'); setIsLegalModalOpen(true); }}>
                    सेवा की शर्तें (Terms of Use)
                  </button>
                </li>
                <li>
                  <button type="button" className="footer-nav-link" onClick={() => { setLegalModalTab('privacy'); setIsLegalModalOpen(true); }}>
                    गोपनीयता नीति (Privacy Policy)
                  </button>
                </li>
                <li>
                  <button type="button" className="footer-nav-link" onClick={() => { setLegalModalTab('cookies'); setIsLegalModalOpen(true); }}>
                    डेटा व कुकी नियंत्रण (Do Not Sell Info)
                  </button>
                </li>
                <li>
                  <button type="button" className="footer-nav-link" onClick={() => { setLegalModalTab('disclaimer'); setIsLegalModalOpen(true); }}>
                    सुरक्षित आश्रय (Safe Harbor)
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* BBC-Style Institutional Horizontal Compliance Strip */}
          <nav className="footer-compliance-strip" aria-label="Institutional Legal & Compliance Policies">
            <button 
              type="button"
              className="footer-compliance-link"
              onClick={() => { setLegalModalTab('terms'); setIsLegalModalOpen(true); }}
            >
              सेवा की शर्तें
            </button>
            <span className="footer-compliance-divider" aria-hidden="true">•</span>

            <button 
              type="button"
              className="footer-compliance-link"
              onClick={() => { setLegalModalTab('privacy'); setIsLegalModalOpen(true); }}
            >
              गोपनीयता नीति
            </button>
            <span className="footer-compliance-divider" aria-hidden="true">•</span>

            <button 
              type="button"
              className="footer-compliance-link"
              onClick={() => { setLegalModalTab('cookies'); setIsLegalModalOpen(true); }}
            >
              डेटा नियंत्रण (Do Not Sell Info)
            </button>
            <span className="footer-compliance-divider" aria-hidden="true">•</span>

            <button 
              type="button"
              className="footer-compliance-link"
              onClick={() => { setLegalModalTab('accessibility'); setIsLegalModalOpen(true); }}
            >
              सुलभता व सहायता
            </button>
            <span className="footer-compliance-divider" aria-hidden="true">•</span>

            <button 
              type="button"
              className="footer-compliance-link"
              onClick={() => { setLegalModalTab('advertise'); setIsLegalModalOpen(true); }}
            >
              विज्ञापन दें
            </button>
            <span className="footer-compliance-divider" aria-hidden="true">•</span>

            <button 
              type="button"
              className="footer-compliance-link"
              onClick={() => { setLegalModalTab('ethics'); setIsLegalModalOpen(true); }}
            >
              संपादकीय आचार संहिता
            </button>
            <span className="footer-compliance-divider" aria-hidden="true">•</span>

            <button 
              type="button"
              className="footer-compliance-link"
              onClick={() => { setLegalModalTab('contact'); setIsLegalModalOpen(true); }}
            >
              शिकायत निवारण (IT Rules 2021)
            </button>
            <span className="footer-compliance-divider" aria-hidden="true">•</span>

            <button 
              type="button"
              className="footer-compliance-link"
              onClick={() => { setLegalModalTab('disclaimer'); setIsLegalModalOpen(true); }}
            >
              सुरक्षित आश्रय अस्वीकरण
            </button>
            <span className="footer-compliance-divider" aria-hidden="true">•</span>

            <button
              type="button"
              className="footer-compliance-link"
              style={{ color: 'var(--accent-crimson)', fontWeight: 800 }}
              onClick={() => setIsTipModalOpen(true)}
            >
              गुप्त सूचना केंद्र (Send Tip)
            </button>
          </nav>

          {/* Editorial, Regional & Safe Harbor Disclaimers (Task 38 Subtopic B) */}
          <div className="footer-editorial-disclaimer" role="note" aria-label="Editorial and Regional Disclaimers">
            <div>
              <strong style={{ color: 'var(--text-main)' }}>संपादकीय एवं क्षेत्रीय अस्वीकरण:</strong> भ्रष्टाचार-विरोधी एवं जनसरोकार से जुड़ी खबरें आधिकारिक दस्तावेजों, आरटीआई (RTI) एवं प्रमाणित तथ्यों पर आधारित होती हैं। ज्योतिष, धर्म एवं पर्यटन विषयक सामग्री संबंधित क्षेत्र के विशेषज्ञों के निजी विचार व सांस्कृतिक जानकारी मात्र हैं, जिनका उद्देश्य केवल पाठक जागरूकता है।
            </div>
            <div className="footer-editorial-disclaimer-row">
              <span>बाहरी वेबसाइटों की सामग्री के लिए पब्लिक स्पार्क उत्तरदायी नहीं है।</span>
              <button
                type="button"
                className="footer-safe-harbor-link"
                onClick={() => { setLegalModalTab('disclaimer'); setIsLegalModalOpen(true); }}
              >
                बाहरी लिंक्स के प्रति हमारी नीति पढ़ें
              </button>
              <span className="footer-compliance-divider" aria-hidden="true">|</span>
              <span>संपादकीय संपर्क: <strong style={{ color: 'var(--text-main)' }}>publicspark.in@gmail.com</strong></span>
              <span className="footer-compliance-divider" aria-hidden="true">|</span>
              <button
                type="button"
                className="footer-safe-harbor-link"
                onClick={() => { setLegalModalTab('contact'); setIsLegalModalOpen(true); }}
              >
                शिकायत निवारण प्रकोष्ठ (IT Rules 2021)
              </button>
            </div>
          </div>

          <div style={{ 
            borderTop: '1px solid var(--border-light)', 
            paddingTop: '1.25rem', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            flexWrap: 'wrap', 
            gap: '1rem', 
            fontSize: '0.8rem', 
            color: 'var(--text-subtle)' 
          }}>
            <div>
              © 2026 PublicSpark Newsroom Platform. सर्वाधिकार सुरक्षित • Built with precision for human journalism.
            </div>
            <div>
              <button
                onClick={handleOpenStaffLogin}
                style={{
                  background: 'none',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-sm, 4px)',
                  minHeight: '44px',
                  padding: '0.45rem 0.95rem',
                  color: 'var(--text-subtle)',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--accent-crimson)';
                  e.currentTarget.style.borderColor = 'var(--accent-crimson)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-subtle)';
                  e.currentTarget.style.borderColor = 'var(--border-medium)';
                }}
                title="Newsroom Staff Login"
              >
                <Lock size={12} color="var(--accent-crimson)" />
                <span>Staff & Editorial Portal</span>
              </button>
            </div>
          </div>
        </div>
      </footer>

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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.7rem', fontWeight: '800', color: 'var(--accent-crimson)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <Volume2 size={12} /> {t('nowReadingAudio', currentLanguage)}
              </div>
              <div style={{ fontSize: '0.875rem', fontWeight: '800', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-main)' }}>
                {playingArticle?.title || 'Playing News Article...'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => {
                stopTwoStageAudio();
                stopAudioSpeech();
                setPlayingArticleId(null);
                setPlayingArticle(null);
              }}
              className="btn btn-primary"
              style={{ padding: '0.35rem 0.8rem', fontSize: '0.75rem', borderRadius: '20px', minHeight: '36px' }}
            >
              {t('stopAudio', currentLanguage)}
            </button>
            <button
              type="button"
              onClick={() => {
                stopTwoStageAudio();
                stopAudioSpeech();
                setPlayingArticleId(null);
                setPlayingArticle(null);
              }}
              style={{ background: 'none', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer', padding: '0.2rem', minWidth: '36px', minHeight: '36px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              title="Close Audio Bar"
              aria-label="Close Audio Bar"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Dedicated Saved Stories Reading Drawer (Task 28 Subtopic B) */}
      <SavedStoriesDrawer
        isOpen={isSavedDrawerOpen}
        onClose={() => setIsSavedDrawerOpen(false)}
        onSelectArticle={handleSelectArticle}
        onViewAllBookmarks={() => {
          setActiveCategory('bookmarks');
          setActiveView('home');
        }}
        currentLanguage={currentLanguage}
      />

      {/* Left-Side Animated Search Drawer (Task 39 Subtopic A) */}
      <SearchDrawer
        isOpen={isSearchDrawerOpen}
        onClose={() => setIsSearchDrawerOpen(false)}
        articles={publishedArticles}
        categories={categories}
        currentLanguage={currentLanguage}
        onSelectArticle={handleSelectArticle}
        onSelectCategory={setActiveCategory}
      />

      {/* Mandatory 5 Legal Pages Modal for Google AdSense Compliance */}
      <LegalModal 
        isOpen={isLegalModalOpen} 
        onClose={() => setIsLegalModalOpen(false)} 
        initialTab={legalModalTab} 
        currentLanguage={currentLanguage} 
        onOpenGrievance={() => handleOpenGrievance(null)}
      />

      {/* Newsroom Staff RBAC Modal (Task 17 Subtopic 17.2) */}
      <StaffLoginModal
        isOpen={isStaffLoginOpen}
        onClose={() => {
          setIsStaffLoginOpen(false);
          if (window.location.pathname === '/login' || window.location.pathname === '/staff') {
            window.history.replaceState({}, '', '/');
            document.title = 'PUBLIC SPARK - Breaking News & Live Updates';
          }
        }}
        onLoginSuccess={handleStaffLoginSuccess}
      />

      {/* Statutory Grievance Redressal Modal (IT Rules 2021 India - Task 29 Subtopic A) */}
      <GrievanceModal
        isOpen={isGrievanceModalOpen}
        onClose={() => {
          setIsGrievanceModalOpen(false);
          setGrievanceArticle(null);
        }}
        initialArticle={grievanceArticle}
        currentLanguage={currentLanguage}
      />

      {/* Anonymous Whistleblower & Confidential News Tip Modal (Task 43 Subtopic B) */}
      <ConfidentialTipModal
        isOpen={isTipModalOpen}
        onClose={() => setIsTipModalOpen(false)}
      />

      {/* Mobile Sticky Anchor Ad Slot (Automatically active only on mobile when enabled) */}
      <PartnerUnit position="mobile_footer" category={activeCategory} />
    </div>
  );
}
