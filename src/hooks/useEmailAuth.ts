import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { authErrorKeyFromUnknown } from "@/lib/authErrors";
import {
  completeExchangedSession,
  exchangeAuthSession,
  needsNameOnboarding,
  rememberAuthEmail,
  resolvePostAuthPath,
  sendEmailCode,
  startGoogleOAuth,
  storeCreatorSession,
  verifyEmailCode,
  type GoogleOAuthResult,
  type SessionPayload,
} from "@/lib/creatorAuth";
import { supabase } from "@/integrations/supabase/client";

export type AuthCompletion =
  | { status: "navigated" }
  | { status: "name_required"; email: string };

type UseEmailAuthOptions = {
  onAuthRedirect?: (path: string) => void | Promise<void>;
};

export function useEmailAuth(options: UseEmailAuthOptions = {}) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { onAuthRedirect } = options;
  const [googleLoading, setGoogleLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [email, setEmail] = useState("");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const submitting = useRef(false);

  const redirectAfterAuth = async (path: string) => {
    if (onAuthRedirect) {
      await onAuthRedirect(path);
      return;
    }
    navigate(path, { replace: true });
  };

  const completeSession = (session: SessionPayload, address: string): AuthCompletion => {
    rememberAuthEmail(address);
    storeCreatorSession(session);
    if (needsNameOnboarding(address, session.displayName, session.profiles ?? [])) {
      return { status: "name_required", email: address };
    }
    void redirectAfterAuth(
      resolvePostAuthPath(
        address,
        session.profiles ?? [],
        session.profileType,
        session.accountType,
        session.displayName,
      ),
    );
    return { status: "navigated" };
  };

  const exchange = async (accessToken: string, address: string) => {
    const { data, error } = await exchangeAuthSession(accessToken);
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // app session is what we keep
    }
    const payload = (data ?? null) as Record<string, unknown> | null;
    if (error && !payload?.success && payload?.needsOnboarding !== true) {
      toast.error(t(authErrorKeyFromUnknown(error)));
      return null;
    }

    const resolved = await completeExchangedSession(payload);
    if (!resolved.session) {
      toast.error(t(authErrorKeyFromUnknown({ message: resolved.error || "exchange_failed" })));
      return null;
    }
    return completeSession(resolved.session, address);
  };

  const sendCode = async (address: string) => {
    const trimmed = address.trim().toLowerCase();
    if (!trimmed.includes("@") || trimmed.length < 3) {
      toast.error(t("invalidEmail"));
      return false;
    }
    setSending(true);
    const { error } = await sendEmailCode(trimmed);
    setSending(false);
    if (error) {
      toast.error(t(authErrorKeyFromUnknown(error)));
      return false;
    }
    setPendingEmail(trimmed);
    return true;
  };

  const verifyCode = async (token: string): Promise<AuthCompletion | null> => {
    if (!pendingEmail || submitting.current) return null;
    submitting.current = true;
    setVerifying(true);
    try {
      const { data, error } = await verifyEmailCode(pendingEmail, token);
      if (error || !data.session?.access_token) {
        toast.error(t(authErrorKeyFromUnknown(error || { message: "wrong_email_code", code: "wrong_email_code" })));
        return null;
      }
      return await exchange(data.session.access_token, pendingEmail);
    } catch {
      toast.error(t("networkFailure"));
      return null;
    } finally {
      submitting.current = false;
      setVerifying(false);
    }
  };

  const handleGoogle = async (): Promise<GoogleOAuthResult> => {
    setGoogleLoading(true);
    try {
      return await startGoogleOAuth();
    } finally {
      setGoogleLoading(false);
    }
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
