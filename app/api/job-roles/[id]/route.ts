import { NextResponse } from 'next/server';
import { mockStore, markRoleDeleted, persistMockStore } from '@/lib/mockStore';
import { getSupabaseServerClient } from '@/lib/supabaseServer';

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;

  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('job_roles')
        .select('*')
        .eq('id', id)
        .single();

      if (!error && data) {
        return NextResponse.json(data);
      }
    } catch {
      // Fallback to local
    }
  }

  if (mockStore.deletedRoleIds?.includes(id)) {
    return NextResponse.json({ detail: 'Job role not found' }, { status: 404 });
  }
  const role = mockStore.jobRoles.find((r) => r.id === id);
  if (!role) {
    return NextResponse.json({ detail: 'Job role not found' }, { status: 404 });
  }
  return NextResponse.json(role);
}

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const role = mockStore.jobRoles.find((r) => r.id === id);

  try {
    const body = await request.json();
    const updates: Record<string, any> = {};

    if (typeof body.title === 'string' && body.title.trim()) {
      updates.title = body.title.trim();
      if (role) role.title = updates.title;
    }
    if (typeof body.description === 'string') {
      updates.description = body.description.trim();
      if (role) role.description = updates.description;
    }
    if (body.skills_required !== undefined) {
      updates.skills_required = body.skills_required ? String(body.skills_required).trim() : null;
      if (role) role.skills_required = updates.skills_required;
    }

    const supabase = getSupabaseServerClient();
    if (supabase && Object.keys(updates).length > 0) {
      try {
        await supabase.from('job_roles').update(updates).eq('id', id);
      } catch (err) {
        console.warn('[Supabase DB] Error updating job role in Supabase:', err);
      }
    }

    if (role) {
      persistMockStore();
      return NextResponse.json(role);
    }

    return NextResponse.json({ id, ...updates });
  } catch {
    return NextResponse.json({ detail: 'Failed to update job role' }, { status: 400 });
  }
}

export async function PUT(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  return PATCH(request, props);
}

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;

  // 1. Delete from Supabase Database
  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      try {
        await supabase.from('answers').delete().eq('session_id', id);
        await supabase.from('sessions').delete().eq('job_role_id', id);
        await supabase.from('questions').delete().eq('job_role_id', id);
      } catch {
        // ignore cascading delete errors
      }
      const { error: delErr } = await supabase.from('job_roles').delete().eq('id', id);
      if (delErr) {
        console.warn('[Supabase DB] Delete job role warning:', delErr.message);
      } else {
        console.log('[Supabase DB] Successfully deleted job role from Supabase:', id);
      }
    } catch (err) {
      console.warn('[Supabase DB] Delete job role exception:', err);
    }
  }

  // 2. Also clean local memory and mark deleted
  markRoleDeleted(id);

  const index = mockStore.jobRoles.findIndex((r) => r.id === id);
  let removedTitle = 'Role';
  if (index !== -1) {
    const [removedRole] = mockStore.jobRoles.splice(index, 1);
    removedTitle = removedRole.title;
  }

  // Cascading cleanup of questions for this role
  mockStore.questions = mockStore.questions.filter((q) => q.job_role_id !== id);

  // Cascading cleanup of sessions and answers
  const removedSessionIds = new Set(
    mockStore.sessions.filter((s) => s.job_role_id === id).map((s) => s.id)
  );
  mockStore.sessions = mockStore.sessions.filter((s) => s.job_role_id !== id);
  mockStore.answers = mockStore.answers.filter((a) => !removedSessionIds.has(a.session_id));
  mockStore.turns = mockStore.turns.filter((t) => !removedSessionIds.has(t.session_id));

  persistMockStore();

  return NextResponse.json({
    deleted: true,
    id,
    title: removedTitle,
  });
}
