import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const productId = formData.get('productId') as string
    const creatorName = formData.get('creatorName') as string
    const creatorToken = formData.get('creatorToken') as string

    if (!file || !productId || !creatorName) {
      return new Response(
        JSON.stringify({ error: 'Missing file, productId, or creatorName' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // --- Validate creator session ---
    if (!creatorToken) {
      console.warn('Missing creatorToken for upload-material');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - missing session token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: session } = await supabase
      .from('creator_sessions')
      .select('id')
      .eq('token', creatorToken)
      .eq('creator_name', creatorName)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (!session) {
      console.warn('Invalid creator session for upload-material:', creatorName);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - invalid session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the product belongs to this creator
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, creator_id')
      .eq('id', productId)
      .single()

    if (productError || !product) {
      return new Response(
        JSON.stringify({ error: 'Product not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (product.creator_id !== creatorName) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - not the product creator' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate file path
    const fileExt = file.name.split('.').pop()
    const fileName = `${productId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

    const { error: uploadError } = await supabase
      .storage
      .from('materials')
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false
      })

    if (uploadError) {
      console.error('Error uploading file:', uploadError)
      return new Response(
        JSON.stringify({ error: 'Failed to upload file' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: urlData } = supabase
      .storage
      .from('materials')
      .getPublicUrl(fileName)

    return new Response(
      JSON.stringify({ 
        url: urlData.publicUrl,
        path: fileName
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error uploading material:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
