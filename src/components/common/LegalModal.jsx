import React, { useState, useEffect } from 'react';
import { ArrowLeft, Scale, Trash2, CheckCircle2, Volume2, ShieldCheck, ExternalLink, HelpCircle, Megaphone, FileText } from 'lucide-react';

export default function LegalModal({ isOpen, onClose, initialTab = 'terms', onOpenGrievance }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [clearedStatus, setClearedStatus] = useState(false);

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

  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    const contentEl = document.querySelector('.legal-portal-content');
    if (contentEl) contentEl.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleClearPreferences = () => {
    try {
      localStorage.removeItem('ps_user_theme');
      localStorage.removeItem('ps_saved_articles');
      localStorage.removeItem('ps_font_scale');
      localStorage.removeItem('ps_recent_searches');
      localStorage.removeItem('ps_offline_cache');
      setClearedStatus(true);
      setTimeout(() => {
        setClearedStatus(false);
        window.location.reload();
      }, 1200);
    } catch (e) {
      console.warn('Error clearing preferences:', e);
    }
  };

  if (!isOpen) return null;

  const docTitles = {
    terms: 'सेवा की शर्तें (Terms of Use)',
    privacy: 'गोपनीयता नीति (Privacy Policy)',
    cookies: 'डेटा नियंत्रण व कुकी प्राथमिकताएं (Do Not Sell My Info)',
    accessibility: 'डिजिटल सुलभता कथन व सहायता (Accessibility)',
    advertise: 'हमारे साथ विज्ञापन दें (Advertise With Us)',
    ethics: 'संपादकीय आचार संहिता व तथ्य-जांच (Ethics Code)',
    contact: 'शिकायत निवारण अधिकारी (IT Rules 2021 Level-I)',
    disclaimer: 'बाहरी लिंक्स व सुरक्षित आश्रय (Safe Harbor)'
  };

  const allTabs = [
    { key: 'terms', label: 'सेवा की शर्तें' },
    { key: 'privacy', label: 'गोपनीयता नीति' },
    { key: 'cookies', label: 'डेटा व कुकी नियंत्रण' },
    { key: 'accessibility', label: 'सुलभता व सहायता' },
    { key: 'advertise', label: 'विज्ञापन दें' },
    { key: 'ethics', label: 'आचार संहिता' },
    { key: 'contact', label: 'शिकायत निवारण' },
    { key: 'disclaimer', label: 'सुरक्षित आश्रय' }
  ];

  return (
    <div 
      className="legal-portal-fullscreen"
      role="dialog"
      aria-modal="true"
      aria-label="Public Spark Legal and Standards Portal"
    >
      {/* Sleek Microsoft-Grade Sticky Topbar */}
      <header className="legal-portal-topbar">
        <div className="legal-portal-topbar-left">
          <img src="/logo.png" alt="Public Spark Logo" className="legal-portal-logo" />
          <div className="legal-portal-topbar-divider"></div>
          <span className="legal-portal-doc-title">{docTitles[activeTab] || 'विधिक प्रलेख'}</span>
        </div>

        <button 
          onClick={onClose}
          className="legal-portal-close-btn"
          title="मुख्य समाचार पर लौटें (Return to Newsroom - ESC)"
          aria-label="Close Legal Portal"
        >
          <ArrowLeft size={16} />
          <span>मुख्य समाचार पर लौटें (ESC)</span>
        </button>
      </header>

      {/* Centered Microsoft-Grade Reading Canvas (Zero Sidebar Clutter) */}
      <main className="legal-portal-content">
        <div className="legal-portal-doc-container">

          {/* 1. SEVA KI SHARTEIN (TERMS OF USE) */}
          {activeTab === 'terms' && (
            <div>
              <div className="legal-doc-header">
                <h1 className="legal-doc-main-title">
                  सेवा की शर्तें (Terms of Use)
                </h1>
                <p className="legal-doc-meta">
                  प्रभावी तिथि: 2026 | भारत सरकार के सूचना प्रौद्योगिकी नियम, 2021 (डिजिटल मीडिया आचार संहिता) के अंतर्गत
                </p>
              </div>

              <div className="legal-doc-callout">
                <strong>प्रस्तावना:</strong> 'पब्लिक स्पार्क' (Public Spark - publicspark.in) में आपका स्वागत है। पब्लिक स्पार्क एक स्वतंत्र, संप्रभु और जनहितैषी डिजिटल समाचार माध्यम है, जो भ्रष्टाचार से संबंधित तथ्यात्मक खबरें, धर्म, दर्शन, ज्योतिष विज्ञान, पर्यटन एवं संबंधित क्षेत्रों के विशेषज्ञों के विचारों और जानकारियों को पाठकों तक पहुंचाने के लिए प्रतिबद्ध है। इस पोर्टल का उपयोग करने पर आप निम्नलिखित सेवा शर्तों से पूर्णतः बंधे होने की विधिक सहमति व्यक्त करते हैं।
              </div>

              <h2 className="legal-doc-section-heading">
                1. सेवा की स्वीकृति (Acceptance of Terms)
              </h2>
              <p className="legal-doc-paragraph">
                पब्लिक स्पार्क पोर्टल (वेबसाइट, मोबाइल दृश्य अथवा ऑडियो सेवाओं) को एक्सेस अथवा पढ़ने पर आप भारतीय सूचना प्रौद्योगिकी अधिनियम, 2000 (IT Act, 2000), डिजिटल मीडिया आचार संहिता नियम 2021 (IT Rules, 2021) और इन सेवा शर्तों के पूर्ण अनुपालन की सहमति देते हैं। यदि आप इन शर्तों से सहमत नहीं हैं, तो कृपया पोर्टल का उपयोग न करें।
              </p>

              <h2 className="legal-doc-section-heading">
                2. बौद्धिक संपदा अधिकार एवं कॉपीराइट (Intellectual Property & Copyright)
              </h2>
              <p className="legal-doc-paragraph">
                <strong>स्वामित्व:</strong> पब्लिक स्पार्क पर प्रकाशित समस्त मौलिक अन्वेषणात्मक समाचार लेख, ग्राउंड रिपोर्ट्स, ऑरिजनल फोटोग्राफ, ऑडियो बुलेटिन, लोगो, डिज़ाइन एवं तकनीकी कोड पब्लिक स्पार्क की बौद्धिक संपदा हैं, जो भारतीय कॉपीराइट अधिनियम, 1957 (Copyright Act, 1957) के अंतर्गत पूर्णतः संरक्षित हैं।
              </p>
              <p className="legal-doc-paragraph">
                <strong>उचित उपयोग व सोशल शेयरिंग:</strong> पाठकों को व्हाट्सएप (WhatsApp), फेसबुक, एक्स (ट्विटर), अथवा निजी संवाद में समाचार के शीर्षक (Headlines), संक्षिप्त सार और आधिकारिक वेब-लिंक को साझा करने की पूरी अनुमति है, बशर्ते पब्लिक स्पार्क को स्पष्ट श्रेय (Attribution) दिया जाए।
              </p>
              <p className="legal-doc-paragraph">
                <strong>डेटा स्क्रैपिंग पर पूर्ण प्रतिबंध:</strong> पब्लिक स्पार्क की किसी भी सामग्री, डेटाबेस या ऑडियो को किसी भी स्वचालित बॉट (Automated Bot), डेटा स्क्रैपर (Web Scraper), अथवा व्यावसायिक पुनःप्रकाशन के लिए बिना पूर्व लिखित अनुमति के उपयोग करना सख्त वर्जित और कानूनी रूप से दंडनीय है।
              </p>

              <h2 className="legal-doc-section-heading">
                3. भ्रष्टाचार व अन्वेषणात्मक रिपोर्टिंग नीति (Anti-Corruption & Fact Reporting)
              </h2>
              <p className="legal-doc-paragraph">
                पब्लिक स्पार्क भ्रष्टाचार, प्रशासनिक अनियमितताओं और जनहित के मुद्दों पर केवल तथ्यात्मक (factual), दस्तावेजी साक्ष्यों (RTI, सरकारी गजट अधिसूचनाएं, आधिकारिक प्रेस विज्ञप्तियां, न्यायिक आदेश) और ऑन-ग्राउंड सत्यापन के आधार पर ही समाचार प्रकाशित करता है। किसी भी प्रकार की झूठी अथवा दुर्भावनापूर्ण मानहानि (Defamation under Bharatiya Nyaya Sanhita) वाली सामग्री प्रकाशित न करने के लिए पब्लिक स्पार्क कटिबद्ध है। जिस किसी भी पक्ष पर आरोप या जांच का उल्लेख होता है, उसे अपना पक्ष (Right of Reply) रखने का पूरा निष्पक्ष अवसर दिया जाता है।
              </p>

              <h2 className="legal-doc-section-heading">
                4. धर्म, ज्योतिष एवं पर्यटन सामग्री अस्वीकरण (Dharma, Astrology & Tourism Disclaimer)
              </h2>
              <p className="legal-doc-paragraph">
                <strong>सांस्कृतिक एवं सामान्य जानकारी:</strong> पोर्टल पर धर्म, दर्शन, वेद, मंदिर इतिहास और सांस्कृतिक उत्सवों से संबंधित सामग्री जन-जागरूकता एवं सांस्कृतिक संरक्षण के उद्देश्य से प्रस्तुत की जाती है।
              </p>
              <p className="legal-doc-paragraph">
                <strong>ज्योतिष एवं राशिफल:</strong> ज्योतिषीय गणनाएं, पंचांग, ग्रह-गोचर और राशिफल संबंधित क्षेत्र के विशेषज्ञों के विचारों और पारंपरिक खगोलीय गणनाओं पर आधारित होते हैं। पब्लिक स्पार्क किसी भी पाठक को अंधविश्वास, भय अथवा किसी निश्चित परिणाम का दावा नहीं करता।
              </p>
              <p className="legal-doc-paragraph">
                <strong>व्यावसायिक सलाह नहीं:</strong> यह सामग्री किसी भी प्रकार की चिकित्सीय (medical), कानूनी (legal), या वित्तीय (financial) सलाह का विकल्प नहीं है। पाठक अपने जीवन, स्वास्थ्य और निवेश से जुड़े निर्णय अपने स्वविवेक अथवा अधिकृत पेशेवरों के परामर्श से ही लें।
              </p>

              <h2 className="legal-doc-section-heading">
                5. पाठकों का आचरण व निषिद्ध गतिविधियां (Prohibited User Conduct)
              </h2>
              <p className="legal-doc-paragraph">
                पोर्टल का उपयोग करते समय पाठक वेबसाइट की सुरक्षा प्रणालियों को नुकसान पहुँचाने, अनधिकृत सर्वर एक्सेस, रिवर्स-इंजीनियरिंग, दुर्भावनापूर्ण कोड/मैलवेयर इंजेक्ट करने, अथवा भ्रामक व साम्प्रदायिक सद्भाव बिगाड़ने वाली टिप्पणियां करने जैसी गतिविधियों में लिप्त नहीं होंगे।
              </p>

              <h2 className="legal-doc-section-heading">
                6. बाहरी लिंक्स व सुरक्षित आश्रय (External Links & Safe Harbor)
              </h2>
              <p className="legal-doc-paragraph">
                पब्लिक स्पार्क पाठकों की संदर्भ सुविधा के लिए सरकारी पोर्टल (PIB, Gazette of India, न्यायालय आदेश आदि) अथवा बाहरी वेबसाइटों के लिंक्स प्रदान कर सकता है। इन बाहरी वेबसाइटों की सामग्री, सुरक्षा और नीतियों पर पब्लिक स्पार्क का कोई नियंत्रण नहीं है। किसी बाहरी लिंक पर जाने पर पाठक उस संबंधित वेबसाइट की शर्तों के अधीन होंगे।
              </p>

              <h2 className="legal-doc-section-heading">
                7. शिकायत निवारण व कानूनी अनुपालन (Grievance Redressal - IT Rules 2021)
              </h2>
              <p className="legal-doc-paragraph">
                भारत सरकार के डिजिटल मीडिया नियमों (IT Rules, 2021 के नियम 11) के अंतर्गत पब्लिक स्पार्क ने एक समर्पित शिकायत निवारण तंत्र स्थापित किया है। किसी भी सामग्री पर आपत्ति या तथ्यात्मक संशोधन हेतु पाठक सीधे हमारे शिकायत निवारण अधिकारी (Grievance Officer: <code>publicspark.in@gmail.com</code>) से संपर्क कर सकते हैं, जिस पर 24 घंटे में पावती और 15 दिनों के भीतर विधिक निस्तारण दिया जाएगा। पाठक हमारे 'शिकायत फॉर्म' के माध्यम से भी डिजिटल टिकट दर्ज कर सकते हैं।
              </p>

              <h2 className="legal-doc-section-heading">
                8. शासी कानून एवं न्यायक्षेत्र (Governing Law & Legal Jurisdiction)
              </h2>
              <p className="legal-doc-paragraph">
                इन सेवा शर्तों की व्याख्या और इनसे उत्पन्न होने वाले किसी भी विवाद का निपटारा भारतीय कानूनों के अंतर्गत होगा और इसके लिए भारत के सक्षम न्यायालयों का ही अनन्य क्षेत्राधिकार (Exclusive Jurisdiction) मान्य होगा।
              </p>
            </div>
          )}

          {/* 2. GOPANIYATA NITI (PRIVACY POLICY) */}
          {activeTab === 'privacy' && (
            <div>
              <div className="legal-doc-header">
                <h1 className="legal-doc-main-title">
                  गोपनीयता नीति (Privacy Policy)
                </h1>
                <p className="legal-doc-meta">
                  प्रभावी तिथि: 2026 | गूगल ऐडसेंस (Google AdSense) एवं डिजिटल पर्सनल डेटा प्रोटेक्शन अधिनियम, 2023 (DPDP Act, India) के अंतर्गत
                </p>
              </div>

              <div className="legal-doc-callout">
                <strong>शून्य डेटा बिक्री गारंटी (Zero Data Sale Guarantee):</strong> 'पब्लिक स्पार्क' (publicspark.in) अपने पाठकों की गोपनीयता और डेटा सुरक्षा को सर्वोच्च प्राथमिकता देता है। हम स्पष्ट रूप से वचनबद्ध हैं कि पब्लिक स्पार्क किसी भी पाठक का व्यक्तिगत डेटा, नाम, फोन, अथवा ईमेल किसी भी डेटा ब्रोकर या तीसरे पक्ष को कभी नहीं बेचता, किराए पर नहीं देता और न ही व्यावसायिक लाभ के लिए साझा करता है।
              </div>

              <h2 className="legal-doc-section-heading">
                1. हम कौन सा डेटा एकत्र करते हैं और क्यों? (Information We Collect)
              </h2>
              <p className="legal-doc-paragraph">
                <strong>अनाम सर्वर तकनीकी डेटा:</strong> जब आप हमारी वेबसाइट पर समाचार पढ़ते हैं, तो ब्राउज़र का प्रकार, ऑपरेटिंग सिस्टम, समय, और अनाम देश का स्तर केवल वेबसाइट की स्पीड बढ़ाने, सर्वर लोड संतुलित करने और साइबर सुरक्षा (DDoS हमलों से बचाव) के लिए अधिकतम 30 दिनों के लिए लॉग होता है।
              </p>
              <p className="legal-doc-paragraph">
                <strong>स्थानीय ब्राउज़र स्टोरेज (Local Storage Privacy):</strong> आपकी भाषा की पसंद (Hindi/English/Regional), डार्क या लाइट थीम, फ़ॉन्ट का आकार (A- / A / A+), और ऑफ़लाइन सुरक्षित की गई खबरें (Saved Stories) केवल आपके अपने मोबाइल या कंप्यूटर के ब्राउज़र (Local Storage) में ही रहती हैं। यह डेटा हमारे केंद्रीय सर्वर पर कभी अपलोड नहीं होता।
              </p>

              <h2 className="legal-doc-section-heading">
                2. गूगल ऐडसेंस एवं डार्ट कुकीज़ (Google AdSense & DoubleClick DART Cookies)
              </h2>
              <p className="legal-doc-paragraph">
                <strong>तृतीय-पक्ष विज्ञापन नेटवर्क:</strong> पब्लिक स्पार्क स्वतंत्र पत्रकारिता के परिचालन खर्चों को पूरा करने के लिए गूगल ऐडसेंस (Google AdSense) विज्ञापनों का उपयोग कर सकता है। गूगल हमारी साइट पर एक अधिकृत तृतीय-पक्ष विक्रेता के रूप में कुकीज़ (DART Cookies) का उपयोग करता है।
              </p>
              <p className="legal-doc-paragraph">
                <strong>कुकीज़ का उद्देश्य:</strong> DART कुकीज़ का उपयोग पाठकों को इंटरनेट पर उनकी पिछली विज़िट के आधार पर प्रासंगिक विज्ञापन दिखाने के लिए किया जाता है।
              </p>
              <p className="legal-doc-paragraph">
                <strong>ऑप्ट-आउट करने की स्वतंत्रता (Opt-Out):</strong> पाठक अपनी इच्छानुसार किसी भी समय गूगल की विज्ञापन गोपनीयता नीति पृष्ठ पर जाकर DART कुकीज़ को अस्वीकार (Opt-Out) कर सकते हैं: <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-crimson)', textDecoration: 'underline' }}>https://policies.google.com/technologies/ads</a>.
              </p>

              <h2 className="legal-doc-section-heading">
                3. स्थानीय प्रायोजक व प्रत्यक्ष विज्ञापन टेलीमेट्री (Direct Sponsor Telemetry)
              </h2>
              <p className="legal-doc-paragraph">
                पब्लिक स्पार्क स्थानीय व्यापारियों और क्षेत्रीय व्यवसायों के लिए सीधे इन-हाउस बैनर प्रदर्शित करता है। हमारी इन-हाउस एनालिटिक्स प्रणाली केवल विज्ञापनों के <strong>कुल दृश्य (Views/Impressions) और क्लिक्स (Clicks)</strong> की संख्या को अनाम रूप में गिनती है। हम किसी भी पाठक की व्यक्तिगत पहचान अथवा क्रॉस-साइट ब्राउज़िंग इतिहास को कभी ट्रैक नहीं करते।
              </p>

              <h2 className="legal-doc-section-heading">
                4. डेटा सुरक्षा एवं भारतीय कानून अनुपालन (DPDP Act 2023 Compliance)
              </h2>
              <p className="legal-doc-paragraph">
                भारत सरकार के डिजिटल पर्सनल डेटा प्रोटेक्शन अधिनियम, 2023 (Digital Personal Data Protection Act, 2023) के प्रावधानों के तहत हमारे सर्वर पर आधुनिक फ़ायरवॉल, दर-सीमित (Rate Limiting), और कड़े एक्सेस नियंत्रण लागू हैं। किसी भी अनाधिकृत एक्सेस या डेटा लीक को रोकने के लिए नियमित सुरक्षा ऑडिट किए जाते हैं।
              </p>

              <h2 className="legal-doc-section-heading">
                5. बच्चों की गोपनीयता (Children's Online Privacy)
              </h2>
              <p className="legal-doc-paragraph">
                पब्लिक स्पार्क 13 वर्ष से कम आयु के बच्चों से जानबूझकर कोई भी व्यक्तिगत पहचान योग्य जानकारी एकत्र नहीं करता है। हमारा पोर्टल सार्वजनिक समाचार, धर्म, संस्कृति, ज्योतिष और पर्यटन से संबंधित सामान्य जनहितैषी जानकारी प्रदान करता है।
              </p>

              <h2 className="legal-doc-section-heading">
                6. पाठकों के डेटा अधिकार एवं कुकीज़ हटाना (Data Rights & Clear Storage)
              </h2>
              <p className="legal-doc-paragraph">
                पाठकों को अपने डिवाइस पर किसी भी समय अपने ब्राउज़र की सेटिंग से कुकीज़ और लोकल स्टोरेज डेटा को मिटाने का पूर्ण अधिकार है।
              </p>

              <h2 className="legal-doc-section-heading">
                7. गोपनीयता संपर्क अधिकारी (Privacy Contact & Grievance)
              </h2>
              <p className="legal-doc-paragraph">
                गोपनीयता नीति अथवा डेटा सुरक्षा से संबंधित किसी भी प्रश्न या शिकायत के लिए आप सीधे हमारे विधिक डेस्क से संपर्क कर सकते हैं:
              </p>
              <div style={{ background: 'var(--bg-secondary)', padding: '1rem 1.25rem', borderRadius: '4px', border: '1px solid var(--border-light)', marginTop: '0.75rem' }}>
                <p style={{ margin: '0 0 0.35rem 0' }}><strong>गोपनीयता व विधिक डेस्क:</strong> पब्लिक स्पार्क डिजिटल न्यूज़ नेटवर्क</p>
                <p style={{ margin: 0 }}><strong>आधिकारिक ईमेल:</strong> <code>publicspark.in@gmail.com</code></p>
              </div>
            </div>
          )}

          {/* 3. DO NOT SELL MY INFO / COOKIE PREFERENCES */}
          {activeTab === 'cookies' && (
            <div>
              <div className="legal-doc-header">
                <h1 className="legal-doc-main-title">
                  डेटा नियंत्रण व कुकी प्राथमिकताएं (Do Not Sell My Info)
                </h1>
                <p className="legal-doc-meta">
                  प्रभावी तिथि: 2026 | डिजिटल पर्सनल डेटा प्रोटेक्शन अधिनियम, 2023 (DPDP Act, India) एवं ग्लोबल प्राइवेसी राइट्स
                </p>
              </div>

              <div className="legal-doc-callout">
                <strong>शून्य व्यक्तिगत डेटा बिक्री की कानूनी गारंटी:</strong> पब्लिक स्पार्क किसी भी परिस्थिति में अपने पाठकों का व्यक्तिगत डेटा, पहचान, फोन नंबर, अथवा ईमेल किसी भी तृतीय-पक्ष विज्ञापनदाता, डेटा ब्रोकर, या मार्केटिंग एजेंसी को कभी नहीं बेचता है। हमारे यहां पाठक कोई 'उत्पाद' नहीं, बल्कि सम्मानित नागरिक हैं।
              </div>

              <h2 className="legal-doc-section-heading">
                1. हम आपके ब्राउज़र में क्या स्टोर करते हैं? (Local Storage Transparency)
              </h2>
              <p className="legal-doc-paragraph">
                पब्लिक स्पार्क आपके ब्राउज़िंग अनुभव को तेज़, सहज और व्यक्तिगत बनाने के लिए आपके अपने डिवाइस के <strong>लोकल स्टोरेज (Browser Local Storage)</strong> का उपयोग करता है। इसमें निम्नलिखित सेटिंग्स शामिल हैं:
              </p>
              <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-muted)', lineHeight: '1.8', marginBottom: '1rem' }}>
                <li><strong>पसंदीदा भाषा (Language Selection):</strong> आपकी चुनी हुई भाषा (हिंदी या क्षेत्रीय भाषा)।</li>
                <li><strong>विज़ुअल थीम (Theme Mode):</strong> डार्क मोड अथवा लाइट मोड की पसंद।</li>
                <li><strong>फ़ॉन्ट का आकार (Font Scaler):</strong> पढ़ने की सुगमता के लिए चुना गया टेक्स्ट साइज़ (A- / A / A+)।</li>
                <li><strong>ऑफ़लाइन सुरक्षित समाचार (Saved Articles):</strong> आपके द्वारा बाद में पढ़ने के लिए सहेजे गए लेख।</li>
              </ul>
              <p className="legal-doc-paragraph">
                यह समस्त डेटा आपके अपने मोबाइल या कंप्यूटर के भीतर सुरक्षित रहता है और हमारे सर्वर पर कभी नहीं भेजा जाता।
              </p>

              <h2 className="legal-doc-section-heading">
                2. तृतीय-पक्ष विज्ञापन कुकीज़ एवं गूगल DART नियंत्रण
              </h2>
              <p className="legal-doc-paragraph">
                पब्लिक स्पार्क पर गूगल ऐडसेंस (Google AdSense) द्वारा प्रासंगिक विज्ञापन दिखाए जा सकते हैं, जो DART कुकीज़ का उपयोग करते हैं। यदि आप पर्सनलाइज्ड विज्ञापनों को बंद करना चाहते हैं, तो आप सीधे गूगल के आधिकारिक सेटिंग्स पेज पर जाकर इसे निष्क्रिय कर सकते हैं:
              </p>
              <p className="legal-doc-paragraph">
                <a 
                  href="https://adssettings.google.com" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={{ color: 'var(--accent-crimson)', textDecoration: 'underline', fontWeight: '600' }}
                >
                  गूगल विज्ञापन प्राथमिकताएं प्रबंधित करें (Google Ads Settings) →
                </a>
              </p>

              <h2 className="legal-doc-section-heading">
                3. त्वरित डेटा रीसेट व कैश निष्कासन (Clear Local Data)
              </h2>
              <p className="legal-doc-paragraph">
                यदि आप अपने डिवाइस से पब्लिक स्पार्क से संबंधित सभी स्थानीय प्राथमिकताएं, बुकमार्क्स और थीम कैश को तत्काल हटाना चाहते हैं, तो नीचे दिए गए बटन पर क्लिक करें:
              </p>

              <div style={{ marginTop: '1.25rem', marginBottom: '1.5rem', background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
                <button
                  type="button"
                  onClick={handleClearPreferences}
                  style={{
                    background: clearedStatus ? 'var(--text-main)' : 'var(--accent-crimson)',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.65rem 1.35rem',
                    borderRadius: '4px',
                    fontWeight: '700',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    minHeight: '44px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {clearedStatus ? (
                    <>
                      <CheckCircle2 size={18} />
                      <span>डेटा सफलतापूर्वक साफ़ कर दिया गया! पेज रीलोड हो रहा है...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={18} />
                      <span>अपने डिवाइस का कैश व प्राथमिकताएं साफ़ करें (Clear Local Storage)</span>
                    </>
                  )}
                </button>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', margin: '0.65rem 0 0 0' }}>
                  नोट: यह क्रिया केवल आपके वर्तमान ब्राउज़र से थीम, फ़ॉन्ट साइज़ और सहेजे गए लेखों को हटाएगी।
                </p>
              </div>

              <h2 className="legal-doc-section-heading">
                4. संपर्क व विधिक परामर्श
              </h2>
              <p className="legal-doc-paragraph">
                डेटा नियंत्रण अथवा गोपनीयता से संबंधित किसी भी प्रश्न के लिए संपर्क करें: <code>publicspark.in@gmail.com</code>.
              </p>
            </div>
          )}

          {/* 4. ACCESSIBILITY STATEMENT & HELP */}
          {activeTab === 'accessibility' && (
            <div>
              <div className="legal-doc-header">
                <h1 className="legal-doc-main-title">
                  डिजिटल सुलभता कथन व पाठक सहायता (Accessibility Statement)
                </h1>
                <p className="legal-doc-meta">
                  प्रभावी तिथि: 2026 | WCAG 2.2 Level AA एवं डिजिटल समावेशिता मानकों के अंतर्गत
                </p>
              </div>

              <div className="legal-doc-callout">
                <strong>सार्वभौमिक पहुंच का संकल्प:</strong> पब्लिक स्पार्क का दृढ़ विश्वास है कि समाचार और जनहितैषी जानकारी प्राप्त करना प्रत्येक नागरिक का मूलभूत अधिकार है—चाहे उनकी शारीरिक क्षमता, दृष्टि सीमा या डिवाइस का प्रकार कुछ भी हो। हम अपने डिजिटल प्लेटफ़ॉर्म को भारत के दिव्यांगजनों, वरिष्ठ नागरिकों और सभी पाठकों के लिए पूर्णतः सुलभ (Accessible) बनाने के लिए प्रतिबद्ध हैं।
              </div>

              <h2 className="legal-doc-section-heading">
                1. एआई न्यूरल ऑडियो वाचन (AI Neural Audio Storytelling)
              </h2>
              <p className="legal-doc-paragraph">
                दृष्टिबाधित पाठकों, वरिष्ठ नागरिकों और यात्रा कर रहे पाठकों की सुविधा के लिए प्रत्येक समाचार लेख पर <strong>उच्च-गुणवत्ता युक्त प्राकृतिक आवाज़ में ऑडियो वाचन</strong> की सुविधा उपलब्ध है। लेख के ऊपर दिए गए <strong>[ सुनें ]</strong> बटन पर टैप करके पाठक पूरी खबर को बिना किसी रुकावट के सुन सकते हैं।
              </p>

              <h2 className="legal-doc-section-heading">
                2. गतिशील फ़ॉन्ट आकार नियंत्रण (Dynamic Font Scaler)
              </h2>
              <p className="legal-doc-paragraph">
                आंखों पर तनाव कम करने के लिए हेडर में <strong>A- / A / A+</strong> त्वरित नियंत्रण बटन उपलब्ध कराए गए हैं। पाठक अपनी दृष्टि सुविधा के अनुसार पूरे पृष्ठ के अक्षरों का आकार तुरंत छोटा, सामान्य या बड़ा कर सकते हैं।
              </p>

              <h2 className="legal-doc-section-heading">
                3. उच्च कंट्रास्ट एवं डार्क थीम (High Contrast & Dark Mode)
              </h2>
              <p className="legal-doc-paragraph">
                वेबसाइट का दृश्य इंटरफ़ेस WCAG 2.2 Level AA मानकों (न्यूनतम 4.5:1 कंट्रास्ट अनुपात) के अनुरूप डिज़ाइन किया गया है। रात के समय या कम रोशनी में पढ़ने के लिए पाठक एक क्लिक में डार्क मोड सक्रिय कर सकते हैं, जिससे स्क्रीन की चमक आंखों को नहीं चुभती।
              </p>

              <h2 className="legal-doc-section-heading">
                4. कीबोर्ड नेविगेशन एवं स्क्रीन रीडर संगतता (Screen Reader & Keyboard Friendly)
              </h2>
              <p className="legal-doc-paragraph">
                माउस के बिना केवल कीबोर्ड का उपयोग करने वाले पाठकों के लिए पूर्ण <strong>Tab एवं Shift+Tab</strong> नेविगेशन उपलब्ध है। डायलॉग या मेनू को बंद करने के लिए <strong>Escape (ESC)</strong> कुंजी का उपयोग किया जा सकता है। सभी छवियों (Images) में अर्थपूर्ण ऑल्ट-टेक्स्ट (Alt-Text) और बटनों में स्पष्ट ARIA लेबल्स दिए गए हैं ताकि NVDA, JAWS और Android TalkBack स्क्रीन रीडर्स सटीक उच्चारण कर सकें।
              </p>

              <h2 className="legal-doc-section-heading">
                5. सुलभता सहायता डेस्क (Accessibility Assistance Desk)
              </h2>
              <p className="legal-doc-paragraph">
                यदि किसी पाठक को वेबसाइट के किसी भी हिस्से को पढ़ने या उपयोग करने में कठिनाई महसूस होती है, तो कृपया हमारे सुलभता समन्वय दल को सूचित करें। हम आपकी प्रतिक्रिया के आधार पर प्राथमिकता से सुधार करेंगे:
              </p>
              <div style={{ background: 'var(--bg-secondary)', padding: '1rem 1.25rem', borderRadius: '4px', border: '1px solid var(--border-light)', marginTop: '0.75rem' }}>
                <p style={{ margin: '0 0 0.35rem 0' }}><strong>सुलभता एवं पाठक सहायता डेस्क:</strong> पब्लिक स्पार्क तकनीकी विभाग</p>
                <p style={{ margin: 0 }}><strong>आधिकारिक ईमेल:</strong> <code>publicspark.in@gmail.com</code></p>
              </div>
            </div>
          )}

          {/* 5. ADVERTISE WITH US (DIRECT SPONSOR CONNECT) */}
          {activeTab === 'advertise' && (
            <div>
              <div className="legal-doc-header">
                <h1 className="legal-doc-main-title">
                  हमारे साथ विज्ञापन दें (Advertise With Us)
                </h1>
                <p className="legal-doc-meta">
                  पारदर्शी, बिचौलिया-मुक्त स्थानीय एवं राष्ट्रीय ब्रांड प्रचार मंच
                </p>
              </div>

              <div className="legal-doc-callout">
                <strong>स्वच्छ एवं प्रत्यक्ष प्रायोजन:</strong> पब्लिक स्पार्क क्षेत्रीय व्यापारियों, शैक्षणिक संस्थानों, स्वास्थ्य सेवाओं, और राष्ट्रीय ब्रांड्स को बिना किसी तीसरे पक्ष के सीधे अपने पाठकों से जुड़ने का सशक्त और किफ़ायती मंच प्रदान करता है। आपके विज्ञापन सीधे उन जागरूक पाठकों तक पहुँचते हैं जो भ्रष्टाचार मुक्त शासन, जनहित और प्रामाणिक खबरों को महत्व देते हैं।
              </div>

              <h2 className="legal-doc-section-heading">
                1. उपलब्ध विज्ञापन स्लॉट्स (Premium Display Placements)
              </h2>
              <p className="legal-doc-paragraph">
                पब्लिक स्पार्क ने उच्च दृश्यता और पाठकों के सहज पढ़ने के अनुभव को संतुलित करते हुए 6 प्रमुख विज्ञापन स्लॉट्स निर्धारित किए हैं:
              </p>
              <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-muted)', lineHeight: '1.8', marginBottom: '1rem' }}>
                <li><strong>शीर्ष हेडर बैनर (Header Billboard):</strong> मुख्य पृष्ठ और सभी समाचारों के शीर्ष पर सर्वाधिक दिखने वाला स्थान।</li>
                <li><strong>समाचार के बीच में (In-Article Contextual Banner):</strong> पाठक जब खबर पढ़ रहे होते हैं, तब स्वाभाविक प्रवाह में दिखने वाला स्लॉट।</li>
                <li><strong>मोबाइल स्टिकी बॉटम बैनर (Mobile Sticky Banner):</strong> स्मार्टफ़ोन पर नीचे स्थिर रहने वाला उच्च-क्लिक दर वाला स्लॉट।</li>
                <li><strong>डेस्कटॉप साइडबार शोकेस (Desktop Sidebar):</strong> बड़ी स्क्रीन पर समाचार के साथ लगातार दिखाई देने वाला स्लॉट।</li>
                <li><strong>होमपेज लाइब्रेरी फीड बैनर (Home Feed Shelf Banner):</strong> विभिन्न समाचार श्रेणियों के बीच में स्थापित बैनर।</li>
                <li><strong>फुटर मैस्टहेड (Footer Masthead Banner):</strong> पृष्ठ के अंत में ब्रांड की विश्वसनीयता स्थापित करने वाला स्थान।</li>
              </ul>

              <h2 className="legal-doc-section-heading">
                2. 100% पारदर्शी प्रदर्शन आंकड़े (Transparent Metrics)
              </h2>
              <p className="legal-doc-paragraph">
                हम विज्ञापनदाताओं को कोई फर्जी या बढ़ा-चढ़ाकर बताए गए आंकड़े नहीं देते। हमारा इन-हाउस सिस्टम केवल वास्तविक <strong>इम्प्रेशन्स (Views) और क्लिक्स (Clicks)</strong> को अनाम रूप में रिकॉर्ड करता है। किसी भी विज्ञापनदाता को अभियान के दौरान और समापन पर विस्तृत रिपोर्ट प्रदान की जाती है।
              </p>

              <h2 className="legal-doc-section-heading">
                3. विज्ञापन सामग्री नीति (Ethical Advertising Standards)
              </h2>
              <p className="legal-doc-paragraph">
                पब्लिक स्पार्क पर निम्नलिखित श्रेणियों के विज्ञापन सख्त वर्जित हैं:
              </p>
              <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-muted)', lineHeight: '1.8', marginBottom: '1rem' }}>
                <li>सट्टेबाजी, जुआ, अथवा वित्तीय पोंजी स्कीम्स के विज्ञापन।</li>
                <li>बिना वैज्ञानिक प्रमाण के भ्रामक चिकित्सीय चमत्कार के दावे करने वाले विज्ञापन।</li>
                <li>धार्मिक विद्वेष, अश्लीलता या साम्प्रदायिक तनाव फैलाने वाली सामग्री।</li>
                <li>किसी भी प्रकार के अवैध उत्पाद अथवा भ्रामक सरकारी दावे।</li>
              </ul>

              <h2 className="legal-doc-section-heading">
                4. प्रत्यक्ष संपर्क व तुरंत ऑनबोर्डिंग (Direct Sponsor Connect)
              </h2>
              <p className="legal-doc-paragraph">
                अपने ब्रांड, संस्थान अथवा स्थानीय प्रतिष्ठान का विज्ञापन शुरू करने के लिए हमारी विज्ञापन डेस्क से सीधे संपर्क करें। आपको 12 कार्य घंटों के भीतर कस्टम रेट कार्ड और स्लॉट उपलब्धता की जानकारी दी जाएगी:
              </p>
              <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '4px', border: '1px solid var(--border-light)', marginTop: '0.75rem' }}>
                <p style={{ margin: '0 0 0.5rem 0' }}><strong>विज्ञापन एवं ब्रांड पार्टनरशिप डेस्क:</strong> पब्लिक स्पार्क मीडिया</p>
                <p style={{ margin: '0 0 0.5rem 0' }}><strong>आधिकारिक ईमेल:</strong> <code>publicspark.in@gmail.com</code></p>
                <p style={{ margin: 0 }}><strong>त्वरित व्हाट्सएप संपर्क:</strong> आधिकारिक व्हाट्सएप चैनल अथवा संपादकीय डेस्क के माध्यम से संपर्क करें।</p>
              </div>
            </div>
          )}

          {/* 6. EDITORIAL ETHICS & FACT-CHECK CODE */}
          {activeTab === 'ethics' && (
            <div>
              <div className="legal-doc-header">
                <h1 className="legal-doc-main-title">
                  संपादकीय आचार संहिता व तथ्य-जांच नीति (Editorial Ethics & Fact-Checking)
                </h1>
                <p className="legal-doc-meta">
                  प्रभावी तिथि: 2026 | भारतीय प्रेस परिषद (PCI) मानक एवं डिजिटल मीडिया आचार संहिता (IT Rules 2021)
                </p>
              </div>

              <div className="legal-doc-callout">
                <strong>सत्य, निष्पक्षता और जनहित का संकल्प:</strong> पब्लिक स्पार्क किसी भी राजनीतिक दल, कॉर्पोरेट घराने, या वैचारिक दबाव से पूर्णतः मुक्त एक स्वतंत्र डिजिटल मीडिया संस्थान है। हमारी पहली और अंतिम जवाबदेही केवल हमारे पाठकों और राष्ट्र के प्रति है। हम सनसनीखेज अफ़वाहों के बजाय ठोस, दस्तावेजी साक्ष्यों पर आधारित पत्रकारिता में विश्वास रखते हैं।
              </div>

              <h2 className="legal-doc-section-heading">
                1. भ्रष्टाचार व अन्वेषणात्मक रिपोर्टिंग के कठोर मानक
              </h2>
              <p className="legal-doc-paragraph">
                पब्लिक स्पार्क पर भ्रष्टाचार अथवा प्रशासनिक अनियमितताओं से जुड़ी कोई भी खबर केवल सुनी-सुनाई बातों पर प्रकाशित नहीं होती। प्रत्येक अन्वेषणात्मक रिपोर्ट को प्रकाशित करने से पूर्व निम्नलिखित प्राथमिक साक्ष्यों से जांचा जाता है:
              </p>
              <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-muted)', lineHeight: '1.8', marginBottom: '1rem' }}>
                <li>सूचना का अधिकार (RTI) के तहत प्राप्त प्रमाणित सरकारी दस्तावेज।</li>
                <li>संसद, विधानसभा, न्यायालयों के न्यायिक आदेश अथवा आधिकारिक आयोगों की रिपोर्ट्स।</li>
                <li>भारत के राजपत्र (The Gazette of India) अथवा राज्य सरकारों की आधिकारिक अधिसूचनाएं।</li>
                <li>संबंधित पीड़ित नागरिकों एवं ऑन-ग्राउंड प्रत्यक्षदर्शियों के सत्यापित बयान।</li>
              </ul>

              <h2 className="legal-doc-section-heading">
                2. प्रतिउत्तर का निष्पक्ष अवसर (Right of Reply)
              </h2>
              <p className="legal-doc-paragraph">
                जब भी किसी व्यक्ति, संस्था, अथवा सार्वजनिक पदाधिकारी पर किसी जांच अथवा वित्तीय अनियमितता का आरोप होता है, तो खबर प्रकाशित करने से पूर्व उनका पक्ष (Official Response / Right of Reply) जानने का पूरा निष्पक्ष प्रयास किया जाता है। यदि उत्तर प्राप्त होता है, तो उसे समाचार में समान प्रमुखता के साथ शामिल किया जाता है।
              </p>

              <h2 className="legal-doc-section-heading">
                3. धर्म, दर्शन, ज्योतिष एवं पर्यटन रिपोर्टिंग की शुचिता
              </h2>
              <p className="legal-doc-paragraph">
                <strong>सांस्कृतिक संवर्धन:</strong> धर्म, मंदिर इतिहास, वेद, दर्शन और पर्यटन स्थलों की जानकारी विशुद्ध रूप से भारतीय संस्कृति के संरक्षण और पाठकों के ज्ञानवर्धन के उद्देश्य से दी जाती है।
              </p>
              <p className="legal-doc-paragraph">
                <strong>अंधविश्वास-मुक्त ज्योतिष:</strong> ज्योतिषीय गणनाएं और राशिफल संबंधित क्षेत्र के आचार्यों और विद्वानों के विचारों पर आधारित होते हैं। पब्लिक स्पार्क किसी भी रूप में अंधविश्वास, तंत्र-मंत्र, भय अथवा चमत्कारी लाभ के दावों का कभी प्रचार नहीं करता।
              </p>

              <h2 className="legal-doc-section-heading">
                4. पारदर्शी त्रुटि सुधार नीति (Corrections & Retractions Policy)
              </h2>
              <p className="legal-doc-paragraph">
                यदि किसी समाचार में अनजाने में कोई तथ्यात्मक त्रुटि हो जाती है, तो पब्लिक स्पार्क बिना किसी संकोच के उसे सुधारता है। सुधार किए जाने पर लेख के अंत में स्पष्ट रूप से <strong>'संशोधन नोट (Correction Note)'</strong> प्रकाशित किया जाता है, जिसमें संशोधन का समय और विवरण दर्ज होता है।
              </p>

              <h2 className="legal-doc-section-heading">
                5. तथ्य-जांच डेस्क से संपर्क (Report a Correction)
              </h2>
              <p className="legal-doc-paragraph">
                यदि आपको किसी लेख में कोई तथ्यात्मक त्रुटि दिखाई दे, तो कृपया साक्ष्य सहित हमारे तथ्य-जांच दल को ईमेल करें:
              </p>
              <div style={{ background: 'var(--bg-secondary)', padding: '1rem 1.25rem', borderRadius: '4px', border: '1px solid var(--border-light)', marginTop: '0.75rem' }}>
                <p style={{ margin: '0 0 0.35rem 0' }}><strong>तथ्य-जांच व संपादकीय आचार संहिता डेस्क:</strong> पब्लिक स्पार्क</p>
                <p style={{ margin: 0 }}><strong>आधिकारिक ईमेल:</strong> <code>publicspark.in@gmail.com</code></p>
              </div>
            </div>
          )}

          {/* 7. GRIEVANCE REDRESSAL (IT RULES 2021 LEVEL-I) */}
          {activeTab === 'contact' && (
            <div>
              <div className="legal-doc-header">
                <h1 className="legal-doc-main-title">
                  वैधानिक शिकायत निवारण अधिकारी (IT Rules 2021 Level-I)
                </h1>
                <p className="legal-doc-meta">
                  सूचना प्रौद्योगिकी (मध्यवर्ती संदर्शिकाएं और डिजिटल मीडिया आचार संहिता) नियम, 2021 के नियम 11 का अनुपालन
                </p>
              </div>

              <div className="legal-doc-callout">
                <strong>कानूनी शिकायत निवारण तंत्र:</strong> भारत सरकार के सूचना प्रौद्योगिकी नियम, 2021 के अंतर्गत पब्लिक स्पार्क द्वारा एक समर्पित, त्रि-स्तरीय शिकायत निवारण प्रणाली (Level-I Grievance Mechanism) स्थापित की गई है। किसी भी समाचार सामग्री, कॉपीराइट, अथवा मानहानि संबंधी आपत्ति पर समयबद्ध विधिक निस्तारण दिया जाता है।
              </div>

              <h2 className="legal-doc-section-heading">
                1. नामित शिकायत निवारण अधिकारी का विवरण (Designated Grievance Officer)
              </h2>
              <p className="legal-doc-paragraph">
                डिजिटल मीडिया आचार संहिता के तहत हमारे अधिकृत अधिकारी का आधिकारिक विवरण निम्नवत है:
              </p>

              <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '4px', border: '1px solid var(--accent-crimson)', marginTop: '0.75rem', marginBottom: '1.5rem' }}>
                <p style={{ margin: '0 0 0.4rem 0', fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)' }}>श्री राजेश शर्मा (Rajesh Sharma)</p>
                <p style={{ margin: '0 0 0.35rem 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}><strong>पदनाम:</strong> प्रमुख - विधिक मानक एवं शिकायत निवारण (Head of Legal Standards & Grievance)</p>
                <p style={{ margin: '0 0 0.35rem 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}><strong>संस्थान:</strong> पब्लिक स्पार्क डिजिटल मीडिया ब्यूरो (Public Spark Media Bureau)</p>
                <p style={{ margin: '0 0 0.35rem 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}><strong>कार्यालय पता:</strong> इंस्टीट्यूशनल एरिया, नई दिल्ली - 110001, भारत</p>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}><strong>आधिकारिक विधिक ईमेल:</strong> <code>publicspark.in@gmail.com</code></p>
              </div>

              <h2 className="legal-doc-section-heading">
                2. शिकायत निवारण की समय-सीमा एवं प्रक्रिया (Timelines & Procedure)
              </h2>
              <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-muted)', lineHeight: '1.8', marginBottom: '1.25rem' }}>
                <li><strong>पावती (Acknowledgment):</strong> शिकायत प्राप्त होने के <strong>24 घंटे के भीतर</strong> शिकायतकर्ता को ईमेल द्वारा पावती और विशिष्ट संदर्भ संख्या जारी की जाएगी।</li>
                <li><strong>विधिक निस्तारण (Disposal):</strong> शिकायत की जांच कर साक्ष्यों के आधार पर अधिकतम <strong>15 दिनों के भीतर</strong> उचित निर्णय लेकर शिकायतकर्ता को सूचित किया जाएगा।</li>
              </ul>

              <h2 className="legal-doc-section-heading">
                3. त्वरित डिजिटल शिकायत दर्ज करें (File Digital Grievance)
              </h2>
              <p className="legal-doc-paragraph">
                आप किसी भी समाचार के संबंध में नीचे दिए गए बटन पर क्लिक करके सीधे हमारे डिजिटल शिकायत निवारण फॉर्म को भरकर अपनी शिकायत दर्ज कर सकते हैं:
              </p>

              {onOpenGrievance && (
                <div style={{ marginTop: '1.25rem', marginBottom: '1.5rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenGrievance();
                    }}
                    style={{
                      background: 'var(--accent-crimson, #DC2626)',
                      color: '#ffffff',
                      border: 'none',
                      padding: '0.75rem 1.5rem',
                      borderRadius: '4px',
                      fontWeight: '800',
                      fontSize: '0.925rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      minHeight: '44px',
                      boxShadow: '0 2px 8px rgba(220, 38, 38, 0.25)',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}
                  >
                    <Scale size={18} />
                    <span>औपचारिक विधिक शिकायत फॉर्म खोलें (File Grievance Form)</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 8. EXTERNAL LINKING SAFE HARBOR DISCLAIMER */}
          {activeTab === 'disclaimer' && (
            <div>
              <div className="legal-doc-header">
                <h1 className="legal-doc-main-title">
                  बाहरी लिंक्स व सुरक्षित आश्रय अस्वीकरण (Safe Harbor Disclaimer)
                </h1>
                <p className="legal-doc-meta">
                  प्रभावी तिथि: 2026 | सूचना प्रौद्योगिकी अधिनियम, 2000 की धारा 79 (Safe Harbor Provisions)
                </p>
              </div>

              <div className="legal-doc-callout">
                <strong>पारदर्शिता एवं संदर्भ की सुविधा:</strong> पब्लिक स्पार्क अपने लेखों में पाठकों की सुविधा, तथ्यात्मक साक्ष्य और संदर्भ के लिए सरकारी पोर्टलों (PIB, भारत का राजपत्र, सुप्रीम कोर्ट/हाईकोर्ट आदेश) एवं आधिकारिक स्रोतों के वेब-लिंक्स (Hyperlinks) प्रदान करता है। यह अस्वीकरण इन बाहरी लिंक्स की विधिक स्थिति स्पष्ट करता है।
              </div>

              <h2 className="legal-doc-section-heading">
                1. तीसरे पक्ष की वेबसाइटों पर नियंत्रण नहीं (No Control on External Websites)
              </h2>
              <p className="legal-doc-paragraph">
                पब्लिक स्पार्क पोर्टल पर दिए गए बाहरी लिंक्स पर क्लिक करने के पश्चात पाठक तीसरे पक्ष की वेबसाइट पर पहुंच जाते हैं। उन वेबसाइटों की सामग्री, सुरक्षा, कुकीज़ और नीतियों पर पब्लिक स्पार्क का कोई नियंत्रण अथवा स्वामित्व नहीं है। किसी भी बाहरी वेबसाइट पर कोई भी व्यक्तिगत जानकारी साझा करने से पूर्व पाठक उनकी गोपनीयता नीति की स्वयं जांच कर लें।
              </p>

              <h2 className="legal-doc-section-heading">
                2. सुरक्षित आश्रय संरक्षण (Safe Harbor Protection under Section 79 of IT Act)
              </h2>
              <p className="legal-doc-paragraph">
                भारतीय सूचना प्रौद्योगिकी अधिनियम, 2000 की धारा 79 के अंतर्गत, समाचार में किसी संदर्भ स्रोत का लिंक प्रदान करना उस तीसरे पक्ष की सामग्री अथवा उनके द्वारा प्रदान की जाने वाली किसी सेवा/उत्पाद का वाणिज्यिक समर्थन (Endorsement) नहीं है। किसी बाहरी वेबसाइट द्वारा उत्पन्न किसी भी हानि या विवाद के लिए पब्लिक स्पार्क विधिक रूप से उत्तरदायी नहीं होगा।
              </p>

              <h2 className="legal-doc-section-heading">
                3. टूटे हुए लिंक्स की रिपोर्ट करें (Report Broken Links)
              </h2>
              <p className="legal-doc-paragraph">
                यदि आपको हमारी वेबसाइट पर कोई बाहरी लिंक अनुपलब्ध (404 Error), टूटा हुआ, अथवा अनुपयुक्त प्रतीत होता है, तो कृपया हमारे तकनीकी डेस्क को सूचित करें ताकि उसे तुरंत ठीक किया जा सके:
              </p>
              <div style={{ background: 'var(--bg-secondary)', padding: '1rem 1.25rem', borderRadius: '4px', border: '1px solid var(--border-light)', marginTop: '0.75rem' }}>
                <p style={{ margin: '0 0 0.35rem 0' }}><strong>वेब लिंक व तकनीकी सुरक्षा डेस्क:</strong> पब्लिक स्पार्क</p>
                <p style={{ margin: 0 }}><strong>आधिकारिक ईमेल:</strong> <code>publicspark.in@gmail.com</code></p>
              </div>
            </div>
          )}

          {/* Quick Policy Switcher Bar at Document Bottom */}
          <div className="legal-doc-switcher" aria-label="Switch between compliance documents">
            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-subtle)', width: '100%', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              अन्य विधिक नीतियां पढ़ें:
            </span>
            {allTabs.map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabChange(tab.key)}
                className={`legal-doc-switch-btn ${activeTab === tab.key ? 'active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Sleek Document Footer */}
          <div className="legal-doc-footer-bar">
            <button
              type="button"
              onClick={onClose}
              className="legal-portal-close-btn"
            >
              <ArrowLeft size={16} />
              <span>मुख्य समाचार पर लौटें</span>
            </button>

            <div style={{ fontSize: '0.825rem', color: 'var(--text-subtle)' }}>
              © 2026 PublicSpark Newsroom Platform • सर्वाधिकार सुरक्षित
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
