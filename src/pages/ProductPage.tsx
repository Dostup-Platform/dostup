import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useProduct } from "@/hooks/useProducts";
import { Loader2 } from "lucide-react";
import heroBackground from "@/assets/hero-background.jpg";

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(price);
};

const ProductPage = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { data: product, isLoading } = useProduct(productId);
  
  const handleBuy = () => {
    navigate(`/checkout/${productId || "demo"}`);
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
    title: "Master Course: Digital Skills",
    headline: "Learn everything you need to succeed online",
    description: "This comprehensive course covers all the essential skills you need to build your digital presence. From basics to advanced techniques, you'll learn from industry experts with years of experience.",
    price: 4900,
    image_url: heroBackground,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Image */}
      <div className="relative w-full aspect-[4/3] md:aspect-[16/9] max-h-[50vh]">
        <img
          src={displayProduct.image_url || heroBackground}
          alt={displayProduct.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
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
            <span className="text-muted-foreground">one-time</span>
          </div>
        </div>
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
            Get Access — {formatPrice(Number(displayProduct.price))}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProductPage;
