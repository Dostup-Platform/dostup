import { Link, useNavigate } from "react-router-dom";
import { AuthMark } from "@/components/auth/AuthMark";
import AvatarSheet from "@/components/marketplace/AvatarSheet";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { rememberAuthNext } from "@/lib/creatorAuth";

const MarketplaceHeader = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { loading, sessionToken, profileType } = useSimpleAuth();
  const signedIn = Boolean(sessionToken || profileType);

  const startSelling = () => {
    if (signedIn) {
      navigate("/login?intent=sell");
      return;
    }
    rememberAuthNext("/");
    navigate("/login?intent=sell");
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Link to="/" className="shrink-0" aria-label="Dostup">
          <AuthMark variant="brand" className="h-auto w-28 sm:w-32" />
        </Link>
        {!loading && (
          signedIn ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="cta"
                className="hidden sm:inline-flex h-10 bg-[#FF6B00] px-4"
                onClick={startSelling}
              >
                {t("startSelling")}
              </Button>
              <AvatarSheet />
            </div>
          ) : (
            <div className="flex items-center gap-3 sm:gap-4">
              <Link
                to="/login"
                onClick={() => rememberAuthNext("/")}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                {t("signIn")}
              </Link>
              <Button
                type="button"
                variant="cta"
                className="h-10 bg-[#FF6B00] px-4"
                onClick={startSelling}
              >
                {t("startSelling")}
              </Button>
            </div>
          )
        )}
      </div>
    </header>
  );
};

export default MarketplaceHeader;
