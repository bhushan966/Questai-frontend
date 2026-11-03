'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { authedFetch } from '@/lib/api';
import { API_URL } from '@/lib/config';
import { DashboardNav } from '@/components/DashboardNav';
import { EditJobRoleModal } from '@/components/EditJobRoleModal';
import { DeleteJobRoleModal } from '@/components/DeleteJobRoleModal';
import {
  ArrowLeft,
  Sparkles,
  ListPlus,
  Bot,
  Copy,
  Check,
  ExternalLink,
  Users,
  Search,
  CheckCircle2,
  Clock,
  ArrowRight,
  Star,
  Settings,
  Pencil,
  Trash2,
  User,
  Link2,
} from 'lucide-react';

interface JobRole {
  id: string;
  title: string;
  description: string;
  skills_required: string | null;
  created_at: string;
}

interface SessionSummary {
  id: string;
  candidate_id: string;
  candidate_name?: string;
  status: string;
  mode?: 'recorded' | 'conversational';
  verdict?: string | null;
  rating?: {
    technical?: number;
    communication?: number;
    problem_solving?: number;
    decision?: 'shortlisted' | 'hold' | 'declined' | 'pending';
  };
  created_at: string;
}

export default function JobRoleSessionsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [role, setRole] = useState<JobRole | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [candidateName, setCandidateName] = useState('');
  const [generatedLink, setGeneratedLink] = useState<{ url: string; modeTitle: string } | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'pending' | 'shortlisted'>('all');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [duplicateSuccess, setDuplicateSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !id) return;

    // 1. Immediately check localStorage for instantaneous display
    let localRole: JobRole | null = null;
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('questai_saved_roles');
        if (stored) {
          const list = JSON.parse(stored);
          localRole = list.find((r: JobRole) => r.id === id) || null;
          if (localRole) {
            setRole(localRole);
            setLoading(false);
          }
        }
      } catch {
        // ignore
      }
    }

    Promise.all([
      authedFetch(`${API_URL}/job-roles/${id}`).then((res) => (res.ok ? res.json() : null)).catch(() => null),
      authedFetch(`${API_URL}/job-roles/${id}/sessions`).then((res) => (res.ok ? res.json() : [])).catch(() => []),
    ])
      .then(([roleData, sessionsData]) => {
        if (roleData) {
          setRole(roleData);
        } else if (localRole) {
          setRole(localRole);
          // Sync local role to server mockStore
          authedFetch(`${API_URL}/job-roles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(localRole),
          }).catch(() => null);
        } else {
          // If not in API and not in first check, try localStorage again
          try {
            const stored = localStorage.getItem('questai_saved_roles');
            if (stored) {
              const list = JSON.parse(stored);
              const found = list.find((r: JobRole) => r.id === id);
              if (found) {
                setRole(found);
                authedFetch(`${API_URL}/job-roles`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(found),
                }).catch(() => null);
              }
            }
          } catch {}
        }
        setSessions(Array.isArray(sessionsData) ? sessionsData : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load role details:', err);
        setLoading(false);
      });
  }, [id, user]);

  const handleGenerateLink = async (source: 'ai' | 'manual' | 'conversational') => {
    setGenerating(true);
    setGeneratedLink(null);
    setLinkError(null);

    const questionSource = source === 'manual' ? 'manual' : 'ai';
    const interviewMode = source === 'conversational' ? 'conversational' : 'recorded';
    const candidateId = crypto.randomUUID();
    const candidateNameVal = candidateName.trim() || undefined;

    try {
      // 1. Ensure the job role is synchronized to the backend
      if (role) {
        await authedFetch(`${API_URL}/job-roles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(role),
        }).catch(() => null);
      }

      // 2. If AI questions, ensure question generation was triggered on the backend
      if (questionSource === 'ai') {
        await authedFetch(`${API_URL}/job-roles/${id}/generate-questions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: role?.title || 'Professional Role',
            skills_required: role?.skills_required || 'Core competencies',
          }),
        }).catch(() => null);
      }

      const payload = {
        job_role_id: id,
        candidate_id: candidateId,
        candidate_name: candidateNameVal,
        question_source: questionSource,
        mode: interviewMode,
      };

      let res: Response | null = null;

      if (API_URL !== '/api') {
        try {
          res = await fetch(`${API_URL}/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        } catch {
          res = null;
        }
      }

      // If backend reports no questions found, trigger question generation and retry once
      if (res && !res.ok && res.status === 400) {
        const errJson = await res.clone().json().catch(() => null);
        if (errJson?.detail && errJson.detail.includes('questions found')) {
          await authedFetch(`${API_URL}/job-roles/${id}/generate-questions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: role?.title || 'Professional Role',
              skills_required: role?.skills_required || 'Core competencies',
            }),
          }).catch(() => null);

          try {
            res = await fetch(`${API_URL}/sessions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
          } catch {
            res = null;
          }
        }
      }

      // Guaranteed fallback to internal Next.js API route if external backend failed or was unreachable
      if (!res || !res.ok) {
        res = await fetch(`/api/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => null);
      }

      if (!res || !res.ok) {
        const err = res ? await res.json().catch(() => null) : null;
        throw new Error(err?.detail || 'Failed to create interview link. Please try again.');
      }

      const session = await res.json();

      // Mirror session to internal /api/sessions so candidate link always resolves
      if (API_URL !== '/api') {
        fetch(`/api/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...session,
            job_role_id: id,
            candidate_id: candidateId,
            candidate_name: candidateNameVal,
            question_source: questionSource,
            mode: interviewMode,
          }),
        }).catch(() => null);
      }

      const modeTitle =
        source === 'conversational'
          ? 'Live Conversational AI'
          : source === 'manual'
          ? 'Custom Questions'
          : 'AI-Curated Questions';

      setGeneratedLink({
        url: `${window.location.origin}/interview/${session.id}`,
        modeTitle,
      });

      // Refresh candidate list
      authedFetch(`${API_URL}/job-roles/${id}/sessions`)
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => setSessions(Array.isArray(data) ? data : []))
        .catch(() => null);
    } catch (err: any) {
      console.warn('Generate link error:', err);
      setLinkError(err.message || 'Failed to generate link. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDuplicateRole = async () => {
    if (!role) return;
    setIsDuplicating(true);
    setDuplicateSuccess(null);

    const newRoleId = `role-${crypto.randomUUID()}`;
    const duplicatedRole: JobRole = {
      id: newRoleId,
      title: `${role.title} (Copy)`,
      description: role.description,
      skills_required: role.skills_required,
      created_at: new Date().toISOString(),
    };

    try {
      // 1. Post to backend
      await authedFetch(`${API_URL}/job-roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(duplicatedRole),
      });

      // 2. Save in localStorage
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem('questai_saved_roles');
          const list = stored ? JSON.parse(stored) : [];
          list.unshift(duplicatedRole);
          localStorage.setItem('questai_saved_roles', JSON.stringify(list));
        } catch {}
      }

      setDuplicateSuccess(`Role duplicated as "${duplicatedRole.title}"`);
      setTimeout(() => {
        router.push(`/dashboard/job-roles/${newRoleId}`);
      }, 900);
    } catch {
      setIsDuplicating(false);
    }
  };

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const name = (s.candidate_name || `Candidate ${s.candidate_id.slice(0, 8)}`).toLowerCase();
      const matchesSearch = name.includes(searchQuery.toLowerCase()) || s.candidate_id.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === 'submitted') return s.status === 'submitted';
      if (statusFilter === 'pending') return s.status !== 'submitted';
      if (statusFilter === 'shortlisted') return s.rating?.decision === 'shortlisted';

      return true;
    });
  }, [sessions, searchQuery, statusFilter]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center">
        Checking authentication...
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <DashboardNav />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Back navigation */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-xs sm:text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to all job roles</span>
        </Link>

        {/* Role Header Banner */}
        {role && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  {role.title}
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Created on {new Date(role.created_at).toLocaleDateString()}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                <button
                  onClick={() => setIsEditOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                  title="Edit title, description, or skills"
                >
                  <Pencil className="w-3.5 h-3.5 text-blue-400" />
                  <span>Edit Role</span>
                </button>

                <button
                  onClick={handleDuplicateRole}
                  disabled={isDuplicating}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                  title="Duplicate and reuse this role for another opening"
                >
                  <Copy className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{isDuplicating ? 'Duplicating...' : 'Duplicate Role'}</span>
                </button>

                <Link
                  href={`/dashboard/job-roles/${id}/questions`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                >
                  <Settings className="w-3.5 h-3.5 text-purple-400" />
                  <span>Manage Questions</span>
                </Link>

                <button
                  onClick={() => setIsDeleteOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-900/60 transition-colors"
                  title="Delete job role"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>

            {duplicateSuccess && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-800 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>{duplicateSuccess} — Opening role editor...</span>
              </div>
            )}

            <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">
              {role.description}
            </p>

            {role.skills_required && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-xs text-slate-400 font-medium mr-1">Required Skills:</span>
                {role.skills_required.split(',').map((s, i) => (
                  <span
                    key={i}
                    className="text-xs bg-slate-950 text-blue-300 border border-slate-800 px-2.5 py-1 rounded-full font-medium"
                  >
                    {s.trim()}
                  </span>
                ))}
              </div>
            )}

            {/* Quick Link Generators */}
            <div id="generate-link" className="pt-5 border-t border-slate-800/80 space-y-3.5 scroll-mt-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-white">
                    Generate Candidate Interview Link
                  </span>
                </div>
                <span className="text-xs text-slate-400">
                  Select a format below to create a direct link for this role
                </span>
              </div>

              {/* Optional candidate name */}
              <div className="max-w-md relative">
                <User className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  placeholder="Candidate name or referral tag (optional)..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => handleGenerateLink('ai')}
                  disabled={generating}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-sm transition-all hover:scale-[1.01]"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{generating ? 'Creating Link...' : '+ AI Interview Link'}</span>
                </button>

                <button
                  onClick={() => handleGenerateLink('manual')}
                  disabled={generating}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-sm transition-all hover:scale-[1.01]"
                >
                  <ListPlus className="w-3.5 h-3.5" />
                  <span>{generating ? 'Creating Link...' : '+ Custom Questions Link'}</span>
                </button>

                <button
                  onClick={() => handleGenerateLink('conversational')}
                  disabled={generating}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-sm transition-all hover:scale-[1.01]"
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>{generating ? 'Creating Link...' : '+ Conversational AI Link'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Link Generated Banner */}
        {generatedLink && (
          <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 to-slate-950 border border-emerald-800/80 rounded-2xl space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-2">
                <Check className="w-4 h-4" />
                Candidate Link Generated ({generatedLink.modeTitle})
              </span>
              <a
                href={generatedLink.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 font-medium"
              >
                <span>Open in New Tab</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={generatedLink.url}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-mono text-slate-200 select-all"
              />
              <button
                onClick={handleCopy}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-medium shrink-0 transition-colors flex items-center gap-1.5 ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Link Error Banner */}
        {linkError && (
          <div className="p-4 bg-red-950/40 border border-red-800 rounded-2xl flex items-center justify-between text-xs text-red-300 animate-in fade-in">
            <span>{linkError}</span>
            <button
              onClick={() => setLinkError(null)}
              className="text-red-400 hover:text-red-200 underline font-medium ml-3"
            >
              Dismiss
            </button>
          </div>
        )}


        {/* Candidate Pipeline Controls */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">Candidate Submissions</h2>
              <span className="text-xs bg-slate-800 text-slate-300 font-semibold px-2 py-0.5 rounded-full">
                {sessions.length}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 sm:w-60">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter candidate..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    statusFilter === 'all'
                      ? 'bg-blue-600 text-white font-medium'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setStatusFilter('submitted')}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    statusFilter === 'submitted'
                      ? 'bg-emerald-600 text-white font-medium'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Completed
                </button>
                <button
                  onClick={() => setStatusFilter('shortlisted')}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    statusFilter === 'shortlisted'
                      ? 'bg-purple-600 text-white font-medium'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Shortlisted
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading candidates...</span>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div className="text-sm font-semibold text-white">No candidate sessions found</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchQuery || statusFilter !== 'all'
                  ? 'No candidates match your current search or filter query.'
                  : 'Generate and send an interview link above to start screening candidates.'}
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredSessions.map((s) => {
                const displayName = s.candidate_name || `Candidate ${s.candidate_id.slice(0, 8)}`;
                const isSubmitted = s.status === 'submitted';
                const isShortlisted = s.rating?.decision === 'shortlisted';
                const isDeclined = s.rating?.decision === 'declined';
                const isConversational = s.mode === 'conversational';

                return (
                  <Link
                    key={s.id}
                    href={`/dashboard/sessions/${s.id}`}
                    className="p-4 sm:p-5 bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-800 to-slate-700 border border-slate-700 flex items-center justify-center text-sm font-bold text-white shrink-0 group-hover:scale-105 transition-transform">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white group-hover:text-blue-400 transition-colors">
                            {displayName}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                              isConversational
                                ? 'bg-indigo-950/60 text-indigo-300 border-indigo-800'
                                : 'bg-slate-950 text-slate-400 border-slate-800'
                            }`}
                          >
                            {isConversational ? 'Conversational AI' : 'Recorded Q&A'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-2">
                          <span>Submitted {new Date(s.created_at).toLocaleString()}</span>
                          <span>•</span>
                          <span className="font-mono text-[11px] text-slate-600">ID: {s.candidate_id.slice(0, 8)}</span>
                        </div>

                        {s.verdict && (
                          <div className="text-xs text-slate-400 line-clamp-1 italic pt-0.5">
                            "{s.verdict.replace(/^Verdict:\s*/i, '')}"
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                      {isShortlisted ? (
                        <span className="text-xs px-2.5 py-1 rounded-full border bg-purple-950/60 text-purple-300 border-purple-800 font-semibold flex items-center gap-1">
                          <Star className="w-3 h-3 text-purple-400 fill-purple-400" />
                          Shortlisted
                        </span>
                      ) : isDeclined ? (
                        <span className="text-xs px-2.5 py-1 rounded-full border bg-rose-950/60 text-rose-300 border-rose-800 font-medium">
                          Declined
                        </span>
                      ) : isSubmitted ? (
                        <span className="text-xs px-2.5 py-1 rounded-full border bg-emerald-950/60 text-emerald-300 border-emerald-800 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          Ready for Review
                        </span>
                      ) : (
                        <span className="text-xs px-2.5 py-1 rounded-full border bg-slate-800 text-slate-400 border-slate-700 font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          In Progress
                        </span>
                      )}

                      <div className="inline-flex items-center gap-1 text-xs font-semibold text-blue-400 group-hover:text-blue-300">
                        <span>Review</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Edit Job Role Modal */}
      <EditJobRoleModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        role={role}
        onSaved={(updated) => {
          setRole((prev) => (prev ? { ...prev, ...updated, created_at: prev.created_at } : null));
        }}
      />

      {/* Delete Confirmation Modal */}
      <DeleteJobRoleModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        role={role}
        onDeleted={() => {
          router.push('/dashboard');
        }}
      />
    </div>
  );
}