import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { isDisplayNameValid } from "@/lib/displayName";

interface SellerNameScreenProps {
  initialValue?: string;
  onContinue: (displayName: string) => void;
}

const SellerNameScreen = ({ initialValue = "", onContinue }: SellerNameScreenProps) => {
  const { t } = useLanguage();
  const [value, setValue] = useState(initialValue);
  const valid = isDisplayNameValid(value);

  return (
    <Card className="w-full max-w-md rounded-2xl animate-fade-in">
      <CardContent className="space-y-4 pt-6 pb-6">
        <div className="space-y-2">
          <Label htmlFor="seller-display-name">{t("sellerNameLabel")}</Label>
          <Input
            id="seller-display-name"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t("sellerNamePlaceholder")}
            maxLength={100}
            autoFocus
          />
        </div>
        <Button
          type="button"
          className="w-full rounded-2xl"
          disabled={!valid}
          onClick={() => onContinue(value.trim())}
        >
          {t("continue")}
        </Button>
      </CardContent>
    </Card>
  );
};

export default SellerNameScreen;
