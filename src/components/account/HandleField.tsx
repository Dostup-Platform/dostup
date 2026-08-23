import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { isHandleFormatValid, normalizeHandle } from "@/lib/handle";
import { Loader2 } from "lucide-react";

type Availability = "idle" | "checking" | "ok" | "taken" | "invalid";

interface HandleFieldProps {
  value: string;
  onChange: (value: string) => void;
  exceptId?: string | null;
  onValidityChange?: (ok: boolean) => void;
  autoFocus?: boolean;
}

const HandleField = ({
  value,
  onChange,
  exceptId,
  onValidityChange,
  autoFocus,
}: HandleFieldProps) => {
  const { t } = useLanguage();
  const [status, setStatus] = useState<Availability>("idle");

  useEffect(() => {
    const handle = normalizeHandle(value);
    if (!handle) {
      setStatus("idle");
      onValidityChange?.(false);
      return;
    }
    if (!isHandleFormatValid(handle)) {
      setStatus("invalid");
      onValidityChange?.(false);
      return;
    }

    let cancelled = false;
    setStatus("checking");
    const id = window.setTimeout(async () => {
      const { data, error } = await supabase.rpc("handle_is_available", {
        p_handle: handle,
        p_except_id: exceptId || undefined,
      });
      if (cancelled) return;
      const ok = !error && data === true;
      setStatus(ok ? "ok" : "taken");
      onValidityChange?.(ok);
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [exceptId, onValidityChange, value]);

  const hint =
    status === "ok" ? t("handleAvailable")
    : status === "taken" ? t("handleTaken")
    : status === "invalid" ? t("handleInvalid")
    : t("handleHint", { handle: normalizeHandle(value) || "…" });

  return (
    <div className="space-y-2">
      <Label htmlFor="profileHandle">{t("handleLabel")}</Label>
      <div className="relative">
        <Input
          id="profileHandle"
          value={value}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          placeholder={t("handlePlaceholder")}
          onChange={(e) => onChange(normalizeHandle(e.target.value))}
          className="h-11 pr-10"
        />
        {status === "checking" && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
      <p className={`text-sm ${
        status === "ok" ? "text-success"
        : status === "taken" || status === "invalid" ? "text-destructive"
        : "text-muted-foreground"
      }`}>
        {hint}
      </p>
    </div>
  );
};

export default HandleField;
