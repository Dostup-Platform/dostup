import { useEffect, useState } from "react";
import { useCreatorProducts } from "@/hooks/useProducts";
import { Button } from "@/components/ui/button";
import { Loader2, Library, Plus } from "lucide-react";
import ProductMaterialsManager from "./ProductMaterialsManager";
import ProductSwitcher from "./ProductSwitcher";
import NoProductsEmptyState from "./NoProductsEmptyState";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props { creatorName: string; onGoToProducts?: () => void; }

const CreatorMaterialsTab = ({ creatorName, onGoToProducts }: Props) => {
  const { data: products = [], isLoading } = useCreatorProducts();
  const { language } = useLanguage();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [managerOpen, setManagerOpen] = useState(false);

  useEffect(() => {
    if (!selectedId && products.length > 0) {
      setSelectedId(products[0].id);
      setManagerOpen(true);
    }
  }, [products, selectedId]);

  const product = products.find((p) => p.id === selectedId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Library className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">{language === "kk" ? "Материалдар" : "Материалы"}</h2>
        </div>
        <NoProductsEmptyState section="materials" onGoToProducts={onGoToProducts} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <ProductSwitcher
          products={products.map((p) => ({ id: p.id, title: p.title }))}
          selectedId={selectedId}
          onChange={(id) => { setSelectedId(id); setManagerOpen(true); }}
        />
        <Button size="sm" onClick={() => setManagerOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          {language === "kk" ? "Материалдарды басқару" : "Управлять материалами"}
        </Button>
      </div>

      {product && (
        <ProductMaterialsManager
          productId={product.id}
          productTitle={product.title}
          isOpen={managerOpen}
          onClose={() => setManagerOpen(false)}
        />
      )}
    </div>
  );
};

export default CreatorMaterialsTab;