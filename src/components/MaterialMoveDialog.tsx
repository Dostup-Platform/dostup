import { useMemo } from "react";
import { Folder, Home } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMoveMaterial } from "@/hooks/useCreatorMaterials";
import type { Material } from "@/hooks/useMaterials";

function buildFolderOptions(materials: Material[], excludeSubtreeOf: string | null) {
  const excluded = new Set<string>();
  if (excludeSubtreeOf) {
    excluded.add(excludeSubtreeOf);
    let changed = true;
    while (changed) {
      changed = false;
      materials.forEach((m) => {
        if (m.parent_id && excluded.has(m.parent_id) && !excluded.has(m.id)) {
          excluded.add(m.id);
          changed = true;
        }
      });
    }
  }

  const pathOf = (m: Material): string => {
    const parts: string[] = [m.title];
    let cur = m.parent_id;
    while (cur) {
      const parent = materials.find((x) => x.id === cur);
      if (!parent) break;
      parts.unshift(parent.title);
      cur = parent.parent_id;
    }
    return parts.join(" / ");
  };

  return materials
    .filter((m) => m.type === "folder" && !excluded.has(m.id))
    .map((m) => ({ id: m.id, label: pathOf(m) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function MaterialMoveDialog({
  open,
  onOpenChange,
  material,
  materials,
  productId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material: Material | null;
  materials: Material[];
  productId: string;
}) {
  const move = useMoveMaterial();

  const folders = useMemo(
    () => (material ? buildFolderOptions(materials, material.type === "folder" ? material.id : null) : []),
    [materials, material],
  );

  const handleMove = async (newParentId: string | null) => {
    if (!material) return;
    if (material.parent_id === newParentId) {
      onOpenChange(false);
      return;
    }
    try {
      await move.mutateAsync({ id: material.id, productId, newParentId });
      toast.success("Перемещено");
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[70vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Переместить «{material?.title}»</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          <Button
            variant="outline"
            className="w-full justify-start"
            disabled={material?.parent_id === null || move.isPending}
            onClick={() => handleMove(null)}
          >
            <Home className="w-4 h-4 mr-2" />
            Дом (корень)
          </Button>
          {folders.map((f) => (
            <Button
              key={f.id}
              variant="ghost"
              className="w-full justify-start"
              disabled={material?.parent_id === f.id || move.isPending}
              onClick={() => handleMove(f.id)}
            >
              <Folder className="w-4 h-4 mr-2 shrink-0" />
              <span className="truncate">{f.label}</span>
            </Button>
          ))}
          {folders.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">Других папок пока нет.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
