import { NextResponse } from 'next/server';
import { mockStore, JobRole, persistMockStore } from '@/lib/mockStore';
import { getSupabaseServerClient } from '@/lib/supabaseServer';

export async function GET() {
  const supabase = getSupabaseServerClient();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('job_roles')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        // Sync local mockStore with Supabase data so in-memory cache stays aligned
        mockStore.jobRoles = data;
        return NextResponse.json(data);
      }
    } catch (err) {
      console.warn('[Supabase DB] Error querying job_roles table, falling back to local store:', err);
    }
  }

  // Fallback to local store if Supabase table is not yet created or offline
  const deletedSet = new Set(mockStore.deletedRoleIds || []);
  const active = mockStore.jobRoles.filter((r) => !deletedSet.has(r.id));
  return NextResponse.json(active);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const newRole: JobRole = {
      id: body.id || `role-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: body.title || 'Untitled Role',
      description: body.description || '',
      skills_required: body.skills_required || null,
      created_at: body.created_at || new Date().toISOString(),
    };

    // If it was marked deleted previously, unmark it
    if (mockStore.deletedRoleIds) {
      mockStore.deletedRoleIds = mockStore.deletedRoleIds.filter((id) => id !== newRole.id);
    }

    // 1. Persist directly to Supabase Database if configured
    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        const { error: sbErr } = await supabase
          .from('job_roles')
          .upsert([
            {
              id: newRole.id,
              title: newRole.title,
              description: newRole.description,
              skills_required: newRole.skills_required,
              created_at: newRole.created_at,
            },
          ]);

        if (sbErr) {
          console.warn('[Supabase DB] Upsert job_roles warning:', sbErr.message);
        } else {
          console.log('[Supabase DB] Successfully persisted job role to Supabase:', newRole.id);
        }
      } catch (sbEx) {
        console.warn('[Supabase DB] Exception upserting job role:', sbEx);
      }
    }

    // 2. Also keep in local mock store for instant access
    const existingIndex = mockStore.jobRoles.findIndex((r) => r.id === newRole.id);
    if (existingIndex >= 0) {
      mockStore.jobRoles[existingIndex] = newRole;
    } else {
      mockStore.jobRoles.unshift(newRole);
    }

    persistMockStore();
    return NextResponse.json(newRole, { status: 201 });
  } catch {
    return NextResponse.json({ detail: 'Invalid request' }, { status: 400 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
