import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find materials where available_at <= now() and available_at IS NOT NULL
    const { data: materialsToUnlock, error: fetchError } = await supabase
      .from("materials")
      .select("id, product_id, title")
      .not("available_at", "is", null)
      .lte("available_at", new Date().toISOString());

    if (fetchError) {
      console.error("Error fetching materials to unlock:", fetchError);
      throw fetchError;
    }

    if (!materialsToUnlock || materialsToUnlock.length === 0) {
      return new Response(
        JSON.stringify({ message: "No materials to unlock", unlocked: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${materialsToUnlock.length} materials to unlock`);

    // Unlock materials by setting available_at to null
    const materialIds = materialsToUnlock.map(m => m.id);
    const { error: updateError } = await supabase
      .from("materials")
      .update({ available_at: null })
      .in("id", materialIds);

    if (updateError) {
      console.error("Error unlocking materials:", updateError);
      throw updateError;
    }

    // Get unique product IDs and fetch product titles
    const productIds = [...new Set(materialsToUnlock.map(m => m.product_id))];
    const { data: products } = await supabase
      .from("products")
      .select("id, title")
      .in("id", productIds);

    const productTitleMap: Record<string, string> = {};
    (products || []).forEach((p: any) => { productTitleMap[p.id] = p.title; });

    // Insert into material_unlocks log table for realtime notifications
    const unlockRecords = materialsToUnlock.map(m => ({
      material_id: m.id,
      product_id: m.product_id,
      material_title: m.title,
      product_title: productTitleMap[m.product_id] || "Продукт",
    }));

    const { error: insertError } = await supabase
      .from("material_unlocks")
      .insert(unlockRecords);

    if (insertError) {
      console.error("Error inserting material_unlocks:", insertError);
    } else {
      console.log(`Inserted ${unlockRecords.length} material_unlock records`);
    }

    // Send push notifications - find tokens via user_id (not phone)
    for (const productId of productIds) {
      const materialsForProduct = materialsToUnlock.filter(m => m.product_id === productId);

      // Get all students who purchased this product
      const { data: purchases } = await supabase
        .from("simple_purchases")
        .select("simple_user_id")
        .eq("product_id", productId)
        .in("status", ["completed", "confirmed"]);

      if (!purchases || purchases.length === 0) continue;

      const studentIds = [...new Set(purchases.map(p => p.simple_user_id))];

      // Find push tokens directly by user_id - no phone dependency
      const { data: tokens } = await supabase
        .from("push_tokens")
        .select("fcm_token, user_id")
        .eq("user_role", "student")
        .in("user_id", studentIds);

      if (!tokens || tokens.length === 0) {
        console.log(`No push tokens found for product ${productId}, skipping push notifications`);
        continue;
      }

      const title = "Новый материал доступен! 📚";
      const body = materialsForProduct.length === 1
        ? `Материал "${materialsForProduct[0].title}" теперь доступен в "${productTitleMap[productId] || "продукте"}"`
        : `${materialsForProduct.length} новых материала доступны в "${productTitleMap[productId] || "продукте"}"`;

      // Send to each unique user_id
      const uniqueUserIds = [...new Set(tokens.map(t => t.user_id))];
      for (const userId of uniqueUserIds) {
        try {
          const resp = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({
              userId,
              title,
              body,
              targetRole: "student",
              data: {
                type: "material_unlocked",
                productId,
              },
            }),
          });
          const result = await resp.json();
          console.log(`Notification to userId ${userId}: status=${resp.status}`, result);
        } catch (err) {
          console.error(`Failed to send notification to userId ${userId}:`, err);
        }
      }
    }

    return new Response(
      JSON.stringify({ message: "Materials unlocked", unlocked: materialsToUnlock.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in unlock-materials:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
