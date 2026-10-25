import React from 'react';

/**
 * Clean Markdown Renderer Component
 * Parses raw markdown (### headings, **bold**, - bullet lists, paragraphs)
 * and journalistic subheadings (callouts, wire markers, brackets) into styled React elements.
 */
export default function MarkdownRenderer({ content, fontSize, fontSizeMode = 'md', lineHeight, adComponent = null }) {
  if (!content) return null;

  const currentFontSize = fontSize || (fontSizeMode === 'sm' ? '0.92rem' : fontSizeMode === 'lg' ? '1.2rem' : '1rem');
  const currentLineHeight = lineHeight || (fontSizeMode === 'sm' ? '1.65' : fontSizeMode === 'lg' ? '1.8' : '1.72');

  const lines = content.split('\n');
  const elements = [];
  let currentList = [];
  let paragraphCount = 0;
  let hasInjectedAd = false;

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} style={{ margin: '1rem 0 1.25rem 1.5rem', lineHeight: currentLineHeight }}>
          {currentList.map((item, idx) => (
            <li key={idx} style={{ marginBottom: '0.45rem', color: 'var(--text-main)' }}>
              {parseInlineMarkdown(item)}
            </li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  let hasRenderedFirstParagraph = false;

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      return;
    }

    // Heading H3 (###)
    if (trimmed.startsWith('### ')) {
      flushList();
      const headingText = trimmed.replace(/^###\s+/, '');
      elements.push(
        <h3 key={index} style={{ 
          fontFamily: 'var(--font-serif)', 
          fontSize: '1.35rem', 
          fontWeight: '800', 
          margin: '1.85rem 0 0.75rem 0',
          color: 'var(--text-main)',
          lineHeight: '1.35'
        }}>
          {parseInlineMarkdown(headingText)}
        </h3>
      );
      return;
    }

    // Heading H2 (##)
    if (trimmed.startsWith('## ')) {
      flushList();
      const headingText = trimmed.replace(/^##\s+/, '');
      elements.push(
        <h2 key={index} style={{ 
          fontFamily: 'var(--font-serif)', 
          fontSize: '1.55rem', 
          fontWeight: '800', 
          margin: '2rem 0 0.85rem 0',
          color: 'var(--text-main)',
          lineHeight: '1.3'
        }}>
          {parseInlineMarkdown(headingText)}
        </h2>
      );
      return;
    }

    // Journalistic Callout Sub-Heading (cleans wire markers, brackets, and emojis)
    const emojiWirePattern = /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}▶【\[]\s*(.+?)\s*[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}▶】\]]?$/u;
    const trailingEmojiPattern = /^(.+?)\s*[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]$/u;
    const isCalloutHeader = (emojiWirePattern.test(trimmed) || trailingEmojiPattern.test(trimmed)) && trimmed.length < 120;

    if (isCalloutHeader) {
      flushList();
      const cleanHeading = trimmed.replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}▶【\[\s]+|[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}▶】\]\s]+$/gu, '').trim();
      elements.push(
        <div key={index} className="article-section-subheading" style={{
          margin: '1.65rem 0 0.75rem 0',
          paddingLeft: '0.65rem',
          borderLeft: '3px solid var(--accent-crimson)',
          display: 'flex',
          alignItems: 'baseline'
        }}>
          <h3 style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '1.08rem',
            fontWeight: '800',
            color: 'var(--text-main)',
            lineHeight: '1.38',
            margin: 0,
            letterSpacing: '-0.01em'
          }}>
            {cleanHeading || trimmed}
          </h3>
        </div>
      );
      return;
    }

    // Bullet List Item (- or *)
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const listText = trimmed.replace(/^[-*]\s+/, '');
      currentList.push(listText);
      return;
    }

    // First line standalone byline / kicker detection (e.g. "नारेन्द्र शर्मा" alone on line 1)
    if (paragraphCount === 0 && index === 0 && trimmed.length < 35 && !/[।.!?]/.test(trimmed)) {
      elements.push(
        <div key={index} style={{
          fontSize: '0.8rem',
          fontWeight: '700',
          color: 'var(--accent-crimson)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginBottom: '0.85rem'
        }}>
          रिपोर्ट: {trimmed}
        </div>
      );
      return;
    }

    // Regular Paragraph (With Editorial Drop Cap ONLY for Latin English A-Z)
    flushList();
    paragraphCount++;

    const isLatinLetter = /^[A-Za-z]$/.test(trimmed.charAt(0));
    if (!hasRenderedFirstParagraph && trimmed.length > 20 && isLatinLetter) {
      hasRenderedFirstParagraph = true;
      const firstChar = trimmed.charAt(0);
      const restText = trimmed.slice(1);
      elements.push(
        <p key={index} className="article-body-p" style={{ 
          marginBottom: '1.15rem', 
          lineHeight: currentLineHeight,
          fontWeight: 'var(--font-weight-body, 400)',
          wordBreak: 'normal',
          overflowWrap: 'break-word',
          color: 'var(--text-main)'
        }}>
          <span style={{
            float: 'left',
            fontSize: fontSizeMode === 'sm' ? '2.8rem' : fontSizeMode === 'lg' ? '4.2rem' : '3.4rem',
            lineHeight: '0.8',
            fontWeight: '900',
            fontFamily: 'var(--font-serif)',
            paddingTop: '4px',
            paddingRight: '8px',
            paddingBottom: '2px',
            color: 'var(--accent-indigo)',
            transition: 'font-size 0.2s ease'
          }}>
            {firstChar}
          </span>
          {formatParagraphContent(restText)}
        </p>
      );
    } else {
      elements.push(
        <p key={index} className="article-body-p" style={{ 
          marginBottom: '1.15rem', 
          lineHeight: currentLineHeight,
          fontWeight: 'var(--font-weight-body, 400)',
          wordBreak: 'normal',
          overflowWrap: 'break-word',
          color: 'var(--text-main)'
        }}>
          {formatParagraphContent(trimmed)}
        </p>
      );
    }

    // In-Article Ad Injection after Paragraph 2
    if (adComponent && paragraphCount === 2 && !hasInjectedAd) {
      hasInjectedAd = true;
      elements.push(
        <React.Fragment key="in-article-ad-placement">
          {adComponent}
        </React.Fragment>
      );
    }
  });

  flushList();

  // If article has fewer than 2 paragraphs, append ad at the end
  if (adComponent && !hasInjectedAd && paragraphCount > 0) {
    elements.push(
      <React.Fragment key="in-article-ad-placement-end">
        {adComponent}
      </React.Fragment>
    );
  }

  return (
    <div style={{ 
      fontSize: currentFontSize, 
      lineHeight: currentLineHeight, 
      color: 'var(--text-main)',
      transition: 'font-size 0.2s ease, line-height 0.2s ease'
    }}>
      {elements}
    </div>
  );
}

/**
 * Formats datelines (e.g. "जिला उमरिया।", "नई दिल्ली।") and parses inline bold markdown
 */
function formatParagraphContent(trimmedText) {
  if (!trimmedText) return '';

  // Dateline detection for Hindi / English: e.g. "जिला उमरिया।" or "नई दिल्ली।" or "MUMBAI —"
  const datelineMatch = trimmedText.match(/^([A-Za-z\u0900-\u097F\s]{2,25}[।:—–])\s*(.*)$/);
  if (datelineMatch && !trimmedText.startsWith('#')) {
    const dateline = datelineMatch[1];
    const rest = datelineMatch[2];
    return (
      <>
        <strong style={{ fontWeight: '750', color: 'var(--text-main)', marginRight: '0.35rem' }}>
          {dateline}
        </strong>
        {parseInlineMarkdown(rest)}
      </>
    );
  }

  return parseInlineMarkdown(trimmedText);
}

/**
 * Parses inline markdown like **bold** text
 */
function parseInlineMarkdown(text) {
  if (!text) return '';
  
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} style={{ fontWeight: '700', color: 'var(--text-main)' }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}
