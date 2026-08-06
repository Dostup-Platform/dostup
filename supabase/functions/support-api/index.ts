import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const body = await req.json().catch(() => ({}))
    const { action, user_type, user_ref, display_name } = body as any

    if (!['creator', 'teacher', 'student'].includes(user_type)) return json({ error: 'Bad user_type' }, 400)
    if (typeof user_ref !== 'string' || !user_ref.trim()) return json({ error: 'Bad user_ref' }, 400)

    // get or create thread
    let { data: thread } = await supabase.from('support_threads').select('*').eq('user_type', user_type).eq('user_ref', user_ref).maybeSingle()
    if (!thread) {
      const { data: created, error } = await supabase.from('support_threads').insert({
        user_type, user_ref, display_name: display_name || user_ref,
      }).select().single()
      if (error) return json({ error: error.message }, 500)
      thread = created
    }

    if (action === 'get_thread') {
      const { data: messages } = await supabase.from('support_messages').select('*').eq('thread_id', thread.id).order('created_at', { ascending: true })
      if ((thread.unread_for_user ?? 0) > 0) {
        await supabase.from('support_threads').update({ unread_for_user: 0 }).eq('id', thread.id)
        await supabase.from('support_messages').update({ read_at: new Date().toISOString() }).eq('thread_id', thread.id).eq('sender', 'moderator').is('read_at', null)
      }
      return json({ success: true, thread, messages: messages ?? [] })
    }

    if (action === 'send_message') {
      const { text } = body as any
      if (typeof text !== 'string' || !text.trim() || text.length > 4000) return json({ error: 'Bad text' }, 400)
      const { error } = await supabase.from('support_messages').insert({ thread_id: thread.id, sender: 'user', text: text.trim() })
      if (error) return json({ error: error.message }, 500)
      await supabase.from('support_threads').update({
        last_message_at: new Date().toISOString(),
        last_message_preview: text.trim().slice(0, 200),
        unread_for_moderator: (thread.unread_for_moderator ?? 0) + 1,
      }).eq('id', thread.id)
      return json({ success: true })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})