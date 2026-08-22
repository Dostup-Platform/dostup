import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Search } from "lucide-react";
import MarketplaceHeader from "@/components/marketplace/MarketplaceHeader";
import ProductCard from "@/components/marketplace/ProductCard";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import {
  useCatalogPreview,
  useCatalogSearch,
  useCatalogSubjects,
  type CatalogSort,
} from "@/hooks/useCatalogSearch";
import { CATALOG_FILTER_THRESHOLD, type ProductFormat } from "@/lib/catalog";
import { rememberAuthNext } from "@/lib/creatorAuth";

const FORMAT_CHIPS: { format: ProductFormat; labelKey: "formatRecorded" | "formatIndividual" | "formatGroup" }[] = [
  { format: "recorded", labelKey: "formatRecorded" },
  { format: "individual", labelKey: "formatIndividual" },
  { format: "group", labelKey: "formatGroup" },
];

const MarketplacePage = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { sessionToken, profileType } = useSimpleAuth();
  const signedIn = Boolean(sessionToken || profileType);
  const preview = useCatalogPreview();
  const compact = (preview.data?.length ?? 0) < CATALOG_FILTER_THRESHOLD;

  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [format, setFormat] = useState<ProductFormat | "">("");
  const [subject, setSubject] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState<CatalogSort>("newest");

  const filtersEnabled = !compact && !preview.isLoading;
  const subjects = useCatalogSubjects(filtersEnabled);
  const search = useCatalogSearch(
    {
      q: submittedQuery,
      format,
      subject,
      minPrice: minPrice.trim() ? Number(minPrice) : null,
      maxPrice: maxPrice.trim() ? Number(maxPrice) : null,
      sort,
    },
    filtersEnabled,
  );

  const products = compact ? (preview.data ?? []) : (search.data ?? []);
  const loading = preview.isLoading || (filtersEnabled && search.isLoading);

  const startSelling = () => {
    if (signedIn) {
      navigate("/login?intent=sell");
      return;
    }
    rememberAuthNext("/");
    navigate("/login?intent=sell");
  };

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setSubmittedQuery(query.trim());
  };

  const subjectOptions = useMemo(() => subjects.data ?? [], [subjects.data]);

  return (
    <div className="min-h-screen bg-background">
      <MarketplaceHeader />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-10">
        <section className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance">
            {t("marketplaceHeadline")}
          </h1>
          {!compact && (
            <form onSubmit={handleSearch} className="relative mx-auto mt-6 max-w-xl">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("searchCatalogPlaceholder")}
                className="h-12 rounded-xl pl-11"
              />
            </form>
          )}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {FORMAT_CHIPS.map((chip) => {
              const active = !compact && format === chip.format;
              return (
                <button
                  key={chip.format}
                  type="button"
                  onClick={() => {
                    if (compact) return;
                    setFormat(active ? "" : chip.format);
                  }}
                  className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                    active
                      ? "border-[#FF6B00] bg-[#FF6B00]/10 text-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t(chip.labelKey)}
                </button>
              );
            })}
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            {t("marketplaceSellerLine")}
          </p>
          <button
            type="button"
            onClick={startSelling}
            className="mt-2 text-sm font-medium text-[#FF6B00] hover:underline"
          >
            {t("startSellingArrow")}
          </button>
        </section>

        {!compact && (
          <section className="mt-10 grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">{t("filterSubject")}</label>
              <Select value={subject || "all"} onValueChange={(value) => setSubject(value === "all" ? "" : value)}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder={t("allSubjects")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allSubjects")}</SelectItem>
                  {subjectOptions.map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">{t("filterFormat")}</label>
              <Select value={format || "all"} onValueChange={(value) => setFormat(value === "all" ? "" : value as ProductFormat)}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder={t("allFormats")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allFormats")}</SelectItem>
                  {FORMAT_CHIPS.map((chip) => (
                    <SelectItem key={chip.format} value={chip.format}>{t(chip.labelKey)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">{t("filterPrice")}</label>
              <div className="flex gap-2">
                <Input
                  inputMode="numeric"
                  placeholder={t("priceFrom")}
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value.replace(/[^\d]/g, ""))}
                  className="h-11"
                />
                <Input
                  inputMode="numeric"
                  placeholder={t("priceTo")}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value.replace(/[^\d]/g, ""))}
                  className="h-11"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">{t("filterSort")}</label>
              <Select value={sort} onValueChange={(value) => setSort(value as CatalogSort)}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">{t("sortNewest")}</SelectItem>
                  <SelectItem value="price_asc">{t("sortPriceAsc")}</SelectItem>
                  <SelectItem value="price_desc">{t("sortPriceDesc")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </section>
        )}

        <section className="mt-10">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-2xl border bg-card px-6 py-16 text-center">
              <p className="text-lg font-medium text-foreground">{t("catalogEmpty")}</p>
              <p className="mt-2 text-sm text-muted-foreground">{t("catalogEmptyHint")}</p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default MarketplacePage;
