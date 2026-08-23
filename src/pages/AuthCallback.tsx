import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  classifyAuthCode,
  OAUTH_CODE_MESSAGE_TYPE,
  OAUTH_MESSAGE_TYPE,
  parseCallbackError,
} from "@/lib/authErrors";
import {
  completeGoogleOAuthSession,
  notifyOAuthOpener,
  writeOAuthResult,
} from "@/lib/creatorAuth";

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
        window.setTimeout(() => navigate(`/login?auth_error=${encodeURIComponent(mapped)}`, { replace: true }), 400);
        return;
      }
      navigate(`/login?auth_error=${encodeURIComponent(mapped)}`, { replace: true });
    };

    const fail = async (code: string) => {
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // still leave the callback
      }
      leave(code);
    };

    const params = new URLSearchParams(window.location.search);
    const authCode = params.get("code");
    const opener = window.opener as Window | null;
    const urlError = parseCallbackError();

    if (opener && !opener.closed) {
      if (urlError && urlError !== "account_type_required") {
        notifyOAuthOpener({ type: OAUTH_MESSAGE_TYPE, ok: false, code: classifyAuthCode(urlError) });
        return;
      }
      if (authCode) {
        opener.postMessage({ type: OAUTH_CODE_MESSAGE_TYPE, code: authCode }, window.location.origin);
        window.close();
        return;
      }
    }

    const hasAuthCode = params.has("code");
    if (!hasAuthCode && urlError && urlError !== "account_type_required") {
      void fail(urlError);
      return;
    }

    const exchange = async (session: Session) => {
      if (started.current) return;
      started.current = true;
      setMessage(t("authExchanging"));

      const result = await completeGoogleOAuthSession(session);
      if (result.error) {
        await fail(result.error.code || result.error.message);
        return;
      }
      if (result.path) {
        leave("ok", result.path);
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
