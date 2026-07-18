import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { S3RequestPresigner } from "https://esm.sh/@aws-sdk/s3-request-presigner@3.620.0?target=deno";
import { HttpRequest } from "https://esm.sh/@smithy/protocol-http@4.1.7?target=deno";
import { Sha256 } from "https://esm.sh/@aws-crypto/sha256-browser@5.2.0?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function buildPresignedUrl(request: HttpRequest): string {
  const url = new URL(`${request.protocol}//${request.hostname}${request.path}`);

  if (request.query) {
    for (const [key, value] of Object.entries(request.query)) {
      if (Array.isArray(value)) {
        value.forEach((v) => url.searchParams.append(key, String(v)));
      } else if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    }
  }

  return url.toString();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    if (!jwt) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { productId, fileName, fileType } = await req.json();
    if (!productId || !fileName) {
      return new Response(JSON.stringify({ error: 'Missing required fields: productId, fileName' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const uid = userData.user.id;

    // Access: product owner OR assigned teacher
    const { data: product } = await supabase
      .from('products').select('owner_id').eq('id', productId).maybeSingle();
    let isTeacher = false;
    if (!product || product.owner_id !== uid) {
      const { data: pt } = await supabase
        .from('product_teachers').select('teacher_user_id')
        .eq('product_id', productId).eq('teacher_user_id', uid).maybeSingle();
      isTeacher = !!pt;
      if (!isTeacher) {
        return new Response(JSON.stringify({ error: 'Forbidden' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
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
    const s3Key = isTeacher
      ? `teacher-${uid}/${productId}/${uniqueId}.${fileExt}`
      : `${productId}/${uniqueId}.${fileExt}`;

    const contentType = fileType || 'application/octet-stream';

    // Build presigned PUT URL without Node runtime providers
    const hostname = `${bucket}.s3.${region}.amazonaws.com`;
    const encodedKey = s3Key.split('/').map((segment) => encodeURIComponent(segment)).join('/');

    const presigner = new S3RequestPresigner({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      sha256: Sha256,
    });

    const signedRequest = await presigner.presign(
      new HttpRequest({
        protocol: 'https:',
        method: 'PUT',
        hostname,
        path: `/${encodedKey}`,
        headers: {
          host: hostname,
        },
      }),
      { expiresIn: 3600 }
    );

    const uploadUrl = buildPresignedUrl(signedRequest);
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
