import { NextResponse } from 'next/server';
import { mockStore, persistMockStore } from '@/lib/mockStore';

export async function GET(
  _request: Request,
  props: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await props.params;
  let answers = mockStore.answers.filter((a) => a.session_id === sessionId);

  // If no answers exist in mockStore for this session, find if session has a role and build answer placeholders
  if (answers.length === 0) {
    const session = mockStore.sessions.find((s) => s.id === sessionId);
    if (session) {
      const roleQuestions = mockStore.questions.filter((q) => q.job_role_id === session.job_role_id);
      if (roleQuestions.length > 0) {
        answers = roleQuestions.map((q, idx) => ({
          id: `ans-${sessionId}-${idx + 1}`,
          session_id: sessionId,
          question_id: q.id,
          question_text: q.question_text,
          think_seconds: q.think_seconds || 30,
          answer_seconds: q.answer_seconds || 90,
          status: 'completed',
          video_url: `/api/sessions/${sessionId}/answers/ans-${sessionId}-${idx + 1}/video`,
          transcript: `[Candidate Interview Response]. Candidate completed this video question during their assessment.`,
          submitted_at: session.created_at,
        }));
        mockStore.answers.push(...answers);
        persistMockStore();
      }
    }
  }

  return NextResponse.json(answers);
}
