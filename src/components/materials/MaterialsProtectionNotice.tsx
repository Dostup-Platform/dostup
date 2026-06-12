import { useEffect, useState } from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

const STORAGE_KEY = "materials_warning_shown";

const MaterialsProtectionNotice = () => {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!sessionStorage.getItem(STORAGE_KEY)) {
        setOpen(true);
        sessionStorage.setItem(STORAGE_KEY, "1");
      }
    } catch {
      setOpen(true);
    }
  }, []);

  const isKk = language === "kk";

  return (
    <>
      <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
        <ShieldAlert className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
        <p className="text-xs sm:text-sm text-destructive font-medium leading-snug">
          {isKk
            ? "Скриншот пен экран жазбасы тыйым салынған"
            : "Скриншоты и запись экрана запрещены"}
        </p>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <DialogTitle className="text-center">
              {isKk ? "Контент қорғалған" : "Контент защищён"}
            </DialogTitle>
            <DialogDescription className="text-center leading-relaxed">
              {isKk
                ? "Материалдардың скриншотын түсіруге және экранын жазуға тыйым салынады. Барлық материалдарда сіздің деректеріңізбен су таңбасы бар. Бұзу қол жеткізуді бұғаттауға әкеледі."
                : "Скриншоты и запись экрана материалов запрещены. Все материалы содержат водяной знак с вашими данными. Нарушение повлечёт блокировку доступа."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button className="w-full" onClick={() => setOpen(false)}>
              {isKk ? "Түсінікті" : "Понятно"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MaterialsProtectionNotice;