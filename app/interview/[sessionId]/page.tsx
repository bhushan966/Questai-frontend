'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import fixWebmDuration from 'fix-webm-duration';
import { API_URL } from '@/lib/config';


type Phase = 'loading' | 'intro' | 'ready' | 'speaking' | 'thinking' | 'recording' | 'stopped' | 'complete';

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

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-xl">{children}</div>
    </div>
  );
}

function CameraFrame({
  videoRef,
  ring,
  error,
  onRetry,
  cameraOn,
  micOn,
  onToggleCamera,
  onToggleMic,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  ring?: 'idle' | 'recording' | 'speaking';
  error?: string | null;
  onRetry?: () => void;
  cameraOn?: boolean;
  micOn?: boolean;
  onToggleCamera?: () => void;
  onToggleMic?: () => void;
}) {
  if (error) {
    return (
      <div className="rounded-2xl bg-slate-900 border-2 border-amber-800 aspect-video flex flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="text-3xl">📷</div>
        <div className="text-sm text-amber-400 font-medium">
          {error === 'permission'
            ? 'Camera and microphone access is required to continue.'
            : error === 'no-device'
            ? 'No camera or microphone was found on this device.'
            : 'Unable to access your camera and microphone.'}
        </div>
        {error === 'permission' && (
          <div className="text-xs text-slate-500 space-y-1">
            <div>If clicking "Try Again" doesn't prompt you, you've likely blocked access previously.</div>
            <div>Click the camera icon in your browser's address bar to allow access, then try again.</div>
          </div>
        )}
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-1 px-4 py-2 bg-amber-700 hover:bg-amber-600 transition-colors text-white text-sm font-medium rounded-lg"
          >
            Try Again
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-2xl overflow-hidden bg-black aspect-video border-2 transition-colors ${
        ring === 'recording' ? 'border-red-500' : ring === 'speaking' ? 'border-blue-500' : 'border-slate-800'
      }`}
    >
      <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />

      {cameraOn === false && (
        <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
          <div className="text-slate-500 text-sm">Camera is off</div>
        </div>
      )}

      {(onToggleCamera || onToggleMic) && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
          {onToggleCamera && (
            <button
              onClick={onToggleCamera}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                cameraOn ? 'bg-slate-800/90 hover:bg-slate-700' : 'bg-red-600 hover:bg-red-500'
              }`}
              title={cameraOn ? 'Turn camera off' : 'Turn camera on'}
            >
              {cameraOn ? '📹' : '🚫'}
            </button>
          )}
          {onToggleMic && (
            <button
              onClick={onToggleMic}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                micOn ? 'bg-slate-800/90 hover:bg-slate-700' : 'bg-red-600 hover:bg-red-500'
              }`}
              title={micOn ? 'Turn mic off' : 'Turn mic on'}
            >
              {micOn ? '🎤' : '🔇'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function MicMeter({ level }: { level: number }) {
  const bars = 12;
  const activeBar = Math.round(level * bars);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500">Mic</span>
      <div className="flex gap-0.5">
        {Array.from({ length: bars }).map((_, i) => (
          <div
            key={i}
            className={`w-1.5 h-4 rounded-sm transition-colors ${
              i < activeBar ? 'bg-emerald-500' : 'bg-slate-800'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export default function InterviewPage() {
  const { sessionId } = useParams<{ sessionId: string }>();

  const [phase, setPhase] = useState<Phase>('loading');
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [recordedBlobs, setRecordedBlobs] = useState<Record<string, Blob>>({});
  const [submitting, setSubmitting] = useState(false);
  const [jobRole, setJobRole] = useState<JobRole | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [resumedCount, setResumedCount] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [streamReady, setStreamReady] = useState(false);
  const [micTestUrl, setMicTestUrl] = useState<string | null>(null);
  const [testingMic, setTestingMic] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartTime = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micCheckFrameRef = useRef<number>(0);

  const currentAnswer = answers[currentIndex];

  useEffect(() => {
    fetch(`${API_URL}/sessions/${sessionId}`)
      .then((res) => res.json())
      .then((session) =>
        fetch(`${API_URL}/job-roles/${session.job_role_id}`)
          .then((res) => res.json())
          .then((role) => setJobRole(role))
      );

    fetch(`${API_URL}/sessions/${sessionId}/answers`)
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data)) {
          console.error('Unexpected response:', data);
          return;
        }
        const pending = data.filter((a: Answer) => a.status === 'pending');
        const alreadyDone = data.length - pending.length;
        setResumedCount(alreadyDone);
        setAnswers(pending);
        setPhase(pending.length > 0 ? 'intro' : 'complete');
      });
  }, [sessionId]);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraError(null);
        setStreamReady(true);
      })
      .catch((err) => {
        console.error('Camera access denied:', err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setCameraError('permission');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setCameraError('no-device');
        } else {
          setCameraError('unknown');
        }
      });

    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  useEffect(() => {
    const checkTrackHealth = () => {
      const stream = streamRef.current;
      if (!stream) return;
      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];
      if (!videoTrack || !audioTrack || videoTrack.readyState === 'ended' || audioTrack.readyState === 'ended') {
        setCameraError('unknown');
      }
    };

    const interval = setInterval(checkTrackHealth, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (videoRef.current && streamRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = streamRef.current;
    }
  });

  useEffect(() => {
    if (cameraError && (phase === 'thinking' || phase === 'recording' || phase === 'speaking')) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      window.speechSynthesis.cancel();
      setPhase('ready');
    }
  }, [cameraError, phase]);

  useEffect(() => {
  if (phase !== 'thinking' && phase !== 'recording') return;
  if (countdown <= 0) {
    if (phase === 'thinking') startRecording();
    else stopRecording();
    return;
  }
  const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
  return () => clearTimeout(t);
  }, [countdown, phase]);

  useEffect(() => {
    if (phase === 'complete') {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    }
  }, [phase]);

  useEffect(() => {
    if (!streamRef.current || cameraError || !streamReady) return;

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    const source = audioContext.createMediaStreamSource(streamRef.current);
    source.connect(analyser);

    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const checkLevel = () => {
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
      const NOISE_FLOOR = 15;
      const adjusted = Math.max(0, avg - NOISE_FLOOR);
      setMicLevel(Math.min(adjusted / 60, 1));
      micCheckFrameRef.current = requestAnimationFrame(checkLevel);
    };
    checkLevel();

    return () => {
      cancelAnimationFrame(micCheckFrameRef.current);
      audioContext.close();
    };
  }, [streamReady, cameraError]);

  const retryCameraAccess = () => {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraError(null);
        setStreamReady(true);
        setCameraOn(true);
        setMicOn(true);
      })
      .catch((err) => {
        console.error('Camera retry failed:', err);
        setCameraError(err.name === 'NotAllowedError' ? 'permission' : 'unknown');
      });
  };

  const toggleCamera = () => {
    if (!streamRef.current) return;
    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setCameraOn(videoTrack.enabled);
    }
  };

  const toggleMic = () => {
    if (!streamRef.current) return;
    const audioTrack = streamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMicOn(audioTrack.enabled);
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

  const startThinking = () => {
    if (!currentAnswer || cameraError) return;
    setPhase('speaking');
    const utterance = new SpeechSynthesisUtterance(currentAnswer.question_text);
    utterance.rate = 0.95;
    utterance.onend = () => {
      setPhase('thinking');
      setCountdown(30);
    };
    window.speechSynthesis.speak(utterance);
  };

  const startRecording = () => {
    if (!streamRef.current || !currentAnswer || cameraError) return;
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
      ? 'video/webm;codecs=vp8,opus'
      : 'video/webm';
    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const rawBlob = new Blob(chunksRef.current, { type: mimeType });
      const duration = Date.now() - recordingStartTime.current;
      fixWebmDuration(rawBlob, duration, (fixedBlob: Blob) => {
        setRecordedBlobs((prev) => ({ ...prev, [currentAnswer.id]: fixedBlob }));
        setPhase('stopped');
      });
    };
    recorder.onerror = (e) => console.error('MediaRecorder error:', e);
    mediaRecorderRef.current = recorder;
    recordingStartTime.current = Date.now();
    recorder.start(1000);
    setPhase('recording');
    setCountdown(currentAnswer.answer_seconds);
  };

  const stopRecording = () => mediaRecorderRef.current?.stop();

  const goToNextQuestion = async () => {
    if (currentIndex + 1 < answers.length) {
      setCurrentIndex((i) => i + 1);
      setPhase('ready');
    } else {
      await submitAllAnswers();
    }
  };

  const uploadWithRetry = async (answerId: string, blob: Blob, maxRetries = 3): Promise<boolean> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const formData = new FormData();
        formData.append('file', blob, `${answerId}.webm`);
        const res = await fetch(`${API_URL}/sessions/${sessionId}/answers/${answerId}/upload`, {
          method: 'POST',
          body: formData,
        });
        if (res.ok) return true;
        console.warn(`Upload attempt ${attempt} failed for ${answerId}: ${res.status}`);
      } catch (err) {
        console.warn(`Upload attempt ${attempt} threw for ${answerId}:`, err);
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
    return false;
  };

  const submitAllAnswers = async () => {
    setSubmitting(true);
    const failedAnswers: string[] = [];

    for (const [answerId, blob] of Object.entries(recordedBlobs)) {
      const success = await uploadWithRetry(answerId, blob);
      if (!success) failedAnswers.push(answerId);
    }

    if (failedAnswers.length > 0) {
      setSubmitting(false);
      setUploadError(
        `${failedAnswers.length} of ${Object.keys(recordedBlobs).length} recordings failed to upload after multiple attempts. Please check your internet connection and try again.`
      );
      return;
    }

    try {
      await fetch(`${API_URL}/sessions/${sessionId}/submit`, { method: 'POST' });
      setPhase('complete');
    } catch (err) {
      console.error('Final submit call failed:', err);
      setUploadError('All recordings uploaded, but final submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const estimatedMinutes = Math.ceil(
    (answers.length * 30 + answers.reduce((sum, a) => sum + a.answer_seconds, 0)) / 60
  );

  if (phase === 'loading' || (phase === 'intro' && !jobRole)) {
    return (
      <Shell>
        <div className="text-center text-slate-400">Loading interview...</div>
      </Shell>
    );
  }

  if (phase === 'intro' && jobRole) {
    const notReady = !!cameraError || !cameraOn || !micOn;
    return (
      <Shell>
        <div className="space-y-5">
          <div className="text-xs font-medium tracking-wide text-slate-400 uppercase">
            {answers.length} questions · ~{estimatedMinutes} min · camera & mic required
          </div>

          {resumedCount > 0 && (
            <div className="text-sm text-emerald-400 bg-emerald-950/30 border border-emerald-900 rounded-lg px-3 py-2">
              Welcome back — you've already completed {resumedCount} question{resumedCount > 1 ? 's' : ''}.
              Let's continue with the rest.
            </div>
          )}

          <CameraFrame
            videoRef={videoRef}
            ring="idle"
            error={cameraError}
            onRetry={retryCameraAccess}
            cameraOn={cameraOn}
            micOn={micOn}
            onToggleCamera={toggleCamera}
            onToggleMic={toggleMic}
          />

          {!cameraError && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <MicMeter level={micLevel} />
                <button
                  onClick={testMic}
                  disabled={testingMic || !micOn}
                  className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 transition-colors text-slate-200 rounded-lg"
                >
                  {testingMic ? 'Recording...' : 'Test Mic'}
                </button>
              </div>
              {micTestUrl && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-slate-500">Playback:</span>
                  <audio controls src={micTestUrl} className="h-8 flex-1" />
                </div>
              )}
            </div>
          )}

          <div className="bg-slate-900 rounded-xl p-5 space-y-3 border border-slate-800">
            <h1 className="text-xl font-bold text-white">{jobRole.title}</h1>
            <p className="text-sm text-slate-300 leading-relaxed">{jobRole.description}</p>
            {jobRole.skills_required && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {jobRole.skills_required.split(',').map((skill, i) => (
                  <span key={i} className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded-full">
                    {skill.trim()}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="bg-slate-900 rounded-xl p-5 space-y-3 border border-slate-800">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wide">How this works</h2>
            <ul className="space-y-2 text-sm text-slate-300">
              <li className="flex gap-2">
                <span className="text-blue-400">•</span>
                The AI will read each question aloud before you answer.
              </li>
              <li className="flex gap-2">
                <span className="text-blue-400">•</span>
                You'll get <span className="text-white font-medium">30 seconds</span> to think before recording starts automatically.
              </li>
              <li className="flex gap-2">
                <span className="text-blue-400">•</span>
                Recording time varies per question based on its complexity — the timer will show how long you have.
              </li>
              <li className="flex gap-2">
                <span className="text-blue-400">•</span>
                Recording stops automatically when time runs out, or you can click "Stop Recording" to finish early.
              </li>
              <li className="flex gap-2">
                <span className="text-blue-400">•</span>
                There are <span className="text-white font-medium">{answers.length} questions</span> in total. Answer honestly and naturally — this isn't a memory test.
              </li>
            </ul>
          </div>

          <button
            onClick={() => setPhase('ready')}
            disabled={notReady}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-white font-medium rounded-xl text-lg"
          >
            {cameraError
              ? 'Camera access required'
              : !cameraOn || !micOn
              ? 'Turn on camera & mic to continue'
              : 'Start Interview'}
          </button>
        </div>
      </Shell>
    );
  }

  if (phase === 'complete') {
    return (
      <Shell>
        <div className="text-center space-y-3 py-12">
          <div className="text-4xl">✅</div>
          <div className="text-2xl font-semibold text-white">All done!</div>
          <div className="text-slate-400">
            {Object.keys(recordedBlobs).length > 0
              ? `${Object.keys(recordedBlobs).length} answers submitted. Thank you for your time.`
              : 'This interview has already been completed. Thank you for your time.'}
          </div>
        </div>
      </Shell>
    );
  }

  if (!currentAnswer) {
    return (
      <Shell>
        <div className="text-center text-slate-400">No questions available for this session.</div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          {answers.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i < currentIndex ? 'bg-blue-500' : i === currentIndex ? 'bg-blue-500/60' : 'bg-slate-800'
              }`}
            />
          ))}
        </div>
        <div className="text-xs font-medium tracking-wide text-slate-400 uppercase">
          Question {currentIndex + 1} of {answers.length}
        </div>

        <CameraFrame
          videoRef={videoRef}
          ring={phase === 'recording' ? 'recording' : phase === 'speaking' ? 'speaking' : 'idle'}
          error={cameraError}
          onRetry={retryCameraAccess}
          cameraOn={cameraOn}
          micOn={micOn}
        />

        {phase !== 'ready' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-base text-slate-100 leading-relaxed">{currentAnswer.question_text}</p>
          </div>
        )}

        {phase === 'ready' && (
          <div className="space-y-2">
            {cameraError && (
              <div className="text-sm text-amber-400">
                Camera access was lost. Please resolve this above before continuing.
              </div>
            )}
            <button
              onClick={startThinking}
              disabled={!!cameraError}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-white font-medium rounded-xl text-lg"
            >
              {cameraError ? 'Camera access required' : 'Start Question'}
            </button>
          </div>
        )}

        {phase === 'speaking' && (
          <div className="flex items-center gap-2 text-blue-400 text-sm font-medium">
            <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
            AI is asking the question...
          </div>
        )}

        {phase === 'thinking' && (
          <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
            <span className="text-sm text-slate-400">Think time remaining</span>
            <span className="text-xl font-bold text-white tabular-nums">{countdown}s</span>
          </div>
        )}

        {phase === 'recording' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-red-950/40 border border-red-900 rounded-xl px-4 py-3">
              <span className="flex items-center gap-2 text-sm text-red-400 font-medium">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                Recording
              </span>
              <span className="text-xl font-bold text-white tabular-nums">{countdown}s</span>
            </div>
            <button
              onClick={stopRecording}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 transition-colors text-slate-200 font-medium rounded-xl"
            >
              Stop Recording
            </button>
          </div>
        )}

        {phase === 'stopped' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
              <span className="w-2 h-2 bg-emerald-400 rounded-full" />
              Recording complete
            </div>

            {uploadError && (
              <div className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
                {uploadError}
              </div>
            )}

            <button
              onClick={goToNextQuestion}
              disabled={submitting}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors text-white font-medium rounded-xl text-lg"
            >
              {submitting
                ? 'Submitting...'
                : uploadError
                ? 'Retry Submission'
                : currentIndex + 1 < answers.length
                ? 'Next Question'
                : 'Finish Interview'}
            </button>
          </div>
        )}
      </div>
    </Shell>
  );
}