import { NextResponse } from 'next/server';
import { mockStore } from '@/lib/mockStore';

export async function POST(
  request: Request,
  props: { params: Promise<{ sessionId: string; answerId: string }> }
) {
  const { sessionId, answerId } = await props.params;
  const answer = mockStore.answers.find(
    (a) => a.id === answerId && a.session_id === sessionId
  );

  if (!answer) {
    return NextResponse.json({ detail: 'Answer not found' }, { status: 404 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    answer.status = 'completed';
    answer.submitted_at = new Date().toISOString();

    // If file is provided, create a mock transcript based on the question
    if (file && typeof file === 'object') {
      answer.transcript = `[Candidate Voice Recording Submitted - Duration ~${answer.answer_seconds}s]. Candidate provided a detailed response addressing: "${answer.question_text}".`;
    }

    return NextResponse.json({ success: true, answer_id: answerId });
  } catch {
    return NextResponse.json({ detail: 'Upload processing failed' }, { status: 500 });
  }
}
