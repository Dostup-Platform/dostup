import { FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import { AppLogoLink } from "@/components/auth/AuthMark";
import { Loader2 } from "lucide-react";

interface AuthEntryScreenProps {
  email: string;
  onEmailChange: (value: string) => void;
  onContinue: (e: FormEvent) => void;
  onGoogle: () => void;
  sending?: boolean;
  googleLoading?: boolean;
}

const AuthEntryScreen = ({
  email,
  onEmailChange,
  onContinue,
  onGoogle,
  sending,
  googleLoading,
}: AuthEntryScreenProps) => {
  const { t } = useLanguage();
  const canSubmit = email.trim().includes("@") && email.trim().length >= 3;
  const busy = sending || googleLoading;

  return (
    <Card className="w-full max-w-md rounded-2xl animate-fade-in">
      <CardContent className="pt-5 pb-6 px-6 space-y-5">
        <div className="flex flex-col items-center text-center gap-7">
          <AppLogoLink markClassName="h-9 w-auto" />
          <p className="text-2xl font-bold tracking-tight leading-[1.25]">{t("authTagline")}</p>
        </div>

        <form onSubmit={onContinue} className="space-y-3">
          <Input
            id="entryEmail"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder={t("email")}
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            className="h-12 rounded-xl"
            disabled={busy}
          />
          <Button
            type="submit"
            variant="cta"
            size="lg"
            className="w-full bg-[#FF6B00]"
            disabled={busy || !canSubmit}
          >
            {sending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("processing")}
              </span>
            ) : (
              t("continue")
            )}
          </Button>
        </form>

        <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          {t("or")}
          <span className="h-px flex-1 bg-border" />
        </div>

        <GoogleSignInButton loading={googleLoading} disabled={sending} onClick={onGoogle} />
      </CardContent>
    </Card>
  );
};

export default AuthEntryScreen;
