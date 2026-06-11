import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Package, ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  section: "materials" | "announcements" | "schedule";
  onGoToProducts?: () => void;
}

const NoProductsEmptyState = ({ section, onGoToProducts }: Props) => {
  const { language } = useLanguage();

  const titleMap = {
    materials: { ru: "Сначала создайте продукт, чтобы прикрепить материалы", kk: "Материалдар қосу үшін алдымен өнім жасаңыз" },
    announcements: { ru: "Сначала создайте продукт, чтобы публиковать объявления", kk: "Хабарландыру жариялау үшін алдымен өнім жасаңыз" },
    schedule: { ru: "Сначала создайте продукт, чтобы добавить расписание", kk: "Кесте жасау үшін алдымен өнім жасаңыз" },
  };
  const text = titleMap[section][language === "kk" ? "kk" : "ru"];

  return (
    <Card>
      <CardContent className="py-10 text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-full bg-muted flex items-center justify-center">
          <Package className="w-7 h-7 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground max-w-md mx-auto">{text}</p>
        {onGoToProducts && (
          <Button onClick={onGoToProducts} size="sm" className="gap-2">
            {language === "kk" ? "Өнімдер бөліміне өту" : "Перейти в раздел Продукты"}
            <ArrowRight className="w-4 h-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default NoProductsEmptyState;