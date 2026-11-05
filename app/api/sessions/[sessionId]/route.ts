import { NextResponse } from 'next/server';
import { mockStore, persistMockStore } from '@/lib/mockStore';
import { getSupabaseServerClient } from '@/lib/supabaseServer';

export async function GET(
  _request: Request,
  props: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await props.params;

  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (!error && data) {
        return NextResponse.json(data);
      }
    } catch {
      // fallback
    }
  }

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

  try {
    const body = await request.json();
    const updates: Record<string, any> = {};

    if (body.rating) {
      updates.rating = body.rating;
      if (session) {
        session.rating = {
          ...session.rating,
          ...body.rating,
        };
      }
    }
    if (body.status) {
      updates.status = body.status;
      if (session) session.status = body.status;
    }
    if (body.verdict !== undefined) {
      updates.verdict = body.verdict;
      if (session) session.verdict = body.verdict;
    }

    const supabase = getSupabaseServerClient();
    if (supabase && Object.keys(updates).length > 0) {
      try {
        await supabase.from('sessions').update(updates).eq('id', sessionId);
      } catch (err) {
        console.warn('[Supabase DB] Error updating session:', err);
      }
    }

    if (session) {
      persistMockStore();
      return NextResponse.json(session);
    }

    return NextResponse.json({ id: sessionId, ...updates });
  } catch {
    return NextResponse.json({ detail: 'Failed to update session' }, { status: 400 });
  }
}
