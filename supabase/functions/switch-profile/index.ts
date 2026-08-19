import { json, optionsResponse } from '../_shared/http.ts'
import {
  accountTypeFor,
  activateSessionProfile,
  displayNameFrom,
  ensureCreatorAccount,
  findOrCreateProfile,
  listProfiles,
  loadAccountForProfile,
  parseProfileType,
  publicProfiles,
  type ProfileRow,
} from '../_shared/profiles.ts'
import { serviceClient } from '../_shared/session.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const token = typeof body.token === 'string' ? body.token.trim() : ''
    if (!token) return json({ success: false, error: 'Missing token' }, 401)

    const supabase = serviceClient()
    const { data: session } = await supabase
      .from('creator_sessions')
      .select('token, creator_name, profile_id, expires_at')
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (!session?.profile_id) {
      return json({ success: false, error: 'Invalid session' }, 401)
    }

    const { data: current } = await supabase
      .from('profiles')
      .select('id, auth_user_id, type, display_name, last_used_at, created_at')
      .eq('id', session.profile_id)
      .maybeSingle()

    const currentProfile = current as ProfileRow | null
    if (!currentProfile?.auth_user_id) {
      return json({ success: false, error: 'Identity required' }, 403)
    }

    const authUserId = currentProfile.auth_user_id
    const createType = parseProfileType(body.createType ?? body.create_type)
    const requestedId = typeof body.profileId === 'string'
      ? body.profileId.trim()
      : typeof body.profile_id === 'string'
        ? body.profile_id.trim()
        : ''

    let target: ProfileRow | null = null

    if (createType) {
      const { data: userData } = await supabase.auth.admin.getUserById(authUserId)
      const email = userData?.user?.email ?? ''
      const displayName = userData?.user
        ? displayNameFrom(userData.user)
        : currentProfile.display_name || 'User'
      target = await findOrCreateProfile(supabase, authUserId, createType, displayName)
      if (!target) return json({ error: 'Failed to create profile' }, 500)
      const sellerType = accountTypeFor(createType)
      if (sellerType) {
        if (!email) return json({ error: 'Email is required' }, 400)
        const account = await ensureCreatorAccount(supabase, {
          authUserId,
          email: email.trim().toLowerCase(),
          displayName: target.display_name || displayName,
          profile: target,
          accountType: sellerType,
        })
        if (!account) return json({ error: 'Failed to create account' }, 500)
        if (account.is_blocked) {
          return json({ success: false, error: 'Account blocked' })
        }
      }
    } else if (requestedId) {
      const { data: requested } = await supabase
        .from('profiles')
        .select('id, auth_user_id, type, display_name, last_used_at, created_at')
        .eq('id', requestedId)
        .maybeSingle()
      target = (requested as ProfileRow | null) ?? null
      if (!target || target.auth_user_id !== authUserId) {
        return json({ success: false, error: 'Forbidden' }, 403)
      }
    } else {
      return json({ error: 'profileId or createType required' }, 400)
    }

    const account = await loadAccountForProfile(supabase, target.id)
    const activated = await activateSessionProfile(supabase, token, target, account)
    if (!activated.ok) return activated.response

    const profiles = await listProfiles(supabase, authUserId)
    return json({
      success: true,
      ...activated.session,
      profiles: publicProfiles(profiles),
    })
  } catch (error) {
    console.error('switch-profile error:', error)
    return json({ error: 'Internal server error' }, 500)
  }
})
