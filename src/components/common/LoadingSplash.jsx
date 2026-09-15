import React, { useEffect, useState } from 'react';
import { Newspaper, Flame, ShieldCheck, Radio } from 'lucide-react';

export default function LoadingSplash({ onFinished }) {
  const [progress, setProgress] = useState(15);

  useEffect(() => {
    const timer1 = setTimeout(() => setProgress(45), 200);
    const timer2 = setTimeout(() => setProgress(80), 500);
    const timer3 = setTimeout(() => setProgress(100), 900);
    const timer4 = setTimeout(() => {
      if (onFinished) onFinished();
    }, 1100);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [onFinished]);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      backgroundColor: 'var(--bg-primary, #FAF8F5)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      transition: 'opacity 0.4s ease-out'
    }}>
      {/* Animated Glowing Masthead Logo */}
      <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
        <img 
          src="/logo.png" 
          alt="PUBLIC SPARK Logo" 
          style={{ 
            height: '110px', 
            width: 'auto', 
            objectFit: 'contain',
            filter: 'drop-shadow(0 4px 18px rgba(197, 34, 31, 0.25))',
            animation: 'pulse 1.8s infinite'
          }} 
        />

        <div style={{ 
          fontSize: '0.85rem', 
          letterSpacing: '0.2em', 
          textTransform: 'uppercase', 
          color: 'var(--accent-crimson, #C5221F)', 
          fontWeight: '700',
          marginTop: '0.3rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.4rem'
        }}>
          <Radio size={14} className="pulse-dot" /> LIVE EDITORIAL NETWORK
        </div>
      </div>

      {/* Progress Bar Container */}
      <div style={{ 
        width: '100%', 
        maxWidth: '360px', 
        height: '6px', 
        backgroundColor: 'var(--border-medium, #E5E7EB)', 
        borderRadius: '10px', 
        overflow: 'hidden',
        marginBottom: '1.25rem'
      }}>
        <div style={{ 
          height: '100%', 
          width: `${progress}%`, 
          backgroundColor: 'var(--accent-crimson, #C5221F)', 
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: '0 0 10px rgba(197, 34, 31, 0.6)'
        }} />
      </div>

      {/* Dynamic Status Text */}
      <div style={{ 
        fontSize: '0.875rem', 
        color: 'var(--text-subtle, #6B7280)', 
        fontWeight: '600',
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem'
      }}>
        <ShieldCheck size={16} color="var(--accent-emerald, #059669)" /> 
        {progress < 50 ? 'Connecting to Newsroom Stream...' : progress < 90 ? 'Verifying Ground-Truth Metadata...' : 'Opening PublicSpark...'}
      </div>
    </div>
  );
}
