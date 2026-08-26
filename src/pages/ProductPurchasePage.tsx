import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCheckoutProduct } from "@/hooks/useProducts";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

import { invokeApi, studentCreds } from "@/lib/sessionApi";
import { ArrowLeft, Lock, Loader2, ExternalLink, Clock, Copy } from "lucide-react";
import { toast } from "sonner";
import MarketplaceHeader from "@/components/marketplace/MarketplaceHeader";
import { rememberAuthNext } from "@/lib/creatorAuth";
import { loginPath, loginState } from "@/lib/loginModal";
import { formatPriceTenge } from "@/lib/catalog";
import ReceiptUploadCard, { ReceiptSubmission } from "@/components/checkout/ReceiptUploadCard";
// Push notifications are now sent from the server via database triggers

const formatKaspiPhone = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("7")) {
    return `+7 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9)}`;
  }
  if (digits.length === 10) {
    return `+7 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8)}`;
  }
  return phone;
};

const ProductPurchasePage = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  const { user, sessionToken } = useSimpleAuth();
  const { data: product, isLoading } = useCheckoutProduct(productId);
  
  // Получить параметры учителя из URL
  const teacherParam = searchParams.get("teacher");
  const canChoose = teacherParam === "choice";
  
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [teacherLoading, setTeacherLoading] = useState(!!teacherParam && teacherParam !== "choice");
  
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [purchaseStatus, setPurchaseStatus] = useState<"form" | "pending" | "completed">("form");
  const [purchaseId, setPurchaseId] = useState<string | null>(null);
  const [receiptSubmission, setReceiptSubmission] = useState<ReceiptSubmission | null>(null);
  // Push notifications are now sent from the server via database triggers

  // Найти teacher_id по имени из URL
  useEffect(() => {
    const findTeacherId = async () => {
      if (!teacherParam || teacherParam === "choice" || !productId) {
        setTeacherLoading(false);
        return;
      }
      
      setTeacherLoading(true);
      
      const teacherName = decodeURIComponent(teacherParam);
      const data = await invokeApi<{ teacherId: string | null }>("checkout", {
        action: "lookup_teacher",
        productId,
        teacherName,
      });
      setTeacherId(data.teacherId);
      setTeacherLoading(false);
    };
    
    findTeacherId();
  }, [teacherParam, productId]);

  // Проверить статус покупки при загрузке
  useEffect(() => {
    const checkExistingPurchase = async () => {
      if (user && productId) {
        const token = sessionToken || localStorage.getItem("simple_session_token") || "";
        const result = await invokeApi<{
          purchase: { id: string; status: string; latest_submission?: ReceiptSubmission | null } | null
        }>("checkout", {
          action: "get_my_purchase",
          sessionToken: token,
          productId,
        });
        const data = result.purchase;

        if (data) {
          setPurchaseId(data.id);
          setReceiptSubmission(data.latest_submission ?? null);
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

  // Poll pending purchase until the creator confirms (realtime is closed after RLS lockdown)
  useEffect(() => {
    if (purchaseStatus !== "pending" || !purchaseId) return;
    const token = sessionToken || localStorage.getItem("simple_session_token") || "";
    const tick = async () => {
      try {
        const result = await invokeApi<{
          purchase: { id: string; status: string; latest_submission?: ReceiptSubmission | null } | null
        }>("checkout", {
          action: "get_my_purchase",
          sessionToken: token,
          productId,
        });
        if (result.purchase?.latest_submission) {
          setReceiptSubmission(result.purchase.latest_submission);
        }
        if (result.purchase?.status === "completed") {
          setPurchaseStatus("completed");
          toast.success(t("accessGranted"));
          navigate("/dashboard");
        }
      } catch {
        /* retry */
      }
    };
    tick();
    const id = window.setInterval(tick, 4000);
    return () => window.clearInterval(id);
  }, [purchaseStatus, purchaseId, navigate, t, sessionToken, productId]);

  const handleKaspiPayment = () => {
    if (!product?.kaspi_link) return;
    window.open(product.kaspi_link, "_blank");
  };

  const handleCopyKaspiPhone = async () => {
    const phone = product?.kaspi_phone;
    if (!phone) return;
    try {
      await navigator.clipboard.writeText(phone);
      toast.success(t("kaspiPhoneCopied"));
    } catch {
      toast.error(phone);
    }
  };

  const handleSubmitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Подождать загрузки teacherId если ещё грузится
    if (teacherLoading) {
      toast.error("Подождите, идёт загрузка...");
      return;
    }
    
    setIsProcessing(true);
    
    console.log("Creating purchase with teacherId:", teacherId, "canChoose:", canChoose);

    if (!user) {
      toast.error(t("loginRequiredCheckout"));
      const next = `/checkout/${product?.id || productId || ""}`;
      rememberAuthNext(next);
      navigate(loginPath(next), { state: loginState(location) });
      setIsProcessing(false);
      return;
    }

    const token = sessionToken || localStorage.getItem("creator_token") || "";
    try {
      const result = await invokeApi<{ purchase: { id: string; status: string } }>("checkout", {
        action: "create_purchase",
        sessionToken: token,
        productId: product?.id || productId,
        assignedTeacherId: teacherId,
        canChooseTeacher: canChoose,
      });
      const purchase = result.purchase;
      if (purchase.status === "completed") {
        setPurchaseStatus("completed");
        navigate("/dashboard");
        setIsProcessing(false);
        return;
      }
      setPurchaseId(purchase.id);
      setPurchaseStatus("pending");
    } catch {
      toast.error("Ошибка создания заказа");
    }
    setIsProcessing(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <MarketplaceHeader />
        <div className="flex justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <MarketplaceHeader />
        <p className="px-4 py-16 text-center text-muted-foreground">{t("productNotFound")}</p>
      </div>
    );
  }

  const hasKaspiLink = Boolean(product.kaspi_link);
  const hasKaspiPhone = Boolean(product.kaspi_phone);
  const hasPaymentMethod = hasKaspiLink || hasKaspiPhone;
  const checkoutPath = `/checkout/${product.id}`;
  const goToLogin = () => {
    rememberAuthNext(checkoutPath);
    navigate(loginPath(checkoutPath), { state: loginState(location) });
  };

  const handleBackToPayment = async () => {
    // Удалить pending покупку чтобы можно было вернуться к оплате
    if (purchaseId) {
      const token = sessionToken || localStorage.getItem("simple_session_token") || "";
      await invokeApi("checkout", { action: "cancel_pending", sessionToken: token, purchaseId });
    }
    setPurchaseId(null);
    setPurchaseStatus("form");
    setReceiptSubmission(null);
  };

  // Показать страницу ожидания
  if (purchaseStatus === "pending") {
    return (
      <div className="min-h-screen bg-gradient-hero flex flex-col">
        <div className="absolute top-4 left-4 z-20">
          <button
            onClick={handleBackToPayment}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground touch-manipulation"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>{t("back")}</span>
          </button>
        </div>



        <main className="flex-1 flex items-center justify-center px-4 py-8">
          <Card className="w-full max-w-md text-center animate-fade-in">
            <CardContent className="pt-8 pb-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-primary animate-pulse" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">
                {receiptSubmission?.verification_status === "manual_review"
                  ? t("receiptManualReviewTitle")
                  : receiptSubmission?.verification_status === "payment_qr_or_invoice"
                    ? t("receiptPayFirstTitle")
                    : t("uploadPaymentReceipt")}
              </h2>
              <p className="text-muted-foreground mb-6">
                {receiptSubmission?.verification_status === "manual_review"
                  ? t("receiptManualReviewBody")
                  : receiptSubmission?.verification_status === "payment_qr_or_invoice"
                    ? t("receiptPayFirstBody")
                    : t("uploadReceiptHint")}
              </p>

              {purchaseId && (
                <ReceiptUploadCard
                  purchaseId={purchaseId}
                  sessionToken={sessionToken || studentCreds().sessionToken}
                  expectedAmount={Number(product.price)}
                  submission={receiptSubmission}
                  onSubmitted={(result) => {
                    setReceiptSubmission(result.submission);
                    if (result.purchase_status === "completed" || result.verification_status === "confirmed") {
                      setPurchaseStatus("completed");
                      navigate("/dashboard");
                    }
                  }}
                />
              )}
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
        </div>

        {/* Order Summary */}
        <Card className="mb-6 animate-fade-in">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">{t("orderSummary")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-foreground">{product.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{product.headline}</p>
              </div>
              <span className="text-lg font-bold text-foreground">
                {formatPriceTenge(Number(product.price))}
              </span>
            </div>
          </CardContent>
        </Card>

        {!user ? (
          <Card className="animate-fade-in">
            <CardContent className="pt-6 pb-6 text-center space-y-4">
              <p className="text-sm text-muted-foreground">{t("loginRequiredCheckout")}</p>
              <Button type="button" variant="cta" className="w-full bg-[#FF6B00]" onClick={goToLogin}>
                {t("loginToContinuePurchase")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="animate-fade-in" style={{ animationDelay: "100ms" }}>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Lock className="w-4 h-4 text-success" />
                {t("secureCheckout")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitPurchase} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">{t("firstName")}</Label>
                    <Input
                      id="firstName"
                      type="text"
                      placeholder={t("firstNamePlaceholder")}
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      className="h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">{t("lastName")}</Label>
                    <Input
                      id="lastName"
                      type="text"
                      placeholder={t("lastNamePlaceholder")}
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      className="h-12"
                    />
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
                  <p className="text-sm text-amber-800 font-medium">
                    {t("sendReceiptWarning")}
                  </p>
                </div>

                {hasPaymentMethod ? (
                  <div className="space-y-4">
                    {hasKaspiLink ? (
                      <Button
                        type="button"
                        onClick={handleKaspiPayment}
                        className="w-full h-14 bg-[#F14635] hover:bg-[#d63d2e] text-white font-semibold text-lg"
                        disabled={!firstName.trim() || !lastName.trim()}
                      >
                        <span className="flex items-center gap-2">
                          {t("payWithKaspi")}
                          <ExternalLink className="w-5 h-5" />
                        </span>
                      </Button>
                    ) : (
                      <div className="rounded-lg border border-[#F14635]/30 bg-[#F14635]/5 p-4 space-y-3">
                        <p className="text-sm text-foreground">{t("kaspiPhoneInstruction")}</p>
                        <p className="text-xl font-bold text-center tracking-wide">
                          {formatKaspiPhone(String(product.kaspi_phone))}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          onClick={handleCopyKaspiPhone}
                          disabled={!firstName.trim() || !lastName.trim()}
                        >
                          <Copy className="w-4 h-4 mr-2" />
                          {t("copyKaspiPhone")}
                        </Button>
                      </div>
                    )}

                    <Button
                      type="submit"
                      variant="outline"
                      size="lg"
                      className="w-full"
                      disabled={isProcessing || !firstName.trim() || !lastName.trim()}
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
        )}
      </div>
    </div>
  );
};

export default ProductPurchasePage;
