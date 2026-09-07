import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import AvatarCropEditor from "@/components/account/AvatarCropEditor";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { initialsFrom } from "@/lib/displayName";
import { useAvatarCrop } from "@/hooks/useAvatarCrop";
import { invokeApi } from "@/lib/sessionApi";
import { invalidateAvatarQueries, uploadProfileAvatar } from "@/lib/avatarUpload";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type AvatarSettingsProps = {
  displayName: string;
};

const AvatarSettings = ({ displayName }: AvatarSettingsProps) => {
  const { t } = useLanguage();
  const { profiles, setProfileAvatar } = useSimpleAuth();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const crop = useAvatarCrop();

  const activeId = typeof window !== "undefined" ? localStorage.getItem("profile_id") : null;
  const active = profiles.find((profile) => profile.id === activeId) ?? profiles[0];
  const avatarUrl = active?.avatarUrl ?? null;
  const initials = initialsFrom(displayName || active?.displayName || "");

  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const error = crop.loadFile(file);
    if (error === "type") toast.error(t("avatarInvalidType"));
    if (error === "size") toast.error(t("avatarTooLarge"));
  };

  const save = async () => {
    if (!crop.image || saving) return;
    setSaving(true);
    try {
      const file = await crop.cropToFile();
      const publicUrl = await uploadProfileAvatar(file, activeId);
      setProfileAvatar(publicUrl);
      invalidateAvatarQueries(queryClient);
      toast.success(t("avatarSaved"));
      crop.resetCrop();
    } catch (err) {
      console.error("Failed to save avatar:", err);
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
        profileId: activeId,
      });
      setProfileAvatar(null);
      invalidateAvatarQueries(queryClient);
      toast.success(t("avatarRemoved"));
    } catch {
      toast.error(t("avatarSaveError"));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      {/* Interactive Avatar Circle with + or Pencil/Change overlay */}
      <div className="relative group shrink-0">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={saving || removing}
          className={cn(
            "relative flex h-20 w-20 items-center justify-center rounded-full overflow-hidden transition-all duration-200 focus-ring cursor-pointer",
            avatarUrl
              ? "ring-2 ring-border/80 hover:ring-primary/60 shadow-sm"
              : "border-2 border-dashed border-primary/40 bg-muted hover:border-primary",
          )}
          title={avatarUrl ? t("changePhoto") : t("addPhoto")}
        >
          {avatarUrl ? (
            <>
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              {/* Hover overlay with Pencil and text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-200 text-white p-1 text-center">
                <Pencil className="h-4 w-4 mb-0.5 shrink-0" />
                <span className="text-[10px] font-medium leading-tight">
                  {t("changePhoto")}
                </span>
              </div>
            </>
          ) : (
            <div className="relative flex h-full w-full items-center justify-center">
              <span className="text-xl font-bold text-foreground group-hover:opacity-20 transition-opacity">
                {initials}
              </span>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                <Plus className="h-7 w-7" strokeWidth={2.25} />
              </div>
            </div>
          )}
        </button>
      </div>

      {/* Action buttons (e.g. Delete photo if avatar exists) */}
      {avatarUrl && (
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void remove()}
            disabled={removing || saving}
            className="text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl h-8 px-2.5"
          >
            {removing ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            )}
            {t("delete")}
          </Button>
        </div>
      )}

      {/* Hidden File Input */}
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

      {/* Avatar Crop & Adjust Modal (Direct high z-index portal above AccountSettingsDialog) */}
      {Boolean(crop.source) &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[95] flex items-center justify-center p-3 sm:p-6 motion-safe:animate-fade-in">
            <div
              className="login-modal-backdrop absolute inset-0"
              onClick={() => !saving && crop.resetCrop()}
              aria-hidden="true"
            />
            <Card className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-background shadow-2xl overflow-hidden">
              <CardHeader className="pb-2 text-center">
                <CardTitle className="text-xl font-bold">{t("avatarCropTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="pt-2 pb-6">
                {crop.source && (
                  <AvatarCropEditor
                    source={crop.source}
                    previewStyle={crop.previewStyle}
                    zoom={crop.zoom}
                    onZoom={crop.setZoom}
                    onPointerDown={crop.onPointerDown}
                    onPointerMove={crop.onPointerMove}
                    onPointerUp={crop.onPointerUp}
                    saving={saving}
                    onCancel={crop.resetCrop}
                    onSave={() => void save()}
                  />
                )}
              </CardContent>
            </Card>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default AvatarSettings;
