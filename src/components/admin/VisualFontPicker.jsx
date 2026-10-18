import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check, Sparkles } from 'lucide-react';

export const COMPREHENSIVE_FONTS_CATALOG = [
  // 1. Royal & Newspaper Headlines
  {
    name: 'Rozha One',
    category: 'Hindi & Regional',
    badge: 'Royal Hindi',
    previewSample: 'दैनिक मुख्य समाचार — Royal Frontpage',
    isSerif: true
  },
  {
    name: 'Playfair Display',
    category: 'Royal & Newspaper',
    badge: 'Royal English',
    previewSample: 'The Global Editorial Gazette & Dispatch',
    isSerif: true
  },
  {
    name: 'Cinzel',
    category: 'Royal & Newspaper',
    badge: 'Roman Imperial',
    previewSample: 'PARLIAMENTARY ACCORD & SUMMIT',
    isSerif: true
  },
  {
    name: 'DM Serif Display',
    category: 'Royal & Newspaper',
    badge: 'High-End Serif',
    previewSample: 'Investigative Spotlight & Deep Dives',
    isSerif: true
  },
  {
    name: 'Prata',
    category: 'Royal & Newspaper',
    badge: 'Luxury Editorial',
    previewSample: 'International Diplomatic Chronicle',
    isSerif: true
  },

  // 2. Hindi & Regional Devanagari Scripts
  {
    name: 'Mukta',
    category: 'Hindi & Regional',
    badge: 'Clean Newspaper',
    previewSample: 'ताज़ा तरीन खबरें — Live Wire Bulletins',
    isSerif: false
  },
  {
    name: 'Noto Serif Devanagari',
    category: 'Hindi & Regional',
    badge: 'Broadside Serif',
    previewSample: 'संपादकीय दृष्टिकोण — Editorial Perspective',
    isSerif: true
  },
  {
    name: 'Noto Sans Devanagari',
    category: 'Hindi & Regional',
    badge: 'Official Script',
    previewSample: 'सत्यापित समाचार — Verified Bureau Coverage',
    isSerif: false
  },
  {
    name: 'Hind',
    category: 'Hindi & Regional',
    badge: 'Modern Hindi',
    previewSample: 'दैनिक जनमत — National Headlines',
    isSerif: false
  },
  {
    name: 'Yatra One',
    category: 'Hindi & Regional',
    badge: 'Classic Vintage',
    previewSample: 'भारत दर्शन — Heritage & Culture Wire',
    isSerif: true
  },
  {
    name: 'Kalam',
    category: 'Hindi & Regional',
    badge: 'Calligraphic Serif',
    previewSample: 'जन विचार मंच — Public Voice Columns',
    isSerif: false
  },
  {
    name: 'Noto Serif Bengali',
    category: 'Hindi & Regional',
    badge: 'বাংলা Serif',
    previewSample: 'ইসরোর ঐতিহাসিক অভিযান — বাংলা সংবাদ',
    isSerif: true
  },
  {
    name: 'Noto Sans Bengali',
    category: 'Hindi & Regional',
    badge: 'বাংলা Sans',
    previewSample: 'দৈনিক বাংলা খবর ও যাচাইকৃত প্রতিবেদন',
    isSerif: false
  },
  {
    name: 'Noto Serif Tamil',
    category: 'Hindi & Regional',
    badge: 'தமிழ் Serif',
    previewSample: 'இஸ்ரோ வரலாற்று சாதனை — தமிழ் செய்தி',
    isSerif: true
  },
  {
    name: 'Noto Sans Tamil',
    category: 'Hindi & Regional',
    badge: 'தமிழ் Sans',
    previewSample: 'தினசரி செய்தி மற்றும் நேரலை தகவல்கள்',
    isSerif: false
  },
  {
    name: 'Noto Serif Telugu',
    category: 'Hindi & Regional',
    badge: 'తెలుగు Serif',
    previewSample: 'ఇస్రో చారిత్రక ఘనత — తెలుగు వార్తలు',
    isSerif: true
  },
  {
    name: 'Noto Sans Telugu',
    category: 'Hindi & Regional',
    badge: 'తెలుగు Sans',
    previewSample: 'నిజమైన సమగ్ర వార్తా ప్రసారం',
    isSerif: false
  },
  {
    name: 'Noto Serif Gujarati',
    category: 'Hindi & Regional',
    badge: 'ગુજરાતી Serif',
    previewSample: 'ઇસરોની ઐતિહાસિક સિદ્ધિ — ગુજરાતી સમાચાર',
    isSerif: true
  },
  {
    name: 'Noto Sans Gujarati',
    category: 'Hindi & Regional',
    badge: 'ગુજરાતી Sans',
    previewSample: 'વિશ્વાસપાત્ર દૈનિક સમાચાર બુલેટિન',
    isSerif: false
  },
  {
    name: 'Noto Serif Kannada',
    category: 'Hindi & Regional',
    badge: 'ಕನ್ನಡ Serif',
    previewSample: 'ಇಸ್ರೋ ಐತಿಹಾಸಿಕ ಸಾಧನೆ — ಕನ್ನಡ ವರದಿ',
    isSerif: true
  },
  {
    name: 'Noto Sans Kannada',
    category: 'Hindi & Regional',
    badge: 'ಕನ್ನಡ Sans',
    previewSample: 'ದೈನಂದಿನ ನೈಜ ಸುದ್ದಿ ಮತ್ತು ವಿಶ್ಲೇಷಣೆ',
    isSerif: false
  },
  {
    name: 'Noto Serif Malayalam',
    category: 'Hindi & Regional',
    badge: 'മലയാളം Serif',
    previewSample: 'ഐഎസ്ആർഒ ചരിത്ര നേട്ടം — മലയാളം വാർത്തകൾ',
    isSerif: true
  },
  {
    name: 'Noto Sans Malayalam',
    category: 'Hindi & Regional',
    badge: 'മലയാളം Sans',
    previewSample: 'വിശ്വാസ്യതയുള്ള സമഗ്ര മാധ്യമ റിപ്പോർട്ടിംഗ്',
    isSerif: false
  },
  {
    name: 'Noto Serif Gurmukhi',
    category: 'Hindi & Regional',
    badge: 'ਪੰਜਾਬੀ Serif',
    previewSample: 'ਇਸਰੋ ਦਾ ਇਤਿਹਾਸਕ ਕਾਰਨਾਮਾ — ਪੰਜਾਬੀ ਖ਼ਬਰਾਂ',
    isSerif: true
  },
  {
    name: 'Noto Sans Gurmukhi',
    category: 'Hindi & Regional',
    badge: 'ਪੰਜਾਬੀ Sans',
    previewSample: 'ਸੱਚੀਆਂ ਅਤੇ ਪ੍ਰਮਾਣਿਤ ਪੰਜਾਬੀ ਖ਼ਬਰਾਂ',
    isSerif: false
  },
  {
    name: 'Noto Sans Oriya',
    category: 'Hindi & Regional',
    badge: 'ଓଡ଼ିଆ Script',
    previewSample: 'ଇସ୍ରୋର ଐତିହାସିକ ସଫଳତା — ଓଡ଼ିଆ ଖବର',
    isSerif: false
  },
  {
    name: 'Noto Nastaliq Urdu',
    category: 'Hindi & Regional',
    badge: 'اردو Nastaliq',
    previewSample: 'اسرو کا شاندار خلائی مشن — اردو خبریں',
    isSerif: true
  },
  {
    name: 'Noto Sans Arabic',
    category: 'Hindi & Regional',
    badge: 'عربي / اردو',
    previewSample: 'تازہ ترین معتبر اور مصدقہ خبریں',
    isSerif: false
  },
  {
    name: 'Noto Sans JP',
    category: 'Hindi & Regional',
    badge: '日本語 JP',
    previewSample: '宇宙開発の歴史的快挙 — 日本語ニュース',
    isSerif: false
  },
  {
    name: 'Noto Sans TC',
    category: 'Hindi & Regional',
    badge: '繁體中文 TC',
    previewSample: '航太科技重大突破 — 即時新聞速報',
    isSerif: false
  },

  // 3. Modern Clean Sans-Serif
  {
    name: 'Poppins',
    category: 'Modern Sans',
    badge: 'Geometric Sans',
    previewSample: 'डिजिटल मीडिया — Today\'s Prime Coverage',
    isSerif: false
  },
  {
    name: 'Inter',
    category: 'Modern Sans',
    badge: 'Global Standard',
    previewSample: 'High-Performance Verified Digital Newsroom',
    isSerif: false
  },
  {
    name: 'Plus Jakarta Sans',
    category: 'Modern Sans',
    badge: 'Editorial Modern',
    previewSample: 'Next-Gen Independent Digital Media Platform',
    isSerif: false
  },
  {
    name: 'Montserrat',
    category: 'Modern Sans',
    badge: 'Urban Bold',
    previewSample: 'FINANCIAL MARKETS & MONETARY POLICY',
    isSerif: false
  },
  {
    name: 'Outfit',
    category: 'Modern Sans',
    badge: 'Display Minimal',
    previewSample: 'Tech Pulse, Sovereign Compute & Innovation',
    isSerif: false
  },
  {
    name: 'Roboto',
    category: 'Modern Sans',
    badge: 'Clear Standard',
    previewSample: 'Daily Dispatches & International Bureau Wire',
    isSerif: false
  },
  {
    name: 'Raleway',
    category: 'Modern Sans',
    badge: 'Stylized Sans',
    previewSample: 'Arts, Cinema & Cultural Review Chronicle',
    isSerif: false
  },

  // 4. Classic Editorial & Long-Read Serifs
  {
    name: 'Merriweather',
    category: 'Editorial Serif',
    badge: 'Long-Read Serif',
    previewSample: 'Deep-Dive Analytical Investigative Journalism',
    isSerif: true
  },
  {
    name: 'Lora',
    category: 'Editorial Serif',
    badge: 'Magazine Classic',
    previewSample: 'Contemporary Literary & Thought Perspectives',
    isSerif: true
  },
  {
    name: 'PT Serif',
    category: 'Editorial Serif',
    badge: 'Broadside Press',
    previewSample: 'Front-Page Editorial Bulletins & Special Wire',
    isSerif: true
  },
  {
    name: 'Crimson Pro',
    category: 'Editorial Serif',
    badge: 'Historical Book',
    previewSample: 'Historical Archives & Long-Form Feature Essay',
    isSerif: true
  },

  // 5. Display & High-Impact Headlines
  {
    name: 'Bebas Neue',
    category: 'Display & Bold',
    badge: 'Ultra Impact',
    previewSample: 'URGENT BREAKING NEWS BULLETIN 24/7',
    isSerif: false
  },
  {
    name: 'Oswald',
    category: 'Display & Bold',
    badge: 'Headline Display',
    previewSample: 'SPECIAL INVESTIGATION GROUND REPORT',
    isSerif: false
  },
  {
    name: 'Anton',
    category: 'Display & Bold',
    badge: 'Heavy Poster',
    previewSample: 'EXCLUSIVE PRIME STORY BROADCAST',
    isSerif: false
  }
];

