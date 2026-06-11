import { useState } from "react";
import { useCreatorProducts } from "@/hooks/useProducts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronRight, Megaphone } from "lucide-react";
import ProductAnnouncementsManager from "./ProductAnnouncementsManager";

interface Props { creatorName: string; }

const CreatorAnnouncementsTab = ({ creatorName }: Props) => {
  const { data: products = [], isLoading } = useCreatorProducts();
  const [selected, setSelected] = useState<string | null>(null);

  const product = products.find((p) => p.id === selected);

  if (selected && product) {
    return (
      <ProductAnnouncementsManager
        productId={product.id}
        productTitle={product.title}
        initialGroupLinkUrl={(product as any).telegram_link || null}
        initialGroupLinkLabel={(product as any).group_link_label || null}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Megaphone className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Объявления</h2>
      </div>
      <p className="text-sm text-muted-foreground">Выберите продукт, чтобы управлять его объявлениями и ссылкой на чат/группу.</p>
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : products.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Пока нет продуктов.</p>
      ) : (
        <div className="space-y-2">
          {products.map((p) => (
            <Card key={p.id} className="cursor-pointer hover:bg-accent/40 transition-colors" onClick={() => setSelected(p.id)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-medium truncate">{p.title}</div>
                  {(p as any).telegram_link && (
                    <div className="text-xs text-muted-foreground truncate">Ссылка: {(p as any).telegram_link}</div>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default CreatorAnnouncementsTab;