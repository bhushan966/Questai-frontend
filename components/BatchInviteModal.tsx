'use client';

import { useState, useRef, useId } from 'react';
import {
  X,
  Sparkles,
  Users,
  Copy,
  Check,
  ExternalLink,
  Mail,
  Download,
  Upload,
  Bot,
  ListPlus,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

export interface CandidateEntry {
  id: string;
  name: string;
  email: string;
  valid: boolean;
}

export interface GeneratedBatchCandidate {
  id: string;
  candidate_id: string;
  name: string;
  email: string;
  url: string;
  mode: string;
  deadlineDisplay?: string;
  created_at: string;
}

interface BatchInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: {
    id: string;
    title: string;
    description: string;
    skills_required?: string | null;
  };
  onSessionsCreated?: (newSessions: any[]) => void;
}

export function BatchInviteModal({
  isOpen,
  onClose,
  role,
  onSessionsCreated,
}: BatchInviteModalProps) {
  const fileInputId = useId();
  // Configuration State
  const [mode, setMode] = useState<'recorded_ai' | 'recorded_manual' | 'conversational'>('recorded_ai');
  const [deadlineDays, setDeadlineDays] = useState<number>(2); // 2 days default
  const [rawText, setRawText] = useState('');
  const [candidates, setCandidates] = useState<CandidateEntry[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);

  // Execution State
  const [step, setStep] = useState<'input' | 'results'>('input');
  const [generating, setGenerating] = useState(false);
  const [progressCount, setProgressCount] = useState(0);
  const [generatedResults, setGeneratedResults] = useState<GeneratedBatchCandidate[]>([]);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Email validator
  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  // Smart Parser for candidate lines
  const parseRawInput = (text: string) => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const parsed: CandidateEntry[] = [];

    lines.forEach((line, idx) => {
      let name = '';
      let email = '';

      // Check for formats like: "John Doe <john@gmail.com>"
      const angleMatch = line.match(/^([^<]+)<([^>]+)>$/);
      if (angleMatch) {
        name = angleMatch[1].trim();
        email = angleMatch[2].trim();
      } else if (line.includes(',') || line.includes('\t') || line.includes(' - ')) {
        // Formats like: "John Doe, john@gmail.com" or "John Doe - john@gmail.com"
        const separator = line.includes(',') ? ',' : line.includes('\t') ? '\t' : ' - ';
        const parts = line.split(separator).map((p) => p.trim());
        if (parts.length >= 2) {
          if (isValidEmail(parts[1])) {
            name = parts[0];
            email = parts[1];
          } else if (isValidEmail(parts[0])) {
            email = parts[0];
            name = parts[1];
          } else {
            name = parts[0];
            email = parts[1];
          }
        }
      } else {
        // Just an email or single string
        if (isValidEmail(line)) {
          email = line;
          name = line.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        } else {
          name = line;
          email = '';
        }
      }

      parsed.push({
        id: `cand-entry-${idx}-${Date.now()}`,
        name: name.trim() || `Candidate ${idx + 1}`,
        email: email.trim(),
        valid: isValidEmail(email),
      });
    });

    return parsed;
  };

  const handleRawTextChange = (text: string) => {
    setRawText(text);
    const parsed = parseRawInput(text);
    setCandidates(parsed);
  };

  // CSV File parser
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        if (!content) return;

        const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        if (lines.length === 0) {
          setFileError('The uploaded file is empty.');
          return;
        }

        // Determine if first row is header
        const firstLine = lines[0].toLowerCase();
        let startIndex = 0;
        let nameCol = 0;
        let emailCol = 1;

        if (firstLine.includes('name') || firstLine.includes('email') || firstLine.includes('mail')) {
          startIndex = 1;
          const headers = firstLine.split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
          headers.forEach((h, i) => {
            if (h.includes('name') || h.includes('candidate')) nameCol = i;
            if (h.includes('email') || h.includes('mail')) emailCol = i;
          });
        }

        const parsedList: CandidateEntry[] = [];
        for (let i = startIndex; i < lines.length; i++) {
          const row = lines[i].split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
          const name = row[nameCol] || `Candidate ${parsedList.length + 1}`;
          const email = row[emailCol] || (row.find((val) => isValidEmail(val)) || '');
          if (name || email) {
            parsedList.push({
              id: `csv-${i}-${Date.now()}`,
              name: name || `Candidate ${parsedList.length + 1}`,
              email: email,
              valid: isValidEmail(email),
            });
          }
        }

        if (parsedList.length === 0) {
          setFileError('Could not find candidate names or emails in the file.');
          return;
        }

        setCandidates((prev) => [...prev, ...parsedList]);
        // Update rawText representation as well
        const textRepresentation = parsedList.map((c) => `${c.name}, ${c.email}`).join('\n');
        setRawText((prev) => (prev ? `${prev}\n${textRepresentation}` : textRepresentation));
      } catch {
        setFileError('Failed to parse file. Please upload a valid CSV or TXT file.');
      }
    };
    reader.readAsText(file);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveCandidate = (indexToRemove: number) => {
    const updated = candidates.filter((_, idx) => idx !== indexToRemove);
    setCandidates(updated);
    setRawText(updated.map((c) => `${c.name}, ${c.email}`).join('\n'));
  };

  const handleClearQueue = () => {
    setCandidates([]);
    setRawText('');
    setFileError(null);
  };

  // Build Gmail compose URL for an individual candidate in the results
  const buildCandidateGmailUrl = (cand: GeneratedBatchCandidate) => {
    const subject = `Invitation to Interview: ${role.title} at QuestAI`;
    const deadlineLine = cand.deadlineDisplay
      ? cand.deadlineDisplay
      : deadlineDays > 0
      ? `${deadlineDays} days from now`
      : 'Open submission';

    const body = `Hi ${cand.name},

Thank you for your interest in the ${role.title} position!

We are excited to invite you to complete your interactive QuestAI video assessment. This gives you the opportunity to showcase your problem-solving skills and experience directly to our hiring team.

👉 Access Your Private Interview Session Here:
${cand.url}

⏰ Assessment Deadline:
${deadlineLine}

Instructions:
• Please ensure you are in a quiet room with a working camera and microphone.
• Keep your browser tab in focus during your responses.
• You will be given warm-up prep time for each question before your response is recorded.

Best regards,
Hiring Team`;

    return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
      cand.email
    )}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  // Generate sessions in batch
  const handleGenerateBatch = async () => {
    if (candidates.length === 0) return;

    setGenerating(true);
    setProgressCount(0);

    const questionSource = mode === 'recorded_manual' ? 'manual' : 'ai';
    const interviewMode = mode === 'conversational' ? 'conversational' : 'recorded';
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const deadlineTimestamp =
      deadlineDays > 0 ? Date.now() + deadlineDays * 24 * 60 * 60 * 1000 : null;

    const deadlineDisplay = deadlineTimestamp
      ? new Date(deadlineTimestamp).toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Open Window';

    const generated: GeneratedBatchCandidate[] = [];
    const createdSessionsForDashboard: any[] = [];

    for (let i = 0; i < candidates.length; i++) {
      const cand = candidates[i];
      const sessionId = crypto.randomUUID();
      const candidateId = `cand-${Date.now().toString(36)}-${i + 1}`;

      const sessionPayload = {
        id: sessionId,
        job_role_id: role.id,
        candidate_id: candidateId,
        candidate_name: cand.name.trim() || `Candidate ${i + 1}`,
        question_source: questionSource,
        mode: interviewMode,
        job_role_title: role.title,
        job_role_description: role.description,
        skills_required: role.skills_required,
      };

      // 1. Try internal Next.js API route
      let createdSession: any = null;
      try {
        const res = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sessionPayload),
        });
        if (res.ok) {
          createdSession = await res.json();
        }
      } catch {}

      // Fallback object if offline
      if (!createdSession) {
        createdSession = {
          ...sessionPayload,
          status: 'not_started',
          created_at: new Date().toISOString(),
        };
      }

      // 2. Persist to localStorage maps
      if (typeof window !== 'undefined') {
        try {
          // Saved sessions list
          const stored = localStorage.getItem('questai_saved_sessions');
          const list = stored ? JSON.parse(stored) : [];
          list.unshift(createdSession);
          localStorage.setItem('questai_saved_sessions', JSON.stringify(list));

          // Candidate names map
          const candMap = JSON.parse(localStorage.getItem('questai_candidate_names') || '{}');
          candMap[sessionId] = cand.name.trim();
          localStorage.setItem('questai_candidate_names', JSON.stringify(candMap));

          // Candidate emails map
          if (cand.email) {
            const emailMap = JSON.parse(localStorage.getItem('questai_candidate_emails') || '{}');
            emailMap[sessionId] = cand.email.trim();
            localStorage.setItem('questai_candidate_emails', JSON.stringify(emailMap));
          }
        } catch {}
      }

      // Construct unique link URL with query params
      const queryParams = new URLSearchParams();
      if (cand.name.trim()) queryParams.set('candidate', cand.name.trim());
      if (cand.email.trim()) queryParams.set('email', cand.email.trim());
      queryParams.set('role_title', role.title);
      if (role.description) queryParams.set('role_desc', role.description);
      if (deadlineTimestamp) queryParams.set('deadline', deadlineTimestamp.toString());

      const fullUrl = `${baseUrl}/interview/${sessionId}?${queryParams.toString()}`;

      generated.push({
        id: sessionId,
        candidate_id: candidateId,
        name: cand.name.trim(),
        email: cand.email.trim(),
        url: fullUrl,
        mode: interviewMode,
        deadlineDisplay,
        created_at: createdSession.created_at || new Date().toISOString(),
      });

      createdSessionsForDashboard.push(createdSession);
      setProgressCount(i + 1);
    }

    setGeneratedResults(generated);
    setGenerating(false);
    setStep('results');

    // Notify parent to refresh candidate submissions list
    if (onSessionsCreated && createdSessionsForDashboard.length > 0) {
      onSessionsCreated(createdSessionsForDashboard);
    }
  };

  // Copy All Links
  const handleCopyAllLinks = () => {
    const textLines = generatedResults
      .map(
        (c) =>
          `${c.name}${c.email ? ` <${c.email}>` : ''}: ${c.url}`
      )
      .join('\n\n');

    navigator.clipboard.writeText(textLines);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  // Copy Single Link
  const handleCopySingle = (url: string, index: number) => {
    navigator.clipboard.writeText(url);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Download CSV
  const handleDownloadCSV = () => {
    const headers = ['Candidate Name', 'Candidate Email', 'Interview Link', 'Role Title', 'Assessment Mode', 'Deadline'];
    const rows = generatedResults.map((c) => [
      `"${c.name.replace(/"/g, '""')}"`,
      `"${c.email.replace(/"/g, '""')}"`,
      `"${c.url}"`,
      `"${role.title.replace(/"/g, '""')}"`,
      `"${c.mode}"`,
      `"${c.deadlineDisplay || ''}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `QuestAI_Invite_Batch_${role.title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Reset and close
  const handleClose = () => {
    setStep('input');
    setRawText('');
    setCandidates([]);
    setGeneratedResults([]);
    setFileError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden">
        {/* Modal Top Glow Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  {step === 'input' ? 'Batch Candidate Invite Queue' : 'Generated Batch Links'}
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800/80">
                  QuestAI Dispatch
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {role.title} • {step === 'input' ? 'Generate & prepare multi-candidate assessments' : `${generatedResults.length} unique links ready`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          {step === 'input' ? (
            <>
              {/* Assessment Mode & Configuration Bar */}
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    Interview Format & Settings
                  </span>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>Expires in:</span>
                    <select
                      value={deadlineDays}
                      onChange={(e) => setDeadlineDays(Number(e.target.value))}
                      className="bg-slate-900 border border-slate-750 text-slate-200 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-blue-500"
                    >
                      <option value={1}>24 Hours (1 Day)</option>
                      <option value={2}>48 Hours (2 Days)</option>
                      <option value={3}>3 Days</option>
                      <option value={7}>7 Days (1 Week)</option>
                      <option value={0}>No Expiration</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setMode('recorded_ai')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      mode === 'recorded_ai'
                        ? 'bg-blue-600/15 border-blue-500/80 text-white shadow-sm ring-1 ring-blue-500/50'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-semibold text-xs text-blue-300">
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      <span>Recorded • AI Q&A</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      AI tailors technical questions dynamically from role skills.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode('conversational')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      mode === 'conversational'
                        ? 'bg-indigo-600/15 border-indigo-500/80 text-white shadow-sm ring-1 ring-indigo-500/50'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-semibold text-xs text-indigo-300">
                      <Bot className="w-3.5 h-3.5 shrink-0" />
                      <span>Conversational AI</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      Interactive real-time conversational interview with AI avatar.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode('recorded_manual')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      mode === 'recorded_manual'
                        ? 'bg-purple-600/15 border-purple-500/80 text-white shadow-sm ring-1 ring-purple-500/50'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-semibold text-xs text-purple-300">
                      <ListPlus className="w-3.5 h-3.5 shrink-0" />
                      <span>Recorded • Fixed Q&A</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      Uses recruiter pre-defined standard interview question list.
                    </p>
                  </button>
                </div>
              </div>

              {/* Input Area: Smart Paste + CSV Upload */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                    Enter Candidates (Paste or Upload)
                  </label>

                  <div className="flex items-center gap-2">
                    <input
                      id={fileInputId}
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <label
                      htmlFor={fileInputId}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-800 hover:text-white border border-slate-700/80 transition-colors cursor-pointer"
                    >
                      <Upload className="w-3 h-3 text-blue-400" />
                      <span>Upload CSV / TXT</span>
                    </label>

                    {candidates.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearQueue}
                        className="text-xs text-slate-500 hover:text-red-400 transition-colors px-2 py-1"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                </div>

                {fileError && (
                  <div className="p-3 bg-red-950/40 border border-red-900/80 rounded-xl text-xs text-red-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{fileError}</span>
                  </div>
                )}

                <div className="relative">
                  <textarea
                    rows={4}
                    value={rawText}
                    onChange={(e) => handleRawTextChange(e.target.value)}
                    placeholder={`Paste candidate names & emails (one per line). Formats supported:
John Doe, john@example.com
Sarah Connor <sarah@acme.com>
alex.rivera@startup.co
Emily Blunt - emily@gmail.com`}
                    className="w-full bg-slate-950/90 border border-slate-800 rounded-2xl p-3.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono transition-colors"
                  />
                  <div className="absolute right-3 bottom-3 text-[11px] text-slate-500">
                    Smart-parses names & emails automatically
                  </div>
                </div>
              </div>

              {/* Parsed Candidates Queue Preview */}
              {candidates.length > 0 && (
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <span>Queue Preview</span>
                      <span className="px-2 py-0.5 rounded-full bg-blue-950/80 text-blue-300 border border-blue-800 text-[10px] font-bold">
                        {candidates.length} Candidate{candidates.length > 1 ? 's' : ''}
                      </span>
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      Each candidate will receive their own secure private session
                    </span>
                  </div>

                  <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                    {candidates.map((cand, idx) => (
                      <div
                        key={cand.id || idx}
                        className="bg-slate-950/60 border border-slate-800/80 rounded-xl px-3.5 py-2 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-[11px] shrink-0">
                            {cand.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-white truncate">{cand.name}</div>
                            <div className="text-slate-400 text-[11px] truncate flex items-center gap-1.5">
                              {cand.email ? (
                                <span className={cand.valid ? 'text-emerald-400' : 'text-amber-400'}>
                                  {cand.email}
                                </span>
                              ) : (
                                <span className="text-slate-500 italic">No email provided</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveCandidate(idx)}
                          className="w-6 h-6 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/40 flex items-center justify-center transition-colors shrink-0"
                          title="Remove from queue"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Results Deck */
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Success Banner & Actions */}
              <div className="bg-emerald-950/40 border border-emerald-800/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-900/60 text-emerald-300 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">
                      Generated {generatedResults.length} Unique Assessment Links!
                    </h3>
                    <p className="text-xs text-emerald-300/80 mt-0.5">
                      Ready for dispatch. Candidates can begin their interview immediately.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyAllLinks}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-white border border-slate-700 flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    {copiedAll ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>All Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        <span>Copy All Links</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadCSV}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 transition-colors shadow-md shadow-blue-500/20"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download CSV</span>
                  </button>
                </div>
              </div>

              {/* Generated Candidates Table */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/80">
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/80">
                  {generatedResults.map((cand, idx) => (
                    <div
                      key={cand.id}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-900/60 transition-colors text-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 font-bold text-white flex items-center justify-center shrink-0">
                          {cand.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-white flex items-center gap-2">
                            <span className="truncate">{cand.name}</span>
                            <span className="text-[10px] px-2 py-0.2 rounded-full bg-slate-800 text-slate-400 font-mono">
                              ID: {cand.candidate_id.slice(-6)}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 truncate mt-0.5">
                            {cand.email || 'No email attached'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => handleCopySingle(cand.url, idx)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 flex items-center gap-1 transition-colors text-xs"
                          title="Copy candidate interview link"
                        >
                          {copiedIndex === idx ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-[11px] text-emerald-300">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-[11px]">Copy Link</span>
                            </>
                          )}
                        </button>

                        <a
                          href={cand.url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700/80 transition-colors"
                          title="Test Link in new tab"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>

                        {cand.email && (
                          <a
                            href={buildCandidateGmailUrl(cand)}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1.5 rounded-lg bg-red-950/50 hover:bg-red-900/60 text-red-300 hover:text-red-200 border border-red-800/80 flex items-center gap-1 transition-colors text-xs"
                            title="Open prefilled email invite in Gmail"
                          >
                            <Mail className="w-3.5 h-3.5 text-red-400" />
                            <span className="text-[11px]">Gmail</span>
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/80 shrink-0">
          {step === 'input' ? (
            <>
              <div className="text-xs text-slate-400">
                {candidates.length > 0 ? (
                  <span>
                    Ready to generate <strong className="text-white">{candidates.length}</strong> individual sessions
                  </span>
                ) : (
                  <span>Add candidates above to enable generation</span>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={generating}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-800/70 hover:bg-slate-800 border border-slate-700 transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleGenerateBatch}
                  disabled={generating || candidates.length === 0}
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg shadow-blue-500/25"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>
                        Generating ({progressCount}/{candidates.length})...
                      </span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Generate {candidates.length > 0 ? `${candidates.length} Links` : 'Links'}</span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between w-full">
              <button
                type="button"
                onClick={() => {
                  setStep('input');
                  setGeneratedResults([]);
                }}
                className="text-xs text-slate-400 hover:text-white transition-colors"
              >
                ← Back to Candidate Queue
              </button>

              <button
                type="button"
                onClick={handleClose}
                className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-md shadow-blue-500/20"
              >
                Done / View Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
