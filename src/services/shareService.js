/**
 * PublicSpark Newsroom WhatsApp & Social Share Service
 * Formats structured broadsheet news bulletins for viral sharing with ZERO emojis.
 */

export function buildWhatsAppShareText(article, currentLang = 'hi') {
  if (!article) return '';

  const origin = typeof window !== 'undefined' && window.location.origin
    ? window.location.origin
    : 'https://publicspark.in';

  const slugOrId = article.slug || article.id;
  const articleUrl = `${origin}/article/${encodeURIComponent(slugOrId)}`;

  // Header banner based on article format
  let header = '*PUBLICSPARK NEWS BULLETIN*';
  if (article.is_breaking) {
    header = '*BREAKING NEWS | PUBLICSPARK*';
  } else if (article.format === 'live') {
    header = '*LIVE BLOG UPDATES | PUBLICSPARK*';
  }

  // Headline in bold (WhatsApp native syntax)
  const headline = `*${(article.title || '').trim()}*`;

  // Highlights extraction
  let bullets = [];
  if (Array.isArray(article.highlights) && article.highlights.length > 0) {
    bullets = article.highlights
      .filter(h => h && typeof h === 'string' && h.trim().length > 0)
      .slice(0, 3)
      .map(h => `• ${h.trim()}`);
  }

  // Fallback to standfirst or summary if highlights array is empty
  if (bullets.length === 0) {
    const fallbackText = (article.sub_title || article.summary || article.excerpt || '').trim();
    if (fallbackText) {
      const sentences = fallbackText.split(/(?<=[।!?.\n])\s+/).filter(s => s.trim().length > 10).slice(0, 3);
      if (sentences.length > 0) {
        bullets = sentences.map(s => `• ${s.trim()}`);
      } else {
        bullets = [`• ${fallbackText}`];
      }
    } else if (article.content) {
      const paras = article.content.split(/\n+/).filter(p => p.trim().length > 15).slice(0, 2);
      bullets = paras.map(p => `• ${p.slice(0, 110).trim()}...`);
    }
  }

  const highlightsSection = bullets.length > 0
    ? `\n\n*मुख्य बिंदु (Key Highlights):*\n${bullets.join('\n')}`
    : '';

  const cta = currentLang === 'en'
    ? 'Read full verified report & updates:'
    : 'पूरी खबर और लाइव अपडेट्स यहाँ पढ़ें:';

  return `${header}\n${headline}${highlightsSection}\n\n${cta}\n${articleUrl}`;
}

export function getWhatsAppShareUrl(article, currentLang = 'hi') {
  const text = buildWhatsAppShareText(article, currentLang);
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}

export async function copyFormattedShareCard(article, currentLang = 'hi') {
  const text = buildWhatsAppShareText(article, currentLang);
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);
    return successful;
  } catch (err) {
    console.warn('[Share] Clipboard fallback failed:', err);
    return false;
  }
}

