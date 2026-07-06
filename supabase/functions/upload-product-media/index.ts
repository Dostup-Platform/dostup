import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_IMAGE_BYTES = 15 * 1024 * 1024 // 15 MB
const MAX_VIDEO_BYTES = 250 * 1024 * 1024 // 250 MB
const MAX_FILE_BYTES = 50 * 1024 * 1024 // 50 MB (generic attachments)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const productId = formData.get('productId') as string | null
    const creatorName = formData.get('creatorName') as string | null
    const creatorToken = formData.get('creatorToken') as string | null
    const kind = formData.get('kind') as string | null // 'image' | 'video' | 'file'

    if (!file || !productId || !creatorName || !kind) {
      return new Response(
        JSON.stringify({ error: 'Missing file, productId, creatorName, or kind' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (kind !== 'image' && kind !== 'video' && kind !== 'file') {
      return new Response(
        JSON.stringify({ error: 'kind must be image, video, or file' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (kind === 'image' && !file.type.startsWith('image/')) {
      return new Response(JSON.stringify({ error: 'Invalid image type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (kind === 'video' && !file.type.startsWith('video/')) {
      return new Response(JSON.stringify({ error: 'Invalid video type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const maxBytes = kind === 'video' ? MAX_VIDEO_BYTES : kind === 'file' ? MAX_FILE_BYTES : MAX_IMAGE_BYTES
    if (file.size > maxBytes) {
      return new Response(JSON.stringify({ error: `File too large (max ${Math.round(maxBytes / 1024 / 1024)} MB)` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    if (!creatorToken) {
      return new Response(JSON.stringify({ error: 'Unauthorized - missing session token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: session } = await supabase
      .from('creator_sessions')
      .select('id')
      .eq('token', creatorToken)
      .eq('creator_name', creatorName)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized - invalid session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, creator_id')
      .eq('id', productId)
      .single()

    if (productError || !product) {
      return new Response(JSON.stringify({ error: 'Product not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (product.creator_id !== creatorName) {
      return new Response(JSON.stringify({ error: 'Unauthorized - not the product creator' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const fileExt = (file.name.split('.').pop() || 'bin').toLowerCase()
    const objectPath = `${productId}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`

    const { error: uploadError } = await supabase
      .storage
      .from('product-media')
      .upload(objectPath, file, { contentType: file.type, upsert: false })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return new Response(JSON.stringify({ error: 'Failed to upload file' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const publicUrl = `${supabaseUrl}/functions/v1/product-media-redirect?path=${encodeURIComponent(objectPath)}`

    return new Response(JSON.stringify({ url: publicUrl, path: objectPath }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('upload-product-media error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})