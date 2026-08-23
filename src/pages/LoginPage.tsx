import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import AuthEntryScreen from "@/components/auth/AuthEntryScreen";
import EmailCodeScreen from "@/components/auth/EmailCodeScreen";
import RoleSelectionScreen from "@/components/auth/RoleSelectionScreen";
import SellerNameScreen from "@/components/auth/SellerNameScreen";
import AppHeader from "@/components/layout/AppHeader";
import PublicLocaleToggle from "@/components/marketplace/PublicLocaleToggle";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { useEmailAuth } from "@/hooks/useEmailAuth";
import { authErrorKeyFromUnknown, authErrorTranslationKey } from "@/lib/authErrors";
import {
  clearSellerDisplayName,
  isOnboardingSession,
  isSafeInternalPath,
  markRoleOnboardingComplete,
  parseAuthRedirectPath,
  profileHomePath,
  readAuthEmail,
  readSellerDisplayName,
  rememberAuthNext,
  rememberSellerDisplayName,
  type ProfileType,
} from "@/lib/creatorAuth";

type Screen = "name" | "entry" | "code" | "role";

const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { loading, profileType, sessionToken, switchProfile, createProfile, refreshSession } = useSimpleAuth();
  const { t } = useLanguage();
  const [screen, setScreen] = useState<Screen>("entry");
  const [roleEmail, setRoleEmail] = useState("");
  const [sellerDisplayName, setSellerDisplayName] = useState(() => readSellerDisplayName());
  const onboarding = isOnboardingSession(localStorage.getItem("creator_name"));
  const signedIn = Boolean(sessionToken && profileType);
  const nextPath = searchParams.get("next");

  const goToPostAuthStep = (email: string) => {
    setRoleEmail(email);
    setScreen(readSellerDisplayName() ? "role" : "name");
  };

  const applyAuthRedirect = useCallback(async (path: string) => {
    const parsed = parseAuthRedirectPath(path);
    if (parsed.type === "role") {
      goToPostAuthStep(parsed.email);
      window.history.replaceState({}, "", "/login");
      return;
    }
    navigate(parsed.path, { replace: true });
  }, [navigate]);

  const auth = useEmailAuth({ onAuthRedirect: applyAuthRedirect });

  useEffect(() => {
    if (nextPath) rememberAuthNext(nextPath);
  }, [nextPath]);

  useEffect(() => {
    const authError = searchParams.get("auth_error");
    const onboardingParam = searchParams.get("onboarding");
    const emailParam = searchParams.get("email");
    let changed = false;

    if (authError) {
      toast.error(t(authErrorTranslationKey(authError)));
      searchParams.delete("auth_error");
      changed = true;
    }
    if (onboardingParam === "role") {
      goToPostAuthStep(emailParam?.trim().toLowerCase() || readAuthEmail());
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
    if (screen === "role" || screen === "code" || screen === "name") return;
    if (onboarding) return;
    if (signedIn) {
      const destination =
        isSafeInternalPath(nextPath) && nextPath !== "/"
          ? nextPath
          : profileHomePath(profileType || "buyer", localStorage.getItem("creator_account_type"));
      navigate(destination, { replace: true });
    }
  }, [loading, navigate, nextPath, onboarding, profileType, screen, signedIn]);

  const goAfterRole = async (type: ProfileType, address: string) => {
    const displayName = sellerDisplayName || readSellerDisplayName();
    if (!displayName) {
      setScreen("name");
      return;
    }
    const result = onboarding
      ? await createProfile({ profileType: type, displayName })
      : await switchProfile({ createType: type, displayName });
    if ("error" in result) {
      toast.error(result.error === "network_failure" ? t("networkFailure") : t("switchProfileError"));
      return;
    }
    if (address) markRoleOnboardingComplete(address);
    clearSellerDisplayName();
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
      await refreshSession();
      await applyAuthRedirect(result.path);
      return;
    }
    if (result.dismissed) {
      toast.error(t("oauthPopupDismissed"));
    } else if (result.error) {
      toast.error(t(authErrorKeyFromUnknown(result.error)));
    }
  };

  const handleSellerNameContinue = (name: string) => {
    rememberSellerDisplayName(name);
    setSellerDisplayName(name);
    setScreen("role");
  };

  const handleRoleSelect = async (type: ProfileType) => {
    const address = roleEmail || auth.pendingEmail || auth.email || readAuthEmail();
    await goAfterRole(type, address);
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
      <AppHeader>
        <PublicLocaleToggle />
        <Link
          to="/login"
          className="inline-flex h-10 items-center rounded-full border border-[#E3E5E8] px-5 text-[15px] font-medium text-[#1F2328] transition-colors hover:bg-[#F6F7F8] focus-ring"
        >
          {t("signIn")}
        </Link>
      </AppHeader>
      <main className="flex-1 flex items-center justify-center px-4 py-6">
        {screen === "name" && (
          <SellerNameScreen
            initialValue={sellerDisplayName}
            onContinue={handleSellerNameContinue}
          />
        )}
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
              if (result.status === "role_required") {
                goToPostAuthStep(result.email);
              }
            }}
            onResend={() => auth.sendCode(auth.pendingEmail || auth.email)}
            onBack={() => {
              auth.setPendingEmail(null);
              setScreen("entry");
            }}
          />
        )}
        {screen === "entry" && !signedIn && !onboarding && (
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
