import { json, optionsResponse } from '../_shared/http.ts'
import {
  CHECKOUT_COLUMNS,
  resolveUser,
  serviceClient,
  unauthorized,
} from '../_shared/session.ts'
import { latestSubmissionForPurchase } from '../_shared/purchase.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()

  try {
    const body = await req.json().catch(() => ({}))
    const action = typeof body.action === 'string' ? body.action : 'get_product'
    const supabase = serviceClient()

    if (action === 'get_product') {
      const idOrSlug = String(body.idOrSlug || body.productId || '').trim()
      if (!idOrSlug) return json({ error: 'Missing product' }, 400)

      let { data } = await supabase
        .from('products')
        .select(CHECKOUT_COLUMNS)
        .eq('slug', idOrSlug)
        .eq('is_active', true)
        .maybeSingle()

      if (!data) {
        const result = await supabase
          .from('products')
          .select(CHECKOUT_COLUMNS)
          .eq('id', idOrSlug)
          .eq('is_active', true)
          .maybeSingle()
        data = result.data
      }

      if (data?.is_paused) {
        const { kaspi_link: _l, kaspi_phone: _p, ...rest } = data as Record<string, unknown>
        return json({ product: { ...rest, kaspi_link: null, kaspi_phone: null } })
      }

      return json({ product: data })
    }

    if (action === 'lookup_teacher') {
      const productId = String(body.productId || '').trim()
      const teacherName = String(body.teacherName || '').trim()
      if (!productId || !teacherName) return json({ teacherId: null })

      const { data: assigned } = await supabase
        .from('product_teachers')
        .select('teacher_name')
        .eq('product_id', productId)
        .ilike('teacher_name', teacherName)
        .maybeSingle()
      if (!assigned) return json({ teacherId: null })

      const { data: user } = await supabase
        .from('simple_users')
        .select('id')
        .ilike('name', teacherName)
        .eq('role', 'teacher')
        .maybeSingle()
      return json({ teacherId: user?.id ?? null })
    }

    const user = await resolveUser(supabase, String(body.sessionToken || ''))
    if (!user) return unauthorized()

    if (action === 'set_role') {
      const role = body.role === 'creator' ? 'creator' : 'student'
      const { error } = await supabase.from('simple_users').update({ role }).eq('id', user.userId)
      if (error) return json({ error: error.message }, 500)
      return json({ ok: true, role })
    }

    if (action === 'list_my_purchases') {
      const { data, error } = await supabase
        .from('simple_purchases')
        .select('id, product_id, status, amount, created_at, can_choose_teacher, assigned_teacher_id')
        .eq('buyer_profile_id', user.userId)
        .eq('status', body.status || 'completed')
      if (error) return json({ error: error.message }, 500)
      if (!data?.length) return json({ purchases: [] })
      const productIds = data.map((p: { product_id: string }) => p.product_id)
      const { data: products } = await supabase
        .from('products')
        .select('id, title, headline, telegram_link, group_link_label')
        .in('id', productIds)
      return json({
        purchases: data.map((purchase: { product_id: string }) => ({
          ...purchase,
          product: products?.find((p: { id: string }) => p.id === purchase.product_id) || null,
        })),
      })
    }

    if (action === 'get_my_purchase') {
      const productId = String(body.productId || '').trim()
      if (!productId) return json({ error: 'Missing productId' }, 400)
      let { data } = await supabase
        .from('simple_purchases')
        .select('*')
        .eq('buyer_profile_id', user.userId)
        .eq('product_id', productId)
        .maybeSingle()
      if (!data) {
        const fallback = await supabase
          .from('simple_purchases')
          .select('*')
          .eq('simple_user_id', user.userId)
          .eq('product_id', productId)
          .maybeSingle()
        data = fallback.data
      }
      if (!data) return json({ purchase: null })
      const submission = await latestSubmissionForPurchase(supabase, data.id)
      return json({ purchase: { ...data, latest_submission: submission } })
    }

    if (action === 'create_purchase') {
      const productId = String(body.productId || '').trim()
      if (!productId) return json({ error: 'Missing productId' }, 400)

      const { data: product } = await supabase
        .from('products')
        .select('id, price, is_active, is_paused')
        .eq('id', productId)
        .maybeSingle()
      if (!product || !product.is_active || product.is_paused) {
        return json({ error: 'Product unavailable' }, 400)
      }

      const { data: existing } = await supabase
        .from('simple_purchases')
        .select('id, status')
        .eq('buyer_profile_id', user.userId)
        .eq('product_id', productId)
        .maybeSingle()
      if (existing) return json({ purchase: existing })

      const insertData: Record<string, unknown> = {
        buyer_profile_id: user.userId,
        product_id: productId,
        amount: product.price || 0,
        status: 'pending',
      }
      if (typeof body.assignedTeacherId === 'string' && body.assignedTeacherId) {
        insertData.assigned_teacher_id = body.assignedTeacherId
      }
      if (body.canChooseTeacher === true) insertData.can_choose_teacher = true

      const { data, error } = await supabase
        .from('simple_purchases')
        .insert(insertData)
        .select()
        .single()
      if (error) return json({ error: error.message }, 500)
      return json({ purchase: data })
    }

    if (action === 'cancel_pending') {
      const purchaseId = String(body.purchaseId || '').trim()
      if (!purchaseId) return json({ error: 'Missing purchaseId' }, 400)
      const { error } = await supabase
        .from('simple_purchases')
        .delete()
        .eq('id', purchaseId)
        .eq('buyer_profile_id', user.userId)
        .eq('status', 'pending')
      if (error) return json({ error: error.message }, 500)
      return json({ ok: true })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (e) {
    console.error('checkout error', e)
    return json({ error: 'Internal error' }, 500)
  }
})
