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

    // Get unique product IDs
    const productIds = [...new Set(materialsToUnlock.map(m => m.product_id))];

    // For each product, find all students with confirmed purchases and send notifications
    for (const productId of productIds) {
      const materialsForProduct = materialsToUnlock.filter(m => m.product_id === productId);
      
      // Get product title
      const { data: product } = await supabase
        .from("products")
        .select("title")
        .eq("id", productId)
        .single();

      // Get all students who purchased this product
      const { data: purchases } = await supabase
        .from("simple_purchases")
        .select("simple_user_id")
        .eq("product_id", productId)
        .eq("status", "completed");

      if (!purchases || purchases.length === 0) continue;

      const userIds = [...new Set(purchases.map(p => p.simple_user_id))];
      
      // Get phone numbers for these users
      const { data: users } = await supabase
        .from("simple_users")
        .select("id, phone")
        .in("id", userIds);

      if (!users || users.length === 0) continue;

      // Send push notification to each student
      const materialTitles = materialsForProduct.map(m => m.title).join(", ");
      const title = "Новый материал доступен! 📚";
      const body = materialsForProduct.length === 1
        ? `Материал "${materialsForProduct[0].title}" теперь доступен в "${product?.title || "продукте"}"`
        : `${materialsForProduct.length} новых материала доступны в "${product?.title || "продукте"}"`;

      for (const user of users) {
        try {
          await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({
              userPhone: user.phone,
              title,
              body,
              targetRole: "student",
              data: {
                type: "material_unlocked",
                productId,
              },
            }),
          });
        } catch (err) {
          console.error(`Failed to send notification to ${user.phone}:`, err);
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
