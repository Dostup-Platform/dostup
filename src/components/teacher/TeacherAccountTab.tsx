import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { User, LogOut, Loader2 } from "lucide-react";
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

interface TeacherAccountTabProps {
  teacherName: string;
}

const TeacherAccountTab = ({ teacherName }: TeacherAccountTabProps) => {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = () => {
    setIsLoggingOut(true);
    localStorage.removeItem("teacher_data");
    localStorage.removeItem("teacher_notifications_last_viewed");
    navigate("/");
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">{t("account")}</h2>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-5 h-5" />
            {t("profile")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-8 h-8 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-lg">{teacherName}</p>
              <p className="text-sm text-muted-foreground">
                {language === "ru" ? "Учитель" : "Мұғалім"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logout Button */}
      <Button
        variant="outline"
        className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
        onClick={() => setShowLogoutConfirm(true)}
      >
        <LogOut className="w-4 h-4 mr-2" />
        {t("signOut")}
      </Button>

      {/* Logout Confirmation */}
      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmLogout")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirmLogoutDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoggingOut ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                t("signOut")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TeacherAccountTab;
