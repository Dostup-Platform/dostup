export function hasTransactionalEmail(): boolean {
  return Boolean(Deno.env.get('RESEND_API_KEY'))
}

export async function sendTransactionalEmail(input: {
  to: string
  subject: string
  html: string
}): Promise<boolean> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('RESEND_FROM') || 'Dostup <onboarding@resend.dev>'
  if (!apiKey) {
    console.warn('RESEND_API_KEY not configured; email skipped for', input.to)
    return false
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error('Resend error', res.status, body)
    return false
  }
  return true
}

export function appBaseUrl(): string {
  return Deno.env.get('APP_URL') || 'https://trydostup.online'
}
