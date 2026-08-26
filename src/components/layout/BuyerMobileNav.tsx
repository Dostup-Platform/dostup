import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { BUYER_NAV_ITEMS, buyerSectionFromPath, type BuyerSectionKey } from "@/lib/navigation";

export type BuyerMobileTab = BuyerSectionKey | "account";

interface BuyerMobileNavProps {
  activeTab?: BuyerMobileTab;
  onTabChange?: (tab: BuyerMobileTab) => void;
  notificationCount?: number;
}

const BuyerMobileNav = ({ activeTab, onTabChange, notificationCount = 0 }: BuyerMobileNavProps) => {
  const { t } = useLanguage();
  const location = useLocation();
  const resolved = activeTab ?? buyerSectionFromPath(location.pathname) ?? "home";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/90 backdrop-blur-lg safe-area-inset md:hidden">
      <div className="grid h-16 grid-cols-5">
        {BUYER_NAV_ITEMS.map(({ key, labelKey, icon: Icon, to }) => {
          const active = resolved === key;
          const badge = key === "notifications" && notificationCount > 0;
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
              <span className="relative">
                <Icon className="h-5 w-5" strokeWidth={1.75} />
                {badge && (
                  <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {notificationCount > 9 ? "9+" : notificationCount}
                  </span>
                )}
              </span>
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
