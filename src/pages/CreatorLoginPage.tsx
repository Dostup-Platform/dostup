import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

const CreatorLoginPage = () => {
  const navigate = useNavigate();
  const { user } = useSimpleAuth();
  const { t } = useLanguage();
  
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Получить пароль из настроек
    const { data: settings } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "creator_password")
      .single();

    const correctPassword = settings?.value || "creator123";

    if (password === correctPassword) {
      toast.success(t("welcomeCreator"));
      navigate("/creator");
    } else {
      toast.error(t("wrongPassword"));
    }

    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex flex-col">
      <div className="absolute top-4 right-4 z-20">
        <LanguageSwitcher />
      </div>

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 touch-manipulation"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>{t("back")}</span>
          </button>

          <Card className="animate-fade-in">
            <CardHeader className="text-center">
              <CardTitle className="text-xl">{t("creatorLogin")}</CardTitle>
              <CardDescription>
                {user?.name && <span className="font-medium text-foreground">{user.name}</span>}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">{t("creatorPassword")}</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder={t("enterPassword")}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-12 pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  variant="cta" 
                  size="lg" 
                  className="w-full mt-6"
                  disabled={isSubmitting || !password}
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t("processing")}
                    </span>
                  ) : (
                    t("signIn")
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default CreatorLoginPage;
