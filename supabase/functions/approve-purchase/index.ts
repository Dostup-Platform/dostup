import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

    const { purchaseId } = await req.json().catch(() => ({}))
    if (!purchaseId) return json({ error: 'Missing purchaseId' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt)
    if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401)
    const uid = userData.user.id

    const { data: purchase } = await supabase
      .from('purchases').select('id, product_id, status').eq('id', purchaseId).maybeSingle()
    if (!purchase) return json({ error: 'Purchase not found' }, 404)
    if (purchase.status === 'completed') return json({ success: true, alreadyApproved: true })

    const { data: product } = await supabase
      .from('products').select('owner_id').eq('id', purchase.product_id).maybeSingle()
    if (!product || product.owner_id !== uid) return json({ error: 'Forbidden' }, 403)

    const { error: updateErr } = await supabase
      .from('purchases').update({ status: 'completed' }).eq('id', purchaseId)
    if (updateErr) return json({ error: updateErr.message }, 500)

    return json({ success: true })
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
