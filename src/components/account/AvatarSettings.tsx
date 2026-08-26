import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { initialsFrom } from "@/components/layout/ProfileAccountRows";
import { invokeApi } from "@/lib/sessionApi";
import { toast } from "sonner";

const AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const OUTPUT_SIZE = 400;
const PREVIEW_SIZE = 256;

type AvatarSettingsProps = {
  displayName: string;
};

function cropToSquare(image: HTMLImageElement, zoom: number, offsetX: number, offsetY: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("canvas"));

  const minSide = Math.min(image.naturalWidth, image.naturalHeight);
  const cropSize = minSide / zoom;
  const sx = image.naturalWidth / 2 + offsetX - cropSize / 2;
  const sy = image.naturalHeight / 2 + offsetY - cropSize / 2;
  ctx.drawImage(image, sx, sy, cropSize, cropSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("blob"))),
      "image/jpeg",
      0.92,
    );
  });
}

const AvatarSettings = ({ displayName }: AvatarSettingsProps) => {
  const { t } = useLanguage();
  const { profiles, setProfileAvatar } = useSimpleAuth();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const activeId = typeof window !== "undefined" ? localStorage.getItem("profile_id") : null;
  const active = profiles.find((profile) => profile.id === activeId) ?? profiles[0];
  const avatarUrl = active?.avatarUrl ?? null;
  const initials = initialsFrom(displayName || active?.displayName || "");

  const [source, setSource] = useState<string | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const previewStyle = useMemo(() => {
    if (!image) return undefined;
    const minSide = Math.min(image.naturalWidth, image.naturalHeight);
    const scale = (PREVIEW_SIZE * zoom) / minSide;
    return {
      width: image.naturalWidth * scale,
      height: image.naturalHeight * scale,
      transform: `translate(${-offset.x * scale}px, ${-offset.y * scale}px)`,
    };
  }, [image, zoom, offset]);

  const resetCrop = () => {
    if (source) URL.revokeObjectURL(source);
    setSource(null);
    setImage(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const invalidateCatalog = () => {
    void queryClient.invalidateQueries({ queryKey: ["catalog-search"] });
    void queryClient.invalidateQueries({ queryKey: ["catalog-preview"] });
    void queryClient.invalidateQueries({ queryKey: ["catalog-by-ids"] });
    void queryClient.invalidateQueries({ queryKey: ["seller-storefront"] });
    void queryClient.invalidateQueries({ queryKey: ["catalog-taxonomy"] });
    void queryClient.invalidateQueries({ queryKey: ["catalog-products"] });
    void queryClient.invalidateQueries({ queryKey: ["product"] });
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!AVATAR_TYPES.has(file.type)) {
      toast.error(t("avatarInvalidType"));
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error(t("avatarTooLarge"));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setSource(url);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      toast.error(t("avatarInvalidType"));
    };
    img.src = url;
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || !image) return;
    const minSide = Math.min(image.naturalWidth, image.naturalHeight);
    const scale = (PREVIEW_SIZE * zoom) / minSide;
    const dx = (event.clientX - dragRef.current.x) / scale;
    const dy = (event.clientY - dragRef.current.y) / scale;
    const crop = minSide / zoom;
    const maxX = Math.max(0, (image.naturalWidth - crop) / 2);
    const maxY = Math.max(0, (image.naturalHeight - crop) / 2);
    setOffset({
      x: Math.min(maxX, Math.max(-maxX, dragRef.current.ox - dx)),
      y: Math.min(maxY, Math.max(-maxY, dragRef.current.oy - dy)),
    });
  };

  const save = async () => {
    if (!image || saving) return;
    setSaving(true);
    try {
      const blob = await cropToSquare(image, zoom, offset.x, offset.y);
      const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      const token = localStorage.getItem("creator_token") || "";
      const signed = await invokeApi<{ uploadUrl?: string; publicUrl?: string }>("presigned-upload", {
        purpose: "avatar",
        fileName: file.name,
        fileType: file.type,
        creatorToken: token,
        sessionToken: token,
      });
      if (!signed.uploadUrl || !signed.publicUrl) throw new Error("sign");
      const put = await fetch(signed.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "image/jpeg" },
        body: file,
      });
      if (!put.ok) throw new Error("upload");
      await invokeApi("manage-profile", {
        action: "set_avatar",
        token,
        avatarUrl: signed.publicUrl,
      });
      setProfileAvatar(signed.publicUrl);
      invalidateCatalog();
      toast.success(t("avatarSaved"));
      resetCrop();
    } catch {
      toast.error(t("avatarSaveError"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (removing) return;
    setRemoving(true);
    try {
      await invokeApi("manage-profile", {
        action: "clear_avatar",
        token: localStorage.getItem("creator_token") || "",
      });
      setProfileAvatar(null);
      invalidateCatalog();
      toast.success(t("avatarRemoved"));
    } catch {
      toast.error(t("avatarSaveError"));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <Avatar className="h-16 w-16">
        {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
        <AvatarFallback className="text-lg font-bold">{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            {t("choosePhoto")}
          </Button>
          {avatarUrl && (
            <Button type="button" variant="ghost" size="sm" onClick={() => void remove()} disabled={removing}>
              {removing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("delete")}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{t("avatarHint")}</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          onFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      <Dialog open={Boolean(source)} onOpenChange={(open) => !open && !saving && resetCrop()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("avatarCropTitle")}</DialogTitle>
          </DialogHeader>
          <div
            className="relative mx-auto h-64 w-64 cursor-grab overflow-hidden rounded-full bg-muted active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => {
              dragRef.current = null;
            }}
          >
            {source && (
              <img
                src={source}
                alt=""
                draggable={false}
                className="absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2 select-none"
                style={previewStyle}
              />
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t("avatarZoom")}</p>
            <Slider
              min={1}
              max={3}
              step={0.05}
              value={[zoom]}
              onValueChange={([value]) => setZoom(value ?? 1)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetCrop} disabled={saving}>
              {t("cancel")}
            </Button>
            <Button type="button" onClick={() => void save()} disabled={saving || !image}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AvatarSettings;
