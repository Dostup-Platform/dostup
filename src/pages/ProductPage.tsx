import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useProduct, useProductProgram, type ProductProgramItem } from "@/hooks/useProducts";
import { useLanguage } from "@/contexts/LanguageContext";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, FileText, Folder, Loader2, Play } from "lucide-react";

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "KZT",
    minimumFractionDigits: 0,
  }).format(price);
};

const ProgramTree = ({ items, parentId }: { items: ProductProgramItem[]; parentId: string | null }) => {
  const children = items
    .filter((item) => (item.parent_id ?? null) === parentId)
    .sort((a, b) => a.order_index - b.order_index);
  if (children.length === 0) return null;

  return (
    <ul className="space-y-1.5">
      {children.map((item) => {
        const isFolder = item.type === "folder";
        return (
          <li key={item.id}>
            <div className="flex items-start gap-2 text-sm text-foreground">
              {isFolder ? (
                <Folder className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
              ) : (
                <FileText className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
              )}
              <span>{item.title}</span>
            </div>
            {isFolder && (
              <div className="ml-6 mt-1">
                <ProgramTree items={items} parentId={item.id} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
};

const ProductPage = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t, language } = useLanguage();
  const { data: product, isLoading } = useProduct(productId);
  const { data: program = [] } = useProductProgram(product?.id);
  const [isPlaying, setIsPlaying] = useState(false);

  const handleBuy = () => {
    const teacherParam = searchParams.get("teacher");
    const checkoutUrl = `/checkout/${productId || ""}${teacherParam ? `?teacher=${encodeURIComponent(teacherParam)}` : ""}`;
    navigate(checkoutUrl);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background px-4 py-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground touch-manipulation mb-8"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>{t("back")}</span>
        </button>
        <p className="text-center text-muted-foreground">{t("productNotFound")}</p>
      </div>
    );
  }

  const videoUrl = product.video_url;
  const imageUrl = product.image_url;
  const faq = Array.isArray(product.faq)
    ? product.faq.filter((it) => it && (it.question || it.answer))
    : [];
  const isPaused = Boolean(product.is_paused);
  const pausedMessage: string =
    (product.paused_message && String(product.paused_message).trim()) ||
    (language === "kk"
      ? "Автор осы сілтемені уақытша өшірді."
      : "Автор отключил ссылку.");

  return (
    <div className="min-h-screen bg-background">
      <div className="relative w-full aspect-[4/3] md:aspect-[16/9] max-h-[50vh] bg-muted">
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 z-20 flex items-center gap-1 rounded-full bg-background/80 backdrop-blur px-3 py-2 text-sm text-foreground shadow-sm touch-manipulation"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("back")}
        </button>

        {videoUrl && imageUrl && !isPlaying ? (
          <>
            <img
              src={imageUrl}
              alt={product.title}
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={() => setIsPlaying(true)}
              aria-label="Play video"
              className="absolute inset-0 flex items-center justify-center group"
            >
              <span className="flex items-center justify-center w-[72px] h-[72px] rounded-full bg-background/80 backdrop-blur shadow-lg transition-transform group-hover:scale-110">
                <Play className="w-8 h-8 text-foreground fill-foreground ml-1" />
              </span>
            </button>
          </>
        ) : videoUrl ? (
          <video
            src={videoUrl}
            poster={imageUrl || undefined}
            controls
            autoPlay={isPlaying}
            playsInline
            preload="metadata"
            className="w-full h-full object-contain bg-black"
          />
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt={product.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted" />
        )}
      </div>

      <div className="relative -mt-16 px-4 pb-32 max-w-lg mx-auto">
        <div className="bg-card rounded-2xl p-6 shadow-lg animate-fade-in">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground text-balance leading-tight">
            {product.title}
          </h1>

          {product.headline && (
            <p className="mt-3 text-lg text-primary font-medium">
              {product.headline}
            </p>
          )}

          {product.description && (
            <p className="mt-4 text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {product.description}
            </p>
          )}

          {program.length > 0 && (
            <div className="mt-6">
              <h2 className="text-base font-semibold text-foreground mb-3">
                {t("courseProgram")}
              </h2>
              <ProgramTree items={program} parentId={null} />
            </div>
          )}

          <div className="mt-6 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground">
              {formatPrice(Number(product.price))}
            </span>
            <span className="text-muted-foreground">{t("oneTime")}</span>
          </div>

          {product.author_name && (
            <p className="mt-3 text-sm text-muted-foreground">
              {t("author")}: {product.author_name}
            </p>
          )}
        </div>

        {faq.length > 0 && (
          <div className="mt-6 bg-card rounded-2xl p-6 shadow-lg animate-fade-in">
            <h2 className="text-xl font-semibold text-foreground mb-2">
              {language === "kk" ? "Жиі қойылатын сұрақтар" : "Часто задаваемые вопросы"}
            </h2>
            <Accordion type="single" collapsible className="w-full">
              {faq.map((item, idx) => (
                <AccordionItem key={idx} value={`faq-${idx}`} className="border-border">
                  <AccordionTrigger className="text-left text-base font-medium hover:no-underline">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-lg border-t border-border safe-area-inset">
        <div className="max-w-lg mx-auto">
          {isPaused ? (
            <div className="w-full rounded-xl bg-muted/60 border border-border px-4 py-3 text-center text-sm text-foreground whitespace-pre-wrap">
              {pausedMessage}
            </div>
          ) : (
            <Button
              variant="cta"
              size="xl"
              className="w-full"
              onClick={handleBuy}
            >
              {t("buy")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductPage;
