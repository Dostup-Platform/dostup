import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSignedUrl } from "https://deno.land/x/aws_s3_presign@2.2.1/mod.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const url = new URL(req.url);
    const path = url.searchParams.get('path');
    const role = url.searchParams.get('role');
    const userId = url.searchParams.get('userId');
    const download = url.searchParams.get('download'); // filename or empty

    if (!path || !role) {
      return new Response('Missing path or role', { status: 400 });
    }

    // Parse s3:// path
    if (!path.startsWith('s3://')) {
      return new Response('Not an S3 path', { status: 400 });
    }

    const withoutPrefix = path.substring(5);
    const slashIndex = withoutPrefix.indexOf('/');
    const bucket = withoutPrefix.substring(0, slashIndex);
    const s3Key = withoutPrefix.substring(slashIndex + 1);

    // Validate access for students
    if (role === 'student') {
      if (!userId) {
        return new Response('Missing userId for student', { status: 401 });
      }

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
        return new Response('Access denied', { status: 403 });
      }
    }

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

    if (download) {
      signOptions.queryParams = {
        'response-content-disposition': 'attachment',
      };
    }

    const presignedUrl = getSignedUrl(signOptions as Parameters<typeof getSignedUrl>[0]);

    console.log('S3 redirect for:', s3Key, 'download:', !!download);

    return new Response(null, {
      status: 302,
      headers: { 'Location': presignedUrl },
    });

  } catch (error) {
    console.error('Error in s3-redirect:', error);
    return new Response('Internal server error', { status: 500 });
  }
});
