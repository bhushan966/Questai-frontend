'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { authedFetch } from '@/lib/api';
import { API_URL } from '@/lib/config';
import { DashboardNav } from '@/components/DashboardNav';
import { EditJobRoleModal } from '@/components/EditJobRoleModal';
import { DeleteJobRoleModal } from '@/components/DeleteJobRoleModal';
import { SupabaseDiagnosticBanner } from '@/components/SupabaseDiagnosticBanner';
import {
  Briefcase,
  CheckCircle2,
  TrendingUp,
  Search,
  Plus,
  Link2,
  ArrowRight,
  Sparkles,
  Clock,
  Pencil,
  Copy,
  Trash2,
  Check,
  Star,
  Bot,
  ListPlus,
  Users,
  ArrowLeft,
  Building2,
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
  job_role_id: string;
  candidate_id?: string;
  candidate_name?: string;
  candidate_email?: string;
  question_source?: string;
  status: string;
  mode?: string;
  created_at?: string;
  submitted_at?: string;
  rating?: {
    decision?: string;
  };
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();

  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleToEdit, setRoleToEdit] = useState<JobRole | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<JobRole | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [activeKpiView, setActiveKpiView] = useState<
    'roles' | 'ready_for_review' | 'in_pipeline' | 'shortlisted' | 'all_candidates'
  >('roles');
  const [candidateSearchQuery, setCandidateSearchQuery] = useState('');
  const [candidateRoleFilter, setCandidateRoleFilter] = useState<string>('all');

  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    async function loadDashboard() {
      // 1. Instantly read locally saved roles, sessions, and deleted tombstones
      let localRoles: JobRole[] = [];
      let deletedRoleIds: string[] = [];
      let localSavedSessions: SessionSummary[] = [];
      let submittedMap: Record<string, boolean> = {};
      let evaluationsMap: Record<string, any> = {};

      if (typeof window !== 'undefined') {
        try {
          const deletedStored = localStorage.getItem('questai_deleted_roles');
          if (deletedStored) deletedRoleIds = JSON.parse(deletedStored);

          const userKey = user?.id ? `questai_saved_roles_${user.id}` : null;
          const userStored = userKey ? localStorage.getItem(userKey) : null;
          const stored = userStored || localStorage.getItem('questai_saved_roles');
          if (stored) {
            const parsed = JSON.parse(stored);
            localRoles = parsed.filter((r: JobRole) => {
              if (deletedRoleIds.includes(r.id)) return false;
              if (user?.id && (r as any).user_id && (r as any).user_id !== user.id) return false;
              return true;
            });
            if (isMounted && localRoles.length > 0) {
              setJobRoles(localRoles);
            }
          }

          const deletedSet = new Set<string>();
          deletedRoleIds.forEach((id) => {
            const norm = String(id).toLowerCase().trim();
            deletedSet.add(norm);
            deletedSet.add(norm.replace(/^role-/, ''));
          });

          const savedSessionsStored = localStorage.getItem('questai_saved_sessions');
          if (savedSessionsStored) {
            const parsedSessions = JSON.parse(savedSessionsStored);
            if (Array.isArray(parsedSessions)) {
              localSavedSessions = parsedSessions.filter((s: any) => {
                if (!s || !s.job_role_id) return true;
                const sessRoleId = String(s.job_role_id).toLowerCase().trim();
                return !deletedSet.has(sessRoleId) && !deletedSet.has(sessRoleId.replace(/^role-/, ''));
              });
            }
          }

          submittedMap = JSON.parse(localStorage.getItem('questai_submitted_sessions') || '{}');
          evaluationsMap = JSON.parse(localStorage.getItem('questai_session_evaluations') || '{}');

          // Immediately compute instant preview sessions for zero-latency display
          if (localSavedSessions.length > 0 || Object.keys(evaluationsMap).length > 0) {
            const instantSessionsMap = new Map<string, SessionSummary>();
            localSavedSessions.forEach((s) => {
              if (s && s.id) instantSessionsMap.set(s.id, { ...s });
            });
            Object.keys(evaluationsMap).forEach((sessId) => {
              const ev = evaluationsMap[sessId];
              if (ev?.job_role_id) {
                const evRoleId = String(ev.job_role_id).toLowerCase().trim();
                if (deletedSet.has(evRoleId) || deletedSet.has(evRoleId.replace(/^role-/, ''))) {
                  return; // Skip evaluations of deleted roles
                }
              }
              const existing = instantSessionsMap.get(sessId);
              if (existing) {
                existing.rating = existing.rating || { decision: ev.decision };
                if (ev.decision) existing.status = 'submitted';
                if (!existing.job_role_id && ev.job_role_id) existing.job_role_id = ev.job_role_id;
              } else if (ev?.job_role_id) {
                instantSessionsMap.set(sessId, {
                  id: sessId,
                  job_role_id: ev.job_role_id,
                  status: 'submitted',
                  rating: { decision: ev.decision },
                });
              }
            });
            const instantEnriched = Array.from(instantSessionsMap.values()).map((s) => ({
              ...s,
              status: submittedMap[s.id] || evaluationsMap[s.id]?.decision ? 'submitted' : s.status,
              rating: s.rating || (evaluationsMap[s.id] ? { decision: evaluationsMap[s.id].decision } : undefined),
            }));
            if (isMounted) {
              setSessions(instantEnriched);
            }
          }
        } catch {
          // ignore
        }
      }

      try {
        const rolesUrl = API_URL.startsWith('http') ? `${API_URL}/job-roles/` : `${API_URL}/job-roles`;
        const rolesRes = await authedFetch(rolesUrl).catch(() => null);

        let apiRoles: JobRole[] = [];
        if (rolesRes && rolesRes.ok) {
          apiRoles = await rolesRes.json().catch(() => []);
        }

        // Merge: locally created roles first, then any API roles not already present
        // STRICT RULE: Never add any role that has been deleted!
        const mergedMap = new Map<string, JobRole>();
        localRoles
          .filter((r) => !deletedRoleIds.includes(r.id))
          .forEach((r) => mergedMap.set(r.id, r));

        if (Array.isArray(apiRoles)) {
          apiRoles.forEach((r) => {
            if (!mergedMap.has(r.id) && !deletedRoleIds.includes(r.id)) {
              mergedMap.set(r.id, r);
            }
          });
        }
        const combinedRoles = Array.from(mergedMap.values());

        // Concurrently fetch sessions for all active roles from external backend + internal API
        const roleSessionPromises = combinedRoles.map(async (role) => {
          try {
            const res = await authedFetch(`${API_URL}/job-roles/${role.id}/sessions`);
            if (res.ok) {
              const data = await res.json();
              if (Array.isArray(data)) {
                return data.map((item: any) => ({
                  ...item,
                  job_role_id: item.job_role_id || role.id,
                }));
              }
              return [];
            }
          } catch {
            // ignore
          }
          return [];
        });

        const internalSessionsPromise = fetch('/api/sessions')
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []);

        const [roleSessionsArrays, internalSessions] = await Promise.all([
          Promise.all(roleSessionPromises),
          internalSessionsPromise,
        ]);

        const allRawSessions: SessionSummary[] = [
          ...roleSessionsArrays.flat(),
          ...(Array.isArray(internalSessions) ? internalSessions : []),
          ...localSavedSessions,
        ];

        // Deduplicate sessions by session ID
        const sessionsMap = new Map<string, SessionSummary>();
        allRawSessions.forEach((s) => {
          if (s && s.id && !sessionsMap.has(s.id)) {
            sessionsMap.set(s.id, { ...s });
          }
        });

        // Ensure any locally evaluated sessions are accounted for
        const deletedSet = new Set<string>();
        deletedRoleIds.forEach((id) => {
          const norm = String(id).toLowerCase().trim();
          deletedSet.add(norm);
          deletedSet.add(norm.replace(/^role-/, ''));
        });

        Object.keys(evaluationsMap).forEach((sessId) => {
          const ev = evaluationsMap[sessId];
          if (ev?.job_role_id) {
            const evRoleId = String(ev.job_role_id).toLowerCase().trim();
            if (deletedSet.has(evRoleId) || deletedSet.has(evRoleId.replace(/^role-/, ''))) {
              return; // Skip evaluations of deleted roles
            }
          }
          const existing = sessionsMap.get(sessId);
          if (existing) {
            existing.rating = existing.rating || { decision: ev.decision };
            if (ev.decision) existing.status = 'submitted';
            if (!existing.job_role_id && ev.job_role_id) existing.job_role_id = ev.job_role_id;
          } else if (ev?.job_role_id) {
            sessionsMap.set(sessId, {
              id: sessId,
              job_role_id: ev.job_role_id,
              status: 'submitted',
              rating: { decision: ev.decision },
            });
          }
        });

        const enrichedSessions = Array.from(sessionsMap.values()).map((s: SessionSummary) => {
          const localEval = evaluationsMap[s.id];
          return {
            ...s,
            status: submittedMap[s.id] || localEval ? 'submitted' : s.status,
            rating: s.rating || (localEval ? { decision: localEval.decision } : undefined),
          };
        });

        if (isMounted) {
          setJobRoles(combinedRoles);
          setSessions(enrichedSessions);
          setLoading(false);
        }
      } catch (err) {
        console.warn('Dashboard fetch warning:', err);
        if (isMounted) {
          if (localRoles.length > 0) setJobRoles(localRoles);
          setLoading(false);
        }
      }
    }

    loadDashboard();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const handleDuplicateRole = async (role: JobRole) => {
    setDuplicatingId(role.id);
    setActionNotice(null);

    const newRoleId = `role-${crypto.randomUUID()}`;
    const duplicated: JobRole = {
      id: newRoleId,
      title: `${role.title} (Copy)`,
      description: role.description,
      skills_required: role.skills_required,
      created_at: new Date().toISOString(),
    };

    try {
      const postUrl = API_URL.startsWith('http') ? `${API_URL}/job-roles/` : `${API_URL}/job-roles`;
      const res = await authedFetch(postUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: duplicated.title,
          description: duplicated.description,
          skills_required: duplicated.skills_required,
        }),
      });

      if (res && res.ok) {
        const createdRole = await res.json().catch(() => null);
        if (createdRole?.id) {
          duplicated.id = String(createdRole.id);
        }
      }

      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem('questai_saved_roles');
          const list = stored ? JSON.parse(stored) : [];
          list.unshift(duplicated);
          localStorage.setItem('questai_saved_roles', JSON.stringify(list));
        } catch {}
      }

      setJobRoles((prev) => [duplicated, ...prev]);
      setActionNotice(`Duplicated "${role.title}" as new role`);
      setTimeout(() => setActionNotice(null), 3500);
    } catch (err) {
      console.warn('Duplicate error:', err);
    } finally {
      setDuplicatingId(null);
    }
  };

  const filteredRoles = useMemo(() => {
    return jobRoles.filter((role) => {
      const query = searchQuery.toLowerCase();
      const matchTitle = role.title.toLowerCase().includes(query);
      const matchDesc = role.description.toLowerCase().includes(query);
      const matchSkills = role.skills_required?.toLowerCase().includes(query);
      return matchTitle || matchDesc || matchSkills;
    });
  }, [jobRoles, searchQuery]);

  // Active roles set & lookup map (normalized with and without 'role-' prefix)
  const { activeRoleIds, roleLookupMap } = useMemo(() => {
    const set = new Set<string>();
    const map = new Map<string, JobRole>();
    jobRoles.forEach((r) => {
      const idStr = String(r.id).toLowerCase().trim();
      const idClean = idStr.replace(/^role-/, '');
      set.add(idStr);
      set.add(idClean);
      map.set(idStr, r);
      if (idClean) map.set(idClean, r);
    });
    return { activeRoleIds: set, roleLookupMap: map };
  }, [jobRoles]);

  const getRoleForSession = useCallback(
    (jobRoleId: string): JobRole | undefined => {
      const idStr = String(jobRoleId || '').toLowerCase().trim();
      return roleLookupMap.get(idStr) || roleLookupMap.get(idStr.replace(/^role-/, ''));
    },
    [roleLookupMap]
  );

  // Filter sessions so metrics ONLY account for currently active, non-deleted job roles!
  const activeSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (!s || !s.job_role_id) return false;
      const sessRoleId = String(s.job_role_id).toLowerCase().trim();
      const sessRoleClean = sessRoleId.replace(/^role-/, '');
      return activeRoleIds.has(sessRoleId) || (sessRoleClean.length > 0 && activeRoleIds.has(sessRoleClean));
    });
  }, [sessions, activeRoleIds]);

  // Metric Computations based strictly on active job roles
  const totalRoles = jobRoles.length;
  const completedSessions = activeSessions.filter((s) => s.status === 'submitted').length;
  const readyForReviewSessions = useMemo(
    () =>
      activeSessions.filter(
        (s) => s.status === 'submitted' && (!s.rating?.decision || s.rating.decision === 'pending')
      ),
    [activeSessions]
  );
  const inPipelineSessions = useMemo(
    () => activeSessions.filter((s) => s.status !== 'submitted'),
    [activeSessions]
  );
  const shortlistedSessions = useMemo(
    () => activeSessions.filter((s) => s.rating?.decision === 'shortlisted'),
    [activeSessions]
  );

  const readyForReviewCount = readyForReviewSessions.length;
  const inProgressSessions = inPipelineSessions.length;
  const shortlistedCount = shortlistedSessions.length;

  // Filtered candidates for the active KPI drill-down view
  const displayedCandidates = useMemo(() => {
    let baseList = activeSessions;
    if (activeKpiView === 'ready_for_review') {
      baseList = readyForReviewSessions;
    } else if (activeKpiView === 'in_pipeline') {
      baseList = inPipelineSessions;
    } else if (activeKpiView === 'shortlisted') {
      baseList = shortlistedSessions;
    }

    const q = candidateSearchQuery.toLowerCase().trim();
    const roleFilterNorm = candidateRoleFilter.toLowerCase().trim();
    const roleFilterClean = roleFilterNorm.replace(/^role-/, '');

    return baseList
      .filter((s) => {
        const matchedRole = getRoleForSession(s.job_role_id);
        if (candidateRoleFilter !== 'all') {
          const sRoleNorm = String(s.job_role_id || '').toLowerCase().trim();
          const sRoleClean = sRoleNorm.replace(/^role-/, '');
          if (sRoleNorm !== roleFilterNorm && sRoleClean !== roleFilterClean) {
            return false;
          }
        }
        if (!q) return true;
        const name = (s.candidate_name || '').toLowerCase();
        const email = (s.candidate_email || '').toLowerCase();
        const candId = (s.candidate_id || '').toLowerCase();
        const roleTitle = (matchedRole?.title || '').toLowerCase();
        const company = (matchedRole?.company_name || '').toLowerCase();
        return (
          name.includes(q) ||
          email.includes(q) ||
          candId.includes(q) ||
          roleTitle.includes(q) ||
          company.includes(q)
        );
      })
      .sort((a, b) => {
        const tA = new Date(a.submitted_at || a.created_at || 0).getTime();
        const tB = new Date(b.submitted_at || b.created_at || 0).getTime();
        return tB - tA;
      });
  }, [
    activeKpiView,
    activeSessions,
    readyForReviewSessions,
    inPipelineSessions,
    shortlistedSessions,
    candidateSearchQuery,
    candidateRoleFilter,
    getRoleForSession,
  ]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <div className="text-sm font-medium">Authenticating recruiter session...</div>
      </div>
    );
  }

  if (!user) return null;


  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <DashboardNav activeTab="roles" />

      <main className="flex-1 max-w-7xl 2xl:max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Supabase Cloud Connection & Storage Diagnostic Status */}
        <SupabaseDiagnosticBanner />

        {/* Hero Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 p-6 sm:p-8 rounded-2xl border border-slate-800 shadow-xl">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Video & Conversational Screening</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Recruiter Command Center
            </h1>
            <p className="text-sm text-slate-400 max-w-3xl leading-relaxed">
              Create job roles, generate AI or custom candidate interview links, and review recorded answers with automated transcripts and verdicts.
            </p>
          </div>

          <div className="flex items-center shrink-0">
            <Link
              href="/dashboard/new-job-role"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4" />
              <span>New Job Role</span>
            </Link>
          </div>
        </div>

        {actionNotice && (
          <div className="p-3.5 bg-emerald-950/40 border border-emerald-800 rounded-xl text-xs sm:text-sm text-emerald-300 flex items-center justify-between animate-in fade-in duration-200">
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              {actionNotice}
            </span>
            <button
              onClick={() => setActionNotice(null)}
              className="text-emerald-400 hover:text-emerald-200 text-xs font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Interactive KPI Metrics Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            type="button"
            onClick={() => setActiveKpiView('roles')}
            className={`text-left rounded-xl p-4 sm:p-5 border transition-all cursor-pointer group ${
              activeKpiView === 'roles'
                ? 'bg-blue-950/25 border-blue-500/70 ring-1 ring-blue-500/40 shadow-lg shadow-blue-500/10'
                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
            }`}
          >
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider group-hover:text-slate-200 transition-colors">
                Active Roles
              </span>
              <Briefcase className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white tabular-nums">{totalRoles}</div>
            <div className="text-xs text-slate-500 mt-1">Open hiring positions</div>
          </button>

          <button
            type="button"
            onClick={() =>
              setActiveKpiView((prev) => (prev === 'ready_for_review' ? 'roles' : 'ready_for_review'))
            }
            className={`text-left rounded-xl p-4 sm:p-5 border transition-all cursor-pointer group ${
              activeKpiView === 'ready_for_review'
                ? 'bg-emerald-950/25 border-emerald-500/70 ring-1 ring-emerald-500/40 shadow-lg shadow-emerald-500/10'
                : 'bg-slate-900/80 border-slate-800 hover:border-emerald-800/70 hover:bg-slate-900'
            }`}
          >
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider group-hover:text-slate-200 transition-colors">
                Ready for Review
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400 tabular-nums">
              {readyForReviewCount}
            </div>
            <div className="text-xs text-slate-500 mt-1">{completedSessions} total submitted</div>
          </button>

          <button
            type="button"
            onClick={() =>
              setActiveKpiView((prev) => (prev === 'in_pipeline' ? 'roles' : 'in_pipeline'))
            }
            className={`text-left rounded-xl p-4 sm:p-5 border transition-all cursor-pointer group ${
              activeKpiView === 'in_pipeline'
                ? 'bg-amber-950/25 border-amber-500/70 ring-1 ring-amber-500/40 shadow-lg shadow-amber-500/10'
                : 'bg-slate-900/80 border-slate-800 hover:border-amber-800/70 hover:bg-slate-900'
            }`}
          >
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider group-hover:text-slate-200 transition-colors">
                In Pipeline
              </span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-400 tabular-nums">
              {inProgressSessions}
            </div>
            <div className="text-xs text-slate-500 mt-1">Candidates in progress</div>
          </button>

          <button
            type="button"
            onClick={() =>
              setActiveKpiView((prev) => (prev === 'shortlisted' ? 'roles' : 'shortlisted'))
            }
            className={`text-left rounded-xl p-4 sm:p-5 border transition-all cursor-pointer group ${
              activeKpiView === 'shortlisted'
                ? 'bg-purple-950/25 border-purple-500/70 ring-1 ring-purple-500/40 shadow-lg shadow-purple-500/10'
                : 'bg-slate-900/80 border-slate-800 hover:border-purple-800/70 hover:bg-slate-900'
            }`}
          >
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider group-hover:text-slate-200 transition-colors">
                Shortlisted
              </span>
              <TrendingUp className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-purple-400 tabular-nums">
              {shortlistedCount}
            </div>
            <div className="text-xs text-slate-500 mt-1">Advanced to next round</div>
          </button>
        </div>

        {/* Workspace Section: Either Job Roles Grid OR Cross-Role Candidate Drill-Down List */}
        {activeKpiView !== 'roles' ? (
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5 animate-in fade-in duration-150">
            {/* Cross-Role Candidate Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg sm:text-xl font-bold text-white">
                    {activeKpiView === 'ready_for_review'
                      ? 'Ready for Review Candidates'
                      : activeKpiView === 'in_pipeline'
                      ? 'In Pipeline Candidates'
                      : activeKpiView === 'shortlisted'
                      ? 'Shortlisted Candidates'
                      : 'All Candidates'}
                  </h2>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-200 border border-slate-700 tabular-nums">
                    {displayedCandidates.length}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {activeKpiView === 'ready_for_review'
                    ? 'Completed interviews awaiting your final review and decision across all job roles.'
                    : activeKpiView === 'in_pipeline'
                    ? 'Candidates with active interview links who have not submitted yet.'
                    : activeKpiView === 'shortlisted'
                    ? 'Top candidates advanced to the next round across all open roles.'
                    : 'All candidate interview sessions across your active job roles.'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveKpiView('roles')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors self-start sm:self-auto cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Job Roles</span>
              </button>
            </div>

            {/* Filter Pills + Role Filter + Search */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/80 border border-slate-800 rounded-xl p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveKpiView('ready_for_review')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                    activeKpiView === 'ready_for_review'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Ready for Review ({readyForReviewCount})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveKpiView('in_pipeline')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                    activeKpiView === 'in_pipeline'
                      ? 'bg-amber-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  In Pipeline ({inProgressSessions})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveKpiView('shortlisted')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                    activeKpiView === 'shortlisted'
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Shortlisted ({shortlistedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveKpiView('all_candidates')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                    activeKpiView === 'all_candidates'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All ({activeSessions.length})
                </button>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <select
                  value={candidateRoleFilter}
                  onChange={(e) => setCandidateRoleFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
                >
                  <option value="all">All Job Roles ({jobRoles.length})</option>
                  {jobRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={candidateSearchQuery}
                    onChange={(e) => setCandidateSearchQuery(e.target.value)}
                    placeholder="Search candidate or role..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Candidate Rows */}
            {loading ? (
              <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Loading candidates...</span>
              </div>
            ) : displayedCandidates.length === 0 ? (
              <div className="bg-slate-950/50 border border-dashed border-slate-800 rounded-2xl p-10 text-center space-y-3">
                <div className="w-11 h-11 rounded-2xl bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div className="text-sm font-semibold text-white">No candidates in this view</div>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  {candidateSearchQuery || candidateRoleFilter !== 'all'
                    ? 'Try clearing your search or job role filter.'
                    : 'No candidate sessions currently match this status across your active job roles.'}
                </p>
                <div className="flex items-center justify-center gap-2 pt-1">
                  {(candidateSearchQuery || candidateRoleFilter !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setCandidateSearchQuery('');
                        setCandidateRoleFilter('all');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors"
                    >
                      Clear Filters
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveKpiView('roles')}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors"
                  >
                    View Job Roles
                  </button>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-xl bg-slate-950/60 overflow-hidden">
                {displayedCandidates.map((s) => {
                  const matchedRole = getRoleForSession(s.job_role_id);
                  const displayName =
                    s.candidate_name ||
                    (s.candidate_id ? `Candidate ${s.candidate_id.slice(0, 8)}` : `Candidate ${s.id.slice(0, 8)}`);
                  const isSubmitted = s.status === 'submitted';
                  const decision = s.rating?.decision;
                  const isConversational = s.mode === 'conversational';
                  const isManual = s.question_source === 'manual';
                  const dateValue = s.submitted_at || s.created_at;

                  return (
                    <div
                      key={s.id}
                      className="p-4 sm:px-5 hover:bg-slate-900/70 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      {/* Candidate Identity */}
                      <div className="flex items-center gap-3 min-w-0 lg:w-[28%]">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                          {displayName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white truncate">
                            {displayName}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {s.candidate_email || (s.candidate_id ? `ID: ${s.candidate_id}` : `Session: ${s.id.slice(0, 8)}`)}
                          </div>
                        </div>
                      </div>

                      {/* Job Role & Company */}
                      <div className="flex flex-wrap items-center gap-2 lg:w-[28%]">
                        {matchedRole ? (
                          <Link
                            href={`/dashboard/job-roles/${matchedRole.id}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-blue-300 hover:text-blue-200 transition-colors"
                          >
                            <Briefcase className="w-3 h-3 text-blue-400 shrink-0" />
                            <span className="truncate max-w-[180px]">{matchedRole.title}</span>
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400">Job Role</span>
                        )}
                        {matchedRole?.company_name && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-[11px] text-slate-400">
                            <Building2 className="w-3 h-3 text-slate-500" />
                            {matchedRole.company_name}
                          </span>
                        )}
                      </div>

                      {/* Mode & Verdict Status */}
                      <div className="flex flex-wrap items-center gap-2 lg:w-[24%]">
                        {isConversational ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800/80 text-[11px] font-medium text-emerald-300">
                            <Bot className="w-3 h-3 text-emerald-400" />
                            Conversational
                          </span>
                        ) : isManual ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-950/60 border border-purple-800/80 text-[11px] font-medium text-purple-300">
                            <ListPlus className="w-3 h-3 text-purple-400" />
                            Custom
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-950/60 border border-blue-800/80 text-[11px] font-medium text-blue-300">
                            <Sparkles className="w-3 h-3 text-blue-400" />
                            AI Video
                          </span>
                        )}

                        {decision === 'shortlisted' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-950/70 border border-purple-700/80 text-[11px] font-semibold text-purple-300">
                            <Star className="w-3 h-3 text-purple-400 fill-purple-400" />
                            Shortlisted
                          </span>
                        ) : decision === 'hold' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-950/70 border border-amber-700/80 text-[11px] font-semibold text-amber-300">
                            <Clock className="w-3 h-3 text-amber-400" />
                            On Hold
                          </span>
                        ) : decision === 'declined' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-950/70 border border-red-800/80 text-[11px] font-semibold text-red-300">
                            Declined
                          </span>
                        ) : isSubmitted ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-700/80 text-[11px] font-semibold text-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            Ready for Review
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[11px] font-medium text-amber-300">
                            <Clock className="w-3 h-3 text-amber-400" />
                            In Pipeline
                          </span>
                        )}
                      </div>

                      {/* Date + Review CTA */}
                      <div className="flex items-center justify-between lg:justify-end gap-3 lg:w-[20%] shrink-0">
                        {dateValue && (
                          <span className="text-[11px] text-slate-500 tabular-nums">
                            {new Date(dateValue).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        )}
                        <Link
                          href={`/dashboard/sessions/${s.id}`}
                          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                            isSubmitted
                              ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-500/20'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                          }`}
                        >
                          <span>{isSubmitted ? 'Review Submission' : 'View Session'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
        /* Roles List & Controls */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white">Your Job Roles</h2>
              <p className="text-xs text-slate-400">
                Manage roles, configure interview questions, and evaluate candidate submissions.
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search roles or skills..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {loading ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading job roles and candidates...</span>
            </div>
          ) : filteredRoles.length === 0 ? (
            <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                <Briefcase className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-base font-semibold text-white">
                  {searchQuery ? 'No matching job roles found' : 'No job roles created yet'}
                </h3>
                <p className="text-xs text-slate-400">
                  {searchQuery
                    ? 'Try searching with a different keyword or skill name.'
                    : 'Create your first job role to generate candidate interview links.'}
                </p>
              </div>
              {!searchQuery && (
                <Link
                  href="/dashboard/new-job-role"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-medium rounded-xl transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Job Role</span>
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredRoles.map((role) => {
                const skills = role.skills_required
                  ? role.skills_required.split(',').map((s) => s.trim())
                  : [];

                return (
                  <div
                    key={role.id}
                    className="bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 sm:p-6 transition-all flex flex-col justify-between group shadow-sm"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0 pr-2">
                          <Link
                            href={`/dashboard/job-roles/${role.id}`}
                            className="font-bold text-lg text-white group-hover:text-blue-400 transition-colors line-clamp-1"
                          >
                            {role.title}
                          </Link>
                          <div className="text-xs text-slate-500 mt-0.5">
                            Created {new Date(role.created_at).toLocaleDateString()}
                          </div>
                        </div>

                        {/* Top action pill & buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setRoleToEdit(role)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition-colors"
                            title="Edit job role"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDuplicateRole(role)}
                            disabled={duplicatingId === role.id}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-colors disabled:opacity-50"
                            title="Duplicate and reuse role"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => setRoleToDelete(role)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                            title="Delete role"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs sm:text-sm text-slate-300 line-clamp-2 leading-relaxed">
                        {role.description}
                      </p>

                      {skills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {skills.slice(0, 4).map((skill, i) => (
                            <span
                              key={i}
                              className="text-[11px] bg-slate-950 text-slate-300 border border-slate-800 px-2 py-0.5 rounded-full"
                            >
                              {skill}
                            </span>
                          ))}
                          {skills.length > 4 && (
                            <span className="text-[11px] text-slate-500 px-1 py-0.5">
                              +{skills.length - 4} more
                            </span>
                          )}
                        </div>
                      )}

                      {/* Live Interview Status Badge */}
                      {(() => {
                        const roleIdStr = String(role.id).toLowerCase().trim();
                        const roleIdClean = roleIdStr.replace(/^role-/, '');
                        const roleSessions = sessions.filter((s) => {
                          if (!s) return false;
                          const sessRoleId = s.job_role_id ? String(s.job_role_id).toLowerCase().trim() : '';
                          const sessRoleClean = sessRoleId.replace(/^role-/, '');
                          return sessRoleId === roleIdStr || (sessRoleClean.length > 0 && sessRoleClean === roleIdClean);
                        });
                        const shortlisted = roleSessions.filter((s) => s.rating?.decision === 'shortlisted').length;
                        const onHold = roleSessions.filter((s) => s.rating?.decision === 'hold').length;
                        const readyForReview = roleSessions.filter(
                          (s) => s.status === 'submitted' && (!s.rating?.decision || s.rating.decision === 'pending')
                        ).length;
                        const inProgress = roleSessions.filter((s) => s.status !== 'submitted').length;

                        return (
                          <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
                            {readyForReview > 0 && (
                              <span className="text-[11px] px-2.5 py-0.5 rounded-full border bg-emerald-950/60 text-emerald-300 border-emerald-800 font-medium flex items-center gap-1 shadow-sm">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                <span>{readyForReview} Ready for Review</span>
                              </span>
                            )}
                            {shortlisted > 0 && (
                              <span className="text-[11px] px-2.5 py-0.5 rounded-full border bg-purple-950/60 text-purple-300 border-purple-800 font-semibold flex items-center gap-1 shadow-sm">
                                <Star className="w-3 h-3 text-purple-400 fill-purple-400" />
                                <span>{shortlisted} Shortlisted</span>
                              </span>
                            )}
                            {onHold > 0 && (
                              <span className="text-[11px] px-2.5 py-0.5 rounded-full border bg-amber-950/60 text-amber-300 border-amber-800 font-medium flex items-center gap-1 shadow-sm">
                                <Clock className="w-3 h-3 text-amber-400" />
                                <span>{onHold} On Hold</span>
                              </span>
                            )}
                            {inProgress > 0 && (
                              <span className="text-[11px] px-2.5 py-0.5 rounded-full border bg-slate-800 text-slate-400 border-slate-700 font-medium flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                <span>{inProgress} In Progress</span>
                              </span>
                            )}
                            {roleSessions.length === 0 && (
                              <span className="text-[11px] text-slate-500">No candidates yet</span>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="pt-5 mt-5 border-t border-slate-800/80 flex items-center justify-between gap-3">
                      <Link
                        href={`/dashboard/job-roles/${role.id}#generate-link`}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 py-1 px-2.5 rounded-lg hover:bg-blue-950/40 transition-colors"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        <span>Get Candidate Link</span>
                      </Link>

                      <Link
                        href={`/dashboard/job-roles/${role.id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-lg transition-colors"
                      >
                        <span>View Candidates</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        )}
      </main>

      {/* Edit Job Role Modal */}
      <EditJobRoleModal
        isOpen={Boolean(roleToEdit)}
        onClose={() => setRoleToEdit(null)}
        role={roleToEdit}
        onSaved={(updated) => {
          setJobRoles((prev) =>
            prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r))
          );
          setActionNotice(`Updated role "${updated.title}"`);
          setTimeout(() => setActionNotice(null), 3000);
        }}
      />

      {/* Delete Confirmation Modal */}
      <DeleteJobRoleModal
        isOpen={Boolean(roleToDelete)}
        onClose={() => setRoleToDelete(null)}
        role={roleToDelete}
        onDeleted={(deletedId) => {
          const deletedIdStr = String(deletedId).toLowerCase().trim();
          const deletedIdClean = deletedIdStr.replace(/^role-/, '');

          setJobRoles((prev) =>
            prev.filter((r) => {
              const rId = String(r.id).toLowerCase().trim();
              return rId !== deletedIdStr && rId.replace(/^role-/, '') !== deletedIdClean;
            })
          );
          setSessions((prev) =>
            prev.filter((s) => {
              if (!s.job_role_id) return true;
              const sRoleId = String(s.job_role_id).toLowerCase().trim();
              return sRoleId !== deletedIdStr && sRoleId.replace(/^role-/, '') !== deletedIdClean;
            })
          );
          setActionNotice('Job role and associated candidate sessions deleted successfully');
          setTimeout(() => setActionNotice(null), 3000);
        }}
      />
    </div>
  );
}