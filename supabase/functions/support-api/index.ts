import { supportIdentity, REPORT_REASONS, checkSignals } from '../_shared/moderation.ts'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ATTACHMENT_LABEL, sanitizeChatAttachments, withSignedAttachmentUrls } from '../_shared/chatAttachments.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

async function notifyModerators(title: string, bodyText: string, data?: Record<string, string>) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) return
    await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        targetRole: 'moderator',
        title,
        body: bodyText,
        data: data || {},
      }),
    })
  } catch (err) {
    console.error('Error sending moderator push notification:', err)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const body = await req.json().catch(() => ({}))
    const { action } = body as any

    if (!(await checkSignals(supabase, req, body))) return json({ error: 'Аккаунт заблокирован' }, 403)
    if (action === 'report_product' || action === 'report_account') {
      const who = await supportIdentity(supabase, body)
      if (!who) return json({ error: 'Войдите в аккаунт, чтобы подать жалобу' }, 401)
      const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
      const description = typeof body.description === 'string' ? body.description.trim() : ''
      if (!REPORT_REASONS.includes(reason as typeof REPORT_REASONS[number]) || description.length > 4000 || (reason === 'Другое' && !description)) {
        return json({ error: 'Выберите причину. Для «Другое» обязателен комментарий (до 4000 символов).' }, 400)
      }
      let sellerId = null
      if (action === 'report_account') {
        const { data: profile } = await supabase.from('profiles').select('id').eq('handle', String(body.seller_handle || '')).maybeSingle()
        const { data: seller } = profile ? await supabase.from('creator_accounts').select('id').eq('profile_id', profile.id).maybeSingle() : { data: null }
        if (!seller) return json({ error: 'Продавец не найден' }, 404)
        sellerId = seller.id
      }
      const { data: report, error } = await supabase.from('product_reports').insert({
        product_id: action === 'report_product' ? body.product_id : null,
        creator_account_id: sellerId,
        target_type: action === 'report_product' ? 'product' : 'account',
        reporter_profile_id: who.profileId,
        reporter_user_type: who.userType,
        reporter_user_ref: who.userRef,
        reporter_name: who.displayName,
        reason, description: description || null,
      }).select('id').single()
      if (error) return json({ error: error.message }, 400)
      await notifyModerators('Новая жалоба', `Причина: ${reason}`, { type: 'moderator_report', reportId: report.id })
      return json({ success: true, report_id: report.id })
    }

    // Handle new topic suggestion notification
    if (action === 'notify_new_topic') {
      const { topic_name, creator_name } = body as any
      if (!topic_name) return json({ error: 'topic_name required' }, 400)
      const who = creator_name ? ` от ${creator_name}` : ''
      await notifyModerators(
        'Предложена новая тема',
        `Тема: «${topic_name}»${who}`,
        { type: 'moderator_topic', title: topic_name }
      )
      return json({ success: true })
    }

    // Support chat handling
    const identity = await supportIdentity(supabase, body)
    if (!identity) return json({ error: 'Unauthorized' }, 401)
    const { userType: user_type, userRef: user_ref, displayName: display_name } = identity
    if (!['creator', 'teacher', 'student'].includes(user_type)) return json({ error: 'Bad user_type' }, 400)
    if (typeof user_ref !== 'string' || !user_ref.trim()) return json({ error: 'Bad user_ref' }, 400)

    // get or create thread
    let { data: thread } = await supabase.from('support_threads').select('*').eq('user_type', user_type).eq('user_ref', user_ref).maybeSingle()

    // Header badge: the tables are closed to the browser, so the count comes from here. No thread yet means nothing unread.
    if (action === 'unread') return json({ success: true, unread: Number(thread?.unread_for_user ?? 0) })

    if (!thread) {
      const { data: created, error } = await supabase.from('support_threads').insert({
        user_type, user_ref, display_name: display_name || user_ref,
      }).select().single()
      if (error) return json({ error: error.message }, 500)
      thread = created
    }

    if (action === 'get_thread') {
      const { data: rows } = await supabase.from('support_messages').select('*').eq('thread_id', thread.id).order('created_at', { ascending: true })
      const messages = await withSignedAttachmentUrls(supabase, 'support-attachments', rows ?? [])
      if ((thread.unread_for_user ?? 0) > 0) {
        await supabase.from('support_threads').update({ unread_for_user: 0 }).eq('id', thread.id)
        await supabase.from('support_messages').update({ read_at: new Date().toISOString() }).eq('thread_id', thread.id).eq('sender', 'moderator').is('read_at', null)
      }
      return json({ success: true, thread, messages })
    }

    if (action === 'send_message') {
      const { text, attachments } = body as any
      const clean = typeof text === 'string' ? text.trim() : ''
      if (clean.length > 4000) return json({ error: 'Bad text' }, 400)
      const files = sanitizeChatAttachments(attachments, thread.id, 'support')
      if (files === null) return json({ error: 'Bad attachments' }, 400)
      if (!clean && !files.length) return json({ error: 'Bad text' }, 400)

      const { error } = await supabase.from('support_messages').insert({
        thread_id: thread.id,
        sender: 'user',
        text: clean,
        attachments: files,
      })
      if (error) return json({ error: error.message }, 500)

      const preview = clean || files.map((f) => ATTACHMENT_LABEL[f.kind]).join(', ')
      await supabase.from('support_threads').update({
        last_message_at: new Date().toISOString(),
        last_message_preview: preview.slice(0, 200),
        unread_for_moderator: (thread.unread_for_moderator ?? 0) + 1,
      }).eq('id', thread.id)

      const senderName = display_name || thread.display_name || user_ref || 'Пользователь'
      await notifyModerators(
        `Новое сообщение: ${senderName}`,
        preview.slice(0, 120),
        { type: 'moderator_support', threadId: thread.id }
      )

      return json({ success: true })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})