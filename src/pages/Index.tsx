import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import CreatorLoginForm from "@/components/CreatorLoginForm";
import RoleSelection from "@/components/RoleSelection";
import { Loader2, BookOpen, User, X, Download } from "lucide-react";
import { toast } from "sonner";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading, register, loginById, lastUserId, lastUserName, clearLastUser } = useSimpleAuth();
  const { t } = useLanguage();
  
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showRoleSelection, setShowRoleSelection] = useState(false);
  const [showCreatorLogin, setShowCreatorLogin] = useState(false);
  const [showRegistrationForm, setShowRegistrationForm] = useState(false);
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
      navigate("/dashboard");
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

  // Creator login form
  if (showCreatorLogin) {
    return <CreatorLoginForm onBack={() => setShowCreatorLogin(false)} />;
  }

  // Если есть последний пользователь и не показываем форму регистрации
  const showLastUserOption = lastUserId && lastUserName && !showRegistrationForm;

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
                  {t("register")}
                </Button>
              </div>
            ) : (
              // Показываем форму регистрации
              <>
                {/* Кнопка Назад - если есть последний пользователь */}
                {lastUserId && lastUserName && (
                  <Button
                    variant="ghost"
                    className="mb-4 -ml-2"
                    onClick={() => setShowRegistrationForm(false)}
                  >
                    <X className="w-4 h-4 mr-2" />
                    {t("back")}
                  </Button>
                )}
                
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
              </>
            )}

            <div className="mt-6 pt-6 border-t space-y-3">
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
