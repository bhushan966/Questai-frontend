import { NextResponse } from 'next/server';
import { mockStore, persistMockStore, SubmissionNotification } from '@/lib/mockStore';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const recruiterId = searchParams.get('recruiter_id');

  if (!mockStore.notifications) {
    mockStore.notifications = [];
  }

  // Filter if recruiterId is supplied
  let list = mockStore.notifications;
  if (recruiterId) {
    list = list.filter(
      (n) => !n.recruiter_id || n.recruiter_id === recruiterId
    );
  }

  return NextResponse.json({
    notifications: list,
    unreadCount: list.filter((n) => !n.read).length,
  });
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { notificationId, markAllRead } = body;

    if (!mockStore.notifications) {
      mockStore.notifications = [];
    }

    if (markAllRead) {
      mockStore.notifications.forEach((n) => {
        n.read = true;
      });
    } else if (notificationId) {
      const found = mockStore.notifications.find((n) => n.id === notificationId);
      if (found) {
        found.read = true;
      }
    }

    persistMockStore();
    return NextResponse.json({ success: true, notifications: mockStore.notifications });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update notifications' }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { session_id, candidate_name, job_role_id, job_role_title, company_name, recruiter_id } = body;

    if (!mockStore.notifications) {
      mockStore.notifications = [];
    }

    const newNotice: SubmissionNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      session_id: session_id || `sess-${Date.now()}`,
      candidate_name: candidate_name || 'Candidate',
      job_role_id: job_role_id || 'role-default',
      job_role_title: job_role_title || 'Video Interview',
      company_name: company_name || null,
      recruiter_id: recruiter_id || null,
      submitted_at: new Date().toISOString(),
      read: false,
    };

    mockStore.notifications.unshift(newNotice);
    persistMockStore();

    return NextResponse.json({ success: true, notification: newNotice });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create notification' }, { status: 400 });
  }
}
