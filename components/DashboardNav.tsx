'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Sparkles, Briefcase, LogOut, Plus } from 'lucide-react';

export function DashboardNav({ activeTab = 'roles' }: { activeTab?: 'roles' | 'new-role' }) {
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-bold text-lg text-white tracking-tight">
                <span>QuestAI</span>
                <span className="text-[10px] uppercase font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded">
                  Recruiter
                </span>
              </div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
            <Link
              href="/dashboard"
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 ${
                activeTab === 'roles'
                  ? 'bg-slate-900 text-white font-semibold border border-slate-800'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Briefcase className="w-4 h-4 text-blue-400" />
              Job Roles
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/new-job-role"
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-medium rounded-lg shadow-sm shadow-blue-500/20 transition-all hover:shadow-blue-500/30"
          >
            <Plus className="w-4 h-4" />
            <span>New Job Role</span>
          </Link>

          <div className="h-5 w-px bg-slate-800 hidden sm:block" />

          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-lg transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
