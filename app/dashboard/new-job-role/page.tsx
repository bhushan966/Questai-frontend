'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { authedFetch } from '@/lib/api';
import Link from 'next/link';
import { API_URL } from '@/lib/config';
import { DashboardNav } from '@/components/DashboardNav';
import {
  ArrowLeft,
  Briefcase,
  Sparkles,
  AlertCircle,
  Check,
} from 'lucide-react';

const SUGGESTED_SKILLS = [
  'React',
  'TypeScript',
  'Next.js',
  'Node.js',
  'Python',
  'FastAPI',
  'SQL',
  'PostgreSQL',
  'AWS',
  'Docker',
  'LLMs',
  'Tailwind CSS',
];

export default function NewJobRolePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [skillsRequired, setSkillsRequired] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center">
        Checking authentication...
      </div>
    );
  }

  if (!user) return null;

  const handleAddSuggestedSkill = (skill: string) => {
    const current = skillsRequired
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (current.includes(skill)) {
      setSkillsRequired(current.filter((s) => s !== skill).join(', '));
    } else {
      setSkillsRequired([...current, skill].join(', '));
    }
  };

  const isSkillSelected = (skill: string) => {
    const current = skillsRequired
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return current.includes(skill.toLowerCase());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Job title is required');
      return;
    }

    setSubmitting(true);
    setError(null);

    let newRoleId = `role-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newJobRole = {
      id: newRoleId,
      title: title.trim(),
      description: description.trim(),
      skills_required: skillsRequired.trim() || null,
      created_at: new Date().toISOString(),
    };

    // 1. Immediately persist in browser storage so it is never lost
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('questai_saved_roles');
        const roles = stored ? JSON.parse(stored) : [];
        const existingFiltered = roles.filter((r: any) => r.id !== newRoleId);
        localStorage.setItem('questai_saved_roles', JSON.stringify([newJobRole, ...existingFiltered]));
      } catch (e) {
        console.warn('Storage save notice:', e);
      }
    }

    // 2. Sync to server API (FastAPI backend on Render or fallback)
    try {
      const postUrl = API_URL.startsWith('http') ? `${API_URL}/job-roles/` : `${API_URL}/job-roles`;
      const res = await authedFetch(postUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newJobRole.title,
          description: newJobRole.description,
          skills_required: newJobRole.skills_required,
        }),
      });

      if (res && res.ok) {
        const createdRole = await res.json().catch(() => null);
        if (createdRole?.id) {
          newRoleId = String(createdRole.id);
          newJobRole.id = newRoleId;
          // Update local storage with real backend UUID
          if (typeof window !== 'undefined') {
            try {
              const stored = localStorage.getItem('questai_saved_roles');
              const roles = stored ? JSON.parse(stored) : [];
              const updated = [newJobRole, ...roles.filter((r: any) => r.id !== newRoleId && r.title !== newJobRole.title)];
              localStorage.setItem('questai_saved_roles', JSON.stringify(updated));
            } catch {}
          }
        }
      }
    } catch (syncErr) {
      console.warn('Backend sync deferred:', syncErr);
    }

    // 3. Trigger AI question generation
    try {
      await authedFetch(`${API_URL}/job-roles/${newRoleId}/generate-questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newJobRole.title,
          skills_required: newJobRole.skills_required,
        }),
      });
    } catch (genErr) {
      console.warn('AI question generation notice:', genErr);
    }

    // 4. Navigate seamlessly to the newly created job role
    router.push(`/dashboard/job-roles/${newRoleId}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <DashboardNav activeTab="new-role" />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-xs sm:text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to job roles</span>
        </Link>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="space-y-1.5 border-b border-slate-800 pb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
                <Briefcase className="w-4 h-4" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Create New Job Role
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              QuestAI will automatically generate customized interview questions tailored to your job description and required competencies.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Job Title <span className="text-blue-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Senior Frontend Engineer or Backend AI Developer"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Job Description <span className="text-blue-400">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Describe role responsibilities, team context, key problems to solve, and seniority expectations..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Key Skills & Technologies (Comma-separated)
              </label>
              <input
                type="text"
                value={skillsRequired}
                onChange={(e) => setSkillsRequired(e.target.value)}
                placeholder="e.g. React, TypeScript, Next.js, Node.js"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
              />

              {/* Clickable Suggested Skills */}
              <div className="pt-1.5 space-y-1.5">
                <span className="text-[11px] text-slate-500 font-medium">Quick suggestions:</span>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTED_SKILLS.map((skill) => {
                    const active = isSkillSelected(skill);
                    return (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => handleAddSuggestedSkill(skill)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1 ${
                          active
                            ? 'bg-blue-600/30 text-blue-300 border-blue-500/50'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        {active && <Check className="w-3 h-3 text-blue-400" />}
                        <span>{skill}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-950/40 border border-red-900 rounded-xl text-xs text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Creating role & generating AI questions...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Create Job Role & Generate AI Questions</span>
                </>
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
