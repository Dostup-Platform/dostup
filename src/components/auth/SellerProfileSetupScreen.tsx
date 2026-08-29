import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import AvatarCropEditor from "@/components/account/AvatarCropEditor";
import { initialsFrom } from "@/lib/displayName";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAvatarCrop } from "@/hooks/useAvatarCrop";
import { isDisplayNameValid } from "@/lib/displayName";
import { LOGIN_CARD_CLASS } from "@/lib/loginModal";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type SellerProfileSetupScreenProps = {
  saving?: boolean;
  onContinue: (displayName: string, avatarFile: File | null) => void;
};

const SellerProfileSetupScreen = ({ saving = false, onContinue }: SellerProfileSetupScreenProps) => {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const crop = useAvatarCrop();
  const [value, setValue] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const valid = isDisplayNameValid(value);

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  const clearAvatar = () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(null);
    setAvatarFile(null);
  };

  const applyCrop = async () => {
    try {
      const file = await crop.cropToFile();
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
      crop.resetCrop();
    } catch {
      toast.error(t("avatarInvalidType"));
    }
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const error = crop.loadFile(file);
    if (error === "type") toast.error(t("avatarInvalidType"));
    if (error === "size") toast.error(t("avatarTooLarge"));
  };

  if (crop.source) {
    return (
      <Card className={cn(LOGIN_CARD_CLASS, "motion-safe:animate-fade-in")}>
        <CardHeader className="pb-2 pt-14 text-center">
          <CardTitle className="text-2xl font-bold">{t("avatarCropTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-2 pb-6">
          <AvatarCropEditor
            source={crop.source}
            previewStyle={crop.previewStyle}
            zoom={crop.zoom}
            onZoom={crop.setZoom}
            onPointerDown={crop.onPointerDown}
            onPointerMove={crop.onPointerMove}
            onPointerUp={crop.onPointerUp}
            onCancel={crop.resetCrop}
            onSave={() => void applyCrop()}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(LOGIN_CARD_CLASS, "motion-safe:animate-fade-in")}>
      <CardHeader className="pb-2 pt-14 text-center">
        <CardTitle className="text-2xl font-bold">{t("sellerSetupTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 pt-2 pb-6">
        <div className="flex flex-col items-center gap-3">
          <Avatar className="h-20 w-20">
            {avatarPreview && <AvatarImage src={avatarPreview} alt="" />}
            <AvatarFallback className="text-lg font-bold">
              {initialsFrom(value)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={saving}
            >
              {t("choosePhoto")}
            </Button>
            {avatarPreview && (
              <Button type="button" variant="ghost" size="sm" onClick={clearAvatar} disabled={saving}>
                {t("delete")}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{t("sellerPhotoOptional")}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="seller-setup-name">{t("sellerNameLabel")}</Label>
          <Input
            id="seller-setup-name"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t("sellerNamePlaceholder")}
            maxLength={100}
            autoFocus
            disabled={saving}
          />
        </div>
        <Button
          type="button"
          className="w-full rounded-2xl"
          disabled={!valid || saving}
          onClick={() => onContinue(value.trim(), avatarFile)}
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t("continue")}
        </Button>
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
      </CardContent>
    </Card>
  );
};

export default SellerProfileSetupScreen;
