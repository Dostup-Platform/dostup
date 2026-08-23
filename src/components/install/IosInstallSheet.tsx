import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useLanguage } from "@/contexts/LanguageContext";
import { IosShareIcon } from "@/components/install/IosShareIcon";

type IosInstallSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const IosInstallSheet = ({ open, onOpenChange }: IosInstallSheetProps) => {
  const { t } = useLanguage();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8">
        <SheetHeader className="text-left">
          <SheetTitle>{t("iosInstallSheetTitle")}</SheetTitle>
          <SheetDescription asChild>
            <ol className="mt-4 space-y-4 text-sm text-foreground">
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  1
                </span>
                <span className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {t("iosInstallSheetStep1")}
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-[#007AFF]">
                    <IosShareIcon />
                  </span>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  2
                </span>
                <span className="pt-0.5">{t("iosInstallSheetStep2")}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  3
                </span>
                <span className="pt-0.5">{t("iosInstallSheetStep3")}</span>
              </li>
            </ol>
          </SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  );
};

export default IosInstallSheet;
