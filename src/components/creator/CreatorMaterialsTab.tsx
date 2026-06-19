import { useEffect, useState } from "react";
import { useCreatorProducts } from "@/hooks/useProducts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Loader2, Library, Plus, Folder, FileText, Link as LinkIcon, Type,
  ChevronRight, Pencil, Trash2, Download, ExternalLink, Check, X,
  GripVertical, Home, ArrowUpDown
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const CreatorMaterialsTab = ({ creatorName, onGoToProducts }: Props) => {
  const { data: products = [], isLoading } = useCreatorProducts();
  const { language } = useLanguage();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"add" | "edit" | null>(null);
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
        <Button size="sm" className="gap-2" onClick={() => { setAddParentId(null); setMode("add"); }}>
          <Plus className="w-4 h-4" />
          {language === "kk" ? "Материалдар қосу" : "Добавить материалы"}
        </Button>
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

type ListProps = {
  items: Mat[];
  childrenOf: (id: string) => Mat[];
  getIcon: (type: string) => JSX.Element;
  flat: boolean;
  onOpenFolder: (id: string) => void;
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
  draggingId: string | null;
  dragOverId: string | null;
  dropPosition: "before" | "after" | "inside" | null;
  setDraggingId: (id: string | null) => void;
  setDragOverId: (id: string | null) => void;
  setDropPosition: (p: "before" | "after" | "inside" | null) => void;
  onReorder: (draggedId: string, targetId: string, position: "before" | "after" | "inside") => void;
  isNoop: (draggedId: string, targetId: string, position: "before" | "after" | "inside") => boolean;
  draggedParentId: string | null;
};

const MaterialList = (props: ListProps) => {
  const {
    items,
    draggingId,
    dragOverId,
    dropPosition,
    isNoop,
    setDragOverId,
    setDropPosition,
    setDraggingId,
    onReorder,
  } = props;

  const isGapLit = (gapIndex: number): boolean => {
    if (!draggingId || !dragOverId || !dropPosition || dropPosition === "inside") return false;
    const overIdx = items.findIndex((it) => it.id === dragOverId);
    if (overIdx === -1) return false;
    const targetGap = dropPosition === "before" ? overIdx : overIdx + 1;
    if (targetGap !== gapIndex) return false;
    return !isNoop(draggingId, dragOverId, dropPosition);
  };

  // Привязываем гэп к карточке: гэп 0 = before items[0], остальные = after items[i-1].
  const resolveGapTarget = (gapIndex: number): { targetId: string; position: "before" | "after" } | null => {
    if (items.length === 0) return null;
    if (gapIndex === 0) return { targetId: items[0].id, position: "before" };
    const prev = items[gapIndex - 1];
    if (!prev) return null;
    return { targetId: prev.id, position: "after" };
  };

  const Gap = ({ index }: { index: number }) => {
    const lit = isGapLit(index);
    const handleOver = (e: React.DragEvent) => {
      if (!draggingId) return;
      const t = resolveGapTarget(index);
      if (!t || t.targetId === draggingId) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      if (dragOverId !== t.targetId) setDragOverId(t.targetId);
      if (dropPosition !== t.position) setDropPosition(t.position);
    };
    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const id = draggingId;
      const t = resolveGapTarget(index);
      setDragOverId(null);
      setDropPosition(null);
      setDraggingId(null);
      if (id && t && t.targetId !== id && !isNoop(id, t.targetId, t.position)) {
        onReorder(id, t.targetId, t.position);
      }
    };
    return (
      <div
        className="relative h-4"
        onDragEnter={handleOver}
        onDragOver={handleOver}
        onDrop={handleDrop}
      >
        <div
          className={`absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 rounded transition-colors ${lit ? "bg-primary" : "bg-transparent"}`}
        />
      </div>
    );
  };

  // Большие крайние посадочные зоны: верх списка и пустая область под списком.
  const EdgeZone = ({ edge }: { edge: "top" | "bottom" }) => {
    if (items.length === 0) return null;
    const target = edge === "top" ? items[0] : items[items.length - 1];
    const position: "before" | "after" = edge === "top" ? "before" : "after";
    const active =
      !!draggingId &&
      dragOverId === target.id &&
      dropPosition === position &&
      !isNoop(draggingId, target.id, position);
    const handleOver = (e: React.DragEvent) => {
      if (!draggingId || draggingId === target.id) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      if (dragOverId !== target.id) setDragOverId(target.id);
      if (dropPosition !== position) setDropPosition(position);
    };
    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const id = draggingId;
      setDragOverId(null);
      setDropPosition(null);
      setDraggingId(null);
      if (id && id !== target.id && !isNoop(id, target.id, position)) {
        onReorder(id, target.id, position);
      }
    };
    return (
      <div
        className={`relative ${edge === "bottom" ? "flex-1" : ""}`}
        style={{ minHeight: edge === "top" ? 36 : 96 }}
        onDragEnter={handleOver}
        onDragOver={handleOver}
        onDrop={handleDrop}
      >
        <div className={`absolute left-0 right-0 ${edge === "top" ? "bottom-2" : "top-2"} h-px rounded transition-colors ${active ? "bg-primary" : "bg-transparent"}`} />
      </div>
    );
  };

  const getContainerEdgeTarget = (e: React.DragEvent): { targetId: string; position: "before" | "after" } | null => {
    if (items.length === 0) return null;
    const cards = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("[data-material-card='true']"));
    const firstCard = cards[0];
    const lastCard = cards[cards.length - 1];
    if (!firstCard || !lastCard) return null;
    const firstRect = firstCard.getBoundingClientRect();
    const lastRect = lastCard.getBoundingClientRect();
    if (e.clientY <= firstRect.top + firstRect.height / 2) {
      return { targetId: items[0].id, position: "before" };
    }
    if (e.clientY >= lastRect.top + lastRect.height / 2) {
      return { targetId: items[items.length - 1].id, position: "after" };
    }
    return null;
  };

  // Fallback на уровне контейнера: если дроп прошёл мимо карточек/гэпов,
  // всё равно кладём материал в самый верх или самый низ по положению курсора.
  const handleContainerOver = (e: React.DragEvent) => {
    if (!draggingId || items.length === 0) return;
    const target = getContainerEdgeTarget(e);
    if (!target || target.targetId === draggingId || isNoop(draggingId, target.targetId, target.position)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverId !== target.targetId) setDragOverId(target.targetId);
    if (dropPosition !== target.position) setDropPosition(target.position);
  };
  const handleContainerDrop = (e: React.DragEvent) => {
    if (!draggingId || items.length === 0) return;
    const target = getContainerEdgeTarget(e);
    if (!target || target.targetId === draggingId || isNoop(draggingId, target.targetId, target.position)) return;
    e.preventDefault();
    const id = draggingId;
    setDragOverId(null);
    setDropPosition(null);
    setDraggingId(null);
    onReorder(id, target.targetId, target.position);
  };

  return (
    <div
      className={`flex flex-col ${draggingId ? "min-h-[45vh]" : ""}`}
      onDragOver={handleContainerOver}
      onDrop={handleContainerDrop}
    >
      <EdgeZone edge="top" />
      {items.map((m, i) => (
        <div key={m.id} className="flex flex-col">
          <MaterialNode
            material={m}
            getIcon={props.getIcon}
            flat={props.flat}
            onOpenFolder={props.onOpenFolder}
            renamingId={props.renamingId}
            renameValue={props.renameValue}
            setRenameValue={props.setRenameValue}
            startRename={props.startRename}
            cancelRename={props.cancelRename}
            submitRename={props.submitRename}
            isSavingRename={props.isSavingRename}
            onDelete={props.onDelete}
            onOpen={props.onOpen}
            getFileUrl={props.getFileUrl}
            language={props.language}
            onAddInFolder={props.onAddInFolder}
            draggingId={props.draggingId}
            dragOverId={props.dragOverId}
            dropPosition={props.dropPosition}
            setDraggingId={props.setDraggingId}
            setDragOverId={props.setDragOverId}
            setDropPosition={props.setDropPosition}
            onReorder={props.onReorder}
            isNoop={props.isNoop}
            draggedParentId={props.draggedParentId}
          />
          {i < items.length - 1 && <Gap index={i + 1} />}
        </div>
      ))}
      <EdgeZone edge="bottom" />
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
  created_at?: string;
}

