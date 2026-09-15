// PublicSpark Real-World News Mock Dataset
export const MOCK_CATEGORIES = [
  { id: 'cat-1', name: 'India', slug: 'india' },
  { id: 'cat-2', name: 'World', slug: 'world' },
  { id: 'cat-3', name: 'Technology', slug: 'technology' },
  { id: 'cat-4', name: 'Business', slug: 'business' },
  { id: 'cat-5', name: 'Science & Environment', slug: 'science' },
  { id: 'cat-6', name: 'Opinion', slug: 'opinion' },
  { id: 'cat-7', name: 'Sports', slug: 'sports' },
  { id: 'cat-8', name: 'Entertainment', slug: 'entertainment' },
];

export const MOCK_BREAKING_NEWS = [
  "🔥 BREAKING: ISRO successfully launches Next-Gen Earth Observation Satellite from Sriharikota.",
  "⚡ Sensex crosses historical 85,000 mark in morning trade driven by tech & banking rally.",
  "🌧️ Heavy rainfall alert issued for coastal Maharashtra and Goa over the next 48 hours.",
  "🚀 Quantum Computing Breakthrough: Researchers achieve room-temperature semiconductor stability."
];

export const MOCK_ARTICLES = [
  {
    id: 'art-1',
    title: 'ISRO Milestone: Indigenous Satellite System Deployed to Monitor Agricultural Yields & Climate Signals',
    slug: 'isro-milestone-indigenous-satellite-system-deployed',
    sub_title: 'The polar satellite launch vehicle successfully injected three payloads into sun-synchronous orbit, ushering a new era of real-time farm data analytics.',
    content: `Sriharikota — In a stellar demonstration of space technology, the Indian Space Research Organisation (ISRO) successfully launched its latest satellite constellation designed to provide high-resolution multispectral imagery for national agricultural monitoring.

The spacecraft, carrying state-of-the-art synthetic aperture radar, separated cleanly from the four-stage vehicle 18 minutes after liftoff. 

"This mission ensures our farming communities receive accurate soil moisture forecasts, drought early-warnings, and flood impact metrics directly on their mobile devices," stated ISRO Chairman during the post-launch press briefing.

### Key Mission Highlights
- **Sub-meter Resolution**: Enables plot-level crop health monitoring.
- **24/7 All-Weather Imaging**: Penetrates cloud cover during monsoon seasons.
- **Open Data Access**: Public datasets made available for agri-tech innovators.`,
    summary: 'ISRO launches advanced agricultural satellite constellation offering all-weather sub-meter resolution crop and disaster monitoring.',
    format: 'standard',
    featured_image: 'https://images.unsplash.com/photo-1517976487492-5750f3195933?auto=format&fit=crop&w=1200&q=80',
    image_caption: 'ISRO PSLV rocket lifting off from Sriharikota launch pad.',
    media_credits: 'ISRO / Space Media',
    author: {
      name: 'Dr. Priya Ramachandran',
      role: 'Senior Space & Tech Editor',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80'
    },
    category: 'Science & Environment',
    category_slug: 'science',
    status: 'published',
    is_breaking: true,
    views_count: 14200,
    reading_time_mins: 4,
    published_at: '10 mins ago',
    seo_title: 'ISRO Earth Observation Satellite Launch 2026',
    seo_description: 'ISRO successfully launches agricultural and climate monitoring satellite payload into orbit.',
  },
  {
    id: 'art-2',
    title: 'The AI Sovereign Infrastructure Push: Why Nations Are Building Local Compute Grid Clusters',
    slug: 'ai-sovereign-infrastructure-push-nations-compute-clusters',
    sub_title: 'With global bandwidth demands tripling, countries are prioritizing domestic AI data centers to secure critical infrastructure and data privacy.',
    content: `Across Asia and Europe, governments are accelerating investments into sovereign AI computing facilities to reduce dependency on foreign cloud monopolies.`,
    summary: 'Countries invest heavily in local AI server clusters to protect national data security and technological autonomy.',
    format: 'explainer',
    featured_image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=800&q=80',
    image_caption: 'High-density server room at national supercomputing center.',
    media_credits: 'Tech Archive',
    author: {
      name: 'Arjun Mehta',
      role: 'Technology Correspondent',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'
    },
    category: 'Technology',
    category_slug: 'technology',
    status: 'published',
    is_breaking: false,
    views_count: 8900,
    reading_time_mins: 5,
    published_at: '45 mins ago'
  },
  {
    id: 'art-3',
    title: 'Clean Energy Transition: Renewable Generation Surpasses Fossil Fuel Share in Regional Grid',
    slug: 'clean-energy-transition-renewable-surpasses-fossil-fuel',
    sub_title: 'Solar and wind capacity additions over the past two quarters pushed renewable energy share past 52% of total daily output.',
    content: `A watershed moment for clean energy as wind-solar hybrid projects achieve unprecedented capacity factors across major industrial corridors.`,
    summary: 'Renewable energy output breaks historic threshold, exceeding fossil fuels in daily electricity grid generation.',
    format: 'standard',
    featured_image: 'https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=800&q=80',
    image_caption: 'Wind farm turbines generating clean power at sunset.',
    media_credits: 'Green Power Media',
    author: {
      name: 'Sneha Verma',
      role: 'Environment & Climate Lead',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=200&q=80'
    },
    category: 'Science & Environment',
    category_slug: 'science',
    status: 'published',
    is_breaking: false,
    views_count: 6300,
    reading_time_mins: 3,
    published_at: '2 hours ago'
  },
  {
    id: 'art-4',
    title: 'Editorial: Protecting Public Interest Journalism in the Age of Automated Content Farms',
    slug: 'editorial-protecting-public-interest-journalism',
    sub_title: 'As synthetic media floods digital platforms, the human commitment to verified reporting, ground truth, and ethical oversight has never been more urgent.',
    content: `Journalism is not merely information aggregation; it is the rigorous pursuit of truth through verification, human accountability, and contextual understanding.`,
    summary: 'Why human editorial oversight and ground verification remain irreplaceable in high-quality journalism.',
    format: 'opinion',
    featured_image: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=800&q=80',
    image_caption: 'Vintage printing press layout at a newsroom print house.',
    media_credits: 'PublicSpark Editorial Desk',
    author: {
      name: 'Kabir Roy',
      role: 'Editor-in-Chief',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80'
    },
    category: 'Opinion',
    category_slug: 'opinion',
    status: 'published',
    is_breaking: false,
    views_count: 11200,
    reading_time_mins: 6,
    published_at: '3 hours ago'
  }
];

export const MOCK_LIVE_UPDATES = [
  {
    id: 'live-1',
    time: '18:30 IST',
    headline: 'Final Orbit Insertion Confirmed by Telemetry',
    body: 'ISRO ground stations in Bengaluru have established two-way telemetry links with all three satellite payloads. Systems operating at 100% efficiency.'
  },
  {
    id: 'live-2',
    time: '18:15 IST',
    headline: 'Payload Separation Successful',
    body: 'Spacecraft separated from rocket stage 4 at 520km polar altitude as planned.'
  },
  {
    id: 'live-3',
    time: '18:00 IST',
    headline: 'Rocket Liftoff Executed Smoothly',
    body: 'PSLV-C60 clears the launch tower under perfect weather conditions.'
  }
];
