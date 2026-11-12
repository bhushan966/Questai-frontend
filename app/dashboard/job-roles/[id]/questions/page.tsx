'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { authedFetch } from '@/lib/api';
import { API_URL } from '@/lib/config';
import { DashboardNav } from '@/components/DashboardNav';
import {
  ArrowLeft,
  Sparkles,
  ListPlus,
  Trash2,
  Clock,
  Plus,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';

interface Question {
  id: string;
  question_text: string;
  order_index: number;
  generated_by: string;
  think_seconds: number;
  answer_seconds: number;
}

interface JobRole {
  id: string;
  title: string;
  description: string;
  skills_required: string | null;
}

export default function ManageQuestionsPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();

  const [role, setRole] = useState<JobRole | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'ai' | 'manual'>('all');

  const [newQuestionText, setNewQuestionText] = useState('');
  const [newAnswerSeconds, setNewAnswerSeconds] = useState(90);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [generatingLink, setGeneratingLink] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadData = () => {
    let localRole: JobRole | null = null;
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('questai_saved_roles');
        if (stored) {
          const list = JSON.parse(stored);
          localRole = list.find((r: JobRole) => r.id === id) || null;
          if (localRole) setRole(localRole);
        }
      } catch {
        // ignore
      }
    }

    Promise.all([
      authedFetch(`${API_URL}/job-roles/${id}`).then((res) => (res.ok ? res.json() : null)).catch(() => null),
      authedFetch(`${API_URL}/job-roles/${id}/questions`).then((res) => (res.ok ? res.json() : [])).catch(() => []),
    ])
      .then(([roleData, questionsData]) => {
        if (roleData) {
          setRole(roleData);
        } else if (localRole) {
          setRole(localRole);
        }
        setQuestions(Array.isArray(questionsData) ? questionsData : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error loading questions:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!user || !id) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center">
        Checking authentication...
      </div>
    );
  }

  if (!user) return null;

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestionText.trim()) return;
    setAdding(true);
    setActionError(null);
    try {
      const res = await authedFetch(`${API_URL}/job-roles/${id}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_text: newQuestionText.trim(),
          answer_seconds: newAnswerSeconds,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || 'Failed to add question');
      }
      setNewQuestionText('');
      setNewAnswerSeconds(90);
      loadData();
    } catch (err: any) {
      console.warn('Failed to add question:', err);
      setActionError(err.message || 'Failed to add question.');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (questionId: string) => {
    setDeletingId(questionId);
    setActionError(null);
    try {
      const res = await authedFetch(`${API_URL}/job-roles/${id}/questions/${questionId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete question');
      loadData();
    } catch (err) {
      console.warn('Failed to delete question:', err);
      setActionError('Failed to delete question.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleGenerateLink = async (source: 'ai' | 'manual') => {
    setGeneratingLink(true);
    setGeneratedLink(null);
    setActionError(null);
    try {
      const candidateId = crypto.randomUUID();
      const res = await fetch(`${API_URL}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_role_id: id,
          candidate_id: candidateId,
          question_source: source,
          mode: 'recorded',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || 'Failed to create session');
      }
      const session = await res.json();
      setGeneratedLink(`${window.location.origin}/interview/${session.id}`);
    } catch (err: any) {
      console.warn('Failed to generate link:', err);
      setActionError(err.message || 'Failed to generate link.');
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopy = () => {
    if (!generatedLink) return;

    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredQuestions = questions.filter((q) => {
    if (filter === 'ai') return q.generated_by === 'ai';
    if (filter === 'manual') return q.generated_by === 'manual';
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <DashboardNav />

      <main className="flex-1 max-w-7xl 2xl:max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Link
          href={`/dashboard/job-roles/${id}`}
          className="inline-flex items-center gap-2 text-xs sm:text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to candidates</span>
        </Link>

        {/* Header */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Interview Questions</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Role: <span className="text-white font-medium">{role?.title || 'Job Role'}</span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleGenerateLink('manual')}
                disabled={generatingLink || questions.filter((q) => q.generated_by === 'manual').length === 0}
                className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                title="Generates a candidate link with only custom questions"
              >
                <ListPlus className="w-4 h-4" />
                <span>+ Custom Link</span>
              </button>
              <button
                onClick={() => handleGenerateLink('ai')}
                disabled={generatingLink}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                title="Generates a candidate link with AI questions"
              >
                <Sparkles className="w-4 h-4" />
                <span>+ AI Link</span>
              </button>
            </div>
          </div>
        </div>

        {/* Action Error Banner */}
        {actionError && (
          <div className="p-4 bg-red-950/40 border border-red-800 rounded-2xl flex items-center justify-between text-xs text-red-300 animate-in fade-in">
            <span>{actionError}</span>
            <button
              onClick={() => setActionError(null)}
              className="text-red-400 hover:text-red-200 underline font-medium ml-3"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Link Generated Banner */}
        {generatedLink && (
          <div className="p-4 bg-slate-900 border border-emerald-900/80 rounded-2xl space-y-2.5 animate-in fade-in">
            <div className="flex items-center justify-between text-xs text-emerald-400 font-medium">
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                Candidate Link Generated!
              </span>
              <a
                href={generatedLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
              >
                <span>Test Link</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={generatedLink}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-200 select-all"
              />
              <button
                onClick={handleCopy}
                className={`px-4 py-2 rounded-xl text-xs font-medium shrink-0 transition-colors flex items-center gap-1.5 ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Add Question Card */}
        <form
          onSubmit={handleAddQuestion}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-purple-600/20 text-purple-400 flex items-center justify-center">
              <Plus className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Add Custom Question
            </h2>
          </div>

          <textarea
            value={newQuestionText}
            onChange={(e) => setNewQuestionText(e.target.value)}
            rows={3}
            placeholder="e.g. Can you describe a complex system architecture you designed, and what trade-offs you considered?"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-purple-500 transition-colors"
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Answer Duration:</span>
              <div className="flex items-center gap-1.5">
                {[60, 90, 120, 180].map((seconds) => (
                  <button
                    key={seconds}
                    type="button"
                    onClick={() => setNewAnswerSeconds(seconds)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      newAnswerSeconds === seconds
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {seconds}s
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={adding || !newQuestionText.trim()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-medium rounded-xl text-xs sm:text-sm transition-colors flex items-center justify-center gap-1.5 shadow-sm"
            >
              {adding ? (
                <span>Adding Question...</span>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Add Question</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Question Filter Tabs */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                filter === 'all'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Questions ({questions.length})
            </button>
            <button
              onClick={() => setFilter('ai')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                filter === 'ai'
                  ? 'bg-blue-950/60 text-blue-300 border border-blue-800'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3 h-3 text-blue-400" />
              <span>AI Curated ({questions.filter((q) => q.generated_by === 'ai').length})</span>
            </button>
            <button
              onClick={() => setFilter('manual')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                filter === 'manual'
                  ? 'bg-purple-950/60 text-purple-300 border border-purple-800'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ListPlus className="w-3 h-3 text-purple-400" />
              <span>Custom ({questions.filter((q) => q.generated_by === 'manual').length})</span>
            </button>
          </div>
        </div>

        {/* Questions List */}
        {loading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center text-slate-400">
            Loading questions...
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-12 text-center text-slate-500 text-xs sm:text-sm">
            No questions in this view.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredQuestions.map((q, idx) => {
              const isAi = q.generated_by === 'ai';
              return (
                <div
                  key={q.id}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-4 sm:p-5 flex items-start justify-between gap-4 transition-all"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400">Q{idx + 1}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                          isAi
                            ? 'bg-blue-950/60 text-blue-300 border-blue-800'
                            : 'bg-purple-950/60 text-purple-300 border-purple-800'
                        }`}
                      >
                        {isAi ? 'AI Generated' : 'Custom Recruiter Question'}
                      </span>
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{q.think_seconds || 30}s think • {q.answer_seconds}s record</span>
                      </span>
                    </div>

                    <p className="text-sm text-slate-100 leading-relaxed font-medium">
                      {q.question_text}
                    </p>
                  </div>

                  <button
                    onClick={() => handleDelete(q.id)}
                    disabled={deletingId === q.id}
                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-colors shrink-0"
                    title="Remove question"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}