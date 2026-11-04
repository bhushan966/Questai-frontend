import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ sessionId: string; answerId: string }> }
) {
  const { sessionId, answerId } = await props.params;

  let buffer: Buffer | null = null;

  // 1. Check in-memory cache first
  const cache: Map<string, Buffer> | undefined = (globalThis as any).__questai_video_cache__;
  if (cache && cache.has(`${sessionId}-${answerId}`)) {
    buffer = cache.get(`${sessionId}-${answerId}`)!;
  }

  // 2. Check /tmp disk storage
  if (!buffer) {
    const tmpPath = path.join('/tmp', 'questai_videos', `${sessionId}-${answerId}.webm`);
    if (fs.existsSync(tmpPath)) {
      try {
        buffer = fs.readFileSync(tmpPath);
      } catch {}
    }
  }

  // 3. Check public uploads disk file
  if (!buffer) {
    const filePath = path.join(process.cwd(), 'public', 'uploads', 'videos', `${sessionId}-${answerId}.webm`);
    if (fs.existsSync(filePath)) {
      try {
        buffer = fs.readFileSync(filePath);
      } catch {}
    }
  }

  // 4. Check Supabase Storage if not in local cache/disk
  if (!buffer) {
    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const sbKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.SUPABASE_KEY;

    if (sbUrl && sbKey && !sbUrl.includes('placeholder')) {
      try {
        const sb = createClient(sbUrl, sbKey);
        const storagePath = `${sessionId}/${answerId}.webm`;

        // Check if public URL is accessible or redirect to it
        const { data: pubData } = sb.storage.from('interview-videos').getPublicUrl(storagePath);
        if (pubData?.publicUrl) {
          // Attempt downloading buffer to support streaming, or redirect
          const { data: fileData, error: downloadErr } = await sb.storage
            .from('interview-videos')
            .download(storagePath);

          if (!downloadErr && fileData) {
            const arr = await fileData.arrayBuffer();
            buffer = Buffer.from(arr);
            // Cache in memory for subsequent chunks/requests
            if (cache) cache.set(`${sessionId}-${answerId}`, buffer);
          } else {
            // Redirect directly to Supabase public storage URL
            return NextResponse.redirect(pubData.publicUrl, 307);
          }
        }
      } catch (sbErr) {
        console.warn('Notice checking Supabase storage for video:', sbErr);
      }
    }
  }

  if (!buffer) {
    return NextResponse.json({ detail: 'Video recording not found' }, { status: 404 });
  }

  const totalSize = buffer.length;
  const rangeHeader = request.headers.get('range');

  if (rangeHeader) {
    // Handle HTTP Range header for video scrubbing and seeking
    const parts = rangeHeader.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

    if (start >= totalSize || end >= totalSize) {
      return new NextResponse('Requested range not satisfiable', {
        status: 416,
        headers: {
          'Content-Range': `bytes */${totalSize}`,
        },
      });
    }

    const chunk = buffer.subarray(start, end + 1);
    return new NextResponse(new Uint8Array(chunk), {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunk.length.toString(),
        'Content-Type': 'video/webm',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'video/webm',
      'Content-Length': totalSize.toString(),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