const CreatorMaterialsReadOnlyList = ({ productId, onAddInFolder }: { productId: string; onAddInFolder: (folderId: string) => void }) => {
  const { language } = useLanguage();
  const { data: allMaterials = [], isLoading } = useProductMaterials(productId, { creatorOnly: true });
  const updateMaterial = useUpdateMaterial();
  const deleteMaterial = useDeleteMaterial();
  const [query, setQuery] = useState("");
  const [folderPath, setFolderPath] = useState<Mat[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingMat, setDeletingMat] = useState<Mat | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<"before" | "after" | "inside" | null>(null);
  // Подсветка крошки (breadcrumb), на которую тащат материал.
  // "home" → корень; иначе id папки из folderPath.
  const [dragOverCrumb, setDragOverCrumb] = useState<string | null>(null);

  type SortMode = "newest" | "oldest" | "manual";
  const SORT_STORAGE_KEY = "creator-materials-sort-mode";
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    if (typeof window === "undefined") return "newest";
    const saved = window.localStorage.getItem(SORT_STORAGE_KEY);
    if (saved === "newest" || saved === "oldest" || saved === "manual") return saved;
    return "newest";
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SORT_STORAGE_KEY, sortMode);
    }
  }, [sortMode]);

  const q = query.trim().toLowerCase();
  const list = allMaterials as Mat[];
  const draggedItem = draggingId ? list.find((m) => m.id === draggingId) ?? null : null;
  const draggedParentId = draggedItem?.parent_id ?? null;
  const currentFolderId = folderPath.length > 0 ? folderPath[folderPath.length - 1].id : null;

  // Если текущая папка была удалена/переименована-перемещена, чистим путь до валидной части.
  useEffect(() => {
    if (folderPath.length === 0) return;
    const validPath: Mat[] = [];
    let expectedParent: string | null = null;
    for (const f of folderPath) {
      const fresh = list.find((m) => m.id === f.id);
      if (!fresh || fresh.type !== "folder" || (fresh.parent_id ?? null) !== expectedParent) break;
      validPath.push(fresh);
      expectedParent = fresh.id;
    }
    if (validPath.length !== folderPath.length) setFolderPath(validPath);
  }, [list]);

  const filtered = useMemo(() => {
    const base = !q
      ? list.filter((m) => (m.parent_id ?? null) === currentFolderId)
      : list.filter((m) => m.title.toLowerCase().includes(q));
    if (sortMode === "manual") return base;
    const sorted = base.slice().sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return sortMode === "newest" ? tb - ta : ta - tb;
    });
    return sorted;
  }, [list, q, currentFolderId, sortMode]);

  const getIcon = (type: string) => {
    if (type === "folder") return <Folder className="w-4 h-4 text-primary" />;
    if (type === "link") return <LinkIcon className="w-4 h-4 text-primary" />;
    if (type === "text") return <Type className="w-4 h-4 text-primary" />;
    return <FileText className="w-4 h-4 text-primary" />;
  };

  const openFolder = (id: string) => {
    const folder = list.find((m) => m.id === id);
    if (!folder || folder.type !== "folder") return;
    setFolderPath((p) => [...p, folder]);
  };

  const goToPathIndex = (index: number) => {
    // index = -1 → дом (корень)
    if (index < 0) setFolderPath([]);
    else setFolderPath((p) => p.slice(0, index + 1));
  };

  const childrenOf = (id: string) => list.filter((m) => m.parent_id === id);

  const siblingsOf = (parentId: string | null) =>
    list
      .filter((m) => (m.parent_id ?? null) === parentId)
      .slice()
      .sort((a, b) => list.indexOf(a) - list.indexOf(b));

  // Returns true if dropping `draggedId` at `position` relative to `targetId`
  // would not change anything (already in that spot).
  const isNoop = (
    draggedId: string,
    targetId: string,
    position: "before" | "after" | "inside",
  ): boolean => {
    if (draggedId === targetId) return true;
    const dragged = list.find((m) => m.id === draggedId);
    const target = list.find((m) => m.id === targetId);
    if (!dragged || !target) return false;
    if (position === "inside") {
      return dragged.parent_id === target.id;
    }
    const targetParent = target.parent_id ?? null;
    if ((dragged.parent_id ?? null) !== targetParent) return false;
    const sibs = siblingsOf(targetParent);
    const di = sibs.findIndex((s) => s.id === draggedId);
    const ti = sibs.findIndex((s) => s.id === targetId);
    if (di === -1 || ti === -1) return false;
    if (position === "before") return di === ti - 1 || di === ti;
    return di === ti + 1 || di === ti;
  };

  const isDescendant = (parentId: string, maybeChildId: string): boolean => {
    let cur = list.find((m) => m.id === maybeChildId);
    while (cur?.parent_id) {
      if (cur.parent_id === parentId) return true;
      cur = list.find((m) => m.id === cur!.parent_id);
    }
    return false;
  };

  const reorder = async (
    draggedId: string,
    targetId: string,
    position: "before" | "after" | "inside",
  ) => {
    if (draggedId === targetId) return;
    const dragged = list.find((m) => m.id === draggedId);
    const target = list.find((m) => m.id === targetId);
    if (!dragged || !target) return;
    if (dragged.type === "folder" && isDescendant(draggedId, targetId)) return;

    let newParent: string | null;
    if (position === "inside") {
      if (target.type !== "folder") return;
      newParent = target.id;
    } else {
      newParent = target.parent_id ?? null;
    }

    const siblings = list
      .filter((m) => (m.parent_id ?? null) === newParent && m.id !== draggedId)
      .slice()
      .sort((a, b) => list.indexOf(a) - list.indexOf(b));

    let insertIdx: number;
    if (position === "inside") {
      insertIdx = siblings.length;
    } else {
      const ti = siblings.findIndex((s) => s.id === targetId);
      insertIdx = position === "before" ? ti : ti + 1;
      if (insertIdx < 0) insertIdx = siblings.length;
    }
    siblings.splice(insertIdx, 0, dragged);

    try {
      await Promise.all(
        siblings.map((s, i) =>
          updateMaterial.mutateAsync({
            id: s.id,
            productId,
            order_index: i,
            ...(s.id === draggedId ? { parent_id: newParent } : {}),
          }),
        ),
      );
    } catch {
      toast.error(language === "kk" ? "Қате" : "Ошибка");
    }
  };

  // Перенос материала в самый верх указанной папки (или корня, если targetFolderId = null).
  const moveToFolderTop = async (draggedId: string, targetFolderId: string | null) => {
    const dragged = list.find((m) => m.id === draggedId);
    if (!dragged) return;
    if (dragged.type === "folder" && targetFolderId && isDescendant(draggedId, targetFolderId)) return;
    const currentSibs = siblingsOf(targetFolderId);
    if ((dragged.parent_id ?? null) === targetFolderId && currentSibs[0]?.id === draggedId) return;

    const siblings = list
      .filter((m) => (m.parent_id ?? null) === targetFolderId && m.id !== draggedId)
      .slice()
      .sort((a, b) => list.indexOf(a) - list.indexOf(b));
    siblings.unshift(dragged);
    try {
      await Promise.all(
        siblings.map((s, i) =>
          updateMaterial.mutateAsync({
            id: s.id,
            productId,
            order_index: i,
            ...(s.id === draggedId ? { parent_id: targetFolderId } : {}),
          }),
        ),
      );
    } catch {
      toast.error(language === "kk" ? "Қате" : "Ошибка");
    }
  };

  // Обработчики drag-over/drop для крошек (Home + папки в пути).
  const makeCrumbDnD = (crumbId: string | "home", targetFolderId: string | null) => {
    const canDrop = (): boolean => {
      if (!draggingId) return false;
      const dragged = list.find((m) => m.id === draggingId);
      if (!dragged) return false;
      if (dragged.type === "folder" && targetFolderId && isDescendant(draggingId, targetFolderId)) return false;
      // Запрещаем перенос в ту же папку.
      if ((dragged.parent_id ?? null) === targetFolderId) return false;
      return true;
    };
    return {
      onDragOver: (e: React.DragEvent) => {
        if (!canDrop()) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "copy";
        setDragOverId(null);
        setDropPosition(null);
        if (dragOverCrumb !== crumbId) setDragOverCrumb(crumbId);
      },
      onDragEnter: (e: React.DragEvent) => {
        if (!canDrop()) return;
        e.preventDefault();
        e.stopPropagation();
        setDragOverId(null);
        setDropPosition(null);
        if (dragOverCrumb !== crumbId) setDragOverCrumb(crumbId);
      },
      onDragLeave: (e: React.DragEvent) => {
        e.stopPropagation();
        setDragOverCrumb((cur) => (cur === crumbId ? null : cur));
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const id = draggingId;
        setDragOverCrumb(null);
        setDragOverId(null);
        setDropPosition(null);
        setDraggingId(null);
        if (id && canDrop()) {
          moveToFolderTop(id, targetFolderId);
        }
      },
    };
  };

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
      {/* Гасим нативный drag-over у поисковой строки, чтобы при перетаскивании
          материала не появлялся плюсик-курсор копирования. */}
      <div
        className="flex items-center gap-2"
        onDragOver={(e) => {
          if (draggingId) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "none";
          }
        }}
        onDrop={(e) => {
          if (draggingId) e.preventDefault();
        }}
      >
        <div className="flex-1 min-w-0">
          <MaterialsSearchBar value={query} onChange={setQuery} resultCount={filtered.length} />
        </div>
        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm flex-shrink-0"
          aria-label={language === "kk" ? "Сұрыптау" : "Сортировка"}
          title={language === "kk" ? "Сұрыптау" : "Сортировка"}
        >
          <option value="newest">{language === "kk" ? "Алдымен жаңалары" : "Сначала новые"}</option>
          <option value="oldest">{language === "kk" ? "Алдымен ескілері" : "Сначала старые"}</option>
          <option value="manual">{language === "kk" ? "Қолмен" : "Вручную"}</option>
        </select>
      </div>

      {!q && folderPath.length > 0 && (
        <nav className="flex items-center gap-1 text-sm flex-wrap" aria-label="breadcrumb">
          <button
            type="button"
            onClick={() => goToPathIndex(-1)}
            {...makeCrumbDnD("home", null)}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-accent text-muted-foreground hover:text-white transition-colors ${dragOverCrumb === "home" ? "bg-accent text-white ring-2 ring-primary" : ""}`}
          >
            <Home className="w-3.5 h-3.5" />
            {language === "kk" ? "Үй" : "Дом"}
          </button>
          {folderPath.map((f, i) => (
            <div key={f.id} className="flex items-center gap-1">
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              {i === folderPath.length - 1 ? (
                <span
                  {...makeCrumbDnD(f.id, f.id)}
                  className={`px-2 py-1 font-medium truncate max-w-[180px] rounded-md transition-colors ${dragOverCrumb === f.id ? "bg-accent text-white ring-2 ring-primary" : ""}`}
                  title={f.title}
                >
                  {f.title}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => goToPathIndex(i)}
                  {...makeCrumbDnD(f.id, f.id)}
                  className={`px-2 py-1 rounded-md hover:bg-accent text-muted-foreground hover:text-white transition-colors truncate max-w-[180px] ${dragOverCrumb === f.id ? "bg-accent text-white ring-2 ring-primary" : ""}`}
                  title={f.title}
                >
                  {f.title}
                </button>
              )}
            </div>
          ))}
        </nav>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-6 text-sm text-muted-foreground">
          {q
            ? language === "kk" ? "Ештеңе табылмады" : "Ничего не найдено"
            : language === "kk" ? "Әзірге материалдар жоқ" : "Пока нет материалов"}
        </div>
      ) : (
        <MaterialList
          items={filtered}
          childrenOf={childrenOf}
          getIcon={getIcon}
          flat={!!q}
          onOpenFolder={openFolder}
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
          draggingId={draggingId}
          dragOverId={dragOverId}
          dropPosition={dropPosition}
          setDraggingId={setDraggingId}
          setDragOverId={setDragOverId}
          setDropPosition={setDropPosition}
          onReorder={reorder}
          isNoop={isNoop}
          draggedParentId={draggedParentId}
        />
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
  getIcon,
  flat,
  onOpenFolder,
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
  draggingId,
  dragOverId,
  dropPosition,
  setDraggingId,
  setDragOverId,
  setDropPosition,
  onReorder,
  isNoop,
  draggedParentId,
}: {
  material: Mat;
  getIcon: (type: string) => JSX.Element;
  flat: boolean;
  onOpenFolder: (id: string) => void;
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
  draggingId: string | null;
  dragOverId: string | null;
  dropPosition: "before" | "after" | "inside" | null;
  setDraggingId: (id: string | null) => void;
  setDragOverId: (id: string | null) => void;
  setDropPosition: (p: "before" | "after" | "inside" | null) => void;
  onReorder: (draggedId: string, targetId: string, position: "before" | "after" | "inside") => void;
  isNoop: (draggedId: string, targetId: string, position: "before" | "after" | "inside") => boolean;
  draggedParentId: string | null;
}) => {
  const isFolder = material.type === "folder";
  const isRenaming = renamingId === material.id;
  const downloadUrl = material.type === "file" && material.file_url && material.allow_download !== false
    ? getFileUrl(material, 'download') : null;
  const isActiveTarget = !!(dragOverId === material.id && draggingId && draggingId !== material.id);
  const positionIsNoop = isActiveTarget && dropPosition
    ? isNoop(draggingId!, material.id, dropPosition)
    : false;
  const showInsideRing = isActiveTarget && dropPosition === "inside" && isFolder && !positionIsNoop;

  const handleCardClick = () => {
    if (isRenaming) return;
    if (isFolder && !flat) { onOpenFolder(material.id); return; }
    if (!isFolder) onOpen(material);
  };

  return (
    <div>
      <Card
        data-material-card="true"
        className={`${!isRenaming ? "cursor-pointer hover:bg-accent/40 transition-colors" : ""} ${showInsideRing ? "ring-2 ring-primary" : ""} ${draggingId === material.id ? "opacity-50" : ""}`}
        onClick={handleCardClick}
        draggable={!isRenaming && !flat}
        onDragStart={(e) => {
          e.stopPropagation();
          setDraggingId(material.id);
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", material.id);
        }}
        onDragOver={(e) => {
          if (!draggingId || draggingId === material.id) return;
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = "move";
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const y = e.clientY - rect.top;
          const h = rect.height;
          let pos: "before" | "after" | "inside";
          const suppressInside = isFolder && draggedParentId === material.id;
          if (isFolder && !suppressInside) {
            if (y < h * 0.25) pos = "before";
            else if (y > h * 0.75) pos = "after";
            else pos = "inside";
          } else {
            pos = y < h / 2 ? "before" : "after";
          }
          if (dragOverId !== material.id) setDragOverId(material.id);
          if (dropPosition !== pos) setDropPosition(pos);
        }}
        onDragLeave={(e) => {
          e.stopPropagation();
          // Не сбрасываем состояние: иначе линия моргает при переходе
          // между соседними карточками (через зазор между ними).
          // Состояние перезапишется в onDragOver следующей карточки
          // или очистится в onDrop / onDragEnd.
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const id = draggingId;
          const pos = dropPosition ?? "after";
          setDragOverId(null);
          setDropPosition(null);
          setDraggingId(null);
          if (id && id !== material.id && !isNoop(id, material.id, pos)) {
            onReorder(id, material.id, pos);
          }
        }}
        onDragEnd={() => {
          setDraggingId(null);
          setDragOverId(null);
          setDropPosition(null);
        }}
      >
        <CardContent className="p-3 flex items-center gap-2">
          {!flat && (
            <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0 cursor-grab" />
          )}
          <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
            {getIcon(material.type)}
          </div>
          {isRenaming ? (
            <form
              className="flex items-center gap-1 w-1/2"
              onClick={(e) => e.stopPropagation()}
              onSubmit={(e) => { e.preventDefault(); submitRename(); }}
            >
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                autoFocus
                className="h-8 text-sm flex-1 min-w-0"
              />
              <Button type="submit" size="icon" variant="ghost" className="h-8 w-8 min-h-0 flex-shrink-0" disabled={isSavingRename}>
                {isSavingRename ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8 min-h-0 flex-shrink-0" onClick={cancelRename}>
                <X className="w-4 h-4" />
              </Button>
            </form>
          ) : (
            <>
              <div className="flex items-center gap-0.5 min-w-0 flex-1">
                <p className="font-medium text-sm truncate" title={material.title}>{material.title}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 min-h-0 flex-shrink-0 text-muted-foreground"
                  title={language === "kk" ? "Атын өзгерту" : "Переименовать"}
                  onClick={(e) => { e.stopPropagation(); startRename(material); }}
                >
                  <Pencil className="w-3 h-3" />
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 min-h-0 ml-1"
                    title={language === "kk" ? "Ашу" : "Открыть"}
                    onClick={(e) => { e.stopPropagation(); onOpenFolder(material.id); }}
                  >
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};