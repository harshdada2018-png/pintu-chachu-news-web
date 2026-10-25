import { StrictMode, Component } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[PublicSpark Root Crash Caught]:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          backgroundColor: '#FAF8F5',
          color: '#1F2937',
          textAlign: 'center'
        }}>
          <img src="/logo.png" alt="Public Spark" style={{ height: '70px', marginBottom: '1.5rem' }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem', color: '#C5221F' }}>
            Newsroom Loading Recovery
          </h2>
          <p style={{ maxWidth: '480px', color: '#4B5563', fontSize: '0.95rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
            The newsroom encountered a temporary script pause while loading. Click below to reload fresh news data.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                backgroundColor: '#C5221F',
                color: '#FFFFFF',
                padding: '0.65rem 1.4rem',
                borderRadius: '8px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Refresh Newsroom
            </button>
            <button
              onClick={() => { localStorage.clear(); window.location.reload(); }}
              style={{
                backgroundColor: '#E5E7EB',
                color: '#374151',
                padding: '0.65rem 1.4rem',
                borderRadius: '8px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Reset Cache & Reload
            </button>
          </div>
          {this.state.error && (
            <details style={{ marginTop: '2rem', textAlign: 'left', maxWidth: '600px', backgroundColor: '#F3F4F6', padding: '1rem', borderRadius: '8px', fontSize: '0.8rem', color: '#6B7280' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Error Details</summary>
              <pre style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {this.state.error.toString()}
              </pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

console.log('[PublicSpark main.jsx ready to mount]');
const pre = document.querySelector('.preloader-bg');
if (pre) pre.remove();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
