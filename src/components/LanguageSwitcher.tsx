import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";

const LanguageSwitcher = () => {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex gap-2">
      <Button
        variant={language === "ru" ? "default" : "outline"}
        size="sm"
        onClick={() => setLanguage("ru")}
        className="flex-1"
      >
        Русский
      </Button>
      <Button
        variant={language === "kk" ? "default" : "outline"}
        size="sm"
        onClick={() => setLanguage("kk")}
        className="flex-1"
      >
        Қазақша
      </Button>
    </div>
  );
};

export default LanguageSwitcher;
