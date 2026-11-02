import { NextResponse } from 'next/server';
import { mockStore } from '@/lib/mockStore';

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const sessions = mockStore.sessions
    .filter((s) => s.job_role_id === id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return NextResponse.json(sessions);
}
