import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useProduct } from "@/hooks/useProducts";
import { useLanguage } from "@/contexts/LanguageContext";

import { Loader2, Play } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import heroBackground from "@/assets/hero-background.jpg";

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "KZT",
    minimumFractionDigits: 0,
  }).format(price);
};

const ProductPage = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t, language } = useLanguage();
  const { data: product, isLoading } = useProduct(productId);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Передаём параметры учителя на страницу checkout
  const handleBuy = () => {
    const teacherParam = searchParams.get("teacher");
    const checkoutUrl = `/checkout/${productId || "demo"}${teacherParam ? `?teacher=${encodeURIComponent(teacherParam)}` : ""}`;
    navigate(checkoutUrl);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Use demo product if no real product found
  const displayProduct = product || {
    title: "Мастер-курс: Цифровые навыки",
    headline: "Научитесь всему необходимому для успеха в интернете",
    description: "Этот комплексный курс охватывает все необходимые навыки для создания вашего цифрового присутствия. От основ до продвинутых техник — вы научитесь у экспертов с многолетним опытом.",
    price: 49000,
    image_url: heroBackground,
    video_url: null as string | null,
  };

  const videoUrl = (displayProduct as any).video_url as string | null | undefined;
  const imageUrl = displayProduct.image_url || heroBackground;
  const faqRaw = (displayProduct as any).faq;
  const faq: Array<{ question: string; answer: string }> = Array.isArray(faqRaw)
    ? faqRaw.filter((it: any) => it && (it.question || it.answer))
    : [];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Media */}
      <div className="relative w-full aspect-[4/3] md:aspect-[16/9] max-h-[50vh] bg-black">
        {videoUrl && displayProduct.image_url && !isPlaying ? (
          <>
            <img
              src={imageUrl}
              alt={displayProduct.title}
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
            poster={displayProduct.image_url || undefined}
            controls
            autoPlay={isPlaying}
            playsInline
            preload="metadata"
            className="w-full h-full object-contain bg-black"
          />
        ) : (
          <img
            src={imageUrl}
            alt={displayProduct.title}
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Content */}
      <div className="relative -mt-16 px-4 pb-32 max-w-lg mx-auto">
        <div className="bg-card rounded-2xl p-6 shadow-lg animate-fade-in">
          {/* Title */}
          <h1 className="text-2xl md:text-3xl font-bold text-foreground text-balance leading-tight">
            {displayProduct.title}
          </h1>

          {/* Headline */}
          <p className="mt-3 text-lg text-primary font-medium">
            {displayProduct.headline}
          </p>

          {/* Description */}
          <p className="mt-4 text-muted-foreground leading-relaxed">
            {displayProduct.description}
          </p>

          {/* Price */}
          <div className="mt-6 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground">
              {formatPrice(Number(displayProduct.price))}
            </span>
            <span className="text-muted-foreground">{t("oneTime")}</span>
          </div>
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

      {/* Fixed CTA Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-lg border-t border-border safe-area-inset">
        <div className="max-w-lg mx-auto">
          <Button 
            variant="cta" 
            size="xl" 
            className="w-full"
            onClick={handleBuy}
          >
            {t("getAccess")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProductPage;
