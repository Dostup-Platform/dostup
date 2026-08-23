import type { TranslationKey } from "@/lib/translations";

export const OAUTH_MESSAGE_TYPE = "dostup-oauth";
export const OAUTH_CODE_MESSAGE_TYPE = "dostup-oauth-code";

export type AuthUiCode =
  | "oauth_popup_dismissed"
  | "magic_link_expired"
  | "email_code_expired"
  | "wrong_email_code"
  | "email_rate_limited"
  | "network_failure"
  | "account_type_required"
  | "auth_callback_error";

type AuthLikeError = {
  message?: string;
  code?: string;
  name?: string;
  status?: number;
} | null | undefined;

const MAGIC_LINK_CODES = new Set([
  "otp_expired",
  "flow_state_expired",
  "flow_state_not_found",
  "bad_code_verifier",
  "magic_link_expired",
  "email_link_invalid",
  "invite_not_found",
]);

const RATE_LIMIT_CODES = new Set([
  "over_email_send_rate_limit",
  "over_request_rate_limit",
  "email_rate_limited",
]);

const WRONG_CODE_CODES = new Set([
  "otp_disabled",
  "invalid_credentials",
  "invalid_grant",
  "wrong_email_code",
]);

const POPUP_CODES = new Set([
  "oauth_popup_dismissed",
  "popup_closed_by_user",
  "popup_closed",
]);

export function parseCallbackError(): string | null {
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const code =
    search.get("error_code") ||
    hash.get("error_code") ||
    search.get("error") ||
    hash.get("error") ||
    search.get("auth_error");
  if (code) return code;
  const description = (
    search.get("error_description") ||
    hash.get("error_description") ||
    ""
  ).toLowerCase();
  if (description.includes("expired") || description.includes("already been used")) {
    return "otp_expired";
  }
  return null;
}

export function classifyAuthCode(raw: string | null | undefined): AuthUiCode {
  if (!raw) return "auth_callback_error";
  const code = raw.trim().toLowerCase();
  if (POPUP_CODES.has(code) || code === "access_denied") return "oauth_popup_dismissed";
  if (MAGIC_LINK_CODES.has(code)) {
    return code.includes("expired") || code === "otp_expired" ? "email_code_expired" : "magic_link_expired";
  }
  if (code === "otp_expired") return "email_code_expired";
  if (WRONG_CODE_CODES.has(code)) return "wrong_email_code";
  if (RATE_LIMIT_CODES.has(code)) return "email_rate_limited";
  if (code === "account_type_required") return "account_type_required";
  if (code === "network_failure" || code === "failed_to_fetch") return "network_failure";
  return "auth_callback_error";
}

export function classifyAuthError(error: AuthLikeError): AuthUiCode {
  if (!error) return "auth_callback_error";
  const code = (error.code || "").toLowerCase();
  const name = (error.name || "").toLowerCase();
  const message = (error.message || "").toLowerCase();

  if (error.status === 429 || RATE_LIMIT_CODES.has(code) || message.includes("rate limit")) {
    return "email_rate_limited";
  }
  if (
    MAGIC_LINK_CODES.has(code) ||
    message.includes("expired") ||
    message.includes("already been used") ||
    message.includes("invalid or has expired")
  ) {
    return message.includes("expired") || code === "otp_expired" ? "email_code_expired" : "magic_link_expired";
  }
  if (
    WRONG_CODE_CODES.has(code) ||
    message.includes("invalid token") ||
    message.includes("token has expired or is invalid") ||
    message.includes("otp is invalid")
  ) {
    if (message.includes("expired")) return "email_code_expired";
    return "wrong_email_code";
  }
  if (
    name === "authretryablefetcherror" ||
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("network request") ||
    message.includes("offline") ||
    code === "request_timeout"
  ) {
    return "network_failure";
  }
  if (POPUP_CODES.has(code) || message.includes("popup")) {
    return "oauth_popup_dismissed";
  }
  return classifyAuthCode(code || undefined);
}

export function authErrorTranslationKey(code: string | null | undefined): TranslationKey {
  switch (classifyAuthCode(code)) {
    case "oauth_popup_dismissed":
      return "oauthPopupDismissed";
    case "magic_link_expired":
      return "magicLinkExpired";
    case "email_code_expired":
      return "emailCodeExpired";
    case "wrong_email_code":
      return "wrongEmailCode";
    case "email_rate_limited":
      return "emailRateLimited";
    case "network_failure":
      return "networkFailure";
    case "account_type_required":
      return "accountTypeRequired";
    default:
      return "authCallbackError";
  }
}

export function authErrorKeyFromUnknown(error: AuthLikeError): TranslationKey {
  return authErrorTranslationKey(classifyAuthError(error));
}
