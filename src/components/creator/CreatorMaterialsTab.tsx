import { useEffect, useState } from "react";
import { useCreatorProducts } from "@/hooks/useProducts";
import { useProductMaterials } from "@/hooks/useMaterials";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Library, Plus, Folder, FileText, Link as LinkIcon, Type } from "lucide-react";
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
    }
  }, [products, selectedId]);

  const product = products.find((p) => p.id === selectedId);
  const { data: materials = [], isLoading: materialsLoading } = useProductMaterials(
    selectedId || undefined,
    { creatorOnly: true }
  );
  const rootMaterials = materials.filter((m) => !m.parent_id);

  const iconFor = (type: string) => {
    if (type === "folder") return <Folder className="w-4 h-4 text-primary" />;
    if (type === "link") return <LinkIcon className="w-4 h-4 text-primary" />;
    if (type === "text") return <Type className="w-4 h-4 text-primary" />;
    return <FileText className="w-4 h-4 text-primary" />;
  };
  const typeLabel = (type: string) => {
    const map: Record<string, { ru: string; kk: string }> = {
      folder: { ru: "Папка", kk: "Қалта" },
      link: { ru: "Ссылка", kk: "Сілтеме" },
      text: { ru: "Текст", kk: "Мәтін" },
      file: { ru: "Файл", kk: "Файл" },
      video: { ru: "Видео", kk: "Видео" },
    };
    const v = map[type] || map.file;
    return language === "kk" ? v.kk : v.ru;
  };

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
        <Button size="sm" onClick={() => setManagerOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          {language === "kk" ? "Материал қосу" : "Добавить материалы"}
        </Button>
      </div>

      {materialsLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : rootMaterials.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          {language === "kk" ? "Әзірге материалдар жоқ" : "Материалов пока нет"}
        </div>
      ) : (
        <div className="space-y-2">
          {rootMaterials.map((m) => (
            <Card
              key={m.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setManagerOpen(true)}
            >
              <CardContent className="p-3 flex items-center gap-3">
                {iconFor(m.type)}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{m.title}</div>
                  <div className="text-xs text-muted-foreground">{typeLabel(m.type)}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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