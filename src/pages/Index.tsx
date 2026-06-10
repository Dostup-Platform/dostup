import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

import CreatorRegisterForm from "@/components/CreatorRegisterForm";
import RoleSelection from "@/components/RoleSelection";
import { Loader2, User, X, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading, loginByName, loginById, lastUserId, lastUserName, clearLastUser } = useSimpleAuth();
  const { t } = useLanguage();
  
  const [loginValue, setLoginValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showRoleSelection, setShowRoleSelection] = useState(false);
  const [showCreatorRegister, setShowCreatorRegister] = useState(false);
  const [showRegistrationForm, setShowRegistrationForm] = useState(false);
  const [errors, setErrors] = useState<{ login?: string; password?: string }>({});

  // Если создатель уже вошёл, перенаправить
  useEffect(() => {
    const creatorName = localStorage.getItem("creator_name");
    const teacherData = localStorage.getItem("teacher_data");
    const creatorAccountType = localStorage.getItem("creator_account_type");
    if (creatorName) {
      navigate(creatorAccountType === "online_school" ? "/school" : "/creator");
    } else if (teacherData) {
      navigate("/teacher");
    }
  }, [navigate]);

  // Если уже залогинен как студент, перенаправить
  useEffect(() => {
    if (!loading && user) {
      if (!user.role || user.role === "student") {
        navigate("/dashboard");
      }
    }
  }, [user, loading, navigate]);

  const validateFields = () => {
    const newErrors: { login?: string; password?: string } = {};
    if (loginValue.trim().length < 2) newErrors.login = t("minNameLength");
    if (passwordValue.trim().length < 2) newErrors.password = t("minNameLength");
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isFormValid = loginValue.trim().length >= 2 && passwordValue.trim().length >= 2;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateFields()) return;
    setIsSubmitting(true);

    const login = loginValue.trim();
    const password = passwordValue;

    // 1) Try as creator (old or new). Use raw fetch so a 401 (not-a-creator)
    //    doesn't get logged as an error by supabase-js.
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-creator-password`;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ password, creatorName: login }),
      });
      if (resp.ok) {
        const cData = await resp.json();
        if (cData?.success) {
          if (cData.token) localStorage.setItem("creator_token", cData.token);
          if (cData.accountType) localStorage.setItem("creator_account_type", cData.accountType);
          localStorage.setItem("creator_name", login);
          localStorage.setItem("creator_last_name", login);
          navigate(cData.accountType === "online_school" ? "/school" : "/creator");
          setIsSubmitting(false);
          return;
        }
      }
      // non-OK (e.g. 401 not-a-creator) → fall through to student/teacher login
    } catch {
      // network error — silently fall through
    }

    // 2) Fallback: student/teacher (login = first name, password = last name).
    // Only existing users can log in — no auto-registration.
    const fullName = `${login} ${password.trim()}`.trim();
    const { user: foundUser, error } = await loginByName(fullName);

    if (error || !foundUser) {
      toast.error(t("invalidCredentials"));
      setIsSubmitting(false);
      return;
    }

    if (foundUser) {
      if ((foundUser.role as string) === "teacher") {
        localStorage.setItem("teacher_data", JSON.stringify({ id: foundUser.id, name: foundUser.name }));
        navigate("/teacher");
      } else {
        if (foundUser.role === "student" || !foundUser.role) {
          navigate("/dashboard");
        } else if (foundUser.role === "creator") {
          navigate("/creator");
        }
      }
    }
    setIsSubmitting(false);
  };

  const handleLoginAsLastUser = async () => {
    if (!lastUserId) return;
    
    setIsLoggingIn(true);
    const { user: loggedInUser, error } = await loginById(lastUserId);
    
    if (error) {
      toast.error(error.message);
      clearLastUser();
      setIsLoggingIn(false);
      return;
    }
    
    if (loggedInUser) {
      if ((loggedInUser.role as string) === "teacher") {
        localStorage.setItem(
          "teacher_data",
          JSON.stringify({ id: loggedInUser.id, name: loggedInUser.name })
        );
        navigate("/teacher");
      } else if ((loggedInUser.role as string) === "creator") {
        navigate("/creator");
      } else {
        navigate("/dashboard");
      }
    }
    setIsLoggingIn(false);
  };

  const handleNotMe = () => {
    clearLastUser();
    setShowRegistrationForm(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (showRoleSelection || (user && !user.role)) {
    return <RoleSelection />;
  }

  if (showCreatorRegister) {
    return <CreatorRegisterForm onBack={() => setShowCreatorRegister(false)} />;
  }

  // Если есть последний пользователь и не показываем форму регистрации
  const showLastUserOption = lastUserId && lastUserName && !showRegistrationForm;

  return (
    <div className="min-h-screen bg-gradient-hero flex flex-col">

      {/* Back Button - показывается когда форма регистрации открыта */}
      {lastUserId && lastUserName && showRegistrationForm && (
        <div className="absolute top-4 left-4 z-20">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowRegistrationForm(false)}
          >
            <X className="w-4 h-4 mr-2" />
            {t("back")}
          </Button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md animate-fade-in">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl font-bold">{t("welcome")}</CardTitle>
          </CardHeader>
          <CardContent>
            {showLastUserOption ? (
              // Показываем опцию войти как предыдущий пользователь
              <div className="space-y-4">
                <Button
                  variant="default"
                  size="lg"
                  className="w-full h-auto py-4"
                  onClick={handleLoginAsLastUser}
                  disabled={isLoggingIn}
                >
                  {isLoggingIn ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    <User className="w-5 h-5 mr-2" />
                  )}
                  <span className="flex flex-col items-start">
                    <span className="text-sm opacity-80">{t("continueAs")}</span>
                    <span className="font-semibold">{lastUserName}</span>
                  </span>
                </Button>
                
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                      {t("or")}
                    </span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowRegistrationForm(true)}
                >
                  {t("loginAsOther")}
                </Button>
              </div>
            ) : (
              // Показываем форму регистрации
              <>
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="loginField">{t("loginField")}</Label>
                    <Input
                      id="loginField"
                      type="text"
                      placeholder={t("loginPlaceholder")}
                      value={loginValue}
                      onChange={(e) => {
                        setLoginValue(e.target.value);
                        if (errors.login) setErrors(prev => ({ ...prev, login: undefined }));
                      }}
                      required
                      className={`h-12 ${errors.login ? "border-destructive" : ""}`}
                    />
                    {errors.login && (
                      <p className="text-sm text-destructive">{errors.login}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="passwordField">{t("passwordField")}</Label>
                    <div className="relative">
                      <Input
                        id="passwordField"
                        type={showPassword ? "text" : "password"}
                        placeholder={t("passwordPlaceholder")}
                        value={passwordValue}
                        onChange={(e) => {
                          setPasswordValue(e.target.value);
                          if (errors.password) setErrors(prev => ({ ...prev, password: undefined }));
                        }}
                        required
                        className={`h-12 pr-10 ${errors.password ? "border-destructive" : ""}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-12 px-3"
                        onClick={() => setShowPassword((s) => !s)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                    {errors.password && (
                      <p className="text-sm text-destructive">{errors.password}</p>
                    )}
                  </div>

                  <Button 
                    type="submit" 
                    variant="cta" 
                    size="lg" 
                    className="w-full mt-6"
                    disabled={isSubmitting || !isFormValid}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t("processing")}
                      </span>
                    ) : (
                      t("login")
                    )}
                  </Button>
                </form>
              </>
            )}

            <div className="mt-6 pt-6 border-t space-y-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowCreatorRegister(true)}
              >
                {t("register")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Index;
