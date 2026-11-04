'use client';

import { useState, useEffect } from 'react';
import { Database, CheckCircle2, RefreshCw, X, ExternalLink, HelpCircle } from 'lucide-react';

interface SupabaseStatus {
  configured: boolean;
  supabaseUrl: string | null;
  hasAnonKey: boolean;
  hasServiceKey: boolean;
  bucketExists: boolean;
  bucketName: string;
  autoCreated?: boolean;
  canUpload: boolean;
  status: 'ready' | 'missing_keys' | 'bucket_missing' | 'permission_issue';
  errorMessage: string | null;
  instructions: string[];
}

export function SupabaseDiagnosticBanner() {
  const [status, setStatus] = useState<SupabaseStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [dismissed, setDismissed] = useState(false);

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

  if (dismissed || !status) return null;

  // Fully operational status: Render minimal pill
  if (status.status === 'ready') {
    return (
      <div className="bg-emerald-950/30 border border-emerald-800/60 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-emerald-300">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium">
            Supabase Cloud Storage Active: Videos persistently saved to bucket <code className="bg-emerald-950 px-1.5 py-0.5 rounded text-emerald-200">interview-videos</code>
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
                  : status.status === 'bucket_missing'
                  ? 'Supabase Storage Bucket "interview-videos" Missing'
                  : 'Supabase Storage Upload Permissions Needed'}
              </h3>
              <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Action Required
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
              {status.errorMessage ||
                (status.status === 'bucket_missing'
                  ? 'Supabase is connected, but the storage bucket "interview-videos" was not found in your Supabase project. Candidate interview recordings will only be permanently stored once this bucket is created.'
                  : 'Candidate recordings are temporarily falling back to local serverless memory. To store all interview recordings permanently in Supabase, follow the steps below.')}
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
      <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-2 text-xs">
        <div className="font-semibold text-slate-200 flex items-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
          <span>Quick 2-Minute Fix:</span>
        </div>
        <ul className="space-y-1.5 text-slate-300 list-disc list-inside">
          {status.status === 'missing_keys' ? (
            <>
              <li>
                Open your <span className="text-white font-medium">Vercel Project &rarr; Settings &rarr; Environment Variables</span>
              </li>
              <li>
                Add <code className="text-amber-300 font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="text-amber-300 font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
              </li>
              <li>
                <span className="text-amber-300 font-semibold">Important:</span> Trigger a <span className="text-white underline">Redeploy in Vercel</span> so Next.js embeds the client keys.
              </li>
            </>
          ) : (
            <>
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
                Toggle <span className="text-emerald-400 font-semibold">"Public bucket" to ON</span> (this enables video playback for recruiters without complex RLS).
              </li>
              <li>
                Click <span className="text-white font-medium">Save bucket</span>, then click the <span className="text-blue-400 font-medium">"Retest"</span> button above!
              </li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
}
