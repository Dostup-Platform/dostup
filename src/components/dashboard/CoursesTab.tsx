import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCatalogProducts, type Product } from "@/hooks/useProducts";
import { useLanguage } from "@/contexts/LanguageContext";

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "KZT",
    minimumFractionDigits: 0,
  }).format(price);
};

const CourseCard = ({ product }: { product: Product }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <article
      className="rounded-xl border bg-card overflow-hidden shadow-sm cursor-pointer"
      onClick={() => navigate(`/product/${product.id}`)}
    >
      <div className="aspect-[16/9] bg-muted">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="w-10 h-10 text-muted-foreground/40" />
          </div>
        )}
      </div>
      <div className="p-4 space-y-2">
        <h3 className="font-semibold text-foreground text-lg leading-tight">{product.title}</h3>
        {product.headline && (
          <p className="text-sm text-muted-foreground line-clamp-2">{product.headline}</p>
        )}
        <p className="text-base font-bold text-foreground">{formatPrice(Number(product.price))}</p>
        {product.author_name && (
          <p className="text-sm text-muted-foreground">
            {t("author")}: {product.author_name}
          </p>
        )}
        <Button
          className="w-full mt-2"
          onClick={() => navigate(`/product/${product.id}`)}
        >
          {t("moreDetails")}
        </Button>
      </div>
    </article>
  );
};

const CoursesTab = () => {
  const { t } = useLanguage();
  const { data: products = [], isLoading } = useCatalogProducts();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      const haystack = [p.title, p.headline, p.author_name].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [products, query]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchCourses")}
          className="pl-9 pr-9 h-12"
        />
        {query && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setQuery("")}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      <h2 className="text-lg font-semibold text-foreground">{t("allCourses")}</h2>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-muted-foreground">
            {products.length === 0 ? t("noCourses") : t("noCoursesFound")}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((product) => (
            <CourseCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
};

export default CoursesTab;