export const DEFAULT_REGIONAL_FONTS = {
  hi: { headingFont: 'Rozha One', bodyFont: 'Mukta' },
  en: { headingFont: 'Playfair Display', bodyFont: 'Plus Jakarta Sans' },
  bn: { headingFont: 'Noto Serif Bengali', bodyFont: 'Noto Sans Bengali' },
  mr: { headingFont: 'Noto Serif Devanagari', bodyFont: 'Mukta' },
  te: { headingFont: 'Noto Serif Telugu', bodyFont: 'Noto Sans Telugu' },
  ta: { headingFont: 'Noto Serif Tamil', bodyFont: 'Noto Sans Tamil' },
  gu: { headingFont: 'Noto Serif Gujarati', bodyFont: 'Noto Sans Gujarati' },
  kn: { headingFont: 'Noto Serif Kannada', bodyFont: 'Noto Sans Kannada' },
  ml: { headingFont: 'Noto Serif Malayalam', bodyFont: 'Noto Sans Malayalam' },
  pa: { headingFont: 'Noto Serif Gurmukhi', bodyFont: 'Noto Sans Gurmukhi' },
  or: { headingFont: 'Noto Sans Oriya', bodyFont: 'Noto Sans Oriya' },
  as: { headingFont: 'Noto Serif Bengali', bodyFont: 'Noto Sans Bengali' },
  ur: { headingFont: 'Noto Nastaliq Urdu', bodyFont: 'Noto Sans Arabic' },
  ja: { headingFont: 'Noto Sans JP', bodyFont: 'Noto Sans JP' },
  'zh-TW': { headingFont: 'Noto Sans TC', bodyFont: 'Noto Sans TC' },
  fr: { headingFont: 'Playfair Display', bodyFont: 'Plus Jakarta Sans' },
  it: { headingFont: 'Playfair Display', bodyFont: 'Plus Jakarta Sans' },
  id: { headingFont: 'Plus Jakarta Sans', bodyFont: 'Inter' },
  ru: { headingFont: 'Playfair Display', bodyFont: 'Roboto' }
};

