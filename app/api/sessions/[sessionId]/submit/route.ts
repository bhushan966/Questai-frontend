import { NextResponse } from 'next/server';
import { mockStore, persistMockStore } from '@/lib/mockStore';
import { getSupabaseServerClient } from '@/lib/supabaseServer';

export async function POST(
  _request: Request,
  props: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await props.params;
  let session = mockStore.sessions.find((s) => s.id === sessionId);
  if (!session) {
    session = {
      id: sessionId,
      job_role_id: 'role-fe-1',
      candidate_id: `cand-${sessionId.slice(0, 8)}`,
      candidate_name: `Candidate ${sessionId.slice(0, 8)}`,
      question_source: 'ai',
      mode: 'recorded',
      status: 'submitted',
      created_at: new Date().toISOString(),
    };
    mockStore.sessions.push(session);
  } else {
    session.status = 'submitted';
  }

  // Ensure all answers are marked completed
  const sessionAnswers = mockStore.answers.filter((a) => a.session_id === sessionId);
  for (const ans of sessionAnswers) {
    ans.status = 'completed';
    if (!ans.video_url) {
      ans.video_url = `/api/sessions/${sessionId}/answers/${ans.id}/video`;
    }
  }

  // Sync to Supabase
  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      await supabase
        .from('sessions')
        .update({ status: 'submitted' })
        .eq('id', sessionId);

      if (sessionAnswers.length > 0) {
        await supabase
          .from('answers')
          .update({ status: 'completed' })
          .eq('session_id', sessionId);
      }
    } catch (err) {
      console.warn('[Supabase DB] Error marking session submitted:', err);
    }
  }

  persistMockStore();
  return NextResponse.json({ success: true, status: 'submitted' });
}
