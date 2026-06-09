import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowLeft, Loader2, BookOpen, School, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface CreatorRegisterFormProps {
  onBack: () => void;
}

type AccountType = "course_creator" | "online_school";

const CreatorRegisterForm = ({ onBack }: CreatorRegisterFormProps) => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [step, setStep] = useState<"type" | "details">("type");
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ login?: string; password?: string; confirm?: string }>({});

  const handleSelectType = (type: AccountType) => {
    setAccountType(type);
    setStep("details");
  };

  const validate = () => {
    const e: { login?: string; password?: string; confirm?: string } = {};
    if (login.trim().length < 2) e.login = t("minNameLength");
    if (password.length < 6) e.password = t("minPassword6");
    if (password !== confirm) e.confirm = t("passwordsDontMatch");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !accountType) return;
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("register-creator", {
        body: { login: login.trim(), password, accountType },
      });
      if (error) {
        // Try to extract status-like info from response body
        const ctx = (error as { context?: { error?: string } }).context;
        if (ctx?.error === "login_taken") {
          setErrors({ login: t("loginAlreadyTaken") });
        } else {
          toast.error(t("registrationFailed"));
        }
        setIsSubmitting(false);
        return;
      }
      if (data?.error === "login_taken") {
        setErrors({ login: t("loginAlreadyTaken") });
        setIsSubmitting(false);
        return;
      }
      if (!data?.success) {
        toast.error(t("registrationFailed"));
        setIsSubmitting(false);
        return;
      }
      localStorage.setItem("creator_name", data.creatorName);
      localStorage.setItem("creator_last_name", data.creatorName);
      localStorage.setItem("creator_token", data.token);
      localStorage.setItem("creator_account_type", data.accountType);
      localStorage.setItem("creator_created_at", new Date().toISOString());
      toast.success(t("welcomeCreator"));
      navigate(data.accountType === "online_school" ? "/school" : "/creator");
    } catch (err) {
      console.error("register error", err);
      toast.error(t("registrationFailed"));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex flex-col">
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md animate-fade-in relative">
          <CardHeader className="text-center pb-2">
            <Button
              variant="ghost"
              size="sm"
              className="absolute left-4 top-4"
              onClick={() => (step === "details" ? setStep("type") : onBack())}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t("back")}
            </Button>
            <CardTitle className="text-2xl font-bold">
              {step === "type" ? t("chooseAccountType") : t("register")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {step === "type" ? (
              <div className="space-y-3 pt-2">
                <Card
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => handleSelectType("course_creator")}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <BookOpen className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{t("courseCreatorMode")}</h3>
                      <p className="text-sm text-muted-foreground">
                        {t("courseCreatorDescription")}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => handleSelectType("online_school")}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <School className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{t("onlineSchoolMode")}</h3>
                      <p className="text-sm text-muted-foreground">
                        {t("onlineSchoolDescription")}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="regLogin">{t("creatorNameLabel")}</Label>
                  <Input
                    id="regLogin"
                    type="text"
                    placeholder={t("creatorNamePlaceholder")}
                    value={login}
                    onChange={(e) => {
                      setLogin(e.target.value);
                      if (errors.login) setErrors((p) => ({ ...p, login: undefined }));
                    }}
                    required
                    className={`h-12 ${errors.login ? "border-destructive" : ""}`}
                  />
                  {errors.login && <p className="text-sm text-destructive">{errors.login}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="regPwd">{t("password")}</Label>
                  <div className="relative">
                    <Input
                      id="regPwd"
                      type={showPwd ? "text" : "password"}
                      placeholder={t("enterPassword")}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
                      }}
                      required
                      className={`h-12 pr-10 ${errors.password ? "border-destructive" : ""}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-12 px-3"
                      onClick={() => setShowPwd((s) => !s)}
                    >
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="regPwd2">{t("repeatPassword")}</Label>
                  <Input
                    id="regPwd2"
                    type={showPwd ? "text" : "password"}
                    placeholder={t("repeatPassword")}
                    value={confirm}
                    onChange={(e) => {
                      setConfirm(e.target.value);
                      if (errors.confirm) setErrors((p) => ({ ...p, confirm: undefined }));
                    }}
                    required
                    className={`h-12 ${errors.confirm ? "border-destructive" : ""}`}
                  />
                  {errors.confirm && <p className="text-sm text-destructive">{errors.confirm}</p>}
                </div>

                <Button
                  type="submit"
                  variant="cta"
                  size="lg"
                  className="w-full mt-2"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t("processing")}
                    </span>
                  ) : (
                    t("register")
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default CreatorRegisterForm;