import { NextResponse } from 'next/server';
import { mockStore, persistMockStore } from '@/lib/mockStore';

export async function POST(
  request: Request,
  props: { params: Promise<{ sessionId: string; answerId: string }> }
) {
  const { sessionId, answerId } = await props.params;
  let answer = mockStore.answers.find(
    (a) => a.id === answerId && a.session_id === sessionId
  );

  if (!answer) {
    answer = {
      id: answerId,
      session_id: sessionId,
      question_id: answerId,
      question_text: 'Candidate Response',
      think_seconds: 30,
      answer_seconds: 90,
      status: 'pending',
      video_url: null,
      transcript: null,
      submitted_at: null,
    };
    mockStore.answers.push(answer);
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    answer.status = 'completed';
    answer.submitted_at = new Date().toISOString();

    // If file is provided, create transcript based on the question
    if (file && typeof file === 'object') {
      answer.transcript = `[Candidate Voice/Video Recording Submitted]. Candidate provided a detailed verbal response addressing the interview prompt.`;
    }

    persistMockStore();
    return NextResponse.json({ success: true, answer_id: answerId });
  } catch {
    return NextResponse.json({ detail: 'Upload processing failed' }, { status: 500 });
  }
}
