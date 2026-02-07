import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Validate caller identity:
 * - For creators: check creator_sessions table
 * - For students/teachers: check simple_users table
 */
async function validateIdentity(
  supabase: any,
  userPhone: string,
  userRole: string,
  creatorToken?: string,
  creatorName?: string
): Promise<boolean> {
  if (userRole === 'creator') {
    if (!creatorToken || !creatorName) {
      console.log('Creator role requires creatorToken and creatorName');
      return false;
    }
    const { data: session } = await supabase
      .from('creator_sessions')
      .select('id')
      .eq('token', creatorToken)
      .eq('creator_name', creatorName)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    
    if (!session) {
      console.log('Invalid creator session for:', creatorName);
      return false;
    }
    return true;
  }

  // For students/teachers: verify user exists in simple_users
  const { data: user } = await supabase
    .from('simple_users')
    .select('id')
    .eq('phone', userPhone)
    .maybeSingle();
  
  if (!user) {
    console.log('User not found in simple_users:', userPhone);
    return false;
  }
  return true;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { action, userPhone, userRole, fcmToken, deviceInfo, creatorToken, creatorName } = await req.json()

    if (!action || !userPhone) {
      return new Response(
        JSON.stringify({ error: 'Missing action or userPhone' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // --- Validate caller identity ---
    const isValid = await validateIdentity(
      supabase,
      userPhone,
      userRole || 'student',
      creatorToken,
      creatorName
    );

    if (!isValid) {
      console.warn(`Unauthorized manage-push-token call for ${userPhone} (role: ${userRole})`);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - identity validation failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    switch (action) {
      case 'register': {
        if (!fcmToken) {
          return new Response(
            JSON.stringify({ error: 'Missing fcmToken for register action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        await supabase
          .from('push_tokens')
          .delete()
          .eq('fcm_token', fcmToken)

        await supabase
          .from('push_tokens')
          .delete()
          .eq('user_phone', userPhone)
          .eq('user_role', userRole || 'student')

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
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        console.log(`Token registered for ${userPhone} (${userRole})`)
        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'unregister': {
        let deleteQuery = supabase.from('push_tokens').delete()
        
        if (fcmToken) {
          deleteQuery = deleteQuery.eq('fcm_token', fcmToken)
        } else {
          deleteQuery = deleteQuery.eq('user_phone', userPhone)
        }

        const { error } = await deleteQuery

        if (error) {
          console.error('Error unregistering push token:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to unregister token' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        console.log(`Token(s) unregistered for ${userPhone}`)
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
