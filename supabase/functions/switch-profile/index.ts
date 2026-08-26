import { json, optionsResponse } from '../_shared/http.ts'
import {
  accountTypeFor,
  activateSessionProfile,
  displayNameFrom,
  ensureCreatorAccount,
  findOrCreateProfile,
  listProfiles,
  loadAccountForProfile,
  parseOnboardingAuthUserId,
  parseProfileType,
  PROFILE_COLUMNS,
  profileTypeForAccount,
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

    if (!session) {
      return json({ success: false, error: 'Invalid session' }, 401)
    }

    const onboardingAuthId = parseOnboardingAuthUserId(session.creator_name)
    let profileId = session.profile_id
    let authUserId: string | null = onboardingAuthId

    if (!authUserId) {
      if (!profileId) {
        if (typeof session.creator_name === 'string' && session.creator_name.startsWith('buyer:')) {
          profileId = session.creator_name.slice(6)
        } else if (session.creator_name) {
          const { data: acc } = await supabase
            .from('creator_accounts')
            .select('profile_id, auth_user_id, display_name, account_type')
            .ilike('login', session.creator_name)
            .maybeSingle()
          if (acc?.profile_id) {
            profileId = acc.profile_id
          } else if (acc?.auth_user_id) {
            const type = profileTypeForAccount(acc.account_type)
            const p = await findOrCreateProfile(
              supabase,
              acc.auth_user_id,
              type,
              acc.display_name || session.creator_name,
            )
            if (p) profileId = p.id
          }
        }
        if (profileId) {
          await supabase.from('creator_sessions').update({ profile_id: profileId }).eq('token', token)
        }
      }

      if (!profileId) {
        return json({ success: false, error: 'Invalid session' }, 401)
      }

      const { data: current } = await supabase
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .eq('id', profileId)
        .maybeSingle()

      const currentProfile = current as ProfileRow | null
      if (!currentProfile?.auth_user_id) {
        return json({ success: false, error: 'identity_required' }, 403)
      }
      authUserId = currentProfile.auth_user_id
    }

    const createType = parseProfileType(body.createType ?? body.create_type)
    const requestedId = typeof body.profileId === 'string'
      ? body.profileId.trim()
      : typeof body.profile_id === 'string'
        ? body.profile_id.trim()
        : ''

    let target: ProfileRow | null = null

    if (createType === 'creator' || createType === 'school' || createType === 'buyer') {
      const { data: userData } = await supabase.auth.admin.getUserById(authUserId!)
      const email = userData?.user?.email ?? ''
      const customName = typeof body.displayName === 'string' ? body.displayName.trim().slice(0, 100) : ''
      const displayName = customName.length >= 2
        ? customName
        : userData?.user
          ? displayNameFrom(userData.user)
          : 'User'
      target = await findOrCreateProfile(supabase, authUserId!, createType, displayName)
      if (!target) return json({ error: 'Failed to create profile' }, 500)
      if (createType === 'creator' || createType === 'school') {
        await findOrCreateProfile(supabase, authUserId!, 'buyer', displayName)
      }
      const sellerType = accountTypeFor(createType)
      if (sellerType) {
        const account = await ensureCreatorAccount(supabase, {
          authUserId: authUserId!,
          email: email ? email.trim().toLowerCase() : '',
          displayName: target.display_name || displayName,
          profile: target,
          accountType: sellerType,
        })
        if (!account) return json({ error: 'Failed to create account' }, 500)
        if (account.is_blocked) {
          return json({ success: false, error: 'account_blocked' })
        }
      }
    } else if (requestedId) {
      const { data: requested } = await supabase
        .from('profiles')
        .select(PROFILE_COLUMNS)
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
    if (account?.is_blocked) {
      return json({ success: false, error: 'account_blocked' })
    }

    const activated = await activateSessionProfile(supabase, token, target, account)
    if (!activated.ok) return activated.response

    const profiles = await listProfiles(supabase, authUserId!)
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
