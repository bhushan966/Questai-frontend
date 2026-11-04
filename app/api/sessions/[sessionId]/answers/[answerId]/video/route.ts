import { NextRequest, NextResponse } from 'next/server';
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

  // 2. Check disk file
  if (!buffer) {
    const filePath = path.join(process.cwd(), 'public', 'uploads', 'videos', `${sessionId}-${answerId}.webm`);
    if (fs.existsSync(filePath)) {
      try {
        buffer = fs.readFileSync(filePath);
      } catch {
        // read error
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
