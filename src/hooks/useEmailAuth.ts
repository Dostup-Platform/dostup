import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { authErrorKeyFromUnknown } from "@/lib/authErrors";
import {
  exchangeAuthSession,
  parseProfileType,
  profileHomePath,
  sendEmailCode,
  startGoogleOAuth,
  storeCreatorSession,
  verifyEmailCode,
  type ProfileType,
  type SessionPayload,
} from "@/lib/creatorAuth";
import { supabase } from "@/integrations/supabase/client";

function asSession(data: Record<string, unknown> | null): SessionPayload | null {
  if (!data?.success || typeof data.token !== "string" || typeof data.profileType !== "string") {
    return null;
  }
  const profileType = parseProfileType(String(data.profileType));
  if (!profileType) return null;
  return {
    token: data.token,
    creatorName: String(data.creatorName || ""),
    accountType: typeof data.accountType === "string" ? data.accountType : null,
    profileType,
    profileId: String(data.profileId || ""),
    displayName: typeof data.displayName === "string" ? data.displayName : null,
    profiles: Array.isArray(data.profiles) ? data.profiles as SessionPayload["profiles"] : [],
  };
}

export function useEmailAuth(profileType?: ProfileType) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [email, setEmail] = useState("");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const submitting = useRef(false);

  const applySession = (session: SessionPayload) => {
    storeCreatorSession(session);
    navigate(profileHomePath(session.profileType, session.accountType), { replace: true });
  };

  const exchange = async (accessToken: string) => {
    const { data, error } = await exchangeAuthSession(accessToken, profileType);
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // app session is what we keep
    }
    const session = asSession((data ?? null) as Record<string, unknown> | null);
    if (error || !session) {
      toast.error(t(authErrorKeyFromUnknown(error || { message: String((data as { error?: string } | null)?.error) })));
      return false;
    }
    applySession(session);
    return true;
  };

  const sendCode = async (address: string) => {
    const trimmed = address.trim().toLowerCase();
    if (!trimmed.includes("@") || trimmed.length < 3) {
      toast.error(t("invalidEmail"));
      return false;
    }
    setSending(true);
    const { error } = await sendEmailCode(trimmed, profileType);
    setSending(false);
    if (error) {
      toast.error(t(authErrorKeyFromUnknown(error)));
      return false;
    }
    setPendingEmail(trimmed);
    return true;
  };

  const verifyCode = async (token: string) => {
    if (!pendingEmail || submitting.current) return false;
    submitting.current = true;
    setVerifying(true);
    try {
      const { data, error } = await verifyEmailCode(pendingEmail, token);
      if (error || !data.session?.access_token) {
        toast.error(t(authErrorKeyFromUnknown(error || { message: "wrong_email_code", code: "wrong_email_code" })));
        return false;
      }
      return await exchange(data.session.access_token);
    } catch {
      toast.error(t("networkFailure"));
      return false;
    } finally {
      submitting.current = false;
      setVerifying(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const result = await startGoogleOAuth(profileType);
    if (result.path) {
      navigate(result.path, { replace: true });
      return;
    }
    if (result.dismissed) {
      toast.error(t("oauthPopupDismissed"));
    } else if (result.error) {
      toast.error(t(authErrorKeyFromUnknown(result.error)));
    }
    setGoogleLoading(false);
  };

  return {
    email,
    setEmail,
    pendingEmail,
    setPendingEmail,
    googleLoading,
    sending,
    verifying,
    busy: googleLoading || sending || verifying,
    sendCode,
    verifyCode,
    handleGoogle,
  };
}
