import { NextResponse } from 'next/server';
import { mockStore } from '@/lib/mockStore';

export async function POST(
  _request: Request,
  props: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await props.params;
  const session = mockStore.sessions.find((s) => s.id === sessionId);
  if (!session) {
    return NextResponse.json({ detail: 'Session not found' }, { status: 404 });
  }

  session.status = 'submitted';
  return NextResponse.json({ success: true, status: 'submitted' });
}
