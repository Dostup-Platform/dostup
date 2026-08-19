import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowLeft, BookOpen, School } from "lucide-react";
import type { ProfileType } from "@/lib/creatorAuth";

interface SellerTypeScreenProps {
  onBack: () => void;
  onSelect: (type: Extract<ProfileType, "creator" | "school">) => void;
}

const SellerTypeScreen = ({ onBack, onSelect }: SellerTypeScreenProps) => {
  const { t } = useLanguage();

  return (
    <Card className="w-full max-w-md rounded-2xl animate-fade-in">
      <CardHeader className="pb-2">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
          <Button variant="ghost" size="sm" className="px-2 -ml-2" onClick={onBack} aria-label={t("back")}>
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline ml-1">{t("back")}</span>
          </Button>
          <CardTitle className="text-xl font-bold text-center truncate">{t("chooseAccountType")}</CardTitle>
          <span className="w-8 sm:w-16" aria-hidden />
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-2 pb-6">
        <Card
          className="cursor-pointer hover:border-primary transition-colors rounded-2xl"
          onClick={() => onSelect("creator")}
        >
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <BookOpen className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">{t("courseCreatorMode")}</h3>
              <p className="text-sm text-muted-foreground">{t("courseCreatorDescription")}</p>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-primary transition-colors rounded-2xl"
          onClick={() => onSelect("school")}
        >
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <School className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">{t("onlineSchoolMode")}</h3>
              <p className="text-sm text-muted-foreground">{t("onlineSchoolDescription")}</p>
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
};

export default SellerTypeScreen;
