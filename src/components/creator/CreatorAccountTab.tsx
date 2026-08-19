import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { User, LogOut, Download, Globe, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useNavigate, Link } from "react-router-dom";
import ProfileSwitcher from "@/components/auth/ProfileSwitcher";
import { clearAppSession } from "@/lib/creatorAuth";
import { useState, useEffect } from "react";
import { unregisterPushToken } from "@/lib/firebase";
import { usePWADetection } from "@/hooks/usePWADetection";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CreatorAccountTabProps {
  creatorName: string;
}

const CreatorAccountTab = ({ creatorName }: CreatorAccountTabProps) => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [createdAt, setCreatedAt] = useState<Date | null>(null);
  const isAppInstalled = usePWADetection();

  const accountType = typeof window !== "undefined"
    ? localStorage.getItem("creator_account_type")
    : null;
  const isLegacyAccount = !accountType;

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
  const [pwdErrors, setPwdErrors] = useState<{ current?: string; new?: string; confirm?: string }>({});

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: { current?: string; new?: string; confirm?: string } = {};
    if (!currentPwd) errs.current = t("minPassword6");
    if (newPwd.length < 6) errs.new = t("minPassword6");
    if (newPwd !== confirmPwd) errs.confirm = t("passwordsDontMatch");
    setPwdErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setIsChanging(true);
    try {
      const { data, error } = await supabase.functions.invoke("change-creator-password", {
        body: { creatorName, currentPassword: currentPwd, newPassword: newPwd },
      });
      if (error || data?.error) {
        const code = data?.error || (error as { context?: { error?: string } })?.context?.error;
        if (code === "wrong_password") {
          setPwdErrors({ current: t("wrongCurrentPassword") });
        } else if (code === "legacy_account") {
          toast.error(t("legacyAccountNotice"));
        } else {
          toast.error(t("registrationFailed"));
        }
        setIsChanging(false);
        return;
      }
      toast.success(t("passwordChanged"));
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
    } catch (err) {
      console.error("change password error", err);
      toast.error(t("registrationFailed"));
    } finally {
      setIsChanging(false);
    }
  };

  useEffect(() => {
    // Получаем дату создания из localStorage или используем текущую
    const storedDate = localStorage.getItem("creator_created_at");
    if (storedDate) {
      setCreatedAt(new Date(storedDate));
    } else {
      // Если нет даты, сохраняем текущую
      const now = new Date();
      localStorage.setItem("creator_created_at", now.toISOString());
      setCreatedAt(now);
    }
  }, []);

  const handleLogout = async () => {
    // Удаляем push-токены при выходе
    await unregisterPushToken(creatorName).catch(console.error);
    
    // Сохраняем имя для подсказки при следующем входе
    clearAppSession();
    navigate("/");
  };

  return (
    <div className="space-y-6">
      {/* Profile Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="w-5 h-5" />
            {t("profile")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-lg font-bold text-primary">
                {creatorName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-medium text-foreground">{creatorName}</p>
              {createdAt && (
                <p className="text-sm text-muted-foreground">
                  {t("memberSince")} {format(createdAt, "LLLL yyyy", { locale: ru })}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <ProfileSwitcher
        activeType={accountType === "online_school" ? "school" : "creator"}
      />

      {/* Language Switcher */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="w-4 h-4" />
            {language === "ru" ? "Язык приложения" : "Қолданба тілі"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LanguageSwitcher />
        </CardContent>
      </Card>

      {/* Security: change password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lock className="w-5 h-5" />
            {t("security")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLegacyAccount ? (
            <p className="text-sm text-muted-foreground">{t("legacyAccountNotice")}</p>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="currentPwd">{t("currentPassword")}</Label>
                <div className="relative">
                  <Input
                    id="currentPwd"
                    type={showPwd ? "text" : "password"}
                    value={currentPwd}
                    onChange={(e) => { setCurrentPwd(e.target.value); setPwdErrors((p) => ({ ...p, current: undefined })); }}
                    className={`h-11 pr-10 ${pwdErrors.current ? "border-destructive" : ""}`}
                  />
                  <Button
                    type="button" variant="ghost" size="sm"
                    className="absolute right-0 top-0 h-11 px-3"
                    onClick={() => setShowPwd((s) => !s)}
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
                {pwdErrors.current && <p className="text-sm text-destructive">{pwdErrors.current}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPwd">{t("newPassword")}</Label>
                <Input
                  id="newPwd"
                  type={showPwd ? "text" : "password"}
                  value={newPwd}
                  onChange={(e) => { setNewPwd(e.target.value); setPwdErrors((p) => ({ ...p, new: undefined })); }}
                  className={`h-11 ${pwdErrors.new ? "border-destructive" : ""}`}
                />
                {pwdErrors.new && <p className="text-sm text-destructive">{pwdErrors.new}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPwd">{t("repeatPassword")}</Label>
                <Input
                  id="confirmPwd"
                  type={showPwd ? "text" : "password"}
                  value={confirmPwd}
                  onChange={(e) => { setConfirmPwd(e.target.value); setPwdErrors((p) => ({ ...p, confirm: undefined })); }}
                  className={`h-11 ${pwdErrors.confirm ? "border-destructive" : ""}`}
                />
                {pwdErrors.confirm && <p className="text-sm text-destructive">{pwdErrors.confirm}</p>}
              </div>

              <Button type="submit" className="w-full" disabled={isChanging}>
                {isChanging ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {t("changePassword")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Install App - only show if not installed */}
      {!isAppInstalled && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Download className="w-5 h-5" />
              {t("installApp")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              {t("installAppDescription")}
            </p>
            <Link to="/install">
              <Button variant="outline" className="w-full">
                {t("viewInstallInstructions")}
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Logout */}
      <Button
        variant="outline"
        className="w-full"
        onClick={() => setShowLogoutConfirm(true)}
      >
        <LogOut className="w-4 h-4 mr-2" />
        {t("signOut")}
      </Button>

      {/* Confirm Logout Dialog */}
      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmLogout")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirmLogoutDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("no")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout}>
              {t("yes")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CreatorAccountTab;
