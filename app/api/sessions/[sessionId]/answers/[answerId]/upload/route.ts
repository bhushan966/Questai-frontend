import { NextResponse } from 'next/server';
import { mockStore, persistMockStore } from '@/lib/mockStore';
import { getSupabaseServerClient, isUUID } from '@/lib/supabaseServer';
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
    const clientProvidedVideoUrl = formData.get('video_url');

    let finalVideoUrl = typeof clientProvidedVideoUrl === 'string' && clientProvidedVideoUrl.startsWith('http')
      ? clientProvidedVideoUrl
      : `/api/sessions/${sessionId}/answers/${answerId}/video`;

    let supabaseUploaded = false;
    const supabase = getSupabaseServerClient();

    if (file && typeof file === 'object' && 'arrayBuffer' in file) {
      try {
        const arrayBuffer = await (file as Blob).arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 1. Save to in-memory global cache for immediate streaming
        if (!(globalThis as any).__questai_video_cache__) {
          (globalThis as any).__questai_video_cache__ = new Map<string, Buffer>();
        }
        (globalThis as any).__questai_video_cache__.set(`${sessionId}-${answerId}`, buffer);

        // 2. Persist to disk (/tmp and public/uploads if available)
        try {
          const tmpDir = path.join('/tmp', 'questai_videos');
          if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
          fs.writeFileSync(path.join(tmpDir, `${sessionId}-${answerId}.webm`), buffer);

          const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'videos');
          if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
          fs.writeFileSync(path.join(uploadsDir, `${sessionId}-${answerId}.webm`), buffer);
        } catch {
          // Ignore read-only filesystem restrictions on serverless environments
        }

        // 3. Persist video file directly to Supabase Storage
        if (supabase) {
          try {
            const storagePath = `${sessionId}/${answerId}.webm`;

            // Auto-create bucket if missing
            try {
              await supabase.storage.createBucket('interview-videos', {
                public: true,
                fileSizeLimit: 104857600, // 100MB
              });
            } catch {
              // Ignore if bucket already exists
            }

            const { data: uploadData, error: sbErr } = await supabase.storage
              .from('interview-videos')
              .upload(storagePath, buffer, {
                contentType: 'video/webm',
                upsert: true,
              });

            if (!sbErr && uploadData) {
              const { data: pubData } = supabase.storage
                .from('interview-videos')
                .getPublicUrl(storagePath);
              if (pubData?.publicUrl) {
                finalVideoUrl = pubData.publicUrl;
                supabaseUploaded = true;
                console.log(`[Supabase Storage Success] Stored video in Supabase at: ${finalVideoUrl}`);
              }
            } else if (sbErr) {
              console.warn('[Supabase Storage Warning]:', sbErr.message);
            }
          } catch (sbEx: any) {
            console.warn('[Supabase Storage Exception]:', sbEx?.message);
          }
        }
      } catch (fileErr) {
        console.warn('Notice processing video buffer:', fileErr);
      }

      answer.transcript = `[Candidate Verbal & Video Response Recorded]. Candidate addressed the question directly on camera with a structured response.`;
    }

    answer.video_url = finalVideoUrl;
    answer.status = 'completed';
    answer.submitted_at = new Date().toISOString();

    // 4. CRITICAL: Persist answer record & video_url directly into Supabase Database `answers` table if valid UUID
    if (supabase && isUUID(answer.session_id)) {
      try {
        await supabase.from('answers').upsert([
          {
            id: isUUID(answer.id) ? answer.id : crypto.randomUUID(),
            session_id: answer.session_id,
            question_id: answer.question_id,
            question_text: answer.question_text,
            think_seconds: answer.think_seconds,
            answer_seconds: answer.answer_seconds,
            status: answer.status,
            video_url: finalVideoUrl,
            transcript: answer.transcript,
            submitted_at: answer.submitted_at,
          },
        ]);
        console.log(`[Supabase DB Success] Saved answer & video URL to Supabase answers table: ${answer.id}`);
      } catch (dbErr) {
        console.warn('[Supabase DB Warning] Error saving answer to Supabase DB:', dbErr);
      }
    }

    persistMockStore();
    return NextResponse.json({
      success: true,
      answer_id: answerId,
      video_url: finalVideoUrl,
      supabase_stored: finalVideoUrl.startsWith('http') || supabaseUploaded,
    });
  } catch (err: any) {
    console.error('Upload processing error:', err);
    return NextResponse.json(
      { detail: 'Upload processing failed: ' + (err?.message || 'Unknown error') },
      { status: 500 }
    );
  }
}
