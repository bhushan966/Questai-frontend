import { NextResponse } from 'next/server';
import { mockStore } from '@/lib/mockStore';

export async function GET(
  _request: Request,
  props: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await props.params;
  const session = mockStore.sessions.find((s) => s.id === sessionId);
  if (!session) {
    return NextResponse.json({ detail: 'Session not found' }, { status: 404 });
  }
  return NextResponse.json(session);
}

export async function PATCH(
  request: Request,
  props: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await props.params;
  const session = mockStore.sessions.find((s) => s.id === sessionId);
  if (!session) {
    return NextResponse.json({ detail: 'Session not found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    if (body.rating) {
      session.rating = {
        ...session.rating,
        ...body.rating,
      };
    }
    if (body.status) {
      session.status = body.status;
    }
    if (body.verdict !== undefined) {
      session.verdict = body.verdict;
    }
    return NextResponse.json(session);
  } catch {
    return NextResponse.json({ detail: 'Failed to update session' }, { status: 400 });
  }
}
