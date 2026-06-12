import { useEffect, useState } from "react";
import { useCreatorProducts } from "@/hooks/useProducts";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Library, Plus, Edit, FolderCog, Folder, FileText, Link as LinkIcon, Type, ChevronDown, ChevronRight, Pencil, Trash2, Download, ExternalLink, Check, X, FolderPlus } from "lucide-react";
import ProductMaterialsManager from "./ProductMaterialsManager";
import ProductSwitcher from "./ProductSwitcher";
import NoProductsEmptyState from "./NoProductsEmptyState";
import { useLanguage } from "@/contexts/LanguageContext";
import { useProductMaterials, useUpdateMaterial, useDeleteMaterial } from "@/hooks/useMaterials";
import MaterialsSearchBar from "@/components/materials/MaterialsSearchBar";
import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { isS3Path, isOfficeDocument, buildS3RedirectUrl, buildStorageRedirectUrl, parseStoragePath } from "@/lib/fileRedirect";
import { requestMaterialToken, buildProxyUrl } from "@/lib/materialToken";

interface Props { creatorName: string; onGoToProducts?: () => void; }

const CreatorMaterialsTab = ({ creatorName, onGoToProducts }: Props) => {
  const { data: products = [], isLoading } = useCreatorProducts();
  const { language } = useLanguage();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"add" | "edit" | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [addParentId, setAddParentId] = useState<string | null>(null);

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
        <CreatorMaterialsReadOnlyList
          productId={product.id}
          onAddInFolder={(folderId) => {
            setAddParentId(folderId);
            setMode("add");
          }}
        />
      )}

      {product && mode && (
        <ProductMaterialsManager
          productId={product.id}
          productTitle={product.title}
          isOpen={!!mode}
          mode={mode}
          initialFolderId={addParentId}
          onClose={() => { setMode(null); setAddParentId(null); }}
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
  file_url?: string | null;
  content?: string | null;
  allow_download?: boolean;
}

const CreatorMaterialsReadOnlyList = ({ productId, onAddInFolder }: { productId: string; onAddInFolder: (folderId: string) => void }) => {
  const { language } = useLanguage();
  const { data: allMaterials = [], isLoading } = useProductMaterials(productId, { creatorOnly: true });
  const updateMaterial = useUpdateMaterial();
  const deleteMaterial = useDeleteMaterial();
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingMat, setDeletingMat] = useState<Mat | null>(null);

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

  const getFileUrl = (m: Mat, action: 'view' | 'download'): string | null => {
    if (!m.file_url) return null;
    if (isS3Path(m.file_url)) {
      if (action === 'view' && isOfficeDocument(m.title)) return null;
      return buildS3RedirectUrl(m.file_url, 'creator', undefined, action === 'download' ? m.title : undefined);
    }
    const path = parseStoragePath(m.file_url);
    if (!path) return null;
    return buildStorageRedirectUrl(path, action === 'download' ? m.title : undefined);
  };

  const openMaterial = async (m: Mat) => {
    if (m.type === "link" && m.file_url) {
      window.open(m.file_url, "_blank");
      return;
    }
    if (m.type === "file" && m.file_url) {
      const vUrl = getFileUrl(m, 'view');
      if (vUrl) { window.open(vUrl, "_blank"); return; }
      if (isOfficeDocument(m.title) && isS3Path(m.file_url)) {
        const t = toast.loading(language === "kk" ? "Файл дайындалуда..." : "Подготовка файла...");
        try {
          const token = await requestMaterialToken(m.file_url, 'creator');
          const proxyUrl = buildProxyUrl(token);
          window.open(`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(proxyUrl)}`, '_blank');
        } catch (e) {
          toast.error(String(e instanceof Error ? e.message : e));
        } finally {
          toast.dismiss(t);
        }
      }
    }
  };

  const startRename = (m: Mat) => { setRenamingId(m.id); setRenameValue(m.title); };
  const cancelRename = () => { setRenamingId(null); setRenameValue(""); };
  const submitRename = async () => {
    if (!renamingId) return;
    const newTitle = renameValue.trim();
    if (!newTitle) return;
    try {
      await updateMaterial.mutateAsync({ id: renamingId, productId, title: newTitle });
      toast.success(language === "kk" ? "Сақталды" : "Сохранено");
      cancelRename();
    } catch {
      toast.error(language === "kk" ? "Қате" : "Ошибка");
    }
  };

  const confirmDelete = async () => {
    if (!deletingMat) return;
    try {
      await deleteMaterial.mutateAsync({ id: deletingMat.id, productId, file_url: deletingMat.file_url });
      toast.success(language === "kk" ? "Жойылды" : "Удалено");
      setDeletingMat(null);
    } catch {
      toast.error(language === "kk" ? "Қате" : "Ошибка");
    }
  };

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
              renamingId={renamingId}
              renameValue={renameValue}
              setRenameValue={setRenameValue}
              startRename={startRename}
              cancelRename={cancelRename}
              submitRename={submitRename}
              isSavingRename={updateMaterial.isPending}
              onDelete={(mat) => setDeletingMat(mat)}
              onOpen={openMaterial}
              getFileUrl={getFileUrl}
              language={language}
              onAddInFolder={onAddInFolder}
            />
          ))}
        </div>
      )}

      <AlertDialog open={!!deletingMat} onOpenChange={(o) => !o && setDeletingMat(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{language === "kk" ? "Жою керек пе?" : "Удалить?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {language === "kk"
                ? `"${deletingMat?.title}" жойылсын ба? Бұл әрекетті болдырмау мүмкін емес.`
                : `Удалить "${deletingMat?.title}"? Это действие нельзя отменить.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{language === "kk" ? "Болдырмау" : "Отмена"}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              {language === "kk" ? "Жою" : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  renamingId,
  renameValue,
  setRenameValue,
  startRename,
  cancelRename,
  submitRename,
  isSavingRename,
  onDelete,
  onOpen,
  getFileUrl,
  language,
  onAddInFolder,
}: {
  material: Mat;
  childrenOf: (id: string) => Mat[];
  expanded: Set<string>;
  toggle: (id: string) => void;
  getIcon: (type: string) => JSX.Element;
  flat: boolean;
  renamingId: string | null;
  renameValue: string;
  setRenameValue: (v: string) => void;
  startRename: (m: Mat) => void;
  cancelRename: () => void;
  submitRename: () => void;
  isSavingRename: boolean;
  onDelete: (m: Mat) => void;
  onOpen: (m: Mat) => void;
  getFileUrl: (m: Mat, action: 'view' | 'download') => string | null;
  language: string;
  onAddInFolder: (folderId: string) => void;
}) => {
  const isFolder = material.type === "folder";
  const isOpen = expanded.has(material.id);
  const kids = isFolder && !flat ? childrenOf(material.id) : [];
  const isRenaming = renamingId === material.id;
  const downloadUrl = material.type === "file" && material.file_url && material.allow_download !== false
    ? getFileUrl(material, 'download') : null;

  const handleCardClick = () => {
    if (isRenaming) return;
    if (isFolder && !flat) { toggle(material.id); return; }
    if (!isFolder) onOpen(material);
  };

  return (
    <div>
      <Card
        className={!isRenaming ? "cursor-pointer hover:bg-accent/40 transition-colors" : ""}
        onClick={handleCardClick}
      >
        <CardContent className="p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
            {getIcon(material.type)}
          </div>
          {isRenaming ? (
            <form
              className="flex-1 flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
              onSubmit={(e) => { e.preventDefault(); submitRename(); }}
            >
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                autoFocus
                className="h-8 text-sm"
              />
              <Button type="submit" size="icon" variant="ghost" className="h-8 w-8 min-h-0" disabled={isSavingRename}>
                {isSavingRename ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8 min-h-0" onClick={cancelRename}>
                <X className="w-4 h-4" />
              </Button>
            </form>
          ) : (
            <>
              <div className="flex items-center gap-1 min-w-0 flex-1">
                <p className="font-medium text-sm truncate" title={material.title}>{material.title}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 min-h-0 flex-shrink-0 text-muted-foreground"
                  title={language === "kk" ? "Атын өзгерту" : "Переименовать"}
                  onClick={(e) => { e.stopPropagation(); startRename(material); }}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                {isFolder && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 min-h-0"
                    title={language === "kk" ? "Папкаға қосу" : "Добавить в папку"}
                    onClick={() => onAddInFolder(material.id)}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                )}
                {downloadUrl && (
                  <a
                    href={downloadUrl}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground h-8 w-8"
                    title={language === "kk" ? "Жүктеу" : "Скачать"}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Download className="w-4 h-4" />
                  </a>
                )}
                {material.type === "link" && material.file_url && (
                  <a
                    href={material.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground h-8 w-8"
                    title={language === "kk" ? "Ашу" : "Открыть"}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 min-h-0 text-destructive hover:text-destructive"
                  title={language === "kk" ? "Жою" : "Удалить"}
                  onClick={() => onDelete(material)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                {isFolder && !flat && (
                  isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground ml-1" /> : <ChevronRight className="w-4 h-4 text-muted-foreground ml-1" />
                )}
              </div>
            </>
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
              renamingId={renamingId}
              renameValue={renameValue}
              setRenameValue={setRenameValue}
              startRename={startRename}
              cancelRename={cancelRename}
              submitRename={submitRename}
              isSavingRename={isSavingRename}
              onDelete={onDelete}
              onOpen={onOpen}
              getFileUrl={getFileUrl}
              language={language}
            />
          ))}
        </div>
      )}
    </div>
  );
};