import { supabase } from '@/lib/supabase';

export async function authedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  let token: string | undefined;
  let userId: string | undefined;
  try {
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token;
    userId = data.session?.user?.id;
  } catch {
    // Session retrieval error fallback
  }

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (userId) {
    headers['x-user-id'] = userId;
  }

  // Handle trailing slash for FastAPI routers when targeting external backend
  let targetUrl = url;
  if (targetUrl.startsWith('http')) {
    try {
      const parsed = new URL(targetUrl);
      if ((parsed.pathname === '/job-roles' || parsed.pathname === '/sessions') && !parsed.pathname.endsWith('/')) {
        parsed.pathname = `${parsed.pathname}/`;
        targetUrl = parsed.toString();
      }
    } catch {
      // keep original
    }
  }

  return await fetch(targetUrl, {
    ...options,
    headers,
  });
}