import fs from 'fs';

export interface JobRole {
  id: string;
  title: string;
  description: string;
  skills_required: string | null;
  created_at: string;
}

export interface Question {
  id: string;
  job_role_id: string;
  question_text: string;
  order_index: number;
  generated_by: 'ai' | 'manual';
  think_seconds: number;
  answer_seconds: number;
}

export interface Session {
  id: string;
  job_role_id: string;
  candidate_id: string;
  candidate_name?: string;
  question_source: 'ai' | 'manual';
  mode: 'recorded' | 'conversational';
  status: 'not_started' | 'in_progress' | 'submitted';
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

export interface Answer {
  id: string;
  session_id: string;
  question_id: string;
  question_text: string;
  think_seconds: number;
  answer_seconds: number;
  status: 'pending' | 'completed' | 'uploaded';
  video_url: string | null;
  transcript: string | null;
  submitted_at: string | null;
}

export interface ConversationTurn {
  id: string;
  session_id: string;
  role: 'ai' | 'candidate';
  content: string;
  order_index: number;
  created_at: string;
  video_url?: string | null;
}

// In-memory global store to preserve state across Route Handler invocations in dev/prod
declare global {
  var __questai_mock_data__: {
    jobRoles: JobRole[];
    questions: Question[];
    sessions: Session[];
    answers: Answer[];
    turns: ConversationTurn[];
  } | undefined;
}

if (!globalThis.__questai_mock_data__) {
  const initialJobRoles: JobRole[] = [
    {
      id: 'role-fe-1',
      title: 'Senior Frontend Engineer',
      description: 'Lead frontend development for our real-time recruiter and candidate dashboard, focusing on responsiveness, audio/video streaming, and smooth user experiences.',
      skills_required: 'React, TypeScript, Next.js, Tailwind CSS, WebRTC',
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: 'role-ai-2',
      title: 'Full Stack AI Engineer',
      description: 'Build robust end-to-end applications integrating generative AI, candidate evaluation pipelines, and reliable cloud microservices.',
      skills_required: 'Node.js, TypeScript, Next.js, Python, LLMs',
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
  ];

  const initialQuestions: Question[] = [
    {
      id: 'q-fe-1',
      job_role_id: 'role-fe-1',
      question_text: 'Can you walk us through a challenging frontend performance or state management issue you solved in React, and how you diagnosed it?',
      order_index: 0,
      generated_by: 'ai',
      think_seconds: 30,
      answer_seconds: 90,
    },
    {
      id: 'q-fe-2',
      job_role_id: 'role-fe-1',
      question_text: 'How do you approach building accessible (WCAG compliant) and responsive UI components across mobile and desktop?',
      order_index: 1,
      generated_by: 'ai',
      think_seconds: 30,
      answer_seconds: 90,
    },
    {
      id: 'q-fe-3',
      job_role_id: 'role-fe-1',
      question_text: 'Tell me about a time you had to debug a difficult production issue under tight deadlines.',
      order_index: 2,
      generated_by: 'manual',
      think_seconds: 30,
      answer_seconds: 120,
    },
    {
      id: 'q-ai-1',
      job_role_id: 'role-ai-2',
      question_text: 'How do you design APIs to handle LLM streaming, token limits, and intermittent provider failures?',
      order_index: 0,
      generated_by: 'ai',
      think_seconds: 30,
      answer_seconds: 90,
    },
    {
      id: 'q-ai-2',
      job_role_id: 'role-ai-2',
      question_text: 'Describe your experience building asynchronous job queues and background data processing pipelines.',
      order_index: 1,
      generated_by: 'ai',
      think_seconds: 30,
      answer_seconds: 120,
    },
  ];

  const initialSessions: Session[] = [
    {
      id: 'sess-demo-1',
      job_role_id: 'role-fe-1',
      candidate_id: 'cand-alex-489a2b',
      candidate_name: 'Alex Rivera',
      question_source: 'ai',
      mode: 'recorded',
      status: 'submitted',
      verdict: 'Alex showed great technical grasp of React profiling, component isolation, and defensive error handling. Communication was structured and concise.',
      rating: {
        technical: 5,
        communication: 4,
        problem_solving: 5,
        notes: 'Impressive explanation of state isolation and WebSocket optimization. Move to final leadership round.',
        decision: 'shortlisted',
      },
      created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    },
    {
      id: 'sess-demo-conv',
      job_role_id: 'role-ai-2',
      candidate_id: 'cand-maya-90fa1',
      candidate_name: 'Maya Chen',
      question_source: 'ai',
      mode: 'conversational',
      status: 'submitted',
      verdict: 'Verdict: Strong Hire Recommendation. Candidate demonstrated deep expertise with event-driven pipelines, token streaming, and graceful backoff strategies for LLM API integration. Handled live follow-up questions with technical maturity and clarity.',
      rating: {
        technical: 5,
        communication: 5,
        problem_solving: 4,
        notes: 'Strong knowledge of FastAPI async coroutines and LLM token orchestration.',
        decision: 'shortlisted',
      },
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
  ];

  const initialAnswers: Answer[] = [
    {
      id: 'ans-demo-1',
      session_id: 'sess-demo-1',
      question_id: 'q-fe-1',
      question_text: 'Can you walk us through a challenging frontend performance or state management issue you solved in React, and how you diagnosed it?',
      think_seconds: 30,
      answer_seconds: 90,
      status: 'completed',
      video_url: null,
      transcript: 'In our real-time dashboard, frequent WebSocket updates were re-rendering large component subtrees unnecessarily. I used the React DevTools Profiler to find hot paths, decoupled high-frequency data into isolated atom subscriptions, memoized heavy cards, and brought frame rates back to a solid 60fps.',
      submitted_at: new Date(Date.now() - 3600000 * 3.8).toISOString(),
    },
    {
      id: 'ans-demo-2',
      session_id: 'sess-demo-1',
      question_id: 'q-fe-2',
      question_text: 'How do you approach building accessible (WCAG compliant) and responsive UI components across mobile and desktop?',
      think_seconds: 30,
      answer_seconds: 90,
      status: 'completed',
      video_url: null,
      transcript: 'I prioritize semantic HTML first, ensuring keyboard tab orders and screen-reader announcements work natively before layering CSS. I use fluid responsive typography, CSS Grid/Flexbox layouts, and run automated axe accessibility checks as part of continuous integration.',
      submitted_at: new Date(Date.now() - 3600000 * 3.6).toISOString(),
    },
  ];

  const initialTurns: ConversationTurn[] = [
    {
      id: 'turn-1',
      session_id: 'sess-demo-conv',
      role: 'ai',
      content: 'Hi Maya, welcome to the QuestAI technical interview for Full Stack AI Engineer. To begin, could you briefly introduce yourself and tell us about a generative AI application you designed from scratch?',
      order_index: 0,
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
      id: 'turn-2',
      session_id: 'sess-demo-conv',
      role: 'candidate',
      content: 'Hello! Over the past two years, I built an automated document extraction and RAG pipeline using FastAPI, LangChain, and vector embeddings. We processed over 10,000 PDFs daily with sub-second retrieval times.',
      order_index: 1,
      created_at: new Date(Date.now() - 3600000 * 1.9).toISOString(),
      video_url: null,
    },
    {
      id: 'turn-3',
      session_id: 'sess-demo-conv',
      role: 'ai',
      content: 'That sounds impressive. How did you handle LLM rate limiting, context window overruns, and token latency under peak traffic?',
      order_index: 2,
      created_at: new Date(Date.now() - 3600000 * 1.8).toISOString(),
    },
    {
      id: 'turn-4',
      session_id: 'sess-demo-conv',
      role: 'candidate',
      content: 'We implemented token-bucket rate limiters in Redis, streamed chunks via Server-Sent Events to keep time-to-first-token low, and had a fallback queue to secondary model endpoints when the primary hit rate limits.',
      order_index: 3,
      created_at: new Date(Date.now() - 3600000 * 1.7).toISOString(),
      video_url: null,
    },
  ];

  const initialStore = {
    jobRoles: initialJobRoles,
    questions: initialQuestions,
    sessions: initialSessions,
    answers: initialAnswers,
    turns: initialTurns,
  };

  try {
    const DATA_FILE = '/tmp/questai_data.json';
    if (fs.existsSync(DATA_FILE)) {
      const saved = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
      globalThis.__questai_mock_data__ = {
        jobRoles: Array.isArray(saved.jobRoles) ? saved.jobRoles : initialStore.jobRoles,
        questions: Array.isArray(saved.questions) ? saved.questions : initialStore.questions,
        sessions: Array.isArray(saved.sessions) ? saved.sessions : initialStore.sessions,
        answers: Array.isArray(saved.answers) ? saved.answers : initialStore.answers,
        turns: Array.isArray(saved.turns) ? saved.turns : initialStore.turns,
      };
    } else {
      globalThis.__questai_mock_data__ = initialStore;
      fs.writeFileSync(DATA_FILE, JSON.stringify(initialStore), 'utf-8');
    }
  } catch {
    globalThis.__questai_mock_data__ = initialStore;
  }
}

export function persistMockStore() {
  try {
    if (globalThis.__questai_mock_data__) {
      fs.writeFileSync('/tmp/questai_data.json', JSON.stringify(globalThis.__questai_mock_data__), 'utf-8');
    }
  } catch {
    // ignore
  }
}

export const mockStore = globalThis.__questai_mock_data__!;


