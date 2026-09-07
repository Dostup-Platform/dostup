import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSimplePurchases } from "@/hooks/useSimplePurchases";
import AccountSettingsView from "@/components/account/AccountSettingsView";

interface AccountSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: "buyer" | "creator" | "school" | "teacher";
  displayName: string;
  createdAt?: Date | string | null;
  userId?: string;
}

export const AccountSettingsDialog = ({
  open,
  onOpenChange,
  role,
  displayName,
  createdAt,
  userId,
}: AccountSettingsDialogProps) => {
  const { t } = useLanguage();
  const { data: purchases, isLoading: purchasesLoading } = useSimplePurchases();

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-2 sm:p-4 md:p-6">
      {/* Blurred Backdrop — same frosted glass as registration and mode selection */}
      <div
        className="login-modal-backdrop absolute inset-0"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Modal Dialog Container */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("accountSettings")}
        className="relative z-10 flex h-[88vh] max-h-[720px] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border/80 bg-background shadow-2xl motion-safe:animate-fade-in sm:h-[85vh]"
      >
        <AccountSettingsView
          role={role}
          displayName={displayName}
          createdAt={createdAt}
          userId={userId}
          purchases={purchases}
          purchasesLoading={purchasesLoading}
          onClose={() => onOpenChange(false)}
        />
      </div>
    </div>,
    document.body,
  );
};

export default AccountSettingsDialog;
