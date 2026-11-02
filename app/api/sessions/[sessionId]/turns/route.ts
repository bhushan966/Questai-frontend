import { NextResponse } from 'next/server';
import { mockStore, ConversationTurn } from '@/lib/mockStore';

export async function GET(
  _request: Request,
  props: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await props.params;
  const turns = mockStore.turns
    .filter((t) => t.session_id === sessionId)
    .sort((a, b) => a.order_index - b.order_index);
  return NextResponse.json({
    turns: turns.map((t) => ({ role: t.role, content: t.content, video_url: t.video_url })),
  });
}

export async function POST(
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
    const candidateTranscript = body.transcript || 'Candidate provided a spoken response.';

    const existingTurns = mockStore.turns
      .filter((t) => t.session_id === sessionId)
      .sort((a, b) => a.order_index - b.order_index);

    const nextIndex = existingTurns.length;
    const candidateTurnId = `turn-${Date.now()}-${nextIndex}`;

    // Add candidate turn
    const candidateTurn: ConversationTurn = {
      id: candidateTurnId,
      session_id: sessionId,
      role: 'candidate',
      content: candidateTranscript,
      order_index: nextIndex,
      created_at: new Date().toISOString(),
    };
    mockStore.turns.push(candidateTurn);

    const candidateTurnsCount = existingTurns.filter((t) => t.role === 'candidate').length + 1;
    const jobRole = mockStore.jobRoles.find((r) => r.id === session.job_role_id);
    const roleTitle = jobRole?.title || 'Engineer';

    let aiMessage = '';
    let action: 'follow_up' | 'next_topic' | 'conclude' = 'follow_up';

    if (candidateTurnsCount === 1) {
      aiMessage = `Thanks for sharing that background. Diving deeper into ${jobRole?.skills_required || roleTitle}: Can you describe a specific production architecture decision or optimization you had to make under pressure?`;
      action = 'next_topic';
    } else if (candidateTurnsCount === 2) {
      aiMessage = `Great perspective. How do you approach automated testing, error recovery, and team collaboration when rolling out updates for that kind of system?`;
      action = 'follow_up';
    } else {
      aiMessage = `Thank you so much for walking through these scenarios in detail! That concludes all our interview topics for today. You have completed the conversational assessment.`;
      action = 'conclude';

      session.status = 'submitted';
      session.verdict = `Automated AI Evaluation for ${session.candidate_name || 'Candidate'}: Demonstrated strong technical fluency in ${jobRole?.skills_required || roleTitle}. Answered follow-up queries with clarity, structured reasoning, and practical engineering trade-offs. Overall recommendation: Proceed to technical interview.`;
    }

    const aiTurn: ConversationTurn = {
      id: `turn-${Date.now()}-${nextIndex + 1}`,
      session_id: sessionId,
      role: 'ai',
      content: aiMessage,
      order_index: nextIndex + 1,
      created_at: new Date().toISOString(),
    };
    mockStore.turns.push(aiTurn);

    return NextResponse.json({
      message: aiMessage,
      action,
      turn_id: candidateTurnId,
    });
  } catch {
    return NextResponse.json({ detail: 'Failed to process turn' }, { status: 400 });
  }
}
