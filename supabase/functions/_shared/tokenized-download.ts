import { corsHeaders, json, optionsResponse } from './http.ts'
import { authorizeDownload, mimeForKey, parseS3Path, presignGet } from './s3.ts'
import { serviceClient } from './session.ts'
import { buyerHasProductAccess } from './subscription.ts'

async function consumeAccessToken(token: string): Promise<string | null> {
  const supabase = serviceClient()
  const { data } = await supabase
    .from('material_access_tokens')
    .select('*')
    .eq('token', token)
    .eq('used', false)
    .maybeSingle()
  if (!data) return null
  if (new Date(data.expires_at) < new Date()) {
    await supabase.from('material_access_tokens').update({ used: true }).eq('id', data.id)
    return null
  }
  await supabase.from('material_access_tokens').update({ used: true }).eq('id', data.id)
  return data.file_path as string
}

async function proxyPath(path: string, asAttachment = false): Promise<Response> {
  if (path.startsWith('s3://')) {
    const parsed = parseS3Path(path)
    if (!parsed) return json({ error: 'Not an S3 path' }, 400)
    const url = presignGet(parsed.bucket, parsed.key, asAttachment, 300)
    const s3Response = await fetch(url)
    if (!s3Response.ok) return json({ error: 'File not found' }, 404)
    const fileName = decodeURIComponent(parsed.key.split('/').pop() || 'download')
    return new Response(s3Response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': mimeForKey(parsed.key),
        'Content-Disposition': asAttachment
          ? `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`
          : 'inline',
      },
    })
  }

  const supabase = serviceClient()
  const { data, error } = await supabase.storage.from('materials').download(path)
  if (error || !data) return json({ error: 'File not found' }, 404)
  return new Response(data, {
    headers: { ...corsHeaders, 'Content-Type': mimeForKey(path), 'Content-Disposition': 'inline' },
  })
}

export async function handleTokenizedDownload(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return optionsResponse()

  try {
    const url = new URL(req.url)
    const token = url.searchParams.get('token')
    if (req.method === 'GET' && token) {
      const path = await consumeAccessToken(token)
      if (!path) return json({ error: 'Invalid or expired token' }, 403)
      return proxyPath(path, false)
    }

    if (req.method === 'GET') {
      const path = url.searchParams.get('path') || ''
      const sessionToken = url.searchParams.get('sessionToken') || ''
      const creatorToken = url.searchParams.get('creatorToken') || ''
      const creatorName = url.searchParams.get('creatorName') || ''
      const download = url.searchParams.get('download')
      const ok = await authorizeDownload({ path, sessionToken, creatorToken, creatorName })
      if (!ok) {
        const role = url.searchParams.get('role')
        const userId = url.searchParams.get('userId')
        if (role === 'student' && userId && path.startsWith('s3://')) {
          const parsed = parseS3Path(path)!
          const parts = parsed.key.split('/')
          const productId = parts[0]?.startsWith('teacher-') ? parts[1] : parts[0]
          const supabase = serviceClient()
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', userId)
            .maybeSingle()
          const hasAccess = profile
            ? await buyerHasProductAccess(supabase, profile.id, productId)
            : false
          if (!hasAccess) {
            const { data: purchase } = await supabase
              .from('simple_purchases')
              .select('id')
              .eq('simple_user_id', userId)
              .eq('product_id', productId)
              .eq('status', 'completed')
              .maybeSingle()
            if (!purchase) return new Response('Access denied', { status: 403 })
          }
        } else if (role !== 'creator' && role !== 'teacher') {
          return new Response('Access denied', { status: 403 })
        }
      }
      const parsed = parseS3Path(path)
      if (!parsed) return new Response('Not an S3 path', { status: 400 })
      const presigned = presignGet(parsed.bucket, parsed.key, !!download, 3600)
      return new Response(null, { status: 302, headers: { Location: presigned } })
    }

    const body = await req.json().catch(() => ({}))
    const path = String(body.path || '')
    const defaultProxy = url.pathname.includes('s3-download-proxy')
    const mode = body.mode === 'proxy' || (body.mode !== 'url' && defaultProxy) ? 'proxy' : 'url'
    const ok = await authorizeDownload({
      path,
      sessionToken: String(body.sessionToken || ''),
      creatorToken: String(body.creatorToken || ''),
      creatorName: String(body.creatorName || ''),
    })
    if (!ok) {
      if (body.role === 'student' && body.userId) {
        const parsed = parseS3Path(path)
        if (!parsed) return json({ error: 'Not an S3 path' }, 400)
        const parts = parsed.key.split('/')
        const productId = parts[0]?.startsWith('teacher-') ? parts[1] : parts[0]
        const supabase = serviceClient()
        const profileId = typeof body.userId === 'string' ? body.userId : ''
        const hasAccess = profileId
          ? await buyerHasProductAccess(supabase, profileId, productId)
          : false
        if (!hasAccess) {
          const { data: purchase } = await supabase
            .from('simple_purchases')
            .select('id')
            .eq('simple_user_id', body.userId)
            .eq('product_id', productId)
            .eq('status', 'completed')
            .maybeSingle()
          if (!purchase) return json({ error: 'Access denied' }, 403)
        }
      } else if (body.role !== 'creator' && body.role !== 'teacher') {
        return json({ error: 'Access denied' }, 403)
      }
    }

    const parsed = parseS3Path(path)
    if (!parsed) return json({ error: 'Not an S3 path' }, 400)

    if (mode === 'proxy') return proxyPath(path, true)

    const signed = presignGet(parsed.bucket, parsed.key, !!body.download, 3600)
    return json({ url: signed })
  } catch (e) {
    console.error('tokenized-download error', e)
    return json({ error: 'Internal server error' }, 500)
  }
}
