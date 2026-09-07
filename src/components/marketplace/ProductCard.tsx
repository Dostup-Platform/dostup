import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ProductCover from "@/components/marketplace/ProductCover";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatCatalogPrice, formatEventDate, productHref, type CatalogProduct } from "@/lib/catalog";
import { sellerInitial } from "@/lib/productCover";

const ProductCard = ({ product }: { product: CatalogProduct }) => {
  const { t, language } = useLanguage();
  const sellerName = product.seller_display_name || t("author");
  const initial = sellerInitial(sellerName);

  return (
    <Link
      to={productHref(product)}
      className="group flex min-w-0 flex-col overflow-hidden rounded-2xl bg-card focus-ring motion-safe:transition-shadow motion-safe:hover:shadow-md"
    >
      <ProductCover
        productId={product.id}
        title={product.title}
        imageUrl={product.image_url}
        emoji={product.category_emoji}
        className="rounded-none"
      />
      <div className="flex min-w-0 flex-col px-4 pb-4 pt-3">
        <h3 className="line-clamp-2 w-full min-w-0 text-base font-semibold leading-snug text-foreground">
          {product.title}
        </h3>
        {product.category_slug === "events" && product.event_starts_at && (
          <p className="mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-[#6B7280]">
            {formatEventDate(product.event_starts_at, language)}
          </p>
        )}
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-left text-base font-bold tabular-nums leading-snug text-foreground">
            {formatCatalogPrice(product, language)}
          </p>
          {product.has_free_trial && (
            <span className="text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0">
              Пробный период
            </span>
          )}
        </div>
        <div className="mt-2 flex min-w-0 items-center gap-2">
          <Avatar className="h-5 w-5">
            {product.seller_avatar_url && (
              <AvatarImage src={product.seller_avatar_url} alt="" />
            )}
            <AvatarFallback className="text-[10px]">{initial}</AvatarFallback>
          </Avatar>
          <span className="public-meta truncate">{sellerName}</span>
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;
