import { useState } from "react";
import { Loader2, Megaphone, Plus, Send, Trash2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  useAnnouncements,
  useCreateAnnouncement,
  useUpdateAnnouncement,
  useDeleteAnnouncement,
  type Announcement,
} from "@/hooks/useAnnouncements";

interface Props {
  productId: string;
  canEdit: boolean;
  ownerId?: string;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const AnnouncementsSection = ({ productId, canEdit, ownerId }: Props) => {
  const { data: items = [], isLoading } = useAnnouncements(productId);
  const createMut = useCreateAnnouncement();
  const updateMut = useUpdateAnnouncement();
  const deleteMut = useDeleteAnnouncement();

  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [editDraft, setEditDraft] = useState("");

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!canEdit && items.length === 0) return null;

  const submit = async () => {
    const text = draft.trim();
    if (!text || !ownerId) return;
    try {
      await createMut.mutateAsync({ productId, ownerId, contentHtml: text });
      setDraft("");
      setComposerOpen(false);
      toast.success("Объявление опубликовано");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    const text = editDraft.trim();
    if (!text) return;
    try {
      await updateMut.mutateAsync({ id: editing.id, productId, contentHtml: text });
      setEditing(null);
      toast.success("Сохранено");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-primary" />
          Объявления
        </CardTitle>
        {canEdit && !composerOpen && (
          <Button size="sm" variant="outline" onClick={() => setComposerOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Новое
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {canEdit && composerOpen && (
          <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
            <Textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Напишите сообщение ученикам…"
              rows={3}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setComposerOpen(false); setDraft(""); }}>
                Отмена
              </Button>
              <Button size="sm" onClick={submit} disabled={!draft.trim() || createMut.isPending}>
                <Send className="w-4 h-4 mr-1" /> Отправить
              </Button>
            </div>
          </div>
        )}

        {items.length === 0 && !composerOpen && (
          <p className="text-sm text-muted-foreground text-center py-4">
            {canEdit ? "Пока нет объявлений. Создайте первое." : "Объявлений пока нет."}
          </p>
        )}

        {items.map((a) => (
          <div key={a.id} className="rounded-lg border p-3 space-y-2">
            {editing?.id === a.id ? (
              <>
                <Textarea value={editDraft} onChange={(e) => setEditDraft(e.target.value)} rows={3} />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                  <Button size="sm" onClick={saveEdit} disabled={updateMut.isPending}>
                    Сохранить
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{a.content_html}</div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{formatDate(a.created_at)}</span>
                  {canEdit && (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7"
                        onClick={() => { setEditing(a); setEditDraft(a.content_html); }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7"
                        onClick={async () => {
                          if (!confirm("Удалить объявление?")) return;
                          try {
                            await deleteMut.mutateAsync({ id: a.id, productId });
                            toast.success("Удалено");
                          } catch (e) {
                            toast.error((e as Error).message);
                          }
                        }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default AnnouncementsSection;