import { NextResponse } from 'next/server';
import { mockStore, persistMockStore } from '@/lib/mockStore';

export async function POST(
  _request: Request,
  props: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await props.params;
  let session = mockStore.sessions.find((s) => s.id === sessionId);
  if (!session) {
    session = {
      id: sessionId,
      job_role_id: 'default',
      candidate_id: 'candidate',
      question_source: 'ai',
      mode: 'recorded',
      status: 'submitted',
      created_at: new Date().toISOString(),
    };
    mockStore.sessions.push(session);
  } else {
    session.status = 'submitted';
  }

  persistMockStore();
  return NextResponse.json({ success: true, status: 'submitted' });
}
