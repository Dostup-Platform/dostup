import { Loader2, Star } from "lucide-react";
import { useParams } from "react-router-dom";
import CatalogGrid from "@/components/marketplace/CatalogGrid";
import MarketplaceHeader from "@/components/marketplace/MarketplaceHeader";
import BackButton from "@/components/marketplace/BackButton";
import PublicContainer from "@/components/marketplace/PublicContainer";
import PublicFooter from "@/components/layout/PublicFooter";
import ShareProductButton from "@/components/share/ShareProductButton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSellerStorefront } from "@/hooks/useSellerStorefront";
import { sellerInitial } from "@/lib/productCover";
import { sellerReviewsLabel } from "@/lib/catalog";

const StorefrontPage = () => {
  const { handle } = useParams();
  const { t, language } = useLanguage();
  const { data: seller, isLoading } = useSellerStorefront(handle);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketplaceHeader below={<BackButton />} />
      <PublicContainer as="main" className="flex-1 pb-16 pt-8">
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : !seller ? (
          <p className="py-16 public-body text-muted-foreground">{t("storefrontNotFound")}</p>
        ) : (
          <>
            <section className="flex items-start gap-3 sm:gap-5">
              <Avatar className="h-14 w-14 shrink-0 sm:h-20 sm:w-20">
                {seller.avatar_url && <AvatarImage src={seller.avatar_url} alt={seller.display_name || seller.handle} />}
                <AvatarFallback className="text-xl sm:text-2xl">{sellerInitial(seller.display_name || seller.handle)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <h1 className="min-w-0 break-words text-2xl font-bold tracking-tight text-foreground">{seller.display_name || seller.handle}</h1>
                  <ShareProductButton
                    id={seller.handle}
                    title={seller.display_name || seller.handle}
                    url={new URL("/s/" + encodeURIComponent(seller.handle), window.location.origin).toString()}
                    variant="ghost"
                    size="icon"
                    iconOnly
                    className="h-11 w-11 shrink-0"
                  />
                </div>
                <div data-testid="seller-rating" className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground sm:text-base">
                  <Star className="h-4 w-4 fill-[#FFB020] text-[#FFB020]" data-filled aria-hidden />
                  {seller.review_count > 0 && <span className="font-medium text-foreground">{seller.avg_rating.toFixed(1)}</span>}
                  <span>({sellerReviewsLabel(seller.review_count, language)})</span>
                </div>
                {seller.bio && <p className="public-body mt-3 max-w-2xl whitespace-pre-wrap break-words text-foreground">{seller.bio}</p>}
              </div>
            </section>
            <section className="mt-10 w-full">
              <h2 className="mb-6 text-[26px] font-bold tracking-tight text-foreground">{t("allCatalogProducts")}</h2>
              {seller.products.length === 0 ? (
                <p className="py-10 public-body text-muted-foreground">{t("catalogEmpty")}</p>
              ) : <CatalogGrid products={seller.products} />}
            </section>
          </>
        )}
      </PublicContainer>
      <PublicFooter />
    </div>
  );
};
export default StorefrontPage;
