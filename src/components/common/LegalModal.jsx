import React, { useState, useEffect } from 'react';
import { ShieldCheck, FileText, Info, Mail, AlertCircle, X, CheckCircle, Scale } from 'lucide-react';

export default function LegalModal({ isOpen, onClose, initialTab = 'privacy', currentLanguage = 'hi' }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.72)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: '860px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1.25rem 1.75rem',
          borderBottom: '1px solid var(--border-light)',
          background: 'var(--bg-secondary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Scale size={22} color="var(--accent-indigo)" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: '900', margin: 0, color: 'var(--text-main)', fontFamily: 'var(--font-serif)' }}>
              PUBLIC SPARK — Legal & Newsroom Standards
            </h2>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-subtle)',
              cursor: 'pointer',
              padding: '0.35rem',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Close dialog"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          padding: '0.75rem 1.75rem',
          borderBottom: '1px solid var(--border-light)',
          background: 'var(--bg-surface)',
          overflowX: 'auto',
          whiteSpace: 'nowrap'
        }}>
          <button
            onClick={() => setActiveTab('privacy')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 0.9rem',
              borderRadius: '20px',
              border: activeTab === 'privacy' ? '1px solid var(--accent-indigo)' : '1px solid transparent',
              background: activeTab === 'privacy' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
              color: activeTab === 'privacy' ? 'var(--accent-indigo)' : 'var(--text-muted)',
              fontWeight: '700',
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            <ShieldCheck size={16} /> Privacy Policy
          </button>

          <button
            onClick={() => setActiveTab('terms')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 0.9rem',
              borderRadius: '20px',
              border: activeTab === 'terms' ? '1px solid var(--accent-indigo)' : '1px solid transparent',
              background: activeTab === 'terms' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
              color: activeTab === 'terms' ? 'var(--accent-indigo)' : 'var(--text-muted)',
              fontWeight: '700',
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            <FileText size={16} /> Terms of Service
          </button>

          <button
            onClick={() => setActiveTab('about')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 0.9rem',
              borderRadius: '20px',
              border: activeTab === 'about' ? '1px solid var(--accent-indigo)' : '1px solid transparent',
              background: activeTab === 'about' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
              color: activeTab === 'about' ? 'var(--accent-indigo)' : 'var(--text-muted)',
              fontWeight: '700',
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            <Info size={16} /> About Us
          </button>

          <button
            onClick={() => setActiveTab('contact')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 0.9rem',
              borderRadius: '20px',
              border: activeTab === 'contact' ? '1px solid var(--accent-indigo)' : '1px solid transparent',
              background: activeTab === 'contact' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
              color: activeTab === 'contact' ? 'var(--accent-indigo)' : 'var(--text-muted)',
              fontWeight: '700',
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            <Mail size={16} /> Contact & Grievance
          </button>

          <button
            onClick={() => setActiveTab('ethics')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 0.9rem',
              borderRadius: '20px',
              border: activeTab === 'ethics' ? '1px solid var(--accent-indigo)' : '1px solid transparent',
              background: activeTab === 'ethics' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
              color: activeTab === 'ethics' ? 'var(--accent-indigo)' : 'var(--text-muted)',
              fontWeight: '700',
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            <AlertCircle size={16} /> Fact-Check & Ethics
          </button>
        </div>

        {/* Content Body */}
        <div style={{
          padding: '1.75rem',
          overflowY: 'auto',
          fontSize: '0.925rem',
          lineHeight: '1.7',
          color: 'var(--text-muted)'
        }}>
          {activeTab === 'privacy' && (
            <div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '0.75rem', fontFamily: 'var(--font-serif)' }}>
                Privacy Policy
              </h3>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-subtle)', marginBottom: '1.25rem' }}>
                Last updated: October 2026 | Compliant with Google AdSense, GDPR, and Indian Digital Personal Data Protection (DPDP) Act.
              </p>

              <h4 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-main)', marginTop: '1.25rem', marginBottom: '0.5rem' }}>
                1. Information We Collect
              </h4>
              <p>
                At <strong>PUBLIC SPARK</strong> (publicspark.in / localhost), accessible from our web portals, we prioritize visitor privacy. When you browse our digital newspaper, we may collect anonymous server log data (such as browser type, operating system, timestamp, referring pages, and anonymized geographic country) strictly to optimize reading performance and serve relevant news.
              </p>

              <h4 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-main)', marginTop: '1.25rem', marginBottom: '0.5rem' }}>
                2. Google AdSense & DoubleClick DART Cookies
              </h4>
              <p>
                Google is a third-party vendor on our site. It uses cookies, known as DART cookies, to serve ads to our site visitors based on their visit to publicspark.in and other sites on the internet. Visitors may choose to decline the use of DART cookies by visiting the Google Ad and Content Network Privacy Policy at: <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-indigo)' }}>https://policies.google.com/technologies/ads</a>.
              </p>

              <h4 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-main)', marginTop: '1.25rem', marginBottom: '0.5rem' }}>
                3. Third-Party Advertising Partners
              </h4>
              <p>
                Some of our advertising partners (including Google AdSense) may use cookies, web beacons, and JavaScript in their respective advertisements. These technologies automatically receive your IP address when ad requests occur. PUBLIC SPARK has no access to or control over cookies that are used by third-party advertisers.
              </p>

              <h4 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-main)', marginTop: '1.25rem', marginBottom: '0.5rem' }}>
                4. Data Security & Storage
              </h4>
              <p>
                We do not sell, trade, or transfer personally identifiable information to outside parties. User bookmarks and voting preferences are stored locally in your browser's private Web Storage and never uploaded without explicit consent.
              </p>
            </div>
          )}

          {activeTab === 'terms' && (
            <div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '0.75rem', fontFamily: 'var(--font-serif)' }}>
                Terms of Service
              </h3>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-subtle)', marginBottom: '1.25rem' }}>
                Effective Date: October 2026
              </p>

              <h4 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-main)', marginTop: '1.25rem', marginBottom: '0.5rem' }}>
                1. Acceptance of Terms
              </h4>
              <p>
                By accessing and reading <strong>PUBLIC SPARK</strong>, you agree to comply with and be bound by these Terms of Service. If you do not agree, please discontinue using the platform.
              </p>

              <h4 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-main)', marginTop: '1.25rem', marginBottom: '0.5rem' }}>
                2. Intellectual Property Rights
              </h4>
              <p>
                All editorial articles, original reporting, investigative photographs, logos, and digital audio recordings published on PUBLIC SPARK are the exclusive intellectual property of PublicSpark News Media or its credited syndication partners, protected under Indian and international copyright treaties.
              </p>

              <h4 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-main)', marginTop: '1.25rem', marginBottom: '0.5rem' }}>
                3. Permitted Fair Use & Social Sharing
              </h4>
              <p>
                Readers are encouraged to share article headlines and links on social platforms (WhatsApp, Twitter/X, Facebook, LinkedIn) using the integrated sharing tools. Reproduction of whole articles or automated scraping without written editorial permission is strictly prohibited.
              </p>
            </div>
          )}

          {activeTab === 'about' && (
            <div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '0.75rem', fontFamily: 'var(--font-serif)' }}>
                About PublicSpark Newsroom
              </h3>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-subtle)', marginBottom: '1.25rem' }}>
                Independent, Multi-Lingual Public Interest Digital Journalism
              </p>

              <p>
                <strong>PUBLIC SPARK</strong> is a modern independent digital news platform founded with a clear mandate: to deliver rapid, ground-verified, unbiased public interest journalism to citizens across India in their native mother tongue.
              </p>

              <h4 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-main)', marginTop: '1.25rem', marginBottom: '0.5rem' }}>
                Our Core Pillars
              </h4>
              <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <li><strong>Native Language Equality:</strong> Every citizen deserves access to verified national and global affairs in their preferred language (Hindi, Bengali, Marathi, Telugu, Tamil, Gujarati, and beyond).</li>
                <li><strong>Human-First Verification:</strong> While we leverage AI tools to assist in transcription and multi-lingual access, our core reporting is led by human correspondents and verified by senior editors.</li>
                <li><strong>Accessibility for All:</strong> High-definition natural neural audio narration enables visually impaired and busy readers to listen to every story effortlessly.</li>
              </ul>

              <h4 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-main)', marginTop: '1.25rem', marginBottom: '0.5rem' }}>
                Editorial Leadership
              </h4>
              <p>
                Led by <strong>Kabir Roy</strong> (Editor-in-Chief), <strong>Dr. Priya Ramachandran</strong> (Senior Science & Tech Editor), and <strong>Sneha Verma</strong> (Climate & Environment Lead).
              </p>
            </div>
          )}

          {activeTab === 'contact' && (
            <div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '0.75rem', fontFamily: 'var(--font-serif)' }}>
                Contact Us & Grievance Redressal
              </h3>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-subtle)', marginBottom: '1.25rem' }}>
                Compliance with Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)' }}>
                  <div style={{ fontWeight: '800', color: 'var(--text-main)', marginBottom: '0.35rem' }}>Editorial Desk</div>
                  <div style={{ fontSize: '0.85rem' }}>editor@publicspark.in</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', marginTop: '0.25rem' }}>Press releases, story leads & corrections</div>
                </div>

                <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)' }}>
                  <div style={{ fontWeight: '800', color: 'var(--text-main)', marginBottom: '0.35rem' }}>Advertising & Partnerships</div>
                  <div style={{ fontSize: '0.85rem' }}>ads@publicspark.in</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', marginTop: '0.25rem' }}>Brand partnerships & verified sponsor inquiries</div>
                </div>
              </div>

              <h4 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-main)', marginTop: '1.25rem', marginBottom: '0.5rem' }}>
                Statutory Grievance Redressal Officer
              </h4>
              <p>
                In accordance with the Information Technology Rules, 2021, the contact details of our designated Grievance Officer are:
              </p>
              <div style={{ background: 'rgba(99, 102, 241, 0.05)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--accent-indigo)' }}>
                <p style={{ margin: '0 0 0.25rem 0' }}><strong>Name:</strong> Rajesh Sharma</p>
                <p style={{ margin: '0 0 0.25rem 0' }}><strong>Designation:</strong> Head of Standards & Grievance Redressal</p>
                <p style={{ margin: '0 0 0.25rem 0' }}><strong>Address:</strong> PublicSpark Media Bureau, Institutional Area, New Delhi - 110001, India</p>
                <p style={{ margin: 0 }}><strong>Email:</strong> grievance@publicspark.in</p>
              </div>
            </div>
          )}

          {activeTab === 'ethics' && (
            <div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '0.75rem', fontFamily: 'var(--font-serif)' }}>
                Editorial Code of Ethics & Fact-Checking Policy
              </h3>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-subtle)', marginBottom: '1.25rem' }}>
                Our commitment to truth, transparency, and non-partisanship.
              </p>

              <h4 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-main)', marginTop: '1.25rem', marginBottom: '0.5rem' }}>
                1. Rigorous Fact Verification
              </h4>
              <p>
                Every story published under the PublicSpark banner undergoes verification by editorial desk staff. We cross-verify breaking developments against primary public documents, official spokespersons, accredited wire feeds (ISRO, PIB, PTI, Reuters), and credible on-ground correspondents.
              </p>

              <h4 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-main)', marginTop: '1.25rem', marginBottom: '0.5rem' }}>
                2. Corrections & Retractions Policy
              </h4>
              <p>
                Accuracy is paramount. When an error occurs, PublicSpark publishes a clear and prominent correction note at the top or bottom of the article specifying what was amended and when. Readers can notify the editorial desk directly via editor@publicspark.in.
              </p>

              <h4 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-main)', marginTop: '1.25rem', marginBottom: '0.5rem' }}>
                3. Non-Partisanship & Independence
              </h4>
              <p>
                Our editorial voice is independent of any political party, corporate conglomerate, or ideological interest. Opinion columns and analysis pieces are always distinctly labeled to distinguish them from factual news reporting.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.75rem',
          borderTop: '1px solid var(--border-light)',
          background: 'var(--bg-secondary)',
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <button 
            onClick={onClose} 
            className="btn btn-primary"
            style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', borderRadius: '20px' }}
          >
            Understood & Close
          </button>
        </div>
      </div>
    </div>
  );
}
