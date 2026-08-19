import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import AuthEntryScreen from "@/components/auth/AuthEntryScreen";
import EmailCodeScreen from "@/components/auth/EmailCodeScreen";
import SellerTypeScreen from "@/components/auth/SellerTypeScreen";
import PasswordLoginScreen from "@/components/auth/PasswordLoginScreen";
import { useEmailAuth } from "@/hooks/useEmailAuth";
import { authErrorTranslationKey } from "@/lib/authErrors";
import { parseProfileType, profileHomePath, type ProfileType } from "@/lib/creatorAuth";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type Screen = "entry" | "code" | "seller" | "password";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading, profileType } = useSimpleAuth();
  const { t } = useLanguage();
  const [screen, setScreen] = useState<Screen>("entry");
  const [sellerType, setSellerType] = useState<Extract<ProfileType, "creator" | "school"> | undefined>();
  const auth = useEmailAuth(sellerType);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("auth_error");
    if (!authError) return;
    toast.error(t(authErrorTranslationKey(authError)));
    params.delete("auth_error");
    const next = params.toString();
    window.history.replaceState({}, "", next ? `/?${next}` : "/");
  }, [t]);

  useEffect(() => {
    if (loading) return;
    const moderatorToken = localStorage.getItem("moderator_token");
    if (moderatorToken) {
      navigate("/moderator");
      return;
    }
    const token = localStorage.getItem("creator_token");
    const storedType = parseProfileType(localStorage.getItem("profile_type")) || profileType;
    const accountType = localStorage.getItem("creator_account_type");
    if (token && storedType) {
      navigate(profileHomePath(storedType, accountType));
      return;
    }
    const teacherData = localStorage.getItem("teacher_data");
    if (teacherData && user && (user.role as string) === "teacher") {
      navigate("/teacher");
    }
  }, [navigate, loading, user, profileType]);

  useEffect(() => {
    if (!loading && user && (!user.role || user.role === "student")) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

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

  return (
    <div className="min-h-screen bg-gradient-hero flex flex-col">
      <main className="flex-1 flex items-center justify-center px-4 py-6">
        {screen === "seller" && (
          <SellerTypeScreen
            onBack={() => {
              setSellerType(undefined);
              setScreen("entry");
            }}
            onSelect={(type) => {
              setSellerType(type);
              setScreen("entry");
            }}
          />
        )}
        {screen === "password" && <PasswordLoginScreen onBack={() => setScreen("entry")} />}
        {screen === "code" && auth.pendingEmail && (
          <EmailCodeScreen
            email={auth.pendingEmail}
            verifying={auth.verifying}
            sending={auth.sending}
            onVerify={(code) => void auth.verifyCode(code)}
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
            onGoogle={() => void auth.handleGoogle()}
            onSeller={() => setScreen("seller")}
            onPassword={() => setScreen("password")}
            sending={auth.sending}
            googleLoading={auth.googleLoading}
          />
        )}
      </main>
    </div>
  );
};

export default Index;
