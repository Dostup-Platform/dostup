import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { BUYER_NAV_ITEMS, buyerSectionFromPath, type BuyerSectionKey } from "@/lib/navigation";

export type BuyerMobileTab = BuyerSectionKey | "account";

interface BuyerMobileNavProps {
  activeTab?: BuyerMobileTab;
  onTabChange?: (tab: BuyerMobileTab) => void;
}

const BuyerMobileNav = ({ activeTab, onTabChange }: BuyerMobileNavProps) => {
  const { t } = useLanguage();
  const location = useLocation();
  const resolved = activeTab ?? buyerSectionFromPath(location.pathname) ?? "home";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/90 backdrop-blur-lg safe-area-inset md:hidden">
      <div className="grid h-16 grid-cols-4">
        {BUYER_NAV_ITEMS.map(({ key, labelKey, icon: Icon, to }) => {
          const active = resolved === key;
          return (
            <Link
              key={key}
              to={to}
              onClick={() => onTabChange?.(key)}
              className={cn(
                "flex flex-col items-center justify-center gap-1",
                active ? "text-[#FF6B00]" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={1.75} />
              <span className="text-[10px] leading-tight">{t(labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BuyerMobileNav;
export { BuyerMobileNav };
