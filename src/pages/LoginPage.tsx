import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import AuthEntryScreen from "@/components/auth/AuthEntryScreen";
import EmailCodeScreen from "@/components/auth/EmailCodeScreen";
import RoleSelectionScreen from "@/components/auth/RoleSelectionScreen";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { useEmailAuth } from "@/hooks/useEmailAuth";
import { authErrorKeyFromUnknown, authErrorTranslationKey } from "@/lib/authErrors";
import {
  isSafeInternalPath,
  markRoleOnboardingComplete,
  parseAuthRedirectPath,
  readAuthEmail,
  rememberAuthNext,
  type ProfileType,
} from "@/lib/creatorAuth";

type Screen = "entry" | "code" | "role";

const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { loading, profileType, sessionToken, switchProfile, refreshSession } = useSimpleAuth();
  const { t } = useLanguage();
  const [screen, setScreen] = useState<Screen>("entry");
  const [roleEmail, setRoleEmail] = useState("");
  const [pendingCreateType, setPendingCreateType] = useState<ProfileType | null>(null);
  const pendingCreateTypeRef = useRef<ProfileType | null>(null);
  const signedIn = Boolean(sessionToken || profileType);
  const intentSell = searchParams.get("intent") === "sell";
  const nextPath = searchParams.get("next");

  const rememberCreateType = (type: ProfileType | null) => {
    pendingCreateTypeRef.current = type;
    setPendingCreateType(type);
  };

  const applyAuthRedirect = useCallback(async (path: string) => {
    const parsed = parseAuthRedirectPath(path);
    if (parsed.type === "role") {
      setRoleEmail(parsed.email);
      setScreen("role");
      window.history.replaceState({}, "", "/login");
      return;
    }
    await refreshSession();
    const createType = pendingCreateTypeRef.current;
    if (createType && createType !== "buyer") {
      const result = await switchProfile({ createType });
      if ("path" in result) {
        navigate(result.path, { replace: true });
        return;
      }
    }
    navigate(parsed.path, { replace: true });
  }, [navigate, refreshSession, switchProfile]);

  const auth = useEmailAuth({ onAuthRedirect: applyAuthRedirect });

  useEffect(() => {
    if (nextPath) rememberAuthNext(nextPath);
  }, [nextPath]);

  useEffect(() => {
    const authError = searchParams.get("auth_error");
    const onboarding = searchParams.get("onboarding");
    const emailParam = searchParams.get("email");
    let changed = false;

    if (authError) {
      toast.error(t(authErrorTranslationKey(authError)));
      searchParams.delete("auth_error");
      changed = true;
    }
    if (onboarding === "role") {
      setRoleEmail(emailParam?.trim().toLowerCase() || readAuthEmail());
      setScreen("role");
      searchParams.delete("onboarding");
      searchParams.delete("email");
      changed = true;
    }
    if (changed) {
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, t]);

  useEffect(() => {
    if (loading) return;
    if (screen === "role" || screen === "code") return;
    if (intentSell) {
      setScreen("role");
      return;
    }
    if (signedIn) {
      navigate(isSafeInternalPath(nextPath) ? nextPath : "/", { replace: true });
    }
  }, [intentSell, loading, navigate, screen, signedIn]);

  const goAfterCreate = async (type: ProfileType, address: string) => {
    const result = await switchProfile({ createType: type });
    if ("error" in result) {
      toast.error(result.error === "network_failure" ? t("networkFailure") : t("switchProfileError"));
      return;
    }
    if (address) markRoleOnboardingComplete(address);
    navigate(result.path, { replace: true });
  };

  const handleContinue = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await auth.sendCode(auth.email);
    if (ok) setScreen("code");
  };

  const handleGoogle = async () => {
    const result = await auth.handleGoogle();
    if (result.path) {
      await applyAuthRedirect(result.path);
      return;
    }
    if (result.dismissed) {
      toast.error(t("oauthPopupDismissed"));
    } else if (result.error) {
      toast.error(t(authErrorKeyFromUnknown(result.error)));
    }
  };

  const handleRoleSelect = async (type: ProfileType) => {
    const address = roleEmail || auth.pendingEmail || auth.email || readAuthEmail();
    if (signedIn) {
      await goAfterCreate(type, address);
      return;
    }
    rememberCreateType(type);
    setScreen("entry");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero flex flex-col">
      <main className="flex-1 flex items-center justify-center px-4 py-6">
        {screen === "role" && <RoleSelectionScreen onSelect={handleRoleSelect} />}
        {screen === "code" && auth.pendingEmail && (
          <EmailCodeScreen
            email={auth.pendingEmail}
            verifying={auth.verifying}
            sending={auth.sending}
            onVerify={async (code) => {
              const result = await auth.verifyCode(code);
              if (!result) return;
              if (result.status === "navigated") return;
              if (pendingCreateType && pendingCreateType !== "buyer") {
                await refreshSession();
                await goAfterCreate(
                  pendingCreateType,
                  result.status === "role_required" ? result.email : auth.pendingEmail || "",
                );
                return;
              }
              if (result.status === "role_required") {
                setRoleEmail(result.email);
                setScreen("role");
              }
            }}
            onResend={() => auth.sendCode(auth.pendingEmail || auth.email)}
            onBack={() => {
              auth.setPendingEmail(null);
              setScreen(intentSell || pendingCreateType ? "role" : "entry");
            }}
          />
        )}
        {screen === "entry" && !signedIn && (
          <AuthEntryScreen
            email={auth.email}
            onEmailChange={auth.setEmail}
            onContinue={(e) => void handleContinue(e)}
            onGoogle={() => void handleGoogle()}
            sending={auth.sending}
            googleLoading={auth.googleLoading}
          />
        )}
      </main>
      <p className="pb-6 text-center text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">{t("back")}</Link>
      </p>
    </div>
  );
};

export default LoginPage;
