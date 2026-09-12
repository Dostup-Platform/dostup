import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AuthMark } from "@/components/auth/AuthMark";
import InstallBanner from "@/components/install/InstallBanner";
import { cn } from "@/lib/utils";

type AppHeaderProps = {
  children?: ReactNode;
  className?: string;
};

/** Full-width header beside the rail; logo is always 24px from the left edge. */
const AppHeader = ({ children, className }: AppHeaderProps) => (
  <div className={cn("sticky top-0 z-30 safe-area-inset", className)}>
    <InstallBanner />
    <header className="border-b border-border/70 bg-background/90 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-6 pl-6 pr-6">
        <Link to="/" className="flex shrink-0 items-center focus-ring rounded-md" aria-label="Dostup">
          <AuthMark variant="brand" className="h-[28px] w-auto" />
        </Link>
        {children ? <div className="flex shrink-0 items-center gap-2 md:gap-1">{children}</div> : null}
      </div>
    </header>
  </div>
);

export default AppHeader;
