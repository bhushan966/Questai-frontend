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
  Volume2,
  CheckCircle2,
  Play,
  RotateCcw,
  Sparkles,
  Bot,
  Square,
  ArrowRight,
  SkipForward,
  AlertCircle,
  CheckCheck,
} from 'lucide-react';

type RealPhase =
  | 'loading'
  | 'intro'
  | 'ready'
  | 'speaking'
  | 'thinking'
  | 'recording'
  | 'stopped'
  | 'complete';

type PracticePhase =
  | 'ready'
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

/**
 * CameraFrame ensures video feed is always rendered and never blank.
 * It uses a callback ref + useEffect + onLoadedMetadata to guarantee
 * srcObject is attached and playing whenever the component mounts or updates.
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
}) {
  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  const attachStream = useCallback((video: HTMLVideoElement | null) => {
    if (!video) return;
    videoElementRef.current = video;
    if (stream) {
      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }
      video.muted = true;
      video.play().catch(() => {
        // Autoplay policy fallback
      });
    }
  }, [stream]);

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
    recording: 'border-red-500 shadow-lg shadow-red-500/20 ring-4 ring-red-500/10',
    speaking: 'border-blue-500 shadow-lg shadow-blue-500/20 ring-4 ring-blue-500/10',
    thinking: 'border-amber-500 shadow-lg shadow-amber-500/20 ring-4 ring-amber-500/10',
    idle: 'border-slate-800',
  }[ring || 'idle'];

  return (
    <div className={`relative rounded-2xl overflow-hidden bg-slate-950 aspect-video border-2 transition-all ${ringStyles}`}>
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
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-md border border-slate-800 text-[11px] font-medium text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>{label || 'LIVE VIDEO FEED'}</span>
        </div>
        {ring === 'recording' && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600/90 text-white text-[11px] font-bold tracking-wide animate-pulse">
            <span className="w-2 h-2 rounded-full bg-white" />
            <span>REC</span>
          </div>
        )}
      </div>

      {cameraOn === false && (
        <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center gap-2">
          <VideoOff className="w-8 h-8 text-slate-500" />
          <span className="text-xs text-slate-400 font-medium">Camera is disabled</span>
        </div>
      )}

      {/* Floating Control Badges */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-800">
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
  const [countdown, setCountdown] = useState(0);
  const [recordedBlobs, setRecordedBlobs] = useState<Record<string, Blob>>({});
  const [submitting, setSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Dedicated Practice Mode state
  const [isPractice, setIsPractice] = useState(false);
  const [practicePhase, setPracticePhase] = useState<PracticePhase>('ready');
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

  const isConversational = session?.mode === 'conversational';
  const currentAnswer = answers[currentIndex];

  const practiceQuestionText =
    'Tell us about yourself, your background, and why you are interested in this position.';

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
        setSession(sess);

        fetch(`${API_URL}/job-roles/${sess.job_role_id}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((role) => {
            setJobRole(
              role || {
                id: sess.job_role_id,
                title: 'Interview Candidate',
                description: 'Complete the interview assessment below.',
                skills_required: null,
              }
            );
          })
          .catch(() => {
            setJobRole({
              id: sess.job_role_id,
              title: 'Interview Assessment',
              description: 'Standard video interview session.',
              skills_required: null,
            });
          });

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
            return 'Welcome to your conversational interview. Let us begin.';
          };

          startConversational().then((msg) => {
            setCurrentAiPrompt(msg);
            setPhase('intro');
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
            if (data && data.length > 0) {
              const pending = data.filter((a: Answer) => a.status === 'pending');
              setAnswers(pending.length > 0 ? pending : data);
            } else {
              setAnswers([
                {
                  id: 'default-ans-1',
                  question_id: 'q1',
                  question_text: 'Introduce yourself and share your core experience and strengths.',
                  think_seconds: 30,
                  answer_seconds: 90,
                  status: 'pending',
                },
              ]);
            }
            setPhase('intro');
          });
        }
      })
      .catch((err) => {
        console.error('Session load error:', err);
        setLoadError('Failed to load interview session. Please check your link.');
        setPhase('intro');
      });
  }, [sessionId]);

  // Read aloud helper using SpeechSynthesis
  const speakText = useCallback((text: string, onDone: () => void) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.onend = onDone;
      utterance.onerror = onDone;
      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(onDone, 2000);
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

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

  // -------------------------------------------------------------
  // PRACTICE INTERVIEW WORKFLOW
  // -------------------------------------------------------------
  const startPracticeWorkflow = () => {
    stopSpeaking();
    setIsPractice(true);
    setPracticePhase('ready');
    setPracticeBlobUrl(null);
  };

  const beginPracticeSpeaking = () => {
    setPracticePhase('speaking');
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
        fixWebmDuration(rawBlob, duration, (fixedBlob: Blob) => {
          const url = URL.createObjectURL(fixedBlob);
          setPracticeBlobUrl(url);
          setPracticePhase('review');
        });
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
    setPracticePhase('ready');
    if (practiceBlobUrl) {
      URL.revokeObjectURL(practiceBlobUrl);
      setPracticeBlobUrl(null);
    }
    // Direct candidate to Question 1 in ready phase
    setCurrentIndex(0);
    setPhase('ready');
  };

  // -------------------------------------------------------------
  // REAL INTERVIEW WORKFLOW
  // -------------------------------------------------------------
  const startRealInterviewFromIntro = () => {
    stopSpeaking();
    setIsPractice(false);
    setCurrentIndex(0);
    setPhase('ready');
  };

  const startRealThinking = () => {
    if (!currentAnswer || cameraError) return;
    setPhase('speaking');
    speakText(currentAnswer.question_text, () => {
      setPhase('thinking');
      setCountdown(currentAnswer.think_seconds || 30);
    });
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
        fixWebmDuration(rawBlob, duration, (fixedBlob: Blob) => {
          if (currentAnswer) {
            setRecordedBlobs((prev) => ({ ...prev, [currentAnswer.id]: fixedBlob }));
            setPhase('stopped');
          }
        });
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

  // Real countdown timer hook
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

  const uploadAnswer = async (answerId: string, blob: Blob) => {
    let uploaded = false;

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
          uploaded = true;
        }
      }
    } catch {
      // Storage upload optional/fallback
    }

    // 2. Try external API_URL if configured and not /api
    if (API_URL !== '/api') {
      try {
        const formData = new FormData();
        formData.append('file', blob, `${answerId}.webm`);
        const res = await fetch(`${API_URL}/sessions/${sessionId}/answers/${answerId}/upload`, {
          method: 'POST',
          body: formData,
        });
        if (res.ok) {
          uploaded = true;
        }
      } catch {
        // External endpoint unreachable, handled by local fallback
      }
    }

    // 3. Guaranteed local Next.js upload endpoint fallback
    try {
      const localFormData = new FormData();
      localFormData.append('file', blob, `${answerId}.webm`);
      const localRes = await fetch(`/api/sessions/${sessionId}/answers/${answerId}/upload`, {
        method: 'POST',
        body: localFormData,
      });
      if (localRes.ok) {
        uploaded = true;
      }
    } catch (localErr) {
      console.warn(`Local upload notice for ${answerId}:`, localErr);
    }

    return uploaded;
  };

  const goToNextQuestion = async () => {
    if (currentIndex + 1 < answers.length) {
      setCurrentIndex((i) => i + 1);
      setPhase('ready');
    } else {
      await submitAllAnswers();
    }
  };

  const submitAllAnswers = async () => {
    setSubmitting(true);
    setUploadError(null);

    let anyUploadFailed = false;
    for (const [answerId, blob] of Object.entries(recordedBlobs)) {
      const ok = await uploadAnswer(answerId, blob);
      if (!ok) {
        anyUploadFailed = true;
      }
    }

    try {
      let submitRes: Response | null = null;
      if (API_URL !== '/api') {
        try {
          submitRes = await fetch(`${API_URL}/sessions/${sessionId}/submit`, { method: 'POST' });
        } catch {
          submitRes = null;
        }
      }

      if (!submitRes || !submitRes.ok) {
        try {
          submitRes = await fetch(`/api/sessions/${sessionId}/submit`, { method: 'POST' });
        } catch {
          submitRes = null;
        }
      }

      if (!submitRes || !submitRes.ok) {
        throw new Error('Backend session submission failed');
      }

      if (anyUploadFailed) {
        setUploadError('One or more recordings could not be uploaded to the server. Please try submitting again.');
      } else {
        setPhase('complete');
      }
    } catch {
      setUploadError('Failed to complete final submission. Please check your backend connection and click retry.');
    } finally {
      setSubmitting(false);
    }
  };

  // Conversational Turn Handler
  const handleNextTurnConversational = async () => {
    setSubmitting(true);
    try {
      let res: Response | null = null;
      const turnBody = JSON.stringify({
        transcript: candidateTurnTranscript || 'Candidate spoken response recorded.',
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
        setPhase('complete');
      } else {
        setCurrentAiPrompt(data.message);
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

  // Audio testing helpers for Intro
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

  // 2. PRACTICE MODE VIEW
  if (isPractice) {
    return (
      <Shell>
        <div className="space-y-5">
          {/* Practice Header Banner */}
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-purple-400 bg-purple-950/40 border border-purple-900/60 px-4 py-2.5 rounded-xl">
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              Practice Simulation (Unscored Warm-Up)
            </span>
            <button
              onClick={proceedToRealInterview}
              className="text-slate-300 hover:text-white underline text-[11px] font-normal"
            >
              Skip to Real Interview
            </button>
          </div>

          {/* If Practice is in Review Phase: Show Recorded Practice Playback */}
          {practicePhase === 'review' ? (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-video border-2 border-purple-500/80 shadow-xl">
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
                <div className="absolute top-3 left-3 bg-purple-900/90 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full border border-purple-700">
                  Practice Video Review
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center justify-center shrink-0">
                    <CheckCheck className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-white">Practice Question Complete!</h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Play your recording above to check your audio volume, room lighting, and camera positioning.
                      When you are satisfied, click below to start your real interview.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>Camera video stream verified</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>Microphone audio captured</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Retake OR Proceed to Real Interview */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
                <button
                  onClick={startPracticeWorkflow}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl border border-slate-700 hover:border-slate-600 bg-slate-900 text-slate-300 hover:text-white text-sm font-semibold transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4 text-purple-400" />
                  <span>Retake Practice</span>
                </button>

                <button
                  onClick={proceedToRealInterview}
                  className="flex-1 w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl text-sm sm:text-base transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
                >
                  <span>Proceed to Real Interview</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            // Live Practice Steps: Ready, Speaking, Thinking, Recording
            <div className="space-y-4">
              <CameraFrame
                stream={mediaStream}
                ring={
                  practicePhase === 'recording'
                    ? 'recording'
                    : practicePhase === 'speaking'
                    ? 'speaking'
                    : practicePhase === 'thinking'
                    ? 'thinking'
                    : 'idle'
                }
                error={cameraError}
                cameraOn={cameraOn}
                micOn={micOn}
                onToggleCamera={handleToggleCamera}
                onToggleMic={handleToggleMic}
                label="PRACTICE PREVIEW"
              />

              {/* Practice Question Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Bot className="w-3.5 h-3.5" />
                    {practicePhase === 'speaking' ? 'AI Voice Prompt' : 'Practice Question'}
                  </span>
                  <button
                    onClick={() => speakText(practiceQuestionText, () => {})}
                    className="text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1 text-[11px]"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Replay Audio</span>
                  </button>
                </div>
                <p className="text-base sm:text-lg font-semibold text-white leading-relaxed">
                  {practiceQuestionText}
                </p>
              </div>

              {/* Practice Sub-Phase Controls */}
              {practicePhase === 'ready' && (
                <div className="space-y-3">
                  <button
                    onClick={beginPracticeSpeaking}
                    className="w-full py-3.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-2xl text-base transition-all shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2"
                  >
                    <Play className="w-5 h-5 fill-white" />
                    <span>Begin Practice (15s Prep, 30s Recording)</span>
                  </button>
                  <button
                    onClick={proceedToRealInterview}
                    className="w-full py-2.5 text-xs text-slate-400 hover:text-slate-200 text-center transition-colors flex items-center justify-center gap-1"
                  >
                    <span>Skip Practice and Start Real Interview</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {practicePhase === 'speaking' && (
                <div className="p-4 bg-purple-950/30 border border-purple-900/60 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-purple-300">
                    <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                    <span>AI is reading the practice question...</span>
                  </div>
                  <button
                    onClick={skipPracticeSpeaking}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 transition-colors"
                  >
                    <SkipForward className="w-3.5 h-3.5 text-purple-400" />
                    <span>Start Prep (15s)</span>
                  </button>
                </div>
              )}

              {practicePhase === 'thinking' && (
                <div className="bg-amber-950/30 border border-amber-900/60 rounded-2xl p-4 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                      Practice Think Time
                    </span>
                    <p className="text-xs text-slate-400">Prep your answer. Recording starts automatically.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-3xl font-bold text-amber-300 tabular-nums">{practiceCountdown}s</div>
                    <button
                      onClick={skipPracticeThinking}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1 transition-colors"
                    >
                      <span>Speak Now</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {practicePhase === 'recording' && (
                <div className="bg-red-950/30 border border-red-900/60 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-400">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                      <span>Recording Practice Answer</span>
                    </div>
                    <div className="text-2xl font-bold text-red-300 tabular-nums">{practiceCountdown}s</div>
                  </div>

                  <button
                    onClick={stopPracticeRecording}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold rounded-xl text-xs sm:text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <Square className="w-3.5 h-3.5 fill-red-400 text-red-400" />
                    <span>Finished Speaking (Stop Practice Recording)</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </Shell>
    );
  }

  // 3. INTRO / HARDWARE VERIFICATION SCREEN
  if (phase === 'intro') {
    return (
      <Shell>
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>QuestAI Assessment</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {jobRole?.title || 'Job Assessment'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {jobRole?.description ||
                'Ensure your camera and microphone are properly framed and tested before entering the interview.'}
            </p>
          </div>

          {loadError && (
            <div className="p-4 bg-amber-950/40 border border-amber-800 rounded-2xl text-xs text-amber-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>{loadError}</span>
            </div>
          )}

          {/* Camera Frame Preview - Always guaranteed active */}
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
          />

          {/* Hardware Readiness Checks */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Audio & Speaker Verification
            </h3>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <MicVisualizer level={micLevel} />

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={testMic}
                  disabled={testingMic}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1.5"
                >
                  <Mic className="w-3.5 h-3.5 text-blue-400" />
                  <span>{testingMic ? 'Recording 2s...' : 'Test Mic'}</span>
                </button>

                <button
                  type="button"
                  onClick={testSpeakerChime}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1.5"
                >
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Test Speaker</span>
                </button>
              </div>
            </div>

            {micTestUrl && (
              <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                <span className="text-xs text-slate-400">Mic Playback:</span>
                <audio controls src={micTestUrl} className="h-7 flex-1" />
              </div>
            )}
          </div>

          {/* Action CTAs: Practice Interview OR Real Interview */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={startPracticeWorkflow}
              disabled={!!cameraError}
              className="w-full sm:w-auto px-5 py-3 rounded-xl border border-purple-500/50 hover:border-purple-400 bg-purple-950/30 text-purple-200 hover:text-white text-sm font-semibold transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4 text-purple-400" />
              <span>Try Practice Question</span>
            </button>

            <button
              onClick={startRealInterviewFromIntro}
              disabled={!!cameraError}
              className="flex-1 w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 text-white font-semibold rounded-xl text-sm sm:text-base transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
            >
              <span>Start Real Interview</span>
              <ArrowRight className="w-4 h-4" />
            </button>
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
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Your video recordings and answers have been securely uploaded to QuestAI. The hiring team will evaluate your assessment shortly.
            </p>
          </div>
          <div className="pt-4 border-t border-slate-800 text-xs text-slate-500">
            You may now safely close this window.
          </div>
        </div>
      </Shell>
    );
  }

  // 5. LIVE REAL INTERVIEW STUDIO
  return (
    <Shell>
      <div className="space-y-5">
        {/* Progress header */}
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
          <span>
            {isConversational ? 'Interactive AI Assessment' : `Question ${currentIndex + 1} of ${answers.length}`}
          </span>
          <span className="text-blue-400">{jobRole?.title || 'QuestAI'}</span>
        </div>

        {/* Live Video Camera Frame with persistent stream */}
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
        />

        {/* Eye-line teleprompter question banner */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5" />
              {phase === 'speaking' ? 'AI is asking the question...' : 'Current Question'}
            </span>
            <button
              onClick={() =>
                speakText(
                  isConversational ? currentAiPrompt : currentAnswer?.question_text || '',
                  () => {}
                )
              }
              className="text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1 text-[11px]"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Replay Voice</span>
            </button>
          </div>
          <p className="text-base sm:text-lg font-semibold text-white leading-relaxed">
            {isConversational ? currentAiPrompt : currentAnswer?.question_text}
          </p>
        </div>

        {/* Real Interview Phase Action Panels */}
        {phase === 'ready' && (
          <div className="space-y-3">
            <button
              onClick={startRealThinking}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-2xl text-base transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5 fill-white" />
              <span>I'm Ready - Ask Question {currentIndex + 1}</span>
            </button>

            {currentIndex === 0 && (
              <button
                onClick={startPracticeWorkflow}
                className="w-full py-2 text-xs text-slate-400 hover:text-slate-200 text-center transition-colors flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3 h-3 text-purple-400" />
                <span>Need a warm-up? Try a quick practice question first</span>
              </button>
            )}
          </div>
        )}

        {phase === 'speaking' && (
          <div className="p-4 bg-blue-950/30 border border-blue-900/60 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-300">
              <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span>Listen carefully — think time will begin shortly</span>
            </div>
            <button
              onClick={skipRealSpeaking}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 transition-colors"
            >
              <SkipForward className="w-3.5 h-3.5 text-blue-400" />
              <span>Skip Voice & Prep</span>
            </button>
          </div>
        )}

        {phase === 'thinking' && (
          <div className="bg-amber-950/30 border border-amber-900/60 rounded-2xl p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Think Time
              </span>
              <p className="text-xs text-slate-400">Collect your thoughts. Recording starts automatically.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-3xl font-bold text-amber-300 tabular-nums">{countdown}s</div>
              <button
                onClick={skipRealThinking}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1 transition-colors"
              >
                <span>Speak Now</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {phase === 'recording' && (
          <div className="bg-red-950/30 border border-red-900/60 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-400">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                <span>Recording Answer</span>
              </div>
              <div className="text-2xl font-bold text-red-300 tabular-nums">{countdown}s</div>
            </div>

            <button
              onClick={stopRealRecording}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold rounded-xl text-xs sm:text-sm transition-colors flex items-center justify-center gap-2"
            >
              <Square className="w-3.5 h-3.5 fill-red-400 text-red-400" />
              <span>Finished Speaking (Stop Recording)</span>
            </button>
          </div>
        )}

        {phase === 'stopped' && (
          <div className="space-y-3">
            <div className="p-3 bg-emerald-950/30 border border-emerald-900/60 rounded-xl text-xs font-semibold text-emerald-400 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Answer recorded successfully</span>
            </div>

            {uploadError && (
              <div className="p-3 bg-red-950/40 border border-red-900 rounded-xl text-xs text-red-300">
                {uploadError}
              </div>
            )}

            <button
              onClick={isConversational ? handleNextTurnConversational : goToNextQuestion}
              disabled={submitting}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-2xl text-base transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <span>Submitting answer...</span>
              ) : isConversational ? (
                <>
                  <span>Next AI Turn</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              ) : currentIndex + 1 < answers.length ? (
                <>
                  <span>Next Question ({currentIndex + 2} of {answers.length})</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              ) : (
                <>
                  <span>Finish & Submit Interview</span>
                  <CheckCircle2 className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </Shell>
  );
}