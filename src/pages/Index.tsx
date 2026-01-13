import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { Loader2, GraduationCap, BookOpen } from "lucide-react";
import { toast } from "sonner";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading, register } = useSimpleAuth();
  const { t } = useLanguage();
  
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRoleSelection, setShowRoleSelection] = useState(false);

  // Если уже залогинен, перенаправить
  useEffect(() => {
    if (!loading && user) {
      if (!user.role || user.role === "student") {
        navigate("/dashboard");
      } else if (user.role === "creator") {
        navigate("/creator-login");
      }
    }
  }, [user, loading, navigate]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const { user: newUser, error } = await register(phone, name);

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
                <Label htmlFor="phone">{t("phone")}</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+7 777 123 4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">{t("fullName")}</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder={t("namePlaceholder")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="h-12"
                />
              </div>

              <Button 
                type="submit" 
                variant="cta" 
                size="lg" 
                className="w-full mt-6"
                disabled={isSubmitting || !phone || !name}
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
