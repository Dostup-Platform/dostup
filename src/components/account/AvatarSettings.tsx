import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import AvatarCropEditor from "@/components/account/AvatarCropEditor";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { initialsFrom } from "@/lib/displayName";
import { useAvatarCrop } from "@/hooks/useAvatarCrop";
import { invokeApi } from "@/lib/sessionApi";
import { invalidateAvatarQueries, uploadProfileAvatar } from "@/lib/avatarUpload";
import { toast } from "sonner";

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
      const publicUrl = await uploadProfileAvatar(file);
      setProfileAvatar(publicUrl);
      invalidateAvatarQueries(queryClient);
      toast.success(t("avatarSaved"));
      crop.resetCrop();
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

      <Dialog open={Boolean(crop.source)} onOpenChange={(open) => !open && !saving && crop.resetCrop()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("avatarCropTitle")}</DialogTitle>
          </DialogHeader>
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
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AvatarSettings;
