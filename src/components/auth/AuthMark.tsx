export function AuthMark({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <div
      className={`rounded-2xl bg-[#FF6B00] flex items-center justify-center text-white font-bold ${className}`}
      aria-hidden
    >
      <svg viewBox="0 0 32 32" className="h-7 w-7" fill="none">
        <path
          d="M8 7h9.2c4.4 0 7.8 3.1 7.8 9s-3.4 9-7.8 9H8V7zm4.1 3.4v11.2h5c2.6 0 4.3-1.8 4.3-5.6 0-3.8-1.7-5.6-4.3-5.6h-5z"
          fill="currentColor"
        />
      </svg>
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
