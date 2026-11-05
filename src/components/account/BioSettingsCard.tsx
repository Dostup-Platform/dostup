import { useEffect, useId, useState } from "react";
import { Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { invokeApi } from "@/lib/sessionApi";
import { toast } from "sonner";

const BIO_MAX_LENGTH = 500;

/**
 * Public seller description. Shared by creator and online-school profiles,
 * which are both rows in `profiles`, so one card serves both.
 */
const BioSettingsCard = ({ embedded = false }: { embedded?: boolean }) => {
  const inputId = useId();
  const profileId = localStorage.getItem("profile_id") || "";
  const { t } = useLanguage();
  const [value, setValue] = useState("");
  const [initial, setInitial] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    invokeApi<{ bio?: string | null }>("manage-profile", {
      action: "get_handle",
      profileId,
      token: localStorage.getItem("creator_token") || "",
    })
      .then((data) => {
        if (!active) return;
        const bio = data.bio || "";
        setValue(bio);
        setInitial(bio);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [profileId]);

  const save = async () => {
    if (saving || value === initial) return;
    setSaving(true);
    try {
      await invokeApi("manage-profile", {
        action: "set_bio",
        profileId,
        token: localStorage.getItem("creator_token") || "",
        bio: value,
      });
      setInitial(value);
      toast.success(t("sellerDescriptionSaved"));
    } catch {
      toast.error(t("sellerDescriptionError"));
    } finally {
      setSaving(false);
    }
  };

  const fields = (
    <div className="space-y-3">
        <label htmlFor={inputId} className="text-sm font-medium">{t("sellerDescriptionLabel")}</label>
        {/* Round 3: the customer asked for a clear note, at the top, that all of
            this is public — the earlier small grey hint went unnoticed. */}
        <p
          data-testid="bio-public-note"
          className="flex items-start gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm text-foreground"
        >
          <Eye className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span>{t("sellerDescriptionHint")}</span>
        </p>
        <Textarea
          id={inputId}
          value={value}
          onChange={(event) => setValue(event.target.value.slice(0, BIO_MAX_LENGTH))}
          rows={5}
          maxLength={BIO_MAX_LENGTH}
          disabled={loading}
          className="resize-none"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs tabular-nums text-muted-foreground">
            {value.length} / {BIO_MAX_LENGTH}
          </span>
          <Button type="button" onClick={() => void save()} disabled={saving || loading || value === initial}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t("save")}
          </Button>
        </div>
    </div>
  );
  return embedded ? <section>{fields}</section> : <Card><CardContent className="pt-6">{fields}</CardContent></Card>;
};

export default BioSettingsCard;
