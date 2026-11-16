/**
 * PublicSpark Sovereign Reading Time Calculation Engine
 * 
 * Accurately estimates article reading duration based on content length
 * and linguistic/script-specific average reading speeds.
 * 
 * Script-Aware Reading Speeds:
 * - English / Latin / European (en, fr, it, id, ru): ~200 - 220 words per minute (WPM)
 * - Indian Regional Languages (hi, mr, bn, te, ta, gu, kn, ml, pa, or, as, ur): ~160 WPM
 *   (Devanagari, Dravidian, and Indic scripts use syllabic conjuncts and complex ligatures)
 * - CJK Scripts (ja, zh-TW): ~350 characters per minute (CPM)
 */

/**
 * Strips markdown markup to count plain readable words
 */
function cleanMarkdownText(rawText = '') {
  if (!rawText || typeof rawText !== 'string') return '';
  return rawText
    .replace(/!\[.*?\]\(.*?\)/g, '') // images
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // links
    .replace(/```[\s\S]*?```/g, '') // code blocks
    .replace(/[#*`_~><[\]()]/g, ' ') // markdown formatting characters
    .trim();
}

/**
 * Calculates reading duration in minutes and word/character counts
 * 
 * @param {string} text - Raw content / markdown body
 * @param {string} [langCode='hi'] - 2-letter language code
 * @returns {{ minutes: number, words: number, text: string }}
 */
export function calculateReadingTime(text = '', langCode = 'hi') {
  const clean = cleanMarkdownText(text);

  if (!clean) {
    return {
      minutes: 1,
      words: 0,
      text: '1 min read'
    };
  }

  const lang = (langCode || 'hi').toLowerCase();

  // 1. CJK Character-based reading speed
  if (lang === 'ja' || lang === 'zh-tw') {
    const charCount = clean.replace(/\s+/g, '').length;
    const cpm = 350;
    const minutes = Math.max(1, Math.ceil(charCount / cpm));
    return {
      minutes,
      words: charCount,
      text: `${minutes} min read`
    };
  }

  // 2. Word-based counting for Indic and Latin scripts
  const words = clean.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // Calibrated WPM based on language family
  const isIndic = ['hi', 'mr', 'bn', 'te', 'ta', 'gu', 'kn', 'ml', 'pa', 'or', 'as', 'ur'].includes(lang);
  const wpm = isIndic ? 160 : 200;

  const minutes = Math.max(1, Math.ceil(wordCount / wpm));

  return {
    minutes,
    words: wordCount,
    text: `${minutes} min read`
  };
}

/**
 * Formats a localized reading badge string
 * 
 * @param {number} minutes
 * @param {Function} t - translation function
 * @param {string} langCode
 * @returns {string} e.g. "3 मिनट पठन" or "3 min read"
 */
export function formatReadingDuration(minutes, t, langCode = 'en') {
  const validMinutes = Math.max(1, Math.round(Number(minutes) || 1));
  const label = typeof t === 'function' ? t('minsRead', langCode) : 'min read';
  return `${validMinutes} ${label}`;
}

