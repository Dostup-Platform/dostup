import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    const { action, userPhone, userRole, fcmToken, deviceInfo } = await req.json()

    if (!action || !userPhone) {
      return new Response(
        JSON.stringify({ error: 'Missing action or userPhone' }),
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

    switch (action) {
      case 'register': {
        if (!fcmToken) {
          return new Response(
            JSON.stringify({ error: 'Missing fcmToken for register action' }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }

        // Upsert the token
        const { error } = await supabase
          .from('push_tokens')
          .upsert({
            user_phone: userPhone,
            user_role: userRole || 'student',
            fcm_token: fcmToken,
            device_info: deviceInfo || null,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_phone,fcm_token'
          })

        if (error) {
          console.error('Error registering push token:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to register token' }),
            { 
              status: 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }

        return new Response(
          JSON.stringify({ success: true }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      case 'unregister': {
        if (!fcmToken) {
          return new Response(
            JSON.stringify({ error: 'Missing fcmToken for unregister action' }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }

        const { error } = await supabase
          .from('push_tokens')
          .delete()
          .eq('user_phone', userPhone)
          .eq('fcm_token', fcmToken)

        if (error) {
          console.error('Error unregistering push token:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to unregister token' }),
            { 
              status: 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }

        return new Response(
          JSON.stringify({ success: true }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
    }

  } catch (error) {
    console.error('Error managing push token:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})