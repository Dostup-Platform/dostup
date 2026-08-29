import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { type ProfileType } from "@/lib/creatorAuth";
import { LOGIN_CARD_CLASS } from "@/lib/loginModal";
import { cn } from "@/lib/utils";
import { BookOpen, Loader2, School, ShoppingBag } from "lucide-react";

const ROLE_OPTIONS: {
  type: ProfileType;
  icon: typeof BookOpen;
  titleKey: "roleBuyer" | "roleCreator" | "roleSchool";
  descriptionKey: "roleBuyerDescription" | "roleCreatorDescription" | "roleSchoolDescription";
}[] = [
  {
    type: "buyer",
    icon: ShoppingBag,
    titleKey: "roleBuyer",
    descriptionKey: "roleBuyerDescription",
  },
  {
    type: "creator",
    icon: BookOpen,
    titleKey: "roleCreator",
    descriptionKey: "roleCreatorDescription",
  },
  {
    type: "school",
    icon: School,
    titleKey: "roleSchool",
    descriptionKey: "roleSchoolDescription",
  },
];

interface RoleSelectionScreenProps {
  onSelect: (type: ProfileType) => void | Promise<void>;
  types?: ProfileType[];
}

const RoleSelectionScreen = ({ onSelect, types }: RoleSelectionScreenProps) => {
  const { t } = useLanguage();
  const [busyType, setBusyType] = useState<ProfileType | null>(null);
  const options = types?.length
    ? ROLE_OPTIONS.filter((option) => types.includes(option.type))
    : ROLE_OPTIONS;

  const handleSelect = async (type: ProfileType) => {
    if (busyType) return;
    setBusyType(type);
    try {
      await onSelect(type);
    } finally {
      setBusyType(null);
    }
  };

  return (
    <Card className={cn(LOGIN_CARD_CLASS, "motion-safe:animate-fade-in")}>
      <CardHeader className="pb-2 pt-14 text-center">
        <CardTitle className="text-2xl font-bold">{t("chooseYourRole")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-2 pb-6">
        {options.map(({ type, icon: Icon, titleKey, descriptionKey }) => {
          const busy = busyType === type;
          return (
            <button
              key={type}
              type="button"
              disabled={busyType !== null}
              onClick={() => void handleSelect(type)}
              className="w-full rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-70"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  {busy ? (
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  ) : (
                    <Icon className="h-6 w-6 text-primary" />
                  )}
                </div>
                <div className="min-w-0 space-y-1.5">
                  <h3 className="text-lg font-bold leading-tight">{t(titleKey)}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{t(descriptionKey)}</p>
                </div>
              </div>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default RoleSelectionScreen;
