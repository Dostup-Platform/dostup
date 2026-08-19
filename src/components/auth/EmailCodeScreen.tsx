import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { maskEmail } from "@/components/auth/AuthMark";
import { Loader2 } from "lucide-react";

const COOLDOWN_MS = 60_000;
const OTP_LENGTH = 6;

interface EmailCodeScreenProps {
  email: string;
  verifying?: boolean;
  sending?: boolean;
  onVerify: (code: string) => void | Promise<void>;
  onResend: () => void | Promise<void>;
  onBack: () => void;
}

const EmailCodeScreen = ({
  email,
  verifying,
  sending,
  onVerify,
  onResend,
  onBack,
}: EmailCodeScreenProps) => {
  const { t } = useLanguage();
  const [digits, setDigits] = useState(() => Array.from({ length: OTP_LENGTH }, () => ""));
  const [cooldownUntil, setCooldownUntil] = useState(() => Date.now() + COOLDOWN_MS);
  const [now, setNow] = useState(Date.now());
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const submitted = useRef("");

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const secondsLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const canResend = secondsLeft === 0 && !sending && !verifying;
  const code = digits.join("");

  useEffect(() => {
    if (code.length === OTP_LENGTH && submitted.current !== code && !verifying) {
      submitted.current = code;
      void onVerify(code);
    }
  }, [code, onVerify, verifying]);

  const applyDigits = (next: string[], start: number) => {
    setDigits(next);
    const firstEmpty = next.findIndex((d) => !d);
    const focusAt = firstEmpty === -1 ? OTP_LENGTH - 1 : firstEmpty;
    refs.current[Math.max(start, focusAt)]?.focus();
  };

  const handleChange = (index: number, value: string) => {
    const cleaned = value.replace(/\D/g, "");
    if (!cleaned) {
      const next = [...digits];
      next[index] = "";
      setDigits(next);
      return;
    }
    if (cleaned.length > 1) {
      const next = [...digits];
      for (let i = 0; i < cleaned.length && index + i < OTP_LENGTH; i++) {
        next[index + i] = cleaned[i];
      }
      applyDigits(next, index);
      return;
    }
    const next = [...digits];
    next[index] = cleaned;
    applyDigits(next, index + 1);
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (index: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!text) return;
    const next = [...digits];
    for (let i = 0; i < text.length && index + i < OTP_LENGTH; i++) {
      next[index + i] = text[i];
    }
    applyDigits(next, index);
  };

  const handleResend = async () => {
    if (!canResend) return;
    await onResend();
    setCooldownUntil(Date.now() + COOLDOWN_MS);
    submitted.current = "";
  };

  return (
    <Card className="w-full max-w-md rounded-2xl animate-fade-in">
      <CardContent className="pt-8 pb-6 px-6 space-y-5">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold">{t("enterCodeSentTo")}</h1>
          <p className="text-sm text-muted-foreground">{maskEmail(email)}</p>
        </div>

        <div className="flex justify-center gap-2">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                refs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              autoComplete={index === 0 ? "one-time-code" : "off"}
              maxLength={index === 0 ? OTP_LENGTH : 1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={(e) => handlePaste(index, e)}
              disabled={verifying}
              className="h-12 w-10 sm:w-11 rounded-xl border border-input bg-background text-center text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label={`${index + 1}`}
            />
          ))}
        </div>

        {verifying && (
          <div className="flex justify-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        )}

        <div className="space-y-2 text-center">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={!canResend}
            onClick={() => void handleResend()}
          >
            {sending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("processing")}
              </span>
            ) : secondsLeft > 0 ? (
              t("resendIn", { seconds: secondsLeft })
            ) : (
              t("resendLink")
            )}
          </Button>
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground"
            onClick={onBack}
            disabled={verifying}
          >
            {t("back")}
          </button>
        </div>
      </CardContent>
    </Card>
  );
};

export default EmailCodeScreen;
