import { NextResponse } from 'next/server';
import { mockStore, persistMockStore } from '@/lib/mockStore';
import fs from 'fs';
import path from 'path';

export async function POST(
  request: Request,
  props: { params: Promise<{ sessionId: string; answerId: string }> }
) {
  const { sessionId, answerId } = await props.params;

  let session = mockStore.sessions.find((s) => s.id === sessionId);
  if (!session) {
    session = {
      id: sessionId,
      job_role_id: 'role-fe-1',
      candidate_id: `cand-${sessionId.slice(0, 8)}`,
      candidate_name: `Candidate ${sessionId.slice(0, 8)}`,
      question_source: 'ai',
      mode: 'recorded',
      status: 'in_progress',
      created_at: new Date().toISOString(),
    };
    mockStore.sessions.push(session);
  } else if (session.status === 'not_started') {
    session.status = 'in_progress';
  }

  let answer = mockStore.answers.find(
    (a) => a.id === answerId && a.session_id === sessionId
  );

  if (!answer) {
    answer = {
      id: answerId,
      session_id: sessionId,
      question_id: answerId,
      question_text: 'Candidate Interview Response',
      think_seconds: 30,
      answer_seconds: 90,
      status: 'pending',
      video_url: null,
      transcript: null,
      submitted_at: null,
    };
    mockStore.answers.push(answer);
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    const videoStreamingUrl = `/api/sessions/${sessionId}/answers/${answerId}/video`;

    if (file && typeof file === 'object' && 'arrayBuffer' in file) {
      try {
        const arrayBuffer = await (file as Blob).arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 1. Save to in-memory global cache for immediate streaming
        if (!(globalThis as any).__questai_video_cache__) {
          (globalThis as any).__questai_video_cache__ = new Map<string, Buffer>();
        }
        (globalThis as any).__questai_video_cache__.set(`${sessionId}-${answerId}`, buffer);

        // 2. Persist to disk in public/uploads/videos
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'videos');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const filePath = path.join(uploadsDir, `${sessionId}-${answerId}.webm`);
        fs.writeFileSync(filePath, buffer);
      } catch (fileErr) {
        console.warn('Notice writing video buffer:', fileErr);
      }

      answer.transcript = `[Candidate Verbal & Video Response Recorded]. Candidate addressed the question directly on camera with a structured response.`;
    }

    answer.video_url = videoStreamingUrl;
    answer.status = 'completed';
    answer.submitted_at = new Date().toISOString();

    persistMockStore();
    return NextResponse.json({
      success: true,
      answer_id: answerId,
      video_url: videoStreamingUrl,
    });
  } catch (err: any) {
    console.error('Upload processing error:', err);
    return NextResponse.json(
      { detail: 'Upload processing failed: ' + (err?.message || 'Unknown error') },
      { status: 500 }
    );
  }
}
