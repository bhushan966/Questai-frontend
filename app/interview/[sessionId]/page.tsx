'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import fixWebmDuration from 'fix-webm-duration';
import { API_URL } from '@/lib/config';
import { supabase } from '@/lib/supabase';
import {
  Camera,
  Mic,
  MicOff,
  Video,
  VideoOff,
  CheckCircle2,
  Play,
  RotateCcw,
  Sparkles,
  Square,
  ArrowRight,
  ArrowLeft,
  Briefcase,
  FileText,
  AlertCircle,
  CheckCheck,
  Loader2,
  Volume2,
  Bot,
  SkipForward,
  Lock,
  Clock,
  ShieldAlert,
  Maximize2,
  Minimize2,
} from 'lucide-react';

type RealPhase =
  | 'loading'
  | 'welcome'
  | 'intro'
  | 'speaking'
  | 'thinking'
  | 'recording'
  | 'stopped'
  | 'submitting'
  | 'complete'
  | 'already_completed'
  | 'expired';

type PracticePhase =
  | 'speaking'
  | 'thinking'
  | 'recording'
  | 'review';

interface JobRole {
  id: string;
  title: string;
  description: string;
  skills_required: string | null;
}

interface Answer {
  id: string;
  question_id: string;
  question_text: string;
  think_seconds: number;
  answer_seconds: number;
  status: string;
  video_url?: string | null;
  submitted_at?: string | null;
}

interface SessionData {
  id: string;
  job_role_id: string;
  candidate_id: string;
  candidate_name?: string;
  mode?: 'recorded' | 'conversational';
  status: string;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-2xl">{children}</div>
    </div>
  );
}

function ViewportStudioShell({
  children,
  headerLeft,
  headerRight,
}: {
  children: React.ReactNode;
  headerLeft?: React.ReactNode;
  headerRight?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen lg:h-screen lg:max-h-screen bg-slate-950 text-slate-100 flex flex-col p-3 sm:p-4 lg:p-5 lg:overflow-hidden">
      {/* Studio Top Navigation Bar */}
      <header className="shrink-0 flex items-center justify-between pb-2.5 sm:pb-3 border-b border-slate-800/80 mb-2 sm:mb-3 gap-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {headerLeft}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {headerRight}
        </div>
      </header>

      {/* Main Studio Viewport Area */}
      <main className="flex-1 min-h-0 flex flex-col justify-center">
        {children}
      </main>
    </div>
  );
}

/**
 * CameraFrame ensures video feed is always rendered and never blank.
 */
