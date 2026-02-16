import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Calendar, User, Bell, Loader2 } from "lucide-react";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";

import MaterialsTab from "@/components/dashboard/MaterialsTab";
import ScheduleTab from "@/components/dashboard/ScheduleTab";
import AccountTab from "@/components/dashboard/AccountTab";
import NotificationsTab from "@/components/dashboard/NotificationsTab";
import { useRealtimeStudentNotifications } from "@/hooks/useRealtimeStudentNotifications";
import { useFCMRegistration } from "@/hooks/useFCMRegistration";
import { setAppBadge, clearAppBadge } from "@/lib/appBadge";
import { useAppResume } from "@/hooks/useAppResume";

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState("materials");
  const [lastViewedAt, setLastViewedAt] = useState<Date | null>(null);
  const previousTab = useRef(activeTab);
  const { user, loading } = useSimpleAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  useAppResume();

  // Загрузить lastViewedAt из localStorage
  useEffect(() => {
    const saved = localStorage.getItem("student_notifications_last_viewed");
    if (saved) {
      setLastViewedAt(new Date(saved));
    }
  }, []);

  // Get purchased product IDs for filtering material unlocks
  const { data: purchasedProductIds = [] } = useQuery({
    queryKey: ["student-purchased-product-ids", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("simple_purchases")
        .select("product_id")
        .eq("simple_user_id", user.id)
        .in("status", ["confirmed", "completed"]);
      if (error) throw error;
      return [...new Set((data || []).map(p => p.product_id))];
    },
    enabled: !!user?.id,
  });

  // Получить отменённые записи для подсчёта бейджа
  const { data: cancellations = [] } = useQuery({
    queryKey: ["student-cancellations-count", user?.phone],
    queryFn: async () => {
      if (!user?.phone) return [];
      const { data, error } = await supabase
        .from("booking_cancellations")
        .select("id, cancelled_at")
        .eq("user_phone", user.phone)
        .in("cancelled_by", ["creator", "teacher"])
        .order("cancelled_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.phone,
  });

  const { data: confirmedPurchases = [] } = useQuery({
    queryKey: ["student-confirmed-purchases-count", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("simple_purchases")
        .select("id, confirmed_at")
        .eq("simple_user_id", user.id)
        .in("status", ["confirmed", "completed"])
        .not("confirmed_at", "is", null)
        .order("confirmed_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Material unlocks count
  const { data: materialUnlocks = [] } = useQuery({
    queryKey: ["student-material-unlocks-count", purchasedProductIds],
    queryFn: async () => {
      if (purchasedProductIds.length === 0) return [];
      const { data, error } = await supabase
        .from("material_unlocks")
        .select("id, unlocked_at")
        .in("product_id", purchasedProductIds)
        .order("unlocked_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: purchasedProductIds.length > 0,
  });

  // Подсчёт новых уведомлений
  const newNotificationsCount = useMemo(() => {
    const compareDate = lastViewedAt || new Date(Date.now() - 24 * 60 * 60 * 1000);
    const newCancellations = cancellations.filter(c => new Date(c.cancelled_at) > compareDate).length;
    const newPurchases = confirmedPurchases.filter(p => p.confirmed_at && new Date(p.confirmed_at) > compareDate).length;
    const newUnlocks = materialUnlocks.filter(u => new Date(u.unlocked_at) > compareDate).length;
    return newCancellations + newPurchases + newUnlocks;
  }, [cancellations, confirmedPurchases, materialUnlocks, lastViewedAt]);

  // Realtime уведомления (звуки и push) с badge count
  useRealtimeStudentNotifications(user?.id, user?.phone, !!user, newNotificationsCount, purchasedProductIds);

  // Register FCM token for push notifications
  useFCMRegistration({
    userId: user?.id,
    userPhone: user?.phone,
    userRole: "student",
    enabled: !!user?.id
  });

  // Set initial app badge based on notification count
  useEffect(() => {
    if (activeTab !== "notifications") {
      setAppBadge(newNotificationsCount);
    }
  }, [newNotificationsCount, activeTab]);

  // Обновление lastViewedAt при уходе с вкладки уведомлений
  const handleTabChange = (value: string) => {
    if (previousTab.current === "notifications" && value !== "notifications") {
      const now = new Date();
      localStorage.setItem("student_notifications_last_viewed", now.toISOString());
      setLastViewedAt(now);
      clearAppBadge();
    }
    previousTab.current = value;
    setActiveTab(value);
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border px-4 py-4 safe-area-inset">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">{t("myDashboard")}</h1>
          
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsContent value="materials" className="mt-0 animate-fade-in">
            <MaterialsTab />
          </TabsContent>
          <TabsContent value="schedule" className="mt-0 animate-fade-in">
            <ScheduleTab />
          </TabsContent>
          <TabsContent value="notifications" className="mt-0 animate-fade-in">
            <NotificationsTab lastViewedAt={lastViewedAt} purchasedProductIds={purchasedProductIds} />
          </TabsContent>
          <TabsContent value="account" className="mt-0 animate-fade-in">
            <AccountTab />
          </TabsContent>
        </Tabs>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-lg border-t border-border safe-area-inset">
        <div className="max-w-2xl mx-auto">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="w-full h-16 bg-transparent rounded-none grid grid-cols-4 gap-1">
              <TabsTrigger 
                value="materials" 
                className="flex-col h-full gap-1 data-[state=active]:bg-transparent data-[state=active]:text-primary rounded-none"
              >
                <FileText className="w-5 h-5" />
                <span className="text-xs">{t("materials")}</span>
              </TabsTrigger>
              <TabsTrigger 
                value="schedule" 
                className="flex-col h-full gap-1 data-[state=active]:bg-transparent data-[state=active]:text-primary rounded-none"
              >
                <Calendar className="w-5 h-5" />
                <span className="text-xs">{t("schedule")}</span>
              </TabsTrigger>
              <TabsTrigger 
                value="notifications" 
                className="flex-col h-full gap-1 data-[state=active]:bg-transparent data-[state=active]:text-primary rounded-none relative"
              >
                <Bell className="w-5 h-5" />
                <span className="text-xs">{t("notifications")}</span>
                {newNotificationsCount > 0 && (
                  <span className="absolute top-1 right-1/4 translate-x-1/2 w-5 h-5 bg-primary text-primary-foreground text-xs font-bold rounded-full flex items-center justify-center">
                    {newNotificationsCount > 9 ? "9+" : newNotificationsCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="account" 
                className="flex-col h-full gap-1 data-[state=active]:bg-transparent data-[state=active]:text-primary rounded-none"
              >
                <User className="w-5 h-5" />
                <span className="text-xs">{t("account")}</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </nav>
    </div>
  );
};

export default Dashboard;
