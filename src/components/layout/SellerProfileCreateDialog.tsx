import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { isDisplayNameValid } from "@/lib/displayName";

type SellerProfileCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (displayName: string) => void;
  creating?: boolean;
};

const SellerProfileCreateDialog = ({
  open,
  onOpenChange,
  onConfirm,
  creating = false,
}: SellerProfileCreateDialogProps) => {
  const { t } = useLanguage();
  const [value, setValue] = useState("");
  const valid = isDisplayNameValid(value);

  const handleOpenChange = (next: boolean) => {
    if (!creating) {
      if (!next) setValue("");
      onOpenChange(next);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("sellerNameTitle")}</AlertDialogTitle>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="seller-create-name">{t("sellerNameLabel")}</Label>
          <Input
            id="seller-create-name"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t("sellerNamePlaceholder")}
            maxLength={100}
            autoFocus
            disabled={creating}
          />
        </div>
        <AlertDialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={creating}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            onClick={() => onConfirm(value.trim())}
            disabled={!valid || creating}
          >
            {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t("continue")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default SellerProfileCreateDialog;
