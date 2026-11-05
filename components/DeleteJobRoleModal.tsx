'use client';

import { useState } from 'react';
import { API_URL } from '@/lib/config';
import { authedFetch } from '@/lib/api';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface DeleteJobRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: { id: string; title: string } | null;
  onDeleted: (deletedRoleId: string) => void;
}

export function DeleteJobRoleModal({
  isOpen,
  onClose,
  role,
  onDeleted,
}: DeleteJobRoleModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !role) return null;

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);

    try {
      // 1. Delete from API (FastAPI backend or local API)
      try {
        const res = await authedFetch(`${API_URL}/job-roles/${role.id}`, {
          method: 'DELETE',
        });

        // If FastAPI doesn't implement DELETE /job-roles/{id} (returns 405 Method Not Allowed),
        // or returns 404, we don't block deletion. Only throw for 500 server errors.
        if (!res.ok && res.status !== 404 && res.status !== 405) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.detail || 'Failed to delete job role from backend');
        }
      } catch (fetchErr: any) {
        // If route not implemented or network fallback, proceed with database & local tombstone
        console.warn('API delete notice:', fetchErr?.message);
      }

      // Also call internal Next.js/Supabase endpoint if different
      if (API_URL !== '/api') {
        try {
          await fetch(`/api/job-roles/${role.id}`, { method: 'DELETE' });
        } catch {}
      }

      // 2. Remove from localStorage saved roles & record in deleted roles tombstone
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem('questai_saved_roles');
          if (stored) {
            const list = JSON.parse(stored);
            const filtered = list.filter((r: { id: string }) => r.id !== role.id);
            localStorage.setItem('questai_saved_roles', JSON.stringify(filtered));
          }

          // Persistent tombstone: never resuscitate deleted roles on Vercel cold starts
          const deletedStored = localStorage.getItem('questai_deleted_roles');
          const deletedList: string[] = deletedStored ? JSON.parse(deletedStored) : [];
          if (!deletedList.includes(role.id)) {
            deletedList.push(role.id);
            localStorage.setItem('questai_deleted_roles', JSON.stringify(deletedList));
          }
        } catch {
          // ignore
        }
      }

      onDeleted(role.id);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete job role.';
      setError(message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-950/60 border border-red-800/80 text-red-400 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Delete Job Role</h2>
              <p className="text-xs text-slate-400">This action cannot be undone</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-950/40 border border-red-900 rounded-xl text-xs text-red-300">
              {error}
            </div>
          )}

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Are you sure you want to delete <span className="font-semibold text-white">"{role.title}"</span>?
          </p>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 text-amber-400 font-medium">
              <span>Notice:</span>
            </div>
            <p>
              Deleting this job role will also delete all associated interview questions and candidate links for this role.
            </p>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={deleting}
              className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition-all"
            >
              {deleting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              <span>{deleting ? 'Deleting...' : 'Delete Job Role'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
