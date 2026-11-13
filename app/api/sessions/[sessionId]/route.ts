import { NextResponse } from 'next/server';
import { mockStore, persistMockStore, markSessionDeleted } from '@/lib/mockStore';
import { getSupabaseServerClient, isUUID } from '@/lib/supabaseServer';

export async function GET(
  request: Request,
  props: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await props.params;

  if (mockStore.deletedSessionIds?.includes(sessionId)) {
    return NextResponse.json({ detail: 'Session not found' }, { status: 404 });
  }

  const supabase = getSupabaseServerClient(request);
  if (supabase && isUUID(sessionId)) {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (!error && data) {
        if (data.job_role_id) {
          try {
            const { data: roleData } = isUUID(data.job_role_id)
              ? await supabase
                  .from('job_roles')
                  .select('*')
                  .eq('id', data.job_role_id)
                  .single()
              : { data: null };
            if (roleData) {
              data.job_role = roleData;
            }
          } catch {}
        }
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

  const role = mockStore.jobRoles.find((r) => r.id === session.job_role_id);
  return NextResponse.json({
    ...session,
    job_role: role || (session as any).job_role,
  });
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

    const supabase = getSupabaseServerClient(request);
    if (supabase && isUUID(sessionId) && Object.keys(updates).length > 0) {
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

export async function DELETE(
  request: Request,
  props: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await props.params;

  // 1. Delete from Supabase Database if configured and ID is valid UUID
  const supabase = getSupabaseServerClient(request);
  if (supabase && isUUID(sessionId)) {
    try {
      try {
        await supabase.from('answers').delete().eq('session_id', sessionId);
        await supabase.from('turns').delete().eq('session_id', sessionId);
      } catch {
        // ignore cascading cleanup notice
      }
      const { error: delErr } = await supabase.from('sessions').delete().eq('id', sessionId);
      if (delErr) {
        console.warn('[Supabase DB] Error deleting session:', delErr.message);
      } else {
        console.log('[Supabase DB] Successfully deleted session from Supabase:', sessionId);
      }
    } catch (err) {
      console.warn('[Supabase DB] Exception deleting session:', err);
    }
  }

  // 2. Remove from local in-memory store and record permanent tombstone
  markSessionDeleted(sessionId);

  return NextResponse.json({ success: true, id: sessionId });
}
