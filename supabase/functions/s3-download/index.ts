import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSignedUrl } from "https://deno.land/x/aws_s3_presign@2.2.1/mod.ts";

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
    const { path, role, userId, download: forceDownload } = await req.json();

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
      const withoutPrefix = path.substring(5); // remove 's3://'
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

    // Validate access based on role
    if (role === 'student') {
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'Missing userId for student' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Extract productId from s3Key
      // Keys are like: productId/file.ext or teacher-teacherId/productId/file.ext
      const parts = s3Key.split('/');
      let productId: string;
      if (parts[0].startsWith('teacher-')) {
        productId = parts[1];
      } else {
        productId = parts[0];
      }

      // Check if student has a confirmed purchase for this product
      const { data: purchase } = await supabase
        .from('simple_purchases')
        .select('id')
        .eq('simple_user_id', userId)
        .eq('product_id', productId)
        .eq('status', 'completed')
        .maybeSingle();

      if (!purchase) {
        console.log('Student has no confirmed purchase for product:', productId);
        return new Response(
          JSON.stringify({ error: 'Access denied - no purchase found' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    // For creator and teacher roles, we trust the client-side session validation
    // (they already passed auth in the components)

    // Generate presigned URL
    const accessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID')!;
    const secretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY')!;
    const region = Deno.env.get('AWS_S3_REGION')!;

    const signOptions: Record<string, unknown> = {
      accessKeyId,
      secretAccessKey,
      bucket,
      key: '/' + s3Key,
      region,
      expiresIn: 3600,
    };

    // When download is requested, add response-content-disposition
    if (forceDownload) {
      signOptions.queryParams = {
        'response-content-disposition': 'attachment',
      };
    }

    const url = getSignedUrl(signOptions as Parameters<typeof getSignedUrl>[0]);

    console.log('Generated presigned URL for:', s3Key);

    return new Response(
      JSON.stringify({ url }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in s3-download:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
