/**
 * PublicSpark Newsroom — Localized Relative Time & Date Engine
 * Formats relative time ("3 घंटे पहले", "1 दिन पहले", ISO dates) cleanly into 
 * the reader's active language with zero API calls.
 */

const TIME_LOCALES = {
  hi: {
    justNow: 'अभी-अभी',
    min: (n) => n === 1 ? '1 मिनट पहले' : `${n} मिनट पहले`,
    hour: (n) => n === 1 ? '1 घंटा पहले' : `${n} घंटे पहले`,
    day: (n) => n === 1 ? '1 दिन पहले' : `${n} दिन पहले`,
    week: (n) => n === 1 ? '1 सप्ताह पहले' : `${n} सप्ताह पहले`,
    month: (n) => n === 1 ? '1 माह पहले' : `${n} माह पहले`
  },
  en: {
    justNow: 'Just now',
    min: (n) => n === 1 ? '1 min ago' : `${n} mins ago`,
    hour: (n) => n === 1 ? '1 hour ago' : `${n} hours ago`,
    day: (n) => n === 1 ? '1 day ago' : `${n} days ago`,
    week: (n) => n === 1 ? '1 week ago' : `${n} weeks ago`,
    month: (n) => n === 1 ? '1 month ago' : `${n} months ago`
  },
  gu: {
    justNow: 'હમણાં જ',
    min: (n) => `${n} મિનિટ પહેલાં`,
    hour: (n) => `${n} કલાક પહેલાં`,
    day: (n) => `${n} દિવસ પહેલાં`,
    week: (n) => `${n} અઠવાડિયા પહેલાં`,
    month: (n) => `${n} મહિના પહેલાં`
  },
  mr: {
    justNow: 'आत्ताच',
    min: (n) => `${n} मिनिटांपूर्वी`,
    hour: (n) => `${n} तासांपूर्वी`,
    day: (n) => `${n} दिवसांपूर्वी`,
    week: (n) => `${n} आठवड्यांपूर्वी`,
    month: (n) => `${n} महिन्यांपूर्वी`
  },
  bn: {
    justNow: 'এইমাত্র',
    min: (n) => `${n} মিনিট আগে`,
    hour: (n) => `${n} ঘণ্টা আগে`,
    day: (n) => `${n} দিন আগে`,
    week: (n) => `${n} সপ্তাহ আগে`,
    month: (n) => `${n} মাস আগে`
  },
  te: {
    justNow: 'ఇప్పుడే',
    min: (n) => `${n} నిమిషాల క్రితం`,
    hour: (n) => `${n} గంటల క్రితం`,
    day: (n) => `${n} రోజుల క్రితం`,
    week: (n) => `${n} వారాల క్రితం`,
    month: (n) => `${n} నెలల క్రితం`
  },
  ta: {
    justNow: 'சற்றுமுன்',
    min: (n) => `${n} நிமிடங்களுக்கு முன்`,
    hour: (n) => `${n} மணி நேரத்திற்கு முன்`,
    day: (n) => `${n} நாட்களுக்கு முன்`,
    week: (n) => `${n} வாரங்களுக்கு முன்`,
    month: (n) => `${n} மாதங்களுக்கு முன்`
  },
  ur: {
    justNow: 'ابھی ابھی',
    min: (n) => `${n} منٹ پہلے`,
    hour: (n) => `${n} گھنٹے پہلے`,
    day: (n) => `${n} دن پہلے`,
    week: (n) => `${n} ہفتے پہلے`,
    month: (n) => `${n} ماہ پہلے`
  },
  pa: {
    justNow: 'ਹੁਣੇ ਜਿਹੇ',
    min: (n) => `${n} ਮਿੰਟ ਪਹਿਲਾਂ`,
    hour: (n) => `${n} ਘੰਟੇ ਪਹਿਲਾਂ`,
    day: (n) => `${n} ਦਿਨ ਪਹਿਲਾਂ`,
    week: (n) => `${n} ਹਫ਼ਤੇ ਪਹਿਲਾਂ`,
    month: (n) => `${n} ਮਹੀਨੇ ਪਹਿਲਾਂ`
  }
};

/**
 * Formats relative time ("3 घंटे पहले", "1 दिन पहले", "Just now", ISO timestamp)
 * dynamically according to the chosen language.
 */
export function formatPublishedTime(timeStr, targetLang = 'hi') {
  if (!timeStr || typeof timeStr !== 'string') return '';

  const clean = timeStr.trim();
  const langKey = TIME_LOCALES[targetLang] ? targetLang : (TIME_LOCALES[targetLang?.split('-')[0]] ? targetLang.split('-')[0] : 'en');
  const dict = TIME_LOCALES[langKey] || TIME_LOCALES['en'];

  // Check if string represents "Just now" / "अभी-अभी"
  if (/^(just now|अभी|अभी-अभी|हाल ही में)$/i.test(clean)) {
    return dict.justNow;
  }

  // 1. Try extracting number and unit from relative strings (Hindi or English)
  // E.g. "3 घंटे पहले", "22 घंटे पहले", "1 दिन पहले", "1 सप्ताह पहले", "3 hours ago", "1 day ago"
  const hourMatch = clean.match(/(\d+)\s*(घंटे|घंटा|hour|hours|hr|hrs)/i);
  if (hourMatch) {
    const num = parseInt(hourMatch[1], 10);
    return dict.hour(num);
  }

  const dayMatch = clean.match(/(\d+)\s*(दिन|दिवस|day|days)/i);
  if (dayMatch) {
    const num = parseInt(dayMatch[1], 10);
    return dict.day(num);
  }

  const weekMatch = clean.match(/(\d+)\s*(सप्ताह|हफ़्ते|हफ्ते|week|weeks)/i);
  if (weekMatch) {
    const num = parseInt(weekMatch[1], 10);
    return dict.week(num);
  }

  const minMatch = clean.match(/(\d+)\s*(मिनट|min|mins|minute|minutes)/i);
  if (minMatch) {
    const num = parseInt(minMatch[1], 10);
    return dict.min(num);
  }

  const monthMatch = clean.match(/(\d+)\s*(माह|महीने|month|months)/i);
  if (monthMatch) {
    const num = parseInt(monthMatch[1], 10);
    return dict.month(num);
  }

  // 2. If it's a valid timestamp (ISO date string)
  const parsedDate = new Date(clean);
  if (!isNaN(parsedDate.getTime()) && (clean.includes('-') || clean.includes(':'))) {
    const now = Date.now();
    const diffMs = now - parsedDate.getTime();
    if (diffMs < 0) return dict.justNow;

    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);

    if (diffMins < 5) return dict.justNow;
    if (diffMins < 60) return dict.min(diffMins);
    if (diffHours < 24) return dict.hour(diffHours);
    if (diffDays < 7) return dict.day(diffDays);
    if (diffWeeks < 4) return dict.week(diffWeeks);

    return parsedDate.toLocaleDateString(langKey === 'en' ? 'en-IN' : (langKey === 'hi' ? 'hi-IN' : `${langKey}-IN`), {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  // Fallback: return original string if unrecognized
  return clean;
}

