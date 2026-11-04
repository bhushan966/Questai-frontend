'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { authedFetch } from '@/lib/api';
import { API_URL } from '@/lib/config';
import { DashboardNav } from '@/components/DashboardNav';
import {
  ArrowLeft,
  Sparkles,
  Bot,
  CheckCircle2,
  Star,
  Copy,
  Check,
  User,
  Clock,
  Briefcase,
  Save,
  Award,
  FileText,
} from 'lucide-react';

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

interface ConversationTurnRecruiter {
  role: 'ai' | 'candidate';
  content: string;
  video_url?: string | null;
  created_at?: string;
}

interface SessionData {
  id: string;
  job_role_id: string;
  candidate_id: string;
  candidate_name?: string;
  mode?: 'recorded' | 'conversational';
  status: string;
  verdict?: string | null;
  rating?: {
    technical?: number;
    communication?: number;
    problem_solving?: number;
    notes?: string;
    decision?: 'shortlisted' | 'hold' | 'declined' | 'pending';
  };
  created_at: string;
}

interface JobRole {
  id: string;
  title: string;
  skills_required?: string;
}

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();

  const [session, setSession] = useState<SessionData | null>(null);
  const [role, setRole] = useState<JobRole | null>(null);
  const [answers, setAnswers] = useState<SessionAnswer[]>([]);
  const [turns, setTurns] = useState<ConversationTurnRecruiter[]>([]);
  const [loading, setLoading] = useState(true);

  // Scorecard State
  const [technicalRating, setTechnicalRating] = useState<number>(0);
  const [communicationRating, setCommunicationRating] = useState<number>(0);
  const [problemSolvingRating, setProblemSolvingRating] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [decision, setDecision] = useState<'shortlisted' | 'hold' | 'declined' | 'pending'>('pending');
  const [savingScorecard, setSavingScorecard] = useState(false);
  const [scorecardSaved, setScorecardSaved] = useState(false);
  const [scorecardError, setScorecardError] = useState<string | null>(null);

  const [copiedTranscriptId, setCopiedTranscriptId] = useState<string | null>(null);

  // Video playback speed state
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  useEffect(() => {
    if (!user || !id) return;

    // Fetch session details
    authedFetch(`${API_URL}/sessions/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(async (sessionData) => {
        if (!sessionData) {
          setLoading(false);
          return;
        }
        setSession(sessionData);

        // Pre-fill rating state if already evaluated
        if (sessionData.rating) {
          setTechnicalRating(sessionData.rating.technical || 0);
          setCommunicationRating(sessionData.rating.communication || 0);
          setProblemSolvingRating(sessionData.rating.problem_solving || 0);
          setNotes(sessionData.rating.notes || '');
          setDecision(sessionData.rating.decision || 'pending');
        }

        // Fetch associated role
        if (sessionData.job_role_id) {
          authedFetch(`${API_URL}/job-roles/${sessionData.job_role_id}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((roleData) => setRole(roleData));
        }

        // Fetch either turns or answers based on mode
        if (sessionData.mode === 'conversational') {
          authedFetch(`${API_URL}/sessions/${id}/turns/recruiter-view`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
              if (data?.turns) setTurns(data.turns);
              if (data?.verdict && !sessionData.verdict) {
                setSession((prev) => (prev ? { ...prev, verdict: data.verdict } : null));
              }
              setLoading(false);
            });
        } else {
          authedFetch(`${API_URL}/sessions/${id}/answers/recruiter-view`)
            .then((res) => (res.ok ? res.json() : []))
            .then((data) => {
              setAnswers(Array.isArray(data) ? data : []);
              setLoading(false);
            });
        }
      })
      .catch((err) => {
        console.error('Failed to load session details:', err);
        setLoading(false);
      });
  }, [id, user]);

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    Object.values(videoRefs.current).forEach((videoEl) => {
      if (videoEl) videoEl.playbackRate = speed;
    });
  };

  const handleCopyTranscript = (text: string, idKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTranscriptId(idKey);
    setTimeout(() => setCopiedTranscriptId(null), 2000);
  };

  const handleSaveScorecard = async () => {
    setSavingScorecard(true);
    setScorecardSaved(false);

    try {
      const res = await authedFetch(`${API_URL}/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: {
            technical: technicalRating,
            communication: communicationRating,
            problem_solving: problemSolvingRating,
            notes,
            decision,
          },
        }),
      });

      if (!res.ok) throw new Error('Failed to save evaluation');
      setScorecardError(null);
      setScorecardSaved(true);
      setTimeout(() => setScorecardSaved(false), 2500);
    } catch (err: any) {
      console.warn('Scorecard save warning:', err);
      setScorecardError(err.message || 'Failed to save evaluation.');
    } finally {
      setSavingScorecard(false);
    }
  };

  const calculateAverageScore = () => {
    const scores = [technicalRating, communicationRating, problemSolvingRating].filter((s) => s > 0);
    if (scores.length === 0) return 0;
    return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Loading candidate evaluation...</span>
      </div>
    );
  }

  if (!user || !session) return null;

  const displayName = session.candidate_name || `Candidate ${session.candidate_id.slice(0, 8)}`;
  const isConversational = session.mode === 'conversational';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <DashboardNav />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Navigation Breadcrumb */}
        <Link
          href={`/dashboard/job-roles/${session.job_role_id}`}
          className="inline-flex items-center gap-2 text-xs sm:text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to candidates for {role?.title || 'Job Role'}</span>
        </Link>

        {/* Hero Candidate Profile Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-lg text-white shadow-md shadow-blue-500/20">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {displayName}
                </h1>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                    isConversational
                      ? 'bg-indigo-950/60 text-indigo-300 border-indigo-800'
                      : 'bg-blue-950/60 text-blue-300 border-blue-800'
                  }`}
                >
                  {isConversational ? 'Conversational AI' : 'Recorded Q&A'}
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                  {role?.title || 'Candidate Interview'}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  {new Date(session.created_at).toLocaleString()}
                </span>
                <span>•</span>
                <span className="font-mono text-[11px] text-slate-500">ID: {session.candidate_id}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            {decision === 'shortlisted' && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Shortlisted
              </span>
            )}
            {decision === 'declined' && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-950 text-rose-300 border border-rose-800">
                Declined
              </span>
            )}
            {decision === 'hold' && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-950 text-amber-300 border border-amber-800">
                On Hold
              </span>
            )}
            {session.status === 'submitted' && decision === 'pending' && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-950 text-blue-300 border border-blue-800">
                Ready for Review
              </span>
            )}
          </div>
        </div>

        {/* AI Verdict Card (If available or in Conversational Mode) */}
        {session.verdict && (
          <div className="bg-gradient-to-r from-indigo-950/60 via-slate-900 to-slate-950 border border-indigo-800/80 rounded-2xl p-5 sm:p-6 space-y-2 shadow-lg">
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>AI Candidate Assessment & Verdict</span>
            </div>
            <p className="text-sm text-slate-200 leading-relaxed font-normal">
              {session.verdict}
            </p>
          </div>
        )}

        {/* Two-Column Review Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Left Column: Video Recordings & Transcripts */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                <span>Interview Responses</span>
              </h2>

              {/* Playback speed selector */}
              <div className="flex items-center gap-1.5 text-xs bg-slate-900 border border-slate-800 rounded-xl p-1">
                <span className="text-slate-400 px-2 font-medium">Speed:</span>
                {[1, 1.25, 1.5, 2].map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSpeedChange(s)}
                    className={`px-2 py-0.5 rounded-lg text-xs font-semibold transition-colors ${
                      playbackSpeed === s
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>

            {/* Conversational Turns View */}
            {isConversational ? (
              <div className="space-y-4">
                {turns.length === 0 ? (
                  <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center text-slate-400 text-sm">
                    No conversation turns recorded yet.
                  </div>
                ) : (
                  turns.map((turn, i) => {
                    const isAi = turn.role === 'ai';
                    return (
                      <div
                        key={i}
                        className={`p-5 rounded-2xl border transition-all ${
                          isAi
                            ? 'bg-slate-900/90 border-slate-800 space-y-2'
                            : 'bg-blue-950/20 border-blue-900/60 space-y-3'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className={`flex items-center gap-1.5 ${isAi ? 'text-indigo-400' : 'text-blue-400'}`}>
                            {isAi ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                            {isAi ? 'QuestAI Interviewer' : `${displayName} (Candidate)`}
                          </span>
                        </div>

                        <div className="text-sm text-slate-100 leading-relaxed font-medium">
                          {turn.content}
                        </div>

                        {turn.video_url && (
                          <div className="pt-2">
                            <video
                              ref={(el) => {
                                videoRefs.current[`turn-${i}`] = el;
                              }}
                              controls
                              className="w-full rounded-xl border border-slate-800 max-h-80 object-cover bg-black"
                            >
                              <source src={turn.video_url} type="video/webm" />
                              Your browser does not support WebM video.
                            </video>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              /* Recorded Answers View */
              <div className="space-y-6">
                {answers.length === 0 ? (
                  <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center text-slate-400 text-sm">
                    No answer recordings submitted for this session.
                  </div>
                ) : (
                  answers.map((a, i) => (
                    <div
                      key={a.id}
                      className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                            Question {i + 1}
                          </span>
                          <h3 className="text-base font-semibold text-white leading-snug">
                            {a.question_text}
                          </h3>
                        </div>
                        <span className="text-xs text-slate-500 shrink-0 font-medium bg-slate-950 px-2 py-1 rounded-md border border-slate-800">
                          ~{a.answer_seconds}s limit
                        </span>
                      </div>

                      {/* Video Player */}
                      {a.video_url ? (
                        <div className="rounded-xl overflow-hidden border border-slate-800 bg-black aspect-video relative group shadow-lg">
                          <video
                            ref={(el) => {
                              videoRefs.current[a.id] = el;
                            }}
                            src={a.video_url}
                            controls
                            playsInline
                            preload="metadata"
                            className="w-full h-full object-cover"
                          >
                            <source src={a.video_url} type="video/webm" />
                            Your browser does not support the video tag.
                          </video>
                          <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950/85 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-700 text-[11px] text-slate-300 pointer-events-auto">
                            <a
                              href={a.video_url}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:text-blue-400 inline-flex items-center gap-1 font-medium transition-colors"
                            >
                              <span>Open Video</span>
                              <span className="text-[10px]">↗</span>
                            </a>
                          </div>
                        </div>
                      ) : (
                        <div className="aspect-video rounded-xl bg-slate-950/70 border border-dashed border-slate-800 flex flex-col items-center justify-center p-6 text-center space-y-2">
                          <span className="text-2xl">📹</span>
                          <span className="text-xs text-slate-400">
                            Candidate answer recording processing or completed.
                          </span>
                        </div>
                      )}

                      {/* Transcript Box */}
                      {a.transcript && (
                        <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 space-y-2">
                          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                            <span>Speech-to-Text Transcript:</span>
                            <button
                              onClick={() => handleCopyTranscript(a.transcript!, a.id)}
                              className="hover:text-slate-200 transition-colors inline-flex items-center gap-1 text-[11px]"
                            >
                              {copiedTranscriptId === a.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span className="text-emerald-400">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
                            {a.transcript}
                          </p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Right Column: Recruiter Scorecard & Hiring Decision */}
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5 sticky top-24 shadow-md">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Award className="w-4 h-4 text-purple-400" />
                    <span>Evaluation Scorecard</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Rate candidate performance</p>
                </div>
                {Number(calculateAverageScore()) > 0 && (
                  <div className="text-right">
                    <span className="text-2xl font-bold text-purple-400 tabular-nums">
                      {calculateAverageScore()}
                    </span>
                    <span className="text-xs text-slate-500">/5</span>
                  </div>
                )}
              </div>

              {/* Rating Rubric */}
              <div className="space-y-4">
                {/* 1. Technical Competence */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">Technical Depth</span>
                    <span className="text-slate-500">{technicalRating ? `${technicalRating}/5` : 'Not rated'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setTechnicalRating(star)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          star <= technicalRating
                            ? 'text-yellow-400 bg-yellow-400/10'
                            : 'text-slate-600 hover:text-slate-400'
                        }`}
                      >
                        <Star className={`w-5 h-5 ${star <= technicalRating ? 'fill-yellow-400' : ''}`} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Communication */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">Communication & Clarity</span>
                    <span className="text-slate-500">{communicationRating ? `${communicationRating}/5` : 'Not rated'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setCommunicationRating(star)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          star <= communicationRating
                            ? 'text-yellow-400 bg-yellow-400/10'
                            : 'text-slate-600 hover:text-slate-400'
                        }`}
                      >
                        <Star className={`w-5 h-5 ${star <= communicationRating ? 'fill-yellow-400' : ''}`} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Problem Solving */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">Problem-Solving & Agility</span>
                    <span className="text-slate-500">{problemSolvingRating ? `${problemSolvingRating}/5` : 'Not rated'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setProblemSolvingRating(star)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          star <= problemSolvingRating
                            ? 'text-yellow-400 bg-yellow-400/10'
                            : 'text-slate-600 hover:text-slate-400'
                        }`}
                      >
                        <Star className={`w-5 h-5 ${star <= problemSolvingRating ? 'fill-yellow-400' : ''}`} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Private Recruiter Notes */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Recruiter Evaluation Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Record strengths, follow-up questions for hiring manager, or salary expectations..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              {/* Hiring Decision Segment */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Hiring Decision
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setDecision('shortlisted')}
                    className={`py-2 rounded-xl text-xs font-semibold transition-all border ${
                      decision === 'shortlisted'
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    Shortlist
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecision('hold')}
                    className={`py-2 rounded-xl text-xs font-semibold transition-all border ${
                      decision === 'hold'
                        ? 'bg-amber-600 text-white border-amber-500 shadow-sm'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    On Hold
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecision('declined')}
                    className={`py-2 rounded-xl text-xs font-semibold transition-all border ${
                      decision === 'declined'
                        ? 'bg-rose-600 text-white border-rose-500 shadow-sm'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    Decline
                  </button>
                </div>
              </div>

              {/* Save Scorecard Button */}
              <button
                type="button"
                onClick={handleSaveScorecard}
                disabled={savingScorecard}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-500/20"
              >
                {savingScorecard ? (
                  <span>Saving...</span>
                ) : scorecardSaved ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>Scorecard Saved!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Evaluation</span>
                  </>
                )}
              </button>

              {scorecardError && (
                <div className="p-3 bg-red-950/40 border border-red-900 rounded-xl text-xs text-red-300">
                  {scorecardError}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}