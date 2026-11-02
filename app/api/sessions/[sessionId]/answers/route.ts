import { NextResponse } from 'next/server';
import { mockStore } from '@/lib/mockStore';

export async function GET(
  _request: Request,
  props: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await props.params;
  const answers = mockStore.answers.filter((a) => a.session_id === sessionId);
  return NextResponse.json(answers);
}
