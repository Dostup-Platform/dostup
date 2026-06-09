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

function b64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}
function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

async function verifyPbkdf2(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const iterations = parseInt(parts[1], 10)
  const salt = new Uint8Array(b64ToBuf(parts[2]))
  const expected = parts[3]
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial, 256
  )
  return constantTimeCompare(bufToB64(bits), expected)
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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const trimmedName = creatorName.trim()

    // 1) Try per-account password first
    const { data: account } = await supabase
      .from('creator_accounts')
      .select('*')
      .ilike('login', trimmedName)
      .maybeSingle()

    let isValid = false
    let accountType: 'course_creator' | 'online_school' = 'course_creator'
    let resolvedName = trimmedName

    if (account) {
      isValid = await verifyPbkdf2(password, account.password_hash)
      accountType = account.account_type as 'course_creator' | 'online_school'
      resolvedName = account.login
    } else {
      // 2) Fallback to legacy shared password
      const expectedPassword = Deno.env.get('CREATOR_PASSWORD_HASH')
      if (expectedPassword) {
        isValid = constantTimeCompare(password, expectedPassword)
      }
    }

    if (!isValid) {
      console.log('Invalid password attempt for creator:', trimmedName)
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid password' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate a session token and store in database
    const sessionToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    // Clean up old sessions for this creator
    await supabase
      .from('creator_sessions')
      .delete()
      .eq('creator_name', resolvedName)
      .lt('expires_at', new Date().toISOString())

    // Store the new session
    const { error: insertError } = await supabase
      .from('creator_sessions')
      .insert({
        token: sessionToken,
        creator_name: resolvedName,
        expires_at: expiresAt.toISOString()
      })

    if (insertError) {
      console.error('Error creating session:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to create session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Creator session created for:', resolvedName)

    return new Response(
      JSON.stringify({ 
        success: true, 
        token: sessionToken,
        creatorName: resolvedName,
        accountType,
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