export const LANGUAGE_PREVIEW_DATA = {
  hi: {
    code: 'hi',
    name: 'Hindi',
    native: 'हिंदी',
    region: 'भारत / National',
    flag: '🇮🇳',
    headline: 'अंतरिक्ष एवं विज्ञान में भारत की ऐतिहासिक छलांग — नए कृषि उपग्रह ग्रिड का सफल प्रक्षेपण',
    excerpt: 'भारतीय अंतरिक्ष अनुसंधान संगठन (इसरो) ने अत्याधुनिक मौसम एवं फसल निगरानी उपग्रहों का नेटवर्क सफलतापूर्वक स्थापित किया है। इससे देश भर के लाखों किसानों को वास्तविक समय में सटीक मौसमी जानकारियां और सूखा चेतावनी मिल सकेंगी।',
    isRtl: false
  },
  en: {
    code: 'en',
    name: 'English',
    native: 'English',
    region: 'Global / International',
    flag: '🌐',
    headline: 'ISRO Milestone: Indigenous Satellite Grid Deployed into Polar Orbit for Agricultural Monitoring',
    excerpt: 'The Indian Space Research Organisation has successfully placed its next-generation climate and crop observation array into sun-synchronous orbit, delivering high-resolution soil moisture telemetry directly to rural agricultural collectives.',
    isRtl: false
  },
  bn: {
    code: 'bn',
    name: 'Bengali',
    native: 'বাংলা',
    region: 'পশ্চিমবঙ্গ ও ত্রিপুরা',
    flag: '🇧🇩',
    headline: 'মহাকাশ গবেষণায় ঐতিহাসিক মাইলফলক — নয়া কৃষি উপগ্রহ নেটওয়ার্কের সফল উৎক্ষেপণ',
    excerpt: 'ভারতীয় মহাকাশ গবেষণা সংস্থা সফলভাবে নতুন প্রজন্মের কৃষি ও পরিবেশ পর্যবেক্ষণ উপগ্রহ কক্ষপথে স্থাপন করেছে। এর মাধ্যমে দেশের লক্ষাধিক কৃষক সরাসরি আবহাওয়া ও ফসলের তথ্য পাবেন।',
    isRtl: false
  },
  mr: {
    code: 'mr',
    name: 'Marathi',
    native: 'मराठी',
    region: 'महाराष्ट्र',
    flag: '🇮🇳',
    headline: 'अंतराळ क्षेत्रात ऐतिहासिक झेप — नवीन कृषी उपग्रह जाळ्याचे यशस्वी प्रक्षेपण',
    excerpt: 'भारतीय अंतराळ संशोधन संस्थेने हवामान आणि पीक संरक्षणासाठी आधुनिक उपग्रह प्रणाली यशस्वीरीत्या कक्षेत स्थापित केली आहे। यामुळे शेतकर्‍यांना अचूक पर्जन्य अंदाज आणि मातीची स्थिती समजू शकेल.',
    isRtl: false
  },
  te: {
    code: 'te',
    name: 'Telugu',
    native: 'తెలుగు',
    region: 'ఆంధ్రప్రదేశ్ & తెలంగాణ',
    flag: '🇮🇳',
    headline: 'అంతరిక్ష రంగంలో చారిత్రక ఘనత — కొత్త వ్యవసాయ ఉపగ్రహ నెట్‌వర్క్ విజయవంతం',
    excerpt: 'భారత అంతరిక్ష పరిశోధనా సంస్థ అత్యాధునిక వాతావరణ మరియు పంట పర్యవేక్షణ ఉపగ్రహాలను విజయవంతంగా ప్రయోగించింది. దీనితో రైతులకు నేరుగా సమగ్ర వాతావరణ సమాచారం అందుబాటులోకి వస్తుంది.',
    isRtl: false
  },
  ta: {
    code: 'ta',
    name: 'Tamil',
    native: 'தமிழ்',
    region: 'தமிழ்நாடு & புதுச்சேரி',
    flag: '🇮🇳',
    headline: 'விண்வெளித் துறையில் புதிய வரலாற்று சாதனை — அதிநவீன வேளாண் செயற்கைக்கோள் வெற்றி',
    excerpt: 'இந்திய விண்வெளி ஆராய்ச்சி நிறுவனம் புதிய தலைமுறை வானிலை மற்றும் பயிர் கண்காணிப்பு செயற்கைக்கோள்களை வெற்றிகரமாக விண்ணில் செலுத்தியுள்ளது. இது விவசாயிகளுக்கு நிகழ்நேர தகவல்களை வழங்கும்.',
    isRtl: false
  },
  gu: {
    code: 'gu',
    name: 'Gujarati',
    native: 'ગુજરાતી',
    region: 'ગુજરાત',
    flag: '🇮🇳',
    headline: 'અવકાશ સંશોધનમાં ભારતની ઐતિહાસિક સિદ્ધિ — નવા કૃષિ ઉપગ્રહનું સફળ પ્રક્ષેપણ',
    excerpt: 'ઇસરો દ્વારા હવામાન અને પાક નિરીક્ષણ માટે નવીનતમ ઉપગ્રહ પ્રણાલી સફળતાપૂર્વક કક્ષામાં સ્થાપિત કરવામાં આવી છે. આનાથી દેશના ખેડૂતોને સીધો સચોટ હવામાન અંદાજ મળશે.',
    isRtl: false
  },
  kn: {
    code: 'kn',
    name: 'Kannada',
    native: 'ಕನ್ನಡ',
    region: 'ಕರ್ನಾಟಕ',
    flag: '🇮🇳',
    headline: 'ಬಾಹ್ಯಾಕಾಶ ಕ್ಷೇತ್ರದಲ್ಲಿ ಐತಿಹಾಸಿಕ ಮೈಲಿಗಲ್ಲು — ನೂತನ ಕೃಷಿ ಉಪಗ್ರಹ ವ್ಯವಸ್ಥೆ ಯಶಸ್ವಿ',
    excerpt: 'ಭಾರತೀಯ ಬಾಹ್ಯಾಕಾಶ ಸಂಶೋಧನಾ ಸಂಸ್ಥೆಯು ಹವಾಮಾನ ಮತ್ತು ಕೃಷಿ ನಿಗಾ ಉಪಗ್ರಹಗಳನ್ನು ಯಶಸ್ವಿಯಾಗಿ ಕಕ್ಷೆಗೆ ಸೇರಿಸಿದೆ. ಇದರಿಂದ ದೇಶದ ರೈತರಿಗೆ ನೈಜ ಸಮಯದ ಮಣ್ಣಿನ ತೇವಾಂಶ ಮಾಹಿತಿ ಲಭ್ಯವಾಗಲಿದೆ.',
    isRtl: false
  },
  ml: {
    code: 'ml',
    name: 'Malayalam',
    native: 'മലയാളം',
    region: 'കേരളം',
    flag: '🇮🇳',
    headline: 'ബഹിരാകാശ രംഗത്ത് ചരിത്ര നേട്ടം — അത്യാധുനിക കാർഷിക ഉപഗ്രഹ വിക്ഷേപണം വിജയം',
    excerpt: 'ഐഎസ്ആർഒ കാലാവസ്ഥാ, കൃഷി നിരീക്ഷണ ഉപഗ്രഹങ്ങളുടെ പുതിയ ശൃംഖല വിജയകരമായി ഭ്രമണപഥത്തിലെത്തിച്ചു. കർഷകർക്ക് സമഗ്ര കാലാവസ്ഥാ വിവരങ്ങൾ ഇതിലൂടെ വേഗത്തിൽ ലഭ്യമാകും.',
    isRtl: false
  },
  pa: {
    code: 'pa',
    name: 'Punjabi',
    native: 'ਪੰਜਾਬੀ',
    region: 'ਪੰਜਾਬ',
    flag: '🇮🇳',
    headline: 'ਪੁਲਾੜ ਖੇਤਰ ਵਿੱਚ ਇਤਿਹਾਸਕ ਮੱਲ — ਨਵੇਂ ਖੇਤੀਬਾੜੀ ਉਪਗ੍ਰਹਿ ਨੈੱਟਵਰਕ ਦਾ ਸਫ਼ਲ ਪ੍ਰੀਖਣ',
    excerpt: 'ਭਾਰਤੀ ਪੁਲਾੜ ਖੋਜ ਸੰਸਥਾ ਨੇ ਮੌਸਮ ਅਤੇ ਫ਼ਸਲਾਂ ਦੀ ਨਿਗਰਾਨੀ ਲਈ ਨਵੀਂ ਤਕਨੀਕ ਵਾਲੇ ਉਪਗ੍ਰਹਿ ਸਫ਼ਲਤਾਪੂਰਵਕ ਛੱਡੇ ਹਨ। ਇਸ ਨਾਲ ਕਿਸਾਨਾਂ ਨੂੰ ਸਮੇਂ ਸਿਰ ਸਹੀ ਮੌਸਮੀ ਭਵਿੱਖਬਾਣੀ ਮਿਲੇਗੀ।',
    isRtl: false
  },
  or: {
    code: 'or',
    name: 'Odia',
    native: 'ଓଡ଼ିଆ',
    region: 'ଓଡ଼ିଶା',
    flag: '🇮🇳',
    headline: 'ମହାକାଶ ଗବେଷଣାରେ ଐତିହାସିକ ସଫଳତା — ନୂତନ କୃଷି ଉପଗ୍ରହର ସଫଳ ଉତକ୍ଷେପଣ',
    excerpt: 'ଭାରତୀୟ ମହାକାଶ ଗବେଷଣା ସଂସ୍ଥା ଦ୍ୱାରା ଅତ୍ୟାଧୁନିକ ପାଣିପାଗ ଏବଂ ଫସଲ ନିରୀକ୍ଷଣ ଉପଗ୍ରହ ସଫଳତାର ସହ କକ୍ଷପଥରେ ସ୍ଥାପିତ ହୋଇଛି। ଏହା କୃଷକମାନଙ୍କୁ ସମୟୋପଯୋଗୀ ସୂଚନା ଯୋଗାଇବ।',
    isRtl: false
  },
  as: {
    code: 'as',
    name: 'Assamese',
    native: 'অসমীয়া',
    region: 'অসম',
    flag: '🇮🇳',
    headline: 'মহাকাশ গৱেষণাত নতুন যুগ — অত্যাধুনিক কৃষি উপগ্ৰহৰ সফল উৎক্ষেপণ',
    excerpt: 'ইছৰোৰ উদ্যোগত জলবায়ু আৰু কৃষি নিৰীক্ষণ উপগ্ৰহ সফলভাৱে কক্ষপথত স্থাপন কৰা হৈছে। ইয়াৰ দ্বাৰা কৃষক সমাজে তৎক্ষণাৎ বতৰৰ তথ্য লাভ কৰিবলৈ সক্ষম হ\'ব।',
    isRtl: false
  },
  ur: {
    code: 'ur',
    name: 'Urdu',
    native: 'اردو',
    region: 'قومی و علاقائی',
    flag: '🇵🇰',
    headline: 'خلائی میدان میں تاریخی پیش رفت — جدید زرعی سیٹلائٹ نیٹ ورک کی کامیاب لانچنگ',
    excerpt: 'انڈین اسپیس ریسرچ آرگنائزیشن نے موسم اور زراعت کی براہ راست نگرانی کے لیے جدید ترین سیٹلائٹس کو مدار میں کامیابی سے بھیجا ہے، جس سے لاکھوں کسان مستفید ہوں گے۔',
    isRtl: true
  },
  ja: {
    code: 'ja',
    name: 'Japanese',
    native: '日本語',
    region: '日本 / Tokyo',
    flag: '🇯🇵',
    headline: '宇宙開発の新時代 — 先進的な次世代地球観測衛星網の軌道投入に成功',
    excerpt: '宇宙航空機関による最新鋭の気象および農業観測衛星コンステレーションが軌道投入に成功。高精度データがリアルタイムで農業現場に届けられます。',
    isRtl: false
  },
  'zh-TW': {
    code: 'zh-TW',
    name: 'Chinese',
    native: '繁體中文',
    region: 'Taiwan / HK',
    flag: '🇹🇼',
    headline: '太空科技重大里程碑 — 全新農業氣象觀測衛星星座成功發射升空',
    excerpt: '太空科研機構成功將新一代環境與作物監測衛星送入預定軌道，為全國農業與防災體系提供高精準度的全天候土壤數據。',
    isRtl: false
  },
  fr: {
    code: 'fr',
    name: 'French',
    native: 'Français',
    region: 'France / Europe',
    flag: '🇫🇷',
    headline: 'Nouvelle avancée spatiale : Déploiement réussi d\'une constellation satellitaire agricole',
    excerpt: 'L\'agence spatiale a placé en orbite polaire un réseau de satellites nouvelle génération, permettant une surveillance hydrique et climatique ultra-précise au service des agriculteurs.',
    isRtl: false
  },
  it: {
    code: 'it',
    name: 'Italian',
    native: 'Italiano',
    region: 'Italia / Europa',
    flag: '🇮🇹',
    headline: 'Storico successo spaziale: Lanciata la nuova rete di satelliti per il monitoraggio agricolo',
    excerpt: 'Completato con successo il dispiegamento dell\'innovativa costellazione orbitale per le previsioni agrometeorologiche ad altissima risoluzione.',
    isRtl: false
  },
  id: {
    code: 'id',
    name: 'Indonesian',
    native: 'Bahasa Indonesia',
    region: 'Indonesia / Asia',
    flag: '🇮🇩',
    headline: 'Terobosan Bersejarah Teknologi Antariksa: Satelit Pemantau Pertanian Berhasil Mengorbit',
    excerpt: 'Badan riset antariksa berhasil meluncurkan konstelasi satelit cuaca dan tanaman generasi terbaru untuk mendukung ketahanan pangan nasional secara real-time.',
    isRtl: false
  },
  ru: {
    code: 'ru',
    name: 'Russian',
    native: 'Русский',
    region: 'Россия / International',
    flag: '🇷🇺',
    headline: 'Исторический прорыв в космонавтике: Развернута спутниковая группировка мониторинга',
    excerpt: 'Космическое агентство успешно вывело на полярную орбиту спутниковую систему нового поколения для высокоточного аграрного и климатического прогнозирования в режиме реального времени.',
    isRtl: false
  }
};

