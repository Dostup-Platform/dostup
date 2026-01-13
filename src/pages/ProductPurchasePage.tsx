import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useProduct } from "@/hooks/useProducts";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Lock, Loader2, ExternalLink, Clock } from "lucide-react";
import { toast } from "sonner";
import heroBackground from "@/assets/hero-background.jpg";

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "KZT",
    minimumFractionDigits: 0,
  }).format(price);
};

const ProductPurchasePage = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user, register } = useSimpleAuth();
  const { data: product, isLoading } = useProduct(productId);
  
  const [fullName, setFullName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [purchaseStatus, setPurchaseStatus] = useState<"form" | "pending" | "completed">("form");
  const [purchaseId, setPurchaseId] = useState<string | null>(null);

  // Проверить статус покупки при загрузке
  useEffect(() => {
    const checkExistingPurchase = async () => {
      if (user && productId) {
        const { data } = await supabase
          .from("simple_purchases")
          .select("*")
          .eq("simple_user_id", user.id)
          .eq("product_id", productId)
          .single();

        if (data) {
          setPurchaseId(data.id);
          if (data.status === "completed") {
            setPurchaseStatus("completed");
            navigate("/dashboard");
          } else {
            setPurchaseStatus("pending");
          }
        }
      }
    };

    checkExistingPurchase();
  }, [user, productId, navigate]);

  // Polling для проверки подтверждения
  useEffect(() => {
    if (purchaseStatus !== "pending" || !purchaseId) return;

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("simple_purchases")
        .select("status")
        .eq("id", purchaseId)
        .single();

      if (data?.status === "completed") {
        setPurchaseStatus("completed");
        toast.success(t("accessGranted"));
        navigate("/dashboard");
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [purchaseStatus, purchaseId, navigate, t]);

  const handleKaspiPayment = () => {
    if (!product?.kaspi_link) return;
    window.open(product.kaspi_link, "_blank");
  };

  const handleSubmitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    // Зарегистрировать или залогинить пользователя
    const { user: newUser, error } = await register(fullName);

    if (error || !newUser) {
      toast.error(error?.message || "Ошибка регистрации");
      setIsProcessing(false);
      return;
    }

    // Установить роль студента
    await supabase
      .from("simple_users")
      .update({ role: "student" })
      .eq("id", newUser.id);

    // Создать покупку в статусе pending
    const { data: purchase, error: purchaseError } = await supabase
      .from("simple_purchases")
      .insert({
        simple_user_id: newUser.id,
        product_id: productId,
        amount: product?.price || 0,
        status: "pending"
      })
      .select()
      .single();

    if (purchaseError) {
      toast.error("Ошибка создания заказа");
      setIsProcessing(false);
      return;
    }

    setPurchaseId(purchase.id);
    setPurchaseStatus("pending");
    setIsProcessing(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const displayProduct = product || {
    title: "Цифровой продукт",
    headline: "Получите доступ к премиум-контенту",
    price: 49000,
    image_url: heroBackground,
    kaspi_link: null,
  };

  // Показать страницу ожидания
  if (purchaseStatus === "pending") {
    return (
      <div className="min-h-screen bg-gradient-hero flex flex-col">
        <div className="absolute top-4 right-4 z-20">
          <LanguageSwitcher />
        </div>

        <main className="flex-1 flex items-center justify-center px-4 py-8">
          <Card className="w-full max-w-md text-center animate-fade-in">
            <CardContent className="pt-8 pb-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-primary animate-pulse" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">
                {t("waitingForConfirmation")}
              </h2>
              <p className="text-muted-foreground mb-6">
                {t("waitingDescription")}
              </p>
              
              <div className="bg-muted/50 rounded-lg p-4 text-left">
                <p className="text-sm text-muted-foreground">
                  {t("sendReceiptInfo")}
                </p>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-6 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground touch-manipulation"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>{t("back")}</span>
          </button>
          <LanguageSwitcher />
        </div>

        {/* Order Summary */}
        <Card className="mb-6 animate-fade-in">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">{t("orderSummary")}</CardTitle>
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
          </CardContent>
        </Card>

        {/* Form */}
        <Card className="animate-fade-in" style={{ animationDelay: "100ms" }}>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Lock className="w-4 h-4 text-success" />
              {t("secureCheckout")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitPurchase} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">{t("fullName")}</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder={t("fullNamePlaceholder")}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="h-12"
                />
              </div>

              {/* Предупреждение о чеке */}
              <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
                <p className="text-sm text-warning-foreground">
                  {t("sendReceiptWarning")}
                </p>
              </div>

              {/* Kaspi Payment */}
              {displayProduct.kaspi_link ? (
                <div className="space-y-4">
                  <Button 
                    type="button"
                    onClick={handleKaspiPayment}
                    className="w-full h-14 bg-[#F14635] hover:bg-[#d63d2e] text-white font-semibold text-lg"
                    disabled={!fullName.trim()}
                  >
                    <span className="flex items-center gap-2">
                      {t("payWithKaspi")}
                      <ExternalLink className="w-5 h-5" />
                    </span>
                  </Button>

                  <Button 
                    type="submit" 
                    variant="outline" 
                    size="lg" 
                    className="w-full"
                    disabled={isProcessing || !fullName.trim()}
                  >
                    {isProcessing ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t("processing")}
                      </span>
                    ) : (
                      t("paidContinue")
                    )}
                  </Button>
                </div>
              ) : (
                <div className="border border-input rounded-lg p-4 bg-muted/50">
                  <p className="text-sm text-muted-foreground text-center">
                    {t("noPaymentMethod")}
                  </p>
                </div>
              )}

              <p className="text-xs text-center text-muted-foreground mt-4">
                {t("termsAgreement")}
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProductPurchasePage;
