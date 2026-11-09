import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CATALOG_COLUMNS } from "./session.ts";
import { json } from "./http.ts";
import { parseS3Path, presignGet } from "./s3.ts";
import { withSignedAttachmentUrls } from "./chatAttachments.ts";

// Called only AFTER moderator-api validates a moderator session. No write capability in previews.
export async function moderatorReports(
  db: SupabaseClient,
  body: Record<string, unknown>,
): Promise<Response | null> {
  const action = body.action;
  if (action === "list_reports") {
    const pageSize = 500;
    const { data, error } = await db.from("product_reports").select("*")
      .order("created_at", { ascending: false }).order("id", {
        ascending: false,
      })
      .range(0, pageSize - 1);
    if (error) return json({ error: error.message }, 500);
    const reports = [...(data ?? [])];
    let batch = data ?? [];
    // Explicit pages keep historical complaints beyond PostgREST's default row cap.
    while (batch.length === pageSize) {
      const { data: next, error: nextError } = await db.from("product_reports")
        .select("*").order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .lte("created_at", reports[0].created_at)
        .range(reports.length, reports.length + pageSize - 1);
      if (nextError) return json({ error: nextError.message }, 500);
      batch = next ?? [];
      reports.push(...batch);
    }
    const counts = new Map<string, number>();
    const productCounts = new Map<string, number>();
    // Assign a historical ordinal oldest first, including all decisions.
    for (const r of [...reports].reverse()) {
      const key = r.creator_account_id || r.seller_name || r.id;
      const count = (counts.get(key) || 0) + 1;
      counts.set(key, count);
      r.report_number = count;
      if (r.target_type === "product") {
        const productKey = r.original_product_id || r.product_id ||
          `${key}:${r.product_title}`;
        const productCount = (productCounts.get(productKey) || 0) + 1;
        productCounts.set(productKey, productCount);
        r.product_report_number = productCount;
      }
    }
    return json({ success: true, reports });
  }
  if (action === "update_report_status") {
    if (
      !["dismissed", "blocked", "correction_requested"].includes(
        String(body.status),
      )
    ) return json({ error: "Недопустимое решение" }, 400);
    const { error } = await db.rpc("moderate_report", {
      p_report_id: body.report_id,
      p_decision: body.status,
      p_correction: body.correction_text || null,
    });
    if (error) return json({ error: error.message }, 400);
    return json({ success: true });
  }
  if (action === "reporter_thread") {
    const { data: report } = await db.from("product_reports").select(
      "reporter_user_type,reporter_user_ref,reporter_name",
    ).eq("id", body.report_id).single();
    if (!report?.reporter_user_type || !report.reporter_user_ref) {
      return json({ error: "У старой жалобы нет связанного профиля" }, 400);
    }
    const { data: thread, error } = await db.from("support_threads").upsert({
      user_type: report.reporter_user_type,
      user_ref: report.reporter_user_ref,
      display_name: report.reporter_name || "Пользователь",
    }, { onConflict: "user_type,user_ref" }).select("*").single();
    if (error) return json({ error: error.message }, 500);
    return json({ success: true, thread });
  }
  if (action === "moderation_notifications") {
    const { data, error } = await db.from("moderation_notifications").select(
      "*",
    ).is("creator_account_id", null).order("created_at", { ascending: false })
      .limit(200);
    if (error) return json({ error: error.message }, 500);
    return json({ success: true, notifications: data ?? [] });
  }
  if (action === "preview_seller") {
    const { data: report } = await db.from("product_reports").select(
      "creator_account_id",
    ).eq("id", body.report_id).single();
    if (!report?.creator_account_id) {
      return json({ error: "Продавец удалён" }, 404);
    }
    const { data, error } = await db.from("products").select(
      "id,title,slug,image_url,is_active",
    ).eq("creator_account_id", report.creator_account_id).order("created_at");
    if (error) return json({ error: error.message }, 500);
    return json({ success: true, products: data ?? [] });
  }
  if (
    ["preview_public", "preview_program", "preview_contents"].includes(
      String(action),
    )
  ) {
    const { data: product, error } = await db.from("products").select(
      CATALOG_COLUMNS,
    ).eq("id", body.product_id).single();
    if (error || !product) return json({ error: "Продукт удалён" }, 404);
    if (action === "preview_public") {
      const { data: account } = await db.from("creator_accounts").select(
        "display_name,profiles(handle,avatar_url,type)",
      ).eq("id", product.creator_account_id).single();
      const profile = Array.isArray(account?.profiles)
        ? account.profiles[0]
        : account?.profiles;
      return json({
        product: {
          ...product,
          is_paused: true,
          paused_message: "Предпросмотр модератора",
          author_name: account?.display_name,
          seller_handle: profile?.handle,
          seller_avatar_url: profile?.avatar_url,
          seller_type: profile?.type,
        },
      });
    }
    const { data: materials, error: materialsError } = await db.from(
      "materials",
    ).select("*").eq("product_id", product.id).is("deleted_at", null).order(
      "order_index",
    );
    if (materialsError) return json({ error: materialsError.message }, 500);
    if (action === "preview_program") return json({ items: materials ?? [] });
    const signed = await Promise.all((materials ?? []).map(async (m) => {
      if (!m.file_url) return m;
      const s3 = parseS3Path(m.file_url);
      if (s3) {
        return { ...m, preview_url: presignGet(s3.bucket, s3.key, false, 900) };
      }
      let path = m.file_url;
      if (/^https?:/.test(path)) {
        // Sign only this project's material bucket. Never fetch arbitrary external URLs.
        const prefix = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/`;
        if (!path.startsWith(prefix)) return { ...m, preview_url: null };
        path = path.slice(prefix.length).replace(
          /^(public|sign|authenticated)\//,
          "",
        ).replace(/^materials\//, "").split("?")[0];
      }
      const { data } = await db.storage.from("materials").createSignedUrl(
        path,
        900,
      );
      return { ...m, preview_url: data?.signedUrl || null };
    }));
    const [announcements, schedules, threads] = await Promise.all([
      db.from("announcements").select("*").eq("product_id", product.id).order(
        "order_index",
      ),
      db.from("schedules").select("*,time_slots(*)").eq(
        "product_id",
        product.id,
      ),
      db.from("direct_threads").select(
        "id,buyer_profile_id,last_message_preview",
      ).eq("creator_account_id", product.creator_account_id),
    ]);
    if (announcements.error || schedules.error || threads.error) {
      return json(
        { error: "Не удалось загрузить содержимое предпросмотра" },
        500,
      );
    }
    const ids = (threads.data ?? []).map((t) => t.id);
    const { data: messages, error: messageError } = ids.length
      ? await db.from("direct_messages").select("*").in("thread_id", ids).order(
        "created_at",
        { ascending: false },
      ).limit(500)
      : { data: [], error: null };
    if (messageError) return json({ error: messageError.message }, 500);
    return json({
      success: true,
      materials: signed,
      announcements: announcements.data,
      schedules: schedules.data,
      threads: threads.data,
      messages: await withSignedAttachmentUrls(
        db,
        "direct-attachments",
        messages ?? [],
      ),
    });
  }
  return null;
}
