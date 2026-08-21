import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Calendar, User, Bell, Loader2, Home as HomeIcon, MessageCircle, BookOpen } from "lucide-react";
import SupportChat from "@/components/SupportChat";
import { useSupportUnread } from "@/hooks/useSupportUnread";

const StudentSupportButton = ({ activeTab, userId, userName, onClick }: { activeTab: string; userId: string; userName: string; onClick: () => void }) => {
  const unread = useSupportUnread("student", userId);
  return (
    <button
      onClick={onClick}
      aria-label="Сообщения"
      className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
        activeTab === "support" ? "bg-accent text-white" : "text-muted-foreground hover:bg-accent/50"
      }`}
    >
      <MessageCircle className="w-5 h-5" />
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-primary text-primary-foreground text-xs font-bold rounded-full flex items-center justify-center">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
  );
};
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { studentCreds, invokeApi } from "@/lib/sessionApi";

import MaterialsTab from "@/components/dashboard/MaterialsTab";
import ScheduleTab from "@/components/dashboard/ScheduleTab";
import AccountTab from "@/components/dashboard/AccountTab";
import NotificationsTab from "@/components/dashboard/NotificationsTab";
import HomeTab from "@/components/dashboard/HomeTab";
import CoursesTab from "@/components/dashboard/CoursesTab";
import { useRealtimeStudentNotifications } from "@/hooks/useRealtimeStudentNotifications";
import { useFCMRegistration } from "@/hooks/useFCMRegistration";
import { setAppBadge, clearAppBadge } from "@/lib/appBadge";
import { useAppResume } from "@/hooks/useAppResume";

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState("home");
  const [lastViewedAt, setLastViewedAt] = useState<Date | null>(null);
  const previousTab = useRef(activeTab);
  const { user, loading, profileType, refreshSession } = useSimpleAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  useAppResume();

  // Загрузить lastViewedAt из localStorage (per-user key)
  const lastViewedKey = user?.id ? `student_notifications_last_viewed_${user.id}` : null;
  const catalogDefaulted = useRef(false);
  
  useEffect(() => {
    if (!lastViewedKey) return;
    const saved = localStorage.getItem(lastViewedKey);
    if (saved) {
      setLastViewedAt(new Date(saved));
    }
  }, [lastViewedKey]);

  // Get purchased product IDs for filtering material unlocks
  const { data: purchasedProductIds = [], isFetched: purchasesFetched } = useQuery({
    queryKey: ["student-purchased-product-ids", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const data = await invokeApi<{ purchases: { product_id: string }[] }>("checkout", {
        action: "list_my_purchases",
        ...studentCreds(),
        status: "completed",
      });
      return [...new Set((data.purchases ?? []).map(p => p.product_id))];
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!purchasesFetched || catalogDefaulted.current) return;
    catalogDefaulted.current = true;
    if (purchasedProductIds.length === 0) setActiveTab("courses");
  }, [purchasesFetched, purchasedProductIds.length]);

  // Получить отменённые записи для подсчёта бейджа
  const { data: cancellations = [] } = useQuery({
    queryKey: ["student-cancellations-count", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const data = await invokeApi<{ cancellations: { id: string; cancelled_at: string; cancelled_by: string }[] }>("manage-bookings", {
        action: "list_cancellations",
        ...studentCreds(),
      });
      return (data.cancellations ?? [])
        .filter((c) => c.cancelled_by === "creator" || c.cancelled_by === "teacher")
        .sort((a, b) => new Date(b.cancelled_at).getTime() - new Date(a.cancelled_at).getTime())
        .slice(0, 50);
    },
    enabled: !!user?.id,
  });

  const { data: confirmedPurchases = [] } = useQuery({
    queryKey: ["student-confirmed-purchases-count", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const data = await invokeApi<{ purchases: { id: string; created_at?: string; confirmed_at?: string | null }[] }>("checkout", {
        action: "list_my_purchases",
        ...studentCreds(),
        status: "completed",
      });
      return (data.purchases ?? [])
        .map((p) => ({ id: p.id, confirmed_at: p.confirmed_at || p.created_at || null }))
        .filter((p): p is { id: string; confirmed_at: string } => !!p.confirmed_at)
        .sort((a, b) => new Date(b.confirmed_at).getTime() - new Date(a.confirmed_at).getTime())
        .slice(0, 50);
    },
    enabled: !!user?.id,
  });

  // Material unlocks count
  const { data: materialUnlocks = [] } = useQuery({
    queryKey: ["student-material-unlocks-count", purchasedProductIds],
    queryFn: async () => {
      if (purchasedProductIds.length === 0) return [];
      const data = await invokeApi<{ unlocks: { id: string; unlocked_at: string; product_id?: string | null }[] }>("manage-materials", {
        action: "list_unlocks",
        ...studentCreds(),
      });
      return (data.unlocks ?? [])
        .filter((u) => !u.product_id || purchasedProductIds.includes(u.product_id))
        .sort((a, b) => new Date(b.unlocked_at).getTime() - new Date(a.unlocked_at).getTime())
        .slice(0, 50);
    },
    enabled: purchasedProductIds.length > 0,
  });

  // Rejected reschedule requests count
  const { data: rejectedReschedules = [] } = useQuery({
    queryKey: ["student-rejected-reschedules-count", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const data = await invokeApi<{ requests: { id: string; responded_at: string | null }[] }>("manage-bookings", {
        action: "list_reschedule_requests",
        ...studentCreds(),
        status: "rejected",
      });
      return (data.requests ?? [])
        .sort((a, b) => new Date(b.responded_at || 0).getTime() - new Date(a.responded_at || 0).getTime())
        .slice(0, 50);
    },
    enabled: !!user?.id,
  });

  // Incoming reschedule requests from creator/teacher
  const { data: incomingReschedules = [] } = useQuery({
    queryKey: ["student-incoming-reschedules-count", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const data = await invokeApi<{ requests: { id: string; created_at: string; requested_by?: string }[] }>("manage-bookings", {
        action: "list_reschedule_requests",
        ...studentCreds(),
        status: "pending",
      });
      return (data.requests ?? [])
        .filter((r) => r.requested_by !== "student")
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 50);
    },
    enabled: !!user?.id,
  });

  // Подсчёт новых уведомлений
  const newNotificationsCount = useMemo(() => {
    const compareDate = lastViewedAt || new Date(Date.now() - 24 * 60 * 60 * 1000);
    const newCancellations = cancellations.filter(c => new Date(c.cancelled_at) > compareDate).length;
    const newPurchases = confirmedPurchases.filter(p => p.confirmed_at && new Date(p.confirmed_at) > compareDate).length;
    const newUnlocks = materialUnlocks.filter(u => new Date(u.unlocked_at) > compareDate).length;
    const newRejections = rejectedReschedules.filter(r => r.responded_at && new Date(r.responded_at) > compareDate).length;
    const newIncoming = incomingReschedules.filter(r => r.created_at && new Date(r.created_at) > compareDate).length;
    return newCancellations + newPurchases + newUnlocks + newRejections + newIncoming;
  }, [cancellations, confirmedPurchases, materialUnlocks, rejectedReschedules, incomingReschedules, lastViewedAt]);

  // Realtime уведомления (звуки и push) с badge count
  useRealtimeStudentNotifications(user?.id, !!user, newNotificationsCount, purchasedProductIds);

  // Register FCM token for push notifications
  useFCMRegistration({
    userId: user?.id,
    userRole: "student",
    enabled: !!user?.id
  });

  // Set initial app badge based on notification count
  useEffect(() => {
    if (activeTab !== "notifications") {
      setAppBadge(newNotificationsCount);
    }
  }, [newNotificationsCount, activeTab]);

  // Обновление lastViewedAt при входе/выходе с вкладки уведомлений
  const handleTabChange = (value: string) => {
    // Save lastViewedAt when entering OR leaving notifications tab
    if (lastViewedKey && (value === "notifications" || (previousTab.current === "notifications" && value !== "notifications"))) {
      const now = new Date();
      localStorage.setItem(lastViewedKey, now.toISOString());
      setLastViewedAt(now);
      clearAppBadge();
    }
    previousTab.current = value;
    setActiveTab(value);
  };

  useEffect(() => {
    if (loading || user) return;
    if (localStorage.getItem("creator_token")) {
      void refreshSession();
    }
  }, [loading, user, refreshSession]);

  useEffect(() => {
    if (loading) return;
    if (profileType === "creator") {
      navigate("/creator");
      return;
    }
    if (profileType === "school") {
      navigate("/school");
      return;
    }
    if (!user) {
      navigate("/");
    }
  }, [user, loading, profileType, navigate]);

  if (loading || (!user && localStorage.getItem("creator_token"))) {
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
          <h1 className="text-xl font-bold text-foreground">
            {activeTab === "courses" ? "Dostup" : t("myDashboard")}
          </h1>
          <StudentSupportButton activeTab={activeTab} userId={user.id} userName={user.name} onClick={() => handleTabChange("support")} />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsContent value="home" className="mt-0 animate-fade-in">
            <HomeTab onBrowseCourses={() => handleTabChange("courses")} />
          </TabsContent>
          <TabsContent value="courses" className="mt-0 animate-fade-in">
            <CoursesTab />
          </TabsContent>
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
          <TabsContent value="support" className="mt-0 animate-fade-in">
            <SupportChat userType="student" userRef={user.id} displayName={user.name} />
          </TabsContent>
        </Tabs>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-lg border-t border-border safe-area-inset">
        <div className="max-w-2xl mx-auto">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="w-full h-16 bg-transparent rounded-none grid grid-cols-6 gap-0">
              <TabsTrigger 
                value="home" 
                className="flex-col h-full gap-1 data-[state=active]:bg-transparent data-[state=active]:text-primary rounded-none px-1"
              >
                <HomeIcon className="w-5 h-5" />
                <span className="text-[10px] leading-tight">{t("home")}</span>
              </TabsTrigger>
              <TabsTrigger 
                value="courses" 
                className="flex-col h-full gap-1 data-[state=active]:bg-transparent data-[state=active]:text-primary rounded-none px-1"
              >
                <BookOpen className="w-5 h-5" />
                <span className="text-[10px] leading-tight">{t("courses")}</span>
              </TabsTrigger>
              <TabsTrigger 
                value="materials" 
                className="flex-col h-full gap-1 data-[state=active]:bg-transparent data-[state=active]:text-primary rounded-none px-1"
              >
                <FileText className="w-5 h-5" />
                <span className="text-[10px] leading-tight">{t("materials")}</span>
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
                className="flex-col h-full gap-1 data-[state=active]:bg-transparent data-[state=active]:text-primary rounded-none px-1 relative"
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
    </div>
  );
};

export default Dashboard;
