import { useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Loader2,
  ArrowLeft,
  FolderPlus,
  Upload,
  Link as LinkIcon,
  FileText,
  Trash2,
  HardDrive,
} from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useAuth } from "@/contexts/AuthContext";
import { useProductMaterials, Material, fetchMaterialUrl } from "@/hooks/useMaterials";
import {
  useCreateMaterial,
  useUpdateMaterial,
  useDeleteMaterial,
  useMoveMaterial,
  useReorderMaterials,
  presignUpload,
} from "@/hooks/useCreatorMaterials";
import {
  useMaterialBookmarks,
  useToggleBookmark,
  useSetBookmarkPublic,
} from "@/hooks/useMaterialBookmarks";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import AnnouncementsSection from "@/components/AnnouncementsSection";
import { MaterialRow } from "@/components/MaterialRow";
import { MaterialTrashDialog } from "@/components/MaterialTrashDialog";
import { MaterialStorageDialog } from "@/components/MaterialStorageDialog";
import { MaterialMoveDialog } from "@/components/MaterialMoveDialog";

function DroppableCrumb({
  id,
  label,
  onClick,
}: {
  id: string;
  label: string;
  onClick: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <button
      ref={setNodeRef}
      className={`text-primary hover:underline rounded px-1 transition-colors ${isOver ? "bg-primary/15 ring-1 ring-primary" : ""}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

const CreatorMaterialsPage = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [parentId, setParentId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addKind, setAddKind] = useState<"folder" | "link" | "text" | null>(null);
  const [titleInput, setTitleInput] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [textInput, setTextInput] = useState("");
  const [renameOpen, setRenameOpen] = useState<Material | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [trashOpen, setTrashOpen] = useState(false);
  const [storageOpen, setStorageOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<Material | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const { data: product, isLoading: productLoading } = useQuery({
    queryKey: ["product-owner-check", productId, user?.id],
    enabled: !!productId && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products").select("id,title,owner_id").eq("id", productId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: materials = [], isLoading } = useProductMaterials(productId);
  const createMut = useCreateMaterial();
  const updateMut = useUpdateMaterial();
  const deleteMut = useDeleteMaterial();
  const moveMut = useMoveMaterial();
  const reorderMut = useReorderMaterials();

  const materialIds = useMemo(() => materials.map((m) => m.id), [materials]);
  const { data: bookmarks = [] } = useMaterialBookmarks(user?.id, materialIds);
  const bookmarkByMaterial = useMemo(
    () => new Map(bookmarks.map((b) => [b.material_id, b])),
    [bookmarks],
  );
  const toggleBookmark = useToggleBookmark();
  const setBookmarkPublic = useSetBookmarkPublic();

  const currentItems = useMemo(
    () => materials.filter((m) => m.parent_id === parentId).sort((a, b) => a.order_index - b.order_index),
    [materials, parentId],
  );
  const breadcrumbs = useMemo(() => {
    const path: Material[] = [];
    let curId = parentId;
    while (curId) {
      const parent = materials.find((m) => m.id === curId);
      if (!parent) break;
      path.unshift(parent);
      curId = parent.parent_id;
    }
    return path;
  }, [materials, parentId]);

  if (authLoading || productLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }
  if (!user) { navigate("/auth"); return null; }
  if (!product) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Продукт не найден</div>;
  if (product.owner_id !== user.id) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Нет доступа</div>;

  const closeAdd = () => { setAddOpen(false); setAddKind(null); setTitleInput(""); setUrlInput(""); setTextInput(""); };
  const openAdd = (kind: "folder" | "link" | "text") => { setAddKind(kind); setAddOpen(true); };

  const doCreate = async () => {
    if (!productId || !addKind) return;
    const title = titleInput.trim();
    if (!title) { toast.error("Укажите название"); return; }
    try {
      if (addKind === "folder") await createMut.mutateAsync({ productId, parentId, title, type: "folder" });
      else if (addKind === "link") {
        if (!urlInput.trim()) return toast.error("Укажите ссылку");
        await createMut.mutateAsync({ productId, parentId, title, type: "link", content: urlInput.trim() });
      } else if (addKind === "text") {
        await createMut.mutateAsync({ productId, parentId, title, type: "text", content: textInput });
      }
      toast.success("Добавлено");
      closeAdd();
    } catch (e) { toast.error((e as Error).message); }
  };

  const onFilePicked = async (files: FileList | null) => {
    if (!files || !files.length || !productId) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const { storagePath, size } = await presignUpload(productId, file);
        await createMut.mutateAsync({
          productId, parentId, title: file.name, type: "file", file_url: storagePath, file_size: size,
        });
      }
      toast.success("Файлы загружены");
    } catch (e) { toast.error((e as Error).message); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  const openMaterial = async (m: Material) => {
    if (m.type === "folder") { setParentId(m.id); return; }
    if (m.type === "link") { if (m.content) window.open(m.content, "_blank"); return; }
    if (m.type === "text") { toast.info(m.content ?? ""); return; }
    if (m.type === "file") {
      try { const url = await fetchMaterialUrl(m.id, false); window.open(url, "_blank"); }
      catch (e) { toast.error((e as Error).message); }
    }
  };

  const download = async (m: Material) => {
    if (m.type !== "file") return;
    try {
      const url = await fetchMaterialUrl(m.id, true);
      window.open(url, "_blank");
    } catch (e) { toast.error((e as Error).message); }
  };

  const doDelete = async (m: Material) => {
    if (!confirm(`Переместить «${m.title}» в корзину?${m.type === "folder" ? " Все вложенные элементы тоже будут удалены." : ""}`)) return;
    try { await deleteMut.mutateAsync({ id: m.id, productId: productId! }); toast.success("Перемещено в корзину"); }
    catch (e) { toast.error((e as Error).message); }
  };

  const doRename = async () => {
    if (!renameOpen) return;
    const t = renameTitle.trim();
    if (!t) return;
    try {
      await updateMut.mutateAsync({ id: renameOpen.id, productId: productId!, patch: { title: t } });
      toast.success("Переименовано");
      setRenameOpen(null);
    } catch (e) { toast.error((e as Error).message); }
  };

  const toggleDownload = async (m: Material) => {
    try {
      await updateMut.mutateAsync({ id: m.id, productId: productId!, patch: { allow_download: !m.allow_download } });
    } catch (e) { toast.error((e as Error).message); }
  };

  const handleToggleBookmark = async (m: Material) => {
    if (!user) return;
    try {
      await toggleBookmark.mutateAsync({
        materialId: m.id,
        userId: user.id,
        bookmarked: bookmarkByMaterial.has(m.id),
      });
    } catch (e) { toast.error((e as Error).message); }
  };

  const handleSetBookmarkPublic = async (m: Material, isPublic: boolean) => {
    if (!user) return;
    try {
      await setBookmarkPublic.mutateAsync({ materialId: m.id, userId: user.id, isPublic });
    } catch (e) { toast.error((e as Error).message); }
  };

  const handleDragStart = (e: DragStartEvent) => setActiveDragId(String(e.active.id));

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = e;
    if (!over || !productId) return;
    const overId = String(over.id);
    const activeId = String(active.id);
    if (activeId === overId) return;

    if (overId.startsWith("breadcrumb:")) {
      const targetId = overId.slice("breadcrumb:".length);
      const newParentId = targetId === "root" ? null : targetId;
      const dragged = materials.find((m) => m.id === activeId);
      if (dragged && dragged.parent_id !== newParentId) {
        try {
          await moveMut.mutateAsync({ id: activeId, productId, newParentId });
          toast.success("Перемещено");
        } catch (err) { toast.error((err as Error).message); }
      }
      return;
    }

    const oldIndex = currentItems.findIndex((m) => m.id === activeId);
    const newIndex = currentItems.findIndex((m) => m.id === overId);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(currentItems, oldIndex, newIndex);
    try {
      await reorderMut.mutateAsync({ productId, orderedIds: reordered.map((m) => m.id) });
    } catch (err) { toast.error((err as Error).message); }
  };

  const activeDragMaterial = activeDragId ? materials.find((m) => m.id === activeDragId) : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild><Link to="/dashboard"><ArrowLeft className="w-4 h-4 mr-1" />Назад</Link></Button>
          <h1 className="text-lg font-semibold truncate flex-1">{product.title}</h1>
          <Button size="sm" variant="outline" onClick={() => setStorageOpen(true)}>
            <HardDrive className="w-4 h-4 mr-1" /><span className="hidden sm:inline">Хранилище</span>
          </Button>
          <Button size="sm" variant="outline" onClick={() => setTrashOpen(true)}>
            <Trash2 className="w-4 h-4 mr-1" /><span className="hidden sm:inline">Корзина</span>
          </Button>
        </div>
      </header>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <DroppableCrumb id="breadcrumb:root" label="Дом" onClick={() => setParentId(null)} />
            {breadcrumbs.map((b) => (
              <span key={b.id} className="flex items-center gap-2">
                <span className="text-muted-foreground">/</span>
                <DroppableCrumb id={`breadcrumb:${b.id}`} label={b.title} onClick={() => setParentId(b.id)} />
              </span>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => openAdd("folder")}><FolderPlus className="w-4 h-4 mr-1" />Папка</Button>
            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}Файл
            </Button>
            <Button size="sm" variant="outline" onClick={() => openAdd("link")}><LinkIcon className="w-4 h-4 mr-1" />Ссылка</Button>
            <Button size="sm" variant="outline" onClick={() => openAdd("text")}><FileText className="w-4 h-4 mr-1" />Заметка</Button>
            <input ref={fileInputRef} type="file" multiple hidden onChange={(e) => onFilePicked(e.target.files)} />
          </div>

          {productId && parentId === null && user && (
            <AnnouncementsSection productId={productId} canEdit ownerId={user.id} />
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">{parentId ? breadcrumbs[breadcrumbs.length - 1]?.title : "Дом"}</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : currentItems.length === 0 ? (
                <p className="text-muted-foreground text-sm">Здесь пока пусто.</p>
              ) : (
                <SortableContext items={currentItems.map((m) => m.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {currentItems.map((m) => {
                      const bookmark = bookmarkByMaterial.get(m.id);
                      return (
                        <MaterialRow
                          key={m.id}
                          material={m}
                          isBookmarked={!!bookmark}
                          bookmarkIsPublic={bookmark?.is_public ?? false}
                          onOpen={openMaterial}
                          onDownload={download}
                          onToggleDownloadAllowed={toggleDownload}
                          onRename={(mm) => { setRenameOpen(mm); setRenameTitle(mm.title); }}
                          onDelete={doDelete}
                          onMoveTo={(mm) => setMoveTarget(mm)}
                          onToggleBookmark={handleToggleBookmark}
                          onSetBookmarkPublic={handleSetBookmarkPublic}
                        />
                      );
                    })}
                  </div>
                </SortableContext>
              )}
            </CardContent>
          </Card>
        </main>

        <DragOverlay>
          {activeDragMaterial ? (
            <div className="p-3 border rounded-lg bg-background shadow-lg opacity-90">
              {activeDragMaterial.title}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Dialog open={addOpen} onOpenChange={(v) => (v ? setAddOpen(true) : closeAdd())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {addKind === "folder" ? "Новая папка" : addKind === "link" ? "Новая ссылка" : "Новая заметка"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Название</Label>
              <Input value={titleInput} onChange={(e) => setTitleInput(e.target.value)} autoFocus />
            </div>
            {addKind === "link" && (
              <div>
                <Label>URL</Label>
                <Input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://…" />
              </div>
            )}
            {addKind === "text" && (
              <div>
                <Label>Текст</Label>
                <Textarea value={textInput} onChange={(e) => setTextInput(e.target.value)} rows={6} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeAdd}>Отмена</Button>
            <Button onClick={doCreate} disabled={createMut.isPending}>
              {createMut.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renameOpen} onOpenChange={(v) => !v && setRenameOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Переименовать</DialogTitle></DialogHeader>
          <Input value={renameTitle} onChange={(e) => setRenameTitle(e.target.value)} autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(null)}>Отмена</Button>
            <Button onClick={doRename} disabled={updateMut.isPending}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {productId && (
        <>
          <MaterialTrashDialog open={trashOpen} onOpenChange={setTrashOpen} productId={productId} />
          <MaterialStorageDialog open={storageOpen} onOpenChange={setStorageOpen} ownerId={user.id} />
          <MaterialMoveDialog
            open={!!moveTarget}
            onOpenChange={(v) => !v && setMoveTarget(null)}
            material={moveTarget}
            materials={materials}
            productId={productId}
          />
        </>
      )}
    </div>
  );
};

export default CreatorMaterialsPage;
