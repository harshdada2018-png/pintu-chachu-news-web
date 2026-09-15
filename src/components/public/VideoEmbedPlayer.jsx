import React from 'react';
import { extractYouTubeId } from '../../services/mediaService';
import { Video, Play } from 'lucide-react';

export default function VideoEmbedPlayer({ videoUrlOrId, title }) {
  const videoId = extractYouTubeId(videoUrlOrId);

  if (!videoId) {
    return (
      <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: 'var(--text-subtle)' }}>
        ⚠️ Invalid YouTube Video URL or ID provided.
      </div>
    );
  }

  return (
    <div style={{ margin: '1.5rem 0' }}>
      <div style={{ 
        position: 'relative', 
        paddingBottom: '56.25%', /* 16:9 Aspect Ratio */
        height: 0, 
        overflow: 'hidden', 
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-md)',
        border: '1px solid var(--border-medium)'
      }}>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&rel=0`}
          title={title || 'PublicSpark News Video'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            border: 0
          }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-subtle)' }}>
        <Video size={16} color="#FF0000" />
        <span>PublicSpark Video Coverage</span>
      </div>
    </div>
  );
}
