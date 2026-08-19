import { supabase } from "@/integrations/supabase/client";
import { classifyAuthError, OAUTH_MESSAGE_TYPE } from "@/lib/authErrors";

export const OAUTH_ACCOUNT_TYPE_KEY = "dostup_oauth_account_type";
export const OAUTH_PROFILE_TYPE_KEY = "dostup_oauth_profile_type";
export const OAUTH_RESULT_KEY = "dostup_oauth_result";

export type CreatorAccountType = "course_creator" | "online_school";
export type ProfileType = "buyer" | "creator" | "school";

export type AppProfile = {
  id: string;
  type: ProfileType;
  displayName: string | null;
};

export type SessionPayload = {
  token: string;
  creatorName: string;
  accountType?: string | null;
  profileType: ProfileType;
  profileId: string;
  displayName?: string | null;
  createdAt?: string | null;
  profiles?: AppProfile[];
};

export type GoogleOAuthResult = {
  error: { message: string; code?: string; name?: string; status?: number } | null;
  dismissed?: boolean;
  path?: string;
};

type OAuthMessage =
  | { type: typeof OAUTH_MESSAGE_TYPE; ok: true; path: string }
  | { type: typeof OAUTH_MESSAGE_TYPE; ok: false; code: string };

export function storeCreatorSession(data: {
  token: string;
  creatorName: string;
  accountType?: string | null;
  profileType?: ProfileType | string | null;
  profileId?: string | null;
  displayName?: string | null;
  createdAt?: string | null;
  profiles?: AppProfile[];
}) {
  localStorage.setItem("creator_token", data.token);
  localStorage.setItem("creator_name", data.creatorName);
  localStorage.setItem("creator_last_name", data.creatorName);
  if (data.accountType) {
    localStorage.setItem("creator_account_type", data.accountType);
  } else {
    localStorage.removeItem("creator_account_type");
  }
  const profileType = parseProfileType(data.profileType)
    || (data.accountType === "online_school" ? "school" : data.accountType ? "creator" : "buyer");
  localStorage.setItem("profile_type", profileType);
  if (data.profileId) localStorage.setItem("profile_id", data.profileId);
  localStorage.setItem("profile_display_name", data.displayName || data.creatorName);
  localStorage.setItem("creator_created_at", data.createdAt || new Date().toISOString());
  if (data.profiles) {
    localStorage.setItem("identity_profiles", JSON.stringify(data.profiles));
  }
}

export function clearAppSession() {
  localStorage.removeItem("creator_token");
  localStorage.removeItem("creator_name");
  localStorage.removeItem("creator_account_type");
  localStorage.removeItem("creator_created_at");
  localStorage.removeItem("profile_type");
  localStorage.removeItem("profile_id");
  localStorage.removeItem("profile_display_name");
  localStorage.removeItem("identity_profiles");
  localStorage.removeItem("simple_session_token");
  localStorage.removeItem("simple_user_id");
}

export function creatorHomePath(accountType: string) {
  return accountType === "online_school" ? "/school" : "/creator";
}

export function profileHomePath(profileType: string, accountType?: string | null) {
  if (profileType === "buyer") return "/dashboard";
  if (profileType === "school" || accountType === "online_school") return "/school";
  return "/creator";
}

export function parseProfileType(value: string | null | undefined): ProfileType | null {
  if (value === "buyer" || value === "creator" || value === "school") return value;
  if (value === "online_school") return "school";
  if (value === "course_creator") return "creator";
  return null;
}

function parseAccountType(value: string | null | undefined): CreatorAccountType | null {
  if (value === "online_school") return "online_school";
  if (value === "course_creator" || value === "creator") return "course_creator";
  return null;
}

export function rememberOAuthAccountType(accountType?: CreatorAccountType) {
  rememberOAuthProfileType(
    accountType === "online_school" ? "school" : accountType === "course_creator" ? "creator" : undefined,
  );
}

