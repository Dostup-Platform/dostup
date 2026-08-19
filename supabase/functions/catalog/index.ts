import { json, optionsResponse } from '../_shared/http.ts'
import { CATALOG_COLUMNS, serviceClient } from '../_shared/session.ts'

type CatalogRow = Record<string, unknown> & {
  creator_account_id?: string | null
}

async function withAuthors(
  supabase: ReturnType<typeof serviceClient>,
  rows: CatalogRow[],
) {
  const ids = [...new Set(
    rows
      .map((row) => row.creator_account_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  )]
  const nameById = new Map<string, string>()
  if (ids.length) {
    const { data: accounts } = await supabase
      .from('creator_accounts')
      .select('id, display_name')
      .in('id', ids)
    for (const account of accounts ?? []) {
      if (account.id && account.display_name) {
        nameById.set(account.id, account.display_name)
      }
    }
  }
  return rows.map((row) => ({
    ...row,
    author_name: (row.creator_account_id && nameById.get(row.creator_account_id)) || null,
  }))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()

  try {
    const body = await req.json().catch(() => ({}))
    const action = typeof body.action === 'string' ? body.action : 'get_product'
    const supabase = serviceClient()

    if (action === 'list_products') {
      const { data, error } = await supabase
        .from('products')
        .select(CATALOG_COLUMNS)
        .eq('is_active', true)
        .eq('is_paused', false)
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) return json({ error: error.message }, 500)
      const products = await withAuthors(supabase, (data ?? []) as CatalogRow[])
      return json({ products })
    }

    if (action === 'get_product') {
      const idOrSlug = String(body.idOrSlug || body.productId || '').trim()
      if (!idOrSlug) return json({ error: 'Missing product' }, 400)

      let { data } = await supabase
        .from('products')
        .select(CATALOG_COLUMNS)
        .eq('slug', idOrSlug)
        .eq('is_active', true)
        .maybeSingle()

      if (!data) {
        const result = await supabase
          .from('products')
          .select(CATALOG_COLUMNS)
          .eq('id', idOrSlug)
          .eq('is_active', true)
          .maybeSingle()
        data = result.data
      }

      if (!data) return json({ product: null })
      const [product] = await withAuthors(supabase, [data as CatalogRow])
      return json({ product })
    }

    if (action === 'list_program') {
      const productId = String(body.productId || body.idOrSlug || '').trim()
      if (!productId) return json({ items: [] })

      const { data: product } = await supabase
        .from('products')
        .select('id')
        .eq('id', productId)
        .eq('is_active', true)
        .maybeSingle()
      if (!product) return json({ items: [] })

      const { data, error } = await supabase
        .from('materials')
        .select('id, title, type, parent_id, order_index')
        .eq('product_id', productId)
        .is('teacher_id', null)
        .is('deleted_at', null)
        .order('order_index', { ascending: true })
        .limit(500)
      if (error) return json({ error: error.message }, 500)
      return json({ items: data ?? [] })
    }

    if (action === 'list_teachers') {
      const productId = String(body.productId || '').trim()
      if (!productId) return json({ error: 'Missing productId' }, 400)
      const { data: product } = await supabase
        .from('products')
        .select('id')
        .eq('id', productId)
        .eq('is_active', true)
        .maybeSingle()
      if (!product) return json({ teachers: [] })
      const { data } = await supabase
        .from('product_teachers')
        .select('*')
        .eq('product_id', productId)
        .order('created_at')
      return json({ teachers: data ?? [] })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (e) {
    console.error('catalog error', e)
    return json({ error: 'Internal error' }, 500)
  }
})
