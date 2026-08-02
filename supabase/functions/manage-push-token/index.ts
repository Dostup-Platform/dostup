import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '')
    if (!jwt) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt)
    if (userErr || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const uid = userData.user.id

    const { action, userRole, fcmToken, deviceInfo } = await req.json()

    if (!action) {
      return new Response(
        JSON.stringify({ error: 'Missing action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const role = userRole || 'student'

    switch (action) {
      case 'register': {
        if (!fcmToken) {
          return new Response(
            JSON.stringify({ error: 'Missing fcmToken for register action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Device reuse: remove this exact token if it was registered elsewhere before
        await supabase.from('push_tokens').delete().eq('fcm_token', fcmToken)
        // Replace this user+role's previous token for the same device role
        await supabase.from('push_tokens').delete().eq('user_id', uid).eq('user_role', role)

        const { error } = await supabase
          .from('push_tokens')
          .insert({
            user_id: uid,
            user_role: role,
            fcm_token: fcmToken,
            device_info: deviceInfo || null,
            updated_at: new Date().toISOString(),
          })

        if (error) {
          console.error('Error registering push token:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to register token' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        console.log(`Token registered for ${uid} (${role})`)
        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'unregister': {
        let deleteQuery = supabase.from('push_tokens').delete().eq('user_id', uid)
        if (fcmToken) deleteQuery = deleteQuery.eq('fcm_token', fcmToken)
        else deleteQuery = deleteQuery.eq('user_role', role)

        const { error } = await deleteQuery

        if (error) {
          console.error('Error unregistering push token:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to unregister token' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        console.log(`Token(s) unregistered for ${uid}`)
        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

  } catch (error) {
    console.error('Error managing push token:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
