import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Constant-time string comparison to prevent timing attacks
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { password, creatorName } = await req.json()

    if (!password || !creatorName) {
      return new Response(
        JSON.stringify({ error: 'Missing password or creatorName' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Input validation
    if (typeof password !== 'string' || password.length > 200) {
      return new Response(
        JSON.stringify({ error: 'Invalid password format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (typeof creatorName !== 'string' || creatorName.length > 200 || creatorName.trim().length < 2) {
      return new Response(
        JSON.stringify({ error: 'Invalid creator name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const expectedPassword = Deno.env.get('CREATOR_PASSWORD_HASH')
    
    if (!expectedPassword) {
      console.error('CREATOR_PASSWORD_HASH not configured')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Use constant-time comparison
    const isValid = constantTimeCompare(password, expectedPassword)

    if (!isValid) {
      console.log('Invalid password attempt for creator:', creatorName)
      return new Response(
        JSON.stringify({ error: 'Invalid password' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate a session token and store in database
    const sessionToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Clean up old sessions for this creator
    await supabase
      .from('creator_sessions')
      .delete()
      .eq('creator_name', creatorName.trim())
      .lt('expires_at', new Date().toISOString())

    // Store the new session
    const { error: insertError } = await supabase
      .from('creator_sessions')
      .insert({
        token: sessionToken,
        creator_name: creatorName.trim(),
        expires_at: expiresAt.toISOString()
      })

    if (insertError) {
      console.error('Error creating session:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to create session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Creator session created for:', creatorName.trim())

    return new Response(
      JSON.stringify({ 
        success: true, 
        token: sessionToken,
        creatorName: creatorName.trim()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error verifying creator password:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
