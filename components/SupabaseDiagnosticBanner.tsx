'use client';

import { useState, useEffect } from 'react';
import { Database, CheckCircle2, RefreshCw, X, ExternalLink, HelpCircle, Copy, Check } from 'lucide-react';

interface SupabaseStatus {
  configured: boolean;
  supabaseUrl: string | null;
  hasAnonKey: boolean;
  hasServiceKey: boolean;
  bucketExists: boolean;
  bucketName: string;
  autoCreated?: boolean;
  canUpload: boolean;
  tables?: {
    job_roles: boolean;
    sessions: boolean;
    answers: boolean;
  };
  allTablesReady?: boolean;
  status: 'ready' | 'missing_keys' | 'tables_missing' | 'bucket_missing' | 'permission_issue';
  errorMessage: string | null;
  instructions: string[];
}

const SQL_SCHEMA = `-- Copy & paste into Supabase Dashboard -> SQL Editor -> Run
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

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('interview-videos', 'interview-videos', true, 104857600, ARRAY['video/webm', 'video/mp4', 'video/quicktime', 'application/octet-stream'])
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Allow public read interview videos" ON storage.objects;
CREATE POLICY "Allow public read interview videos" ON storage.objects FOR SELECT USING (bucket_id = 'interview-videos');

DROP POLICY IF EXISTS "Allow public insert interview videos" ON storage.objects;
CREATE POLICY "Allow public insert interview videos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'interview-videos');

DROP POLICY IF EXISTS "Allow public update interview videos" ON storage.objects;
CREATE POLICY "Allow public update interview videos" ON storage.objects FOR UPDATE USING (bucket_id = 'interview-videos');`;

export function SupabaseDiagnosticBanner() {
  const [status, setStatus] = useState<SupabaseStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSql, setShowSql] = useState(false);

  const checkStatus = async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/supabase/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch {
      // ignore
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const handleCopySql = () => {
    navigator.clipboard.writeText(SQL_SCHEMA);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  if (dismissed || !status) return null;

  // If using external backend (FastAPI on Render), database and storage are handled by FastAPI - hide diagnostic banner
  if (typeof window !== 'undefined' && (process.env.NEXT_PUBLIC_API_URL || '').startsWith('http')) {
    return null;
  }

  // Fully operational status: Render minimal pill
  if (status.status === 'ready') {
    return (
      <div className="bg-emerald-950/30 border border-emerald-800/60 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-emerald-300">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium">
            Supabase Active: Job roles, candidate sessions, and interview videos are persistently synced to your Supabase Cloud.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={checkStatus}
            disabled={checking}
            className="hover:text-emerald-100 transition-colors p-1 rounded"
            title="Re-run connection check"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    );
  }

  // Not ready or issue detected: Render clear helper card
  return (
    <div className="bg-slate-900 border border-amber-800/80 rounded-2xl p-5 shadow-xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-amber-950/60 border border-amber-800 text-amber-400 shrink-0 mt-0.5">
            <Database className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">
                {status.status === 'missing_keys'
                  ? 'Supabase Cloud Keys Not Found on Vercel'
                  : status.status === 'tables_missing'
                  ? 'Supabase Database Tables Not Created Yet'
                  : status.status === 'bucket_missing'
                  ? 'Supabase Storage Bucket "interview-videos" Missing'
                  : 'Supabase Storage Permissions Needed'}
              </h3>
              <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Action Required
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed w-full max-w-none">
              {status.status === 'tables_missing'
                ? 'Your Supabase project is connected, but the database tables (job_roles, sessions, answers) have not been created yet in Supabase. Run the quick SQL script below to activate permanent cloud storage.'
                : status.status === 'bucket_missing'
                ? 'Supabase is connected, but the storage bucket "interview-videos" was not found in your Supabase project. Candidate interview recordings will only be permanently stored once this bucket is created.'
                : status.status === 'missing_keys'
                ? 'Candidate recordings and roles are currently held in temporary memory. Add your Supabase credentials to Vercel to enable permanent storage.'
                : status.errorMessage || 'Candidate recordings are temporarily falling back to local memory.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={checkStatus}
            disabled={checking}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
            <span>{checking ? 'Checking...' : 'Retest'}</span>
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Dismiss notice"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Step by step fix instructions */}
      <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-3 text-xs">
        <div className="font-semibold text-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
            <span>How to Fix in 1 Minute:</span>
          </div>
          {status.status === 'tables_missing' && (
            <button
              onClick={handleCopySql}
              className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 bg-emerald-950/60 border border-emerald-800 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors"
            >
              {copiedSql ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              <span>{copiedSql ? 'SQL Copied!' : 'Copy SQL Script'}</span>
            </button>
          )}
        </div>

        {status.status === 'tables_missing' ? (
          <div className="space-y-2">
            <ol className="list-decimal list-inside space-y-1 text-slate-300">
              <li>
                Open <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline inline-flex items-center gap-0.5">Supabase Dashboard <ExternalLink className="w-3 h-3" /></a> &rarr; select your project.
              </li>
              <li>
                Click <span className="text-white font-medium">SQL Editor</span> in the left sidebar &rarr; click <span className="text-white font-medium">"New query"</span>.
              </li>
              <li>
                Click the <span className="text-emerald-400 font-medium">"Copy SQL Script"</span> button above, paste it into the editor, and click <span className="text-emerald-400 font-semibold">Run</span>.
              </li>
              <li>
                Once finished, click the <span className="text-blue-400 font-medium">"Retest"</span> button above!
              </li>
            </ol>

            <button
              onClick={() => setShowSql(!showSql)}
              className="text-[11px] text-slate-400 hover:text-slate-200 underline pt-1 block"
            >
              {showSql ? 'Hide SQL Script Preview' : 'Show SQL Script Preview'}
            </button>

            {showSql && (
              <pre className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-[11px] text-slate-300 overflow-x-auto max-h-48 font-mono">
                {SQL_SCHEMA}
              </pre>
            )}
          </div>
        ) : status.status === 'missing_keys' ? (
          <ul className="space-y-1.5 text-slate-300 list-disc list-inside">
            <li>
              Open your <span className="text-white font-medium">Vercel Project &rarr; Settings &rarr; Environment Variables</span>
            </li>
            <li>
              Add <code className="text-amber-300 font-mono">NEXT_PUBLIC_SUPABASE_URL</code> (Type: Config) and <code className="text-amber-300 font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (Type: Config)
            </li>
            <li>
              <span className="text-amber-300 font-semibold">Important:</span> Trigger a <span className="text-white underline">Redeploy in Vercel</span> so Next.js embeds the client keys.
            </li>
          </ul>
        ) : (
          <ul className="space-y-1.5 text-slate-300 list-disc list-inside">
            <li>
              Open <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline inline-flex items-center gap-0.5">Supabase Dashboard <ExternalLink className="w-3 h-3" /></a> &rarr; select your project.
            </li>
            <li>
              Click <span className="text-white font-medium">Storage</span> in the left sidebar &rarr; click <span className="text-white font-medium">"New Bucket"</span>.
            </li>
            <li>
              Set the Name to exactly: <code className="text-emerald-300 font-mono bg-slate-900 px-1 py-0.5 rounded">interview-videos</code>
            </li>
            <li>
              Toggle <span className="text-emerald-400 font-semibold">"Public bucket" to ON</span>.
            </li>
            <li>
              Click <span className="text-white font-medium">Save bucket</span>, then click <span className="text-blue-400 font-medium">"Retest"</span>!
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}
