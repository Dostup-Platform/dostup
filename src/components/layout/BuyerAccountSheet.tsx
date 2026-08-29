import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import {
  ProfileAccountRows,
  useProfileAccountActions,
} from "@/components/layout/ProfileAccountRows";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { type ProfileType } from "@/lib/creatorAuth";

interface AccountSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Mobile account sheet — profiles, new profile, account, and sign out. */
const AccountSheet = ({ open, onOpenChange }: AccountSheetProps) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { profileType } = useSimpleAuth();
  const { profiles, runSwitch, createSeller, logout } = useProfileAccountActions();
  const [busyProfileId, setBusyProfileId] = useState<string | null>(null);
  const [creatingType, setCreatingType] = useState<ProfileType | null>(null);

  const activeProfileId = localStorage.getItem("profile_id") || "";

  const accountHref =
    profileType === "creator"
      ? "/creator?tab=account"
      : profileType === "school"
        ? "/school"
        : profileType === "buyer"
          ? "/dashboard/account"
          : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle>{t("navProfiles")}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 flex flex-col gap-1">
          <ProfileAccountRows
            expanded
            activeProfileId={activeProfileId}
            profiles={profiles}
            busyProfileId={busyProfileId}
            creatingType={creatingType}
            showAccountActions
            showSignOut
            accountHref={accountHref}
            onSwitch={(profile) => {
              setBusyProfileId(profile.id);
              void runSwitch(profile, navigate, () => {
                setBusyProfileId(null);
                onOpenChange(false);
              });
            }}
            onCreateSeller={(type, displayName, avatarFile) => {
              setCreatingType(type);
              return createSeller(type, displayName, navigate, () => setCreatingType(null), avatarFile).then(
                (ok) => {
                  if (ok) onOpenChange(false);
                  return ok;
                },
              );
            }}
            onSignOut={() => {
              logout();
              onOpenChange(false);
              navigate("/");
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AccountSheet;
export { AccountSheet as BuyerAccountSheet };
