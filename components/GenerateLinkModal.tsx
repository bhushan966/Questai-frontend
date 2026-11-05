'use client';

import { useState, useEffect } from 'react';
import { API_URL } from '@/lib/config';
import {
  X,
  Sparkles,
  ListPlus,
  Bot,
  Copy,
  Check,
  ExternalLink,
  User,
  ArrowRight,
  ShieldAlert,
  Briefcase,
} from 'lucide-react';

interface JobRoleOption {
  id: string;
  title: string;
  description?: string;
  skills_required?: string | null;
}

interface GenerateLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobRoles: JobRoleOption[];
  preselectedRoleId?: string;
}

export function GenerateLinkModal({
  isOpen,
  onClose,
  jobRoles,
  preselectedRoleId,
}: GenerateLinkModalProps) {
  const [selectedRoleId, setSelectedRoleId] = useState<string>(
    preselectedRoleId || jobRoles[0]?.id || ''
  );
  const [mode, setMode] = useState<'recorded_ai' | 'recorded_manual' | 'conversational'>('recorded_ai');
  const [candidateName, setCandidateName] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Synchronize role state and reset transient errors whenever the modal opens or role changes
  useEffect(() => {
    if (isOpen) {
      if (preselectedRoleId) {
        setSelectedRoleId(preselectedRoleId);
      } else {
        setSelectedRoleId((prev) => prev || (jobRoles.length > 0 ? jobRoles[0].id : ''));
      }
      setError(null);
      setGeneratedLink(null);
      setCopied(false);
    }
  }, [isOpen, preselectedRoleId, jobRoles]);

  if (!isOpen) return null;

  // Determine active role based on preselectedRoleId first, then selectedRoleId
  const effectiveRoleId = preselectedRoleId || selectedRoleId || jobRoles[0]?.id || '';
  const currentRole =
    jobRoles.find((r) => r.id === effectiveRoleId) ||
    (preselectedRoleId ? jobRoles.find((r) => r.id === preselectedRoleId) : null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const roleIdToUse = effectiveRoleId;
    if (!roleIdToUse) {
      setError('Please select a job role');
      return;
    }

    setGenerating(true);
    setError(null);
    setGeneratedLink(null);

    const questionSource = mode === 'recorded_manual' ? 'manual' : 'ai';
    const interviewMode = mode === 'conversational' ? 'conversational' : 'recorded';
    const candidateId = crypto.randomUUID();

    try {
      const sessionUrl = API_URL.startsWith('http') ? `${API_URL}/sessions/` : `${API_URL}/sessions`;
      const res = await fetch(sessionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_role_id: roleIdToUse,
          candidate_id: candidateId,
          candidate_name: candidateName.trim() || undefined,
          question_source: questionSource,
          mode: interviewMode,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || 'Failed to create interview session');
      }

      const session = await res.json();
      setGeneratedLink(`${window.location.origin}/interview/${session.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to generate link');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Generate Candidate Interview Link</h2>
              <p className="text-xs text-slate-400">
                {preselectedRoleId && currentRole
                  ? `For ${currentRole.title} — share with candidate for evaluation`
                  : 'Share this link with a candidate for immediate evaluation'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleGenerate} className="p-6 space-y-5">
          {/* Job Role: If opened from a role card, display locked role directly without asking to select */}
          {preselectedRoleId ? (
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0 pr-3">
                <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 text-blue-400 flex items-center justify-center shrink-0">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Selected Job Role
                  </div>
                  <div className="text-sm font-bold text-white truncate">
                    {currentRole?.title || 'Selected Job Role'}
                  </div>
                </div>
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-semibold shrink-0">
                <Check className="w-3.5 h-3.5" />
                <span>Card Role Selected</span>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Target Job Role
              </label>
              <select
                value={effectiveRoleId}
                onChange={(e) => setSelectedRoleId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
              >
                {jobRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Mode Selection */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Interview Format
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setMode('recorded_ai')}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  mode === 'recorded_ai'
                    ? 'border-blue-500 bg-blue-950/30 text-white shadow-sm shadow-blue-500/10'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center mb-2">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">AI Questions</div>
                  <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    Auto-generated from role & skills
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode('recorded_manual')}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  mode === 'recorded_manual'
                    ? 'border-purple-500 bg-purple-950/30 text-white shadow-sm shadow-purple-500/10'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-purple-600/20 text-purple-400 flex items-center justify-center mb-2">
                  <ListPlus className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">Custom Questions</div>
                  <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    Uses questions you hand-crafted
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode('conversational')}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  mode === 'conversational'
                    ? 'border-emerald-500 bg-emerald-950/30 text-white shadow-sm shadow-emerald-500/10'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center mb-2">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white flex items-center gap-1">
                    <span>Conversational AI</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    Live multi-turn dialogue + AI Verdict
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Candidate Identifier Input */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Candidate Name or Note (Optional)
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                placeholder="e.g. Sarah Jenkins or Referral #104"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-950/40 border border-red-900 rounded-xl text-xs text-red-300">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Result Link Display */}
          {generatedLink && (
            <div className="p-4 bg-slate-950 border border-emerald-900/60 rounded-xl space-y-2.5 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  Interview Link Ready!
                </span>
                <a
                  href={generatedLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 font-medium"
                >
                  <span>Test Link</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={generatedLink}
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 select-all"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold shrink-0 transition-colors flex items-center gap-1.5 ${
                    copied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={generating}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
          >
            {generating ? (
              <span>Creating Interview Session...</span>
            ) : generatedLink ? (
              <>
                <span>Generate Another Link</span>
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                <span>
                  {preselectedRoleId && currentRole
                    ? `Create Link for ${currentRole.title}`
                    : 'Create Interview Link'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

