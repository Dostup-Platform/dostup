import { Loader2 } from "lucide-react";
import { useParams } from "react-router-dom";
import MarketplaceHeader from "@/components/marketplace/MarketplaceHeader";
import ProductCard from "@/components/marketplace/ProductCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSellerStorefront } from "@/hooks/useSellerStorefront";

const StorefrontPage = () => {
  const { handle } = useParams();
  const { t } = useLanguage();
  const { data: seller, isLoading } = useSellerStorefront(handle);

  return (
    <div className="min-h-screen bg-background">
      <MarketplaceHeader />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-10">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !seller ? (
          <p className="py-16 text-center text-muted-foreground">{t("storefrontNotFound")}</p>
        ) : (
          <>
            <section className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left gap-5">
              <Avatar className="h-24 w-24">
                {seller.avatar_url && <AvatarImage src={seller.avatar_url} alt={seller.display_name || seller.handle} />}
                <AvatarFallback className="text-2xl">
                  {(seller.display_name || seller.handle).charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 space-y-2">
                <h1 className="text-2xl font-bold text-foreground">
                  {seller.display_name || seller.handle}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {seller.type === "school" ? t("sellerRoleSchool") : t("sellerRoleCreator")}
                </p>
                {seller.bio && (
                  <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                    {seller.bio}
                  </p>
                )}
              </div>
            </section>
            <section className="mt-10">
              {seller.products.length === 0 ? (
                <p className="py-10 text-center text-muted-foreground">{t("catalogEmpty")}</p>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {seller.products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default StorefrontPage;
