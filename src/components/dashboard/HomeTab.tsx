import { useMemo } from "react";
import { useSimplePurchases } from "@/hooks/useSimplePurchases";
import { useAnnouncementsForProducts } from "@/hooks/useAnnouncements";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Home as HomeIcon, Loader2 } from "lucide-react";
import AnnouncementView from "./AnnouncementView";
import { useLanguage } from "@/contexts/LanguageContext";

interface HomeTabProps {
  onBrowseCourses?: () => void;
}

const HomeTab = ({ onBrowseCourses }: HomeTabProps) => {
  const { language, t } = useLanguage();
  const { data: purchases = [], isLoading: purchasesLoading } = useSimplePurchases();
  const productIds = useMemo(() => [...new Set(purchases.map((p) => p.product_id))], [purchases]);
  const { data: announcements = [], isLoading: annLoading } = useAnnouncementsForProducts(productIds);

  const grouped = useMemo(() => {
    return purchases.map((p) => ({
      purchase: p,
      announcements: [...announcements.filter((a) => a.product_id === p.product_id)].reverse(),
    }));
  }, [purchases, announcements]);

  if (purchasesLoading || annLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (purchases.length === 0) {
    return (
      <div className="text-center py-12">
        <HomeIcon className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
        <p className="text-muted-foreground">
          {language === "ru" ? "Пока нет доступных курсов" : "Қол жетімді курстар жоқ"}
        </p>
        {onBrowseCourses && (
          <Button className="mt-4" onClick={onBrowseCourses}>
            {t("browseCourses")}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {grouped.map(({ purchase, announcements: items }) => {
        const product = purchase.product;
        if (!product) return null;
        const label = product.group_link_label?.trim() || (language === "ru" ? "Ссылка на группу/чат" : "Топ/чат сілтемесі");
        return (
          <div key={purchase.id} className="space-y-3">
            <h3 className="font-semibold text-foreground">{product.title}</h3>

            {product.telegram_link && (
              <a
                href={product.telegram_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center px-4 py-3 rounded-lg bg-[hsl(200,80%,50%)]/10 text-[hsl(200,80%,40%)] hover:bg-[hsl(200,80%,50%)]/20 transition-colors font-medium text-sm"
              >
                {label}
              </a>
            )}

            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {language === "ru" ? "Пока нет объявлений" : "Әзірге хабарландырулар жоқ"}
              </p>
            ) : (
              <div className="space-y-2">
                {items.map((a) => (
                  <Card key={a.id}>
                    <CardContent className="p-4">
                      <AnnouncementView html={a.content_html} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default HomeTab;