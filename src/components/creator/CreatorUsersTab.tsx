import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Phone, Check, Clock, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
const formatPrice = (price: number) => {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "KZT",
    minimumFractionDigits: 0,
  }).format(price);
};

interface PurchaseWithUser {
  id: string;
  status: string;
  amount: number;
  created_at: string;
  product_id: string;
  simple_user: {
    id: string;
    name: string;
    phone: string;
  };
  product: {
    title: string;
  };
}

const CreatorUsersTab = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  
  // Получаем имя креатора из localStorage (НЕ из useSimpleAuth)
  const creatorName = localStorage.getItem("creator_name");

  // Получить все покупки продуктов этого создателя
  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ["creator-purchases", creatorName],
    queryFn: async () => {
      if (!creatorName) return [];

      // Сначала получить продукты создателя по имени (creator_id = имя креатора)
      const { data: products } = await supabase
        .from("products")
        .select("id, title")
        .eq("creator_id", creatorName);

      if (!products?.length) return [];

      const productIds = products.map(p => p.id);

      // Получить покупки для этих продуктов
      const { data: purchasesData } = await supabase
        .from("simple_purchases")
        .select(`
          id,
          status,
          amount,
          created_at,
          product_id,
          simple_user_id
        `)
        .in("product_id", productIds)
        .order("created_at", { ascending: false });

      if (!purchasesData?.length) return [];

      // Получить информацию о пользователях
      const userIds = [...new Set(purchasesData.map(p => p.simple_user_id))];
      const { data: usersData } = await supabase
        .from("simple_users")
        .select("id, name, phone")
        .in("id", userIds);

      // Собрать данные вместе
      return purchasesData.map(purchase => ({
        ...purchase,
        simple_user: usersData?.find(u => u.id === purchase.simple_user_id) || { id: "", name: "Unknown", phone: "" },
        product: products.find(p => p.id === purchase.product_id) || { title: "Unknown" }
      })) as PurchaseWithUser[];
    },
    enabled: !!creatorName,
  });

  // Мутация для подтверждения оплаты
  const confirmPayment = useMutation({
    mutationFn: async (purchaseId: string) => {
      const { error } = await supabase
        .from("simple_purchases")
        .update({ 
          status: "completed",
          confirmed_at: new Date().toISOString()
        })
        .eq("id", purchaseId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-purchases"] });
      toast.success(t("paymentConfirmed") || "Оплата подтверждена!");
    },
    onError: () => {
      toast.error("Ошибка при подтверждении");
    },
  });

  const pendingPurchases = purchases.filter(p => p.status === "pending");
  const completedPurchases = purchases.filter(p => p.status === "completed");

  const filteredPending = pendingPurchases.filter(
    (p) =>
      p.simple_user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.simple_user.phone.includes(searchQuery)
  );

  const filteredCompleted = completedPurchases.filter(
    (p) =>
      p.simple_user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.simple_user.phone.includes(searchQuery)
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder={t("searchUsers") || "Поиск пользователей..."}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-12"
        />
      </div>

      {/* Pending Payments Section */}
      {filteredPending.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-warning" />
            <h2 className="text-lg font-semibold text-foreground">
              {t("pendingPayments")} ({filteredPending.length})
            </h2>
          </div>

          {filteredPending.map((purchase, index) => (
            <Card 
              key={purchase.id} 
              className="border-warning/30 bg-warning/5 animate-fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-warning/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-lg font-bold text-warning">
                      {purchase.simple_user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground">{purchase.simple_user.name}</h3>
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="w-4 h-4" />
                        <span>{purchase.simple_user.phone}</span>
                      </div>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-border">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t("products")}</span>
                        <span className="font-medium text-foreground">{purchase.product.title}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm mt-1">
                        <span className="text-muted-foreground">{t("amount") || "Сумма"}</span>
                        <span className="font-medium text-foreground">{formatPrice(Number(purchase.amount))}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <Button 
                  className="w-full mt-4"
                  onClick={() => confirmPayment.mutate(purchase.id)}
                  disabled={confirmPayment.isPending}
                >
                  {confirmPayment.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  {t("confirmPayment")}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Confirmed Users Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{t("paidUsers")}</h2>
          <span className="text-sm text-muted-foreground">{filteredCompleted.length} {t("total") || "всего"}</span>
        </div>

        {filteredCompleted.length === 0 && filteredPending.length === 0 && (
          <div className="text-center py-12">
            <Search className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground">{t("noPaidUsers")}</p>
            <p className="text-sm text-muted-foreground mt-1">{t("usersWillAppear")}</p>
          </div>
        )}

        {filteredCompleted.map((purchase, index) => (
          <Card 
            key={purchase.id} 
            className="animate-fade-in"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg font-bold text-success">
                    {purchase.simple_user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">{purchase.simple_user.name}</h3>
                    <Check className="w-4 h-4 text-success" />
                  </div>
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="w-4 h-4" />
                      <span>{purchase.simple_user.phone}</span>
                    </div>
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t("products")}</span>
                      <span className="font-medium text-foreground">{purchase.product.title}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="text-muted-foreground">{t("purchased")}</span>
                      <span className="font-medium text-success">{formatPrice(Number(purchase.amount))}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default CreatorUsersTab;
