import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import SupportChat from "@/components/SupportChat";
import { useSupportUnread } from "@/hooks/useSupportUnread";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { studentCreds, invokeApi } from "@/lib/sessionApi";
import AppHeader from "@/components/layout/AppHeader";
import BuyerAppShell from "@/components/layout/BuyerAppShell";
import BuyerMobileNav from "@/components/layout/BuyerMobileNav";
import {
  HeaderAccountControl,
  HeaderChatsButton,
  HeaderNotificationsButton,
} from "@/components/layout/HeaderControls";
import NotificationsTab from "@/components/dashboard/NotificationsTab";
import HomeTab from "@/components/dashboard/HomeTab";
import AccountTab from "@/components/dashboard/AccountTab";
import MaterialsTab from "@/components/dashboard/MaterialsTab";
import ScheduleTab from "@/components/dashboard/ScheduleTab";
import { useRealtimeStudentNotifications } from "@/hooks/useRealtimeStudentNotifications";
import { useFCMRegistration } from "@/hooks/useFCMRegistration";
import { setAppBadge, clearAppBadge } from "@/lib/appBadge";
import { useAppResume } from "@/hooks/useAppResume";
import { useQuery } from "@tanstack/react-query";
import { buyerSectionFromPath, BUYER_NOTIFICATIONS_PATH } from "@/lib/navigation";

const Dashboard = () => {
  const [supportOpen, setSupportOpen] = useState(false);
  const [lastViewedAt, setLastViewedAt] = useState<Date | null>(null);
  const { user, loading, profileType, refreshSession } = useSimpleAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isAccountView = location.pathname === "/dashboard/account";
  const buyerSection = buyerSectionFromPath(location.pathname) ?? "home";
  const supportUnread = useSupportUnread("student", user?.id ?? "");
  useAppResume();

  const lastViewedKey = user?.id ? `student_notifications_last_viewed_${user.id}` : null;

  useEffect(() => {
    if (!lastViewedKey) return;
    const saved = localStorage.getItem(lastViewedKey);
    if (saved) setLastViewedAt(new Date(saved));
  }, [lastViewedKey]);

  const { data: purchasedProductIds = [] } = useQuery({
    queryKey: ["student-purchased-product-ids", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const data = await invokeApi<{ purchases: { product_id: string }[] }>("checkout", {
        action: "list_my_purchases",
        ...studentCreds(),
        status: "completed",
      });
      return [...new Set((data.purchases ?? []).map((p) => p.product_id))];
    },
    enabled: !!user?.id,
  });

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

  const newNotificationsCount = useMemo(() => {
    const compareDate = lastViewedAt || new Date(Date.now() - 24 * 60 * 60 * 1000);
    const newCancellations = cancellations.filter((c) => new Date(c.cancelled_at) > compareDate).length;
    const newPurchases = confirmedPurchases.filter((p) => p.confirmed_at && new Date(p.confirmed_at) > compareDate).length;
    const newUnlocks = materialUnlocks.filter((u) => new Date(u.unlocked_at) > compareDate).length;
    const newRejections = rejectedReschedules.filter((r) => r.responded_at && new Date(r.responded_at) > compareDate).length;
    const newIncoming = incomingReschedules.filter((r) => r.created_at && new Date(r.created_at) > compareDate).length;
    return newCancellations + newPurchases + newUnlocks + newRejections + newIncoming;
  }, [cancellations, confirmedPurchases, materialUnlocks, rejectedReschedules, incomingReschedules, lastViewedAt]);

  useRealtimeStudentNotifications(user?.id, !!user, newNotificationsCount, purchasedProductIds);

  useFCMRegistration({
    userId: user?.id,
    userRole: "student",
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (buyerSection !== "notifications") {
      setAppBadge(newNotificationsCount);
    }
  }, [newNotificationsCount, buyerSection]);

  useEffect(() => {
    if (buyerSection !== "notifications" || !lastViewedKey) return;
    const now = new Date();
    localStorage.setItem(lastViewedKey, now.toISOString());
    setLastViewedAt(now);
    clearAppBadge();
  }, [buyerSection, lastViewedKey]);

  useEffect(() => {
    if (loading || user) return;
    if (localStorage.getItem("creator_token")) void refreshSession();
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
      navigate("/login?next=/dashboard", { replace: true });
    }
  }, [user, loading, profileType, navigate]);

  if (loading || (!user && localStorage.getItem("creator_token"))) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <BuyerAppShell
      activeSection={isAccountView ? undefined : buyerSection}
      mobileNav={
        <BuyerMobileNav activeTab={isAccountView ? "account" : buyerSection} />
      }
    >
      <div className="min-h-screen pb-20 md:pb-6">
        <AppHeader>
          <HeaderChatsButton
            active={supportOpen}
            unread={supportUnread}
            onClick={() => setSupportOpen((v) => !v)}
          />
          <HeaderNotificationsButton
            active={buyerSection === "notifications"}
            count={newNotificationsCount}
            onClick={() => navigate(BUYER_NOTIFICATIONS_PATH)}
          />
          <HeaderAccountControl />
        </AppHeader>

        <main className="px-4 py-6 md:px-6">
          {supportOpen ? (
            <SupportChat userType="student" userRef={user.id} displayName={user.name} />
          ) : isAccountView ? (
            <div className="mx-auto max-w-2xl">
              <AccountTab />
            </div>
          ) : buyerSection === "notifications" ? (
            <div className="mx-auto max-w-2xl">
              <NotificationsTab lastViewedAt={lastViewedAt} purchasedProductIds={purchasedProductIds} />
            </div>
          ) : buyerSection === "schedule" ? (
            <ScheduleTab />
          ) : buyerSection === "materials" ? (
            <MaterialsTab />
          ) : (
            <HomeTab onBrowseCourses={() => navigate("/")} />
          )}
        </main>
      </div>
    </BuyerAppShell>
  );
};

export default Dashboard;
