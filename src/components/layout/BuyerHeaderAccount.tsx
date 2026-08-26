import { useState } from "react";
import { User } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import AccountSheet from "@/components/layout/BuyerAccountSheet";

/** Mobile-only account sheet trigger — desktop uses the rail bottom group. */
const BuyerHeaderAccount = () => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("account")}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent/50 md:hidden"
      >
        <User className="h-5 w-5" />
      </button>
      <AccountSheet open={open} onOpenChange={setOpen} />
    </>
  );
};

export default BuyerHeaderAccount;
