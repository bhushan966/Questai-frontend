'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { authedFetch } from '@/lib/api';
import { API_URL } from '@/lib/config';

interface SessionSummary {
  id: string;
  candidate_id: string;
  status: string;
  created_at: string;
}

export default function JobRoleSessionsPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
  if (!user) return;
  authedFetch(`${API_URL}/job-roles/${id}/sessions`)
    .then((res) => res.json())
    .then((data) => {
      console.log('Sessions response:', data);
      if (!Array.isArray(data)) {
        setSessions([]);
        setLoading(false);
        return;
      }
      setSessions(data);
      setLoading(false);
    });
}, [id, user]);

  if (authLoading) return <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center">Checking login...</div>;
  if (!user) return null;

  const handleGenerateLink = async () => {
    setGenerating(true);
    setGeneratedLink(null);
    try {
      const candidateId = crypto.randomUUID();
      const res = await fetch(`${API_URL}/sessions/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_role_id: id, candidate_id: candidateId }),
      });
      if (!res.ok) throw new Error('Failed to create session');
      const session = await res.json();
      setGeneratedLink(`${window.location.origin}/interview/${session.id}`);
    } catch (err) {
      console.error(err);
      alert('Failed to generate link.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedLink!);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusColor = (status: string) =>
    status === 'submitted'
      ? 'bg-emerald-950/50 text-emerald-400 border-emerald-900'
      : 'bg-slate-800 text-slate-400 border-slate-700';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-3xl mx-auto p-8 space-y-6">
        <Link href="/dashboard" className="text-sm text-slate-400 hover:text-slate-200">
          ← Back to job roles
        </Link>
        <h1 className="text-2xl font-bold">Candidates</h1>

        <button
          onClick={handleGenerateLink}
          disabled={generating}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition-colors text-white font-medium rounded-lg text-sm"
        >
          {generating ? 'Generating...' : '+ Generate Candidate Link'}
        </button>

        {generatedLink && (
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
            <div className="text-sm text-slate-400">Share this link with the candidate:</div>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={generatedLink}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200"
              />
              <button
                onClick={handleCopy}
                className={`px-3 py-2 rounded-lg text-sm font-medium shrink-0 transition-colors ${
                  copied ? 'bg-emerald-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-slate-400">Loading candidates...</div>
        ) : sessions.length === 0 ? (
          <div className="border border-dashed border-slate-800 rounded-xl p-12 text-center text-slate-500">
            No submissions yet — share the candidate link to get started.
          </div>
        ) : (
          <div className="grid gap-3">
            {sessions.map((s) => (
              <Link
                key={s.id}
                href={`/dashboard/sessions/${s.id}`}
                className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors rounded-xl"
              >
                <div>
                  <div className="font-medium text-slate-100">Candidate {s.candidate_id.slice(0, 8)}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {new Date(s.created_at).toLocaleString()}
                  </div>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full border ${statusColor(s.status)}`}>
                  {s.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}