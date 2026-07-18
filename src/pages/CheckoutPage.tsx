import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, ExternalLink, CheckCircle2, Clock, XCircle, Copy } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useProduct } from "@/hooks/useProducts";
import { useCreatePurchase, useMyPurchases } from "@/hooks/usePurchases";

const formatKZT = (n: number) =>
  new Intl.NumberFormat("ru-RU", { style: "currency", currency: "KZT", minimumFractionDigits: 0 }).format(n);

const CheckoutPage = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data: product, isLoading } = useProduct(productId);
  const { data: myPurchases = [] } = useMyPurchases(user?.id);
  const createPurchase = useCreatePurchase();
  const [txId, setTxId] = useState("");

  useEffect(() => {
    if (!authLoading && !user) navigate(`/auth?mode=signup&product=${productId ?? ""}`);
  }, [authLoading, user, productId, navigate]);

  const existing = myPurchases.find((p) => p.product_id === productId && (p.status === "pending" || p.status === "completed"));

  if (isLoading || authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }
  if (!product) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Продукт не найден</div>;
  }

  const isPaused = Boolean((product as any).is_paused);
  const kaspiLink = (product as any).kaspi_link as string | null;
  const kaspiPhone = (product as any).kaspi_phone as string | null;

  const copy = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text); toast.success(`${label} скопирован`); }
    catch { toast.error("Не удалось скопировать"); }
  };

  const submit = async () => {
    if (!user || !productId) return;
    if (!txId.trim()) { toast.error("Укажите номер операции Kaspi"); return; }
    try {
      await createPurchase.mutateAsync({
        productId,
        userId: user.id,
        amount: Number(product.price),
        paymentIntentId: txId.trim(),
      });
      toast.success("Заявка отправлена. Ожидайте подтверждения автора.");
      navigate("/dashboard");
    } catch (e) {
      toast.error((e as Error).message || "Не удалось создать заявку");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/product/${productId}`)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold">Оплата</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            {product.image_url ? (
              <img src={product.image_url} alt="" className="w-16 h-16 rounded object-cover" />
            ) : <div className="w-16 h-16 rounded bg-muted" />}
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{product.title}</div>
              <div className="text-2xl font-bold mt-1">{formatKZT(Number(product.price))}</div>
            </div>
          </CardContent>
        </Card>

        {existing?.status === "completed" ? (
          <Card>
            <CardContent className="pt-6 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-primary mx-auto" />
              <div className="font-medium">Оплата подтверждена</div>
              <Button asChild className="w-full"><Link to={`/materials/${productId}`}>Открыть материалы</Link></Button>
            </CardContent>
          </Card>
        ) : existing?.status === "pending" ? (
          <Card>
            <CardContent className="pt-6 text-center space-y-3">
              <Clock className="w-12 h-12 text-muted-foreground mx-auto" />
              <div className="font-medium">Заявка отправлена</div>
              <p className="text-sm text-muted-foreground">Автор подтвердит оплату вручную. Вы получите уведомление.</p>
              <Button asChild variant="outline" className="w-full"><Link to="/dashboard">В кабинет</Link></Button>
            </CardContent>
          </Card>
        ) : isPaused ? (
          <Card>
            <CardContent className="pt-6 text-center space-y-2">
              <XCircle className="w-10 h-10 text-muted-foreground mx-auto" />
              <div className="text-sm text-foreground whitespace-pre-wrap">
                {(product as any).paused_message || "Автор временно отключил продажу."}
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader><CardTitle className="text-base">1. Оплатите через Kaspi</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {kaspiLink && (
                  <Button asChild variant="cta" size="lg" className="w-full">
                    <a href={kaspiLink} target="_blank" rel="noopener noreferrer">
                      Оплатить через Kaspi <ExternalLink className="w-4 h-4 ml-2" />
                    </a>
                  </Button>
                )}
                {kaspiPhone && (
                  <div className="flex items-center gap-2 p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground">Номер Kaspi</div>
                      <div className="font-medium">{kaspiPhone}</div>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => copy(kaspiPhone, "Номер")}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                {!kaspiLink && !kaspiPhone && (
                  <p className="text-sm text-muted-foreground">
                    Свяжитесь с автором для получения реквизитов оплаты.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">2. Подтвердите оплату</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Укажите номер операции из чека Kaspi. Автор проверит платёж и откроет доступ.
                </p>
                <Input
                  placeholder="Номер операции Kaspi"
                  value={txId}
                  onChange={(e) => setTxId(e.target.value)}
                />
                <Button
                  variant="cta" size="lg" className="w-full"
                  onClick={submit}
                  disabled={createPurchase.isPending}
                >
                  {createPurchase.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Отправить на подтверждение"}
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
};

export default CheckoutPage;