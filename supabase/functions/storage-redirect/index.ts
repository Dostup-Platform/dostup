import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const download = url.searchParams.get('download'); // filename or empty

    if (!path) {
      return new Response('Missing path', { status: 400 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase.storage
      .from('materials')
      .createSignedUrl(path, 3600, { download: download || false });

    if (error) {
      console.error('Error creating signed URL:', error);
      return new Response('Failed to generate URL', { status: 500 });
    }

    console.log('Storage redirect for:', path, 'download:', !!download);

    return new Response(null, {
      status: 302,
      headers: { 'Location': data.signedUrl },
    });

  } catch (error) {
    console.error('Error in storage-redirect:', error);
    return new Response('Internal server error', { status: 500 });
  }
});
