import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { S3RequestPresigner } from "https://esm.sh/@aws-sdk/s3-request-presigner@3.620.0?target=deno"
import { HttpRequest } from "https://esm.sh/@smithy/protocol-http@4.1.7?target=deno"
import { Sha256 } from "https://esm.sh/@aws-crypto/sha256-browser@5.2.0?target=deno"

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

    // S3-stored files. Подписываем через AWS SDK: прежняя библиотека (aws_s3_presign)
    // кодировала пробелы в query как '+', из-за чего S3 отвечал SignatureDoesNotMatch
    // на ссылки скачивания с response-content-disposition.
    if (fileUrl.startsWith('s3://')) {
      const withoutPrefix = fileUrl.substring(5)
      const slash = withoutPrefix.indexOf('/')
      const bucket = withoutPrefix.substring(0, slash)
      const key = withoutPrefix.substring(slash + 1)
      const region = Deno.env.get('AWS_S3_REGION')!
      const hostname = `${bucket}.s3.${region}.amazonaws.com`
      const encodedKey = key.split('/').map((s) => encodeURIComponent(s)).join('/')

      const query: Record<string, string> = {}
      if (wantDownload) {
        // ASCII-fallback + RFC 5987 для не-латинских названий материалов
        const asciiName = material.title.replaceAll(/["\\]/g, '_').replaceAll(/[^\x20-\x7e]/g, '_')
        query['response-content-disposition'] =
          `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(material.title)}`
      }

      const presigner = new S3RequestPresigner({
        region,
        credentials: {
          accessKeyId: Deno.env.get('AWS_ACCESS_KEY_ID')!,
          secretAccessKey: Deno.env.get('AWS_SECRET_ACCESS_KEY')!,
        },
        sha256: Sha256,
      })
      const signedRequest = await presigner.presign(
        new HttpRequest({
          protocol: 'https:',
          method: 'GET',
          hostname,
          path: `/${encodedKey}`,
          headers: { host: hostname },
          query,
        }),
        { expiresIn: 3600 },
      )

      const url = new URL(`https://${hostname}${signedRequest.path}`)
      for (const [k, v] of Object.entries(signedRequest.query ?? {})) {
        if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, String(x)))
        else if (v !== undefined && v !== null) url.searchParams.append(k, String(v))
      }
      return json({ url: url.toString() })
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