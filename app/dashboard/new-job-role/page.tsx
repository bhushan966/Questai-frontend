'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { authedFetch } from '@/lib/api';
import Link from 'next/link';
import { API_URL } from '@/lib/config';

export default function NewJobRolePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [skillsRequired, setSkillsRequired] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (authLoading) return <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center">Checking login...</div>;
  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const createRes = await authedFetch('${API_URL}/job-roles/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, skills_required: skillsRequired }),
      });
      if (!createRes.ok) throw new Error('Failed to create job role');
      const jobRole = await createRes.json();

      const genRes = await authedFetch(`${API_URL}/job-roles/${jobRole.id}/generate-questions`, {
        method: 'POST',
      });
      if (!genRes.ok) throw new Error('Job role created, but question generation failed');

      router.push(`/dashboard/job-roles/${jobRole.id}`);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-xl mx-auto p-8 space-y-6">
        <Link href="/dashboard" className="text-sm text-slate-400 hover:text-slate-200">
          ← Back to job roles
        </Link>
        <h1 className="text-2xl font-bold">Create Job Role</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5 text-slate-300">Job Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-600"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-slate-300">Job Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-600"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-slate-300">Skills Required</label>
            <input
              type="text"
              value={skillsRequired}
              onChange={(e) => setSkillsRequired(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-600"
              placeholder="e.g. Python, SQL, AWS"
            />
          </div>
          {error && <div className="text-red-400 text-sm">{error}</div>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors text-white font-medium rounded-lg"
          >
            {submitting ? 'Creating & generating questions...' : 'Create Job Role'}
          </button>
        </form>
      </div>
    </div>
  );
}