function CameraFrame({
  stream,
  ring,
  error,
  onRetry,
  cameraOn,
  micOn,
  onToggleCamera,
  onToggleMic,
  label,
  children,
}: {
  stream: MediaStream | null;
  ring?: 'idle' | 'recording' | 'speaking' | 'thinking';
  error?: string | null;
  onRetry?: () => void;
  cameraOn?: boolean;
  micOn?: boolean;
  onToggleCamera?: () => void;
  onToggleMic?: () => void;
  label?: string;
  children?: React.ReactNode;
}) {
  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  const attachStream = useCallback(
    (video: HTMLVideoElement | null) => {
      if (!video) return;
      videoElementRef.current = video;
      if (stream) {
        if (video.srcObject !== stream) {
          video.srcObject = stream;
        }
        video.muted = true;
        video.play().catch(() => {});
      }
    },
    [stream]
  );

  useEffect(() => {
    if (videoElementRef.current && stream) {
      if (videoElementRef.current.srcObject !== stream) {
        videoElementRef.current.srcObject = stream;
      }
      videoElementRef.current.muted = true;
      videoElementRef.current.play().catch(() => {});
    }
  }, [stream]);

  if (error) {
    return (
      <div className="rounded-2xl bg-slate-900 border-2 border-amber-800/80 aspect-video flex flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-amber-950/60 text-amber-400 border border-amber-800 flex items-center justify-center">
          <Camera className="w-6 h-6" />
        </div>
        <div className="text-sm text-amber-300 font-semibold">
          {error === 'permission'
            ? 'Camera and microphone permission required'
            : error === 'no-device'
            ? 'No camera or microphone found on this device'
            : 'Unable to access your camera and microphone'}
        </div>
        <p className="text-xs text-slate-400 max-w-sm">
          Please allow camera and microphone access in your browser settings to proceed with the interview.
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 transition-colors text-white text-xs font-semibold rounded-xl"
          >
            Try Again
          </button>
        )}
      </div>
    );
  }

  const ringStyles = {
    recording: 'border-red-500 shadow-xl shadow-red-500/25 ring-4 ring-red-500/20',
    speaking: 'border-blue-500 shadow-xl shadow-blue-500/25 ring-4 ring-blue-500/20',
    thinking: 'border-amber-500 shadow-xl shadow-amber-500/25 ring-4 ring-amber-500/20',
    idle: 'border-slate-800',
  }[ring || 'idle'];

  return (
    <div className={`relative rounded-3xl overflow-hidden bg-slate-950 aspect-video border-2 transition-all ${ringStyles}`}>
      <video
        ref={attachStream}
        autoPlay
        muted
        playsInline
        onLoadedMetadata={(e) => {
          (e.target as HTMLVideoElement).play().catch(() => {});
        }}
        className="w-full h-full object-cover transform -scale-x-100"
      />

      {/* Top Status Badges */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-md border border-slate-800 text-[11px] font-medium text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>{label || 'LIVE VIDEO FEED'}</span>
        </div>
        {ring === 'recording' && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600/90 text-white text-[11px] font-bold tracking-wide animate-pulse shadow-lg shadow-red-600/30">
            <span className="w-2 h-2 rounded-full bg-white" />
            <span>REC</span>
          </div>
        )}
        {ring === 'speaking' && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-600/90 text-white text-[11px] font-bold tracking-wide animate-pulse shadow-lg shadow-blue-600/30">
            <Volume2 className="w-3.5 h-3.5 text-white" />
            <span>AI ASKING</span>
          </div>
        )}
      </div>

      {cameraOn === false && (
        <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center gap-2 z-10">
          <VideoOff className="w-8 h-8 text-slate-500" />
          <span className="text-xs text-slate-400 font-medium">Camera is disabled</span>
        </div>
      )}

      {/* Embedded Children Overlays (e.g., Question at Bottom + Controls Dock) */}
      {children}

      {/* Default Floating Control Badges (when no custom children overlay is provided) */}
      {!children && (onToggleCamera || onToggleMic) && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-800 z-10">
          {onToggleCamera && (
            <button
              onClick={onToggleCamera}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                cameraOn ? 'text-slate-300 hover:text-white hover:bg-slate-800' : 'bg-red-600 text-white'
              }`}
              title={cameraOn ? 'Turn camera off' : 'Turn camera on'}
            >
              {cameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
            </button>
          )}
          {onToggleMic && (
            <button
              onClick={onToggleMic}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                micOn ? 'text-slate-300 hover:text-white hover:bg-slate-800' : 'bg-red-600 text-white'
              }`}
              title={micOn ? 'Turn mic off' : 'Turn mic on'}
            >
              {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function MicVisualizer({ level }: { level: number }) {
  const bars = 16;
  const activeCount = Math.round(level * bars);
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex items-center gap-1 text-xs text-slate-400 font-medium">
        <Mic className="w-3.5 h-3.5 text-blue-400" />
        <span>Mic Input</span>
      </div>
      <div className="flex items-center gap-1">
        {Array.from({ length: bars }).map((_, i) => (
          <div
            key={i}
            className={`w-1.5 h-4 rounded-sm transition-all duration-75 ${
              i < activeCount
                ? i > 12
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
                : 'bg-slate-800'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export default function InterviewPage() {
  const { sessionId } = useParams<{ sessionId: string }>();

  // Main flow state
  const [phase, setPhase] = useState<RealPhase>('loading');
  const [session, setSession] = useState<SessionData | null>(null);
  const [jobRole, setJobRole] = useState<JobRole | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [resumeQuestionIndex, setResumeQuestionIndex] = useState<number>(0);
  const [countdown, setCountdown] = useState(0);
  const [uploadProgressStatus, setUploadProgressStatus] = useState<Record<string, 'uploading' | 'uploaded' | 'failed'>>({});
  const [submitting, setSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen toggle failed:', err);
    }
  };

  // Expiry & Deadline state
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [deadlineRemaining, setDeadlineRemaining] = useState<string | null>(null);

  // Tab-Switch & Focus Integrity state
  const [tabSwitchWarning, setTabSwitchWarning] = useState<string | null>(null);
  const integrityMapRef = useRef<Record<string, { switches: number; unfocusedSeconds: number }>>({});
  const unfocusedStartRef = useRef<number | null>(null);

  // Dedicated Practice Mode state
  const [isPractice, setIsPractice] = useState(false);
  const [practicePhase, setPracticePhase] = useState<PracticePhase>('speaking');
  const [practiceCountdown, setPracticeCountdown] = useState(0);
  const [practiceBlobUrl, setPracticeBlobUrl] = useState<string | null>(null);

  // Conversational mode state
  const [currentAiPrompt, setCurrentAiPrompt] = useState<string>('');
  const [candidateTurnTranscript, setCandidateTurnTranscript] = useState<string>('');

  // Hardware states
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [streamReady, setStreamReady] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [testingMic, setTestingMic] = useState(false);
  const [micTestUrl, setMicTestUrl] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartTime = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micCheckFrameRef = useRef<number>(0);
  const speechTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fast-reference maps to eliminate async stale closures and race conditions
  const recordedBlobsRef = useRef<Map<string, Blob>>(new Map());
  const uploadedAnswerIdsRef = useRef<Set<string>>(new Set());

  const isConversational = session?.mode === 'conversational';
  const currentAnswer = answers[currentIndex];

  const practiceQuestionText =
    'Tell us about yourself, your background, and why you are interested in this position.';

  const voiceGender = 'female' as const;
  const cachedVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  // Helper to consistently find a voice matching the requested gender
  const getConsistentVoice = useCallback((gender: 'female' | 'male'): SpeechSynthesisVoice | null => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    const allVoices = window.speechSynthesis.getVoices();
    if (!allVoices || allVoices.length === 0) return null;

    const english = allVoices.filter((v) => v.lang.startsWith('en'));
    const pool = english.length > 0 ? english : allVoices;

    if (gender === 'female') {
      return (
        pool.find((v) => {
          const n = v.name.toLowerCase();
          return (
            n.includes('female') ||
            n.includes('samantha') ||
            n.includes('karen') ||
            n.includes('victoria') ||
            n.includes('zira') ||
            n.includes('jenny') ||
            n.includes('aria') ||
            n.includes('natural female') ||
            (n.includes('google') && !n.includes('male'))
          );
        }) ||
        pool.find((v) => !v.name.toLowerCase().includes('male') && !v.name.toLowerCase().includes('david')) ||
        pool[0]
      );
    } else {
      return (
        pool.find((v) => {
          const n = v.name.toLowerCase();
          return (
            n.includes('male') ||
            n.includes('david') ||
            n.includes('daniel') ||
            n.includes('guy') ||
            n.includes('george') ||
            n.includes('mark') ||
            n.includes('natural male')
          );
        }) || pool[0]
      );
    }
  }, []);

  // Preload and lock the voice immediately on component mount
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const updateVoice = () => {
      const v = getConsistentVoice(voiceGender);
      if (v) cachedVoiceRef.current = v;
    };

    updateVoice();
    if ('onvoiceschanged' in window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = updateVoice;
    }
    window.speechSynthesis.getVoices();
  }, [voiceGender, getConsistentVoice]);

  // Text-To-Speech helper: cleanly speaks the question aloud with a 100% consistent voice
  const speakText = useCallback((text: string, onDone: () => void) => {
    if (speechTimerRef.current) {
      clearTimeout(speechTimerRef.current);
      speechTimerRef.current = null;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();

      // Resolve voice consistently - never fall back to mismatched system voice
      let chosenVoice = cachedVoiceRef.current || getConsistentVoice(voiceGender);
      if (!chosenVoice) {
        // If voices array is still empty (Chrome initial load), retry synchronously or use first available
        const currentVoices = window.speechSynthesis.getVoices();
        if (currentVoices.length > 0) {
          chosenVoice = getConsistentVoice(voiceGender);
        }
      }
      if (chosenVoice) {
        cachedVoiceRef.current = chosenVoice;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      if (chosenVoice) {
        utterance.voice = chosenVoice;
      }

      let doneFired = false;
      const complete = () => {
        if (!doneFired) {
          doneFired = true;
          if (speechTimerRef.current) {
            clearTimeout(speechTimerRef.current);
            speechTimerRef.current = null;
          }
          onDone();
        }
      };

      utterance.onend = complete;
      utterance.onerror = complete;

      // Maximum safeguard timeout based on word count
      const safeMaxMs = Math.max(3000, text.length * 85);
      speechTimerRef.current = setTimeout(complete, safeMaxMs);

      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(onDone, 2000);
    }
  }, [voiceGender, getConsistentVoice]);

  const stopSpeaking = useCallback(() => {
    if (speechTimerRef.current) {
      clearTimeout(speechTimerRef.current);
      speechTimerRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, [stopSpeaking]);

  // Camera & Mic Initialization - Runs once on mount
  useEffect(() => {
    let active = true;

    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraError('no-device');
      return;
    }

    navigator.mediaDevices
      .getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: true,
      })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setMediaStream(stream);
        setCameraError(null);
        setStreamReady(true);
      })
      .catch((err) => {
        console.error('Camera access error:', err);
        if (!active) return;
        setCameraError(err.name === 'NotAllowedError' ? 'permission' : 'unknown');
      });

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      setMediaStream(null);
    };
  }, []);

  // Audio Level Analyser
  useEffect(() => {
    if (!streamRef.current || cameraError || !streamReady) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioCtx();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 128;
      const source = audioContext.createMediaStreamSource(streamRef.current);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
        setMicLevel(Math.min(avg / 45, 1));
        micCheckFrameRef.current = requestAnimationFrame(checkLevel);
      };
      checkLevel();
    } catch {
      // AudioContext unavailable
    }

    return () => {
      cancelAnimationFrame(micCheckFrameRef.current);
      audioContextRef.current?.close();
    };
  }, [streamReady, cameraError]);

  // Initial Data Fetch
  useEffect(() => {
    const loadSessionData = async () => {
      let res = await fetch(`${API_URL}/sessions/${sessionId}`).catch(() => null);
      if ((!res || !res.ok) && API_URL !== '/api') {
        res = await fetch(`/api/sessions/${sessionId}`).catch(() => null);
      }
      if (!res || !res.ok) {
        throw new Error('Session not found');
      }
      return res.json();
    };

    loadSessionData()
      .then((sess) => {
        if (typeof window !== 'undefined') {
          try {
            const urlParams = new URLSearchParams(window.location.search);
            const nameParam = urlParams.get('name');
            if (nameParam) {
              sess.candidate_name = nameParam;
              const map = JSON.parse(localStorage.getItem('questai_candidate_names') || '{}');
              map[sessionId] = nameParam;
              localStorage.setItem('questai_candidate_names', JSON.stringify(map));
            } else {
              const map = JSON.parse(localStorage.getItem('questai_candidate_names') || '{}');
              if (map[sessionId]) {
                sess.candidate_name = map[sessionId];
              }
            }
          } catch {}
        }
        setSession(sess);

        // Helper to format/generate fallback description if empty
        const getDefaultDescription = (titleStr?: string) => {
          const lower = (titleStr || '').toLowerCase();
          if (lower.includes('python')) {
            return 'Develop and maintain robust Python backend services, APIs, and data processing workflows. Collaborate with cross-functional teams to design scalable features, optimize database performance, and ensure clean, maintainable architecture.';
          }
          if (lower.includes('ai') || lower.includes('ml') || lower.includes('machine learning')) {
            return 'Build, evaluate, and deploy intelligent AI applications, prompt workflows, and retrieval-augmented generation (RAG) pipelines. Integrate modern LLMs, monitor performance, and ensure safe, reliable model responses.';
          }
          if (lower.includes('frontend') || lower.includes('react') || lower.includes('ui')) {
            return 'Lead the development of intuitive, accessible, and responsive user interfaces. Work with modern component architecture, optimize client-side rendering and media streaming, and build delightful candidate and recruiter experiences.';
          }
          if (lower.includes('full stack') || lower.includes('fullstack')) {
            return 'Build end-to-end features spanning responsive web applications, secure backend APIs, and reliable database architectures. Take ownership from feature conception to deployment in production.';
          }
          return 'Complete this video interview assessment to showcase your skills, problem-solving ability, and background to our hiring team.';
        };

        // 1. Check if job_role is already attached to session response
        let initialRole: JobRole | null = (sess as any).job_role || null;

        // 2. Check URL query parameters (?roleTitle=...&roleDesc=...&roleSkills=...)
        let paramTitle: string | null = null;
        let paramDesc: string | null = null;
        let paramSkills: string | null = null;
        if (typeof window !== 'undefined') {
          try {
            const urlParams = new URLSearchParams(window.location.search);
            paramTitle = urlParams.get('roleTitle');
            paramDesc = urlParams.get('roleDesc');
            paramSkills = urlParams.get('roleSkills');
          } catch {}
        }

        // 3. Check browser localStorage saved roles if candidate is testing in same environment
        if (!initialRole && typeof window !== 'undefined') {
          try {
            const storedRoles = JSON.parse(localStorage.getItem('questai_saved_roles') || '[]');
            const matched = storedRoles.find(
              (r: any) =>
                r.id === sess.job_role_id ||
                (paramTitle && r.title?.toLowerCase() === paramTitle.toLowerCase())
            );
            if (matched) {
              initialRole = matched;
            }
          } catch {}
        }

        // 4. Construct best available role immediately
        const resolvedTitle =
          initialRole?.title ||
          paramTitle ||
          (sess as any).job_role_title ||
          'Interview Candidate';
        const rawDesc =
          initialRole?.description ||
          paramDesc ||
          (sess as any).job_role_description;
        const resolvedDesc =
          rawDesc && rawDesc.trim() ? rawDesc.trim() : getDefaultDescription(resolvedTitle);
        const resolvedSkills =
          initialRole?.skills_required ||
          paramSkills ||
          (sess as any).skills_required ||
          null;

        setJobRole({
          id: sess.job_role_id || initialRole?.id || 'role-default',
          title: resolvedTitle,
          description: resolvedDesc,
          skills_required: resolvedSkills,
        });

        // 5. Also async-fetch from backend endpoints to enrich/sync with latest server state
        const fetchRoleAsync = async () => {
          let roleRes: Response | null = null;
          if (sess.job_role_id) {
            roleRes = await fetch(`${API_URL}/job-roles/${sess.job_role_id}`).catch(() => null);
            if ((!roleRes || !roleRes.ok) && API_URL !== '/api') {
              roleRes = await fetch(`/api/job-roles/${sess.job_role_id}`).catch(() => null);
            }
          }
          if (!roleRes || !roleRes.ok) {
            // Try fetching all job roles to match by id or title
            roleRes = await fetch(`/api/job-roles`).catch(() => null);
            if (roleRes && roleRes.ok) {
              const allRoles = await roleRes.json().catch(() => null);
              if (Array.isArray(allRoles)) {
                const found = allRoles.find(
                  (r: any) =>
                    r.id === sess.job_role_id ||
                    (paramTitle && r.title?.toLowerCase() === paramTitle.toLowerCase())
                );
                if (found) {
                  return found;
                }
              }
            }
            return null;
          }
          return roleRes.json().catch(() => null);
        };

        fetchRoleAsync().then((fetchedRole) => {
          if (fetchedRole) {
            const fTitle = fetchedRole.title || resolvedTitle;
            const fRawDesc = fetchedRole.description || rawDesc;
            const fDesc =
              fRawDesc && fRawDesc.trim() ? fRawDesc.trim() : getDefaultDescription(fTitle);
            setJobRole({
              id: fetchedRole.id || sess.job_role_id,
              title: fTitle,
              description: fDesc,
              skills_required: fetchedRole.skills_required || resolvedSkills,
            });
          }
        });

        // 1. Guard against retaking completed interviews
        let isAlreadySubmitted = false;
        if (sess.status === 'submitted' || sess.status === 'completed') {
          isAlreadySubmitted = true;
        }
        if (typeof window !== 'undefined') {
          try {
            const submittedMap = JSON.parse(localStorage.getItem('questai_submitted_sessions') || '{}');
            if (submittedMap[sessionId]) isAlreadySubmitted = true;
          } catch {}
        }

        if (isAlreadySubmitted) {
          setPhase('already_completed');
          return;
        }

        // 2. Guard against expired interview links (Assessment Window Closed)
        let deadlineIso: string | null = null;
        if (typeof window !== 'undefined') {
          try {
            const urlParams = new URLSearchParams(window.location.search);
            const expParam = urlParams.get('expires');
            if (expParam) {
              deadlineIso = expParam;
            } else {
              const deadMap = JSON.parse(localStorage.getItem('questai_session_deadlines') || '{}');
              if (deadMap[sessionId]) deadlineIso = deadMap[sessionId];
            }
          } catch {}
        }

        if (deadlineIso) {
          setExpiresAt(deadlineIso);
          const deadlineDate = new Date(deadlineIso);
          const now = new Date();
          if (now > deadlineDate) {
            setPhase('expired');
            return;
          }
        }

        // 3. Restore previous integrity tracking if returning
        if (typeof window !== 'undefined') {
          try {
            const integrityStore = JSON.parse(localStorage.getItem('questai_session_integrity') || '{}');
            if (integrityStore[sessionId]) {
              integrityMapRef.current = integrityStore[sessionId];
            }
          } catch {}
        }

        if (sess.mode === 'conversational') {
          const startConversational = async () => {
            let res: Response | null = null;
            if (API_URL !== '/api') {
              res = await fetch(`${API_URL}/sessions/${sessionId}/start`, { method: 'POST' }).catch(() => null);
            }
            if (!res || !res.ok) {
              res = await fetch(`/api/sessions/${sessionId}/start`, { method: 'POST' }).catch(() => null);
            }
            if (res && res.ok) {
              const data = await res.json().catch(() => null);
              if (data?.message) return data.message;
            }
            return 'Welcome to your interactive interview assessment. Please review the question below and share your thoughts.';
          };

          startConversational().then((msg) => {
            setCurrentAiPrompt(msg);
            setPhase('welcome');
          });
        } else {
          const fetchInterviewAnswers = async () => {
            let res: Response | null = null;
            if (API_URL !== '/api') {
              res = await fetch(`${API_URL}/sessions/${sessionId}/answers`).catch(() => null);
            }
            if (!res || !res.ok) {
              res = await fetch(`/api/sessions/${sessionId}/answers`).catch(() => null);
            }
            if (res && res.ok) {
              const data = await res.json().catch(() => null);
              if (Array.isArray(data) && data.length > 0) {
                return data;
              }
            }
            return null;
          };

          fetchInterviewAnswers().then((data) => {
            const rawAnswers: Answer[] = (data && data.length > 0) ? data : [
              {
                id: `ans-${sessionId}-1`,
                question_id: 'q1',
                question_text: 'Introduce yourself and share your core experience and strengths.',
                think_seconds: 30,
                answer_seconds: 90,
                status: 'pending',
              },
              {
                id: `ans-${sessionId}-2`,
                question_id: 'q2',
                question_text: 'Describe a challenging project problem you solved, your approach, and the final outcome.',
                think_seconds: 30,
                answer_seconds: 90,
                status: 'pending',
              },
            ];

            setAnswers(rawAnswers);

            // Compute resume question index if candidate is returning midway
            const firstUnansweredIdx = rawAnswers.findIndex(
              (a) => !a.video_url && a.status !== 'uploaded' && a.status !== 'completed'
            );

            let storedProgressIdx = 0;
            if (typeof window !== 'undefined') {
              try {
                const stored = localStorage.getItem(`questai_progress_${sessionId}`);
                if (stored !== null) storedProgressIdx = parseInt(stored, 10);
              } catch {}
            }

            let computedResumeIdx = 0;
            if (firstUnansweredIdx > 0) {
              computedResumeIdx = firstUnansweredIdx;
            } else if (firstUnansweredIdx === -1 && rawAnswers.length > 0) {
              computedResumeIdx = rawAnswers.length - 1;
            } else if (storedProgressIdx > 0 && storedProgressIdx < rawAnswers.length) {
              computedResumeIdx = storedProgressIdx;
            }

            if (computedResumeIdx > 0 && computedResumeIdx < rawAnswers.length) {
              setResumeQuestionIndex(computedResumeIdx);
            }

            setPhase('welcome');
          });
        }
      })
      .catch((err) => {
        console.error('Session load error:', err);
        setLoadError('Failed to load interview session. Please check your link.');
        setPhase('welcome');
      });
  }, [sessionId]);

  // Active Countdown for Expiry Deadline
  useEffect(() => {
    if (!expiresAt) return;

    const updateRemaining = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setDeadlineRemaining('Assessment window expired');
        if (phase !== 'complete' && phase !== 'already_completed') {
          setPhase('expired');
        }
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) {
        setDeadlineRemaining(`${days} day${days > 1 ? 's' : ''}, ${hours} hr${hours > 1 ? 's' : ''} left`);
      } else if (hours > 0) {
        setDeadlineRemaining(`${hours} hr${hours > 1 ? 's' : ''}, ${minutes} min left`);
      } else {
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setDeadlineRemaining(`${minutes}m ${seconds}s left`);
      }
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, phase]);

  // Tab-Switch & Focus Integrity Monitoring (tracks switches & unfocused duration)
  useEffect(() => {
    if (isPractice) return;
    if (phase !== 'thinking' && phase !== 'recording') return;
    if (!currentAnswer) return;

    const answerId = currentAnswer.id;

    const handleFocusLoss = () => {
      unfocusedStartRef.current = Date.now();

      const prev = integrityMapRef.current[answerId] || { switches: 0, unfocusedSeconds: 0 };
      integrityMapRef.current[answerId] = {
        ...prev,
        switches: prev.switches + 1,
      };

      if (typeof window !== 'undefined') {
        try {
          const store = JSON.parse(localStorage.getItem('questai_session_integrity') || '{}');
          store[sessionId] = integrityMapRef.current;
          localStorage.setItem('questai_session_integrity', JSON.stringify(store));
        } catch {}
      }

      setTabSwitchWarning(
        'Window Focus Alert: Please keep this interview tab active during your response. Focus changes are logged.'
      );
    };

    const handleFocusGain = () => {
      if (unfocusedStartRef.current) {
        const awaySeconds = Math.max(1, Math.round((Date.now() - unfocusedStartRef.current) / 1000));
        const prev = integrityMapRef.current[answerId] || { switches: 0, unfocusedSeconds: 0 };
        integrityMapRef.current[answerId] = {
          ...prev,
          unfocusedSeconds: prev.unfocusedSeconds + awaySeconds,
        };
        unfocusedStartRef.current = null;

        if (typeof window !== 'undefined') {
          try {
            const store = JSON.parse(localStorage.getItem('questai_session_integrity') || '{}');
            store[sessionId] = integrityMapRef.current;
            localStorage.setItem('questai_session_integrity', JSON.stringify(store));
          } catch {}
        }
      }

      const timer = setTimeout(() => {
        setTabSwitchWarning(null);
      }, 3500);
      return () => clearTimeout(timer);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleFocusLoss();
      } else {
        handleFocusGain();
      }
    };

    const onWindowBlur = () => {
      if (document.visibilityState === 'visible') {
        handleFocusLoss();
      }
    };

    const onWindowFocus = () => {
      handleFocusGain();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('focus', onWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('focus', onWindowFocus);
    };
  }, [phase, isPractice, currentAnswer, sessionId]);

  // Toggle Camera Track
  const handleToggleCamera = useCallback(() => {
    setCameraOn((prev) => {
      const next = !prev;
      if (streamRef.current) {
        streamRef.current.getVideoTracks().forEach((track) => {
          track.enabled = next;
        });
      }
      return next;
    });
  }, []);

  // Toggle Microphone Track
  const handleToggleMic = useCallback(() => {
    setMicOn((prev) => {
      const next = !prev;
      if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = next;
        });
      }
      return next;
    });
  }, []);

  // =========================================================================
  // RELIABLE BACKGROUND VIDEO UPLOAD
  // =========================================================================
  const uploadAnswer = async (answerId: string, blob: Blob): Promise<boolean> => {
    setUploadProgressStatus((prev) => ({ ...prev, [answerId]: 'uploading' }));
    let uploaded = false;

    let supabaseVideoUrl: string | null = null;

    // 1. Direct Supabase storage upload if configured
    try {
      if (supabase && (supabase as any).storage) {
        const filePath = `${sessionId}/${answerId}.webm`;
        const { data: storageData, error: storageErr } = await supabase.storage
          .from('interview-videos')
          .upload(filePath, blob, {
            contentType: 'video/webm',
            upsert: true,
          });

        if (!storageErr && storageData) {
          const { data: pubData } = supabase.storage
            .from('interview-videos')
            .getPublicUrl(filePath);
          if (pubData?.publicUrl) {
            supabaseVideoUrl = pubData.publicUrl;
            uploaded = true;
            console.log(`[Supabase Upload Success] Uploaded candidate recording to: ${supabaseVideoUrl}`);
          }
        } else if (storageErr) {
          console.warn('[Supabase Upload Notice]:', storageErr.message || storageErr);
        }
      }
    } catch (storageException) {
      console.warn('Supabase storage direct upload fallback:', storageException);
    }

    // 2. Local Next.js upload endpoint (saves and performs server-side Supabase sync)
    try {
      const localFormData = new FormData();
      localFormData.append('file', blob, `${answerId}.webm`);
      if (supabaseVideoUrl) {
        localFormData.append('video_url', supabaseVideoUrl);
      }
      const localRes = await fetch(`/api/sessions/${sessionId}/answers/${answerId}/upload`, {
        method: 'POST',
        body: localFormData,
      });
      if (localRes.ok) {
        uploaded = true;
        const resJson = await localRes.json().catch(() => null);
        if (resJson?.video_url && typeof resJson.video_url === 'string' && resJson.video_url.startsWith('http')) {
          supabaseVideoUrl = resJson.video_url;
        }
      }
    } catch (localErr) {
      console.warn(`Upload endpoint warning for ${answerId}:`, localErr);
    }

    // 3. Try external API_URL if configured and not /api
    if (API_URL !== '/api') {
      try {
        const formData = new FormData();
        formData.append('file', blob, `${answerId}.webm`);
        if (supabaseVideoUrl) {
          formData.append('video_url', supabaseVideoUrl);
        }
        const res = await fetch(`${API_URL}/sessions/${sessionId}/answers/${answerId}/upload`, {
          method: 'POST',
          body: formData,
        });
        if (res.ok) {
          uploaded = true;
        }
      } catch {
        // Handled by local endpoint
      }
    }

    if (uploaded) {
      uploadedAnswerIdsRef.current.add(answerId);
      setUploadProgressStatus((prev) => ({ ...prev, [answerId]: 'uploaded' }));
    } else {
      setUploadProgressStatus((prev) => ({ ...prev, [answerId]: 'failed' }));
    }

    return uploaded;
  };

  // =========================================================================
  // PRACTICE INTERVIEW WORKFLOW (Automatic TTS Reading -> Prep -> Recording)
  // =========================================================================
  const startPracticeWorkflow = () => {
    if (typeof document !== 'undefined' && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    stopSpeaking();
    setIsPractice(true);
    setPracticeBlobUrl(null);
    setPracticePhase('speaking');

    // Automatically speak the practice question aloud
    speakText(practiceQuestionText, () => {
      setPracticePhase('thinking');
      setPracticeCountdown(15);
    });
  };

  const skipPracticeSpeaking = () => {
    stopSpeaking();
    setPracticePhase('thinking');
    setPracticeCountdown(15);
  };

  const skipPracticeThinking = () => {
    startPracticeRecording();
  };

  const startPracticeRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
      ? 'video/webm;codecs=vp8,opus'
      : 'video/webm';

    try {
      const recorder = new MediaRecorder(streamRef.current, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const rawBlob = new Blob(chunksRef.current, { type: mimeType });
        const duration = Date.now() - recordingStartTime.current;
        try {
          fixWebmDuration(rawBlob, duration, (fixedBlob: Blob) => {
            const url = URL.createObjectURL(fixedBlob || rawBlob);
            setPracticeBlobUrl(url);
            setPracticePhase('review');
          });
        } catch {
          const url = URL.createObjectURL(rawBlob);
          setPracticeBlobUrl(url);
          setPracticePhase('review');
        }
      };

      mediaRecorderRef.current = recorder;
      recordingStartTime.current = Date.now();
      recorder.start(1000);
      setPracticePhase('recording');
      setPracticeCountdown(30);
    } catch (err) {
      console.error('Failed to start practice recorder:', err);
    }
  };

  const stopPracticeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  // Practice countdown timer
  useEffect(() => {
    if (!isPractice) return;
    if (practicePhase !== 'thinking' && practicePhase !== 'recording') return;

    if (practiceCountdown <= 0) {
      if (practicePhase === 'thinking') {
        startPracticeRecording();
      } else if (practicePhase === 'recording') {
        stopPracticeRecording();
      }
      return;
    }

    const t = setTimeout(() => setPracticeCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [practiceCountdown, practicePhase, isPractice]);

  // Transition from Practice directly to Real Interview
  const proceedToRealInterview = () => {
    stopSpeaking();
    setIsPractice(false);
    if (practiceBlobUrl) {
      URL.revokeObjectURL(practiceBlobUrl);
      setPracticeBlobUrl(null);
    }
    startRealInterviewFromIntro(resumeQuestionIndex || 0);
  };

  // =========================================================================
  // REAL INTERVIEW WORKFLOW (Automatic TTS Reading -> Prep -> Recording)
  // =========================================================================
  const startRealInterviewFromIntro = (targetIndex?: number) => {
    if (typeof document !== 'undefined' && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    stopSpeaking();
    setIsPractice(false);
    const startIdx = typeof targetIndex === 'number' ? targetIndex : (resumeQuestionIndex || 0);
    setCurrentIndex(startIdx);

    const targetQ = answers[startIdx] || answers[0];
    if (targetQ) {
      setPhase('speaking');
      speakText(targetQ.question_text, () => {
        setPhase('thinking');
        setCountdown(targetQ.think_seconds || 30);
      });
    } else {
      setPhase('thinking');
      setCountdown(30);
    }
  };

  const skipRealSpeaking = () => {
    stopSpeaking();
    setPhase('thinking');
    setCountdown(currentAnswer?.think_seconds || 30);
  };

  const skipRealThinking = () => {
    startRealRecording();
  };

  const startRealRecording = () => {
    if (!streamRef.current || cameraError) return;
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
      ? 'video/webm;codecs=vp8,opus'
      : 'video/webm';

    try {
      const recorder = new MediaRecorder(streamRef.current, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const rawBlob = new Blob(chunksRef.current, { type: mimeType });
        const duration = Date.now() - recordingStartTime.current;

        const handleFinalBlob = (blobToSave: Blob) => {
          if (currentAnswer) {
            recordedBlobsRef.current.set(currentAnswer.id, blobToSave);
            setPhase('stopped');
            // Trigger instant progressive background upload
            uploadAnswer(currentAnswer.id, blobToSave);
          }
        };

        try {
          fixWebmDuration(rawBlob, duration, (fixedBlob: Blob) => {
            handleFinalBlob(fixedBlob || rawBlob);
          });
        } catch {
          handleFinalBlob(rawBlob);
        }
      };

      mediaRecorderRef.current = recorder;
      recordingStartTime.current = Date.now();
      recorder.start(1000);
      setPhase('recording');
      setCountdown(currentAnswer?.answer_seconds || 90);
    } catch (err) {
      console.error('Failed to start real recorder:', err);
    }
  };

  const stopRealRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const startRealRecordingRef = useRef(startRealRecording);
  const stopRealRecordingRef = useRef(stopRealRecording);

  useEffect(() => {
    startRealRecordingRef.current = startRealRecording;
    stopRealRecordingRef.current = stopRealRecording;
  });

  // Real countdown timer
  useEffect(() => {
    if (isPractice) return;
    if (phase !== 'thinking' && phase !== 'recording') return;

    if (countdown <= 0) {
      if (phase === 'thinking') startRealRecordingRef.current();
      else stopRealRecordingRef.current();
      return;
    }

    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, phase, isPractice]);

  // Next Question auto-advances directly into speaking the next question
  const goToNextQuestion = () => {
    stopSpeaking();
    if (currentIndex + 1 < answers.length) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setResumeQuestionIndex(nextIdx);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(`questai_progress_${sessionId}`, String(nextIdx));
        } catch {}
      }
      const nextQ = answers[nextIdx];
      setPhase('speaking');
      speakText(nextQ.question_text, () => {
        setPhase('thinking');
        setCountdown(nextQ.think_seconds || 30);
      });
    } else {
      submitAllAnswers();
    }
  };

  const submitAllAnswers = async () => {
    stopSpeaking();
    setSubmitting(true);
    setUploadError(null);

    try {
      // 1. Ensure all answers recorded in ref are uploaded
      const uploadPromises: Promise<boolean>[] = [];
      for (const [ansId, blob] of recordedBlobsRef.current.entries()) {
        if (!uploadedAnswerIdsRef.current.has(ansId)) {
          uploadPromises.push(uploadAnswer(ansId, blob));
        }
      }

      if (uploadPromises.length > 0) {
        await Promise.all(uploadPromises);
      }

      // 2. Submit session to mark completion (prioritizing FastAPI on Render)
      let submitRes: Response | null = null;
      if (API_URL !== '/api') {
        try {
          const extUrl = API_URL.startsWith('http')
            ? `${API_URL}/sessions/${sessionId}/submit`
            : `${API_URL}/sessions/${sessionId}/submit`;
          submitRes = await fetch(extUrl, { method: 'POST' });
        } catch (extErr) {
          console.warn('External submit notice:', extErr);
        }
      }

      // Also notify local/Supabase endpoint
      try {
        const localRes = await fetch(`/api/sessions/${sessionId}/submit`, { method: 'POST' });
        if (!submitRes || !submitRes.ok) {
          submitRes = localRes;
        }
      } catch (localErr) {
        console.warn('Local submit notice:', localErr);
      }

      // Record submitted tombstone and clear progress
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem(`questai_progress_${sessionId}`);
          const map = JSON.parse(localStorage.getItem('questai_submitted_sessions') || '{}');
          map[sessionId] = true;
          localStorage.setItem('questai_submitted_sessions', JSON.stringify(map));
        } catch {}
      }

      setPhase('complete');
    } catch (err: any) {
      console.error('Final submission error:', err);
      setUploadError(err?.message || 'Failed to complete final submission. Please check connection and click retry.');
    } finally {
      setSubmitting(false);
    }
  };

  // Conversational Turn Handler
  const handleNextTurnConversational = async () => {
    stopSpeaking();
    setSubmitting(true);
    try {
      let res: Response | null = null;
      const turnBody = JSON.stringify({
        transcript: candidateTurnTranscript || 'Candidate spoken response recorded on camera.',
      });

      if (API_URL !== '/api') {
        try {
          res = await fetch(`${API_URL}/sessions/${sessionId}/turns`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: turnBody,
          });
        } catch {
          res = null;
        }
      }

      if (!res || !res.ok) {
        res = await fetch(`/api/sessions/${sessionId}/turns`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: turnBody,
        }).catch(() => null);
      }

      if (!res || !res.ok) {
        throw new Error('Failed to process conversation turn');
      }

      const data = await res.json();
      setCandidateTurnTranscript('');

      if (data.action === 'conclude') {
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem(`questai_progress_${sessionId}`);
            const map = JSON.parse(localStorage.getItem('questai_submitted_sessions') || '{}');
            map[sessionId] = true;
            localStorage.setItem('questai_submitted_sessions', JSON.stringify(map));
          } catch {}
        }
        setPhase('complete');
      } else {
        setCurrentAiPrompt(data.message);
        setPhase('speaking');
        speakText(data.message, () => {
          setPhase('thinking');
          setCountdown(20);
        });
      }
    } catch (err) {
      console.warn('Conversational turn warning:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Audio testing helpers for Intro Screen
  const testSpeakerChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch {
      // Audio unavailable
    }
  };

  const testMic = () => {
    if (!streamRef.current) return;
    setTestingMic(true);
    setMicTestUrl(null);

    const audioOnlyStream = new MediaStream(streamRef.current.getAudioTracks());
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(audioOnlyStream);

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      setMicTestUrl(URL.createObjectURL(blob));
      setTestingMic(false);
    };

    recorder.start();
    setTimeout(() => recorder.stop(), 2500);
  };

  // =========================================================================
  // RENDER FLOWS
  // =========================================================================

  // 1. Initial Loading
  if (phase === 'loading') {
    return (
      <Shell>
        <div className="text-center space-y-3 py-16">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="text-sm font-medium text-slate-300">Connecting to QuestAI Assessment...</div>
          <p className="text-xs text-slate-500">Preparing candidate interview environment</p>
        </div>
      </Shell>
    );
  }

  // 1.5. WELCOME & JOB OVERVIEW SCREEN (Screen 1)
  if (phase === 'welcome') {
    const skillsList = jobRole?.skills_required
      ? jobRole.skills_required
          .split(/[,•\n]+/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-3xl space-y-4 sm:space-y-5 animate-in fade-in duration-200">
          {/* Header Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-8 space-y-4 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-950/70 border border-blue-800/80 text-xs font-semibold text-blue-300">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>QuestAI Candidate Assessment</span>
              </div>

              {expiresAt && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/60 border border-amber-800/80 text-xs font-semibold text-amber-300">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    Deadline: {deadlineRemaining || new Date(expiresAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {jobRole?.title || 'Job Interview Assessment'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {session?.candidate_name
                  ? `Welcome, ${session.candidate_name}. You have been invited to complete this video interview assessment.`
                  : 'Welcome! You have been invited to complete this one-way video interview assessment.'}
              </p>
            </div>

            {/* Job Description & Core Skills */}
            <div className="pt-3 border-t border-slate-800/80 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <Briefcase className="w-3.5 h-3.5 text-blue-400" />
                <span>Job Overview & Description</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-slate-950/60 p-4 rounded-2xl border border-slate-800/60 whitespace-pre-line">
                {jobRole?.description ||
                  'Complete the video interview assessment to showcase your skills, problem-solving ability, and background to our hiring team.'}
              </p>

              {skillsList.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-xs font-medium text-slate-400">Target Skills Evaluated:</span>
                  <div className="flex flex-wrap gap-2">
                    {skillsList.map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg bg-blue-950/40 border border-blue-800/60 text-blue-300 text-xs font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Assessment Structure & Key Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 sm:p-4 text-center space-y-1">
              <span className="text-xs text-slate-400 font-medium">Questions</span>
              <div className="text-xl sm:text-2xl font-bold text-white">
                {answers.length || 1}
              </div>
              <span className="text-[11px] text-slate-500 block">One-way video</span>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 sm:p-4 text-center space-y-1">
              <span className="text-xs text-slate-400 font-medium">Prep Time</span>
              <div className="text-xl sm:text-2xl font-bold text-amber-400">
                30s
              </div>
              <span className="text-[11px] text-slate-500 block">Per question</span>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 sm:p-4 text-center space-y-1">
              <span className="text-xs text-slate-400 font-medium">Answer Limit</span>
              <div className="text-xl sm:text-2xl font-bold text-blue-400">
                90s
              </div>
              <span className="text-[11px] text-slate-500 block">Max response</span>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 sm:p-4 text-center space-y-1">
              <span className="text-xs text-slate-400 font-medium">Integrity</span>
              <div className="text-xl sm:text-2xl font-bold text-emerald-400 flex items-center justify-center gap-1">
                <ShieldAlert className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-[11px] text-slate-500 block">Focus tracked</span>
            </div>
          </div>

          {/* Guidelines & Proctoring Checklist */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" />
              <span>Assessment Instructions & Best Practices</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-xs text-slate-300">
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950/40 border border-slate-800/60">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white block">Quiet Environment</span>
                  <span>Ensure your room is well-lit, quiet, and free from background interruptions.</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950/40 border border-slate-800/60">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white block">Camera & Mic Testing</span>
                  <span>On the next screen, you will preview your video and test your microphone.</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950/40 border border-slate-800/60">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white block">Single-Take Recording</span>
                  <span>Each question is recorded in a single take. You can try a practice question first.</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950/40 border border-slate-800/60">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white block">Focus & Tab-Switch Tracking</span>
                  <span>Switching tabs or minimizing the browser window during questions is recorded.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Resume In-Progress Warning if Candidate Returning */}
          {resumeQuestionIndex > 0 && (
            <div className="p-4 bg-blue-950/50 border border-blue-800 rounded-2xl flex items-start gap-3 text-xs">
              <div className="w-8 h-8 rounded-xl bg-blue-900/80 text-blue-300 border border-blue-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="space-y-0.5">
                <span className="font-semibold text-white">In-Progress Assessment Found</span>
                <p className="text-slate-300 leading-relaxed">
                  You previously answered {resumeQuestionIndex} of {answers.length} questions. Your recorded videos are safely saved on the server. You will resume from Question {resumeQuestionIndex + 1}.
                </p>
              </div>
            </div>
          )}

          {/* Primary Action Button */}
          <button
            onClick={() => {
              if (typeof document !== 'undefined' && !document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
              }
              setPhase('intro');
            }}
            className="w-full py-3.5 sm:py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-2xl text-base sm:text-lg transition-all shadow-xl shadow-blue-500/25 flex items-center justify-center gap-2 group"
          >
            <span>
              {resumeQuestionIndex > 0
                ? `Resume Assessment (Question ${resumeQuestionIndex + 1} of ${answers.length})`
                : 'Continue to Hardware Check'}
            </span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    );
  }

  // 2. ALREADY COMPLETED & LOCKED SCREEN (Prevents multiple attempts on completed interview link)
  if (phase === 'already_completed') {
    return (
      <Shell>
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-10 text-center space-y-5 shadow-2xl animate-in fade-in duration-200">
          <div className="w-16 h-16 rounded-3xl bg-blue-950/60 text-blue-400 border border-blue-800/80 mx-auto flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-800 text-xs font-semibold text-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Assessment Completed & Locked</span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Interview Already Completed</h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
              This interview assessment has already been completed and submitted for evaluation. Multiple attempts on the same interview link are not permitted.
            </p>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 text-left max-w-md mx-auto space-y-2 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-slate-800/60 text-slate-400">
              <span>Job Position</span>
              <span className="font-semibold text-slate-200">{jobRole?.title || 'Job Assessment'}</span>
            </div>
            {session?.candidate_name && (
              <div className="flex items-center justify-between py-1 border-b border-slate-800/60 text-slate-400">
                <span>Candidate</span>
                <span className="font-semibold text-slate-200">{session.candidate_name}</span>
              </div>
            )}
            <div className="flex items-center justify-between py-1 text-slate-400">
              <span>Submission Status</span>
              <span className="font-semibold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Submitted to Hiring Team
              </span>
            </div>
          </div>

          <div className="pt-2 text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            If you experienced an unexpected network disconnect or need a retake approved, please contact the recruitment team.
          </div>
        </div>
      </Shell>
    );
  }

  // 3. EXPIRED INTERVIEW LINK SCREEN (Assessment Window Closed)
  if (phase === 'expired') {
    return (
      <Shell>
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-10 text-center space-y-5 shadow-2xl animate-in fade-in duration-200">
          <div className="w-16 h-16 rounded-3xl bg-amber-950/60 text-amber-400 border border-amber-800/80 mx-auto flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Clock className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/80 border border-amber-800 text-xs font-semibold text-amber-300">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Assessment Window Closed</span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Interview Link Expired</h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
              The submission deadline for this interview assessment has passed. Expired assessment links can no longer be accessed or submitted.
            </p>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 text-left max-w-md mx-auto space-y-2 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-slate-800/60 text-slate-400">
              <span>Job Position</span>
              <span className="font-semibold text-slate-200">{jobRole?.title || 'Job Assessment'}</span>
            </div>
            {session?.candidate_name && (
              <div className="flex items-center justify-between py-1 border-b border-slate-800/60 text-slate-400">
                <span>Candidate</span>
                <span className="font-semibold text-slate-200">{session.candidate_name}</span>
              </div>
            )}
            {expiresAt && (
              <div className="flex items-center justify-between py-1 border-b border-slate-800/60 text-slate-400">
                <span>Expiration Deadline</span>
                <span className="font-semibold text-amber-300">
                  {new Date(expiresAt).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between py-1 text-slate-400">
              <span>Link Status</span>
              <span className="font-semibold text-red-400 flex items-center gap-1">
                <span>Closed</span>
              </span>
            </div>
          </div>

          <div className="pt-2 text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            If you need an extension or a new link to complete this evaluation, please contact your recruiter or hiring team directly.
          </div>
        </div>
      </Shell>
    );
  }

  // 4. COMPLETION SCREEN
  if (phase === 'complete') {
    return (
      <Shell>
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-10 text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 rounded-3xl bg-emerald-950/60 text-emerald-400 border border-emerald-800/80 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-white">Interview Complete!</h2>
            <p className="text-sm text-slate-300 max-w-md mx-auto">
              Your video recordings and answers have been securely submitted to the hiring team for evaluation.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-800 text-xs text-slate-500">
            You may now safely close this window.
          </div>
        </div>
      </Shell>
    );
  }


  // 5. PRACTICE MODE VIEW (Center-Stage Full Video Layout)
  if (isPractice) {
    return (
      <ViewportStudioShell
        headerLeft={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-950/60 border border-purple-800/80 text-xs font-semibold text-purple-300">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Practice Simulation (Unscored Warm-Up)</span>
            </div>
          </div>
        }
        headerRight={
          <div className="flex items-center gap-2">
            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-slate-200 hover:text-white text-xs font-medium transition-all shadow-sm"
              title={isFullscreen ? 'Exit Full Screen' : 'Enter Full Screen'}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-blue-400" />
                  <span className="hidden sm:inline">Exit Fullscreen</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
                  <span className="hidden sm:inline">Full Screen</span>
                </>
              )}
            </button>
            <button
              onClick={proceedToRealInterview}
              className="text-xs text-slate-300 hover:text-white underline px-2 py-1 transition-colors font-medium"
            >
              Skip to Real Interview →
            </button>
          </div>
        }
      >
        <div className="w-full flex-1 flex flex-col items-center justify-center min-h-0 relative">
          <div className="w-full max-w-5xl h-full max-h-[82vh] md:max-h-[86vh] aspect-video relative flex flex-col justify-center">
            {practicePhase === 'review' ? (
              <div className="relative rounded-3xl overflow-hidden bg-black w-full h-full border-2 border-purple-500/80 shadow-2xl">
                {practiceBlobUrl ? (
                  <video
                    src={practiceBlobUrl}
                    controls
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                    Practice video recorded
                  </div>
                )}
                <div className="absolute top-3 left-3 bg-purple-900/90 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full border border-purple-700 z-10 shadow-md">
                  Practice Video Review
                </div>

                {/* Bottom Overlay: Guidance & Buttons without black boxes covering the face */}
                <div className="absolute bottom-12 sm:bottom-14 left-4 right-4 sm:left-6 sm:right-6 flex flex-col items-center gap-2.5 z-20 pointer-events-none">
                  {/* Clean text with high contrast drop shadow - NO black box card */}
                  <div className="text-center pointer-events-auto max-w-xl mx-auto drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
                    <div className="flex items-center justify-center gap-1.5 text-xs sm:text-sm font-bold text-emerald-300 drop-shadow-[0_1px_4px_rgba(0,0,0,1)]">
                      <CheckCheck className="w-4 h-4 text-emerald-400" />
                      <span>Practice Question Complete!</span>
                    </div>
                    <p className="text-xs sm:text-sm text-white font-medium drop-shadow-[0_1px_4px_rgba(0,0,0,1)] mt-0.5">
                      Play your recording to verify camera framing, lighting, and audio volume.
                    </p>
                  </div>

                  {/* Clean buttons directly on screen - NO enclosing black background box */}
                  <div className="flex items-center justify-center gap-3 pointer-events-auto">
                    <button
                      onClick={startPracticeWorkflow}
                      className="px-4 py-2 rounded-full bg-slate-900/60 hover:bg-slate-900/90 backdrop-blur-sm border border-slate-400/30 text-white text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 shadow-lg hover:border-slate-300/50"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-purple-300" />
                      <span>Retake Practice</span>
                    </button>

                    <button
                      onClick={proceedToRealInterview}
                      className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-full text-xs sm:text-sm transition-all shadow-lg shadow-blue-500/30 flex items-center gap-2"
                    >
                      <span>Proceed to Real Interview</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <CameraFrame
                stream={mediaStream}
                ring={
                  practicePhase === 'recording'
                    ? 'recording'
                    : practicePhase === 'speaking'
                    ? 'speaking'
                    : 'thinking'
                }
                error={cameraError}
                cameraOn={cameraOn}
                micOn={micOn}
                onToggleCamera={handleToggleCamera}
                onToggleMic={handleToggleMic}
                label="PRACTICE PREVIEW"
              >
                {/* Bottom Overlay: Question & Controls without black box covering face */}
                <div className="absolute bottom-3 left-3 right-3 sm:left-6 sm:right-6 flex flex-col items-center gap-2 z-20 pointer-events-none">
                  {/* Clean Question Text with text-shadow - NO black box card */}
                  <div className="w-full max-w-2xl text-center pointer-events-auto drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
                    <div className="flex items-center justify-center gap-2 text-xs font-bold text-purple-300 mb-1 drop-shadow-[0_1px_4px_rgba(0,0,0,1)]">
                      <Bot className="w-3.5 h-3.5" />
                      <span>Practice Warm-Up Question</span>
                      {practicePhase === 'speaking' && <span className="text-[11px] text-purple-200 font-normal">• AI is asking...</span>}
                      {practicePhase === 'thinking' && <span className="text-[11px] text-amber-300 font-normal">• Prep Time</span>}
                      {practicePhase === 'recording' && <span className="text-[11px] text-red-300 font-normal">• Recording</span>}
                    </div>
                    <p className="text-sm sm:text-base font-semibold text-white leading-snug drop-shadow-[0_2px_8px_rgba(0,0,0,1)] px-3">
                      {practiceQuestionText}
                    </p>
                  </div>

                  {/* Buttons & Controls directly - NO enclosing black background box */}
                  <div className="flex flex-wrap items-center justify-center gap-2.5 pointer-events-auto">
                    {practicePhase === 'recording' && (
                      <div className="bg-black/40 backdrop-blur-sm px-2.5 py-1.5 rounded-full border border-white/20">
                        <MicVisualizer level={micLevel} />
                      </div>
                    )}

                    {/* Camera & Mic Toggles */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={handleToggleCamera}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-md ${
                          cameraOn ? 'bg-black/50 hover:bg-black/75 text-white border border-white/20' : 'bg-red-600 text-white border border-red-400'
                        }`}
                        title={cameraOn ? 'Turn camera off' : 'Turn camera on'}
                      >
                        {cameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                      </button>

                      <button
                        onClick={handleToggleMic}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-md ${
                          micOn ? 'bg-black/50 hover:bg-black/75 text-white border border-white/20' : 'bg-red-600 text-white border border-red-400'
                        }`}
                        title={micOn ? 'Turn mic off' : 'Turn mic on'}
                      >
                        {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Action button */}
                    {practicePhase === 'speaking' && (
                      <button
                        onClick={skipPracticeSpeaking}
                        className="px-4 py-2 rounded-full bg-slate-900/60 hover:bg-slate-900/90 text-white text-xs font-semibold flex items-center gap-1.5 transition-all border border-slate-400/30 backdrop-blur-sm shadow-lg"
                      >
                        <SkipForward className="w-3.5 h-3.5 text-purple-300" />
                        <span>Skip to Prep</span>
                      </button>
                    )}

                    {practicePhase === 'thinking' && (
                      <button
                        onClick={skipPracticeThinking}
                        className="px-4 py-2 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-lg"
                      >
                        <span>Start Answering Now ({practiceCountdown}s)</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}

                    {practicePhase === 'recording' && (
                      <button
                        onClick={stopPracticeRecording}
                        className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-full text-xs sm:text-sm transition-all flex items-center gap-2 shadow-lg shadow-red-500/30"
                      >
                        <Square className="w-3.5 h-3.5 fill-white" />
                        <span>Finished Speaking ({practiceCountdown}s)</span>
                      </button>
                    )}
                  </div>
                </div>
              </CameraFrame>
            )}
          </div>
        </div>
      </ViewportStudioShell>
    );
  }

  // 6. INTRO / HARDWARE VERIFICATION SCREEN (Center-Stage Full Video Layout)
  if (phase === 'intro') {
    return (
      <ViewportStudioShell
        headerLeft={
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setPhase('welcome')}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-colors shrink-0"
              title="Return to Job Overview & Instructions"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Job Overview</span>
            </button>
            <div className="h-4 w-[1px] bg-slate-800 hidden sm:block shrink-0" />
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-400 flex items-center gap-1 shrink-0">
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">QuestAI Setup</span>
              </span>
              <span className="text-slate-500 hidden sm:inline">•</span>
              <span className="text-xs font-medium text-slate-300 truncate max-w-[150px] sm:max-w-xs">
                {jobRole?.title || 'Job Assessment'}
              </span>
            </div>
          </div>
        }
        headerRight={
          <div className="flex items-center gap-2">
            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-slate-200 hover:text-white text-xs font-medium transition-all shadow-sm"
              title={isFullscreen ? 'Exit Full Screen' : 'Enter Full Screen'}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-blue-400" />
                  <span className="hidden sm:inline">Exit Fullscreen</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
                  <span className="hidden sm:inline">Full Screen</span>
                </>
              )}
            </button>

            <span className="text-[11px] text-emerald-400 font-mono bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-1 rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="hidden sm:inline">integrity tracked</span>
            </span>

            {expiresAt && (
              <span className="text-[11px] text-amber-300 bg-amber-950/40 border border-amber-800/60 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-amber-400" />
                <span className="hidden sm:inline">{deadlineRemaining || 'Active Deadline'}</span>
              </span>
            )}
          </div>
        }
      >
        <div className="w-full flex-1 flex flex-col items-center justify-center min-h-0 relative">
          <div className="w-full max-w-5xl h-full max-h-[82vh] md:max-h-[86vh] aspect-video relative flex flex-col justify-center">
            <CameraFrame
              stream={mediaStream}
              ring="idle"
              error={cameraError}
              onRetry={() => window.location.reload()}
              cameraOn={cameraOn}
              micOn={micOn}
              onToggleCamera={handleToggleCamera}
              onToggleMic={handleToggleMic}
              label="SETUP PREVIEW"
            >
              {/* Bottom Overlay: Guidance & Controls without black box covering face */}
              <div className="absolute bottom-3 left-3 right-3 sm:left-6 sm:right-6 flex flex-col items-center gap-2 z-20 pointer-events-none">
                {/* Clean Guidance Text - NO black box card */}
                <div className="w-full max-w-2xl text-center pointer-events-auto drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
                  <div className="flex items-center justify-center gap-2 text-xs font-bold text-blue-300 mb-0.5 drop-shadow-[0_1px_4px_rgba(0,0,0,1)]">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Hardware Readiness & Audio Check</span>
                    {resumeQuestionIndex > 0 && (
                      <span className="text-[11px] text-emerald-400 font-normal">
                        • Resuming from Question {resumeQuestionIndex + 1}
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-white font-medium drop-shadow-[0_1px_4px_rgba(0,0,0,1)]">
                    Verify camera framing and ensure your microphone registers sound before beginning your interview.
                  </p>
                  {micTestUrl && (
                    <div className="flex items-center justify-center gap-2 pt-1 mt-1">
                      <span className="text-[11px] text-slate-200 drop-shadow">Mic Playback:</span>
                      <audio controls src={micTestUrl} className="h-6" />
                    </div>
                  )}
                  {loadError && (
                    <div className="mt-1 text-xs text-amber-300 font-medium drop-shadow">
                      {loadError}
                    </div>
                  )}
                </div>

                {/* Clean Controls directly - NO enclosing black background box */}
                <div className="flex flex-wrap items-center justify-center gap-2.5 pointer-events-auto">
                  {/* Mic Visualizer */}
                  <div className="bg-black/40 backdrop-blur-sm px-2.5 py-1.5 rounded-full border border-white/20">
                    <MicVisualizer level={micLevel} />
                  </div>

                  {/* Camera & Mic Toggles */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleToggleCamera}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-md ${
                        cameraOn ? 'bg-black/50 hover:bg-black/75 text-white border border-white/20' : 'bg-red-600 text-white border border-red-400'
                      }`}
                      title={cameraOn ? 'Turn camera off' : 'Turn camera on'}
                    >
                      {cameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                    </button>

                    <button
                      onClick={handleToggleMic}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-md ${
                        micOn ? 'bg-black/50 hover:bg-black/75 text-white border border-white/20' : 'bg-red-600 text-white border border-red-400'
                      }`}
                      title={micOn ? 'Turn mic off' : 'Turn mic on'}
                    >
                      {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Audio Test Buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={testMic}
                      disabled={testingMic}
                      className="px-3 py-1.5 rounded-full text-xs font-medium bg-black/50 hover:bg-black/75 text-white border border-white/20 transition-all flex items-center gap-1.5 shadow-md"
                    >
                      <Mic className="w-3.5 h-3.5 text-blue-300" />
                      <span>{testingMic ? 'Recording 2s...' : 'Test Mic'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={testSpeakerChime}
                      className="px-3 py-1.5 rounded-full text-xs font-medium bg-black/50 hover:bg-black/75 text-white border border-white/20 transition-all flex items-center gap-1.5 shadow-md"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Test Speaker</span>
                    </button>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={startPracticeWorkflow}
                      disabled={!!cameraError}
                      className="px-3.5 py-1.5 rounded-full border border-purple-400/40 hover:border-purple-300 bg-purple-950/60 hover:bg-purple-900/80 text-purple-200 hover:text-white text-xs font-semibold transition-all flex items-center gap-1.5 shadow-md"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-purple-300" />
                      <span>Practice</span>
                    </button>

                    <button
                      onClick={() => startRealInterviewFromIntro(resumeQuestionIndex)}
                      disabled={!!cameraError}
                      className="px-4 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 text-white font-bold rounded-full text-xs sm:text-sm transition-all shadow-lg shadow-blue-500/25 flex items-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>
                        {resumeQuestionIndex > 0
                          ? `Resume (Q${resumeQuestionIndex + 1})`
                          : 'Start Real Interview'}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </CameraFrame>
          </div>
        </div>
      </ViewportStudioShell>
    );
  }

  // 7. LIVE REAL INTERVIEW STUDIO (Center-Stage Full Video Layout)
  return (
    <ViewportStudioShell
      headerLeft={
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5 shrink-0">
            <Bot className="w-3.5 h-3.5" />
            <span>
              {isConversational ? 'Interactive AI Assessment' : `Question ${currentIndex + 1} of ${answers.length}`}
            </span>
          </div>
          <span className="text-slate-600 hidden sm:inline shrink-0">•</span>
          <span className="text-xs text-slate-300 truncate max-w-[150px] sm:max-w-sm">
            {jobRole?.title || 'QuestAI'}
          </span>
        </div>
      }
      headerRight={
        <div className="flex items-center gap-2">
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-slate-200 hover:text-white text-xs font-medium transition-all shadow-sm"
            title={isFullscreen ? 'Exit Full Screen' : 'Enter Full Screen'}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">Exit Fullscreen</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">Full Screen</span>
              </>
            )}
          </button>

          <span className="text-[11px] text-emerald-400 font-mono bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="hidden sm:inline">focus tracked</span>
          </span>
        </div>
      }
    >
      {/* Tab-Switch / Focus Warning Alert */}
      {tabSwitchWarning && (
        <div className="mb-2 p-2.5 bg-amber-950/90 border border-amber-600 rounded-xl flex items-center gap-2 text-xs text-amber-200 animate-in fade-in shadow-xl shadow-amber-950/60 shrink-0 mx-auto max-w-4xl w-full">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="flex-1 truncate">
            <span className="font-semibold text-amber-300">Integrity Alert: </span>
            <span>{tabSwitchWarning}</span>
          </div>
        </div>
      )}

      <div className="w-full flex-1 flex flex-col items-center justify-center min-h-0 relative">
        <div className="w-full max-w-5xl h-full max-h-[82vh] md:max-h-[86vh] aspect-video relative flex flex-col justify-center">
          <CameraFrame
            stream={mediaStream}
            ring={
              phase === 'recording'
                ? 'recording'
                : phase === 'speaking'
                ? 'speaking'
                : phase === 'thinking'
                ? 'thinking'
                : 'idle'
            }
            error={cameraError}
            cameraOn={cameraOn}
            micOn={micOn}
            onToggleCamera={handleToggleCamera}
            onToggleMic={handleToggleMic}
            label="REAL INTERVIEW"
          >
            {/* Bottom Overlay: Question Text & Controls directly - NO black box covering face */}
            <div className="absolute bottom-3 left-3 right-3 sm:left-6 sm:right-6 flex flex-col items-center gap-2 z-20 pointer-events-none">
              {/* Question Text with high-contrast text shadow - NO black box card */}
              <div className="w-full max-w-2xl text-center pointer-events-auto drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
                <div className="flex items-center justify-center gap-2 text-xs font-bold text-blue-300 mb-1 drop-shadow-[0_1px_4px_rgba(0,0,0,1)]">
                  <Bot className="w-3.5 h-3.5" />
                  <span>
                    {isConversational ? 'AI Interview Prompt' : `Question ${currentIndex + 1} of ${answers.length}`}
                  </span>
                  {phase === 'speaking' && <span className="text-[11px] text-blue-200 font-normal">• AI is asking...</span>}
                  {phase === 'thinking' && <span className="text-[11px] text-amber-300 font-normal">• Prep Time</span>}
                  {phase === 'recording' && <span className="text-[11px] text-red-300 font-normal">• Recording Live</span>}
                  {phase === 'stopped' && <span className="text-[11px] text-emerald-300 font-normal">• Response Captured</span>}
                </div>
                <p className="text-sm sm:text-base md:text-lg font-semibold text-white leading-snug drop-shadow-[0_2px_8px_rgba(0,0,0,1)] px-3">
                  {isConversational ? currentAiPrompt : currentAnswer?.question_text}
                </p>
              </div>

              {/* Controls directly - NO enclosing black background box */}
              <div className="flex flex-wrap items-center justify-center gap-2.5 pointer-events-auto">
                {/* Audio visualizer */}
                <div className="bg-black/40 backdrop-blur-sm px-2.5 py-1.5 rounded-full border border-white/20">
                  <MicVisualizer level={micLevel} />
                </div>

                {/* Camera & Mic Toggles */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleToggleCamera}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-md ${
                      cameraOn ? 'bg-black/50 hover:bg-black/75 text-white border border-white/20' : 'bg-red-600 text-white border border-red-400'
                    }`}
                    title={cameraOn ? 'Turn camera off' : 'Turn camera on'}
                  >
                    {cameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={handleToggleMic}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-md ${
                      micOn ? 'bg-black/50 hover:bg-black/75 text-white border border-white/20' : 'bg-red-600 text-white border border-red-400'
                    }`}
                    title={micOn ? 'Turn mic off' : 'Turn mic on'}
                  >
                    {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  </button>
                </div>

                {/* Action Controls */}
                {phase === 'speaking' && (
                  <button
                    onClick={skipRealSpeaking}
                    className="px-4 py-2 rounded-full bg-slate-900/60 hover:bg-slate-900/90 text-white text-xs font-semibold flex items-center gap-1.5 transition-all border border-slate-400/30 backdrop-blur-sm shadow-lg"
                  >
                    <SkipForward className="w-3.5 h-3.5 text-blue-300" />
                    <span>Skip Voice & Prep</span>
                  </button>
                )}

                {phase === 'thinking' && (
                  <button
                    onClick={skipRealThinking}
                    className="px-4 py-2 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-lg"
                  >
                    <span>Start Answering Now ({countdown}s)</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}

                {phase === 'recording' && (
                  <button
                    onClick={stopRealRecording}
                    className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-full text-xs sm:text-sm transition-all flex items-center gap-2 shadow-lg shadow-red-500/30"
                  >
                    <Square className="w-3.5 h-3.5 fill-white" />
                    <span>Finished Speaking ({countdown}s)</span>
                  </button>
                )}

                {phase === 'stopped' && (
                  <div className="flex items-center gap-2">
                    {uploadProgressStatus[currentAnswer?.id || ''] === 'uploading' && (
                      <span className="text-xs text-blue-300 font-medium mr-1 flex items-center gap-1 drop-shadow">
                        <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                        <span>Saving...</span>
                      </span>
                    )}

                    {uploadError && (
                      <span className="text-xs text-red-400 font-medium mr-1 flex items-center gap-1 drop-shadow">
                        <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                        <span>{uploadError}</span>
                      </span>
                    )}

                    <button
                      onClick={isConversational ? handleNextTurnConversational : goToNextQuestion}
                      disabled={submitting}
                      className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-60 text-white font-bold rounded-full text-xs sm:text-sm transition-all shadow-lg shadow-blue-500/30 flex items-center gap-2"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Submitting...</span>
                        </>
                      ) : isConversational ? (
                        <>
                          <span>Next AI Turn</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      ) : currentIndex + 1 < answers.length ? (
                        <>
                          <span>Next Question ({currentIndex + 2} of {answers.length})</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      ) : (
                        <>
                          <span>Submit Final Assessment</span>
                          <CheckCircle2 className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </CameraFrame>
        </div>
      </div>
    </ViewportStudioShell>
  );
}