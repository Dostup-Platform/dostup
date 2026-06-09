import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function hmacSha256(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
}

async function sha256(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getSignatureKey(secretKey: string, dateStamp: string, region: string, service: string): Promise<ArrayBuffer> {
  let key = await hmacSha256(new TextEncoder().encode('AWS4' + secretKey), dateStamp);
  key = await hmacSha256(key, region);
  key = await hmacSha256(key, service);
  key = await hmacSha256(key, 'aws4_request');
  return key;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const productId = formData.get('productId') as string;
    const role = formData.get('role') as string; // 'creator' or 'teacher'
    const creatorToken = formData.get('creatorToken') as string | null;
    const creatorName = formData.get('creatorName') as string | null;
    const teacherId = formData.get('teacherId') as string | null;

    if (!file || !productId || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: file, productId, role' }),
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
      // Verify teacher exists
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
    const fileExt = file.name.split('.').pop();
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    let s3Key: string;
    if (role === 'teacher') {
      s3Key = `teacher-${teacherId}/${productId}/${uniqueId}.${fileExt}`;
    } else {
      s3Key = `${productId}/${uniqueId}.${fileExt}`;
    }

    // Read file
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const payloadHash = await sha256(fileBytes);

    // Build S3 PUT request with AWS Signature V4
    const now = new Date();
    const dateStamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const shortDate = dateStamp.substring(0, 8);
    const host = `${bucket}.s3.${region}.amazonaws.com`;
    const canonicalUri = '/' + s3Key.split('/').map(encodeURIComponent).join('/');

    const headers: Record<string, string> = {
      'host': host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': dateStamp,
      'content-type': file.type || 'application/octet-stream',
    };

    const signedHeaderKeys = Object.keys(headers).sort();
    const signedHeaders = signedHeaderKeys.join(';');
    const canonicalHeaders = signedHeaderKeys.map(k => `${k}:${headers[k]}\n`).join('');

    const canonicalRequest = [
      'PUT',
      canonicalUri,
      '', // query string
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const credentialScope = `${shortDate}/${region}/s3/aws4_request`;
    const canonicalRequestHash = await sha256(new TextEncoder().encode(canonicalRequest));
    const stringToSign = `AWS4-HMAC-SHA256\n${dateStamp}\n${credentialScope}\n${canonicalRequestHash}`;

    const signingKey = await getSignatureKey(secretAccessKey, shortDate, region, 's3');
    const signatureBuffer = await hmacSha256(signingKey, stringToSign);
    const signature = Array.from(new Uint8Array(signatureBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

    const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const s3Url = `https://${host}${canonicalUri}`;
    console.log('Uploading to S3:', s3Key);

    const s3Response = await fetch(s3Url, {
      method: 'PUT',
      headers: {
        ...headers,
        'Authorization': authorization,
      },
      body: fileBytes,
    });

    if (!s3Response.ok) {
      const errorText = await s3Response.text();
      console.error('S3 upload error:', s3Response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Upload failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return the S3 path with s3:// prefix
    const storagePath = `s3://${bucket}/${s3Key}`;
    console.log('Upload successful:', storagePath);

    return new Response(
      JSON.stringify({ path: storagePath }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in s3-upload:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
