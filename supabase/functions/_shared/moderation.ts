import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveCaller } from "./session.ts";

export const REPORT_REASONS = [
  "Продукт не соответствует описанию",
  "Неприемлемый контент",
  "Выдаёт себя за другого человека",
  "Другое",
] as const;

export async function supportIdentity(
  db: SupabaseClient,
  body: Record<string, unknown>,
) {
  const caller = await resolveCaller(db, body);
  if (!caller) return null;
  if (caller.kind === "creator") {
    const { data, error } = await db.from("creator_accounts").select(
      "profile_id,login,display_name,is_blocked",
    ).eq("id", caller.accountId).single();
    if (error || !data?.profile_id || data.is_blocked) return null;
    return {
      profileId: data.profile_id,
      userType: "creator",
      userRef: data.login,
      displayName: data.display_name,
    };
  }
  const { data: profile } = await db.from("profiles").select(
    "id,type,display_name",
  ).eq("id", caller.userId).single();
  if (!profile) return null;
  if (profile.type === "creator" || profile.type === "school") {
    const { data } = await db.from("creator_accounts").select(
      "login,display_name,is_blocked",
    ).eq("profile_id", profile.id).single();
    if (!data || data.is_blocked) return null;
    return {
      profileId: profile.id,
      userType: "creator",
      userRef: data.login,
      displayName: data.display_name,
    };
  }
  return {
    profileId: profile.id,
    userType: caller.role === "teacher" ? "teacher" : "student",
    userRef: profile.id,
    displayName: profile.display_name || caller.name,
  };
}

async function hashSignal(value: string) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`dostup-moderation:${value}`),
  );
  return Array.from(
    new Uint8Array(hash),
    (n) => n.toString(16).padStart(2, "0"),
  ).join("");
}

/** Device identifiers are browser installation IDs, not hardware fingerprints. */
export async function checkSignals(
  db: SupabaseClient,
  req: Request,
  body: Record<string, unknown>,
  issuedToken?: string,
) {
  const device = typeof body.deviceId === "string" &&
      /^[a-zA-Z0-9-]{16,100}$/.test(body.deviceId)
    ? body.deviceId
    : null;
  // Only trust a gateway-provided IP when explicitly enabled for the deployment.
  const ipHeader = Deno.env.get("MODERATION_TRUSTED_IP_HEADER");
  const ip = ipHeader
    ? req.headers.get(ipHeader)?.split(",").pop()?.trim()
    : null;
  const { data, error } = await db.rpc("check_moderation_signals", {
    p_token: issuedToken ||
      String(body.token || body.sessionToken || body.creatorToken || ""),
    p_device_hash: device ? await hashSignal(device) : null,
    p_ip_hash: ip ? await hashSignal(ip) : null,
  });
  if (error) throw error;
  return data === true;
}
