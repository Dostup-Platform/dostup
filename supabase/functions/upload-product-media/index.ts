import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_IMAGE_BYTES = 15 * 1024 * 1024
const MAX_VIDEO_BYTES = 250 * 1024 * 1024
const MAX_FILE_BYTES = 50 * 1024 * 1024

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')
    if (!token) return json({ error: 'Unauthorized' }, 401)

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data: userData } = await userClient.auth.getUser()
    const user = userData?.user
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const form = await req.formData()
    const file = form.get('file') as File | null
    const productId = form.get('productId') as string | null
    const kind = form.get('kind') as string | null

    if (!file || !productId || !kind) return json({ error: 'Missing file/productId/kind' }, 400)
    if (kind !== 'image' && kind !== 'video' && kind !== 'file') return json({ error: 'bad kind' }, 400)
    if (kind === 'image' && !file.type.startsWith('image/')) return json({ error: 'Invalid image type' }, 400)
    if (kind === 'video' && !file.type.startsWith('video/')) return json({ error: 'Invalid video type' }, 400)

    const maxBytes = kind === 'video' ? MAX_VIDEO_BYTES : kind === 'file' ? MAX_FILE_BYTES : MAX_IMAGE_BYTES
    if (file.size > maxBytes) return json({ error: `File too large (max ${Math.round(maxBytes / 1024 / 1024)} MB)` }, 400)

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: product } = await admin.from('products').select('id, owner_id').eq('id', productId).maybeSingle()
    if (!product) return json({ error: 'Product not found' }, 404)
    if (product.owner_id !== user.id) return json({ error: 'Forbidden' }, 403)

    const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
    const objectPath = `${productId}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const { error: upErr } = await admin.storage.from('product-media').upload(objectPath, file, {
      contentType: file.type, upsert: false,
    })
    if (upErr) { console.error(upErr); return json({ error: 'Upload failed' }, 500) }

    const url = `${supabaseUrl}/functions/v1/product-media-redirect?path=${encodeURIComponent(objectPath)}`
    return json({ url, path: objectPath })
  } catch (e) {
    console.error('upload-product-media', e)
    return json({ error: 'Internal error' }, 500)
  }
})