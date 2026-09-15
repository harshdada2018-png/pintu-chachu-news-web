import React from 'react';

/**
 * Clean Markdown Renderer Component
 * Parses raw markdown (### headings, **bold**, - bullet lists, paragraphs) into styled React elements.
 */
export default function MarkdownRenderer({ content }) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];
  let currentList = [];

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} style={{ margin: '1rem 0 1.25rem 1.5rem', lineHeight: '1.7' }}>
          {currentList.map((item, idx) => (
            <li key={idx} style={{ marginBottom: '0.4rem' }}>
              {parseInlineMarkdown(item)}
            </li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

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
          fontSize: '1.4rem', 
          fontWeight: '700', 
          margin: '1.75rem 0 0.75rem 0',
          color: 'var(--text-main)'
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
          fontSize: '1.6rem', 
          fontWeight: '800', 
          margin: '2rem 0 1rem 0',
          color: 'var(--text-main)'
        }}>
          {parseInlineMarkdown(headingText)}
        </h2>
      );
      return;
    }

    // Bullet List Item (- or *)
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const listText = trimmed.replace(/^[-*]\s+/, '');
      currentList.push(listText);
      return;
    }

    // Regular Paragraph
    flushList();
    elements.push(
      <p key={index} style={{ marginBottom: '1.25rem', lineHeight: '1.8' }}>
        {parseInlineMarkdown(trimmed)}
      </p>
    );
  });

  flushList();

  return <div style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>{elements}</div>;
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
