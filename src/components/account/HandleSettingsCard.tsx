import { useCallback, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import HandleField from "@/components/account/HandleField";
import { useLanguage } from "@/contexts/LanguageContext";
import { invokeApi } from "@/lib/sessionApi";
import { normalizeHandle } from "@/lib/handle";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface HandleSettingsCardProps {
  initialHandle?: string | null;
  profileId?: string | null;
  onSaved?: (handle: string) => void;
}

const HandleSettingsCard = ({ initialHandle, profileId, onSaved }: HandleSettingsCardProps) => {
  const { t } = useLanguage();
  const [value, setValue] = useState(initialHandle || "");
  const [valid, setValid] = useState(false);
  const [saving, setSaving] = useState(false);

  const onValidityChange = useCallback((ok: boolean) => setValid(ok), []);

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
      onSaved?.(saved);
    } catch {
      toast.error(t("handleTaken"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("handleLabel")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <HandleField
          value={value}
          onChange={setValue}
          exceptId={profileId}
          onValidityChange={onValidityChange}
        />
        <Button type="button" onClick={() => void save()} disabled={!valid || saving || value === initialHandle}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t("save")}
        </Button>
      </CardContent>
    </Card>
  );
};

export default HandleSettingsCard;
