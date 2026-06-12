import { useEffect, useState } from "react";
import { useCreatorProducts } from "@/hooks/useProducts";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Library, Plus, Edit, FolderCog, Folder, FileText, Link as LinkIcon, Type, ChevronDown, ChevronRight } from "lucide-react";
import ProductMaterialsManager from "./ProductMaterialsManager";
import ProductSwitcher from "./ProductSwitcher";
import NoProductsEmptyState from "./NoProductsEmptyState";
import { useLanguage } from "@/contexts/LanguageContext";
import { useProductMaterials } from "@/hooks/useMaterials";
import MaterialsSearchBar from "@/components/materials/MaterialsSearchBar";
import { useMemo } from "react";

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

      {product && (
        <CreatorMaterialsReadOnlyList productId={product.id} />
      )}

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

interface Mat {
  id: string;
  title: string;
  type: string;
  parent_id?: string | null;
}

const CreatorMaterialsReadOnlyList = ({ productId }: { productId: string }) => {
  const { language } = useLanguage();
  const { data: allMaterials = [], isLoading } = useProductMaterials(productId, { creatorOnly: true });
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const q = query.trim().toLowerCase();
  const list = allMaterials as Mat[];

  const filtered = useMemo(() => {
    if (!q) return list.filter((m) => !m.parent_id);
    return list.filter((m) => m.title.toLowerCase().includes(q));
  }, [list, q]);

  const getIcon = (type: string) => {
    if (type === "folder") return <Folder className="w-4 h-4 text-primary" />;
    if (type === "link") return <LinkIcon className="w-4 h-4 text-primary" />;
    if (type === "text") return <Type className="w-4 h-4 text-primary" />;
    return <FileText className="w-4 h-4 text-primary" />;
  };

  const toggle = (id: string) =>
    setExpanded((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const childrenOf = (id: string) => list.filter((m) => m.parent_id === id);

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <MaterialsSearchBar value={query} onChange={setQuery} resultCount={filtered.length} />

      {filtered.length === 0 ? (
        <div className="text-center py-6 text-sm text-muted-foreground">
          {q
            ? language === "kk" ? "Ештеңе табылмады" : "Ничего не найдено"
            : language === "kk" ? "Әзірге материалдар жоқ" : "Пока нет материалов"}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((m) => (
            <MaterialNode
              key={m.id}
              material={m}
              childrenOf={childrenOf}
              expanded={expanded}
              toggle={toggle}
              getIcon={getIcon}
              flat={!!q}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const MaterialNode = ({
  material,
  childrenOf,
  expanded,
  toggle,
  getIcon,
  flat,
}: {
  material: Mat;
  childrenOf: (id: string) => Mat[];
  expanded: Set<string>;
  toggle: (id: string) => void;
  getIcon: (type: string) => JSX.Element;
  flat: boolean;
}) => {
  const isFolder = material.type === "folder";
  const isOpen = expanded.has(material.id);
  const kids = isFolder && !flat ? childrenOf(material.id) : [];
  return (
    <div>
      <Card
        className={isFolder && !flat ? "cursor-pointer hover:bg-accent/40 transition-colors" : ""}
        onClick={() => isFolder && !flat && toggle(material.id)}
      >
        <CardContent className="p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
            {getIcon(material.type)}
          </div>
          <p className="font-medium text-sm truncate flex-1" title={material.title}>{material.title}</p>
          {isFolder && !flat && (
            isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </CardContent>
      </Card>
      {isFolder && !flat && isOpen && kids.length > 0 && (
        <div className="ml-4 mt-2 space-y-2 border-l-2 border-border pl-2">
          {kids.map((c) => (
            <MaterialNode
              key={c.id}
              material={c}
              childrenOf={childrenOf}
              expanded={expanded}
              toggle={toggle}
              getIcon={getIcon}
              flat={flat}
            />
          ))}
        </div>
      )}
    </div>
  );
};