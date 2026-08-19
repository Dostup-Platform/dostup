import { supabase } from "@/integrations/supabase/client";

const SESSION_STORAGE_KEY = "simple_session_token";

/**
 * Request a one-time access token for a material file.
 * Authorization is resolved server-side from the creator or student session.
 */
export async function requestMaterialToken(
  path: string,
  role: "student" | "teacher" | "creator",
): Promise<string> {
  const body: Record<string, string> = { path };

  if (role === "creator") {
    const creatorToken = localStorage.getItem("creator_token") || "";
    const creatorName = localStorage.getItem("creator_name") || "";
    body.creatorToken = creatorToken;
    body.creatorName = creatorName;
  } else {
    const sessionToken = localStorage.getItem(SESSION_STORAGE_KEY) || "";
    body.sessionToken = sessionToken;
  }

  const { data, error } = await supabase.functions.invoke("create-material-token", {
    body,
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.token;
}

/**
 * Build a proxy URL with a one-time token for Office Viewer.
 */
export function buildProxyUrl(token: string): string {
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxy-material?token=${encodeURIComponent(token)}`;
}
