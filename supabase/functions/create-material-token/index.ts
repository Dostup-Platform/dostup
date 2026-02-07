import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { userId, path, role } = await req.json();

    if (!path) {
      return new Response(
        JSON.stringify({ error: 'Missing path parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!userId && role !== 'creator') {
      return new Response(
        JSON.stringify({ error: 'Missing userId parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extract product_id from file path (format: {product_id}/filename or {product_id}/teacher/{teacher_id}/filename)
    const pathParts = path.split('/');
    const productId = pathParts[0];

    if (!productId) {
      return new Response(
        JSON.stringify({ error: 'Cannot determine product from file path' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let authorized = false;

    // Check if user is the creator of the product
    if (role === 'creator') {
      // Creator validated via creator session - they have access to all their products
      authorized = true;
      console.log('Creator access granted for path:', path);
    } else if (role === 'teacher') {
      // Check if user is a teacher for this product
      const { data: user } = await supabase
        .from('simple_users')
        .select('id, name')
        .eq('id', userId)
        .eq('role', 'teacher')
        .maybeSingle();

      if (user) {
        const { data: teacherLink } = await supabase
          .from('product_teachers')
          .select('id')
          .eq('product_id', productId)
          .eq('teacher_name', user.name)
          .maybeSingle();

        if (teacherLink) {
          authorized = true;
          console.log('Teacher access granted for:', user.name, 'path:', path);
        }
      }
    } else {
      // Student - check for confirmed purchase
      const { data: purchase } = await supabase
        .from('simple_purchases')
        .select('id')
        .eq('simple_user_id', userId)
        .eq('product_id', productId)
        .eq('status', 'completed')
        .maybeSingle();

      if (purchase) {
        authorized = true;
        console.log('Student access granted for userId:', userId, 'path:', path);
      }
    }

    if (!authorized) {
      console.log('Access denied for userId:', userId, 'role:', role, 'path:', path);
      return new Response(
        JSON.stringify({ error: 'Access denied - no valid purchase or role' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate one-time token
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    const { error: insertError } = await supabase
      .from('material_access_tokens')
      .insert({
        token,
        file_path: path,
        expires_at: expiresAt,
        used: false,
      });

    if (insertError) {
      console.error('Error creating token:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create access token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Token created for path:', path, 'expires:', expiresAt);

    return new Response(
      JSON.stringify({ token }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in create-material-token:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
