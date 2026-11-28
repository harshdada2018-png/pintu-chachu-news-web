import React, { useState } from 'react';
import { Search, Filter, Clock, Eye, ArrowLeft, Newspaper } from 'lucide-react';
import { DEFAULT_NEWSROOM_CATEGORIES } from '../../services/taxonomyService';
import { t, translateCategoryName } from '../../services/uiTranslations';
import ArticleLink from '../common/ArticleLink';

export default function SearchPage({ articles, categories, onSelectArticle, onBack, currentLanguage = 'hi' }) {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const activeCategories = categories && categories.length > 0 ? categories : DEFAULT_NEWSROOM_CATEGORIES;

  const filteredArticles = articles.filter((art) => {
    const matchesQuery = 
      art.title.toLowerCase().includes(query.toLowerCase()) || 
      art.content.toLowerCase().includes(query.toLowerCase()) ||
      (art.summary && art.summary.toLowerCase().includes(query.toLowerCase()));
      
    const matchesCategory = selectedCategory === 'all' || art.category_slug === selectedCategory;

    return matchesQuery && matchesCategory;
  });

  return (
    <div className="container" style={{ padding: '2rem 1.25rem', maxWidth: '960px' }}>
      <button 
        onClick={onBack} 
        className="btn btn-outline" 
        style={{ marginBottom: '1.5rem', padding: '0.4rem 0.8rem', fontSize: '0.825rem' }}
      >
        <ArrowLeft size={15} /> {t('backToTopStories', currentLanguage)}
      </button>

      <h2 className="headline" style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '1.5rem' }}>
        {t('searchArchives', currentLanguage)}
      </h2>

      {/* Search Bar & Category Filter */}
      <div className="search-filter-controls">
        <div style={{ position: 'relative', flex: '1 1 240px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)' }} />
          <input 
            type="text" 
            value={query} 
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchPlaceholder', currentLanguage)}
            style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', fontSize: '1rem' }}
          />
        </div>

        <select 
          value={selectedCategory} 
          onChange={(e) => setSelectedCategory(e.target.value)}
          style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', fontWeight: '600' }}
        >
          <option value="all">{t('allCategories', currentLanguage)}</option>
          {activeCategories.map((cat) => (
            <option key={cat.id} value={cat.slug}>{translateCategoryName(cat.name, currentLanguage)}</option>
          ))}
        </select>
      </div>

      {/* Search Results Count */}
      <div style={{ fontSize: '0.9rem', color: 'var(--text-subtle)', marginBottom: '1.25rem', fontWeight: '600' }}>
        {t('showingResults', currentLanguage)}: {filteredArticles.length} {query && `(${query})`}
      </div>

      {/* Results List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {filteredArticles.length === 0 ? (
          <div style={{ background: 'var(--bg-surface)', padding: '3rem', borderRadius: 'var(--radius-md)', textAlign: 'center', color: 'var(--text-subtle)' }}>
            {t('noArticlesMatch', currentLanguage)}
          </div>
        ) : (
          filteredArticles.map((art) => (
            <div 
              key={art.id}
              onClick={() => onSelectArticle(art)}
              className="search-result-card"
            >
              {art.featured_image ? (
                <img 
                  src={art.featured_image} 
                  alt={art.title} 
                  style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} 
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <div style={{ width: '100%', height: '100px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-subtle)' }}>
                  <Newspaper size={24} />
                </div>
              )}
              <div>
                <span className="story-category-tag">{translateCategoryName(art.category, currentLanguage)}</span>
                <h3 className="story-card-title" style={{ fontSize: '1.25rem', margin: '0.2rem 0 0.4rem 0' }}>
                  <ArticleLink article={art} onSelect={onSelectArticle}>{art.title}</ArticleLink>
                </h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  {art.summary}
                </p>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.775rem', color: 'var(--text-subtle)', marginTop: '0.5rem' }}>
                  <span>{t('byAuthor', currentLanguage)} {art.author?.name}</span>
                  <span>• {art.published_at}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
