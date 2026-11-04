import { NextResponse } from 'next/server';
import { mockStore, persistMockStore } from '@/lib/mockStore';

export async function GET(
  _request: Request,
  props: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await props.params;
  let answers = mockStore.answers.filter((a) => a.session_id === sessionId);

  if (answers.length === 0) {
    const session = mockStore.sessions.find((s) => s.id === sessionId);
    const roleId = session?.job_role_id || 'role-fe-1';
    let questions = mockStore.questions.filter((q) => q.job_role_id === roleId);

    if (questions.length === 0) {
      questions = [
        {
          id: `q-${sessionId}-1`,
          job_role_id: roleId,
          question_text: 'Introduce yourself, your background, and why you are interested in this position.',
          order_index: 0,
          generated_by: 'ai',
          think_seconds: 30,
          answer_seconds: 90,
        },
        {
          id: `q-${sessionId}-2`,
          job_role_id: roleId,
          question_text: 'Describe a complex challenge or technical problem you solved, and how you approached it.',
          order_index: 1,
          generated_by: 'ai',
          think_seconds: 30,
          answer_seconds: 90,
        },
      ];
    }

    answers = questions.map((q, idx) => ({
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
    }));

    mockStore.answers.push(...answers);
    persistMockStore();
  }

  return NextResponse.json(answers);
}
