import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Settings, Plus, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import {
  initialsFrom,
  profileDisplayLabel,
  profileRoleLabel,
  profilesInSidebarOrder,
  useProfileAccountActions,
} from "@/components/layout/ProfileAccountRows";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AddSellerProfileDialog from "@/components/layout/AddSellerProfileDialog";
import { type ProfileType } from "@/lib/creatorAuth";
import { cn } from "@/lib/utils";

interface AccountSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenSettings?: () => void;
}

/** Mobile account sheet — top '+ Новый профиль', profiles list, bottom 'Настройки аккаунта' with gear icon. */
const AccountSheet = ({ open, onOpenChange, onOpenSettings }: AccountSheetProps) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { profileType } = useSimpleAuth();
  const { profiles, runSwitch, createSeller } = useProfileAccountActions();
  const [busyProfileId, setBusyProfileId] = useState<string | null>(null);
  const [creatingType, setCreatingType] = useState<ProfileType | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  const activeProfileId = typeof window !== "undefined" ? localStorage.getItem("profile_id") || "" : "";
  const orderedProfiles = profilesInSidebarOrder(profiles);

  const accountHref =
    profileType === "creator"
      ? "/creator?tab=account"
      : profileType === "school"
        ? "/school"
        : "/dashboard/account";

  return (
    <>
      <AddSellerProfileDialog
        open={wizardOpen}
        creating={!!creatingType}
        onOpenChange={(open) => {
          if (!open && !creatingType) setWizardOpen(false);
        }}
        onConfirm={async (type, displayName, avatarFile) => {
          setCreatingType(type);
          const res = await createSeller(type, displayName, navigate, () => setCreatingType(null), avatarFile);
          if (res === true || (typeof res === "object" && res?.ok === true)) {
            setWizardOpen(false);
            onOpenChange(false);
          }
          return res;
        }}
      />

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl p-4">
          <SheetHeader className="sr-only">
            <SheetTitle>{t("navProfiles")}</SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-1">
            {/* Top item: + Новый профиль */}
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              disabled={!!creatingType}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/60 disabled:opacity-60"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-border/80 bg-muted/30">
                {creatingType ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <Plus className="h-4 w-4 text-foreground" strokeWidth={2} />
                )}
              </span>
              <span className="truncate text-[15px] font-medium">{t("addSellerProfile")}</span>
            </button>

            {/* List of existing profiles */}
            <div className="flex max-h-[45vh] flex-col gap-1 overflow-y-auto py-1">
              {orderedProfiles.map((profile) => {
                const active = profile.id === activeProfileId;
                const busy = busyProfileId === profile.id;
                const displayName = profileDisplayLabel(profile);
                const role = profileRoleLabel(profile, t);

                return (
                  <button
                    key={profile.id}
                    type="button"
                    disabled={busyProfileId !== null && !busy}
                    onClick={() => {
                      setBusyProfileId(profile.id);
                      void runSwitch(profile, navigate, () => {
                        setBusyProfileId(null);
                        onOpenChange(false);
                      });
                    }}
                    className={cn(
                      "group relative flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-colors",
                      active
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-[#FF6B00]" aria-hidden />
                    )}
                    <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full overflow-hidden border border-border/80 bg-muted text-foreground font-semibold text-xs select-none">
                      {profile.avatarUrl && !busy ? (
                        <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <span>{initialsFrom(displayName)}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="truncate text-[15px] font-medium leading-tight">{displayName}</p>
                      <p className="truncate text-[12px] leading-tight text-[#6B7280]">{role}</p>
                    </div>
                    {active && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF6B00]" aria-hidden />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Bottom divider and 'Настройки аккаунта' with Settings gear icon */}
            <div className="mx-1 my-1 border-t border-border" />
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                if (onOpenSettings) {
                  onOpenSettings();
                } else {
                  navigate(accountHref);
                }
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/60"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted/40">
                <Settings className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
              </span>
              <span className="truncate text-[15px]">{t("accountSettings")}</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default AccountSheet;
export { AccountSheet as BuyerAccountSheet };
