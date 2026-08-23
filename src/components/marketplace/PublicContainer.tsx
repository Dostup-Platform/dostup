import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const PublicContainer = ({
  className,
  as: Comp = "div",
  children,
}: {
  className?: string;
  as?: "div" | "main" | "section" | "header" | "footer";
  children: ReactNode;
}) => {
  return <Comp className={cn("public-container", className)}>{children}</Comp>;
};

export default PublicContainer;
