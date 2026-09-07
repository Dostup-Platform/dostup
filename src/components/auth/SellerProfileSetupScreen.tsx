import { useEffect, useRef, useState } from "react";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import AvatarCropEditor from "@/components/account/AvatarCropEditor";
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
  errorMessage?: string | null;
  onContinue: (displayName: string, avatarFile: File | null) => void;
};

const SellerProfileSetupScreen = ({ saving = false, errorMessage, onContinue }: SellerProfileSetupScreenProps) => {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const crop = useAvatarCrop();
  const [value, setValue] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const valid = isDisplayNameValid(value);

  useEffect(() => {
    setLocalError(errorMessage || null);
  }, [errorMessage]);

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
        <div className="flex flex-col items-center gap-2">
          {/* Circular Avatar / Plus Button */}
          <div className="relative group">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={saving}
              className={cn(
                "relative flex h-24 w-24 items-center justify-center rounded-full overflow-hidden transition-all duration-200 focus-ring",
                avatarPreview
                  ? "ring-2 ring-border/80 hover:ring-primary/60 shadow-sm"
                  : "border-2 border-dashed border-primary/40 bg-muted/40 hover:border-primary hover:bg-muted/70 cursor-pointer",
              )}
              title={avatarPreview ? t("changePhoto") : t("addPhoto")}
            >
              {avatarPreview ? (
                <>
                  <Avatar className="h-full w-full">
                    <AvatarImage src={avatarPreview} alt="" className="object-cover" />
                    <AvatarFallback className="text-xl font-bold">
                      {value ? value[0].toUpperCase() : ""}
                    </AvatarFallback>
                  </Avatar>

                  {/* Hover overlay with Pencil and text */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-200 text-white p-1 text-center">
                    <Pencil className="h-4 w-4 mb-0.5 shrink-0" />
                    <span className="text-[10px] font-medium leading-tight">
                      {t("changePhoto")}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <Plus className="h-8 w-8" strokeWidth={2.25} />
                </div>
              )}
            </button>
          </div>

          {/* Delete Photo Button if photo is set */}
          {avatarPreview && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearAvatar}
              disabled={saving}
              className="text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl h-7 px-2"
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              {t("delete")}
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="seller-setup-name">{t("sellerNameLabel")}</Label>
          <Input
            id="seller-setup-name"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (localError) setLocalError(null);
            }}
            placeholder={t("sellerNamePlaceholder")}
            maxLength={100}
            autoFocus
            disabled={saving}
            className={cn(localError && "border-destructive focus-visible:ring-destructive")}
          />
          {localError && (
            <p className="text-xs text-destructive font-medium animate-in fade-in">{localError}</p>
          )}
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
