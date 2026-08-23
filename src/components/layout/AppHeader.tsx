import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AuthMark } from "@/components/auth/AuthMark";
import InstallBanner from "@/components/install/InstallBanner";
import PublicContainer from "@/components/marketplace/PublicContainer";
import { cn } from "@/lib/utils";

type AppHeaderProps = {
  children?: ReactNode;
  className?: string;
  /** "contained" centres content in the 1200px public container; "dashboard" spans full width with 24px inline padding. */
  variant?: "contained" | "dashboard";
};

const headerInnerClass = "flex h-16 items-center justify-between gap-6";

const AppHeader = ({ children, className, variant = "contained" }: AppHeaderProps) => {
  const inner = (
    <>
      <Link to="/" className="flex shrink-0 items-center focus-ring rounded-md" aria-label="Dostup">
        <AuthMark variant="brand" className="h-[28px] w-auto" />
      </Link>
      {children ? <div className="flex shrink-0 items-center gap-6">{children}</div> : null}
    </>
  );

  return (
    <div className={cn("sticky top-0 z-30 safe-area-inset", className)}>
      <InstallBanner />
      <header className="border-b border-border/70 bg-background/90 backdrop-blur">
        {variant === "dashboard" ? (
          <div className={cn(headerInnerClass, "px-6")}>{inner}</div>
        ) : (
          <PublicContainer className={headerInnerClass}>{inner}</PublicContainer>
        )}
      </header>
    </div>
  );
};

export default AppHeader;
