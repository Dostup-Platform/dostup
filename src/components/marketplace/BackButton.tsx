import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Returns the user to wherever they came from inside the app: the marketplace,
 * a product, a storefront. React Router gives the first page of a session the
 * key "default", so a page opened directly (a shared link, a new tab) has no
 * in-app page behind it and goes to the marketplace instead of leaving the site.
 */
const BackButton = ({ compactOnMobile = false, disabled = false }: { compactOnMobile?: boolean; disabled?: boolean }) => {
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const goBack = () => {
    if (location.key !== "default") navigate(-1);
    else navigate("/");
  };

  return (
    <button
      type="button"
      onClick={disabled ? undefined : goBack}
      aria-label={t("back")}
      aria-disabled={disabled || undefined}
      className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-md px-2 public-meta hover:bg-primary/10 hover:text-foreground focus-ring"
    >
      <ArrowLeft className="h-4 w-4" />
      <span className={compactOnMobile ? "hidden sm:inline" : undefined}>{t("back")}</span>
    </button>
  );
};

export default BackButton;
