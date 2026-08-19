import { json, optionsResponse } from '../_shared/http.ts'
import {
  accountTypeFor,
  displayNameFrom,
  ensureCreatorAccount,
  findOrCreateProfile,
  issueAppSession,
  linkAccountsByEmail,
  listProfiles,
  loadAccountForProfile,
  normalizeEmail,
  parseProfileType,
  pickProfile,
  publicProfiles,
} from '../_shared/profiles.ts'
import { serviceClient } from '../_shared/session.ts'

function bearerToken(req: Request): string {
  const header = req.headers.get('authorization') || req.headers.get('Authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || ''
}

function accessTokenFrom(req: Request, body: Record<string, unknown>): string {
  const fromBody = body.access_token
  if (typeof fromBody === 'string' && fromBody.trim()) return fromBody.trim()
  return bearerToken(req)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const accessToken = accessTokenFrom(req, body)
    if (!accessToken) {
      return json({ success: false, error: 'Missing access token' }, 401)
    }

    const supabase = serviceClient()
    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken)
    const user = userData?.user
    if (userError || !user) {
      return json({ success: false, error: 'Invalid access token' }, 401)
    }

    const email = normalizeEmail(user.email)
    if (!email) {
      return json({ success: false, error: 'Email is required' }, 400)
    }

    const displayName = displayNameFrom(user)
    await linkAccountsByEmail(supabase, user.id, email, displayName)

    const requestedType = parseProfileType(
      body.profileType ?? body.profile_type ?? body.account_type ?? body.accountType,
    )

    let profiles = await listProfiles(supabase, user.id)
    let target = pickProfile(profiles, requestedType)

    if (requestedType && !target) {
      target = await findOrCreateProfile(supabase, user.id, requestedType, displayName)
      if (target) profiles = await listProfiles(supabase, user.id)
    }

    if (!target) {
      target = await findOrCreateProfile(supabase, user.id, 'buyer', displayName)
      if (target) profiles = await listProfiles(supabase, user.id)
    }

    if (!target) {
      return json({ error: 'Failed to resolve profile' }, 500)
    }

    let account = await loadAccountForProfile(supabase, target.id)
    const sellerType = accountTypeFor(target.type)
    if (sellerType) {
      account = await ensureCreatorAccount(supabase, {
        authUserId: user.id,
        email,
        displayName: target.display_name || displayName,
        profile: target,
        accountType: sellerType,
      })
      if (!account) {
        return json({ error: 'Failed to create account' }, 500)
      }
    }

    const issued = await issueAppSession(supabase, { profile: target, account })
    if (!issued.ok) return issued.response

    return json({
      success: true,
      ...issued.session,
      profiles: publicProfiles(profiles),
    })
  } catch (error) {
    console.error('exchange-auth-session error:', error)
    return json({ error: 'Internal server error' }, 500)
  }
})
