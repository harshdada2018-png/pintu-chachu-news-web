CREATE TABLE IF NOT EXISTS audio_cache (
  cache_key TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  lang TEXT NOT NULL,
  clip_type TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'audio/webm',
  audio_base64 TEXT NOT NULL,
  size_bytes INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  last_accessed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audio_cache_created ON audio_cache(created_at);

