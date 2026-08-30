'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { authedFetch } from '@/lib/api';
import { API_URL } from '@/lib/config';

interface Question {
  id: string;
  question_text: string;
  order_index: number;
  generated_by: string;
  think_seconds: number;
  answer_seconds: number;
}

export default function ManageQuestionsPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newAnswerSeconds, setNewAnswerSeconds] = useState(90);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadQuestions = () => {
    authedFetch(`${API_URL}/job-roles/${id}/questions`)
      .then((res) => res.json())
      .then((data) => {
        setQuestions(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!user) return;
    loadQuestions();
  }, [id, user]);

  if (authLoading) return <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center">Checking login...</div>;
  if (!user) return null;

  const customQuestions = questions.filter((q) => q.generated_by === 'manual');

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestionText.trim()) return;
    setAdding(true);
    try {
      const res = await authedFetch(`${API_URL}/job-roles/${id}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_text: newQuestionText, answer_seconds: newAnswerSeconds }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || 'Failed to add question');
      }
      setNewQuestionText('');
      setNewAnswerSeconds(90);
      loadQuestions();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to add question.');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (questionId: string) => {
    if (!confirm('Delete this question? This only affects future candidates.')) return;
    setDeletingId(questionId);
    try {
      const res = await authedFetch(`${API_URL}/job-roles/${id}/questions/${questionId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete');
      loadQuestions();
    } catch (err) {
      console.error(err);
      alert('Failed to delete question.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleGenerateLink = async () => {
    setGenerating(true);
    setGeneratedLink(null);
    try {
      const candidateId = crypto.randomUUID();
      const res = await fetch(`${API_URL}/sessions/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_role_id: id, candidate_id: candidateId, question_source: 'manual' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || 'Failed to create session');
      }
      const session = await res.json();
      setGeneratedLink(`${window.location.origin}/interview/${session.id}`);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to generate link.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedLink!);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-3xl mx-auto p-8 space-y-6">
        <Link href={`/dashboard/job-roles/${id}`} className="text-sm text-slate-400 hover:text-slate-200">
          ← Back to candidates
        </Link>
        <h1 className="text-2xl font-bold">Custom Interview</h1>
        <p className="text-sm text-slate-400">
          Write your own questions below, then generate a candidate link that uses only these questions.
        </p>

        <form onSubmit={handleAddQuestion} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Add a Question</h2>
          <textarea
            value={newQuestionText}
            onChange={(e) => setNewQuestionText(e.target.value)}
            rows={3}
            placeholder="e.g. Tell me about a time you had to debug a production issue under pressure."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-600"
          />
          <div className="flex items-center gap-3">
            <label className="text-sm text-slate-400">Answer time (seconds):</label>
            <input
              type="number"
              value={newAnswerSeconds}
              onChange={(e) => setNewAnswerSeconds(Number(e.target.value))}
              min={30}
              max={300}
              className="w-24 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-100"
            />
          </div>
          <button
            type="submit"
            disabled={adding || !newQuestionText.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors text-white font-medium rounded-lg text-sm"
          >
            {adding ? 'Adding...' : '+ Add Question'}
          </button>
        </form>

        {loading ? (
          <div className="text-slate-400">Loading questions...</div>
        ) : (
          <div className="space-y-3">
            {customQuestions.length === 0 && (
              <div className="border border-dashed border-slate-800 rounded-xl p-8 text-center text-slate-500 text-sm">
                No custom questions yet — add at least one above to generate a link.
              </div>
            )}
            {customQuestions.map((q, i) => (
              <div key={q.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-slate-500">Q{i + 1}</span>
                    <span className="text-xs text-slate-600">~{q.answer_seconds}s to answer</span>
                  </div>
                  <div className="text-slate-100 text-sm">{q.question_text}</div>
                </div>
                <button
                  onClick={() => handleDelete(q.id)}
                  disabled={deletingId === q.id}
                  className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 shrink-0"
                >
                  {deletingId === q.id ? 'Deleting...' : 'Remove'}
                </button>
              </div>
            ))}
          </div>
        )}

        {customQuestions.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <button
              onClick={handleGenerateLink}
              disabled={generating}
              className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 transition-colors text-white font-medium rounded-xl"
            >
              {generating ? 'Generating...' : 'Generate Custom Interview Link'}
            </button>

            {generatedLink && (
              <div className="space-y-2 pt-2">
                <div className="text-sm text-slate-400">Share this link with the candidate:</div>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={generatedLink}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200"
                  />
                  <button
                    onClick={handleCopy}
                    className={`px-3 py-2 rounded-lg text-sm font-medium shrink-0 transition-colors ${
                      copied ? 'bg-emerald-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'
                    }`}
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}