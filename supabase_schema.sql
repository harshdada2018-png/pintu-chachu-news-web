-- =========================================================================
-- PublicSpark Newsroom — Supabase Production Database Schema
-- Run this in Supabase Dashboard -> SQL Editor -> Click 'Run'
-- =========================================================================

-- 1. TRANSLATIONS TABLE
-- Stores pre-computed and lazy-loaded translations per article and language
CREATE TABLE IF NOT EXISTS public.translations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id TEXT NOT NULL,
    lang VARCHAR(10) NOT NULL,
    title TEXT NOT NULL,
    highlights JSONB DEFAULT '[]'::jsonb,
    body TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'done' CHECK (status IN ('pending', 'done', 'failed')),
    content_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_article_lang UNIQUE (article_id, lang)
);

-- Index for instant lookup by (article_id, lang)
CREATE INDEX IF NOT EXISTS idx_translations_lookup 
ON public.translations (article_id, lang, status);


-- 2. AUDIO RECORDS TABLE
-- Stores 2-stage audio clip references (Clip 1: Intro/Highlights, Clip 2: Full Body)
CREATE TABLE IF NOT EXISTS public.audio_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id TEXT NOT NULL,
    lang VARCHAR(10) NOT NULL,
    clip_type VARCHAR(20) NOT NULL CHECK (clip_type IN ('clip_1_intro', 'clip_2_body')),
    audio_url TEXT NOT NULL,
    duration_seconds NUMERIC(6, 2) DEFAULT 0,
    size_bytes BIGINT DEFAULT 0,
    voice_name VARCHAR(50) DEFAULT 'gemini-tts-natural',
    last_played_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_audio_clip UNIQUE (article_id, lang, clip_type)
);

-- Index for fast audio lookup
CREATE INDEX IF NOT EXISTS idx_audio_records_lookup 
ON public.audio_records (article_id, lang, clip_type);


-- 3. DAILY USAGE LIMITS & TRACKING TABLE
-- Tracks daily API requests for Text Translation and Audio TTS against Google AI Studio quotas
CREATE TABLE IF NOT EXISTS public.daily_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
    provider VARCHAR(50) NOT NULL DEFAULT 'gemini',
    feature VARCHAR(50) NOT NULL CHECK (feature IN ('translation', 'tts_clip1', 'tts_clip2', 'ai_summary')),
    request_count INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_daily_usage UNIQUE (usage_date, provider, feature)
);

-- Index for daily usage tracking
CREATE INDEX IF NOT EXISTS idx_daily_usage_date 
ON public.daily_usage (usage_date, provider, feature);


-- 4. AUTO-UPDATE TIMESTAMP FUNCTION & TRIGGER
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_translations_updated_at ON public.translations;
CREATE TRIGGER trg_translations_updated_at
    BEFORE UPDATE ON public.translations
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_daily_usage_updated_at ON public.daily_usage;
CREATE TRIGGER trg_daily_usage_updated_at
    BEFORE UPDATE ON public.daily_usage
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();


-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- Enable RLS for all 3 tables
ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_usage ENABLE ROW LEVEL SECURITY;

-- Public read access
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Read Translations') THEN
        CREATE POLICY "Public Read Translations" ON public.translations FOR SELECT USING (status = 'done');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Read Audio Records') THEN
        CREATE POLICY "Public Read Audio Records" ON public.audio_records FOR SELECT USING (true);
    END IF;
END $$;

-- 6. ONE-TIME CLEANUP (PURGE LEGACY SCRAPER CORRUPTIONS)
DELETE FROM public.translations
WHERE title ILIKE '%QUERY LENGTH%' 
   OR body ILIKE '%QUERY LENGTH%' 
   OR body ILIKE '%MYMEMORY%'
   OR body ILIKE '%MAX ALLOWED QUERY%';
