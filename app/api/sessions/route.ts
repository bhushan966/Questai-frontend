import { NextResponse } from 'next/server';
import { mockStore, Session, Answer, persistMockStore } from '@/lib/mockStore';

export async function GET() {
  return NextResponse.json(mockStore.sessions);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { job_role_id, candidate_id, candidate_name, question_source, mode } = body;

    const sessionId = `sess-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newSession: Session = {
      id: sessionId,
      job_role_id,
      candidate_id: candidate_id || `cand-${Date.now().toString(36)}`,
      candidate_name: candidate_name || (candidate_id ? `Candidate ${candidate_id.slice(0, 8)}` : `Candidate ${sessionId.slice(5, 11)}`),
      question_source: question_source || 'ai',
      mode: mode === 'conversational' ? 'conversational' : 'recorded',
      status: 'not_started',
      created_at: new Date().toISOString(),
    };

    mockStore.sessions.unshift(newSession);

    // If recorded mode, pre-populate questions
    if (newSession.mode !== 'conversational') {
      let questionsForRole = mockStore.questions.filter(
        (q) => q.job_role_id === job_role_id && q.generated_by === (question_source || 'ai')
      );

      if (questionsForRole.length === 0) {
        questionsForRole = mockStore.questions.filter((q) => q.job_role_id === job_role_id);
      }

      if (questionsForRole.length === 0) {
        const fallbackQ = {
          id: `q-fallback-${Date.now()}`,
          job_role_id,
          question_text: 'Please introduce yourself and explain what makes you a great fit for this role.',
          order_index: 0,
          generated_by: (question_source as 'ai' | 'manual') || 'ai',
          think_seconds: 30,
          answer_seconds: 90,
        };
        mockStore.questions.push(fallbackQ);
        questionsForRole = [fallbackQ];
      }

      questionsForRole.forEach((q, idx) => {
        const answer: Answer = {
          id: `ans-${sessionId}-${idx + 1}`,
          session_id: sessionId,
          question_id: q.id,
          question_text: q.question_text,
          think_seconds: q.think_seconds || 30,
          answer_seconds: q.answer_seconds || 90,
          status: 'pending',
          video_url: null,
          transcript: null,
          submitted_at: null,
        };
        mockStore.answers.push(answer);
      });
    }

    persistMockStore();

    return NextResponse.json(newSession, { status: 201 });
  } catch {
    return NextResponse.json({ detail: 'Failed to create session' }, { status: 400 });
  }
}

