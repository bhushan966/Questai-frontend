import { NextResponse } from 'next/server';
import { mockStore, Session, Answer, persistMockStore } from '@/lib/mockStore';
import { getSupabaseServerClient, isUUID, getAuthUserId } from '@/lib/supabaseServer';

// Helper to clean up any duplicate ghost sessions
function cleanDuplicateSessions(sessions: Session[]): Session[] {
  const seenCandidateKeys = new Map<string, Session>();
  const toKeep: Session[] = [];

  for (const sess of sessions) {
    const key = `${sess.job_role_id}__${sess.candidate_id || ''}__${(sess.candidate_name || '').toLowerCase()}`;
    const existing = seenCandidateKeys.get(key);

    if (!existing) {
      seenCandidateKeys.set(key, sess);
      toKeep.push(sess);
    } else {
      if (sess.status === 'submitted' && existing.status !== 'submitted') {
        const idx = toKeep.indexOf(existing);
        if (idx !== -1) {
          toKeep[idx] = sess;
        }
        seenCandidateKeys.set(key, sess);
      }
    }
  }

  return toKeep;
}

export async function GET(request: Request) {
  const supabase = getSupabaseServerClient();
  const userId = await getAuthUserId(request);

  if (supabase) {
    try {
      let query = supabase
        .from('sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (userId) {
        query = query.or(`recruiter_id.eq.${userId},recruiter_id.is.null`);
      }

      const { data, error } = await query;

      if (!error && Array.isArray(data)) {
        // Merge with local mockStore
        const merged = cleanDuplicateSessions([...data, ...mockStore.sessions]);
        mockStore.sessions = merged;
        return NextResponse.json(merged);
      }
    } catch (err) {
      console.warn('[Supabase DB] Error querying sessions table:', err);
    }
  }

  const cleaned = cleanDuplicateSessions(mockStore.sessions);
  if (cleaned.length !== mockStore.sessions.length) {
    mockStore.sessions = cleaned;
    persistMockStore();
  }
  return NextResponse.json(mockStore.sessions);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      id: requestedId,
      job_role_id,
      candidate_id,
      candidate_name,
      question_source,
      mode,
      job_role_title,
      job_role_description,
      skills_required,
    } = body;

    // 1. If an existing session ID was requested, return it (prevents duplicate link generation)
    if (requestedId) {
      const existing = mockStore.sessions.find((s) => s.id === requestedId);
      if (existing) {
        if (candidate_name && !existing.candidate_name) existing.candidate_name = candidate_name;
        if (job_role_title && !(existing as any).job_role_title) (existing as any).job_role_title = job_role_title;
        if (job_role_description && !(existing as any).job_role_description) (existing as any).job_role_description = job_role_description;
        persistMockStore();
        return NextResponse.json(existing);
      }
    }

    // 2. Prevent duplicate session creation for the same candidate in the same role within recent window
    if (candidate_id && job_role_id) {
      const existingByCandidate = mockStore.sessions.find(
        (s) =>
          s.job_role_id === job_role_id &&
          s.candidate_id === candidate_id &&
          Date.now() - new Date(s.created_at).getTime() < 10 * 60 * 1000
      );
      if (existingByCandidate) {
        return NextResponse.json(existingByCandidate);
      }
    }

    const userId = (await getAuthUserId(request)) || body.recruiter_id || null;
    const sessionId = requestedId || crypto.randomUUID();
    const newSession: Session = {
      id: sessionId,
      job_role_id,
      candidate_id: candidate_id || `cand-${Date.now().toString(36)}`,
      candidate_name: candidate_name || (candidate_id ? `Candidate ${candidate_id.slice(0, 8)}` : `Candidate ${sessionId.slice(0, 8)}`),
      recruiter_id: userId,
      question_source: question_source || 'ai',
      mode: mode === 'conversational' ? 'conversational' : 'recorded',
      status: 'not_started',
      created_at: new Date().toISOString(),
    };
    (newSession as any).job_role_title = job_role_title;
    (newSession as any).job_role_description = job_role_description;
    (newSession as any).skills_required = skills_required;

    // Persist session to Supabase if valid UUID
    const supabase = getSupabaseServerClient();
    if (supabase && isUUID(newSession.id) && isUUID(newSession.job_role_id)) {
      try {
        await supabase.from('sessions').upsert([
          {
            id: newSession.id,
            job_role_id: newSession.job_role_id,
            candidate_id: newSession.candidate_id,
            candidate_name: newSession.candidate_name,
            recruiter_id: newSession.recruiter_id,
            question_source: newSession.question_source,
            mode: newSession.mode,
            status: newSession.status,
            created_at: newSession.created_at,
          },
        ]);
      } catch (err) {
        console.warn('[Supabase DB] Error inserting session:', err);
      }
    }

    mockStore.sessions.unshift(newSession);

    // If recorded mode, pre-populate questions & answers
    if (newSession.mode !== 'conversational') {
      let questionsForRole = mockStore.questions.filter(
        (q) => q.job_role_id === job_role_id && q.generated_by === (question_source || 'ai')
      );

      if (questionsForRole.length === 0) {
        questionsForRole = mockStore.questions.filter((q) => q.job_role_id === job_role_id);
      }

      if (questionsForRole.length === 0) {
        const fallbackQ = {
          id: `q-fallback-${Date.now()}`,
          job_role_id,
          question_text: 'Please introduce yourself and explain what makes you a great fit for this role.',
          order_index: 0,
          generated_by: (question_source as 'ai' | 'manual') || 'ai',
          think_seconds: 30,
          answer_seconds: 90,
        };
        mockStore.questions.push(fallbackQ);
        questionsForRole = [fallbackQ];
      }

      const answersToInsert: Answer[] = [];
      questionsForRole.forEach((q, idx) => {
        const answer: Answer = {
          id: `ans-${sessionId}-${idx + 1}`,
          session_id: sessionId,
          question_id: q.id,
          question_text: q.question_text,
          think_seconds: q.think_seconds || 30,
          answer_seconds: q.answer_seconds || 90,
          status: 'pending',
          video_url: null,
          transcript: null,
          submitted_at: null,
        };
        mockStore.answers.push(answer);
        answersToInsert.push(answer);
      });

      if (supabase && isUUID(sessionId) && answersToInsert.length > 0) {
        try {
          await supabase.from('answers').upsert(
            answersToInsert.map((a) => ({
              id: isUUID(a.id) ? a.id : crypto.randomUUID(),
              session_id: a.session_id,
              question_id: a.question_id,
              question_text: a.question_text,
              think_seconds: a.think_seconds,
              answer_seconds: a.answer_seconds,
              status: a.status,
              created_at: new Date().toISOString(),
            }))
          );
        } catch {
          // Fallback
        }
      }
    }

    persistMockStore();

    return NextResponse.json(newSession, { status: 201 });
  } catch {
    return NextResponse.json({ detail: 'Failed to create session' }, { status: 400 });
  }
}
