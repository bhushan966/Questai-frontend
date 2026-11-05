import { NextResponse } from 'next/server';
import { mockStore, Question, persistMockStore } from '@/lib/mockStore';
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
        .from('questions')
        .select('*')
        .eq('job_role_id', id)
        .order('order_index', { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        return NextResponse.json(data);
      }
    } catch {
      // fallback
    }
  }

  const questions = mockStore.questions
    .filter((q) => q.job_role_id === id)
    .sort((a, b) => a.order_index - b.order_index);
  return NextResponse.json(questions);
}

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  try {
    const body = await request.json();
    const existing = mockStore.questions.filter((q) => q.job_role_id === id);
    const newQuestion: Question = {
      id: `q-man-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      job_role_id: id,
      question_text: body.question_text || '',
      order_index: existing.length,
      generated_by: 'manual',
      think_seconds: 30,
      answer_seconds: Number(body.answer_seconds) || 90,
    };

    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        await supabase.from('questions').upsert([newQuestion]);
      } catch (err) {
        console.warn('[Supabase DB] Error inserting question:', err);
      }
    }

    mockStore.questions.push(newQuestion);
    persistMockStore();
    return NextResponse.json(newQuestion, { status: 201 });
  } catch {
    return NextResponse.json({ detail: 'Failed to add question' }, { status: 400 });
  }
}
