import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

const PublicLocaleToggle = () => {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div
      role="group"
      aria-label={t("languageSwitcherLabel")}
      className="flex items-center gap-2 text-[13px] font-medium text-[#6B7280]"
    >
      <button
        type="button"
        onClick={() => setLanguage("ru")}
        aria-pressed={language === "ru"}
        className={cn(
          "rounded-md px-1 py-1 focus-ring",
          language === "ru" ? "text-foreground" : "hover:text-foreground",
        )}
      >
        {t("localeRu")}
      </button>
      <span aria-hidden>/</span>
      <button
        type="button"
        onClick={() => setLanguage("kk")}
        aria-pressed={language === "kk"}
        className={cn(
          "rounded-md px-1 py-1 focus-ring",
          language === "kk" ? "text-foreground" : "hover:text-foreground",
        )}
      >
        {t("localeKk")}
      </button>
    </div>
  );
};

export default PublicLocaleToggle;
