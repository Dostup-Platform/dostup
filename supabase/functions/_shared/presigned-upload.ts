import { json, optionsResponse } from './http.ts'
import { authorizeUpload, presignPut } from './s3.ts'
import { serviceClient } from './session.ts'

const AVATAR_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])
const AVATAR_MAX_BYTES = 5 * 1024 * 1024

function asString(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  return ''
}

function avatarExt(fileName: string, fileType: string): string {
  const fromName = fileName.split('.').pop()?.toLowerCase() || ''
  if (fromName === 'jpg' || fromName === 'jpeg' || fromName === 'png' || fromName === 'webp') {
    return fromName === 'jpeg' ? 'jpg' : fromName
  }
  if (fileType === 'image/png') return 'png'
  if (fileType === 'image/webp') return 'webp'
  return 'jpg'
}

async function handleAvatarUpload(body: Record<string, unknown>): Promise<Response> {
  const token = asString(body.creatorToken) || asString(body.sessionToken)
  if (!token) return json({ error: 'Unauthorized' }, 401)

  const supabase = serviceClient()
  const { data: session } = await supabase
    .from('creator_sessions')
    .select('profile_id')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (!session?.profile_id) return json({ error: 'Unauthorized' }, 401)

  const file = body.file
  const fileName = asString(body.fileName) || (file instanceof File ? file.name : 'avatar.jpg')
  const fileType = asString(body.fileType) || (file instanceof File ? file.type : 'image/jpeg')
  if (!AVATAR_MIME.has(fileType)) return json({ error: 'Invalid image type' }, 400)
  if (file instanceof File && file.size > AVATAR_MAX_BYTES) {
    return json({ error: 'File too large' }, 400)
  }

  const ext = avatarExt(fileName, fileType)
  const objectPath = `${session.profile_id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/avatars/${objectPath}`

  if (file instanceof File) {
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(objectPath, file, { contentType: fileType, upsert: false })
    if (uploadError) {
      console.error('avatar upload error', uploadError)
      return json({ error: 'Upload failed' }, 500)
    }
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', session.profile_id)
    if (profileError) {
      console.error('avatar profile update error', profileError)
      return json({ error: 'Failed to save avatar' }, 500)
    }
    return json({
      path: objectPath,
      storagePath: objectPath,
      publicUrl,
    })
  }

  const { data: signed, error: signError } = await supabase.storage
    .from('avatars')
    .createSignedUploadUrl(objectPath)
  if (signError || !signed?.signedUrl) {
    console.error('avatar sign error', signError)
    return json({ error: 'Server misconfiguration' }, 500)
  }
  return json({
    uploadUrl: signed.signedUrl,
    path: objectPath,
    storagePath: objectPath,
    publicUrl,
    contentType: fileType,
  })
}

export async function handlePresignedUpload(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return optionsResponse()

  try {
    const contentType = req.headers.get('content-type') || ''
    let body: Record<string, unknown>

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      body = {
        productId: form.get('productId'),
        role: form.get('role') || 'creator',
        purpose: form.get('purpose'),
        fileName: (form.get('file') as File | null)?.name || form.get('fileName'),
        fileType: (form.get('file') as File | null)?.type || form.get('fileType'),
        creatorToken: form.get('creatorToken'),
        creatorName: form.get('creatorName'),
        sessionToken: form.get('sessionToken'),
        teacherId: form.get('teacherId'),
        file: form.get('file'),
      }
    } else {
      body = await req.json()
    }

    const purpose = asString(body.purpose) || asString(body.role)
    if (purpose === 'avatar') {
      return handleAvatarUpload(body)
    }

    const auth = await authorizeUpload(body)
    if (!auth.ok) return json({ error: auth.error }, auth.status)

    const fileName = String(body.fileName || 'file.bin')
    const productId = String(body.productId)
    const fileExt = fileName.split('.').pop()
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`
    const s3Key = auth.role === 'teacher'
      ? `teacher-${auth.teacherId}/${productId}/${uniqueId}.${fileExt}`
      : `${productId}/${uniqueId}.${fileExt}`

    const signed = await presignPut(s3Key)
    if (!signed) return json({ error: 'Server misconfiguration' }, 500)

    const file = body.file
    if (file instanceof File) {
      const put = await fetch(signed.uploadUrl, { method: 'PUT', body: file })
      if (!put.ok) return json({ error: 'Upload failed' }, 500)
      return json({ path: signed.storagePath, uploadUrl: signed.uploadUrl, storagePath: signed.storagePath })
    }

    return json({
      uploadUrl: signed.uploadUrl,
      storagePath: signed.storagePath,
      contentType: String(body.fileType || 'application/octet-stream'),
    })
  } catch (e) {
    console.error('presigned-upload error', e)
    return json({ error: 'Internal server error' }, 500)
  }
}