export function rememberOAuthProfileType(profileType?: ProfileType) {
  try {
    if (profileType) {
      localStorage.setItem(OAUTH_PROFILE_TYPE_KEY, profileType);
      sessionStorage.setItem(OAUTH_PROFILE_TYPE_KEY, profileType);
      const accountType = profileType === "school" ? "online_school" : profileType === "creator" ? "course_creator" : "";
      if (accountType) {
        localStorage.setItem(OAUTH_ACCOUNT_TYPE_KEY, accountType);
        sessionStorage.setItem(OAUTH_ACCOUNT_TYPE_KEY, accountType);
      } else {
        localStorage.removeItem(OAUTH_ACCOUNT_TYPE_KEY);
        sessionStorage.removeItem(OAUTH_ACCOUNT_TYPE_KEY);
      }
    } else {
      localStorage.removeItem(OAUTH_PROFILE_TYPE_KEY);
      sessionStorage.removeItem(OAUTH_PROFILE_TYPE_KEY);
      localStorage.removeItem(OAUTH_ACCOUNT_TYPE_KEY);
      sessionStorage.removeItem(OAUTH_ACCOUNT_TYPE_KEY);
    }
  } catch {
    // private mode
  }
}

export function readOAuthAccountType(): CreatorAccountType | null {
  try {
    return parseAccountType(
      localStorage.getItem(OAUTH_ACCOUNT_TYPE_KEY) || sessionStorage.getItem(OAUTH_ACCOUNT_TYPE_KEY),
    );
  } catch {
    return null;
  }
}

export function readOAuthProfileType(): ProfileType | null {
  try {
    return parseProfileType(
      localStorage.getItem(OAUTH_PROFILE_TYPE_KEY)
        || sessionStorage.getItem(OAUTH_PROFILE_TYPE_KEY)
        || readOAuthAccountType(),
    );
  } catch {
    return null;
  }
}

export function clearOAuthAccountType() {
  rememberOAuthProfileType(undefined);
}

export function writeOAuthResult(result: GoogleOAuthResult) {
  try {
    localStorage.setItem(OAUTH_RESULT_KEY, JSON.stringify(result));
  } catch {
    // private mode
  }
}

export function readOAuthResult(): GoogleOAuthResult | null {
  try {
    const raw = localStorage.getItem(OAUTH_RESULT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GoogleOAuthResult;
  } catch {
    return null;
  }
}

export function clearOAuthResult() {
  try {
    localStorage.removeItem(OAUTH_RESULT_KEY);
  } catch {
    // private mode
  }
}

export function authCallbackUrl(profileType?: ProfileType) {
  const url = new URL(`${window.location.origin}/auth/callback`);
  if (profileType && profileType !== "buyer") url.searchParams.set("profile_type", profileType);
  return url.toString();
}

function resultFromMessage(data: OAuthMessage): GoogleOAuthResult {
  if (data.ok) return { error: null, path: data.path };
  return {
    error: { message: data.code, code: data.code },
    dismissed: data.code === "oauth_popup_dismissed",
  };
}

function waitForOAuthPopup(popup: Window): Promise<GoogleOAuthResult> {
  return new Promise((resolve) => {
    let settled = false;
    const origin = window.location.origin;

    const finish = (result: GoogleOAuthResult) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      window.removeEventListener("storage", onStorage);
      window.clearInterval(timer);
      clearOAuthResult();
      resolve(result);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin) return;
      const data = event.data as OAuthMessage | null;
      if (!data || data.type !== OAUTH_MESSAGE_TYPE) return;
      finish(resultFromMessage(data));
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key !== OAUTH_RESULT_KEY || !event.newValue) return;
      try {
        finish(JSON.parse(event.newValue) as GoogleOAuthResult);
      } catch {
        // ignore malformed
      }
    };

    const timer = window.setInterval(() => {
      const stored = readOAuthResult();
      if (stored) {
        finish(stored);
        return;
      }
      const token = localStorage.getItem("creator_token");
      const profileType = localStorage.getItem("profile_type");
      const accountType = localStorage.getItem("creator_account_type");
      if (token && (profileType || localStorage.getItem("creator_name"))) {
        finish({ error: null, path: profileHomePath(profileType || "", accountType) });
        return;
      }
      if (!popup.closed) return;
      window.clearInterval(timer);
      window.setTimeout(() => {
        const late = readOAuthResult();
        if (late) {
          finish(late);
          return;
        }
        finish({
          error: { message: "oauth_popup_dismissed", code: "oauth_popup_dismissed" },
          dismissed: true,
        });
      }, 400);
    }, 400);

    window.addEventListener("message", onMessage);
    window.addEventListener("storage", onStorage);
  });
}

