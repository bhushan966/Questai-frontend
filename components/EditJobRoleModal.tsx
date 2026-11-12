'use client';

import { useState, useEffect } from 'react';
import { API_URL } from '@/lib/config';
import { authedFetch } from '@/lib/api';
import { X, Sparkles, Save, Tag, Building2 } from 'lucide-react';

export interface JobRoleData {
  id: string;
  title: string;
  company_name?: string | null;
  description: string;
  skills_required: string | null;
  created_at?: string;
}

interface EditJobRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: JobRoleData | null;
  onSaved: (updatedRole: JobRoleData) => void;
}

export function EditJobRoleModal({
  isOpen,
  onClose,
  role,
  onSaved,
}: EditJobRoleModalProps) {
  const [title, setTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [description, setDescription] = useState('');
  const [skills, setSkills] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (role) {
      setTitle(role.title || '');
      setCompanyName(role.company_name || '');
      setDescription(role.description || '');
      setSkills(role.skills_required || '');
      setError(null);
    }
  }, [role]);

  if (!isOpen || !role) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Job role title is required.');
      return;
    }
    if (!description.trim()) {
      setError('Job description is required.');
      return;
    }

    setSaving(true);
    setError(null);

    const updatedData: JobRoleData = {
      ...role,
      title: title.trim(),
      company_name: companyName.trim() || null,
      description: description.trim(),
      skills_required: skills.trim() ? skills.trim() : null,
    };

    try {
      // 1. Update in API backend
      const res = await authedFetch(`${API_URL}/job-roles/${role.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: updatedData.title,
          company_name: updatedData.company_name,
          description: updatedData.description,
          skills_required: updatedData.skills_required,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.detail || 'Failed to update job role');
      }

      const serverUpdated = await res.json().catch(() => updatedData);

      // 2. Synchronize localStorage
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem('questai_saved_roles');
          if (stored) {
            const list: JobRoleData[] = JSON.parse(stored);
            const index = list.findIndex((r) => r.id === role.id);
            if (index !== -1) {
              list[index] = { ...list[index], ...serverUpdated };
            } else {
              list.push(serverUpdated);
            }
            localStorage.setItem('questai_saved_roles', JSON.stringify(list));
          }
        } catch {
          // ignore
        }
      }

      onSaved(serverUpdated);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save changes. Please try again.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const skillPills = skills
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-950/80 border border-blue-800/80 text-blue-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Edit Job Role</h2>
              <p className="text-xs text-slate-400">Update role requirements or reuse for new openings</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-red-950/40 border border-red-900 rounded-xl text-xs text-red-300">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Job Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Senior Frontend Engineer"
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Hiring Company / Organization
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Enter company name"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Job Description *
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe core responsibilities, level of seniority, team context..."
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors resize-none leading-relaxed"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Required Skills
              </label>
              <span className="text-[11px] text-slate-500">Comma-separated</span>
            </div>
            <div className="relative">
              <Tag className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="React, TypeScript, Next.js, System Design"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {skillPills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1.5">
                {skillPills.map((pill, i) => (
                  <span
                    key={i}
                    className="text-xs bg-slate-950 text-blue-300 border border-slate-800 px-2 py-0.5 rounded-full"
                  >
                    {pill}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition-all"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
