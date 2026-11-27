CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  slug TEXT,
  title TEXT NOT NULL,
  sub_title TEXT DEFAULT '',
  summary TEXT DEFAULT '',
  content TEXT DEFAULT '',
  category TEXT DEFAULT 'General',
  status TEXT DEFAULT 'published',
  originalLanguage TEXT DEFAULT 'hi',
  image TEXT DEFAULT '',
  author TEXT DEFAULT 'PublicSpark Desk',
  authorEmail TEXT DEFAULT '',
  format TEXT DEFAULT 'standard',
  live_status TEXT DEFAULT 'active',
  scheduledPublishTime TEXT DEFAULT '',
  data_json TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS translations (
  cache_key TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  lang TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT DEFAULT '',
  highlights_json TEXT DEFAULT '[]',
  body TEXT DEFAULT '',
  status TEXT DEFAULT 'done',
  created_at TEXT NOT NULL,
  last_accessed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_translations_article_lang ON translations(article_id, lang);
CREATE TABLE IF NOT EXISTS kv_store (
  store_key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audio_cache (
  cache_key TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  lang TEXT NOT NULL,
  clip_type TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'audio/wav',
  audio_base64 TEXT NOT NULL,
  size_bytes INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  last_accessed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audio_cache_created ON audio_cache(created_at);
