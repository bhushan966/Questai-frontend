'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Sparkles,
  Briefcase,
  LogOut,
  Bell,
  CheckCheck,
  Mail,
  ArrowRight,
  ChevronDown,
  Building2,
} from 'lucide-react';

function formatTimeAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export interface NotificationItem {
  id: string;
  session_id: string;
  candidate_name: string;
  job_role_id: string;
  job_role_title: string;
  company_name?: string | null;
  submitted_at: string;
  read: boolean;
}

export function DashboardNav({ activeTab = 'roles' }: { activeTab?: 'roles' | 'new-role' }) {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Load user details
  useEffect(() => {
    supabase.auth.getUser().then((res: any) => {
      if (res?.data?.user) {
        if (res.data.user.email) setUserEmail(res.data.user.email);
        if (res.data.user.user_metadata?.company_name) {
          setCompanyName(res.data.user.user_metadata.company_name);
        }
      }
    });

    if (typeof window !== 'undefined') {
      const storedComp = localStorage.getItem('questai_user_company');
      if (storedComp) setCompanyName(storedComp);
    }
  }, []);

  // Fetch notifications from server and localStorage
  const loadNotifications = async () => {
    let serverNotifs: NotificationItem[] = [];
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.notifications)) {
          serverNotifs = data.notifications;
        }
      }
    } catch {}

    let localNotifs: NotificationItem[] = [];
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('questai_notifications');
        if (stored) {
          localNotifs = JSON.parse(stored);
        }
      } catch {}
    }

    // Combine, purge any test alerts, and deduplicate by session_id
    const map = new Map<string, NotificationItem>();
    [...localNotifs, ...serverNotifs].forEach((n) => {
      const isTestAlert =
        n?.session_id?.startsWith('sess-test-') ||
        n?.id?.startsWith('notif-test-') ||
        n?.candidate_name === 'Alex Rivera';
      if (n && n.session_id && !isTestAlert && !map.has(n.session_id)) {
        map.set(n.session_id, n);
      }
    });

    const list = Array.from(map.values()).sort(
      (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
    );

    setNotifications(list);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('questai_notifications', JSON.stringify(list));
      } catch {}
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 8000);
    return () => clearInterval(interval);
  }, []);

  // Close popover when clicked outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    if (isNotifOpen || isProfileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNotifOpen, isProfileOpen]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = async () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('questai_notifications', JSON.stringify(updated));
    }
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      });
    } catch {}
  };

  const getEmailAlertUrl = (notif: NotificationItem) => {
    const subject = `New candidate submission received for ${notif.job_role_title}`;
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://questai.app';
    const reviewUrl = `${baseUrl}/dashboard/sessions/${notif.session_id}`;

    const body = `Hi Recruiter,

A new candidate has submitted their video interview on QuestAI!

📋 Candidate Details:
• Candidate Name: ${notif.candidate_name}
• Job Role: ${notif.job_role_title}
• Organization: ${notif.company_name || 'QuestAI'}
• Submitted At: ${new Date(notif.submitted_at).toLocaleString()}

👉 Review Video Answers & AI Evaluation:
${reviewUrl}

Status: Ready for technical & communication review.

Best regards,
QuestAI Submission Alert System`;

    return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
      userEmail || ''
    )}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl 2xl:max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
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
              <span>Job Roles</span>
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Notification Bell with Badge */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setIsNotifOpen((prev) => !prev)}
              className={`relative p-2 rounded-xl border transition-all ${
                isNotifOpen
                  ? 'bg-blue-600/20 border-blue-500/50 text-blue-400'
                  : 'bg-slate-900/80 hover:bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
              }`}
              title="Submission alerts & notifications"
              aria-label="Submission notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-gradient-to-r from-blue-600 to-indigo-600 border border-slate-950 text-white font-bold text-[10px] rounded-full flex items-center justify-center animate-pulse shadow-md shadow-blue-500/40">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown Drawer */}
            {isNotifOpen && (
              <div className="absolute right-0 mt-2.5 w-80 sm:w-96 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
                {/* Popover Header */}
                <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                      <Bell className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-sm font-bold text-white">Submission Alerts</span>
                    {unreadCount > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800 font-semibold">
                        {unreadCount} new
                      </span>
                    )}
                  </div>

                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[11px] text-slate-400 hover:text-blue-400 transition-colors flex items-center gap-1 font-medium"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Mark all read</span>
                    </button>
                  )}
                </div>

                {/* Email Alert Setup Info Banner */}
                <div className="px-4 py-2.5 bg-blue-950/40 border-b border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-slate-300 min-w-0">
                    <Mail className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span className="truncate text-[11px]">
                      Alerts sent to: <strong className="text-white">{userEmail || 'recruiter'}</strong>
                    </span>
                  </div>
                </div>

                {/* Notification List */}
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/60">
                  {notifications.length > 0 ? (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`p-3.5 transition-colors flex items-start gap-3 hover:bg-slate-800/50 ${
                          !notif.read ? 'bg-blue-950/20' : ''
                        }`}
                      >
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                          {notif.candidate_name ? notif.candidate_name.charAt(0).toUpperCase() : 'C'}
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold text-white truncate">
                              {notif.candidate_name}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono shrink-0">
                              {formatTimeAgo(notif.submitted_at)}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-300 leading-snug">
                            New submission received for{' '}
                            <span className="text-blue-300 font-medium">{notif.job_role_title}</span>
                          </p>

                          {notif.company_name && (
                            <div className="text-[10px] text-slate-500">
                              Organization: {notif.company_name}
                            </div>
                          )}

                          <div className="pt-1.5 flex items-center gap-2">
                            <Link
                              href={`/dashboard/sessions/${notif.session_id}`}
                              onClick={() => setIsNotifOpen(false)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                            >
                              <span>Review Submission</span>
                              <ArrowRight className="w-3 h-3" />
                            </Link>

                            <a
                              href={getEmailAlertUrl(notif)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 ml-auto"
                              title="Forward or preview submission alert email"
                            >
                              <Mail className="w-3 h-3 text-red-400" />
                              <span>Email Alert</span>
                            </a>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-center space-y-2">
                      <div className="w-10 h-10 rounded-2xl bg-slate-800/80 text-slate-400 flex items-center justify-center mx-auto">
                        <Bell className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-semibold text-slate-300">No candidate submissions yet</p>
                      <p className="text-[11px] text-slate-500 max-w-[220px] mx-auto leading-relaxed">
                        When candidates complete their video interviews, instant alerts and email notifications appear here.
                      </p>
                    </div>
                  )}
                </div>

                {/* Popover Footer */}
                <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1.5 text-slate-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Live submission alerts</span>
                  </span>

                  <Link
                    href="/dashboard"
                    onClick={() => setIsNotifOpen(false)}
                    className="text-slate-400 hover:text-blue-400 transition-colors font-medium"
                  >
                    View All Roles →
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Profile Avatar Dropdown Menu */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setIsProfileOpen((prev) => !prev)}
              className={`flex items-center gap-1.5 p-1 sm:pl-1.5 sm:pr-2.5 rounded-full border transition-all ${
                isProfileOpen
                  ? 'bg-slate-900 border-blue-500/50 ring-2 ring-blue-500/20'
                  : 'bg-slate-900/80 hover:bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
              title="Recruiter Account"
              aria-label="User menu"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 text-white font-bold flex items-center justify-center text-xs shadow-sm">
                {companyName
                  ? companyName.charAt(0).toUpperCase()
                  : userEmail
                  ? userEmail.charAt(0).toUpperCase()
                  : 'R'}
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${
                  isProfileOpen ? 'rotate-180 text-blue-400' : ''
                }`}
              />
            </button>

            {/* Profile Menu Popover */}
            {isProfileOpen && (
              <div className="absolute right-0 mt-2.5 w-72 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
                {/* User Identity Header */}
                <div className="p-4 border-b border-slate-800/80 bg-slate-950/70 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 text-white font-bold text-base flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20">
                      {companyName
                        ? companyName.charAt(0).toUpperCase()
                        : userEmail
                        ? userEmail.charAt(0).toUpperCase()
                        : 'R'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-white truncate">
                        {userEmail || 'Recruiter'}
                      </div>
                      {companyName ? (
                        <div className="flex items-center gap-1 text-[11px] text-blue-400 font-medium truncate mt-0.5">
                          <Building2 className="w-3 h-3 shrink-0" />
                          <span className="truncate">{companyName}</span>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          Enterprise Recruiter
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 pt-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800/70">
                      Active Recruiter
                    </span>
                    <span className="text-[10px] text-slate-500">QuestAI Platform</span>
                  </div>
                </div>

                {/* Sign Out Action */}
                <div className="p-2 bg-slate-950/40">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-950/30 transition-colors text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
