import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useProduct } from "@/hooks/useProducts";
import { ArrowLeft, Lock, CreditCard, Loader2 } from "lucide-react";
import heroBackground from "@/assets/hero-background.jpg";

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(price);
};

const CheckoutPage = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { data: product, isLoading } = useProduct(productId);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    // Simulate payment processing
    // In production, this would integrate with Stripe
    setTimeout(() => {
      // After successful payment, redirect to password setup
      navigate("/setup-password", { 
        state: { 
          email, 
          name,
          productId: productId || product?.id 
        } 
      });
    }, 2000);
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
    title: "Digital Product",
    headline: "Get access to premium content",
    price: 4900,
    image_url: heroBackground,
  };

  return (
    <div className="min-h-screen bg-muted/30 py-6 px-4">
      <div className="max-w-lg mx-auto">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 touch-manipulation"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        {/* Order Summary */}
        <Card className="mb-6 animate-fade-in">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Order Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-foreground">{displayProduct.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{displayProduct.headline}</p>
              </div>
              <span className="text-lg font-bold text-foreground">
                {formatPrice(Number(displayProduct.price))}
              </span>
            </div>
            <div className="mt-4 pt-4 border-t border-border flex justify-between">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-bold text-primary">
                {formatPrice(Number(displayProduct.price))}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Checkout Form */}
        <Card className="animate-fade-in" style={{ animationDelay: "100ms" }}>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Lock className="w-4 h-4 text-success" />
              Secure Checkout
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePayment} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="h-12"
                />
              </div>

              {/* Card details placeholder */}
              <div className="space-y-2">
                <Label>Card Details</Label>
                <div className="border border-input rounded-lg p-4 bg-muted/50">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <CreditCard className="w-5 h-5" />
                    <span className="text-sm">Stripe payment integration</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Demo mode — Click pay to simulate successful payment
                  </p>
                </div>
              </div>

              <Button 
                type="submit" 
                variant="cta" 
                size="lg" 
                className="w-full mt-6"
                disabled={isProcessing || !email || !name}
              >
                {isProcessing ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </span>
                ) : (
                  `Pay ${formatPrice(Number(displayProduct.price))}`
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground mt-4">
                By completing this purchase, you agree to our terms of service.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CheckoutPage;
