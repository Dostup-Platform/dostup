import { json, optionsResponse } from '../_shared/http.ts'
import {
  PROFILE_COLUMNS,
  resolveSessionProfileId,
  type ProfileRow,
} from '../_shared/profiles.ts'
import { serviceClient } from '../_shared/session.ts'

const HANDLE_RE = /^[a-z0-9-]{3,30}$/

function parseDisplayName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim().slice(0, 100)
  return trimmed.length >= 2 ? trimmed : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const token = typeof body.token === 'string' ? body.token.trim() : ''
    const action = typeof body.action === 'string' ? body.action : 'get_handle'
    if (!token) return json({ error: 'Unauthorized' }, 401)

    const supabase = serviceClient()
    const { data: session } = await supabase
      .from('creator_sessions')
      .select('token, creator_name, profile_id, expires_at')
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (!session) return json({ error: 'Unauthorized' }, 401)

    const hintProfileId = typeof body.profileId === 'string'
      ? body.profileId
      : typeof body.profile_id === 'string'
        ? body.profile_id
        : null
    const profileId = await resolveSessionProfileId(supabase, session, hintProfileId)
    if (!profileId) return json({ error: 'Unauthorized' }, 401)

    const { data: profile } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', profileId)
      .maybeSingle()

    const row = profile as ProfileRow | null
    if (!row || (row.type !== 'creator' && row.type !== 'school')) {
      return json({ error: 'Forbidden' }, 403)
    }

    if (action === 'get_handle') {
      return json({ handle: row.handle, profileId: row.id, displayName: row.display_name })
    }

    if (action === 'set_display_name') {
      const displayName = parseDisplayName(body.displayName)
      if (!displayName) return json({ error: 'invalid_display_name' }, 400)

      const { data: updated, error } = await supabase
        .from('profiles')
        .update({ display_name: displayName })
        .eq('id', row.id)
        .select('display_name, handle')
        .single()

      if (error || !updated) {
        console.error('set_display_name error:', error)
        return json({ error: 'Failed to save display name' }, 500)
      }

      await supabase
        .from('creator_accounts')
        .update({ display_name: displayName })
        .eq('profile_id', row.id)

      return json({
        ok: true,
        displayName: updated.display_name,
        handle: updated.handle ?? null,
      })
    }

    const raw = typeof body.handle === 'string' ? body.handle.trim().toLowerCase() : ''
    if (!HANDLE_RE.test(raw)) {
      return json({ error: 'invalid_handle', available: false }, 400)
    }

    const { data: available, error: checkError } = await supabase.rpc('handle_is_available', {
      p_handle: raw,
      p_except_id: row.id,
    })
    if (checkError) {
      console.error('handle_is_available error:', checkError)
      return json({ error: 'Failed' }, 500)
    }

    if (action === 'check_handle') {
      return json({ available: available === true, handle: raw })
    }

    if (action === 'set_handle') {
      if (available !== true) return json({ error: 'handle_taken', available: false }, 409)
      const { data: updated, error } = await supabase
        .from('profiles')
        .update({ handle: raw })
        .eq('id', row.id)
        .select('handle')
        .single()
      if (error || !updated) {
        console.error('set_handle error:', error)
        return json({ error: 'Failed to save handle' }, 500)
      }
      return json({ ok: true, handle: updated.handle })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (error) {
    console.error('manage-profile error:', error)
    return json({ error: 'Internal server error' }, 500)
  }
})
