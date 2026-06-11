import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, Save } from "lucide-react";
import {
  useAnnouncements,
  useCreateAnnouncement,
  useUpdateAnnouncement,
  useDeleteAnnouncement,
  useSetGroupLink,
} from "@/hooks/useAnnouncements";
import AnnouncementEditor from "./AnnouncementEditor";
import AnnouncementView from "@/components/dashboard/AnnouncementView";
import { toast } from "sonner";

interface Props {
  productId: string;
  productTitle: string;
  initialGroupLinkUrl: string | null;
  initialGroupLinkLabel: string | null;
  onBack?: () => void;
  hideBackButton?: boolean;
}

const ProductAnnouncementsManager = ({ productId, productTitle, initialGroupLinkUrl, initialGroupLinkLabel, onBack, hideBackButton }: Props) => {
  const { data: announcements = [], isLoading } = useAnnouncements(productId);
  const createMut = useCreateAnnouncement();
  const updateMut = useUpdateAnnouncement();
  const deleteMut = useDeleteAnnouncement();
  const setGroupLink = useSetGroupLink();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [groupUrl, setGroupUrl] = useState(initialGroupLinkUrl || "");
  const [groupLabel, setGroupLabel] = useState(initialGroupLinkLabel || "");
  useEffect(() => { setGroupUrl(initialGroupLinkUrl || ""); setGroupLabel(initialGroupLinkLabel || ""); }, [initialGroupLinkUrl, initialGroupLinkLabel]);

  const handleSaveLink = async () => {
    try {
      await setGroupLink.mutateAsync({
        productId,
        groupLinkUrl: groupUrl.trim() || null,
        groupLinkLabel: groupLabel.trim() || null,
      });
      toast.success("Ссылка сохранена");
    } catch (e: any) {
      toast.error(e?.message || "Не удалось сохранить");
    }
  };

  const handleCreate = async (html: string) => {
    if (!html || html === "<p></p>") { toast.error("Пост пустой"); return; }
    try {
      await createMut.mutateAsync({ productId, contentHtml: html });
      setIsAdding(false);
      toast.success("Опубликовано");
    } catch (e: any) { toast.error(e?.message || "Ошибка"); }
  };

  const handleUpdate = async (id: string, html: string) => {
    try {
      await updateMut.mutateAsync({ id, productId, contentHtml: html });
      setEditingId(null);
      toast.success("Сохранено");
    } catch (e: any) { toast.error(e?.message || "Ошибка"); }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteMut.mutateAsync({ id: deletingId, productId });
      setDeletingId(null);
      toast.success("Удалено");
    } catch (e: any) { toast.error(e?.message || "Ошибка"); }
  };

  return (
    <div className="space-y-4">
      {!hideBackButton && onBack && (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" />К продуктам</Button>
          <h2 className="text-lg font-semibold truncate">{productTitle}</h2>
        </div>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1">
            <Label>Ссылка на чат/группу (URL)</Label>
            <Input value={groupUrl} onChange={(e) => setGroupUrl(e.target.value)} placeholder="https://t.me/..." />
          </div>
          <div className="space-y-1">
            <Label>Текст кнопки</Label>
            <Input value={groupLabel} onChange={(e) => setGroupLabel(e.target.value)} placeholder="Ссылка на группу/чат" />
          </div>
          <Button size="sm" onClick={handleSaveLink} disabled={setGroupLink.isPending}>
            {setGroupLink.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Сохранить ссылку
          </Button>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h3 className="font-medium">Объявления</h3>
        {!isAdding && (
          <Button size="sm" onClick={() => { setIsAdding(true); setEditingId(null); }}>
            <Plus className="w-4 h-4 mr-1" />Создать пост
          </Button>
        )}
      </div>

      {isAdding && (
        <AnnouncementEditor
          productId={productId}
          onSave={handleCreate}
          onCancel={() => setIsAdding(false)}
          saving={createMut.isPending}
          submitLabel="Опубликовать"
        />
      )}

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : announcements.length === 0 && !isAdding ? (
        <p className="text-sm text-muted-foreground text-center py-8">Пока нет объявлений</p>
      ) : (
        <div className="space-y-3">
          {[...announcements].reverse().map((a) => (
            <Card key={a.id}>
              <CardContent className="p-4 space-y-2">
                {editingId === a.id ? (
                  <AnnouncementEditor
                    productId={productId}
                    initialHtml={a.content_html}
                    onSave={(html) => handleUpdate(a.id, html)}
                    onCancel={() => setEditingId(null)}
                    saving={updateMut.isPending}
                    submitLabel="Сохранить"
                  />
                ) : (
                  <>
                    <AnnouncementView html={a.content_html} />
                    <div className="flex items-center justify-end gap-2 pt-2">
                      <Button size="sm" variant="toggle" onClick={() => { setEditingId(a.id); setIsAdding(false); }}>
                        <Pencil className="w-4 h-4 mr-1" />Редактировать
                      </Button>
                      <Button size="sm" variant="toggle" onClick={() => setDeletingId(a.id)}>
                        <Trash2 className="w-4 h-4 mr-1" />Удалить
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить объявление?</AlertDialogTitle>
            <AlertDialogDescription>Действие нельзя отменить.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProductAnnouncementsManager;