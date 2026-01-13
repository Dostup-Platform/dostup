import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { Loader2, GraduationCap, BookOpen, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading, register } = useSimpleAuth();
  const { t } = useLanguage();
  
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRoleSelection, setShowRoleSelection] = useState(false);
  const [showCreatorLogin, setShowCreatorLogin] = useState(false);
  const [creatorName, setCreatorName] = useState("");
  const [creatorPassword, setCreatorPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Если уже залогинен как студент, перенаправить
  useEffect(() => {
    if (!loading && user) {
      if (!user.role || user.role === "student") {
        navigate("/dashboard");
      }
    }
  }, [user, loading, navigate]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const { user: newUser, error } = await register(fullName);

    if (error) {
      toast.error(error.message);
      setIsSubmitting(false);
      return;
    }

    if (newUser) {
      // Показать выбор роли
      setShowRoleSelection(true);
    }
    setIsSubmitting(false);
  };

  const handleCreatorLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Fetch creator password from app_settings
    const { data: settings } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "creator_password")
      .single();

    if (!settings || creatorPassword !== settings.value) {
      toast.error(t("invalidPassword"));
      setIsSubmitting(false);
      return;
    }

    // Store creator name in localStorage
    localStorage.setItem("creator_name", creatorName.trim());
    navigate("/creator");
    setIsSubmitting(false);
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

  // Creator login form
  if (showCreatorLogin) {
    return (
      <div className="min-h-screen bg-gradient-hero flex flex-col">
        <div className="absolute top-4 right-4 z-20">
          <LanguageSwitcher />
        </div>

        <main className="flex-1 flex items-center justify-center px-4 py-8">
          <Card className="w-full max-w-md animate-fade-in">
            <CardHeader className="text-center pb-2">
              <Button
                variant="ghost"
                size="sm"
                className="absolute left-4 top-4"
                onClick={() => setShowCreatorLogin(false)}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t("back")}
              </Button>
              <CardTitle className="text-2xl font-bold">{t("courseCreator")}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreatorLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="creatorName">{t("creatorNameLabel")}</Label>
                  <Input
                    id="creatorName"
                    type="text"
                    placeholder={t("creatorNamePlaceholder")}
                    value={creatorName}
                    onChange={(e) => setCreatorName(e.target.value)}
                    required
                    className="h-12"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="creatorPassword">{t("password")}</Label>
                  <div className="relative">
                    <Input
                      id="creatorPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder={t("enterPassword")}
                      value={creatorPassword}
                      onChange={(e) => setCreatorPassword(e.target.value)}
                      required
                      className="h-12 pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-12 px-3"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  variant="cta" 
                  size="lg" 
                  className="w-full mt-6"
                  disabled={isSubmitting || !creatorName.trim() || !creatorPassword.trim()}
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
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero flex flex-col">
      {/* Language Switcher */}
      <div className="absolute top-4 right-4 z-20">
        <LanguageSwitcher />
      </div>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md animate-fade-in">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl font-bold">{t("welcome")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">{t("firstName")}</Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder={t("firstNamePlaceholder")}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">{t("lastName")}</Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder={t("lastNamePlaceholder")}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="h-12"
                />
              </div>

              <Button 
                type="submit" 
                variant="cta" 
                size="lg" 
                className="w-full mt-6"
                disabled={isSubmitting || !firstName.trim() || !lastName.trim()}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("processing")}
                  </span>
                ) : (
                  t("continue")
                )}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowCreatorLogin(true)}
              >
                <BookOpen className="w-4 h-4 mr-2" />
                {t("forCourseCreators")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

// Компонент выбора роли
const RoleSelection = () => {
  const navigate = useNavigate();
  const { user, setRole } = useSimpleAuth();
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);

  const handleRoleSelect = async (role: "student" | "creator") => {
    setIsLoading(true);
    const { error } = await setRole(role);
    
    if (error) {
      toast.error(error.message);
      setIsLoading(false);
      return;
    }

    if (role === "student") {
      navigate("/dashboard");
    } else {
      navigate("/creator-login");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex flex-col">
      <div className="absolute top-4 right-4 z-20">
        <LanguageSwitcher />
      </div>

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-4">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-foreground">{t("selectRole")}</h1>
            <p className="text-muted-foreground mt-2">{user?.name}</p>
          </div>

          <Card 
            className="cursor-pointer hover:border-primary transition-colors animate-fade-in"
            onClick={() => !isLoading && handleRoleSelect("student")}
          >
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <GraduationCap className="w-7 h-7 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{t("student")}</h3>
                <p className="text-sm text-muted-foreground">{t("studentDescription")}</p>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:border-primary transition-colors animate-fade-in"
            style={{ animationDelay: "100ms" }}
            onClick={() => !isLoading && handleRoleSelect("creator")}
          >
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-7 h-7 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{t("courseCreator")}</h3>
                <p className="text-sm text-muted-foreground">{t("creatorDescription")}</p>
              </div>
            </CardContent>
          </Card>

          {isLoading && (
            <div className="flex justify-center pt-4">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Index;
