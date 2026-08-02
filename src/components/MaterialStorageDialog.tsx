import { HardDrive, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useCreatorStorage, useRefreshFileSizes } from "@/hooks/useCreatorMaterials";

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 Б";
  const units = ["Б", "КБ", "МБ", "ГБ"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function MaterialStorageDialog({
  open,
  onOpenChange,
  ownerId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerId: string;
}) {
  const { data, isLoading } = useCreatorStorage(open ? ownerId : undefined);
  const refresh = useRefreshFileSizes();

  const totalBytes = data?.totalBytes ?? 0;
  const quotaBytes = data?.quotaBytes ?? 10 * 1024 * 1024 * 1024;
  const percent = Math.min(100, (totalBytes / quotaBytes) * 100);
  const unsized = (data?.files ?? []).filter((f) => f.file_size === null).length;

  const handleRefresh = async () => {
    try {
      const res = await refresh.mutateAsync();
      toast.success(`Обновлено размеров: ${res.updated ?? 0}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            Хранилище
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>
                  Использовано: <span className="font-medium">{formatBytes(totalBytes)}</span> из{" "}
                  {formatBytes(quotaBytes)}
                </span>
                <span className="text-muted-foreground">{percent.toFixed(1)}%</span>
              </div>
              <Progress value={percent} />
              {unsized > 0 && (
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                  <span>Размер {unsized} файлов ещё не подсчитан</span>
                  <Button size="sm" variant="outline" disabled={refresh.isPending} onClick={handleRefresh}>
                    {refresh.isPending ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3 mr-1" />
                    )}
                    Подсчитать
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-1 pt-2">
              {(data?.files ?? []).length === 0 ? (
                <p className="text-muted-foreground text-sm py-2">Файлов пока нет.</p>
              ) : (
                data!.files.map((f) => (
                  <div key={f.id} className="flex items-center justify-between gap-3 py-1.5 border-b text-sm">
                    <span className="truncate flex-1 min-w-0">{f.title}</span>
                    <span className="text-muted-foreground shrink-0">
                      {f.file_size !== null ? formatBytes(f.file_size) : "—"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
