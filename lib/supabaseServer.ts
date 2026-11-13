import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function getSupabaseServerClient(request?: Request): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY;

  const key = serviceKey || anonKey;

  if (!url || !key || url.includes('placeholder') || url === 'undefined') {
    return null;
  }

  const globalHeaders: Record<string, string> = {};
  if (!serviceKey && request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ') && !authHeader.includes('mock-')) {
      globalHeaders['Authorization'] = authHeader;
    }
  }

  try {
    return createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      ...(Object.keys(globalHeaders).length > 0 ? { global: { headers: globalHeaders } } : {}),
    });
  } catch (err) {
    console.warn('Failed to initialize server Supabase client:', err);
    return null;
  }
}

export function isUUID(str: string | null | undefined): boolean {
  if (!str || typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export async function getAuthUserId(request: Request): Promise<string | null> {
  const customUserId = request.headers.get('x-user-id');
  if (customUserId && typeof customUserId === 'string' && customUserId.trim()) {
    return customUserId.trim();
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const supabase = getSupabaseServerClient();
    if (supabase && token && !token.startsWith('mock-')) {
      try {
        const { data } = await supabase.auth.getUser(token);
        if (data?.user?.id) return data.user.id;
      } catch {
        // ignore
      }
    }
  }

  return null;
}


