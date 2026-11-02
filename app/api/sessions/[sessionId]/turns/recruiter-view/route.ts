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

  const turns = mockStore.turns
    .filter((t) => t.session_id === sessionId)
    .sort((a, b) => a.order_index - b.order_index);

  return NextResponse.json({
    turns: turns.map((t) => ({
      role: t.role,
      content: t.content,
      video_url: t.video_url || null,
      created_at: t.created_at,
    })),
    verdict: session.verdict || null,
  });
}
