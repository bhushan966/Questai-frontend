import { NextResponse } from 'next/server';
import { mockStore, persistMockStore } from '@/lib/mockStore';

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;

  // Filter sessions for this role
  const rawSessions = mockStore.sessions
    .filter((s) => s.job_role_id === id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Deduplicate: if duplicate sessions were generated for the same candidate, prioritize the submitted session with videos
  const seenMap = new Map<string, typeof rawSessions[0]>();
  const deduplicated: typeof rawSessions = [];

  for (const s of rawSessions) {
    const key = (s.candidate_name && s.candidate_name !== 'Candidate' && !s.candidate_name.startsWith('Candidate cand-'))
      ? `name_${s.candidate_name.trim().toLowerCase()}`
      : `id_${s.candidate_id || s.id}`;

    const existing = seenMap.get(key);
    if (!existing) {
      seenMap.set(key, s);
      deduplicated.push(s);
    } else {
      // If the newly encountered session is submitted and the cached one is not, replace it
      if (s.status === 'submitted' && existing.status !== 'submitted') {
        const idx = deduplicated.indexOf(existing);
        if (idx !== -1) {
          deduplicated[idx] = s;
        }
        seenMap.set(key, s);
      }
    }
  }

  // Also purge orphaned duplicates from mockStore so the database stays clean
  if (deduplicated.length < rawSessions.length) {
    const removedIds = new Set(rawSessions.filter(s => !deduplicated.includes(s)).map(s => s.id));
    mockStore.sessions = mockStore.sessions.filter(s => !removedIds.has(s.id));
    persistMockStore();
  }

  return NextResponse.json(deduplicated);
}
