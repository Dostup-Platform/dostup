import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Package, Users, Calendar, Loader2, Bell, User, Megaphone, Library } from "lucide-react";
import CreatorProductsTab from "@/components/creator/CreatorProductsTab";
import CreatorUsersTab from "@/components/creator/CreatorUsersTab";
import CreatorScheduleTab from "@/components/creator/CreatorScheduleTab";
import CreatorNotificationsTab from "@/components/creator/CreatorNotificationsTab";
import CreatorAccountTab from "@/components/creator/CreatorAccountTab";
import CreatorAnnouncementsTab from "@/components/creator/CreatorAnnouncementsTab";
import CreatorMaterialsTab from "@/components/creator/CreatorMaterialsTab";
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

const navItems = [
  { key: "products", labelKey: "products", icon: Package },
  { key: "announcements", labelKey: "announcements", icon: Megaphone },
  { key: "materials", labelKey: "materials", icon: Library },
  { key: "schedule", labelKey: "schedule", icon: Calendar },
  { key: "users", labelKey: "users", icon: Users },
  { key: "notifications", labelKey: "notifications", icon: Bell, badge: true },
  { key: "account", labelKey: "account", icon: User },
];

const CreatorDashboard = () => {
  const [activeTab, setActiveTab] = useState("products");
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

      {/* Desktop: sidebar + content */}
      {/* Mobile: content only */}
      <div className={`${isMobile ? "" : "flex gap-6 items-start max-w-7xl mx-auto px-4 py-6"}`}>
        
        {/* Left Sidebar - Desktop Only */}
        {!isMobile && (
          <aside className="w-56 flex-shrink-0 sticky top-[88px] self-start">
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => handleTabChange(item.key)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                      isActive
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent/50"
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1">{t(item.labelKey as any)}</span>
                    {item.badge && newNotificationsCount > 0 && (
                      <span className="ml-auto w-5 h-5 bg-primary text-primary-foreground text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0">
                        {newNotificationsCount > 9 ? "9+" : newNotificationsCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>
        )}

        {/* Main Content */}
        <main className={isMobile ? "max-w-4xl mx-auto px-4 py-6" : "flex-1 min-w-0"}>
          {activeTab === "products" && (
            <div className="animate-fade-in">
              <CreatorProductsTab creatorName={creatorName} />
            </div>
          )}
          {activeTab === "announcements" && (
            <div className="animate-fade-in">
              <CreatorAnnouncementsTab creatorName={creatorName} />
            </div>
          )}
          {activeTab === "materials" && (
            <div className="animate-fade-in">
              <CreatorMaterialsTab creatorName={creatorName} />
            </div>
          )}
          {activeTab === "schedule" && (
            <div className="animate-fade-in">
              <CreatorScheduleTab creatorName={creatorName} />
            </div>
          )}
          {activeTab === "users" && (
            <div className="animate-fade-in">
              <CreatorUsersTab creatorName={creatorName} />
            </div>
          )}
          {activeTab === "notifications" && (
            <div className="animate-fade-in">
              <CreatorNotificationsTab creatorName={creatorName} lastViewedAt={lastViewedAt} />
            </div>
          )}
          {activeTab === "account" && (
            <div className="animate-fade-in">
              <CreatorAccountTab creatorName={creatorName} />
            </div>
          )}
        </main>
      </div>

      {/* Bottom Navigation - Mobile Only */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-lg border-t border-border safe-area-inset">
          <div className="max-w-2xl mx-auto">
            <div className="w-full h-16 bg-transparent rounded-none grid grid-cols-7 gap-0">
              <button 
                onClick={() => handleTabChange("products")}
                className={`flex flex-col items-center justify-center h-full gap-1 rounded-none px-1 ${activeTab === "products" ? "text-primary" : "text-muted-foreground"}`}
              >
                <Package className="w-5 h-5" />
                <span className="text-[10px] leading-tight">{t("products")}</span>
              </button>
              <button 
                onClick={() => handleTabChange("announcements")}
                className={`flex flex-col items-center justify-center h-full gap-1 rounded-none px-1 ${activeTab === "announcements" ? "text-primary" : "text-muted-foreground"}`}
              >
                <Megaphone className="w-5 h-5" />
                <span className="text-[10px] leading-tight">{t("announcements")}</span>
              </button>
              <button 
                onClick={() => handleTabChange("materials")}
                className={`flex flex-col items-center justify-center h-full gap-1 rounded-none px-1 ${activeTab === "materials" ? "text-primary" : "text-muted-foreground"}`}
              >
                <Library className="w-5 h-5" />
                <span className="text-[10px] leading-tight">{t("materials")}</span>
              </button>
              <button 
                onClick={() => handleTabChange("schedule")}
                className={`flex flex-col items-center justify-center h-full gap-1 rounded-none px-1 ${activeTab === "schedule" ? "text-primary" : "text-muted-foreground"}`}
              >
                <Calendar className="w-5 h-5" />
                <span className="text-[10px] leading-tight">{t("schedule")}</span>
              </button>
              <button 
                onClick={() => handleTabChange("users")}
                className={`flex flex-col items-center justify-center h-full gap-1 rounded-none px-1 ${activeTab === "users" ? "text-primary" : "text-muted-foreground"}`}
              >
                <Users className="w-5 h-5" />
                <span className="text-[10px] leading-tight">{t("users")}</span>
              </button>
              <button 
                onClick={() => handleTabChange("notifications")}
                className={`flex flex-col items-center justify-center h-full gap-1 rounded-none relative px-1 ${activeTab === "notifications" ? "text-primary" : "text-muted-foreground"}`}
              >
                <Bell className="w-5 h-5" />
                <span className="text-[10px] leading-tight">{t("notifications")}</span>
                {newNotificationsCount > 0 && (
                  <span className="absolute top-1 right-1/4 translate-x-1/2 w-5 h-5 bg-primary text-primary-foreground text-xs font-bold rounded-full flex items-center justify-center">
                    {newNotificationsCount > 9 ? "9+" : newNotificationsCount}
                  </span>
                )}
              </button>
              <button 
                onClick={() => handleTabChange("account")}
                className={`flex flex-col items-center justify-center h-full gap-1 rounded-none px-1 ${activeTab === "account" ? "text-primary" : "text-muted-foreground"}`}
              >
                <User className="w-5 h-5" />
                <span className="text-[10px] leading-tight">{t("account")}</span>
              </button>
            </div>
          </div>
        </nav>
      )}
    </div>
  );
};

export default CreatorDashboard;
