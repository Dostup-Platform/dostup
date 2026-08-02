import { Loader2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRestoreMaterial, useTrashedMaterials } from "@/hooks/useCreatorMaterials";
import type { Material } from "@/hooks/useMaterials";

const fmtDate = (iso: string) => new Date(iso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });

const typeLabel = (t: Material["type"]) =>
  t === "folder" ? "Папка" : t === "link" ? "Ссылка" : t === "text" ? "Заметка" : "Файл";

export function MaterialTrashDialog({
  open,
  onOpenChange,
  productId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
}) {
  const { data: trashed = [], isLoading } = useTrashedMaterials(open ? productId : undefined);
  const restore = useRestoreMaterial();

  const handleRestore = async (m: Material) => {
    try {
      const res = await restore.mutateAsync({ material: m, productId });
      toast.success(res.movedToRoot ? "Восстановлено в «Дом» (исходная папка удалена)" : "Восстановлено");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5" />
            Корзина
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">
          Удалённые материалы хранятся 30 дней, затем удаляются автоматически.
        </p>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : trashed.length === 0 ? (
          <p className="text-muted-foreground text-sm py-4">Корзина пуста.</p>
        ) : (
          <div className="space-y-2">
            {trashed.map((m) => (
              <div key={m.id} className="flex items-center gap-3 p-3 border rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{m.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {typeLabel(m.type)} · удалено {fmtDate(m.deleted_at!)}
                  </div>
                </div>
                <Button size="sm" variant="outline" disabled={restore.isPending} onClick={() => handleRestore(m)}>
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Восстановить
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
