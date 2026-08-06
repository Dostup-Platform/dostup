import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PBKDF2_ITERATIONS = 100000

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial, 256
  )
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bufToB64(salt.buffer)}$${bufToB64(bits)}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { login, password, accountType } = await req.json()

    if (typeof login !== 'string' || login.trim().length < 2 || login.length > 100) {
      return new Response(JSON.stringify({ error: 'Invalid login' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    if (typeof password !== 'string' || password.length < 6 || password.length > 200) {
      return new Response(JSON.stringify({ error: 'Invalid password' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    if (accountType !== 'course_creator' && accountType !== 'online_school') {
      return new Response(JSON.stringify({ error: 'Invalid account type' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const trimmedLogin = login.trim()

    // Check uniqueness (case-insensitive)
    const { data: existing } = await supabase
      .from('creator_accounts')
      .select('id')
      .ilike('login', trimmedLogin)
      .maybeSingle()

    if (existing) {
      return new Response(JSON.stringify({ error: 'login_taken' }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Also reject if matches the shared (legacy) password owner names? Not enforceable — skip.

    const passwordHash = await hashPassword(password)

    const { data: created, error: insertError } = await supabase
      .from('creator_accounts')
      .insert({
        login: trimmedLogin,
        display_name: trimmedLogin,
        password_hash: passwordHash,
        account_type: accountType,
      })
      .select()
      .single()

    if (insertError || !created) {
      // Race condition on unique index
      if ((insertError as { code?: string } | null)?.code === '23505') {
        return new Response(JSON.stringify({ error: 'login_taken' }), {
          status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      console.error('Insert error:', insertError)
      return new Response(JSON.stringify({ error: 'Failed to create account' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Create session token
    const sessionToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    await supabase.from('creator_sessions').insert({
      token: sessionToken,
      creator_name: trimmedLogin,
      expires_at: expiresAt.toISOString(),
    })

    return new Response(JSON.stringify({
      success: true,
      token: sessionToken,
      creatorName: trimmedLogin,
      accountType,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('register-creator error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})