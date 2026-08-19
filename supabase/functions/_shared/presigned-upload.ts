import { json, optionsResponse } from './http.ts'
import { authorizeUpload, presignPut } from './s3.ts'

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
