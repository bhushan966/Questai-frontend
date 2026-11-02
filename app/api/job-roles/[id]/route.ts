import { NextResponse } from 'next/server';
import { mockStore } from '@/lib/mockStore';

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
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
  if (!role) {
    return NextResponse.json({ detail: 'Job role not found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    if (typeof body.title === 'string' && body.title.trim()) {
      role.title = body.title.trim();
    }
    if (typeof body.description === 'string') {
      role.description = body.description.trim();
    }
    if (body.skills_required !== undefined) {
      role.skills_required = body.skills_required ? String(body.skills_required).trim() : null;
    }

    return NextResponse.json(role);
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
  const index = mockStore.jobRoles.findIndex((r) => r.id === id);
  if (index === -1) {
    return NextResponse.json({ detail: 'Job role not found' }, { status: 404 });
  }

  // Remove role
  const [removedRole] = mockStore.jobRoles.splice(index, 1);

  // Cascading cleanup of questions for this role
  mockStore.questions = mockStore.questions.filter((q) => q.job_role_id !== id);

  // Cascading cleanup of sessions and answers
  const removedSessionIds = new Set(
    mockStore.sessions.filter((s) => s.job_role_id === id).map((s) => s.id)
  );
  mockStore.sessions = mockStore.sessions.filter((s) => s.job_role_id !== id);
  mockStore.answers = mockStore.answers.filter((a) => !removedSessionIds.has(a.session_id));
  mockStore.turns = mockStore.turns.filter((t) => !removedSessionIds.has(t.session_id));

  return NextResponse.json({
    deleted: true,
    id: removedRole.id,
    title: removedRole.title,
  });
}
