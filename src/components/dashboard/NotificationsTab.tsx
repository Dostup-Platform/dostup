import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Calendar, Clock, CheckCircle, Unlock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { format, formatDistanceToNow } from "date-fns";
import { ru, kk } from "date-fns/locale";

interface BookingCancellation {
  id: string;
  booking_id: string;
  product_title: string;
  schedule_title: string | null;
  slot_date: string;
  slot_time: string;
  cancelled_at: string;
  cancelled_by: string;
  cancellation_reasons: string[] | null;
  cancellation_comment: string | null;
}

interface ConfirmedPurchase {
  id: string;
  product_id: string;
  confirmed_at: string;
  product_title: string;
}

interface MaterialUnlock {
  id: string;
  material_title: string;
  product_title: string;
  product_id: string;
  unlocked_at: string;
}

interface NotificationsTabProps {
  lastViewedAt?: Date | null;
  purchasedProductIds?: string[];
}

const NotificationsTab = ({ lastViewedAt, purchasedProductIds = [] }: NotificationsTabProps) => {
  const { t, language } = useLanguage();
  const { user } = useSimpleAuth();
  const queryClient = useQueryClient();

  // Получить отменённые записи
  const { data: cancellations = [], isLoading: loadingCancellations } = useQuery({
    queryKey: ["student-cancellations", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("booking_cancellations")
        .select("*")
        .eq("simple_user_id", user.id)
        .in("cancelled_by", ["creator", "teacher"])
        .order("cancelled_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as BookingCancellation[];
    },
    enabled: !!user?.id,
  });

  // Получить подтверждённые покупки
  const { data: confirmedPurchases = [], isLoading: loadingPurchases } = useQuery({
    queryKey: ["student-confirmed-purchases", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("simple_purchases")
        .select("id, product_id, confirmed_at, product:products(title)")
        .eq("simple_user_id", user.id)
        .in("status", ["confirmed", "completed"])
        .not("confirmed_at", "is", null)
        .order("confirmed_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []).map((p: any) => ({
        id: p.id,
        product_id: p.product_id,
        confirmed_at: p.confirmed_at,
        product_title: p.product?.title || "",
      })) as ConfirmedPurchase[];
    },
    enabled: !!user?.id,
  });

  // Получить разблокированные материалы
  const { data: materialUnlocks = [], isLoading: loadingUnlocks } = useQuery({
    queryKey: ["student-material-unlocks", purchasedProductIds],
    queryFn: async () => {
      if (purchasedProductIds.length === 0) return [];
      const { data, error } = await supabase
        .from("material_unlocks")
        .select("*")
        .in("product_id", purchasedProductIds)
        .order("unlocked_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as MaterialUnlock[];
    },
    enabled: purchasedProductIds.length > 0,
  });

  // Realtime для обновления
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel("student-notifications-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "booking_cancellations" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["student-cancellations"] });
          queryClient.invalidateQueries({ queryKey: ["student-cancellations-count"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "simple_purchases" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["student-confirmed-purchases"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "material_unlocks" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["student-material-unlocks"] });
          queryClient.invalidateQueries({ queryKey: ["student-material-unlocks-count"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const isNew = (dateStr: string) => {
    if (!lastViewedAt) {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return new Date(dateStr) > dayAgo;
    }
    return new Date(dateStr) > lastViewedAt;
  };

  const locale = language === "ru" ? ru : kk;

  const isLoading = loadingCancellations || loadingPurchases || loadingUnlocks;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Merge all notifications into a single timeline
  type NotificationItem = 
    | { type: "cancellation"; date: string; data: BookingCancellation }
    | { type: "purchase_confirmed"; date: string; data: ConfirmedPurchase }
    | { type: "material_unlock"; date: string; data: MaterialUnlock };

  const allNotifications: NotificationItem[] = [
    ...cancellations.map(c => ({ type: "cancellation" as const, date: c.cancelled_at, data: c })),
    ...confirmedPurchases.map(p => ({ type: "purchase_confirmed" as const, date: p.confirmed_at, data: p })),
    ...materialUnlocks.map(u => ({ type: "material_unlock" as const, date: u.unlocked_at, data: u })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const hasNotifications = allNotifications.length > 0;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">{t("notifications")}</h2>

      {!hasNotifications ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">{t("noStudentNotifications")}</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              {t("studentNotificationsWillAppear")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {allNotifications.map((item) => {
            if (item.type === "material_unlock") {
              const unlock = item.data as MaterialUnlock;
              return (
                <Card key={`unlock-${unlock.id}`} className="relative overflow-hidden">
                  {isNew(unlock.unlocked_at) && (
                    <div className="absolute top-0 right-0">
                      <Badge className="rounded-none rounded-bl-lg bg-primary text-primary-foreground text-xs px-2 py-1">
                        {t("new")}
                      </Badge>
                    </div>
                  )}
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                        <Unlock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-medium text-foreground">
                          {language === "ru" ? "Материал доступен" : "Материал қолжетімді"}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {unlock.material_title} • {unlock.product_title}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                          <span>
                            {formatDistanceToNow(new Date(unlock.unlocked_at), {
                              addSuffix: true,
                              locale,
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            }

            if (item.type === "purchase_confirmed") {
              const purchase = item.data as ConfirmedPurchase;
              return (
                <Card key={`purchase-${purchase.id}`} className="relative overflow-hidden">
                  {isNew(purchase.confirmed_at) && (
                    <div className="absolute top-0 right-0">
                      <Badge className="rounded-none rounded-bl-lg bg-primary text-primary-foreground text-xs px-2 py-1">
                        {t("new")}
                      </Badge>
                    </div>
                  )}
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-medium text-foreground">
                          {language === "ru" ? "Оплата подтверждена" : "Төлем расталды"}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {purchase.product_title}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                          <span>
                            {formatDistanceToNow(new Date(purchase.confirmed_at), {
                              addSuffix: true,
                              locale,
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            }

            const cancellation = item.data as BookingCancellation;
            return (
              <Card key={`cancel-${cancellation.id}`} className="relative overflow-hidden">
                {isNew(cancellation.cancelled_at) && (
                  <div className="absolute top-0 right-0">
                    <Badge className="rounded-none rounded-bl-lg bg-primary text-primary-foreground text-xs px-2 py-1">
                      {t("new")}
                    </Badge>
                  </div>
                )}
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-5 h-5 text-destructive" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-medium text-foreground">
                        {cancellation.cancelled_by === "teacher"
                          ? (language === "ru" ? "Запись отменена учителем" : "Мұғалім жазылуды болдырмады")
                          : (language === "ru" ? "Запись отменена автором" : "Автор жазылуды болдырмады")}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {cancellation.product_title}
                        {cancellation.schedule_title && ` • ${cancellation.schedule_title}`}
                      </p>
                      
                      {((cancellation.cancellation_reasons && cancellation.cancellation_reasons.length > 0) || cancellation.cancellation_comment) && (
                        <div className="mt-2 p-2 bg-destructive/5 rounded-md">
                          {cancellation.cancellation_reasons && cancellation.cancellation_reasons.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {cancellation.cancellation_reasons.map((reason: string, idx: number) => (
                                <Badge key={idx} variant="outline" className="text-xs px-2 py-0.5 border-destructive/30 text-destructive">
                                  {reason}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {cancellation.cancellation_comment && (
                            <p className="text-sm text-muted-foreground mt-1.5 italic">
                              "{cancellation.cancellation_comment}"
                            </p>
                          )}
                        </div>
                      )}
                      
                      <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {format(new Date(cancellation.slot_date), "d MMM", { locale })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {cancellation.slot_time?.slice(0, 5)}
                        </span>
                        <span>
                          {formatDistanceToNow(new Date(cancellation.cancelled_at), {
                            addSuffix: true,
                            locale,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NotificationsTab;
