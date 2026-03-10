import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { useSimplePurchases } from "@/hooks/useSimplePurchases";
import { useLanguage } from "@/contexts/LanguageContext";
import { User, Package, LogOut, Loader2, Download, Globe } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import { unregisterPushToken } from "@/lib/firebase";
import { usePWADetection } from "@/hooks/usePWADetection";
import LanguageSwitcher from "@/components/LanguageSwitcher";
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

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "KZT",
    minimumFractionDigits: 0,
  }).format(price);
};

const AccountTab = () => {
  const navigate = useNavigate();
  const { user, logout } = useSimpleAuth();
  const { t, language } = useLanguage();
  const { data: purchases, isLoading: purchasesLoading } = useSimplePurchases();
  const isAppInstalled = usePWADetection();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = async () => {
    // Удаляем push-токены при выходе
    if (user?.id) {
      await unregisterPushToken(user.id).catch(console.error);
    }
    logout(); // logout уже сохраняет данные пользователя для повторного входа
    navigate("/");
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

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
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-medium text-foreground">{user.name}</p>
              <p className="text-sm text-muted-foreground">
                {t("memberSince")} {format(parseISO(user.created_at), "LLLL yyyy", { locale: ru })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Purchased Products */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="w-5 h-5" />
            {t("myPurchases")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {purchasesLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : purchases && purchases.length > 0 ? (
            <div className="space-y-3">
              {purchases.map((purchase) => (
                <div
                  key={purchase.id}
                  className="p-4 rounded-xl bg-muted/50 border border-border"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-foreground">
                        {purchase.product?.title || "Продукт"}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {t("purchased")} {format(parseISO(purchase.created_at), "d MMMM yyyy", { locale: ru })}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      {formatPrice(Number(purchase.amount))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              {t("noPurchases")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <NotificationPreferences userId={user.id} />

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

export default AccountTab;
