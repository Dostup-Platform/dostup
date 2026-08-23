import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Search } from "lucide-react";
import MarketplaceHeader from "@/components/marketplace/MarketplaceHeader";
import ProductCard from "@/components/marketplace/ProductCard";
import PublicContainer from "@/components/marketplace/PublicContainer";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCatalogSearch, type CatalogSort } from "@/hooks/useCatalogSearch";
import { type ProductFormat } from "@/lib/catalog";
import { cn } from "@/lib/utils";

const FORMAT_CHIPS: { format: ProductFormat; labelKey: "formatRecorded" | "formatIndividual" | "formatGroup" }[] = [
  { format: "recorded", labelKey: "formatRecorded" },
  { format: "individual", labelKey: "formatIndividual" },
  { format: "group", labelKey: "formatGroup" },
];

const MarketplacePage = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [format, setFormat] = useState<ProductFormat | "">("");
  const sort: CatalogSort = "newest";

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(id);
  }, [query]);

  const search = useCatalogSearch({
    q: debouncedQuery,
    format,
    sort,
  });

  const products = search.data ?? [];
  const loading = search.isLoading;

  const goLogin = () => {
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketplaceHeader />
      <PublicContainer as="main" className="flex flex-1 flex-col pb-0 pt-0">
        <section className="text-center">
          <h1 className="hero-headline mx-auto max-w-4xl pt-20 pb-14 text-balance">
            <span className="block">{t("marketplaceHeadlineLine1")}</span>
            <span className="block">{t("marketplaceHeadlineLine2")}</span>
          </h1>

          <div className="relative mx-auto w-full max-w-[760px]">
            <Search
              className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#9AA0A6]"
              aria-hidden
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchCatalogPlaceholder")}
              aria-label={t("searchCatalogPlaceholder")}
              className="h-[62px] w-full rounded-[10px] border-0 bg-[#F6F7F8] pl-[52px] pr-5 text-base text-[#1F2328] placeholder:text-[#9AA0A6] focus-ring"
              type="search"
              autoComplete="off"
            />
          </div>

          <div className="mx-auto mt-10 flex max-w-4xl flex-wrap justify-center gap-4">
            {FORMAT_CHIPS.map((chip) => {
              const active = format === chip.format;
              return (
                <button
                  key={chip.format}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFormat(active ? "" : chip.format)}
                  className={cn(
                    "inline-flex h-11 items-center rounded-full border px-6 text-[15px] font-medium focus-ring",
                    active
                      ? "border-[#FF6B00]/30 bg-[#FF6B00]/10 text-[#1F2328]"
                      : "border-[#E3E5E8] bg-white text-[#1F2328] hover:border-[#D0D3D8]",
                  )}
                >
                  {t(chip.labelKey)}
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-[140px] pb-16">
          <h2 className="mb-6 text-[26px] font-bold tracking-tight text-[#1F2328]">
            {t("allCatalogProducts")}
          </h2>
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-2xl border border-border px-6 py-16 text-center">
              <p className="text-lg font-medium text-foreground">{t("catalogEmpty")}</p>
              <p className="public-meta mt-2">{t("catalogEmptyHint")}</p>
            </div>
          ) : (
            <div className="public-catalog-grid">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>
      </PublicContainer>

      <div className="mt-auto border-t border-border">
        <PublicContainer className="flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="public-body max-w-3xl text-[#6B7280]">{t("marketplaceSellerLine")}</p>
          <button
            type="button"
            onClick={goLogin}
            className="shrink-0 text-left text-sm font-medium text-[#FF6B00] focus-ring rounded-md hover:underline"
          >
            {t("teachOnDostupArrow")}
          </button>
        </PublicContainer>
      </div>
    </div>
  );
};

export default MarketplacePage;
