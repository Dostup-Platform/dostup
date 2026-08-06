import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSignedUrl } from "https://deno.land/x/aws_s3_presign@2.2.1/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MIME_MAP: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  zip: 'application/zip',
  rar: 'application/x-rar-compressed',
};

function getMimeType(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase() || '';
  return MIME_MAP[ext] || 'application/octet-stream';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { path, role, userId } = await req.json();

    if (!path || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing path or role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse s3:// path
    let s3Key: string;
    let bucket: string;
    if (path.startsWith('s3://')) {
      const withoutPrefix = path.substring(5);
      const slashIndex = withoutPrefix.indexOf('/');
      bucket = withoutPrefix.substring(0, slashIndex);
      s3Key = withoutPrefix.substring(slashIndex + 1);
    } else {
      return new Response(
        JSON.stringify({ error: 'Not an S3 path' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate access based on role (same logic as s3-download)
    if (role === 'student') {
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'Missing userId for student' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const parts = s3Key.split('/');
      let productId: string;
      if (parts[0].startsWith('teacher-')) {
        productId = parts[1];
      } else {
        productId = parts[0];
      }

      const { data: purchase } = await supabase
        .from('simple_purchases')
        .select('id')
        .eq('simple_user_id', userId)
        .eq('product_id', productId)
        .eq('status', 'completed')
        .maybeSingle();

      if (!purchase) {
        return new Response(
          JSON.stringify({ error: 'Access denied - no purchase found' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    // For creator and teacher roles, we trust the client-side session validation

    // Generate presigned URL to fetch from S3 server-side
    const accessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID')!;
    const secretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY')!;
    const region = Deno.env.get('AWS_S3_REGION')!;

    const presignedUrl = getSignedUrl({
      accessKeyId,
      secretAccessKey,
      bucket,
      key: '/' + s3Key,
      region,
      expiresIn: 300,
    });

    console.log('Proxying S3 file:', s3Key);

    // Fetch file from S3 server-side (no CORS issues)
    const s3Response = await fetch(presignedUrl);
    if (!s3Response.ok) {
      console.error('S3 fetch failed:', s3Response.status, s3Response.statusText);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch file from storage' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const contentType = getMimeType(s3Key);
    const fileName = decodeURIComponent(s3Key.split('/').pop() || 'download');
    const encodedName = encodeURIComponent(fileName);

    // Stream the file bytes back to client with proper CORS headers
    return new Response(s3Response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedName}`,
        'Content-Length': s3Response.headers.get('Content-Length') || '',
      },
    });

  } catch (error) {
    console.error('Error in s3-download-proxy:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
