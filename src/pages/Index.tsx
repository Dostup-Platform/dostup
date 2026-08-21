import { FormEvent, useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import AuthEntryScreen from "@/components/auth/AuthEntryScreen";
import EmailCodeScreen from "@/components/auth/EmailCodeScreen";
import RoleSelectionScreen from "@/components/auth/RoleSelectionScreen";
import { useEmailAuth } from "@/hooks/useEmailAuth";
import { authErrorTranslationKey, authErrorKeyFromUnknown } from "@/lib/authErrors";
import {
  markRoleOnboardingComplete,
  needsRoleOnboarding,
  parseAuthRedirectPath,
  parseProfileType,
  profileHomePath,
  readAuthEmail,
  readStoredProfiles,
  type ProfileType,
} from "@/lib/creatorAuth";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type Screen = "entry" | "code" | "role";

const Index = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { loading, profileType, switchProfile, refreshSession } = useSimpleAuth();
  const { t } = useLanguage();
  const [screen, setScreen] = useState<Screen>("entry");
  const [roleEmail, setRoleEmail] = useState("");

  const applyAuthRedirect = useCallback(async (path: string) => {
    const parsed = parseAuthRedirectPath(path);
    if (parsed.type === "role") {
      setRoleEmail(parsed.email);
      setScreen("role");
      window.history.replaceState({}, "", "/");
      return;
    }
    await refreshSession();
    navigate(parsed.path, { replace: true });
  }, [navigate, refreshSession]);

  const auth = useEmailAuth({ onAuthRedirect: applyAuthRedirect });

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
    if (screen === "role") return;

    const moderatorToken = localStorage.getItem("moderator_token");
    if (moderatorToken) {
      navigate("/moderator", { replace: true });
      return;
    }

    const token = localStorage.getItem("creator_token");
    if (!token) return;

    const storedType = parseProfileType(localStorage.getItem("profile_type")) || profileType;
    const accountType = localStorage.getItem("creator_account_type");
    const email = readAuthEmail();
    const profiles = readStoredProfiles();

    if (email && needsRoleOnboarding(email, profiles)) {
      setRoleEmail(email);
      setScreen("role");
      return;
    }

    if (storedType) {
      navigate(profileHomePath(storedType, accountType), { replace: true });
    }
  }, [navigate, loading, profileType, screen]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

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
    if (!address) return;

    if (type === "buyer") {
      markRoleOnboardingComplete(address);
      await refreshSession();
      navigate("/dashboard", { replace: true });
      return;
    }

    const result = await switchProfile({ createType: type });
    if ("error" in result) {
      if (result.error === "network_failure") {
        toast.error(t("networkFailure"));
      } else {
        toast.error(t("switchProfileError"));
      }
      return;
    }

    markRoleOnboardingComplete(address);
    navigate(result.path, { replace: true });
  };

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
              if (result.status === "role_required") {
                setRoleEmail(result.email);
                setScreen("role");
              }
            }}
            onResend={() => auth.sendCode(auth.pendingEmail || auth.email)}
            onBack={() => {
              auth.setPendingEmail(null);
              setScreen("entry");
            }}
          />
        )}
        {screen === "entry" && (
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
    </div>
  );
};

export default Index;
