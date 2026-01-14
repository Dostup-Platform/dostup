import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import CreatorLoginForm from "@/components/CreatorLoginForm";
import RoleSelection from "@/components/RoleSelection";
import { Loader2, BookOpen } from "lucide-react";
import { toast } from "sonner";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading, register } = useSimpleAuth();
  const { t } = useLanguage();
  
  // Загружаем последние имена как подсказки
  const lastFirstName = localStorage.getItem("student_last_first_name") || "";
  const lastLastName = localStorage.getItem("student_last_last_name") || "";
  
  const [firstName, setFirstName] = useState(lastFirstName);
  const [lastName, setLastName] = useState(lastLastName);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRoleSelection, setShowRoleSelection] = useState(false);
  const [showCreatorLogin, setShowCreatorLogin] = useState(false);
  const [errors, setErrors] = useState<{ firstName?: string; lastName?: string }>({});

  // Если создатель уже вошёл, перенаправить
  useEffect(() => {
    const creatorName = localStorage.getItem("creator_name");
    if (creatorName) {
      navigate("/creator");
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
    const newErrors: { firstName?: string; lastName?: string } = {};
    
    if (firstName.trim().length < 2) {
      newErrors.firstName = t("minNameLength");
    }
    if (lastName.trim().length < 2) {
      newErrors.lastName = t("minNameLength");
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isFormValid = firstName.trim().length >= 2 && lastName.trim().length >= 2;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateFields()) {
      return;
    }
    
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
    return <CreatorLoginForm onBack={() => setShowCreatorLogin(false)} />;
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
                  onChange={(e) => {
                    setFirstName(e.target.value);
                    if (errors.firstName) setErrors(prev => ({ ...prev, firstName: undefined }));
                  }}
                  required
                  className={`h-12 ${errors.firstName ? "border-destructive" : ""}`}
                />
                {errors.firstName && (
                  <p className="text-sm text-destructive">{errors.firstName}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">{t("lastName")}</Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder={t("lastNamePlaceholder")}
                  value={lastName}
                  onChange={(e) => {
                    setLastName(e.target.value);
                    if (errors.lastName) setErrors(prev => ({ ...prev, lastName: undefined }));
                  }}
                  required
                  className={`h-12 ${errors.lastName ? "border-destructive" : ""}`}
                />
                {errors.lastName && (
                  <p className="text-sm text-destructive">{errors.lastName}</p>
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

export default Index;
