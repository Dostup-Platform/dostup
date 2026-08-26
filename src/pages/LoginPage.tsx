import { FormEvent, useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import AuthEntryScreen from "@/components/auth/AuthEntryScreen";
import EmailCodeScreen from "@/components/auth/EmailCodeScreen";
import DisplayNameOnboardingScreen from "@/components/auth/DisplayNameOnboardingScreen";
import LoginModal from "@/components/auth/LoginModal";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { useEmailAuth } from "@/hooks/useEmailAuth";
import { authErrorKeyFromUnknown, authErrorTranslationKey } from "@/lib/authErrors";
import {
  isSafeInternalPath,
  markNameOnboardingComplete,
  parseAuthRedirectPath,
  profileHomePath,
  readAuthEmail,
  rememberAuthNext,
} from "@/lib/creatorAuth";
import { LOGIN_CARD_CLASS, readLoginBackground } from "@/lib/loginModal";
import { invokeApi } from "@/lib/sessionApi";
import { cn } from "@/lib/utils";

type Screen = "name" | "entry" | "code";

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { loading, profileType, sessionToken, refreshSession, switchProfile } = useSimpleAuth();
  const { t } = useLanguage();
  const [screen, setScreen] = useState<Screen>("entry");
  const [nameEmail, setNameEmail] = useState("");
  const [savingName, setSavingName] = useState(false);
  const signedIn = Boolean(sessionToken && profileType);
  const nextPath = searchParams.get("next");

  const closeModal = useCallback(() => {
    if (readLoginBackground(location.state)) {
      navigate(-1);
      return;
    }
    navigate("/", { replace: true });
  }, [location.state, navigate]);

  const goToNameStep = (email: string) => {
    setNameEmail(email);
    setScreen("name");
  };

  const applyAuthRedirect = useCallback(async (path: string) => {
    const parsed = parseAuthRedirectPath(path);
    if (parsed.type === "name") {
      goToNameStep(parsed.email);
      navigate("/login", { replace: true, state: location.state });
      return;
    }
    navigate(parsed.path, { replace: true });
  }, [location.state, navigate]);

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
    if (onboardingParam === "name" || onboardingParam === "role") {
      goToNameStep(emailParam?.trim().toLowerCase() || readAuthEmail());
      searchParams.delete("onboarding");
      searchParams.delete("email");
      changed = true;
    }
    if (changed) {
      setSearchParams(searchParams, { replace: true, state: location.state });
    }
  }, [location.state, searchParams, setSearchParams, t]);

  useEffect(() => {
    if (loading) return;
    if (screen === "code" || screen === "name") return;
    if (signedIn) {
      const destination =
        isSafeInternalPath(nextPath) && nextPath !== "/"
          ? nextPath
          : profileHomePath(profileType || "buyer", localStorage.getItem("creator_account_type"));
      navigate(destination, { replace: true });
    }
  }, [loading, navigate, nextPath, profileType, screen, signedIn]);

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

  const handleNameContinue = async (displayName: string) => {
    const address = nameEmail || auth.pendingEmail || auth.email || readAuthEmail();
    setSavingName(true);
    try {
      const profileId = localStorage.getItem("profile_id") || "";
      if (!profileId) {
        const created = await switchProfile({ createType: "buyer", displayName });
        if ("error" in created) {
          toast.error(t("displayNameSaveError"));
          return;
        }
      } else {
        await invokeApi("manage-profile", {
          action: "set_display_name",
          token: localStorage.getItem("creator_token") || "",
          profileId,
          displayName,
        });
        localStorage.setItem("profile_display_name", displayName);
      }
      if (address) markNameOnboardingComplete(address);
      await refreshSession();
      const destination =
        isSafeInternalPath(nextPath) && nextPath !== "/"
          ? nextPath
          : profileHomePath("buyer");
      navigate(destination, { replace: true });
    } catch {
      toast.error(t("displayNameSaveError"));
    } finally {
      setSavingName(false);
    }
  };

  const spinner = (
    <div className={cn(LOGIN_CARD_CLASS, "flex items-center justify-center bg-background sm:min-h-[280px] sm:bg-card")}>
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  const body =
    loading ? (
      spinner
    ) : screen === "name" ? (
      <DisplayNameOnboardingScreen
        initialValue={localStorage.getItem("profile_display_name") || ""}
        onContinue={(name) => void handleNameContinue(name)}
        saving={savingName}
      />
    ) : screen === "code" && auth.pendingEmail ? (
      <EmailCodeScreen
        email={auth.pendingEmail}
        verifying={auth.verifying}
        sending={auth.sending}
        onVerify={async (code) => {
          const result = await auth.verifyCode(code);
          if (!result) return;
          if (result.status === "navigated") return;
          if (result.status === "name_required") {
            goToNameStep(result.email);
          }
        }}
        onResend={() => auth.sendCode(auth.pendingEmail || auth.email)}
        onBack={() => {
          auth.setPendingEmail(null);
          setScreen("entry");
        }}
      />
    ) : screen === "entry" && !signedIn ? (
      <AuthEntryScreen
        email={auth.email}
        onEmailChange={auth.setEmail}
        onContinue={(e) => void handleContinue(e)}
        onGoogle={() => void handleGoogle()}
        sending={auth.sending}
        googleLoading={auth.googleLoading}
      />
    ) : (
      spinner
    );

  return <LoginModal onClose={closeModal}>{body}</LoginModal>;
};

export default LoginPage;
