import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const APP_URL = "https://dostup.lovable.app";
const DEFAULT_IMAGE =
  "https://storage.googleapis.com/gpt-engineer-file-uploads/YKkA8PHzyuUKyN7SwYoPKfgTbjI3/social-images/social-1770454720368-1200_на_700.png";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const productId = url.searchParams.get("id");
  const teacher = url.searchParams.get("teacher");

  // Build redirect URL
  let redirectUrl = `${APP_URL}/product/${productId || ""}`;
  if (teacher) {
    redirectUrl += `?teacher=${encodeURIComponent(teacher)}`;
  }

  // If no product id, redirect to app
  if (!productId) {
    return new Response(null, {
      status: 302,
      headers: { Location: redirectUrl, ...corsHeaders },
    });
  }

  // Fetch product from DB
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let product: any = null;

  // Try slug first, then id
  const { data: bySlug } = await supabase
    .from("products")
    .select("title, headline, description, price, image_url")
    .eq("slug", productId)
    .eq("is_active", true)
    .maybeSingle();

  if (bySlug) {
    product = bySlug;
  } else {
    const { data: byId } = await supabase
      .from("products")
      .select("title, headline, description, price, image_url")
      .eq("id", productId)
      .eq("is_active", true)
      .maybeSingle();
    product = byId;
  }

  const title = product?.title || "Dostup";
  const description =
    product?.headline ||
    product?.description ||
    "Доступ к вашим цифровым продуктам и курсам!";
  const image = product?.image_url || DEFAULT_IMAGE;
  const price = product?.price
    ? `${new Intl.NumberFormat("ru-RU").format(product.price)} ₸`
    : "";
  const ogDescription = price
    ? `${description} — ${price}`
    : description;

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
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      ...corsHeaders,
    },
  });
});

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
