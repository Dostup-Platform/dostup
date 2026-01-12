import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { demoProduct } from "@/lib/demo-data";
import heroBackground from "@/assets/hero-background.jpg";

const formatPrice = (price: number, currency: string) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 0,
  }).format(price / 100);
};

const ProductPage = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  
  // In production, fetch product by ID
  const product = demoProduct;
  
  const handleBuy = () => {
    // Navigate to checkout
    navigate(`/checkout/${productId || product.id}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Image */}
      <div className="relative w-full aspect-[4/3] md:aspect-[16/9] max-h-[50vh]">
        <img
          src={product.image_url || heroBackground}
          alt={product.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative -mt-16 px-4 pb-32 max-w-lg mx-auto">
        <div className="bg-card rounded-2xl p-6 shadow-lg animate-fade-in">
          {/* Title */}
          <h1 className="text-2xl md:text-3xl font-bold text-foreground text-balance leading-tight">
            {product.title}
          </h1>

          {/* Headline */}
          <p className="mt-3 text-lg text-primary font-medium">
            {product.headline}
          </p>

          {/* Description */}
          <p className="mt-4 text-muted-foreground leading-relaxed">
            {product.description}
          </p>

          {/* Price */}
          <div className="mt-6 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground">
              {formatPrice(product.price, product.currency)}
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
            Get Access — {formatPrice(product.price, product.currency)}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProductPage;
