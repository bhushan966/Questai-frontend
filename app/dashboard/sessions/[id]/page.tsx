'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { authedFetch } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/config';

interface SessionAnswer {
  id: string;
  question_id: string;
  question_text: string;
  think_seconds: number;
  answer_seconds: number;
  status: string;
  video_url: string | null;
  transcript: string | null;
  submitted_at: string | null;
}

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();

  const [answers, setAnswers] = useState<SessionAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    authedFetch(`${API_URL}/sessions/${id}/answers/recruiter-view`)
      .then((res) => res.json())
      .then((data) => {
        setAnswers(data);
        setLoading(false);
      });
  }, [id, user]);
  

  if (authLoading) return <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center">Checking login...</div>;
  if (!user) return null;
  if (loading) return <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center">Loading interview...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-3xl mx-auto p-8 space-y-6">
        <button onClick={() => router.back()} className="text-sm text-slate-400 hover:text-slate-200">
          ← Back to candidates
        </button>
        <h1 className="text-2xl font-bold">Interview Review</h1>

        <div className="space-y-6">
          {answers.map((a, i) => {
            const videoSrc = a.video_url;

            return (
              <div key={a.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="text-xs font-medium tracking-wide text-slate-500 uppercase">Q{i + 1}</div>
                <div className="text-slate-100 font-medium">{a.question_text}</div>

                {videoSrc ? (
                  <video controls className="w-full rounded-lg border border-slate-800">
                    <source src={videoSrc} type="video/webm" />
                  </video>
                ) : (
                  <div className="text-slate-600 text-sm italic">No recording submitted.</div>
                )}

                {a.transcript && (
                  <div className="text-sm text-slate-400 bg-slate-950 border border-slate-800 rounded-lg p-3">
                    <span className="text-slate-500 font-medium">Transcript: </span>
                    {a.transcript}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}