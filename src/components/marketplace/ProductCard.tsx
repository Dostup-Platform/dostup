import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ProductCover from "@/components/marketplace/ProductCover";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatLabelKey, formatPriceTenge, productHref, type CatalogProduct } from "@/lib/catalog";
import { sellerInitial } from "@/lib/productCover";

const ProductCard = ({ product }: { product: CatalogProduct }) => {
  const { t } = useLanguage();
  const sellerName = product.seller_display_name || t("author");
  const initial = sellerInitial(sellerName);

  return (
    <Link
      to={productHref(product)}
      className="group block overflow-hidden rounded-2xl bg-card focus-ring motion-safe:transition-shadow motion-safe:hover:shadow-md"
    >
      <div className="relative">
        <ProductCover
          productId={product.id}
          title={product.title}
          imageUrl={product.image_url}
          className="rounded-none"
        >
          <span className="pointer-events-none absolute left-3 top-3 rounded-full border border-[#E3E5E8] bg-white px-2.5 py-1 text-[13px] font-medium leading-none text-[#1F2328]">
            {t(formatLabelKey(String(product.format)))}
          </span>
        </ProductCover>
      </div>
      <div className="px-4 pb-4 pt-3">
        <div className="flex items-start gap-3">
          <h3 className="min-w-0 flex-1 line-clamp-2 text-base font-semibold leading-snug text-foreground">
            {product.title}
          </h3>
          <p className="shrink-0 pt-0.5 text-base font-bold tabular-nums leading-snug text-foreground">
            {formatPriceTenge(product.price)}
          </p>
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
