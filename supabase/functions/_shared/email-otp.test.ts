import {
  alreadyRegisteredMessage,
  loginCodeEmailHtml,
  parseAdminUsers,
  pickEmailOtp,
} from './email-otp.ts'

Deno.test('detects already-registered auth errors', () => {
  const messages = [
    'A user with this email address has already been registered',
    'User already registered',
    'email already exists',
    'User already exists',
  ]
  for (const message of messages) {
    if (!alreadyRegisteredMessage(message)) {
      throw new Error(`should match: ${message}`)
    }
  }
  if (alreadyRegisteredMessage('Invalid email')) {
    throw new Error('must not match unrelated errors')
  }
})

Deno.test('parses admin user list, nested user, and bare user objects', () => {
  const email = 'anna@example.com'
  const listed = parseAdminUsers({
    users: [
      { id: '1', email: 'other@example.com' },
      { id: '2', email: 'Anna@example.com', email_confirmed_at: '2026-01-01T00:00:00Z' },
    ],
  }, email)
  if (listed?.id !== '2') throw new Error('should find the matching listed user')

  const nested = parseAdminUsers({
    user: { id: '3', email },
  }, email)
  if (nested?.id !== '3') throw new Error('should parse nested user')

  const bare = parseAdminUsers({
    id: '4',
    email,
    email_confirmed_at: null,
  }, email)
  if (bare?.id !== '4') throw new Error('should parse a bare user object')

  const missing = parseAdminUsers({ users: [{ id: '5', email: 'other@example.com' }] }, email)
  if (missing) throw new Error('must not return a different email')
})

Deno.test('picks a 6-digit OTP from generateLink payloads', () => {
  if (pickEmailOtp({ properties: { email_otp: '123456' } }) !== '123456') {
    throw new Error('properties.email_otp')
  }
  if (pickEmailOtp({ email_otp: '654321' }) !== '654321') {
    throw new Error('top-level email_otp')
  }
  if (pickEmailOtp({ properties: { email_otp: '12' } })) {
    throw new Error('short codes are invalid')
  }
  if (pickEmailOtp({ properties: { action_link: 'https://example.com' } })) {
    throw new Error('links are not codes')
  }
})

Deno.test('login email contains the code and no confirmation link', () => {
  const html = loginCodeEmailHtml('424242')
  if (!html.includes('424242')) throw new Error('missing code')
  if (/confirmationurl|\/auth\/v1\/verify|token_hash/i.test(html)) {
    throw new Error('must not include a magic link that email apps can prefetch')
  }
})
