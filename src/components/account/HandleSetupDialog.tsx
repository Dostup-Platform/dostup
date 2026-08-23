import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import HandleField from "@/components/account/HandleField";
import { useLanguage } from "@/contexts/LanguageContext";
import { invokeApi } from "@/lib/sessionApi";
import { normalizeHandle } from "@/lib/handle";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface HandleSetupDialogProps {
  open: boolean;
  profileId?: string | null;
  onSaved: (handle: string) => void;
}

const HandleSetupDialog = ({ open, profileId, onSaved }: HandleSetupDialogProps) => {
  const { t } = useLanguage();
  const [value, setValue] = useState("");
  const [valid, setValid] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const handle = normalizeHandle(value);
    if (!valid || !handle || saving) return;
    setSaving(true);
    try {
      const data = await invokeApi<{ handle?: string }>("manage-profile", {
        action: "set_handle",
        token: localStorage.getItem("creator_token") || "",
        handle,
      });
      const saved = data.handle || handle;
      localStorage.setItem("profile_handle", saved);
      toast.success(t("handleSaved"));
      onSaved(saved);
    } catch {
      toast.error(t("handleTaken"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("handleRequiredTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("handleRequiredDescription")}</AlertDialogDescription>
        </AlertDialogHeader>
        <HandleField
          value={value}
          onChange={setValue}
          exceptId={profileId}
          onValidityChange={setValid}
          autoFocus
        />
        <AlertDialogFooter>
          <Button type="button" onClick={() => void save()} disabled={!valid || saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t("handleSave")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default HandleSetupDialog;
