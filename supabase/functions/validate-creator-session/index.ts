import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { listProfiles, loadAccountForProfile, publicProfiles, type ProfileRow } from '../_shared/profiles.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { token, creatorName } = await req.json()

    if (!token) {
      return new Response(
        JSON.stringify({ valid: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    let query = supabase
      .from('creator_sessions')
      .select('*')
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())

    if (typeof creatorName === 'string' && creatorName.trim()) {
      query = query.eq('creator_name', creatorName.trim())
    }

    const { data: session, error } = await query.maybeSingle()

    if (error || !session) {
      return new Response(
        JSON.stringify({ valid: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let profile: ProfileRow | null = null
    if (session.profile_id) {
      const { data } = await supabase
        .from('profiles')
        .select('id, auth_user_id, type, display_name, last_used_at, created_at')
        .eq('id', session.profile_id)
        .maybeSingle()
      profile = (data as ProfileRow | null) ?? null
    }

    const account = profile ? await loadAccountForProfile(supabase, profile.id) : null
    const profiles = profile?.auth_user_id
      ? publicProfiles(await listProfiles(supabase, profile.auth_user_id))
      : profile
        ? publicProfiles([profile])
        : []

    return new Response(
      JSON.stringify({
        valid: true,
        profileId: profile?.id ?? null,
        profileType: profile?.type ?? null,
        displayName: profile?.display_name ?? session.creator_name,
        creatorName: session.creator_name,
        accountType: account?.account_type ?? null,
        createdAt: profile?.created_at ?? session.created_at,
        profiles,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error validating session:', error)
    return new Response(
      JSON.stringify({ valid: false }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
