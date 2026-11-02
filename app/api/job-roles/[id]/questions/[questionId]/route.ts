import { NextResponse } from 'next/server';
import { mockStore } from '@/lib/mockStore';

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ id: string; questionId: string }> }
) {
  const { questionId } = await props.params;
  const initialLen = mockStore.questions.length;
  mockStore.questions = mockStore.questions.filter((q) => q.id !== questionId);
  if (mockStore.questions.length === initialLen) {
    return NextResponse.json({ detail: 'Question not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
