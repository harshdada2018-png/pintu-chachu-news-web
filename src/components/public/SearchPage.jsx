import React, { useState } from 'react';
import { Search, Filter, Clock, Eye, ArrowLeft } from 'lucide-react';
import { MOCK_CATEGORIES } from '../../services/mockData';

export default function SearchPage({ articles, onSelectArticle, onBack }) {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

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
        <ArrowLeft size={15} /> Back to Top Stories
      </button>

      <h2 className="headline" style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '1.5rem' }}>
        Search PublicSpark Archives
      </h2>

      {/* Search Bar & Category Filter */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)' }} />
          <input 
            type="text" 
            value={query} 
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by keywords, headlines, topics, or space mission..."
            style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', fontSize: '1rem' }}
          />
        </div>

        <select 
          value={selectedCategory} 
          onChange={(e) => setSelectedCategory(e.target.value)}
          style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', fontWeight: '600' }}
        >
          <option value="all">All Categories</option>
          {MOCK_CATEGORIES.map((cat) => (
            <option key={cat.id} value={cat.slug}>{cat.name}</option>
          ))}
        </select>
      </div>

      {/* Search Results Count */}
      <div style={{ fontSize: '0.9rem', color: 'var(--text-subtle)', marginBottom: '1.25rem', fontWeight: '600' }}>
        Showing {filteredArticles.length} results {query && `for "${query}"`}
      </div>

      {/* Results List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {filteredArticles.length === 0 ? (
          <div style={{ background: 'var(--bg-surface)', padding: '3rem', borderRadius: 'var(--radius-md)', textAlign: 'center', color: 'var(--text-subtle)' }}>
            No articles match your search criteria. Try a different keyword.
          </div>
        ) : (
          filteredArticles.map((art) => (
            <div 
              key={art.id}
              onClick={() => onSelectArticle(art)}
              style={{ 
                background: 'var(--bg-surface)', 
                padding: '1.25rem', 
                borderRadius: 'var(--radius-md)', 
                border: '1px solid var(--border-light)', 
                display: 'grid', 
                gridTemplateColumns: '140px 1fr', 
                gap: '1.25rem', 
                cursor: 'pointer',
                transition: 'var(--transition-fast)'
              }}
            >
              <img 
                src={art.featured_image} 
                alt={art.title} 
                style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} 
              />
              <div>
                <span className="story-category-tag">{art.category}</span>
                <h3 className="story-card-title" style={{ fontSize: '1.25rem', margin: '0.2rem 0 0.4rem 0' }}>
                  {art.title}
                </h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  {art.summary}
                </p>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.775rem', color: 'var(--text-subtle)', marginTop: '0.5rem' }}>
                  <span>By {art.author?.name}</span>
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
