import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { classifyAuthCode, parseCallbackError } from "@/lib/authErrors";
import { completeGoogleOAuthSession } from "@/lib/creatorAuth";

const AuthCallback = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [message, setMessage] = useState(t("authExchanging"));
  const started = useRef(false);

  useEffect(() => {
    const fail = async (code: string) => {
      if (started.current) return;
      started.current = true;
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // still leave the callback
      }
      navigate(`/login?auth_error=${encodeURIComponent(classifyAuthCode(code))}`, { replace: true });
    };

    const params = new URLSearchParams(window.location.search);
    const urlError = parseCallbackError();

    if (!params.has("code") && urlError && urlError !== "account_type_required") {
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
        navigate(result.path, { replace: true });
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
