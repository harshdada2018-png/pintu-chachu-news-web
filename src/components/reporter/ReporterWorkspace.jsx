import React, { useState } from 'react';
import { PenTool, Upload, FileText, Send, CheckCircle, Clock, AlertCircle, Video, Image as ImageIcon } from 'lucide-react';
import { MOCK_CATEGORIES } from '../../services/mockData';
import { compressImageToWebP } from '../../services/mediaService';

export default function ReporterWorkspace({ onAddNewArticle }) {
  const [activeTab, setActiveTab] = useState('create');
  const [title, setTitle] = useState('');
  const [subTitle, setSubTitle] = useState('');
  const [category, setCategory] = useState('Technology');
  const [format, setFormat] = useState('standard');
  const [content, setContent] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isImageReady, setIsImageReady] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Drafts & Submitted List state
  const [myStories, setMyStories] = useState([
    {
      id: 'my-1',
      title: 'Quantum Computing Breakthrough: Room Temperature Stability Achieved',
      category: 'Technology',
      status: 'submitted',
      updated_at: 'Today, 14:20 IST'
    },
    {
      id: 'my-2',
      title: 'Urban Forestry Impact on Micro-Climate Regulation',
      category: 'Science & Environment',
      status: 'draft',
      updated_at: 'Yesterday, 18:45 IST'
    }
  ]);

  // Image Upload Processing
  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setIsCompressing(true);
      setIsImageReady(false);
      const result = await compressImageToWebP(file, 200, 1200);
      setImagePreview(result.dataUrl);
      setIsImageReady(true);
    } catch (err) {
      console.error('Image upload error:', err);
      alert('Failed to process image. Please try another file.');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleSubmitStory = (e) => {
    e.preventDefault();
    if (!title || !content) {
      alert('Please provide a title and story body content.');
      return;
    }

    const newStory = {
      id: `art-${Date.now()}`,
      title,
      sub_title: subTitle,
      category,
      category_slug: category.toLowerCase().replace(/\s+/g, '-'),
      content,
      summary: subTitle || content.slice(0, 120) + '...',
      format,
      video_url: youtubeUrl || null,
      featured_image: imagePreview || 'https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=800&q=80',
      image_caption: title,
      media_credits: 'PublicSpark Reporter Desk',
      author: {
        name: 'You (Reporter)',
        role: 'Staff Reporter',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'
      },
      status: 'submitted',
      is_breaking: false,
      views_count: 0,
      reading_time_mins: Math.ceil(content.length / 500),
      published_at: 'Pending Review'
    };

    onAddNewArticle(newStory);
    setMyStories([
      {
        id: newStory.id,
        title: newStory.title,
        category: newStory.category,
        status: 'submitted',
        updated_at: 'Just now'
      },
      ...myStories
    ]);

    setStatusMessage('✅ Story submitted successfully to Editorial Queue!');
    setTitle('');
    setSubTitle('');
    setContent('');
    setYoutubeUrl('');
    setImagePreview(null);
    setIsImageReady(false);

    setTimeout(() => setStatusMessage(''), 4000);
  };

  return (
    <div className="container" style={{ padding: '2rem 1.25rem' }}>
      {/* Reporter Desk Header */}
      <div className="workspace-header" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className="workspace-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <PenTool color="var(--accent-crimson)" /> Reporter Desk
            </h2>
            <p style={{ color: 'var(--text-subtle)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
              Draft news articles, attach photos/videos, and submit stories for Editorial Review.
            </p>
          </div>
          <div style={{ background: 'var(--accent-crimson-bg)', color: 'var(--accent-crimson)', padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', fontWeight: '700' }}>
            Editorial Policy: All submissions are reviewed before publishing
          </div>
        </div>
      </div>

      {statusMessage && (
        <div style={{ background: '#ECFDF5', color: 'var(--accent-emerald)', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', fontWeight: '700' }}>
          {statusMessage}
        </div>
      )}

      {/* Grid Layout */}
      <div className="workspace-grid">
        {/* Sidebar Nav */}
        <div className="workspace-sidebar">
          <button 
            onClick={() => setActiveTab('create')} 
            className={`sidebar-nav-link ${activeTab === 'create' ? 'active' : ''}`}
            style={{ width: '100%' }}
          >
            <PenTool size={16} /> Write New Article
          </button>
          <button 
            onClick={() => setActiveTab('my-submissions')} 
            className={`sidebar-nav-link ${activeTab === 'my-submissions' ? 'active' : ''}`}
            style={{ width: '100%' }}
          >
            <FileText size={16} /> My Submissions ({myStories.length})
          </button>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'create' ? (
            <form onSubmit={handleSubmitStory} style={{ background: 'var(--bg-surface)', padding: '1.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }}>
                Draft New Story
              </h3>

              {/* Title & Subtitle */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontWeight: '700', fontSize: '0.875rem', marginBottom: '0.4rem' }}>
                  Headline / Article Title *
                </label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Clean Energy Transition Surpasses 50% Grid Milestone"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', fontFamily: 'var(--font-serif)', fontSize: '1.1rem', fontWeight: '700' }}
                  required
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontWeight: '700', fontSize: '0.875rem', marginBottom: '0.4rem' }}>
                  Sub-Headline / Standfirst
                </label>
                <input 
                  type="text" 
                  value={subTitle} 
                  onChange={(e) => setSubTitle(e.target.value)}
                  placeholder="Short explanatory sentence summarizing the core news lead..."
                  style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', fontSize: '0.95rem' }}
                />
              </div>

              {/* Category & Format Selectors */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: '700', fontSize: '0.875rem', marginBottom: '0.4rem' }}>
                    Category
                  </label>
                  <select 
                    value={category} 
                    onChange={(e) => setCategory(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)' }}
                  >
                    {MOCK_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: '700', fontSize: '0.875rem', marginBottom: '0.4rem' }}>
                    News Format
                  </label>
                  <select 
                    value={format} 
                    onChange={(e) => setFormat(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)' }}
                  >
                    <option value="standard">Standard Article</option>
                    <option value="video">Video News Story</option>
                    <option value="breaking">Breaking News Lead</option>
                    <option value="explainer">Explainer Piece</option>
                    <option value="opinion">Opinion Column</option>
                    <option value="live">Live Updates Stream</option>
                  </select>
                </div>
              </div>

              {/* Video Embed URL */}
              <div style={{ marginBottom: '1.25rem', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: '700', fontSize: '0.875rem', marginBottom: '0.4rem' }}>
                  <Video size={18} color="var(--accent-crimson)" /> Video Link (Optional Video Coverage)
                </label>
                <input 
                  type="text" 
                  value={youtubeUrl} 
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="Paste Video Link or URL"
                  style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', fontSize: '0.9rem' }}
                />
              </div>

              {/* Featured Image Upload */}
              <div style={{ marginBottom: '1.5rem', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-medium)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: '700', fontSize: '0.875rem', marginBottom: '0.4rem' }}>
                  <ImageIcon size={18} /> Featured Image Upload
                </label>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleImageChange}
                  style={{ marginBottom: '0.5rem' }}
                />
                
                {isCompressing && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--accent-amber)', fontWeight: '600' }}>
                    Optimizing image for fast reading...
                  </div>
                )}

                {isImageReady && (
                  <div style={{ fontSize: '0.825rem', color: 'var(--accent-emerald)', fontWeight: '700', marginTop: '0.4rem', background: '#ECFDF5', padding: '0.6rem', borderRadius: 'var(--radius-sm)' }}>
                    ✅ Image attached and optimized for fast page loading.
                  </div>
                )}

                {imagePreview && (
                  <img src={imagePreview} alt="Preview" style={{ marginTop: '0.75rem', height: '140px', borderRadius: 'var(--radius-sm)', objectFit: 'cover' }} />
                )}
              </div>

              {/* Body Content */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontWeight: '700', fontSize: '0.875rem', marginBottom: '0.4rem' }}>
                  Article Body Text *
                </label>
                <textarea 
                  rows={10} 
                  value={content} 
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write full article body here..."
                  style={{ width: '100%', padding: '0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', fontSize: '0.95rem', lineHeight: '1.6' }}
                  required
                />
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 1.5rem' }}>
                  <Send size={16} /> Submit for Editorial Review
                </button>
                <button type="button" className="btn btn-outline" style={{ padding: '0.75rem 1.25rem' }}>
                  Save Draft
                </button>
              </div>
            </form>
          ) : (
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Article Title</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {myStories.map((story) => (
                    <tr key={story.id}>
                      <td style={{ fontWeight: '700' }}>{story.title}</td>
                      <td>{story.category}</td>
                      <td>
                        {story.status === 'submitted' ? (
                          <span className="badge badge-live">
                            <Clock size={11} /> Pending Review
                          </span>
                        ) : (
                          <span className="badge" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                            Draft
                          </span>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-subtle)', fontSize: '0.8rem' }}>{story.updated_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
