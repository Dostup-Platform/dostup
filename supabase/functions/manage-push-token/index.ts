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

        // First, delete any existing tokens for this device (same fcm_token)
        // This ensures one device = one token, regardless of user
        await supabase
          .from('push_tokens')
          .delete()
          .eq('fcm_token', fcmToken)

        // Also delete old tokens for this user+role combination on other devices
        // Keep only the most recent device per user+role
        await supabase
          .from('push_tokens')
          .delete()
          .eq('user_phone', userPhone)
          .eq('user_role', userRole || 'student')

        // Insert the new token
        const { error } = await supabase
          .from('push_tokens')
          .insert({
            user_phone: userPhone,
            user_role: userRole || 'student',
            fcm_token: fcmToken,
            device_info: deviceInfo || null,
            updated_at: new Date().toISOString()
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

        console.log(`Token registered for ${userPhone} (${userRole})`)

        return new Response(
          JSON.stringify({ success: true }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      case 'unregister': {
        // Delete token - can be by fcmToken OR by userPhone (for logout)
        let deleteQuery = supabase.from('push_tokens').delete()
        
        if (fcmToken) {
          // Delete specific token
          deleteQuery = deleteQuery.eq('fcm_token', fcmToken)
        } else {
          // Delete all tokens for this user (logout scenario)
          deleteQuery = deleteQuery.eq('user_phone', userPhone)
        }

        const { error } = await deleteQuery

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

        console.log(`Token(s) unregistered for ${userPhone}`)

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