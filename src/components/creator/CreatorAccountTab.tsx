import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { User, LogOut } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { unregisterPushToken } from "@/lib/firebase";
import NotificationPreferences from "@/components/NotificationPreferences";
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
  const { t } = useLanguage();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [createdAt, setCreatedAt] = useState<Date | null>(null);

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
    localStorage.setItem("creator_last_name", creatorName);
    localStorage.removeItem("creator_name");
    localStorage.removeItem("creator_created_at");
    navigate("/");
  };

  return (
    <div className="space-y-6">
      {/* Notification Preferences */}
      <NotificationPreferences userPhone={creatorName} />
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
