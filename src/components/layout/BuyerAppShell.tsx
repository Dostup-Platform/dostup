import { ReactNode, useEffect, useState } from "react";
import AppNavigationRail, {
  RAIL_CHANGE_EVENT,
  RAIL_COLLAPSED,
  RAIL_EXPANDED,
  RAIL_STORAGE_KEY,
} from "@/components/layout/AppNavigationRail";
import type { RailSectionKey, SellerSectionKey } from "@/lib/navigation";

interface AppShellProps {
  children: ReactNode;
  activeSection?: RailSectionKey;
  sellerTab?: SellerSectionKey;
  mobileNav?: ReactNode;
  className?: string;
}

/** App chrome with navigation rail (desktop) and optional mobile nav. */
const AppShell = ({ children, activeSection, sellerTab, mobileNav, className }: AppShellProps) => {
  const [railWidth, setRailWidth] = useState(RAIL_EXPANDED);

  useEffect(() => {
    const read = () => {
      try {
        const expanded = localStorage.getItem(RAIL_STORAGE_KEY) !== "0";
        setRailWidth(expanded ? RAIL_EXPANDED : RAIL_COLLAPSED);
      } catch {
        setRailWidth(RAIL_EXPANDED);
      }
    };
    read();
    const onStorage = (event: StorageEvent) => {
      if (event.key === RAIL_STORAGE_KEY) read();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(RAIL_CHANGE_EVENT, read);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(RAIL_CHANGE_EVENT, read);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <AppNavigationRail activeSection={activeSection} sellerTab={sellerTab} />
      <div className={className}>
        <div
          className="md:pl-[var(--app-rail-width)]"
          style={{ ["--app-rail-width" as string]: `${railWidth}px` }}
        >
          {children}
        </div>
      </div>
      {mobileNav}
    </div>
  );
};

export default AppShell;
export { AppShell as BuyerAppShell };
