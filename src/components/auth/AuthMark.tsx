import { useState } from "react";

const LOGO_SRC = "/logo.png";
const FALLBACK_LOGO_SRC = "/favicon.ico";

export function AuthMark({ className = "h-14 w-14" }: { className?: string }) {
  const [imgSrc, setImgSrc] = useState(LOGO_SRC);

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-2xl shadow-sm bg-background ${className}`}
    >
      <img
        src={imgSrc}
        alt="Dostup"
        className="h-full w-full object-cover"
        onError={() => {
          if (imgSrc !== FALLBACK_LOGO_SRC) {
            setImgSrc(FALLBACK_LOGO_SRC);
          }
        }}
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

