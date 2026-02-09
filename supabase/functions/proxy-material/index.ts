import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSignedUrl } from "https://deno.land/x/aws_s3_presign@2.2.1/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      console.log('Rejected: missing token parameter');
      return new Response(
        JSON.stringify({ error: 'Missing token parameter' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate token
    const { data: tokenRecord, error: tokenError } = await supabase
      .from('material_access_tokens')
      .select('*')
      .eq('token', token)
      .eq('used', false)
      .maybeSingle();

    if (tokenError || !tokenRecord) {
      console.log('Rejected: invalid or used token');
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check expiration
    if (new Date(tokenRecord.expires_at) < new Date()) {
      console.log('Rejected: token expired at', tokenRecord.expires_at);
      await supabase
        .from('material_access_tokens')
        .update({ used: true })
        .eq('id', tokenRecord.id);

      return new Response(
        JSON.stringify({ error: 'Token expired' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark token as used
    await supabase
      .from('material_access_tokens')
      .update({ used: true })
      .eq('id', tokenRecord.id);

    const path = tokenRecord.file_path;
    console.log('Proxying material with valid token:', path);

    let fileData: Blob;

    // Check if file is in S3
    if (path.startsWith('s3://')) {
      const withoutPrefix = path.substring(5);
      const slashIndex = withoutPrefix.indexOf('/');
      const bucket = withoutPrefix.substring(0, slashIndex);
      const s3Key = withoutPrefix.substring(slashIndex + 1);

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

      console.log('Downloading from S3 via presigned URL');
      const s3Response = await fetch(presignedUrl);
      if (!s3Response.ok) {
        console.error('S3 download error:', s3Response.status);
        return new Response(
          JSON.stringify({ error: 'File not found in S3' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      fileData = await s3Response.blob();
    } else {
      // Legacy: download from Supabase storage
      const { data, error } = await supabase.storage
        .from('materials')
        .download(path);

      if (error) {
        console.error('Error downloading file:', error);
        return new Response(
          JSON.stringify({ error: 'File not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      fileData = data;
    }

    // Determine content type based on file extension
    const fileName = path.split('/').pop() || path;
    const ext = fileName.split('.').pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'odt': 'application/vnd.oasis.opendocument.text',
      'ods': 'application/vnd.oasis.opendocument.spreadsheet',
      'odp': 'application/vnd.oasis.opendocument.presentation',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'txt': 'text/plain',
    };

    const contentType = contentTypes[ext || ''] || 'application/octet-stream';
    console.log('Serving file with content type:', contentType);

    return new Response(fileData, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Content-Disposition': 'inline',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error in proxy-material:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
