import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Users, Calendar, Loader2, Bell, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import CreatorProductsTab from "@/components/creator/CreatorProductsTab";
import CreatorUsersTab from "@/components/creator/CreatorUsersTab";
import CreatorScheduleTab from "@/components/creator/CreatorScheduleTab";
import CreatorNotificationsTab from "@/components/creator/CreatorNotificationsTab";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useCreatorProducts } from "@/hooks/useProducts";
import { useCreatorSimpleBookings } from "@/hooks/useSimplePurchases";
import { useRealtimeBookingNotifications } from "@/hooks/useRealtimeBookings";
import { useRealtimePurchaseNotifications } from "@/hooks/useRealtimePurchases";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInHours } from "date-fns";

const CreatorDashboard = () => {
  const [activeTab, setActiveTab] = useState("products");
  const [creatorName, setCreatorName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useLanguage();
  const navigate = useNavigate();
  
  // Получаем продукты и бронирования для подсчёта уведомлений
  const { data: products } = useCreatorProducts();
  const productIds = useMemo(() => products?.map(p => p.id) || [], [products]);
  const { data: bookings } = useCreatorSimpleBookings(productIds);
  
  // Получаем pending-покупки для подсчёта
  const { data: pendingPurchases } = useQuery({
    queryKey: ["creator-pending-purchases-count", productIds],
    queryFn: async () => {
      if (!productIds.length) return [];
      const { data } = await supabase
        .from("simple_purchases")
        .select("id, created_at")
        .in("product_id", productIds)
        .eq("status", "pending");
      return data || [];
    },
    enabled: productIds.length > 0,
  });
  
  // Подсчёт новых записей и покупок за 24 часа
  const newNotificationsCount = useMemo(() => {
    const now = new Date();
    
    const newBookings = bookings?.filter(b => {
      const createdAt = new Date(b.created_at);
      return differenceInHours(now, createdAt) <= 24;
    }).length || 0;
    
    const newPurchases = pendingPurchases?.filter(p => {
      const createdAt = new Date(p.created_at);
      return differenceInHours(now, createdAt) <= 24;
    }).length || 0;
    
    return newBookings + newPurchases;
  }, [bookings, pendingPurchases]);

  // Enable real-time notifications for new bookings and purchases
  useRealtimeBookingNotifications(productIds, productIds.length > 0);
  useRealtimePurchaseNotifications(productIds, productIds.length > 0);

  useEffect(() => {
    const name = localStorage.getItem("creator_name");
    if (!name) {
      navigate("/");
    } else {
      setCreatorName(name);
      setIsLoading(false);
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("creator_name");
    navigate("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!creatorName) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border px-4 py-4 safe-area-inset">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground">{t("creatorDashboard")}</h1>
              {creatorName && (
                <p className="text-sm text-muted-foreground sm:hidden">{creatorName}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              {creatorName && (
                <span className="text-sm text-muted-foreground hidden sm:inline">{creatorName}</span>
              )}
              <Button variant="ghost" size="icon" onClick={handleLogout} title={t("signOut")}>
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-4 mb-6">
            <TabsTrigger value="products" className="gap-2">
              <Package className="w-4 h-4" />
              <span className="hidden sm:inline">{t("products")}</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">{t("users")}</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="gap-2">
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">{t("schedule")}</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2 relative">
              <Bell className="w-4 h-4" />
              <span className="hidden sm:inline">{t("notifications")}</span>
              {newNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs font-bold rounded-full flex items-center justify-center">
                  {newNotificationsCount > 9 ? "9+" : newNotificationsCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="mt-0 animate-fade-in">
            <CreatorProductsTab />
          </TabsContent>
          <TabsContent value="users" className="mt-0 animate-fade-in">
            <CreatorUsersTab />
          </TabsContent>
          <TabsContent value="schedule" className="mt-0 animate-fade-in">
            <CreatorScheduleTab />
          </TabsContent>
          <TabsContent value="notifications" className="mt-0 animate-fade-in">
            <CreatorNotificationsTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default CreatorDashboard;
