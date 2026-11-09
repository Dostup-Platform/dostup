import { resolveCaller, creatorOwnsProduct, teacherAssignedToProduct } from '../_shared/session.ts'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buyerHasProductAccess } from '../_shared/subscription.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { materialId } = body

    if (!materialId) {
      return new Response(
        JSON.stringify({ error: 'Missing materialId or userId' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get the material and its product
    const { data: material, error: materialError } = await supabase
      .from('materials')
      .select('*, products(id, creator_id, creator_account_id)')
      .eq('id', materialId)
      .single()

    if (materialError || !material) {
      return new Response(
        JSON.stringify({ error: 'Material not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const caller = await resolveCaller(supabase, body)
    if (!caller) return new Response('Unauthorized', {status:401,headers:corsHeaders})
    const hasAccess = caller.kind === 'creator'
      ? await creatorOwnsProduct(supabase, caller.accountId, material.product_id)
      : (await buyerHasProductAccess(supabase, caller.userId, material.product_id)) ||
        (caller.role === 'teacher' && await teacherAssignedToProduct(supabase, caller.name, material.product_id))
    if (!hasAccess) return new Response('Access denied', {status:403,headers:corsHeaders})

    // Generate signed URL for the file (valid for 1 hour)
    const path = material.file_url?.split('/materials/')[1] || material.file_url
    
    if (!path) {
      return new Response(
        JSON.stringify({ error: 'No file path available' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const { data: signedUrl, error: signError } = await supabase
      .storage
      .from('materials')
      .createSignedUrl(path, 3600) // 1 hour expiry

    if (signError) {
      console.error('Error creating signed URL:', signError)
      return new Response(
        JSON.stringify({ error: 'Failed to generate access URL' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({ url: signedUrl.signedUrl }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error getting material URL:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})