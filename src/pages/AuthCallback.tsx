import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { classifyAuthCode, OAUTH_MESSAGE_TYPE, parseCallbackError } from "@/lib/authErrors";
import {
  clearOAuthAccountType,
  notifyOAuthOpener,
  rememberAuthEmail,
  parseProfileType,
  readOAuthProfileType,
  resolvePostAuthPath,
  storeCreatorSession,
  writeOAuthResult,
  type SessionPayload,
} from "@/lib/creatorAuth";

type ExchangeResult = {
  success?: boolean;
  token?: string;
  creatorName?: string;
  accountType?: string;
  profileType?: string;
  profileId?: string;
  displayName?: string;
  profiles?: { id: string; type: string; displayName: string | null }[];
  error?: string;
};

const AuthCallback = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [message, setMessage] = useState(t("authExchanging"));
  const started = useRef(false);

  useEffect(() => {
    const leave = (code: string, path?: string) => {
      started.current = true;
      if (path) {
        writeOAuthResult({ error: null, path });
        const handedOff = notifyOAuthOpener({ type: OAUTH_MESSAGE_TYPE, ok: true, path });
        if (handedOff) {
          window.setTimeout(() => navigate(path, { replace: true }), 400);
          return;
        }
        navigate(path, { replace: true });
        return;
      }
      const mapped = classifyAuthCode(code);
      writeOAuthResult({ error: { message: mapped, code: mapped }, dismissed: mapped === "oauth_popup_dismissed" });
      const handedOff = notifyOAuthOpener({ type: OAUTH_MESSAGE_TYPE, ok: false, code: mapped });
      if (handedOff) {
        window.setTimeout(() => navigate(`/?auth_error=${encodeURIComponent(mapped)}`, { replace: true }), 400);
        return;
      }
      navigate(`/?auth_error=${encodeURIComponent(mapped)}`, { replace: true });
    };

    const fail = async (code: string) => {
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // still leave the callback
      }
      leave(code);
    };

    const hasAuthCode = new URLSearchParams(window.location.search).has("code");
    const urlError = parseCallbackError();
    if (!hasAuthCode && urlError && urlError !== "account_type_required") {
      void fail(urlError);
      return;
    }

    const exchange = async (session: Session) => {
      if (started.current) return;
      started.current = true;
      setMessage(t("authExchanging"));

      const params = new URLSearchParams(window.location.search);
      const fromQuery = params.get("profile_type") || params.get("account_type");
      const profileType = parseProfileType(fromQuery) ?? readOAuthProfileType();
      try {
        const { data, error } = await supabase.functions.invoke("exchange-auth-session", {
          body: {
            access_token: session.access_token,
            profileType: profileType ?? undefined,
          },
        });

        const result = (data ?? {}) as ExchangeResult;
        const errCode = result.error || error?.message;

        try {
          await supabase.auth.signOut({ scope: "local" });
        } catch {
          // creator session is what the app uses
        }
        clearOAuthAccountType();

        const nextType = parseProfileType(result.profileType);
        if (error || !result.success || !result.token || !nextType) {
          await fail(errCode === "account_type_required" ? "account_type_required" : "exchange_failed");
          return;
        }

        storeCreatorSession({
          token: result.token,
          creatorName: result.creatorName || result.displayName || "",
          accountType: result.accountType,
          profileType: nextType,
          profileId: result.profileId,
          displayName: result.displayName,
          profiles: result.profiles as SessionPayload["profiles"],
        });
        const email = session.user.email?.trim().toLowerCase() || "";
        if (email) rememberAuthEmail(email);
        const profiles = (result.profiles as SessionPayload["profiles"]) ?? [];
        leave("ok", resolvePostAuthPath(email, profiles, nextType, result.accountType));
      } catch {
        await fail("network_failure");
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        void exchange(session);
      }
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) void exchange(session);
    });

    const timeout = window.setTimeout(() => {
      if (!started.current) void fail("no_session");
    }, 15000);

    return () => {
      subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, [navigate, t]);

  return (
    <div className="min-h-screen bg-gradient-hero flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-card border shadow-sm px-6 py-12 flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground text-center">{message}</p>
      </div>
    </div>
  );
};

export default AuthCallback;
