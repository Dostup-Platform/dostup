import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatPriceTenge, productHref, type CatalogProduct } from "@/lib/catalog";
import { BookOpen } from "lucide-react";

function formatLabelKey(format: string): "formatRecorded" | "formatIndividual" | "formatGroup" {
  if (format === "individual") return "formatIndividual";
  if (format === "group") return "formatGroup";
  return "formatRecorded";
}

const ProductCard = ({ product }: { product: CatalogProduct }) => {
  const { t } = useLanguage();
  const sellerName = product.seller_display_name || t("author");
  const initial = sellerName.trim().charAt(0).toUpperCase() || "D";

  return (
    <Link
      to={productHref(product)}
      className="group overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="aspect-[16/9] bg-muted">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}
      </div>
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{t(formatLabelKey(String(product.format)))}</Badge>
          {product.has_schedule && (
            <span className="text-xs text-muted-foreground">{t("hasScheduleMarker")}</span>
          )}
        </div>
        <h3 className="text-base font-semibold leading-snug text-foreground line-clamp-2">
          {product.title}
        </h3>
        <div className="flex items-center gap-2 min-w-0">
          <Avatar className="h-7 w-7">
            {product.seller_avatar_url && (
              <AvatarImage src={product.seller_avatar_url} alt={sellerName} />
            )}
            <AvatarFallback className="text-xs">{initial}</AvatarFallback>
          </Avatar>
          <span className="truncate text-sm text-muted-foreground">{sellerName}</span>
        </div>
        <p className="text-base font-bold text-foreground">{formatPriceTenge(product.price)}</p>
      </div>
    </Link>
  );
};

export default ProductCard;
