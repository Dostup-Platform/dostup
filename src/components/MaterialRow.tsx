import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Download,
  ExternalLink,
  File as FileIcon,
  FileText,
  Folder,
  GripVertical,
  Link as LinkIcon,
  Pencil,
  Star,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { Material } from "@/hooks/useMaterials";

const iconFor = (type: Material["type"]) =>
  type === "folder" ? Folder : type === "link" ? LinkIcon : type === "text" ? FileText : FileIcon;

export interface MaterialRowProps {
  material: Material;
  isBookmarked: boolean;
  bookmarkIsPublic: boolean;
  onOpen: (m: Material) => void;
  onDownload: (m: Material) => void;
  onToggleDownloadAllowed: (m: Material) => void;
  onRename: (m: Material) => void;
  onDelete: (m: Material) => void;
  onMoveTo: (m: Material) => void;
  onToggleBookmark: (m: Material) => void;
  onSetBookmarkPublic: (m: Material, isPublic: boolean) => void;
}

export function MaterialRow({
  material: m,
  isBookmarked,
  bookmarkIsPublic,
  onOpen,
  onDownload,
  onToggleDownloadAllowed,
  onRename,
  onDelete,
  onMoveTo,
  onToggleBookmark,
  onSetBookmarkPublic,
}: MaterialRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: m.id,
  });
  const Icon = iconFor(m.type);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          style={style}
          className="flex items-center gap-2 p-3 border rounded-lg hover:bg-muted/40 transition-colors bg-background"
        >
          <button
            {...attributes}
            {...listeners}
            className="shrink-0 text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
            title="Перетащить"
          >
            <GripVertical className="w-4 h-4" />
          </button>

          <button className="flex-1 flex items-center gap-3 min-w-0 text-left" onClick={() => onOpen(m)}>
            <Icon className="w-5 h-5 text-primary shrink-0" />
            <span className="truncate">{m.title}</span>
          </button>

          <button
            className="shrink-0"
            title={isBookmarked ? "Убрать из закладок" : "Добавить в закладки"}
            onClick={() => onToggleBookmark(m)}
          >
            <Star
              className={`w-4 h-4 ${isBookmarked ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
            />
          </button>

          {isBookmarked && (
            <label className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground cursor-pointer shrink-0">
              <Switch
                checked={bookmarkIsPublic}
                onCheckedChange={(v) => onSetBookmarkPublic(m, v)}
              />
              <span>Ученикам</span>
            </label>
          )}

          {m.type === "file" && (
            <label className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground cursor-pointer shrink-0">
              <Switch checked={m.allow_download} onCheckedChange={() => onToggleDownloadAllowed(m)} />
              <span>Скачивание</span>
            </label>
          )}
          {m.type === "file" && (
            <Button size="icon" variant="ghost" onClick={() => onDownload(m)} title="Скачать">
              <Download className="w-4 h-4" />
            </Button>
          )}
          {m.type === "link" && m.content && (
            <Button size="icon" variant="ghost" onClick={() => window.open(m.content!, "_blank")} title="Открыть">
              <ExternalLink className="w-4 h-4" />
            </Button>
          )}
          <Button size="icon" variant="ghost" onClick={() => onRename(m)} title="Переименовать">
            <Pencil className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => onDelete(m)} title="Удалить">
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onOpen(m)}>Открыть</ContextMenuItem>
        {m.type === "file" && <ContextMenuItem onClick={() => onDownload(m)}>Скачать</ContextMenuItem>}
        <ContextMenuItem onClick={() => onToggleBookmark(m)}>
          {isBookmarked ? "Убрать из закладок" : "Добавить в закладки"}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onRename(m)}>Переименовать</ContextMenuItem>
        <ContextMenuItem onClick={() => onMoveTo(m)}>Переместить в…</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onDelete(m)} className="text-destructive">
          Удалить
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
