import { useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const LOGO_WORDMARK_SRC = "/logo-wordmark.png";
const LOGO_ICON_SRC = "/icon-192.png";
const FALLBACK_LOGO_SRC = "/favicon.ico";

export function AuthMark({
  className,
  variant = "icon",
}: {
  className?: string;
  variant?: "icon" | "brand";
}) {
  const [imgSrc, setImgSrc] = useState(
    variant === "brand" ? LOGO_WORDMARK_SRC : LOGO_ICON_SRC,
  );

  const handleError = () => {
    if (imgSrc !== FALLBACK_LOGO_SRC) {
      setImgSrc(FALLBACK_LOGO_SRC);
    }
  };

  if (variant === "brand") {
    return (
      <img
        src={imgSrc}
        alt="Dostup"
        className={cn("h-[28px] w-auto object-contain object-left", className)}
        onError={handleError}
      />
    );
  }

  return (
    <div
      className={cn(
        "relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl",
        className,
      )}
    >
      <img
        src={imgSrc}
        alt="Dostup"
        className="h-full w-full object-contain"
        onError={handleError}
      />
    </div>
  );
}

export function AppLogoLink({
  className,
  markClassName,
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <Link to="/" className={`flex shrink-0 items-center ${className ?? ""}`} aria-label="Dostup">
      <AuthMark variant="brand" className={markClassName} />
    </Link>
  );
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const keep = Math.min(4, Math.max(1, local.length - 1));
  const hidden = Math.max(3, local.length - keep);
  return `${local.slice(0, keep)}${"•".repeat(hidden)}@${domain}`;
}

