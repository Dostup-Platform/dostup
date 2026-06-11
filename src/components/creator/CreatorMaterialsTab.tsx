import { useEffect, useState } from "react";
import { useCreatorProducts } from "@/hooks/useProducts";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Library, Plus, Edit, FolderCog } from "lucide-react";
import ProductMaterialsManager from "./ProductMaterialsManager";
import ProductSwitcher from "./ProductSwitcher";
import NoProductsEmptyState from "./NoProductsEmptyState";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props { creatorName: string; onGoToProducts?: () => void; }

const CreatorMaterialsTab = ({ creatorName, onGoToProducts }: Props) => {
  const { data: products = [], isLoading } = useCreatorProducts();
  const { language } = useLanguage();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"add" | "edit" | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!selectedId && products.length > 0) {
      setSelectedId(products[0].id);
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
          onChange={(id) => setSelectedId(id)}
        />
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" className="gap-2">
              <FolderCog className="w-4 h-4" />
              {language === "kk" ? "Материалдарды басқару" : "Управление материалами"}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-48 p-2">
            <div className="flex flex-col gap-1">
              <Button
                variant="ghost"
                className="justify-start gap-2"
                onClick={() => { setMode("add"); setMenuOpen(false); }}
              >
                <Plus className="w-4 h-4" />
                {language === "kk" ? "Қосу" : "Добавить"}
              </Button>
              <Button
                variant="ghost"
                className="justify-start gap-2"
                onClick={() => { setMode("edit"); setMenuOpen(false); }}
              >
                <Edit className="w-4 h-4" />
                {language === "kk" ? "Өңдеу" : "Редактировать"}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {product && mode && (
        <ProductMaterialsManager
          productId={product.id}
          productTitle={product.title}
          isOpen={!!mode}
          mode={mode}
          onClose={() => setMode(null)}
        />
      )}
    </div>
  );
};

export default CreatorMaterialsTab;