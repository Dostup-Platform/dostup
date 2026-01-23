import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useProduct } from "@/hooks/useProducts";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Lock, Loader2, ExternalLink, Clock, Download } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import heroBackground from "@/assets/hero-background.jpg";
import { sendPushNotification } from "@/lib/firebase";

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
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  const { user, register } = useSimpleAuth();
  const { data: product, isLoading } = useProduct(productId);
  
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
  const [notificationSent, setNotificationSent] = useState(false);

  // Найти teacher_id по имени из URL
  useEffect(() => {
    const findTeacherId = async () => {
      if (!teacherParam || teacherParam === "choice" || !productId) {
        setTeacherLoading(false);
        return;
      }
      
      setTeacherLoading(true);
      
      // teacherParam - это имя учителя (закодированное в URL)
      const teacherName = decodeURIComponent(teacherParam);
      console.log("Looking for teacher:", teacherName);
      
      // Сначала проверяем, что такой учитель есть в product_teachers
      const { data: teacherRecord } = await supabase
        .from("product_teachers")
        .select("id, teacher_name")
        .eq("product_id", productId)
        .eq("teacher_name", teacherName)
        .maybeSingle();
      
      if (!teacherRecord) {
        console.log("Teacher not found in product_teachers");
        setTeacherLoading(false);
        return;
      }
      
      // Найти учителя в simple_users по имени
      const { data: teacherUser } = await supabase
        .from("simple_users")
        .select("id")
        .eq("name", teacherName)
        .eq("role", "teacher")
        .maybeSingle();
      
      if (teacherUser) {
        console.log("Found teacher in simple_users:", teacherUser.id);
        setTeacherId(teacherUser.id);
        setTeacherLoading(false);
      } else {
        // Создать учителя в simple_users если его ещё нет
        console.log("Creating new teacher in simple_users");
        const { data: newTeacher, error } = await supabase
          .from("simple_users")
          .insert({
            name: teacherName,
            phone: `teacher_${Date.now()}`,
            role: "teacher",
          })
          .select("id")
          .single();
        
        if (!error && newTeacher) {
          console.log("Created teacher:", newTeacher.id);
          setTeacherId(newTeacher.id);
        }
        setTeacherLoading(false);
      }
    };
    
    findTeacherId();
  }, [teacherParam, productId]);

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

  // Realtime подписка для отслеживания подтверждения покупки
  useEffect(() => {
    if (purchaseStatus !== "pending" || !purchaseId) return;

    const channel = supabase
      .channel(`purchase-${purchaseId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "simple_purchases",
          filter: `id=eq.${purchaseId}`
        },
        (payload: any) => {
          if (payload.new?.status === "completed") {
            setPurchaseStatus("completed");
            toast.success(t("accessGranted"));
            navigate("/dashboard");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [purchaseStatus, purchaseId, navigate, t]);

  const handleKaspiPayment = () => {
    if (!product?.kaspi_link) return;
    window.open(product.kaspi_link, "_blank");
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

    // Зарегистрировать пользователя с полным именем
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
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

    // Проверить, есть ли уже pending покупка для этого пользователя и продукта
    const { data: existingPurchase } = await supabase
      .from("simple_purchases")
      .select("id, status")
      .eq("simple_user_id", newUser.id)
      .eq("product_id", productId)
      .maybeSingle();

    if (existingPurchase) {
      // Если покупка уже существует, просто показать страницу ожидания
      setPurchaseId(existingPurchase.id);
      if (existingPurchase.status === "completed") {
        setPurchaseStatus("completed");
        navigate("/dashboard");
      } else {
        setPurchaseStatus("pending");
      }
      setIsProcessing(false);
      return;
    }

    // Создать покупку в статусе pending только если её ещё нет
    const insertData: {
      simple_user_id: string;
      product_id: string | undefined;
      amount: number;
      status: string;
      assigned_teacher_id?: string;
      can_choose_teacher?: boolean;
    } = {
      simple_user_id: newUser.id,
      product_id: productId,
      amount: product?.price || 0,
      status: "pending"
    };
    
    // Добавить информацию об учителе если есть
    if (teacherId) {
      insertData.assigned_teacher_id = teacherId;
      console.log("Adding assigned_teacher_id to purchase:", teacherId);
    }
    if (canChoose) {
      insertData.can_choose_teacher = true;
      console.log("Setting can_choose_teacher = true");
    }
    
    console.log("Final insertData:", insertData);
    
    const { data: purchase, error: purchaseError } = await supabase
      .from("simple_purchases")
      .insert(insertData)
      .select()
      .single();

    if (purchaseError) {
      toast.error("Ошибка создания заказа");
      setIsProcessing(false);
      return;
    }

    // Send push notification to creator immediately (only once)
    if (!notificationSent) {
      setNotificationSent(true);
      
      const userName = `${firstName} ${lastName}`.trim() || "Клиент";
      const creatorId = product?.creator_id;
      const productTitle = product?.title || "";
      const productPrice = product?.price || 0;
      
      console.log("[Purchase] Sending ONE push notification to creator:", creatorId);
      
      if (creatorId) {
        const title = `Новая покупка от ${userName}`;
        const body = productTitle;
        
        // Send FCM push to creator (async, don't wait)
        sendPushNotification(
          creatorId, 
          title, 
          body, 
          {
            type: "payment",
            purchaseId: purchase.id,
            amount: String(productPrice)
          },
          "creator"
        ).then((success) => {
          console.log("[Purchase] Push notification result:", success);
        }).catch((err) => {
          console.error("[Purchase] Failed to send push notification:", err);
        });
      }
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

  const handleBackToPayment = async () => {
    // Удалить pending покупку чтобы можно было вернуться к оплате
    if (purchaseId) {
      await supabase
        .from("simple_purchases")
        .delete()
        .eq("id", purchaseId);
    }
    setPurchaseId(null);
    setPurchaseStatus("form");
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

              <Link 
                to="/install" 
                className="text-sm text-primary hover:underline flex items-center justify-center gap-1 mt-4"
              >
                <Download className="w-4 h-4" />
                {t("installApp")}
              </Link>
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

              {/* Предупреждение о чеке */}
              <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
                <p className="text-sm text-amber-800 font-medium">
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
                    disabled={!firstName.trim() || !lastName.trim()}
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
      </div>
    </div>
  );
};

export default ProductPurchasePage;
