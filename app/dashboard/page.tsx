'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { authedFetch } from '@/lib/api';
import { API_URL } from '@/lib/config';
import { DashboardNav } from '@/components/DashboardNav';
import { GenerateLinkModal } from '@/components/GenerateLinkModal';
import { EditJobRoleModal } from '@/components/EditJobRoleModal';
import { DeleteJobRoleModal } from '@/components/DeleteJobRoleModal';
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalRoleId, setModalRoleId] = useState<string | undefined>(undefined);
  const [roleToEdit, setRoleToEdit] = useState<JobRole | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<JobRole | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    async function loadDashboard() {
      // 1. Instantly read locally saved roles for immediate UI feedback
      let localRoles: JobRole[] = [];
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem('questai_saved_roles');
          if (stored) {
            localRoles = JSON.parse(stored);
            if (isMounted && localRoles.length > 0) {
              setJobRoles(localRoles);
            }
          }
        } catch {
          // ignore
        }
      }

      try {
        const [rolesRes, sessionsRes] = await Promise.all([
          authedFetch(`${API_URL}/job-roles`).catch(() => null),
          fetch(`${API_URL}/sessions`).catch(() => null),
        ]);

        let apiRoles: JobRole[] = [];
        if (rolesRes && rolesRes.ok) {
          apiRoles = await rolesRes.json().catch(() => []);
        }

        // Merge: locally created roles first, then any API roles not already present
        const mergedMap = new Map<string, JobRole>();
        localRoles.forEach((r) => mergedMap.set(r.id, r));
        if (Array.isArray(apiRoles)) {
          apiRoles.forEach((r) => {
            if (!mergedMap.has(r.id)) {
              mergedMap.set(r.id, r);
            }
          });
        }
        const combinedRoles = Array.from(mergedMap.values());

        let sessionsData: SessionSummary[] = [];
        if (sessionsRes && sessionsRes.ok) {
          sessionsData = await sessionsRes.json().catch(() => []);
        }

        if (isMounted) {
          setJobRoles(combinedRoles);
          setSessions(Array.isArray(sessionsData) ? sessionsData : []);
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

  const openGenerateModalForRole = (roleId?: string) => {
    setModalRoleId(roleId);
    setIsModalOpen(true);
  };

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
      await authedFetch(`${API_URL}/job-roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(duplicated),
      });

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

  // Metric Computations
  const totalRoles = jobRoles.length;
  const completedSessions = sessions.filter((s) => s.status === 'submitted').length;
  const inProgressSessions = sessions.filter((s) => s.status !== 'submitted').length;
  const shortlistedCount = sessions.filter((s) => s.rating?.decision === 'shortlisted').length;

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

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => openGenerateModalForRole()}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-medium rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02]"
            >
              <Link2 className="w-4 h-4" />
              <span>Generate Interview Link</span>
            </button>
            <Link
              href="/dashboard/new-job-role"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-xl border border-slate-700 transition-colors"
            >
              <Plus className="w-4 h-4 text-blue-400" />
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
              <span className="text-xs font-semibold uppercase tracking-wider">Completed</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400 tabular-nums">
              {completedSessions}
            </div>
            <div className="text-xs text-slate-500 mt-1">Ready for recruiter review</div>
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
                    </div>

                    <div className="pt-5 mt-5 border-t border-slate-800/80 flex items-center justify-between gap-3">
                      <button
                        onClick={() => openGenerateModalForRole(role.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 py-1 px-2.5 rounded-lg hover:bg-blue-950/40 transition-colors"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        <span>Get Candidate Link</span>
                      </button>

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

      {/* Universal Link Generator Modal */}
      <GenerateLinkModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        jobRoles={jobRoles}
        preselectedRoleId={modalRoleId}
      />

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
          setJobRoles((prev) => prev.filter((r) => r.id !== deletedId));
          setActionNotice('Job role deleted successfully');
          setTimeout(() => setActionNotice(null), 3000);
        }}
      />
    </div>
  );
}