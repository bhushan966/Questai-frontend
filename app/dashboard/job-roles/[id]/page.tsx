'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { authedFetch } from '@/lib/api';
import { API_URL } from '@/lib/config';
import { DashboardNav } from '@/components/DashboardNav';
import { EditJobRoleModal } from '@/components/EditJobRoleModal';
import { DeleteJobRoleModal } from '@/components/DeleteJobRoleModal';
import { BatchInviteModal } from '@/components/BatchInviteModal';
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
  XCircle,
  Mail,
  Calendar,
  Loader2,
} from 'lucide-react';

interface JobRole {
  id: string;
  title: string;
  description: string;
  skills_required: string | null;
  company_name?: string | null;
  created_at: string;
}

interface SessionSummary {
  id: string;
  candidate_id: string;
  candidate_name?: string;
  job_role_id?: string;
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

function toDateTimeLocalString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
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
  const [candidateEmail, setCandidateEmail] = useState('');
  const [customExpiryDateTime, setCustomExpiryDateTime] = useState<string>(() =>
    toDateTimeLocalString(new Date(Date.now() + 48 * 3600 * 1000))
  );
  const datetimeInputRef = useRef<HTMLInputElement>(null);
  const [expiryPreset, setExpiryPreset] = useState<'48h' | '24h' | '3d' | '7d' | 'custom' | 'none'>('48h');
  const [generatedLink, setGeneratedLink] = useState<{
    url: string;
    modeTitle: string;
    expiresAt?: string | null;
    candidateEmail?: string;
    candidateName?: string;
  } | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'pending' | 'shortlisted'>('all');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isBatchInviteOpen, setIsBatchInviteOpen] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [duplicateSuccess, setDuplicateSuccess] = useState<string | null>(null);

  // Candidate Submission Deletion state
  const [sessionToDelete, setSessionToDelete] = useState<SessionSummary | null>(null);
  const [deletingSession, setDeletingSession] = useState(false);
  const [deleteSessionSuccess, setDeleteSessionSuccess] = useState<string | null>(null);

  const handleDeleteSessionConfirm = async () => {
    if (!sessionToDelete) return;
    setDeletingSession(true);

    try {
      // 1. Call API
      let res: Response | null = null;
      if (API_URL !== '/api') {
        res = await authedFetch(`${API_URL}/sessions/${sessionToDelete.id}`, { method: 'DELETE' }).catch(() => null);
      }
      if (!res || !res.ok) {
        res = await authedFetch(`/api/sessions/${sessionToDelete.id}`, { method: 'DELETE' }).catch(() => null);
      }

      // 2. Remove from component state
      setSessions((prev) => prev.filter((s) => s.id !== sessionToDelete.id));

      // 3. Remove from localStorage saved records
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem('questai_saved_sessions');
          if (stored) {
            const list = JSON.parse(stored);
            const filtered = list.filter((s: any) => s.id !== sessionToDelete.id);
            localStorage.setItem('questai_saved_sessions', JSON.stringify(filtered));
          }

          const candMap = JSON.parse(localStorage.getItem('questai_candidate_names') || '{}');
          delete candMap[sessionToDelete.id];
          localStorage.setItem('questai_candidate_names', JSON.stringify(candMap));

          const subMap = JSON.parse(localStorage.getItem('questai_submitted_sessions') || '{}');
          delete subMap[sessionToDelete.id];
          localStorage.setItem('questai_submitted_sessions', JSON.stringify(subMap));

          const evalMap = JSON.parse(localStorage.getItem('questai_session_evaluations') || '{}');
          delete evalMap[sessionToDelete.id];
          localStorage.setItem('questai_session_evaluations', JSON.stringify(evalMap));
        } catch {}
      }

      setDeleteSessionSuccess(`Successfully deleted submission for ${sessionToDelete.candidate_name || 'Candidate'}.`);
      setTimeout(() => setDeleteSessionSuccess(null), 4000);
      setSessionToDelete(null);
    } catch (err) {
      console.error('Failed to delete candidate session:', err);
    } finally {
      setDeletingSession(false);
    }
  };

  // Unified session fetcher across external API, internal Next.js API, and local storage
  const fetchRoleSessions = useCallback(async (roleId: string) => {
    let externalList: SessionSummary[] = [];
    let internalList: SessionSummary[] = [];
    let localSavedList: SessionSummary[] = [];

    // 1. External Render API if configured
    try {
      const listUrl = API_URL.startsWith('http') ? `${API_URL}/job-roles/${roleId}/sessions` : `${API_URL}/job-roles/${roleId}/sessions`;
      const res = await authedFetch(listUrl);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          externalList = data.map((item: any) => ({
            ...item,
            job_role_id: item.job_role_id || roleId,
          }));
        }
      }
    } catch {}

    // 2. Internal /api/sessions (Next.js & Supabase)
    try {
      const res = await fetch('/api/sessions');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          internalList = data.filter((s: SessionSummary) => s.job_role_id === roleId);
        }
      }
    } catch {}

    // 3. Client localStorage saved sessions
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('questai_saved_sessions');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            localSavedList = parsed.filter((s: SessionSummary) => s.job_role_id === roleId);
          }
        }
      } catch {}
    }

    // Merge and deduplicate by session id
    const sessionsMap = new Map<string, SessionSummary>();
    [...externalList, ...internalList, ...localSavedList].forEach((s) => {
      if (s && s.id && !sessionsMap.has(s.id)) {
        sessionsMap.set(s.id, s);
      }
    });

    let candidateNameMap: Record<string, string> = {};
    let submittedSessionsMap: Record<string, boolean> = {};
    let evaluationsMap: Record<string, any> = {};

    if (typeof window !== 'undefined') {
      try {
        candidateNameMap = JSON.parse(localStorage.getItem('questai_candidate_names') || '{}');
        submittedSessionsMap = JSON.parse(localStorage.getItem('questai_submitted_sessions') || '{}');
        evaluationsMap = JSON.parse(localStorage.getItem('questai_session_evaluations') || '{}');
      } catch {}
    }

    // Ensure locally evaluated sessions for this role are accounted for
    Object.keys(evaluationsMap).forEach((sessId) => {
      const ev = evaluationsMap[sessId];
      if (ev.job_role_id === roleId) {
        const existing = sessionsMap.get(sessId);
        if (existing) {
          existing.rating = existing.rating || { decision: ev.decision };
          if (ev.decision) existing.status = 'submitted';
        } else {
          sessionsMap.set(sessId, {
            id: sessId,
            candidate_id: `cand-${sessId.slice(0, 8)}`,
            candidate_name: candidateNameMap[sessId] || ev.candidate_name,
            job_role_id: roleId,
            status: 'submitted',
            created_at: ev.evaluated_at || new Date().toISOString(),
            rating: { decision: ev.decision },
          });
        }
      }
    });

    const enriched = Array.from(sessionsMap.values()).map((s: SessionSummary) => {
      const localEval = evaluationsMap[s.id];
      const rating = s.rating || (localEval ? {
        technical: localEval.technical,
        communication: localEval.communication,
        problem_solving: localEval.problem_solving,
        decision: localEval.decision,
      } : undefined);

      return {
        ...s,
        candidate_name: s.candidate_name || candidateNameMap[s.id],
        status: submittedSessionsMap[s.id] || localEval ? 'submitted' : s.status,
        rating,
      };
    });

    setSessions(enriched);
    return enriched;
  }, []);

  useEffect(() => {
    if (!user || !id) return;

    // Check if role has been deleted
    if (typeof window !== 'undefined') {
      try {
        const deletedStored = localStorage.getItem('questai_deleted_roles');
        if (deletedStored) {
          const deletedList: string[] = JSON.parse(deletedStored);
          if (deletedList.includes(id)) {
            router.replace('/dashboard');
            return;
          }
        }
      } catch {}
    }

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

    authedFetch(`${API_URL}/job-roles/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null)
      .then((roleData) => {
        if (roleData) {
          setRole(roleData);
        } else if (localRole) {
          setRole(localRole);
        } else {
          try {
            const stored = localStorage.getItem('questai_saved_roles');
            if (stored) {
              const list = JSON.parse(stored);
              const found = list.find((r: JobRole) => r.id === id);
              if (found) setRole(found);
            }
          } catch {}
        }
      });

    fetchRoleSessions(id).finally(() => setLoading(false));
  }, [id, user, router, fetchRoleSessions]);

  const handleSelectPreset = useCallback((preset: '48h' | '24h' | '3d' | '7d' | 'none') => {
    setExpiryPreset(preset);
    const now = Date.now();
    if (preset === '24h') {
      setCustomExpiryDateTime(toDateTimeLocalString(new Date(now + 24 * 3600 * 1000)));
    } else if (preset === '48h') {
      setCustomExpiryDateTime(toDateTimeLocalString(new Date(now + 48 * 3600 * 1000)));
    } else if (preset === '3d') {
      setCustomExpiryDateTime(toDateTimeLocalString(new Date(now + 72 * 3600 * 1000)));
    } else if (preset === '7d') {
      setCustomExpiryDateTime(toDateTimeLocalString(new Date(now + 168 * 3600 * 1000)));
    }
  }, []);

  const handleCustomDateTimeChange = useCallback((val: string) => {
    setCustomExpiryDateTime(val);
    setExpiryPreset('custom');
  }, []);

  const handleGenerateLink = async (source: 'ai' | 'manual' | 'conversational') => {
    setGenerating(true);
    setGeneratedLink(null);
    setLinkError(null);

    const questionSource = source === 'manual' ? 'manual' : 'ai';
    const interviewMode = source === 'conversational' ? 'conversational' : 'recorded';
    const candidateId = crypto.randomUUID();
    const candidateNameVal = candidateName.trim() || undefined;

    try {
      // 1. If AI questions, ensure question generation was triggered on the backend
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
          const sessionsUrl = API_URL.startsWith('http') ? `${API_URL}/sessions/` : `${API_URL}/sessions`;
          res = await fetch(sessionsUrl, {
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
            const sessionsUrl = API_URL.startsWith('http') ? `${API_URL}/sessions/` : `${API_URL}/sessions`;
            res = await fetch(sessionsUrl, {
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

      // If created on external API, ensure same session ID is registered locally without duplicating
      if (API_URL !== '/api' && session?.id) {
        await fetch(`/api/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: session.id,
            job_role_id: id,
            job_role_title: role?.title,
            job_role_description: role?.description,
            skills_required: role?.skills_required,
            candidate_id: session.candidate_id || candidateId,
            candidate_name: candidateNameVal,
            question_source: questionSource,
            mode: interviewMode,
          }),
        }).catch(() => null);
      }

      // Persist candidate name mapping in localStorage so recruiter always sees the candidate name
      if (typeof window !== 'undefined' && candidateNameVal && session?.id) {
        try {
          const map = JSON.parse(localStorage.getItem('questai_candidate_names') || '{}');
          map[session.id] = candidateNameVal;
          localStorage.setItem('questai_candidate_names', JSON.stringify(map));
        } catch {}
      }

      // Persist candidate email if provided
      const candidateEmailVal = candidateEmail.trim();
      if (typeof window !== 'undefined' && candidateEmailVal && session?.id) {
        try {
          const emailMap = JSON.parse(localStorage.getItem('questai_candidate_emails') || '{}');
          emailMap[session.id] = candidateEmailVal;
          localStorage.setItem('questai_candidate_emails', JSON.stringify(emailMap));
        } catch {}
      }

      // Compute expiration deadline timestamp from the date & time selector
      let expiresAt: string | null = null;
      if (expiryPreset !== 'none' && customExpiryDateTime) {
        try {
          const parsed = new Date(customExpiryDateTime);
          if (!isNaN(parsed.getTime())) {
            expiresAt = parsed.toISOString();
          }
        } catch {}
      }

      if (typeof window !== 'undefined' && expiresAt && session?.id) {
        try {
          const deadMap = JSON.parse(localStorage.getItem('questai_session_deadlines') || '{}');
          deadMap[session.id] = expiresAt;
          localStorage.setItem('questai_session_deadlines', JSON.stringify(deadMap));
        } catch {}
      }

      const modeTitle =
        source === 'conversational'
          ? 'Live Conversational AI'
          : source === 'manual'
          ? 'Custom Questions'
          : 'AI-Curated Questions';

      const queryParams = new URLSearchParams();
      if (candidateNameVal) queryParams.set('name', candidateNameVal);
      if (expiresAt) queryParams.set('expires', expiresAt);
      if (candidateEmailVal) queryParams.set('email', candidateEmailVal);
      if (role?.title) queryParams.set('roleTitle', role.title);
      if (role?.description) queryParams.set('roleDesc', role.description);
      if (role?.skills_required) queryParams.set('roleSkills', role.skills_required);
      if (role?.company_name) queryParams.set('company', role.company_name);
      const queryStr = queryParams.toString() ? `?${queryParams.toString()}` : '';

      setGeneratedLink({
        url: `${window.location.origin}/interview/${session.id}${queryStr}`,
        modeTitle,
        expiresAt,
        candidateEmail: candidateEmailVal || undefined,
        candidateName: candidateNameVal,
      });

      // Persist to local storage saved sessions so it appears everywhere immediately
      if (typeof window !== 'undefined' && session?.id) {
        try {
          const stored = localStorage.getItem('questai_saved_sessions');
          const list = stored ? JSON.parse(stored) : [];
          const exists = list.some((s: any) => s.id === session.id);
          if (!exists) {
            list.unshift({
              id: session.id,
              job_role_id: id,
              candidate_id: session.candidate_id || candidateId,
              candidate_name: candidateNameVal,
              mode: interviewMode,
              status: 'not_started',
              created_at: new Date().toISOString(),
            });
            localStorage.setItem('questai_saved_sessions', JSON.stringify(list));
          }
        } catch {}
      }

      await fetchRoleSessions(id);
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

  const getGmailComposeUrl = () => {
    if (!generatedLink || !role) return '#';
    const candidateDisp = generatedLink.candidateName || 'Candidate';
    const companyNameDisp = role.company_name ? role.company_name : '';
    const subject = `Invitation: Video Interview for ${role.title}${role.company_name ? ` at ${role.company_name}` : ''}`;

    let deadlineLine = 'No expiration deadline.';
    if (generatedLink.expiresAt) {
      const expDate = new Date(generatedLink.expiresAt);
      deadlineLine = `Please complete your interview by: ${expDate.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}.`;
    }

    const body = `Hi ${candidateDisp},

Thank you for your interest in the ${role.title} position${companyNameDisp ? ` at ${companyNameDisp}` : ''}!

We would like to invite you to complete a brief video assessment powered by QuestAI. This interactive session gives you the opportunity to share your experience and thought process directly with our hiring team.

👉 Access Your Interview Session Here:
${generatedLink.url}

⏰ Assessment Deadline:
${deadlineLine}

Instructions:
• Please ensure you are in a quiet environment with a working camera and microphone.
• Keep your browser tab in focus during your responses.
• You will be given prep time for each question before your video answer is recorded.

Best regards,
${companyNameDisp ? `${companyNameDisp} Hiring Team` : 'Hiring Team'} • Powered by QuestAI`;

    return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
      generatedLink.candidateEmail || ''
    )}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
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

      <main className="flex-1 max-w-7xl 2xl:max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
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
                <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
                  <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    {role.title}
                  </h1>
                  {role.company_name ? (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950 border border-slate-700/80 text-xs font-medium text-slate-200 shadow-sm">
                      <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-[9px] flex items-center justify-center">
                        {role.company_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-white">{role.company_name}</span>
                      <span className="text-slate-500">•</span>
                      <span className="text-[11px] text-blue-400">Powered by QuestAI</span>
                    </div>
                  ) : (
                    <span className="text-[11px] font-semibold text-slate-400 bg-slate-950 px-2 py-0.5 rounded-full border border-slate-800">
                      QuestAI Standard
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">
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

            <p className="text-sm text-slate-300 leading-relaxed w-full whitespace-pre-line">
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
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 hidden sm:inline">
                    Inviting multiple candidates?
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsBatchInviteOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                    title="Batch invite multiple candidates at once"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Batch Invite</span>
                  </button>
                </div>
              </div>

              {/* Optional candidate name & email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={candidateName}
                    onChange={(e) => setCandidateName(e.target.value)}
                    placeholder="Candidate name or referral tag (optional)..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    value={candidateEmail}
                    onChange={(e) => setCandidateEmail(e.target.value)}
                    placeholder="Candidate email for Gmail dispatch (optional)..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              {/* Expiry Deadline & Custom Date-Time Selector */}
              <div className="space-y-2 pt-1 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-400" />
                    <span>Interview Expiry Date & Time:</span>
                  </span>

                  {expiryPreset !== 'none' && customExpiryDateTime ? (
                    <span className="text-slate-400 text-[11px]">
                      Expires:{' '}
                      <strong className="text-amber-300 font-medium">
                        {new Date(customExpiryDateTime).toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </strong>
                    </span>
                  ) : (
                    <span className="text-slate-500 text-[11px]">No expiration deadline</span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Interactive Date & Time Picker */}
                  <div className="relative inline-flex items-center">
                    <button
                      type="button"
                      disabled={expiryPreset === 'none'}
                      onClick={() => {
                        try {
                          datetimeInputRef.current?.showPicker();
                        } catch {
                          datetimeInputRef.current?.focus();
                        }
                      }}
                      className="absolute left-2.5 z-10 text-blue-400 hover:text-blue-300 disabled:text-slate-600 disabled:opacity-40 transition-colors pointer-events-auto"
                      title="Click to open calendar"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                    </button>
                    <input
                      ref={datetimeInputRef}
                      type="datetime-local"
                      style={{ colorScheme: 'dark' }}
                      value={expiryPreset === 'none' ? '' : customExpiryDateTime}
                      disabled={expiryPreset === 'none'}
                      onChange={(e) => handleCustomDateTimeChange(e.target.value)}
                      min={toDateTimeLocalString(new Date())}
                      className={`bg-slate-950 border rounded-xl pl-8 pr-3 py-1.5 text-xs focus:outline-none transition-colors [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-90 hover:[&::-webkit-calendar-picker-indicator]:opacity-100 ${
                        expiryPreset === 'none'
                          ? 'border-slate-800 text-slate-600 opacity-40 cursor-not-allowed'
                          : 'border-slate-700 text-slate-100 hover:border-slate-600 focus:border-blue-500'
                      }`}
                      title="Select exact deadline date and time"
                    />
                  </div>

                  {/* Quick Duration Presets */}
                  {(
                    [
                      { id: '48h', label: '48h (Default)' },
                      { id: '24h', label: '24h' },
                      { id: '3d', label: '3 Days' },
                      { id: '7d', label: '7 Days' },
                      { id: 'none', label: 'No Expiry' },
                    ] as const
                  ).map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset.id)}
                      className={`px-2.5 py-1.5 rounded-lg font-medium text-xs transition-colors border ${
                        expiryPreset === preset.id
                          ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
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
          <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 to-slate-950 border border-emerald-800/80 rounded-2xl space-y-3.5 animate-in fade-in shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <Check className="w-4 h-4" />
                  Candidate Link Generated ({generatedLink.modeTitle})
                </span>

                {generatedLink.expiresAt ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-950/70 border border-amber-800/80 text-[11px] font-semibold text-amber-300">
                    <Clock className="w-3 h-3 text-amber-400" />
                    Valid until {new Date(generatedLink.expiresAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[11px] font-medium text-slate-300">
                    No expiration deadline
                  </span>
                )}

                {generatedLink.candidateEmail && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-950/70 border border-blue-800/80 text-[11px] font-semibold text-blue-300">
                    <Mail className="w-3 h-3 text-blue-400" />
                    {generatedLink.candidateEmail}
                  </span>
                )}
              </div>

              <a
                href={generatedLink.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 font-medium ml-auto"
              >
                <span>Test Link in New Tab</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Link URL, Copy Link, and Send via Gmail */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                readOnly
                value={generatedLink.url}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-mono text-slate-200 select-all"
              />
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleCopy}
                  className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                    copied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                  title="Copy interview link"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copied Link' : 'Copy Link'}</span>
                </button>

                <a
                  href={getGmailComposeUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition-all hover:scale-[1.01]"
                  title="Open a pre-filled invitation draft in Gmail"
                >
                  <Mail className="w-4 h-4" />
                  <span>Send via Gmail</span>
                  <ExternalLink className="w-3 h-3 opacity-80" />
                </a>
              </div>
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

          {deleteSessionSuccess && (
            <div className="bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs px-4 py-3 rounded-xl flex items-center justify-between shadow-sm animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{deleteSessionSuccess}</span>
              </div>
              <button
                type="button"
                onClick={() => setDeleteSessionSuccess(null)}
                className="text-emerald-400 hover:text-emerald-200 text-xs font-semibold px-2 py-0.5"
              >
                Dismiss
              </button>
            </div>
          )}

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
              <p className="text-xs text-slate-500 max-w-md mx-auto">
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
                const decision = s.rating?.decision;
                const isShortlisted = decision === 'shortlisted';
                const isOnHold = decision === 'hold';
                const isDeclined = decision === 'declined';
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
                        <span className="text-xs px-2.5 py-1 rounded-full border bg-purple-950/60 text-purple-300 border-purple-800 font-semibold flex items-center gap-1 shadow-sm">
                          <Star className="w-3 h-3 text-purple-400 fill-purple-400" />
                          Shortlisted
                        </span>
                      ) : isOnHold ? (
                        <span className="text-xs px-2.5 py-1 rounded-full border bg-amber-950/60 text-amber-300 border-amber-800 font-semibold flex items-center gap-1 shadow-sm">
                          <Clock className="w-3 h-3 text-amber-400" />
                          On Hold
                        </span>
                      ) : isDeclined ? (
                        <span className="text-xs px-2.5 py-1 rounded-full border bg-rose-950/60 text-rose-300 border-rose-800 font-semibold flex items-center gap-1 shadow-sm">
                          <XCircle className="w-3 h-3 text-rose-400" />
                          Declined
                        </span>
                      ) : isSubmitted ? (
                        <span className="text-xs px-2.5 py-1 rounded-full border bg-emerald-950/60 text-emerald-300 border-emerald-800 font-medium flex items-center gap-1 shadow-sm">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          Ready for Review
                        </span>
                      ) : (
                        <span className="text-xs px-2.5 py-1 rounded-full border bg-slate-800 text-slate-400 border-slate-700 font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          In Progress
                        </span>
                      )}

                      <div className="flex items-center gap-1">
                        <div className="inline-flex items-center gap-1 text-xs font-semibold text-blue-400 group-hover:text-blue-300">
                          <span>Review</span>
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSessionToDelete(s);
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/40 border border-transparent hover:border-red-900/50 transition-colors ml-1"
                          title="Delete candidate submission"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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

      {/* Delete Candidate Submission Modal */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-10 h-10 rounded-xl bg-red-950/60 border border-red-800/80 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-base">Delete Submission?</h3>
                <p className="text-xs text-slate-400">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete the candidate interview submission for{' '}
              <strong className="text-white">{sessionToDelete.candidate_name || 'Candidate'}</strong> (ID: <span className="font-mono text-slate-400">{sessionToDelete.candidate_id}</span>)?
              All video recordings, AI answers, transcripts, and evaluation scorecards for this submission will be permanently removed.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setSessionToDelete(null)}
                disabled={deletingSession}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-800/70 hover:bg-slate-800 border border-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSessionConfirm}
                disabled={deletingSession}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 transition-colors flex items-center gap-1.5 shadow-lg shadow-red-900/30"
              >
                {deletingSession ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Submission</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QuestAI Batch Candidate Invite Queue Modal */}
      {role && (
        <BatchInviteModal
          isOpen={isBatchInviteOpen}
          onClose={() => setIsBatchInviteOpen(false)}
          role={role}
          onSessionsCreated={(newSessions) => {
            setSessions((prev) => [...newSessions, ...prev]);
          }}
        />
      )}
    </div>
  );
}