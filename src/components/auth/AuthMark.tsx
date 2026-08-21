import { useState } from "react";

const LOGO_SRC = "/logo.png";
const FALLBACK_LOGO_SRC = "/favicon.ico";

export function AuthMark({
  className = "h-14 w-14",
  variant = "icon",
}: {
  className?: string;
  variant?: "icon" | "brand";
}) {
  const [imgSrc, setImgSrc] = useState(LOGO_SRC);

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
        className={`h-auto w-[7.5rem] sm:w-32 object-contain ${className}`}
        onError={handleError}
      />
    );
  }

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-2xl shadow-sm bg-background ${className}`}
    >
      <img
        src={imgSrc}
        alt="Dostup"
        className="h-full w-full object-cover"
        onError={handleError}
      />
    </div>
  );
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const keep = Math.min(4, Math.max(1, local.length - 1));
  const hidden = Math.max(3, local.length - keep);
  return `${local.slice(0, keep)}${"•".repeat(hidden)}@${domain}`;
}

