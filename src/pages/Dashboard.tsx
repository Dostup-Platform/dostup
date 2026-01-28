import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Calendar, User, Bell, Loader2 } from "lucide-react";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import MaterialsTab from "@/components/dashboard/MaterialsTab";
import ScheduleTab from "@/components/dashboard/ScheduleTab";
import AccountTab from "@/components/dashboard/AccountTab";
import NotificationsTab from "@/components/dashboard/NotificationsTab";
import { useRealtimeStudentNotifications } from "@/hooks/useRealtimeStudentNotifications";
import { useFCMRegistration } from "@/hooks/useFCMRegistration";
import { setAppBadge, clearAppBadge } from "@/lib/appBadge";

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState("materials");
  const [lastViewedAt, setLastViewedAt] = useState<Date | null>(null);
  const previousTab = useRef(activeTab);
  const { user, loading } = useSimpleAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  // Загрузить lastViewedAt из localStorage
  useEffect(() => {
    const saved = localStorage.getItem("student_notifications_last_viewed");
    if (saved) {
      setLastViewedAt(new Date(saved));
    }
  }, []);

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

  // Подсчёт новых уведомлений
  const newNotificationsCount = useMemo(() => {
    const compareDate = lastViewedAt || new Date(Date.now() - 24 * 60 * 60 * 1000);
    return cancellations.filter(c => new Date(c.cancelled_at) > compareDate).length;
  }, [cancellations, lastViewedAt]);

  // Realtime уведомления (звуки и push) с badge count
  useRealtimeStudentNotifications(user?.phone, !!user, newNotificationsCount);

  // Register FCM token for push notifications
  useFCMRegistration({
    userPhone: user?.phone,
    userRole: "student",
    enabled: !!user?.phone
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
      // Clear app badge when leaving notifications
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
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border px-4 py-4 safe-area-inset">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">{t("myDashboard")}</h1>
          <LanguageSwitcher />
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsContent value="materials" className="mt-0 animate-fade-in">
            <MaterialsTab />
          </TabsContent>
          <TabsContent value="schedule" className="mt-0 animate-fade-in">
            <ScheduleTab />
          </TabsContent>
          <TabsContent value="notifications" className="mt-0 animate-fade-in">
            <NotificationsTab lastViewedAt={lastViewedAt} />
          </TabsContent>
          <TabsContent value="account" className="mt-0 animate-fade-in">
            <AccountTab />
          </TabsContent>
        </Tabs>
      </main>

      {/* Bottom Navigation */}
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
