import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { isDisplayNameValid } from "@/lib/displayName";
import { LOGIN_CARD_CLASS } from "@/lib/loginModal";
import { cn } from "@/lib/utils";

interface DisplayNameOnboardingScreenProps {
  initialValue?: string;
  onContinue: (displayName: string) => void;
  saving?: boolean;
}

const DisplayNameOnboardingScreen = ({
  initialValue = "",
  onContinue,
  saving = false,
}: DisplayNameOnboardingScreenProps) => {
  const { t } = useLanguage();
  const [value, setValue] = useState(initialValue);
  const valid = isDisplayNameValid(value);

  return (
    <Card className={cn(LOGIN_CARD_CLASS, "motion-safe:animate-fade-in")}>
      <CardHeader className="pb-2 pt-14 text-center">
        <CardTitle className="text-2xl font-bold">{t("displayNameRequiredTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-2 pb-6">
        <p className="text-sm text-center text-muted-foreground">{t("buyerDisplayNameDescription")}</p>
        <div className="space-y-2">
          <Label htmlFor="buyer-display-name">{t("fullName")}</Label>
          <Input
            id="buyer-display-name"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t("namePlaceholder")}
            maxLength={100}
            autoFocus
          />
        </div>
        <Button
          type="button"
          className="w-full rounded-2xl"
          disabled={!valid || saving}
          onClick={() => onContinue(value.trim())}
        >
          {t("continue")}
        </Button>
      </CardContent>
    </Card>
  );
};

export default DisplayNameOnboardingScreen;
