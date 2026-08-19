import { json, optionsResponse } from '../_shared/http.ts'
import { normalizeEmail } from '../_shared/profiles.ts'
import { serviceClient } from '../_shared/session.ts'

type AuthUser = {
  id: string
  email?: string | null
  email_confirmed_at?: string | null
}

async function authHeaders(key: string): Promise<Record<string, string>> {
  return {
    Authorization: `Bearer ${key}`,
    apikey: key,
    'Content-Type': 'application/json',
  }
}

async function findUserByEmail(email: string, serviceKey: string): Promise<AuthUser | null> {
  const url = Deno.env.get('SUPABASE_URL')!
  const res = await fetch(
    `${url}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
    { headers: await authHeaders(serviceKey) },
  )
  if (!res.ok) return null
  const body = await res.json().catch(() => ({}))
  const users: AuthUser[] = Array.isArray(body?.users) ? body.users : []
  return users.find((u) => (u.email || '').toLowerCase() === email) ?? null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const email = normalizeEmail(typeof body.email === 'string' ? body.email : '')
    if (!email || !email.includes('@')) {
      return json({ error: 'Invalid email' }, 400)
    }

    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = serviceClient()

    let user = await findUserByEmail(email, serviceKey)
    if (!user) {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
      })
      if (error && !/already been registered|already exists/i.test(error.message)) {
        return json({ error: error.message }, 400)
      }
      user = data.user ? { id: data.user.id, email: data.user.email, email_confirmed_at: data.user.email_confirmed_at } : await findUserByEmail(email, serviceKey)
    }

    if (user?.id && !user.email_confirmed_at) {
      const { error } = await supabase.auth.admin.updateUserById(user.id, { email_confirm: true })
      if (error) return json({ error: error.message }, 500)
    }

    // Confirmed users get the Magic Link / OTP template, not Confirm signup.
    const otpRes = await fetch(`${url}/auth/v1/otp`, {
      method: 'POST',
      headers: await authHeaders(anonKey),
      body: JSON.stringify({ email, create_user: false }),
    })
    const otpBody = await otpRes.json().catch(() => ({}))
    if (!otpRes.ok) {
      return json(
        { error: otpBody?.msg || otpBody?.error_description || otpBody?.error || 'Failed to send code' },
        otpRes.status,
      )
    }

    return json({ success: true })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Failed to send code' }, 500)
  }
})
