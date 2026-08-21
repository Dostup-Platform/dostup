import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { type AppProfile, type ProfileType } from "@/lib/creatorAuth";
import { BookOpen, GraduationCap, Loader2, School } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const ROLE_OPTIONS: {
  type: ProfileType;
  icon: typeof BookOpen;
  labelKey: "profileCreator" | "profileSchool" | "profileBuyer";
}[] = [
  { type: "creator", icon: BookOpen, labelKey: "profileCreator" },
  { type: "school", icon: School, labelKey: "profileSchool" },
  { type: "buyer", icon: GraduationCap, labelKey: "profileBuyer" },
];

interface ProfileSwitcherProps {
  activeType?: ProfileType | string | null;
  profiles?: AppProfile[];
}

const ProfileSwitcher = ({ activeType, profiles: profilesProp }: ProfileSwitcherProps) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { profiles: ctxProfiles, profileType, switchProfile } = useSimpleAuth();
  const profiles = profilesProp ?? ctxProfiles;
  const currentType =
    profileType ?? activeType ?? (localStorage.getItem("profile_type") as ProfileType | null);
  const [busyType, setBusyType] = useState<ProfileType | null>(null);

  const runSwitch = async (type: ProfileType) => {
    if (type === currentType || busyType) return;
    const existing = profiles.find((p) => p.type === type);
    setBusyType(type);
    const result = await switchProfile(
      existing ? { profileId: existing.id } : { createType: type },
    );
    setBusyType(null);
    if ("error" in result) {
      if (result.error === "network_failure") {
        toast.error(t("networkFailure"));
      } else if (result.error === "identity_required") {
        toast.error(t("switchProfileIdentityRequired"));
      } else if (result.error === "Account blocked" || result.error === "account_blocked") {
        toast.error(t("accountBlocked"));
      } else {
        toast.error(t("switchProfileError"));
      }
      return;
    }
    navigate(result.path);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("switchProfileTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {ROLE_OPTIONS.map(({ type, icon: Icon, labelKey }) => {
          const active = type === currentType;
          const busy = busyType === type;
          return (
            <div
              key={type}
              className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${
                active ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <p className="font-medium text-sm">{t(labelKey)}</p>
              </div>
              {active ? (
                <span className="text-xs font-medium text-[#FF6B00] shrink-0">
                  {t("currentProfile")}
                </span>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busyType !== null}
                  onClick={() => void runSwitch(type)}
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : t("switchProfileAction")}
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default ProfileSwitcher;
