import { useState } from "react";
import { useCreatorProducts } from "@/hooks/useProducts";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ChevronRight, Library } from "lucide-react";
import ProductMaterialsManager from "./ProductMaterialsManager";

interface Props { creatorName: string; }

const CreatorMaterialsTab = ({ creatorName }: Props) => {
  const { data: products = [], isLoading } = useCreatorProducts();
  const [selected, setSelected] = useState<string | null>(null);

  const product = products.find((p) => p.id === selected);

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Library className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Материалы</h2>
        </div>
        <p className="text-sm text-muted-foreground">Выберите продукт, чтобы управлять его материалами.</p>
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
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {product && (
        <ProductMaterialsManager
          productId={product.id}
          productTitle={product.title}
          isOpen={!!selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
};

export default CreatorMaterialsTab;