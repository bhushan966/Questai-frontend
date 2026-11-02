import { NextResponse } from 'next/server';
import { mockStore, ConversationTurn } from '@/lib/mockStore';

export async function POST(
  _request: Request,
  props: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await props.params;
  const session = mockStore.sessions.find((s) => s.id === sessionId);
  if (!session) {
    return NextResponse.json({ detail: 'Session not found' }, { status: 404 });
  }

  const existingTurns = mockStore.turns.filter((t) => t.session_id === sessionId);
  if (existingTurns.length > 0) {
    const lastAi = [...existingTurns].reverse().find((t) => t.role === 'ai');
    return NextResponse.json({
      message: lastAi?.content || 'Welcome back to your interview.',
      action: 'resume',
    });
  }

  const jobRole = mockStore.jobRoles.find((r) => r.id === session.job_role_id);
  const roleTitle = jobRole?.title || 'this position';

  const welcomeMessage = `Hi! Welcome to your interactive interview for the ${roleTitle} role. To get started, could you briefly introduce yourself and share a key project you worked on recently?`;

  const initialTurn: ConversationTurn = {
    id: `turn-${Date.now()}-0`,
    session_id: sessionId,
    role: 'ai',
    content: welcomeMessage,
    order_index: 0,
    created_at: new Date().toISOString(),
  };

  mockStore.turns.push(initialTurn);
  session.status = 'in_progress';

  return NextResponse.json({
    message: welcomeMessage,
    action: 'next_topic',
  });
}
