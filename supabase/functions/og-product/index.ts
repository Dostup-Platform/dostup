import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const APP_URL = "https://dostup.lovable.app";
const DEFAULT_IMAGE =
  "https://storage.googleapis.com/gpt-engineer-file-uploads/YKkA8PHzyuUKyN7SwYoPKfgTbjI3/social-images/social-1770454720368-1200_на_700.png";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeJs(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const productId = url.searchParams.get("id");
    const teacher = url.searchParams.get("teacher");

    let redirectUrl = `${APP_URL}/product/${productId || ""}`;
    if (teacher) {
      redirectUrl += `?teacher=${encodeURIComponent(teacher)}`;
    }

    if (!productId) {
      return new Response(null, {
        status: 302,
        headers: { Location: redirectUrl, ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    let product: any = null;

    // Try by slug first
    const slugRes = await fetch(
      `${supabaseUrl}/rest/v1/products?slug=eq.${encodeURIComponent(productId)}&is_active=eq.true&select=title,headline,description,price,image_url&limit=1`,
      { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } }
    );
    const slugData = await slugRes.json();
    if (Array.isArray(slugData) && slugData.length > 0) {
      product = slugData[0];
    } else {
      // Try by id
      const idRes = await fetch(
        `${supabaseUrl}/rest/v1/products?id=eq.${encodeURIComponent(productId)}&is_active=eq.true&select=title,headline,description,price,image_url&limit=1`,
        { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } }
      );
      const idData = await idRes.json();
      if (Array.isArray(idData) && idData.length > 0) {
        product = idData[0];
      }
    }

    const title = product?.title || "Dostup";
    const description = product?.headline || product?.description || "Доступ к вашим цифровым продуктам и курсам!";
    const image = product?.image_url || DEFAULT_IMAGE;
    const price = product?.price ? `${new Intl.NumberFormat("ru-RU").format(product.price)} ₸` : "";
    const ogDescription = price ? `${description} — ${price}` : description;

    const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8"/>
  <meta property="og:type" content="product"/>
  <meta property="og:title" content="${escapeHtml(title)}"/>
  <meta property="og:description" content="${escapeHtml(ogDescription)}"/>
  <meta property="og:image" content="${escapeHtml(image)}"/>
  <meta property="og:url" content="${escapeHtml(redirectUrl)}"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${escapeHtml(title)}"/>
  <meta name="twitter:description" content="${escapeHtml(ogDescription)}"/>
  <meta name="twitter:image" content="${escapeHtml(image)}"/>
  <meta http-equiv="refresh" content="0;url=${escapeHtml(redirectUrl)}"/>
  <title>${escapeHtml(title)}</title>
</head>
<body>
  <p>Redirecting to <a href="${escapeHtml(redirectUrl)}">${escapeHtml(title)}</a>...</p>
  <script>window.location.href="${escapeJs(redirectUrl)}";</script>
</body>
</html>`;

    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300", ...corsHeaders },
    });
  } catch (err) {
    console.error("og-product error:", err);
    return new Response("Internal error", { status: 500, headers: corsHeaders });
  }
});
