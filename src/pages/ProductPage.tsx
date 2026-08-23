import { Link, useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import ShareProductButton from "@/components/share/ShareProductButton";
import { isUuid } from "@/lib/productShare";
import MarketplaceHeader from "@/components/marketplace/MarketplaceHeader";
import ProductCover from "@/components/marketplace/ProductCover";
import PublicContainer from "@/components/marketplace/PublicContainer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useProduct, useProductProgram, type ProductProgramItem } from "@/hooks/useProducts";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatPriceTenge } from "@/lib/catalog";
import { sellerInitial } from "@/lib/productCover";
import { ArrowLeft, FileText, Folder, Loader2, Play } from "lucide-react";

const ProgramTree = ({ items, parentId }: { items: ProductProgramItem[]; parentId: string | null }) => {
  const children = items
    .filter((item) => (item.parent_id ?? null) === parentId)
    .sort((a, b) => a.order_index - b.order_index);
  if (children.length === 0) return null;

  return (
    <ul className="space-y-2">
      {children.map((item) => {
        const isFolder = item.type === "folder";
        return (
          <li key={item.id}>
            <div className="flex items-start gap-2 public-body text-foreground">
              {isFolder ? (
                <Folder className="mt-1 h-4 w-4 shrink-0 text-[#6B7280]" />
              ) : (
                <FileText className="mt-1 h-4 w-4 shrink-0 text-[#6B7280]" />
              )}
              <span>{item.title}</span>
            </div>
            {isFolder && (
              <div className="ml-6 mt-2">
                <ProgramTree items={items} parentId={item.id} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
};

const BuyButton = ({
  disabled,
  pausedMessage,
  onClick,
  label,
}: {
  disabled: boolean;
  pausedMessage: string;
  onClick: () => void;
  label: string;
}) => {
  if (disabled) {
    return (
      <div className="w-full rounded-2xl border border-border bg-muted/60 px-4 py-3 text-center text-sm text-foreground whitespace-pre-wrap">
        {pausedMessage}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-12 w-full rounded-2xl bg-[#FF6B00] px-6 text-base font-semibold text-white focus-ring hover:bg-[#E86000]"
    >
      {label}
    </button>
  );
};

const ProductPage = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  const { data: product, isLoading } = useProduct(productId);
  const { data: program = [] } = useProductProgram(product?.id);
  const [isPlaying, setIsPlaying] = useState(false);

  const handleBuy = () => {
    const teacherParam = searchParams.get("teacher");
    const checkoutUrl = `/checkout/${product?.id || ""}${teacherParam ? `?teacher=${encodeURIComponent(teacherParam)}` : ""}`;
    navigate(checkoutUrl);
  };

  useEffect(() => {
    if (!product?.slug || !productId) return;
    if (isUuid(productId) && product.slug !== productId) {
      navigate(`/p/${encodeURIComponent(product.slug)}${window.location.search}`, { replace: true });
    }
  }, [product?.slug, productId, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <MarketplaceHeader />
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <MarketplaceHeader />
        <PublicContainer className="py-6">
          <Link
            to="/"
            className="mb-8 inline-flex items-center gap-2 public-meta hover:text-foreground focus-ring rounded-md"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t("back")}</span>
          </Link>
          <p className="public-body text-[#6B7280]">{t("productNotFound")}</p>
        </PublicContainer>
      </div>
    );
  }

  const videoUrl = product.video_url;
  const faq = Array.isArray(product.faq)
    ? product.faq.filter((it) => it && (it.question || it.answer))
    : [];
  const isPaused = Boolean(product.is_paused);
  const pausedMessage: string =
    (product.paused_message && String(product.paused_message).trim()) || t("productPausedDefault");
  const sellerName = product.author_name || t("author");
  const accessLabel = product.access_duration_days
    ? t("accessDays", { days: product.access_duration_days })
    : t("accessLifetime");

  const sellerBlock = product.seller_handle ? (
    <Link
      to={`/s/${encodeURIComponent(product.seller_handle)}`}
      className="flex items-center gap-3 rounded-md focus-ring"
    >
      <Avatar className="h-10 w-10">
        {product.seller_avatar_url && (
          <AvatarImage src={product.seller_avatar_url} alt="" />
        )}
        <AvatarFallback>{sellerInitial(sellerName)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{sellerName}</span>
        <span className="public-meta">/s/{product.seller_handle}</span>
      </span>
    </Link>
  ) : (
    <div className="flex items-center gap-3">
      <Avatar className="h-10 w-10">
        <AvatarFallback>{sellerInitial(sellerName)}</AvatarFallback>
      </Avatar>
      <span className="text-sm font-medium text-foreground">{sellerName}</span>
    </div>
  );

  const purchaseBody = (
    <>
      <p className="text-3xl font-bold tracking-tight text-foreground">
        {formatPriceTenge(Number(product.price))}
      </p>
      <p className="public-meta mt-2">{accessLabel}</p>
      <div className="mt-6 border-t border-border pt-6">{sellerBlock}</div>
      <div className="mt-6">
        <BuyButton
          disabled={isPaused}
          pausedMessage={pausedMessage}
          onClick={handleBuy}
          label={t("buy")}
        />
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      <MarketplaceHeader />
      <PublicContainer className="pb-28 pt-4 lg:pb-16 lg:pt-6">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-2 public-meta hover:text-foreground focus-ring rounded-md"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{t("back")}</span>
        </Link>

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10">
          <div>
            <div className="overflow-hidden rounded-2xl">
              {videoUrl && isPlaying ? (
                <video
                  src={videoUrl}
                  poster={product.image_url || undefined}
                  controls
                  autoPlay
                  playsInline
                  preload="metadata"
                  className="aspect-[16/10] w-full bg-black object-contain"
                />
              ) : (
                <ProductCover
                  productId={product.id}
                  title={product.title}
                  imageUrl={product.image_url}
                  decorative={false}
                  titleClassName="text-[28px] md:text-[32px] lg:text-[40px]"
                  className="rounded-2xl"
                >
                  {videoUrl && (
                    <button
                      type="button"
                      onClick={() => setIsPlaying(true)}
                      aria-label={t("playVideo")}
                      className="absolute inset-0 flex items-center justify-center focus-ring"
                    >
                      <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-background/80 shadow-lg motion-safe:transition-transform motion-safe:hover:scale-110">
                        <Play className="ml-1 h-8 w-8 fill-foreground text-foreground" />
                      </span>
                    </button>
                  )}
                </ProductCover>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
              <h1 className="public-display text-foreground text-balance min-w-0 flex-1">
                {product.title}
              </h1>
              <ShareProductButton
                title={product.title}
                id={product.id}
                slug={product.slug}
                sellerHandle={product.seller_handle}
                variant="outline"
                size="sm"
                className="shrink-0"
              />
            </div>
            {product.headline && (
              <p className="public-body mt-3 text-foreground">{product.headline}</p>
            )}
            {product.description && (
              <p className="public-body mt-4 whitespace-pre-wrap text-[#6B7280]">
                {product.description}
              </p>
            )}

            {program.length > 0 && (
              <div className="mt-8">
                <h2 className="mb-4 text-lg font-semibold text-foreground">
                  {t("courseProgram")}
                </h2>
                <ProgramTree items={program} parentId={null} />
              </div>
            )}

            {product.has_schedule && (
              <p className="public-meta mt-8 rounded-2xl bg-[#F3F4F6] px-4 py-3">
                {t("productScheduleNote")}
              </p>
            )}

            {faq.length > 0 && (
              <div className="mt-8">
                <h2 className="mb-2 text-lg font-semibold text-foreground">
                  {t("faqTitle")}
                </h2>
                <Accordion type="single" collapsible className="w-full">
                  {faq.map((item, idx) => (
                    <AccordionItem key={idx} value={`faq-${idx}`} className="border-border">
                      <AccordionTrigger className="public-body text-left font-medium hover:no-underline">
                        {item.question}
                      </AccordionTrigger>
                      <AccordionContent className="public-body whitespace-pre-wrap text-[#6B7280]">
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            )}

            <div className="mt-8 lg:hidden">{sellerBlock}</div>
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-2xl border border-border bg-card p-6">
              {purchaseBody}
            </div>
          </aside>
        </div>
      </PublicContainer>

      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/90 p-4 backdrop-blur-lg safe-area-inset lg:hidden">
        <PublicContainer className="flex items-center gap-4">
          {isPaused ? (
            <div className="w-full rounded-2xl border border-border bg-muted/60 px-4 py-3 text-center text-sm text-foreground whitespace-pre-wrap">
              {pausedMessage}
            </div>
          ) : (
            <>
              <p className="shrink-0 text-lg font-bold tabular-nums text-foreground">
                {formatPriceTenge(Number(product.price))}
              </p>
              <button
                type="button"
                onClick={handleBuy}
                className="h-12 min-w-0 flex-1 rounded-2xl bg-[#FF6B00] px-6 text-base font-semibold text-white focus-ring hover:bg-[#E86000]"
              >
                {t("buy")}
              </button>
            </>
          )}
        </PublicContainer>
      </div>
    </div>
  );
};

export default ProductPage;