export default function VisualFontPicker({
  label,
  subtitle,
  value,
  onChange
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [fontCatalog, setFontCatalog] = useState(COMPREHENSIVE_FONTS_CATALOG);
  const dropdownRef = useRef(null);

  // Fetch dynamic font catalog from Backend API
  useEffect(() => {
    fetch('/api/presets')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.fontCatalog) && data.fontCatalog.length > 0) {
          setFontCatalog(data.fontCatalog);
        }
      })
      .catch(err => console.warn('[Backend Font Catalog] Fallback:', err));
  }, []);

  const CATEGORIES = ['All', 'Royal & Newspaper', 'Hindi & Regional', 'Modern Sans', 'Editorial Serif', 'Display & Bold'];

  const selectedFontObj = fontCatalog.find(f => f.name === value) || fontCatalog[0] || COMPREHENSIVE_FONTS_CATALOG[0];

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredFonts = fontCatalog.filter(font => {
    const matchesCategory = activeCategory === 'All' || font.category === activeCategory;
    const matchesSearch = font.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          font.badge.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          font.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div style={{ position: 'relative', width: '100%', marginBottom: '1.25rem' }} ref={dropdownRef}>
      {/* Header Label Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <label style={{ fontSize: '0.925rem', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {label}
          </label>
          {subtitle && (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', margin: '0.15rem 0 0 0' }}>
              {subtitle}
            </p>
          )}
        </div>
        <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--accent-indigo)', background: 'rgba(99, 102, 241, 0.1)', padding: '0.2rem 0.6rem', borderRadius: '12px' }}>
          Active: {selectedFontObj.name}
        </span>
      </div>

      {/* Main Trigger Button (Renders Selected Font in its REAL font!) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.75rem 1rem',
          borderRadius: 'var(--radius-sm)',
          border: isOpen ? '2px solid var(--accent-indigo)' : '1px solid var(--border-medium)',
          background: 'var(--bg-main)',
          color: 'var(--text-main)',
          cursor: 'pointer',
          boxShadow: isOpen ? '0 0 0 3px rgba(99, 102, 241, 0.15)' : 'var(--shadow-sm)',
          transition: 'all 0.2s ease',
          textAlign: 'left'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, overflow: 'hidden' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', background: 'var(--bg-secondary)', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-light)', whiteSpace: 'nowrap' }}>
            {selectedFontObj.badge}
          </span>
          <span
            style={{
              fontFamily: `'${selectedFontObj.name}', ${selectedFontObj.isSerif ? 'serif' : 'sans-serif'}`,
              fontSize: '1.15rem',
              fontWeight: '700',
              color: 'var(--text-main)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {selectedFontObj.name} — {selectedFontObj.previewSample}
          </span>
        </div>
        <ChevronDown size={18} color="var(--text-subtle)" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', flexShrink: 0, marginLeft: '0.5rem' }} />
      </button>

      {/* POPUP DROPDOWN MENU */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 1000,
            background: 'var(--bg-surface)',
            backdropFilter: 'blur(16px)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            maxHeight: '440px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'fadeInDown 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          {/* Search Bar & Stats Header */}
          <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-secondary)' }}>
            <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
              <Search size={15} color="var(--text-subtle)" style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search font by name (e.g. Rozha, Merriweather, Poppins)..."
                autoFocus
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem 0.5rem 2.1rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-medium)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-main)',
                  fontSize: '0.85rem'
                }}
              />
            </div>

            {/* Category Filter Pills */}
            <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.2rem' }}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    padding: '0.25rem 0.6rem',
                    borderRadius: '12px',
                    fontSize: '0.725rem',
                    fontWeight: '700',
                    border: '1px solid',
                    borderColor: activeCategory === cat ? 'var(--accent-indigo)' : 'transparent',
                    background: activeCategory === cat ? 'var(--accent-indigo)' : 'var(--bg-main)',
                    color: activeCategory === cat ? '#fff' : 'var(--text-subtle)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable Fonts List with REAL FONT STYLES */}
          <div style={{ overflowY: 'auto', flex: 1, padding: '0.4rem 0' }}>
            {filteredFonts.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-subtle)', fontSize: '0.85rem' }}>
                No fonts matching "{searchQuery}"
              </div>
            ) : (
              filteredFonts.map((font) => {
                const isSelected = font.name === value;
                return (
                  <div
                    key={font.name}
                    onClick={() => {
                      onChange(font.name);
                      setIsOpen(false);
                    }}
                    style={{
                      padding: '0.65rem 1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                      borderLeft: isSelected ? '3px solid var(--accent-indigo)' : '3px solid transparent',
                      transition: 'background 0.15s ease',
                      gap: '0.75rem'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'var(--bg-secondary)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {/* Font Title */}
                        <span style={{ fontSize: '0.825rem', fontWeight: '800', color: isSelected ? 'var(--accent-indigo)' : 'var(--text-main)' }}>
                          {font.name}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', background: 'var(--bg-secondary)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                          {font.badge}
                        </span>
                      </div>

                      {/* REAL ACTUAL FONT TYPEFACE PREVIEW ROW */}
                      <div
                        style={{
                          fontFamily: `'${font.name}', ${font.isSerif ? 'Georgia, serif' : 'sans-serif'}`,
                          fontSize: '1.15rem',
                          color: isSelected ? 'var(--accent-indigo)' : 'var(--text-main)',
                          lineHeight: '1.3',
                          marginTop: '0.1rem',
                          wordBreak: 'break-word'
                        }}
                      >
                        {font.previewSample}
                      </div>
                    </div>

                    {isSelected && (
                      <div style={{ color: 'var(--accent-indigo)', flexShrink: 0, marginLeft: '0.5rem' }}>
                        <Check size={18} />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Info */}
          <div style={{ padding: '0.45rem 1rem', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-light)', fontSize: '0.72rem', color: 'var(--text-subtle)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Showing {filteredFonts.length} of {fontCatalog.length} fonts</span>
            <span>✓ Rendered in real font face</span>
          </div>
        </div>
      )}
    </div>
  );
}
