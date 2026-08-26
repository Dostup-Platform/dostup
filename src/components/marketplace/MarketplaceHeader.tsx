import { Link, useLocation } from "react-router-dom";
import AppHeader from "@/components/layout/AppHeader";
import BuyerHeaderAccount from "@/components/layout/BuyerHeaderAccount";
import PublicLocaleToggle from "@/components/marketplace/PublicLocaleToggle";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { profileHomePath } from "@/lib/creatorAuth";
import { loginState } from "@/lib/loginModal";

function isSellerProfile(profileType: string | null | undefined) {
  return profileType === "creator" || profileType === "school";
}

const MarketplaceHeader = () => {
  const { t } = useLanguage();
  const location = useLocation();
  const { loading, sessionToken, profileType } = useSimpleAuth();
  const signedIn = Boolean(sessionToken && profileType);
  const isSeller = isSellerProfile(profileType);
  const cabinetPath = profileHomePath(
    profileType || "buyer",
    localStorage.getItem("creator_account_type"),
  );

  return (
    <AppHeader>
      {!loading && (
        signedIn ? (
          <>
            {isSeller ? (
              <Link
                to={cabinetPath}
                className="text-sm font-medium text-foreground hover:text-[#1F2328] focus-ring rounded-md"
              >
                {t("myCabinet")}
              </Link>
            ) : (
              <>
                <Link
                  to="/dashboard"
                  className="text-sm font-medium text-foreground hover:text-[#1F2328] focus-ring rounded-md"
                >
                  {t("myCourses")}
                </Link>
                <BuyerHeaderAccount />
              </>
            )}
          </>
        ) : (
          <>
            <PublicLocaleToggle />
            <Link
              to="/login"
              state={loginState(location)}
              className="inline-flex h-10 items-center rounded-full border border-[#E3E5E8] px-5 text-[15px] font-medium text-[#1F2328] transition-colors hover:bg-[#F6F7F8] focus-ring"
            >
              {t("signIn")}
            </Link>
          </>
        )
      )}
    </AppHeader>
  );
};

export default MarketplaceHeader;
