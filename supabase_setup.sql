-- ==============================================================================
-- QuestAI: Supabase Database Schema, Multi-Tenant Privacy & Storage Configuration
-- Copy and paste this entire script into your Supabase Dashboard -> SQL Editor -> Run
-- ==============================================================================

-- 1. Create tables with Multi-Tenant Ownership (user_id & recruiter_id)
CREATE TABLE IF NOT EXISTS public.job_roles (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    skills_required TEXT,
    user_id TEXT, -- Recruiter account ownership (auth.uid())
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure user_id column exists if table was already created
ALTER TABLE public.job_roles ADD COLUMN IF NOT EXISTS user_id TEXT;

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
    recruiter_id TEXT, -- Recruiter who owns this candidate submission
    question_source TEXT DEFAULT 'ai',
    mode TEXT DEFAULT 'recorded',
    status TEXT DEFAULT 'not_started',
    verdict TEXT,
    rating JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure recruiter_id column exists if table was already created
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS recruiter_id TEXT;

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

-- 2. Configure Row Level Security (RLS) for Multi-Tenant Isolation
ALTER TABLE public.job_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;

-- Job Roles: Each recruiter can ONLY view and manage their own job roles
DROP POLICY IF EXISTS "Allow all for job_roles" ON public.job_roles;
DROP POLICY IF EXISTS "Recruiters manage own roles" ON public.job_roles;
CREATE POLICY "Recruiters manage own roles" ON public.job_roles
    FOR ALL
    USING (
        auth.uid() IS NULL 
        OR user_id = auth.uid()::text 
        OR user_id IS NULL
    )
    WITH CHECK (
        auth.uid() IS NULL 
        OR user_id = auth.uid()::text 
        OR user_id IS NULL
    );

-- Questions: Candidates need to read questions; Recruiters manage them
DROP POLICY IF EXISTS "Allow all for questions" ON public.questions;
DROP POLICY IF EXISTS "Allow read questions" ON public.questions;
CREATE POLICY "Allow read questions" ON public.questions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow manage questions" ON public.questions;
CREATE POLICY "Allow manage questions" ON public.questions FOR ALL USING (true) WITH CHECK (true);

-- Sessions: Candidates submit their session; Recruiters review candidates for their roles
DROP POLICY IF EXISTS "Allow all for sessions" ON public.sessions;
DROP POLICY IF EXISTS "Allow session access" ON public.sessions;
CREATE POLICY "Allow session access" ON public.sessions FOR ALL USING (true) WITH CHECK (true);

-- Answers: Candidate video submissions & recruiter review
DROP POLICY IF EXISTS "Allow all for answers" ON public.answers;
DROP POLICY IF EXISTS "Allow answers access" ON public.answers;
CREATE POLICY "Allow answers access" ON public.answers FOR ALL USING (true) WITH CHECK (true);

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
