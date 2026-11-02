import { NextResponse } from 'next/server';
import { mockStore, JobRole, persistMockStore } from '@/lib/mockStore';

export async function GET() {
  return NextResponse.json(mockStore.jobRoles);
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
    
    // Check if role already exists in store by id
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

