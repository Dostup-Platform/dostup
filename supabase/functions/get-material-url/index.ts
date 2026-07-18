import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getSignedUrl } from "https://deno.land/x/aws_s3_presign@2.2.1/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '')
    if (!jwt) return json({ error: 'Unauthorized' }, 401)

    const { materialId, download } = await req.json().catch(() => ({}))
    if (!materialId) return json({ error: 'Missing materialId' }, 400)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt)
    if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401)
    const uid = userData.user.id

    const { data: material } = await supabase
      .from('materials')
      .select('id, product_id, file_url, title, teacher_id, allow_download, teacher_allow_download, products:products(owner_id)')
      .eq('id', materialId).maybeSingle()
    if (!material) return json({ error: 'Material not found' }, 404)
    if (!material.file_url) return json({ error: 'No file' }, 400)

    // Access: product owner, assigned teacher, or completed purchase
    const ownerId = (material.products as unknown as { owner_id: string | null } | null)?.owner_id
    const isOwner = ownerId === uid
    const isTeacher = material.teacher_id === uid
    let hasAccess = isOwner || isTeacher
    if (!hasAccess) {
      const { data: purchase } = await supabase
        .from('purchases').select('id')
        .eq('user_id', uid).eq('product_id', material.product_id)
        .eq('status', 'completed').maybeSingle()
      hasAccess = !!purchase
    }
    if (!hasAccess) return json({ error: 'Access denied' }, 403)

    const fileUrl: string = material.file_url
    const wantDownload = !!download

    // S3-stored files
    if (fileUrl.startsWith('s3://')) {
      const withoutPrefix = fileUrl.substring(5)
      const slash = withoutPrefix.indexOf('/')
      const bucket = withoutPrefix.substring(0, slash)
      const key = withoutPrefix.substring(slash + 1)
      const signOptions: Record<string, unknown> = {
        accessKeyId: Deno.env.get('AWS_ACCESS_KEY_ID')!,
        secretAccessKey: Deno.env.get('AWS_SECRET_ACCESS_KEY')!,
        bucket,
        key: '/' + key,
        region: Deno.env.get('AWS_S3_REGION')!,
        expiresIn: 3600,
      }
      if (wantDownload) {
        signOptions.queryParams = { 'response-content-disposition': `attachment; filename="${material.title}"` }
      }
      const url = getSignedUrl(signOptions as Parameters<typeof getSignedUrl>[0])
      return json({ url })
    }

    // Supabase storage-backed files (path within 'materials' bucket)
    const path = fileUrl.includes('/materials/') ? fileUrl.split('/materials/')[1] : fileUrl
    const { data: signed, error: signErr } = await supabase.storage
      .from('materials')
      .createSignedUrl(path, 3600, wantDownload ? { download: material.title } : undefined)
    if (signErr || !signed) return json({ error: 'Failed to sign URL' }, 500)
    return json({ url: signed.signedUrl })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}