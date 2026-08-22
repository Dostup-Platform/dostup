import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Package, UserRound } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import ProfileSwitcher from "@/components/auth/ProfileSwitcher";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { profileHomePath } from "@/lib/creatorAuth";

function initialsFrom(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "D";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("");
}

const AvatarSheet = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user, profileType, profiles, logout } = useSimpleAuth();
  const [open, setOpen] = useState(false);
  const displayName =
    user?.name ||
    localStorage.getItem("profile_display_name") ||
    localStorage.getItem("creator_name") ||
    "";
  const cabinetPath = profileHomePath(
    profileType || "buyer",
    localStorage.getItem("creator_account_type"),
  );

  const handleLogout = () => {
    logout();
    setOpen(false);
    navigate("/");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={t("profile")}
      >
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-[#FF6B00]/15 text-[#FF6B00] text-sm font-semibold">
            {initialsFrom(displayName)}
          </AvatarFallback>
        </Avatar>
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-sm overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage alt={displayName} />
                <AvatarFallback className="bg-[#FF6B00]/15 text-[#FF6B00] font-semibold">
                  {initialsFrom(displayName)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{displayName || t("profile")}</span>
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                setOpen(false);
                navigate("/dashboard");
              }}
            >
              <Package className="w-4 h-4" />
              {t("myPurchases")}
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                setOpen(false);
                navigate(cabinetPath);
              }}
            >
              <UserRound className="w-4 h-4" />
              {t("account")}
            </Button>
            <ProfileSwitcher activeType={profileType} profiles={profiles} />
            <Button variant="outline" className="w-full" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              {t("signOut")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default AvatarSheet;
