import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { S3RequestPresigner } from "https://esm.sh/@aws-sdk/s3-request-presigner@3.620.0?target=deno";
import { HttpRequest } from "https://esm.sh/@smithy/protocol-http@4.1.7?target=deno";
import { formatUrl } from "https://esm.sh/@aws-sdk/util-format-url@3.620.0?target=deno";
import { Sha256 } from "https://esm.sh/@aws-crypto/sha256-browser@5.2.0?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { productId, role, fileName, fileType, creatorToken, creatorName, teacherId } = await req.json();

    if (!productId || !role || !fileName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: productId, role, fileName' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate authorization
    if (role === 'creator') {
      if (!creatorToken || !creatorName) {
        return new Response(
          JSON.stringify({ error: 'Missing creatorToken or creatorName' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const { data: session } = await supabase
        .from('creator_sessions')
        .select('id')
        .eq('token', creatorToken)
        .eq('creator_name', creatorName)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (!session) {
        return new Response(
          JSON.stringify({ error: 'Invalid creator session' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (role === 'teacher') {
      if (!teacherId) {
        return new Response(
          JSON.stringify({ error: 'Missing teacherId' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const { data: teacher } = await supabase
        .from('simple_users')
        .select('id')
        .eq('id', teacherId)
        .eq('role', 'teacher')
        .maybeSingle();

      if (!teacher) {
        return new Response(
          JSON.stringify({ error: 'Invalid teacher' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // AWS config
    const accessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID')!;
    const secretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY')!;
    const bucket = Deno.env.get('AWS_S3_BUCKET')!;
    const region = Deno.env.get('AWS_S3_REGION')!;

    if (!accessKeyId || !secretAccessKey || !bucket || !region) {
      console.error('Missing AWS configuration');
      return new Response(
        JSON.stringify({ error: 'Server misconfiguration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate S3 key
    const fileExt = fileName.split('.').pop();
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    let s3Key: string;
    if (role === 'teacher') {
      s3Key = `teacher-${teacherId}/${productId}/${uniqueId}.${fileExt}`;
    } else {
      s3Key = `${productId}/${uniqueId}.${fileExt}`;
    }

    const contentType = fileType || 'application/octet-stream';

    // Use AWS SDK v3 for correct regional endpoint
    const s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    const storagePath = `s3://${bucket}/${s3Key}`;
    console.log('Generated presigned upload URL for:', s3Key, 'region:', region);

    return new Response(
      JSON.stringify({ uploadUrl, storagePath, contentType }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in s3-presign-upload:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
