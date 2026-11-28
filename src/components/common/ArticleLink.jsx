import React from 'react';

/**
 * Semantic SEO Anchor Wrapper for Article Headlines & Links.
 * Preserves 0ms SPA navigation on standard left-click while providing
 * real crawlable `<a href="/article/...">` links for Googlebot & new-tab clicks.
 */
export default function ArticleLink({ article, onSelect, className = '', style = {}, children, ...rest }) {
  const slugOrId = article?.slug || article?.id || '';
  const href = `/article/${encodeURIComponent(slugOrId)}`;
  return (
    <a
      href={href}
      className={`article-seo-link ${className}`.trim()}
      style={{ color: 'inherit', textDecoration: 'none', ...style }}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        if (onSelect) onSelect(article);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

