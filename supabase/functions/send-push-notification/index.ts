import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cache for access token
let cachedAccessToken: { token: string; expiresAt: number } | null = null;

/**
 * Get Google OAuth2 access token for FCM v1 API
 */
async function getAccessToken(): Promise<string> {
  // Check if we have a valid cached token
  if (cachedAccessToken && Date.now() < cachedAccessToken.expiresAt - 60000) {
    return cachedAccessToken.token;
  }

  const clientEmail = Deno.env.get("FCM_CLIENT_EMAIL");
  const privateKey = Deno.env.get("FCM_PRIVATE_KEY");

  if (!clientEmail || !privateKey) {
    throw new Error("FCM credentials not configured");
  }

  // Parse the private key (handle escaped newlines)
  const parsedPrivateKey = privateKey.replace(/\\n/g, "\n");

  // Create JWT header and claim
  const header = {
    alg: "RS256",
    typ: "JWT"
  };

  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  };

  // Base64url encode
  const base64urlEncode = (obj: object) => {
    const str = JSON.stringify(obj);
    const base64 = btoa(str);
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };

  const headerEncoded = base64urlEncode(header);
  const claimEncoded = base64urlEncode(claim);
  const signatureInput = `${headerEncoded}.${claimEncoded}`;

  // Sign with RS256
  const encoder = new TextEncoder();
  const signatureInputBytes = encoder.encode(signatureInput);

  // Import private key
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = parsedPrivateKey
    .replace(pemHeader, "")
    .replace(pemFooter, "")
    .replace(/\s/g, "");
  
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    signatureInputBytes
  );

  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const jwt = `${signatureInput}.${signatureBase64}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error("Token exchange failed:", errorText);
    throw new Error(`Failed to get access token: ${tokenResponse.status}`);
  }

  const tokenData = await tokenResponse.json();
  
  // Cache the token
  cachedAccessToken = {
    token: tokenData.access_token,
    expiresAt: Date.now() + (tokenData.expires_in * 1000)
  };

  return tokenData.access_token;
}

/**
 * Send FCM notification to a device
 */
async function sendFCMNotification(
  fcmToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  const projectId = Deno.env.get("FCM_PROJECT_ID");
  if (!projectId) {
    return { success: false, error: "FCM project ID not configured" };
  }

  try {
    const accessToken = await getAccessToken();

    const message = {
      message: {
        token: fcmToken,
        notification: {
          title,
          body
        },
        data: data || {},
        webpush: {
          notification: {
            icon: "/icon-192.png",
            badge: "/icon-192.png",
            vibrate: [200, 100, 200],
            requireInteraction: true
          },
          fcm_options: {
            link: "/"
          }
        }
      }
    };

    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(message)
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("FCM send error:", errorData);
      
      // Check for invalid token errors
      if (
        errorData.error?.code === 404 ||
        errorData.error?.details?.some((d: any) => 
          d.errorCode === "UNREGISTERED" || d.errorCode === "INVALID_ARGUMENT"
        )
      ) {
        return { success: false, error: "INVALID_TOKEN" };
      }
      
      return { success: false, error: errorData.error?.message || "FCM send failed" };
    }

    const result = await response.json();
    console.log("FCM send success:", result.name);
    return { success: true };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("FCM send exception:", error);
    return { success: false, error: errorMessage };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userPhone, title, body, data } = await req.json();

    if (!userPhone || !title || !body) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: userPhone, title, body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Sending push notification to ${userPhone}: ${title}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all FCM tokens for this user
    const { data: tokens, error: tokensError } = await supabase
      .from("push_tokens")
      .select("id, fcm_token")
      .eq("user_phone", userPhone);

    if (tokensError) {
      console.error("Error fetching tokens:", tokensError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch tokens" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!tokens || tokens.length === 0) {
      console.log(`No push tokens found for user: ${userPhone}`);
      return new Response(
        JSON.stringify({ message: "No tokens registered", sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${tokens.length} tokens for user ${userPhone}`);

    // Send to all registered devices
    const results = await Promise.all(
      tokens.map(async (tokenRecord) => {
        const result = await sendFCMNotification(
          tokenRecord.fcm_token,
          title,
          body,
          data
        );

        // Remove invalid tokens
        if (!result.success && result.error === "INVALID_TOKEN") {
          console.log(`Removing invalid token: ${tokenRecord.id}`);
          await supabase
            .from("push_tokens")
            .delete()
            .eq("id", tokenRecord.id);
        }

        return result;
      })
    );

    const successCount = results.filter(r => r.success).length;
    console.log(`Push notifications sent: ${successCount}/${tokens.length}`);

    return new Response(
      JSON.stringify({ 
        message: "Notifications processed",
        sent: successCount,
        total: tokens.length
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-push-notification:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
