'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { authedFetch } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/config';



interface JobRole {
  id: string;
  title: string;
  description: string;
  skills_required: string | null;
  created_at: string;
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    authedFetch(`${API_URL}/job-roles/`)
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data)) {
          setJobRoles([]);
          setLoading(false);
          return;
        }
        setJobRoles(data);
        setLoading(false);
      });
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (authLoading) return <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center">Checking login...</div>;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-4xl mx-auto p-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Job Roles</h1>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/new-job-role"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 transition-colors text-white font-medium rounded-lg text-sm"
            >
              + New Job Role
            </Link>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 transition-colors text-slate-300 font-medium rounded-lg text-sm"
            >
              Log out
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-slate-400">Loading job roles...</div>
        ) : jobRoles.length === 0 ? (
          <div className="border border-dashed border-slate-800 rounded-xl p-12 text-center text-slate-500">
            No job roles yet — create your first one to get started.
          </div>
        ) : (
          <div className="grid gap-3">
            {jobRoles.map((role) => (
              <Link
                key={role.id}
                href={`/dashboard/job-roles/${role.id}`}
                className="block p-5 bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors rounded-xl"
              >
                <div className="font-semibold text-lg text-white">{role.title}</div>
                <div className="text-sm text-slate-400 mt-1 line-clamp-2">{role.description}</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}