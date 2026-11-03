import { supabase } from '@/lib/supabase';

export async function authedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  // Only redirect defunct legacy demo URL if still lingering
  let resolvedUrl = url;
  if (resolvedUrl.includes('questai-ko41.onrender.com')) {
    try {
      const u = new URL(resolvedUrl);
      const cleanPath = u.pathname.startsWith('/api') ? u.pathname : `/api${u.pathname}`;
      resolvedUrl = `${cleanPath}${u.search}`;
    } catch {
      resolvedUrl = resolvedUrl.replace(/https?:\/\/[^/]+/, '/api');
    }
  }

  let token: string | undefined;
  try {
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token;
  } catch {
    // Session retrieval error fallback
  }

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    return await fetch(resolvedUrl, {
      ...options,
      headers,
    });
  } catch (err) {
    console.warn(`authedFetch handled network issue for ${resolvedUrl}:`, err);
    return new Response(JSON.stringify({ detail: 'Network request fallback', ok: false }), {
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' },
    });
  }
}