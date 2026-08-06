import { supabase } from "@/integrations/supabase/client";

/**
 * Request a one-time access token for a material file.
 * The token is verified server-side against purchases/roles.
 */
export async function requestMaterialToken(
  path: string,
  role: 'student' | 'teacher' | 'creator',
  userId?: string
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('create-material-token', {
    body: { userId, path, role },
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
