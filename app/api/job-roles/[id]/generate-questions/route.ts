import { NextResponse } from 'next/server';
import { mockStore, Question, persistMockStore } from '@/lib/mockStore';
import { getSupabaseServerClient, isUUID } from '@/lib/supabaseServer';

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // Body is optional
  }

  const role = mockStore.jobRoles.find((r) => r.id === id) || {
    id,
    title: body.title || 'Software Professional',
    description: body.description || '',
    skills_required: body.skills_required || 'Technical competencies',
    created_at: new Date().toISOString(),
  };

  const title = role.title;
  const skills = role.skills_required || title;

  const generatedQuestions: Question[] = [
    {
      id: `q-${Date.now()}-1`,
      job_role_id: id,
      question_text: `Can you walk us through a challenging technical project you worked on relevant to ${title}? What key architecture or problem-solving decisions did you make?`,
      order_index: 0,
      generated_by: 'ai',
      think_seconds: 30,
      answer_seconds: 90,
    },
    {
      id: `q-${Date.now()}-2`,
      job_role_id: id,
      question_text: `How do you handle technical debt, testing, and system reliability when delivering features quickly for ${skills}?`,
      order_index: 1,
      generated_by: 'ai',
      think_seconds: 30,
      answer_seconds: 90,
    },
    {
      id: `q-${Date.now()}-3`,
      job_role_id: id,
      question_text: `Describe a scenario where you disagreed with a teammate or stakeholder on technical direction or product trade-offs. How did you resolve it?`,
      order_index: 2,
      generated_by: 'ai',
      think_seconds: 30,
      answer_seconds: 120,
    },
  ];

  // Remove existing AI questions for this role and add the new ones in mockStore
  mockStore.questions = mockStore.questions.filter(
    (q) => !(q.job_role_id === id && q.generated_by === 'ai')
  );
  mockStore.questions.push(...generatedQuestions);

  // Sync to Supabase if valid UUID
  const supabase = getSupabaseServerClient();
  if (supabase && isUUID(id)) {
    try {
      await supabase
        .from('questions')
        .delete()
        .eq('job_role_id', id)
        .eq('generated_by', 'ai');
      await supabase.from('questions').upsert(
        generatedQuestions.map((q) => ({
          ...q,
          id: isUUID(q.id) ? q.id : crypto.randomUUID(),
        }))
      );
    } catch (err) {
      console.warn('[Supabase DB] Error syncing generated questions:', err);
    }
  }

  persistMockStore();

  return NextResponse.json({ success: true, count: generatedQuestions.length });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
