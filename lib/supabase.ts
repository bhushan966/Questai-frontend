import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const isConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'undefined' &&
  !supabaseUrl.includes('placeholder')
);

function createMockSupabaseClient() {
  type AuthListener = (event: string, session: any) => void;
  const listeners: AuthListener[] = [];

  const getStorageUser = () => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem('questai_mock_user');
      if (stored) return JSON.parse(stored);
      const defaultUser = {
        id: 'user-recruiter-demo',
        email: 'recruiter@questai.internal',
        created_at: new Date().toISOString(),
        app_metadata: {},
        user_metadata: { name: 'Recruiter' },
        aud: 'authenticated',
        role: 'authenticated',
      };
      localStorage.setItem('questai_mock_user', JSON.stringify(defaultUser));
      return defaultUser;
    } catch {
      return null;
    }
  };

  const setStorageUser = (user: any) => {
    if (typeof window === 'undefined') return;
    try {
      if (user) {
        localStorage.setItem('questai_mock_user', JSON.stringify(user));
      } else {
        localStorage.removeItem('questai_mock_user');
      }
    } catch {
      // ignore
    }
  };

  return {
    auth: {
      async getUser() {
        const user = getStorageUser();
        return { data: { user }, error: null };
      },
      async getSession() {
        const user = getStorageUser();
        const session = user
          ? {
              access_token: 'mock-access-token-questai',
              token_type: 'bearer',
              user,
            }
          : null;
        return { data: { session }, error: null };
      },
      async signInWithPassword({ email }: { email: string; password?: string }) {
        const user = {
          id: 'user-recruiter-demo',
          email: email || 'recruiter@questai.internal',
          created_at: new Date().toISOString(),
          app_metadata: {},
          user_metadata: { name: (email || 'recruiter').split('@')[0] },
          aud: 'authenticated',
          role: 'authenticated',
        };
        setStorageUser(user);
        const session = {
          access_token: 'mock-access-token-questai',
          token_type: 'bearer',
          user,
        };
        listeners.forEach((fn) => fn('SIGNED_IN', session));
        return { data: { user, session }, error: null };
      },
      async signUp({ email }: { email: string; password?: string }) {
        const user = {
          id: 'user-recruiter-demo',
          email: email || 'recruiter@questai.internal',
          created_at: new Date().toISOString(),
          app_metadata: {},
          user_metadata: { name: (email || 'recruiter').split('@')[0] },
          aud: 'authenticated',
          role: 'authenticated',
        };
        setStorageUser(user);
        const session = {
          access_token: 'mock-access-token-questai',
          token_type: 'bearer',
          user,
        };
        listeners.forEach((fn) => fn('SIGNED_IN', session));
        return { data: { user, session }, error: null };
      },
      async signOut() {
        setStorageUser(null);
        listeners.forEach((fn) => fn('SIGNED_OUT', null));
        return { error: null };
      },
      onAuthStateChange(callback: AuthListener) {
        listeners.push(callback);
        // Call callback asynchronously if user already exists
        if (typeof window !== 'undefined') {
          setTimeout(() => {
            const user = getStorageUser();
            if (user) {
              callback('SIGNED_IN', {
                access_token: 'mock-access-token-questai',
                token_type: 'bearer',
                user,
              });
            }
          }, 0);
        }
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                const index = listeners.indexOf(callback);
                if (index !== -1) listeners.splice(index, 1);
              },
            },
          },
        };
      },
    },
  } as any;
}

export const supabase = isConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : createMockSupabaseClient();