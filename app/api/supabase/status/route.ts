import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

  const hasNextPublicUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasNextPublicAnon = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const isUrlSet = Boolean(supabaseUrl && supabaseUrl !== 'undefined' && !supabaseUrl.includes('placeholder'));
  const isAnonSet = Boolean(anonKey && anonKey !== 'undefined' && !anonKey.includes('placeholder'));
  const isServiceKeySet = Boolean(serviceKey && serviceKey !== 'undefined' && !serviceKey.includes('placeholder'));

  if (!isUrlSet || !isAnonSet) {
    return NextResponse.json({
      configured: false,
      supabaseUrl: isUrlSet ? supabaseUrl : null,
      hasAnonKey: isAnonSet,
      hasServiceKey: isServiceKeySet,
      bucketExists: false,
      bucketName: 'interview-videos',
      status: 'missing_keys',
      message: 'Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY) are missing in Vercel settings.',
      instructions: [
        'Open your Vercel Project -> Settings -> Environment Variables.',
        'Add NEXT_PUBLIC_SUPABASE_URL with your Supabase Project URL (e.g. https://xyz.supabase.co).',
        'Add NEXT_PUBLIC_SUPABASE_ANON_KEY with your Supabase anon/public key.',
        'Optional: Add SUPABASE_SERVICE_ROLE_KEY with your Supabase service_role key to allow server-side bucket auto-creation.',
        'CRITICAL: Trigger a Redeploy in Vercel so Next.js embeds the NEXT_PUBLIC_ variables into the build bundle.',
      ],
    });
  }

  // Choose the best key available for server check
  const activeKey = isServiceKeySet ? serviceKey : anonKey;
  const client = createClient(supabaseUrl, activeKey);

  let bucketExists = false;
  let canUpload = false;
  let autoCreated = false;
  let errorMessage: string | null = null;

  try {
    // 1. Check if the 'interview-videos' bucket exists
    const { data: buckets, error: listError } = await client.storage.listBuckets();

    if (!listError && Array.isArray(buckets)) {
      bucketExists = buckets.some((b) => b.name === 'interview-videos' || b.id === 'interview-videos');
    }

    // 2. If bucket doesn't exist, try auto-creating it (works if service role key is provided)
    if (!bucketExists && isServiceKeySet) {
      try {
        const { error: createErr } = await client.storage.createBucket('interview-videos', {
          public: true,
          fileSizeLimit: 104857600, // 100MB
        });
        if (!createErr) {
          bucketExists = true;
          autoCreated = true;
        } else {
          errorMessage = `Could not auto-create bucket: ${createErr.message}`;
        }
      } catch (createEx: any) {
        errorMessage = createEx?.message || 'Failed to auto-create bucket';
      }
    }

    // 3. Test a tiny probe upload to verify write permission
    if (bucketExists) {
      try {
        const probeContent = Buffer.from('probe');
        const probePath = `_test/probe-${Date.now()}.txt`;
        const { error: uploadErr } = await client.storage
          .from('interview-videos')
          .upload(probePath, probeContent, {
            contentType: 'text/plain',
            upsert: true,
          });

        if (!uploadErr) {
          canUpload = true;
          // Clean up the probe file
          await client.storage.from('interview-videos').remove([probePath]).catch(() => null);
        } else {
          errorMessage = `Bucket exists but upload failed: ${uploadErr.message}`;
        }
      } catch (uploadEx: any) {
        errorMessage = `Probe upload exception: ${uploadEx?.message}`;
      }
    }
  } catch (err: any) {
    errorMessage = err?.message || 'Error connecting to Supabase';
  }

  const instructions: string[] = [];
  if (!hasNextPublicUrl || !hasNextPublicAnon) {
    instructions.push('IMPORTANT: In Vercel, add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (with NEXT_PUBLIC_ prefix) so the browser client bundle can access Supabase directly, then trigger a Redeploy.');
  }
  if (!bucketExists) {
    instructions.push('1. Open your Supabase Dashboard at https://supabase.com/dashboard');
    instructions.push('2. Click on "Storage" in the left sidebar');
    instructions.push('3. Click "New Bucket" and name it EXACTLY: interview-videos');
    instructions.push('4. Toggle the switch "Public bucket" to ON (this allows candidate videos to be viewed by recruiters)');
    instructions.push('5. Click "Save bucket"');
  } else if (!canUpload) {
    instructions.push('Bucket "interview-videos" was found, but upload permission was denied.');
    instructions.push('1. Go to Supabase -> Storage -> interview-videos -> Settings / Policies');
    instructions.push('2. Ensure "Public bucket" is ON, or add an INSERT policy for anon/authenticated users');
    instructions.push('3. Or add SUPABASE_SERVICE_ROLE_KEY to your Vercel Environment Variables so the server can upload securely.');
  }

  return NextResponse.json({
    configured: true,
    supabaseUrl,
    hasAnonKey: isAnonSet,
    hasServiceKey: isServiceKeySet,
    bucketExists,
    bucketName: 'interview-videos',
    autoCreated,
    canUpload,
    status: canUpload ? 'ready' : bucketExists ? 'permission_issue' : 'bucket_missing',
    errorMessage,
    instructions,
  });
}
