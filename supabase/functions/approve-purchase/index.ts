import { json, optionsResponse } from '../_shared/http.ts'
import { resolveCreator, serviceClient } from '../_shared/session.ts'
import { completePurchase, recordVerificationEvent } from '../_shared/purchase.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()

  try {
    const { purchaseId, creatorToken, creatorName } = await req.json()

    if (!purchaseId || !creatorToken || !creatorName) {
      return json({ error: 'Missing required fields' }, 400)
    }

    const supabase = serviceClient()
    const creator = await resolveCreator(supabase, creatorToken, creatorName)
    if (!creator) {
      return json({ error: 'Invalid or expired session' }, 401)
    }

    const { data: purchase, error: purchaseError } = await supabase
      .from('simple_purchases')
      .select('id, product_id, status')
      .eq('id', purchaseId)
      .single()

    if (purchaseError || !purchase) {
      return json({ error: 'Purchase not found' }, 404)
    }

    const { data: product } = await supabase
      .from('products')
      .select('creator_account_id')
      .eq('id', purchase.product_id)
      .single()

    if (!product || product.creator_account_id !== creator.accountId) {
      return json({ error: 'Not authorized to approve this purchase' }, 403)
    }

    const completed = await completePurchase(supabase, purchaseId)
    if (!completed.ok) return json({ error: completed.error }, 409)

    const { data: submission } = await supabase
      .from('payment_submissions')
      .select('id, verification_status')
      .eq('purchase_id', purchaseId)
      .in('verification_status', ['manual_review', 'pending'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (submission) {
      await supabase
        .from('payment_submissions')
        .update({
          verification_status: 'confirmed',
          decided_at: new Date().toISOString(),
          decided_by: `creator:${creator.login}`,
          rejection_reason: null,
        })
        .eq('id', submission.id)

      await recordVerificationEvent(supabase, {
        submissionId: submission.id,
        purchaseId,
        actor: `creator:${creator.login}`,
        decision: 'confirmed',
        checks: { source: 'creator_manual_review' },
        notes: 'creator_approved',
      })
    }

    return json({ success: true, already: completed.already })
  } catch (error) {
    console.error('Error in approve-purchase:', error)
    return json({ error: 'Internal server error' }, 500)
  }
})
