import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Users, Calendar, Loader2, Bell, User, Megaphone } from "lucide-react";
import CreatorProductsTab from "@/components/creator/CreatorProductsTab";
import CreatorUsersTab from "@/components/creator/CreatorUsersTab";
import CreatorScheduleTab from "@/components/creator/CreatorScheduleTab";
import CreatorNotificationsTab from "@/components/creator/CreatorNotificationsTab";
import CreatorAccountTab from "@/components/creator/CreatorAccountTab";
import CreatorAnnouncementsTab from "@/components/creator/CreatorAnnouncementsTab";
import { useLanguage } from "@/contexts/LanguageContext";

import { useCreatorProducts } from "@/hooks/useProducts";
import { useCreatorSimpleBookings } from "@/hooks/useSimplePurchases";
import { useRealtimeBookingNotifications } from "@/hooks/useRealtimeBookings";
import { useRealtimePurchaseNotifications } from "@/hooks/useRealtimePurchases";
import { useFCMRegistration } from "@/hooks/useFCMRegistration";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { setAppBadge, clearAppBadge } from "@/lib/appBadge";
import { useAppResume } from "@/hooks/useAppResume";

const CreatorDashboard = () => {
  const [activeTab, setActiveTab] = useState("announcements");
  const [creatorName, setCreatorName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastViewedAt, setLastViewedAt] = useState<Date | null>(null);
  const { t } = useLanguage();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  useAppResume();
  
  // Per-user localStorage key for last viewed notifications
  const lastViewedKey = creatorName ? `creator_notifications_last_viewed_${creatorName}` : null;

  // Load last viewed timestamp from localStorage
  useEffect(() => {
    if (!lastViewedKey) return;
    const stored = localStorage.getItem(lastViewedKey);
    if (stored) {
      setLastViewedAt(new Date(stored));
    }
  }, [lastViewedKey]);

  // Update last viewed when entering OR leaving notifications tab
  const handleTabChange = useCallback((value: string) => {
    if (lastViewedKey && (value === "notifications" || (activeTab === "notifications" && value !== "notifications"))) {
      const now = new Date();
      localStorage.setItem(lastViewedKey, now.toISOString());
      setLastViewedAt(now);
      clearAppBadge();
    }
    setActiveTab(value);
  }, [activeTab]);
  
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

  // Получаем отменённые записи для подсчёта
  const { data: cancellations } = useQuery({
    queryKey: ["creator-cancellations-count", productIds],
    queryFn: async () => {
      if (!productIds.length) return [];
      const { data } = await supabase
        .from("booking_cancellations")
        .select("id, cancelled_at")
        .in("product_id", productIds)
        .eq("cancelled_by", "student");
      return data || [];
    },
    enabled: productIds.length > 0,
  });

  // Получаем запросы на перенос для подсчёта бейджа
  const { data: rescheduleRequests } = useQuery({
    queryKey: ["creator-reschedule-requests-count", productIds],
    queryFn: async () => {
      if (!productIds.length) return [];
      const { data } = await supabase
        .from("reschedule_requests")
        .select("id, created_at")
        .in("product_id", productIds)
        .eq("status", "pending")
        .eq("requested_by", "student");
      return data || [];
    },
    enabled: productIds.length > 0,
  });
  
  // Подсчёт новых записей, покупок и отменённых записей после последнего просмотра
  const newNotificationsCount = useMemo(() => {
    // If never viewed, count all pending purchases and bookings from last 24 hours
    const compareDate = lastViewedAt || new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const newBookingsCount = bookings?.filter(b => {
      const createdAt = new Date(b.created_at);
      return createdAt > compareDate;
    }).length || 0;
    
    const newPurchasesCount = pendingPurchases?.filter(p => {
      const createdAt = new Date(p.created_at);
      return createdAt > compareDate;
    }).length || 0;

    const newCancellationsCount = cancellations?.filter(c => {
      const cancelledAt = new Date((c as any).cancelled_at);
      return cancelledAt > compareDate;
    }).length || 0;

    const newRescheduleCount = rescheduleRequests?.filter(r => {
      const createdAt = new Date(r.created_at);
      return createdAt > compareDate;
    }).length || 0;
    
    return newBookingsCount + newPurchasesCount + newCancellationsCount + newRescheduleCount;
  }, [bookings, pendingPurchases, cancellations, rescheduleRequests, lastViewedAt]);

  // Set initial app badge based on notification count
  useEffect(() => {
    if (activeTab !== "notifications") {
      // Set badge to current unread count
      setAppBadge(newNotificationsCount);
    }
  }, [newNotificationsCount, activeTab]);

  // Enable real-time notifications for new bookings and purchases (with badge count)
  useRealtimeBookingNotifications(productIds, productIds.length > 0, newNotificationsCount);
  useRealtimePurchaseNotifications(productIds, productIds.length > 0);

  // Register FCM token for push notifications
  useFCMRegistration({
    userId: creatorName || undefined,
    userRole: "creator",
    enabled: !!creatorName
  });

  useEffect(() => {
    const validateSession = async () => {
      const name = localStorage.getItem("creator_name");
      const token = localStorage.getItem("creator_token");
      
      if (!name || !token) {
        navigate("/");
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('validate-creator-session', {
          body: { token, creatorName: name }
        });

        if (error) {
          // Network/transport error — keep session, continue with cached name
          console.warn('Session validation network error, using cached session:', error);
          setCreatorName(name);
          setIsLoading(false);
          return;
        }

        if (!data?.valid) {
          console.log('Invalid creator session, redirecting to login');
          localStorage.removeItem("creator_token");
          localStorage.removeItem("creator_name");
          navigate("/");
          return;
        }

        setCreatorName(name);
        setIsLoading(false);
      } catch (err) {
        console.error('Session validation error:', err);
        // Network error — don't remove session, use cached name
        setCreatorName(name);
        setIsLoading(false);
      }
    };

    validateSession();
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!creatorName) return null;

  return (
    <div className={`min-h-screen bg-background ${isMobile ? "pb-20" : ""}`}>
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border px-4 py-4 safe-area-inset">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">{t("creatorDashboard")}</h1>
            <p className="text-sm text-muted-foreground">{creatorName}</p>
          </div>
          
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          {/* Desktop Top Tabs */}
          {!isMobile && (
            <TabsList className="w-full h-12 grid grid-cols-6 mb-6">
              <TabsTrigger value="announcements" className="gap-2">
                <Megaphone className="w-4 h-4" />
                {t("announcements")}
              </TabsTrigger>
              <TabsTrigger value="products" className="gap-2">
                <Package className="w-4 h-4" />
                {t("products")}
              </TabsTrigger>
              <TabsTrigger value="users" className="gap-2">
                <Users className="w-4 h-4" />
                {t("users")}
              </TabsTrigger>
              <TabsTrigger value="schedule" className="gap-2">
                <Calendar className="w-4 h-4" />
                {t("schedule")}
              </TabsTrigger>
              <TabsTrigger value="notifications" className="gap-2 relative">
                <Bell className="w-4 h-4" />
                {t("notifications")}
                {newNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs font-bold rounded-full flex items-center justify-center">
                    {newNotificationsCount > 9 ? "9+" : newNotificationsCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="account" className="gap-2">
                <User className="w-4 h-4" />
                {t("account")}
              </TabsTrigger>
            </TabsList>
          )}

          <TabsContent value="announcements" className="mt-0 animate-fade-in">
            <CreatorAnnouncementsTab creatorName={creatorName} />
          </TabsContent>
          <TabsContent value="products" className="mt-0 animate-fade-in">
            <CreatorProductsTab creatorName={creatorName} />
          </TabsContent>
          <TabsContent value="users" className="mt-0 animate-fade-in">
            <CreatorUsersTab creatorName={creatorName} />
          </TabsContent>
          <TabsContent value="schedule" className="mt-0 animate-fade-in">
            <CreatorScheduleTab creatorName={creatorName} />
          </TabsContent>
          <TabsContent value="notifications" className="mt-0 animate-fade-in">
            <CreatorNotificationsTab creatorName={creatorName} lastViewedAt={lastViewedAt} />
          </TabsContent>
          <TabsContent value="account" className="mt-0 animate-fade-in">
            <CreatorAccountTab creatorName={creatorName} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Bottom Navigation - Mobile Only */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-lg border-t border-border safe-area-inset">
          <div className="max-w-2xl mx-auto">
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsList className="w-full h-16 bg-transparent rounded-none grid grid-cols-6 gap-0">
                <TabsTrigger 
                  value="announcements" 
                  className="flex-col h-full gap-1 data-[state=active]:bg-transparent data-[state=active]:text-primary rounded-none px-1"
                >
                  <Megaphone className="w-5 h-5" />
                  <span className="text-[10px] leading-tight">{t("announcements")}</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="products" 
                  className="flex-col h-full gap-1 data-[state=active]:bg-transparent data-[state=active]:text-primary rounded-none px-1"
                >
                  <Package className="w-5 h-5" />
                  <span className="text-[10px] leading-tight">{t("products")}</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="users" 
                  className="flex-col h-full gap-1 data-[state=active]:bg-transparent data-[state=active]:text-primary rounded-none px-1"
                >
                  <Users className="w-5 h-5" />
                  <span className="text-[10px] leading-tight">{t("users")}</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="schedule" 
                  className="flex-col h-full gap-1 data-[state=active]:bg-transparent data-[state=active]:text-primary rounded-none px-1"
                >
                  <Calendar className="w-5 h-5" />
                  <span className="text-[10px] leading-tight">{t("schedule")}</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="notifications" 
                  className="flex-col h-full gap-1 data-[state=active]:bg-transparent data-[state=active]:text-primary rounded-none relative px-1"
                >
                  <Bell className="w-5 h-5" />
                  <span className="text-[10px] leading-tight">{t("notifications")}</span>
                  {newNotificationsCount > 0 && (
                    <span className="absolute top-1 right-1/4 translate-x-1/2 w-5 h-5 bg-primary text-primary-foreground text-xs font-bold rounded-full flex items-center justify-center">
                      {newNotificationsCount > 9 ? "9+" : newNotificationsCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="account" 
                  className="flex-col h-full gap-1 data-[state=active]:bg-transparent data-[state=active]:text-primary rounded-none px-1"
                >
                  <User className="w-5 h-5" />
                  <span className="text-[10px] leading-tight">{t("account")}</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </nav>
      )}
    </div>
  );
};

export default CreatorDashboard;