export async function startGoogleOAuth(profileType?: ProfileType): Promise<GoogleOAuthResult> {
  rememberOAuthProfileType(profileType);
  clearOAuthResult();
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: authCallbackUrl(profileType),
        skipBrowserRedirect: true,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      return { error: { message: error.message, code: error.code, name: error.name, status: error.status } };
    }
    if (!data.url) {
      return { error: { message: "oauth_url_missing", code: "auth_callback_error" } };
    }

    const popup = window.open(
      data.url,
      "dostup-google-oauth",
      "width=500,height=700,scrollbars=yes,resizable=yes",
    );
    if (!popup || popup.closed) {
      window.location.assign(data.url);
      return { error: null };
    }

    return waitForOAuthPopup(popup);
  } catch (err) {
    const message = err instanceof Error ? err.message : "network_failure";
    return {
      error: {
        message,
        code: classifyAuthError({ message, name: err instanceof Error ? err.name : undefined }),
        name: err instanceof Error ? err.name : undefined,
      },
    };
  }
}

export async function sendEmailCode(email: string, profileType?: ProfileType) {
  rememberOAuthProfileType(profileType);
  const address = email.trim().toLowerCase();
  try {
    const { data, error } = await supabase.functions.invoke("send-email-code", {
      body: { email: address },
    });
    if (error || (data && typeof data === "object" && "error" in data && data.error)) {
      const message =
        (data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error
          : error?.message) || "network_failure";
      return {
        data: { user: null, session: null },
        error: {
          message,
          code: classifyAuthError({ message, status: error?.status }),
          name: error?.name,
          status: error?.status,
        },
      };
    }
    return { data: { user: null, session: null }, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "network_failure";
    return {
      data: { user: null, session: null },
      error: {
        message,
        code: classifyAuthError({ message, name: err instanceof Error ? err.name : undefined }),
        name: err instanceof Error ? err.name : "AuthRetryableFetchError",
      },
    };
  }
}

export async function verifyEmailCode(email: string, token: string) {
  const address = email.trim().toLowerCase();
  const first = await supabase.auth.verifyOtp({
    email: address,
    token,
    type: "email",
  });
  if (!first.error && first.data.session) return first;

  const second = await supabase.auth.verifyOtp({
    email: address,
    token,
    type: "signup",
  });
  if (!second.error && second.data.session) return second;
  return first.error ? first : second;
}

export async function exchangeAuthSession(accessToken: string, profileType?: ProfileType) {
  return supabase.functions.invoke("exchange-auth-session", {
    body: {
      access_token: accessToken,
      profileType: profileType ?? undefined,
    },
  });
}

export function sendCreatorMagicLink(email: string, accountType?: CreatorAccountType) {
  return sendEmailCode(
    email,
    accountType === "online_school" ? "school" : accountType === "course_creator" ? "creator" : undefined,
  );
}

export function notifyOAuthOpener(payload: OAuthMessage) {
  const opener = window.opener as Window | null;
  if (!opener || opener.closed) return false;
  opener.postMessage(payload, window.location.origin);
  window.close();
  return true;
}
