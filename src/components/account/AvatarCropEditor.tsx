import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useLanguage } from "@/contexts/LanguageContext";
import { Loader2 } from "lucide-react";

type AvatarCropEditorProps = {
  source: string;
  previewStyle?: CSSProperties;
  zoom: number;
  onZoom: (value: number) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: () => void;
  saving?: boolean;
  onCancel: () => void;
  onSave: () => void;
};

const AvatarCropEditor = ({
  source,
  previewStyle,
  zoom,
  onZoom,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  saving = false,
  onCancel,
  onSave,
}: AvatarCropEditorProps) => {
  const { t } = useLanguage();

  return (
    <div className="space-y-4">
      <div
        className="relative mx-auto h-64 w-64 cursor-grab overflow-hidden rounded-full bg-muted active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <img
          src={source}
          alt=""
          draggable={false}
          className="absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2 select-none"
          style={previewStyle}
        />
      </div>
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{t("avatarZoom")}</p>
        <Slider
          min={1}
          max={3}
          step={0.05}
          value={[zoom]}
          onValueChange={([value]) => onZoom(value ?? 1)}
        />
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {t("cancel")}
        </Button>
        <Button type="button" onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t("save")}
        </Button>
      </div>
    </div>
  );
};

export default AvatarCropEditor;
