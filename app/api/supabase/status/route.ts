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
        'Add NEXT_PUBLIC_SUPABASE_URL (Type: Config) with your Supabase Project URL (e.g. https://xyz.supabase.co).',
        'Add NEXT_PUBLIC_SUPABASE_ANON_KEY (Type: Config) with your Supabase anon/public key.',
        'Optional: Add SUPABASE_SERVICE_ROLE_KEY (Type: Sensitive) with your Supabase service_role key.',
        'CRITICAL: Trigger a Redeploy in Vercel so Next.js embeds the variables into the production bundle.',
      ],
    });
  }

  // Choose the best key available for server check
  const activeKey = isServiceKeySet ? serviceKey : anonKey;
  const client = createClient(supabaseUrl, activeKey);

  let bucketExists = false;
  let canUpload = false;
  let autoCreated = false;
  const tablesExist = {
    job_roles: false,
    sessions: false,
    answers: false,
  };
  let errorMessage: string | null = null;

  try {
    // 1. Check if the database tables exist
    const { error: rolesErr } = await client.from('job_roles').select('id').limit(1);
    tablesExist.job_roles = !rolesErr;

    const { error: sessErr } = await client.from('sessions').select('id').limit(1);
    tablesExist.sessions = !sessErr;

    const { error: ansErr } = await client.from('answers').select('id').limit(1);
    tablesExist.answers = !ansErr;

    // 2. Check if the 'interview-videos' bucket exists
    const { data: buckets, error: listError } = await client.storage.listBuckets();

    if (!listError && Array.isArray(buckets)) {
      bucketExists = buckets.some((b) => b.name === 'interview-videos' || b.id === 'interview-videos');
    }

    // 3. If bucket doesn't exist, try auto-creating it (works if service role key is provided)
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

    // 4. Test a tiny probe upload to verify write permission
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
  const allTablesOk = tablesExist.job_roles && tablesExist.sessions && tablesExist.answers;

  if (!allTablesOk) {
    instructions.push('DATABASE TABLES NEED TO BE CREATED: Open Supabase Dashboard -> SQL Editor, copy and run the SQL from supabase_setup.sql in this project to create job_roles, sessions, and answers tables.');
  }

  if (!hasNextPublicUrl || !hasNextPublicAnon) {
    instructions.push('IMPORTANT: In Vercel, add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (with NEXT_PUBLIC_ prefix and Type: Config), then trigger a Redeploy.');
  }
  if (!bucketExists) {
    instructions.push('STORAGE BUCKET MISSING: In Supabase -> Storage, create a bucket named "interview-videos" and toggle "Public bucket" to ON.');
  } else if (!canUpload) {
    instructions.push('STORAGE PERMISSION: Storage bucket "interview-videos" was found, but upload permission was denied. Run the storage RLS policy in supabase_setup.sql or provide SUPABASE_SERVICE_ROLE_KEY.');
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
    tables: tablesExist,
    allTablesReady: allTablesOk,
    status: canUpload && allTablesOk ? 'ready' : !allTablesOk ? 'tables_missing' : bucketExists ? 'permission_issue' : 'bucket_missing',
    errorMessage,
    instructions,
  });
}
