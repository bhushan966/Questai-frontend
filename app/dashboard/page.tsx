'use client';

import { useEffect, useState, useMemo } from 'react';
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
  job_role_id: string;
  status: string;
  mode?: string;
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

  // Active roles set for lookup (normalized with and without 'role-' prefix)
  const activeRoleIds = useMemo(() => {
    const set = new Set<string>();
    jobRoles.forEach((r) => {
      const idStr = String(r.id).toLowerCase().trim();
      set.add(idStr);
      set.add(idStr.replace(/^role-/, ''));
    });
    return set;
  }, [jobRoles]);

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
  const readyForReviewCount = activeSessions.filter(
    (s) => s.status === 'submitted' && (!s.rating?.decision || s.rating.decision === 'pending')
  ).length;
  const inProgressSessions = activeSessions.filter((s) => s.status !== 'submitted').length;
  const shortlistedCount = activeSessions.filter((s) => s.rating?.decision === 'shortlisted').length;

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

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
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
            <p className="text-sm text-slate-400 max-w-xl">
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

        {/* KPI Metrics Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 sm:p-5">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Active Roles</span>
              <Briefcase className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white tabular-nums">{totalRoles}</div>
            <div className="text-xs text-slate-500 mt-1">Open hiring positions</div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 sm:p-5">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Ready for Review</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400 tabular-nums">
              {readyForReviewCount}
            </div>
            <div className="text-xs text-slate-500 mt-1">{completedSessions} total submitted</div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 sm:p-5">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">In Pipeline</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-400 tabular-nums">
              {inProgressSessions}
            </div>
            <div className="text-xs text-slate-500 mt-1">Candidates in progress</div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 sm:p-5">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Shortlisted</span>
              <TrendingUp className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-purple-400 tabular-nums">
              {shortlistedCount}
            </div>
            <div className="text-xs text-slate-500 mt-1">Advanced to next round</div>
          </div>
        </div>

        {/* Roles List & Controls */}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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