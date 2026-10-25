import React, { useEffect, useState } from 'react';
import { Newspaper, Flame, ShieldCheck, Radio } from 'lucide-react';

export default function LoadingSplash({ onFinished }) {
  const [progress, setProgress] = useState(15);
  const [isExiting, setIsExiting] = useState(false);
  const onFinishedRef = React.useRef(onFinished);
  onFinishedRef.current = onFinished;

  useEffect(() => {
    const timer1 = setTimeout(() => setProgress(45), 150);
    const timer2 = setTimeout(() => setProgress(80), 450);
    const timer3 = setTimeout(() => {
      setProgress(100);
      setIsExiting(true);
    }, 750);

    const timer4 = setTimeout(() => {
      if (onFinishedRef.current) onFinishedRef.current();
    }, 1050);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, []);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      backgroundColor: isExiting ? 'transparent' : 'var(--bg-primary, #FAF8F5)',
      opacity: isExiting ? 0 : 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      transition: 'opacity 0.5s ease, background-color 0.5s ease',
      pointerEvents: isExiting ? 'none' : 'auto'
    }}>
      {/* Animated Flying Masthead Logo */}
      <div style={{ 
        textAlign: 'center', 
        marginBottom: '1.75rem',
        transform: isExiting ? 'translateY(-240px) scale(0.85)' : 'translateY(0) scale(1)',
        opacity: isExiting ? 0 : 1,
        transition: 'transform 0.65s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease-out'
      }}>
        <img 
          src="/logo.png" 
          alt="PUBLIC SPARK Logo" 
          style={{ 
            height: '115px', 
            width: 'auto', 
            objectFit: 'contain',
            filter: 'drop-shadow(0 6px 22px rgba(197, 34, 31, 0.3))',
            animation: isExiting ? 'none' : 'pulse 1.8s infinite'
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
          gap: '0.4rem',
          opacity: isExiting ? 0 : 1,
          transition: 'opacity 0.3s ease'
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
        marginBottom: '1.25rem',
        opacity: isExiting ? 0 : 1,
        transform: isExiting ? 'translateY(20px)' : 'translateY(0)',
        transition: 'opacity 0.35s ease, transform 0.35s ease'
      }}>
        <div style={{ 
          height: '100%', 
          width: `${progress}%`, 
          backgroundColor: 'var(--accent-crimson, #C5221F)', 
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: '0 0 12px rgba(197, 34, 31, 0.7)'
        }} />
      </div>

      {/* Dynamic Status Text */}
      <div style={{ 
        fontSize: '0.875rem', 
        color: 'var(--text-subtle, #6B7280)', 
        fontWeight: '600',
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        opacity: isExiting ? 0 : 1,
        transform: isExiting ? 'translateY(20px)' : 'translateY(0)',
        transition: 'opacity 0.35s ease 0.05s, transform 0.35s ease 0.05s'
      }}>
        <ShieldCheck size={16} color="var(--accent-emerald, #059669)" /> 
        {progress < 50 ? 'Connecting to Newsroom Stream...' : progress < 90 ? 'Verifying Ground-Truth Metadata...' : 'Opening PublicSpark...'}
      </div>
    </div>
  );
}
