import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { Loader2, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface CreatorLoginFormProps {
  onBack: () => void;
}

const CreatorLoginForm = ({ onBack }: CreatorLoginFormProps) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  
  const [creatorName, setCreatorName] = useState("");
  const [creatorPassword, setCreatorPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; password?: string }>({});

  const validateFields = () => {
    const newErrors: { name?: string; password?: string } = {};
    
    if (creatorName.trim().length < 2) {
      newErrors.name = t("minNameLength");
    }
    if (creatorPassword.length < 4) {
      newErrors.password = t("minPasswordLength");
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreatorLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateFields()) {
      return;
    }
    
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

  const isFormValid = creatorName.trim().length >= 2 && creatorPassword.length >= 4;

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
              onClick={onBack}
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
                  onChange={(e) => {
                    setCreatorName(e.target.value);
                    if (errors.name) setErrors(prev => ({ ...prev, name: undefined }));
                  }}
                  required
                  className={`h-12 ${errors.name ? "border-destructive" : ""}`}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="creatorPassword">{t("password")}</Label>
                <div className="relative">
                  <Input
                    id="creatorPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder={t("enterPassword")}
                    value={creatorPassword}
                    onChange={(e) => {
                      setCreatorPassword(e.target.value);
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
                    onClick={() => setShowPassword(!showPassword)}
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
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default CreatorLoginForm;
