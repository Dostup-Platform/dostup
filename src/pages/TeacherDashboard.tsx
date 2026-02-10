import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, FileText, Bell, User, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useTeacherProducts } from "@/hooks/useProductTeachers";
import { useIsMobile } from "@/hooks/use-mobile";
import TeacherScheduleTab from "@/components/teacher/TeacherScheduleTab";
import TeacherMaterialsTab from "@/components/teacher/TeacherMaterialsTab";
import TeacherNotificationsTab from "@/components/teacher/TeacherNotificationsTab";
import TeacherAccountTab from "@/components/teacher/TeacherAccountTab";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFCMRegistration } from "@/hooks/useFCMRegistration";
import { useRealtimeTeacherNotifications } from "@/hooks/useRealtimeTeacherNotifications";
import { setAppBadge, clearAppBadge } from "@/lib/appBadge";

const LAST_VIEWED_KEY = "teacher_notifications_last_viewed";

const TeacherDashboard = () => {
  const [activeTab, setActiveTab] = useState("schedule");
  const [teacherName, setTeacherName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastViewedAt, setLastViewedAt] = useState<Date | null>(null);
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Load teacher data from localStorage
  useEffect(() => {
    const teacherDataStr = localStorage.getItem("teacher_data");
    if (!teacherDataStr) {
      navigate("/");
    } else {
      try {
        const teacherData = JSON.parse(teacherDataStr);
        setTeacherName(teacherData.name);
      } catch {
        navigate("/");
      }
      setIsLoading(false);
    }
  }, [navigate]);

  // Load last viewed timestamp
  useEffect(() => {
    const stored = localStorage.getItem(LAST_VIEWED_KEY);
    if (stored) {
      setLastViewedAt(new Date(stored));
    }
  }, []);

  // Get products where this teacher has access
  const { data: teacherProducts = [], isLoading: productsLoading } = useTeacherProducts(teacherName || undefined);
  const productIds = useMemo(() => teacherProducts.map(tp => tp.product_id), [teacherProducts]);

  // Get teacher user record for phone
  const { data: teacherUser } = useQuery({
    queryKey: ["teacher-user", teacherName],
    queryFn: async () => {
      if (!teacherName) return null;
      
      const { data } = await supabase
        .from("simple_users")
        .select("id, phone")
        .eq("name", teacherName)
        .eq("role", "teacher")
        .maybeSingle();
      
      return data;
    },
    enabled: !!teacherName,
  });

  // Get teacher's schedule IDs for notifications
  const { data: teacherSchedules = [] } = useQuery({
    queryKey: ["teacher-schedules", teacherName],
    queryFn: async () => {
      if (!teacherName || !productIds.length) return [];
      
      // Get simple_user by name
      const { data: user } = await supabase
        .from("simple_users")
        .select("id")
        .eq("name", teacherName)
        .single();
      
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("schedules")
        .select("id, product_id, title")
        .in("product_id", productIds)
        .eq("teacher_id", user.id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!teacherName && productIds.length > 0,
  });

  const scheduleIds = useMemo(() => teacherSchedules.map(s => s.id), [teacherSchedules]);

  // Register FCM for teacher push notifications
  useFCMRegistration({
    userId: teacherUser?.id,
    userPhone: teacherUser?.phone,
    userRole: "teacher",
    enabled: !!teacherUser?.id,
  });

  // Get bookings for notification count - use same key as notification tab
  const { data: bookings = [] } = useQuery({
    queryKey: ["teacher-notification-bookings", scheduleIds],
    queryFn: async () => {
      if (!scheduleIds.length) return [];
      
      const { data, error } = await supabase
        .from("simple_bookings")
        .select("id, created_at")
        .in("schedule_id", scheduleIds)
        .eq("status", "confirmed");
      
      if (error) throw error;
      return data || [];
    },
    enabled: scheduleIds.length > 0,
  });

  // Get cancellations - use same key as notification tab
  const { data: cancellations = [] } = useQuery({
    queryKey: ["teacher-notification-cancellations", productIds],
    queryFn: async () => {
      if (!productIds.length) return [];
      
      const { data, error } = await supabase
        .from("booking_cancellations")
        .select("id, cancelled_at")
        .in("product_id", productIds)
        .eq("cancelled_by", "student");
      
      if (error) throw error;
      return data || [];
    },
    enabled: productIds.length > 0,
  });

  // Count new notifications
  const newNotificationsCount = useMemo(() => {
    const compareDate = lastViewedAt || new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const newBookingsCount = bookings.filter(b => new Date(b.created_at) > compareDate).length;
    const newCancellationsCount = cancellations.filter(c => new Date(c.cancelled_at) > compareDate).length;
    
    return newBookingsCount + newCancellationsCount;
  }, [bookings, cancellations, lastViewedAt]);

  // Real-time notifications for teacher bookings/cancellations (with badge count)
  useRealtimeTeacherNotifications(
    teacherName,
    teacherUser?.phone,
    scheduleIds,
    scheduleIds.length > 0,
    newNotificationsCount
  );
  
  // Set initial app badge based on notification count
  useEffect(() => {
    if (activeTab !== "notifications") {
      setAppBadge(newNotificationsCount);
    }
  }, [newNotificationsCount, activeTab]);

  // Handle tab change - update last viewed when leaving notifications
  const handleTabChange = useCallback((value: string) => {
    if (activeTab === "notifications" && value !== "notifications") {
      const now = new Date();
      localStorage.setItem(LAST_VIEWED_KEY, now.toISOString());
      setLastViewedAt(now);
      // Clear app badge when leaving notifications
      clearAppBadge();
    }
    setActiveTab(value);
  }, [activeTab]);

  if (isLoading || productsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!teacherName) return null;

  return (
    <div className={`min-h-screen bg-background ${isMobile ? "pb-20" : ""}`}>
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border px-4 py-4 safe-area-inset">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {language === "ru" ? "Панель учителя" : "Мұғалім панелі"}
            </h1>
            <p className="text-sm text-muted-foreground">{teacherName}</p>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          {/* Desktop Top Tabs */}
          {!isMobile && (
            <TabsList className="w-full h-12 grid grid-cols-4 mb-6">
              <TabsTrigger value="schedule" className="gap-2">
                <Calendar className="w-4 h-4" />
                {t("schedule")}
              </TabsTrigger>
              <TabsTrigger value="materials" className="gap-2">
                <FileText className="w-4 h-4" />
                {t("materials")}
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

          <TabsContent value="schedule" className="mt-0 animate-fade-in">
            <TeacherScheduleTab teacherName={teacherName} productIds={productIds} />
          </TabsContent>
          <TabsContent value="materials" className="mt-0 animate-fade-in">
            <TeacherMaterialsTab productIds={productIds} teacherName={teacherName} />
          </TabsContent>
          <TabsContent value="notifications" className="mt-0 animate-fade-in">
            <TeacherNotificationsTab 
              teacherName={teacherName} 
              productIds={productIds} 
              lastViewedAt={lastViewedAt} 
            />
          </TabsContent>
          <TabsContent value="account" className="mt-0 animate-fade-in">
            <TeacherAccountTab teacherName={teacherName} teacherPhone={teacherUser?.phone} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Bottom Navigation - Mobile Only */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-lg border-t border-border safe-area-inset">
          <div className="max-w-2xl mx-auto">
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsList className="w-full h-16 bg-transparent rounded-none grid grid-cols-4 gap-1">
                <TabsTrigger 
                  value="schedule" 
                  className="flex-col h-full gap-1 data-[state=active]:bg-transparent data-[state=active]:text-primary rounded-none"
                >
                  <Calendar className="w-5 h-5" />
                  <span className="text-xs">{t("schedule")}</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="materials" 
                  className="flex-col h-full gap-1 data-[state=active]:bg-transparent data-[state=active]:text-primary rounded-none"
                >
                  <FileText className="w-5 h-5" />
                  <span className="text-xs">{t("materials")}</span>
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
      )}
    </div>
  );
};

export default TeacherDashboard;
