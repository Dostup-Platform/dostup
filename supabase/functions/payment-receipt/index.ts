import { corsHeaders, json, optionsResponse } from '../_shared/http.ts'
import { resolveCreator, serviceClient, unauthorized, forbidden, creatorOwnsProduct } from '../_shared/session.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()

  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const submissionId = String(body.submissionId || '')
    if (!submissionId) return json({ error: 'Missing submissionId' }, 400)

    const supabase = serviceClient()
    const creator = await resolveCreator(
      supabase,
      String(body.creatorToken || ''),
      String(body.creatorName || ''),
    )
    if (!creator) return unauthorized()

    const { data: submission } = await supabase
      .from('payment_submissions')
      .select('id, purchase_id, receipt_path, receipt_mime_type')
      .eq('id', submissionId)
      .maybeSingle()
    if (!submission) return json({ error: 'Not found' }, 404)

    const { data: purchase } = await supabase
      .from('simple_purchases')
      .select('product_id')
      .eq('id', submission.purchase_id)
      .maybeSingle()
    if (!purchase) return json({ error: 'Not found' }, 404)
    if (!(await creatorOwnsProduct(supabase, creator.accountId, purchase.product_id))) return forbidden()

    const { data, error } = await supabase.storage
      .from('payment-receipts')
      .download(submission.receipt_path)
    if (error || !data) return json({ error: 'Receipt unavailable' }, 404)

    return new Response(data, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': submission.receipt_mime_type || 'application/octet-stream',
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    console.error('payment-receipt error', e)
    return json({ error: 'Internal error' }, 500)
  }
})
