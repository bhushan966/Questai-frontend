-- ==============================================================================
-- QuestAI: Supabase Database Schema & Storage Configuration
-- Copy and paste this entire script into your Supabase Dashboard -> SQL Editor -> Run
-- ==============================================================================

-- 1. Create tables
CREATE TABLE IF NOT EXISTS public.job_roles (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    skills_required TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.questions (
    id TEXT PRIMARY KEY,
    job_role_id TEXT NOT NULL,
    question_text TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    generated_by TEXT DEFAULT 'ai',
    think_seconds INTEGER DEFAULT 30,
    answer_seconds INTEGER DEFAULT 90,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sessions (
    id TEXT PRIMARY KEY,
    job_role_id TEXT NOT NULL,
    candidate_id TEXT,
    candidate_name TEXT,
    question_source TEXT DEFAULT 'ai',
    mode TEXT DEFAULT 'recorded',
    status TEXT DEFAULT 'not_started',
    verdict TEXT,
    rating JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.answers (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    question_id TEXT,
    question_text TEXT,
    think_seconds INTEGER DEFAULT 30,
    answer_seconds INTEGER DEFAULT 90,
    status TEXT DEFAULT 'pending',
    video_url TEXT,
    transcript TEXT,
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Configure Row Level Security (RLS)
ALTER TABLE public.job_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for job_roles" ON public.job_roles;
CREATE POLICY "Allow all for job_roles" ON public.job_roles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for questions" ON public.questions;
CREATE POLICY "Allow all for questions" ON public.questions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for sessions" ON public.sessions;
CREATE POLICY "Allow all for sessions" ON public.sessions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for answers" ON public.answers;
CREATE POLICY "Allow all for answers" ON public.answers FOR ALL USING (true) WITH CHECK (true);

-- 3. Configure Supabase Storage bucket for videos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'interview-videos',
    'interview-videos',
    true,
    104857600, -- 100MB limit
    ARRAY['video/webm', 'video/mp4', 'video/quicktime', 'application/octet-stream']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage RLS policies (allow candidate video uploads & recruiter viewing)
DROP POLICY IF EXISTS "Allow public read interview videos" ON storage.objects;
CREATE POLICY "Allow public read interview videos" ON storage.objects
FOR SELECT USING (bucket_id = 'interview-videos');

DROP POLICY IF EXISTS "Allow public insert interview videos" ON storage.objects;
CREATE POLICY "Allow public insert interview videos" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'interview-videos');

DROP POLICY IF EXISTS "Allow public update interview videos" ON storage.objects;
CREATE POLICY "Allow public update interview videos" ON storage.objects
FOR UPDATE USING (bucket_id = 'interview-videos');
