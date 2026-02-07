import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { purchaseId, creatorToken, creatorName } = await req.json()

    if (!purchaseId || !creatorToken || !creatorName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Validate creator session
    const { data: session } = await supabase
      .from('creator_sessions')
      .select('*')
      .eq('token', creatorToken)
      .eq('creator_name', creatorName)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (!session) {
      console.log('Invalid session for purchase approval:', creatorName)
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the purchase belongs to a product owned by this creator
    const { data: purchase, error: purchaseError } = await supabase
      .from('simple_purchases')
      .select('id, product_id, status')
      .eq('id', purchaseId)
      .single()

    if (purchaseError || !purchase) {
      console.error('Purchase not found:', purchaseId)
      return new Response(
        JSON.stringify({ error: 'Purchase not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the product belongs to this creator
    const { data: product } = await supabase
      .from('products')
      .select('creator_id')
      .eq('id', purchase.product_id)
      .single()

    if (!product || product.creator_id !== creatorName) {
      console.log('Creator mismatch:', creatorName, 'vs', product?.creator_id)
      return new Response(
        JSON.stringify({ error: 'Not authorized to approve this purchase' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (purchase.status === 'completed') {
      return new Response(
        JSON.stringify({ success: true, message: 'Already approved' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Approve the purchase using service role (bypasses the trigger)
    const { error: updateError } = await supabase
      .from('simple_purchases')
      .update({ 
        status: 'completed',
        confirmed_at: new Date().toISOString()
      })
      .eq('id', purchaseId)

    if (updateError) {
      console.error('Error approving purchase:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to approve purchase' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Purchase approved:', purchaseId, 'by creator:', creatorName)
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in approve-purchase:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
