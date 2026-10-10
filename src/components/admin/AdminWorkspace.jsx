import React, { useState } from 'react';
import { Settings, Users, FolderTree, DollarSign, Plus, Trash2, CheckCircle2, BarChart2, HardDrive, Share2, Send } from 'lucide-react';

const WhatsAppIcon = ({ size = 16, color = '#25D366' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
  </svg>
);

const InstagramIcon = ({ size = 16, color = '#dc2743' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
  </svg>
);

const FacebookIcon = ({ size = 16, color = '#1877F2' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
  </svg>
);

const XTwitterIcon = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);
import { MOCK_CATEGORIES } from '../../services/mockData';
import { getCachedCategories, saveCategoriesToCache } from '../../services/cacheService';
import AnalyticsDashboard from './AnalyticsDashboard';
import StorageSettings from './StorageSettings';

export default function AdminWorkspace({ categories: propCategories, onUpdateCategories, socialLinks, onUpdateSocialLinks }) {
  const [activeTab, setActiveTab] = useState('analytics');
  const [categories, setCategories] = useState(() => {
    return propCategories || getCachedCategories() || MOCK_CATEGORIES;
  });
  const [newCatName, setNewCatName] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [localSocialLinks, setLocalSocialLinks] = useState(() => {
    return socialLinks || {
      whatsapp: 'https://whatsapp.com',
      instagram: 'https://instagram.com',
      facebook: 'https://facebook.com',
      twitter: 'https://x.com'
    };
  });

  // User List
  const [usersList, setUsersList] = useState([
    { id: 'u-1', name: 'Dr. Priya Ramachandran', email: 'priya@publicspark.org', role: 'editor', created: '2026-01-15' },
    { id: 'u-2', name: 'Arjun Mehta', email: 'arjun@publicspark.org', role: 'reporter', created: '2026-02-10' },
    { id: 'u-3', name: 'Sneha Verma', email: 'sneha@publicspark.org', role: 'reporter', created: '2026-03-01' },
    { id: 'u-4', name: 'Rohan Sharma', email: 'rohan@gmail.com', role: 'registered', created: '2026-04-12' },
  ]);

  // Ad Slot Placements
  const [adSlots, setAdSlots] = useState([
    { id: 'ad-1', name: 'Top Masthead Banner', position: 'top_header', enabled: true },
    { id: 'ad-2', name: 'In-Article Middle Slot', position: 'article_middle', enabled: true },
    { id: 'ad-3', name: 'Sidebar Sticky Unit', position: 'sidebar_sticky', enabled: false }
  ]);

  const handleRoleSelect = (userId, newRole) => {
    setUsersList(usersList.map(u => u.id === userId ? { ...u, role: newRole } : u));
  };

  const handleAddCategory = (e) => {
    if (e) e.preventDefault();
    const trimmed = newCatName.trim();
    if (!trimmed) {
      alert('Please enter a valid category name.');
      return;
    }

    const isDuplicate = categories.some(
      c => c.name.toLowerCase() === trimmed.toLowerCase() || c.slug === trimmed.toLowerCase().replace(/\s+/g, '-')
    );

    if (isDuplicate) {
      alert(`Category "${trimmed}" already exists.`);
      return;
    }

    const slug = trimmed.toLowerCase().replace(/\s+/g, '-');
    const updated = [...categories, { id: `cat-${Date.now()}`, name: trimmed, slug }];

    setCategories(updated);
    saveCategoriesToCache(updated);
    if (onUpdateCategories) {
      onUpdateCategories(updated);
    }

    setNewCatName('');
    setFeedbackMsg(`Added category "${trimmed}" successfully!`);
    setTimeout(() => setFeedbackMsg(''), 3000);
  };

  const handleDeleteCategory = (catId) => {
    const target = categories.find(c => c.id === catId);
    const updated = categories.filter(c => c.id !== catId);
    setCategories(updated);
    saveCategoriesToCache(updated);
    if (onUpdateCategories) {
      onUpdateCategories(updated);
    }
    if (target) {
      setFeedbackMsg(`Removed category "${target.name}".`);
      setTimeout(() => setFeedbackMsg(''), 3000);
    }
  };

  const handleToggleAdSlot = (slotId) => {
    setAdSlots(adSlots.map(s => s.id === slotId ? { ...s, enabled: !s.enabled } : s));
  };

  return (
    <div className="container" style={{ padding: '2rem 1.25rem' }}>
      {/* Admin Masthead Header */}
      <div className="workspace-header" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className="workspace-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Settings color="var(--accent-blue)" /> Newsroom Management Desk
            </h2>
            <p style={{ color: 'var(--text-subtle)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
              Manage team access permissions, news category taxonomy, advertisement slots, and storage quotas.
            </p>
          </div>
          <div style={{ background: '#ECFDF5', color: 'var(--accent-emerald)', padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-emerald)', display: 'inline-block' }} />
            Newsroom Management Active
          </div>
        </div>
      </div>

      <div className="workspace-grid">
        {/* Sidebar Nav */}
        <div className="workspace-sidebar">
          <button 
            onClick={() => setActiveTab('analytics')} 
            className={`sidebar-nav-link ${activeTab === 'analytics' ? 'active' : ''}`}
            style={{ width: '100%' }}
          >
            <BarChart2 size={16} /> Analytics & Traffic
          </button>
          <button 
            onClick={() => setActiveTab('users')} 
            className={`sidebar-nav-link ${activeTab === 'users' ? 'active' : ''}`}
            style={{ width: '100%' }}
          >
            <Users size={16} /> Team & Permissions ({usersList.length})
          </button>
          <button 
            onClick={() => setActiveTab('categories')} 
            className={`sidebar-nav-link ${activeTab === 'categories' ? 'active' : ''}`}
            style={{ width: '100%' }}
          >
            <FolderTree size={16} /> Categories ({categories.length})
          </button>
          <button 
            onClick={() => setActiveTab('ads')} 
            className={`sidebar-nav-link ${activeTab === 'ads' ? 'active' : ''}`}
            style={{ width: '100%' }}
          >
            <DollarSign size={16} /> Ad Slot Placements
          </button>
          <button 
            onClick={() => setActiveTab('storage')} 
            className={`sidebar-nav-link ${activeTab === 'storage' ? 'active' : ''}`}
            style={{ width: '100%' }}
          >
            <HardDrive size={16} /> Storage & Cache
          </button>
          <button 
            onClick={() => setActiveTab('social')} 
            className={`sidebar-nav-link ${activeTab === 'social' ? 'active' : ''}`}
            style={{ width: '100%' }}
          >
            <Share2 size={16} /> Social Channels Links
          </button>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'analytics' && <AnalyticsDashboard />}
          {activeTab === 'storage' && <StorageSettings />}

          {activeTab === 'users' && (
            <div className="data-table-container">
              <div style={{ padding: '1rem', fontWeight: '800', borderBottom: '1px solid var(--border-light)' }}>
                Team Members & Access Levels
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Access Level</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map((usr) => (
                    <tr key={usr.id}>
                      <td style={{ fontWeight: '700' }}>{usr.name}</td>
                      <td>{usr.email}</td>
                      <td>
                        <select 
                          value={usr.role} 
                          onChange={(e) => handleRoleSelect(usr.id, e.target.value)}
                          style={{ padding: '0.35rem 0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', fontWeight: '700' }}
                        >
                          <option value="visitor">Reader (Public)</option>
                          <option value="registered">Registered Reader</option>
                          <option value="reporter">Reporter (Writer)</option>
                          <option value="editor">Editor (Publisher)</option>
                          <option value="admin">Newsroom Administrator</option>
                        </select>
                      </td>
                      <td style={{ color: 'var(--text-subtle)', fontSize: '0.8rem' }}>{usr.created}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'categories' && (
            <div style={{ background: 'var(--bg-surface)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '1rem' }}>Manage News Taxonomy Categories</h3>
              
              {feedbackMsg && (
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-emerald)', padding: '0.65rem 1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.875rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle2 size={16} /> {feedbackMsg}
                </div>
              )}

              <form onSubmit={handleAddCategory} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <input 
                  type="text" 
                  value={newCatName} 
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="New Category Name (e.g. Economy, Climate)"
                  style={{ flex: 1, padding: '0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)' }}
                />
                <button type="submit" className="btn btn-primary" style={{ padding: '0.65rem 1.2rem', cursor: 'pointer' }}>
                  <Plus size={16} /> Add Category
                </button>
              </form>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.85rem' }}>
                {categories.map((cat) => (
                  <div 
                    key={cat.id} 
                    style={{ 
                      background: 'var(--bg-secondary)', 
                      padding: '0.9rem 1rem', 
                      borderRadius: 'var(--radius-sm)', 
                      border: '1px solid var(--border-light)', 
                      display: 'flex', 
                      justify: 'space-between', 
                      alignItems: 'center',
                      gap: '0.75rem',
                      minWidth: 0,
                      overflow: 'hidden'
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1, wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                      <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-main)', lineHeight: '1.3' }}>
                        {cat.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--accent-blue)', marginTop: '0.25rem', fontWeight: '600' }}>
                        Active Section
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => handleDeleteCategory(cat.id)}
                      title="Remove category"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-subtle)',
                        cursor: 'pointer',
                        padding: '0.35rem',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'var(--transition-fast)',
                        flexShrink: 0
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-crimson)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-subtle)'}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'ads' && (
            <div style={{ background: 'var(--bg-surface)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '0.4rem' }}>Configurable Ad Slot Positions</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-subtle)', marginBottom: '1.25rem' }}>
                Configure ad placement slots for your news platform.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {adSlots.map((slot) => (
                  <div key={slot.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>{slot.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>Position Key: {slot.position}</div>
                    </div>
                    <button 
                      onClick={() => handleToggleAdSlot(slot.id)}
                      className={`btn ${slot.enabled ? 'btn-primary' : 'btn-outline'}`}
                      style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem' }}
                    >
                      {slot.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'social' && (
            <div style={{ background: 'var(--bg-surface)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                    <Share2 color="var(--accent-crimson)" size={20} /> Social Channels Links Settings
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-subtle)', marginTop: '0.25rem' }}>
                    Configure WhatsApp, Instagram, Facebook, and X (Twitter) URLs displayed in the website footer.
                  </p>
                </div>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); if (onUpdateSocialLinks) onUpdateSocialLinks(localSocialLinks); setFeedbackMsg('Social channel links updated successfully!'); setTimeout(() => setFeedbackMsg(''), 3000); }} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {feedbackMsg && (
                  <div style={{ padding: '0.65rem 1rem', background: '#ECFDF5', color: 'var(--accent-emerald)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CheckCircle2 size={16} /> {feedbackMsg}
                  </div>
                )}

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.4rem', color: '#25D366' }}>
                    <WhatsAppIcon size={16} /> WhatsApp Channel URL or Mobile Number
                  </label>
                  <input 
                    type="text" 
                    value={localSocialLinks.whatsapp}
                    onChange={(e) => setLocalSocialLinks({ ...localSocialLinks, whatsapp: e.target.value })}
                    placeholder="Enter Phone Number (e.g. +919876543210) or Group/Channel URL"
                    style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.875rem' }}
                  />
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: '0.25rem' }}>
                    Supports full URLs (e.g. https://whatsapp.com/channel/...) or direct phone numbers (e.g. +919876543210 / 9876543210).
                  </div>
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.4rem', color: '#dc2743' }}>
                    <InstagramIcon size={16} /> Instagram Page URL or Username
                  </label>
                  <input 
                    type="text" 
                    value={localSocialLinks.instagram}
                    onChange={(e) => setLocalSocialLinks({ ...localSocialLinks, instagram: e.target.value })}
                    placeholder="Enter Username (e.g. @publicspark) or full Page URL"
                    style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.875rem' }}
                  />
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: '0.25rem' }}>
                    Supports handle/username (e.g. @publicspark / publicspark) or full URL.
                  </div>
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.4rem', color: '#1877F2' }}>
                    <FacebookIcon size={16} /> Facebook Page URL, Phone Number or Handle
                  </label>
                  <input 
                    type="text" 
                    value={localSocialLinks.facebook}
                    onChange={(e) => setLocalSocialLinks({ ...localSocialLinks, facebook: e.target.value })}
                    placeholder="Enter Phone Number (e.g. +919876543210), Handle (e.g. @publicspark) or full Page URL"
                    style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.875rem' }}
                  />
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: '0.25rem' }}>
                    Supports mobile numbers (e.g. +919876543210), page/profile handles (e.g. @publicspark), or full URLs.
                  </div>
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                    <XTwitterIcon size={16} /> X (Twitter) Handle or Page URL
                  </label>
                  <input 
                    type="text" 
                    value={localSocialLinks.twitter}
                    onChange={(e) => setLocalSocialLinks({ ...localSocialLinks, twitter: e.target.value })}
                    placeholder="Enter Handle (e.g. @publicspark) or full URL"
                    style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.875rem' }}
                  />
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: '0.25rem' }}>
                    Supports handle/username (e.g. @publicspark / publicspark) or full URL.
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ padding: '0.65rem 1.25rem', fontSize: '0.875rem', fontWeight: '700', alignSelf: 'flex-start', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <CheckCircle2 size={16} /> Save Social Channel URLs
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
