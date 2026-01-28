import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Calendar, Clock } from "lucide-react";
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

interface NotificationsTabProps {
  lastViewedAt?: Date | null;
}

const NotificationsTab = ({ lastViewedAt }: NotificationsTabProps) => {
  const { t, language } = useLanguage();
  const { user } = useSimpleAuth();
  const queryClient = useQueryClient();

  // Получить отменённые записи для пользователя (cancelled_by = 'creator')
  const { data: cancellations = [], isLoading } = useQuery({
    queryKey: ["student-cancellations", user?.phone],
    queryFn: async () => {
      if (!user?.phone) return [];

      const { data, error } = await supabase
        .from("booking_cancellations")
        .select("*")
        .eq("user_phone", user.phone)
        .eq("cancelled_by", "creator")
        .order("cancelled_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as BookingCancellation[];
    },
    enabled: !!user?.phone,
  });

  // Realtime для обновления
  useEffect(() => {
    if (!user?.phone) return;

    const channel = supabase
      .channel("student-cancellations-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "booking_cancellations",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["student-cancellations"] });
          queryClient.invalidateQueries({ queryKey: ["student-cancellations-count"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.phone, queryClient]);

  const isNew = (cancelledAt: string) => {
    if (!lastViewedAt) {
      // Если никогда не просматривали, считаем новыми последние 24 часа
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return new Date(cancelledAt) > dayAgo;
    }
    return new Date(cancelledAt) > lastViewedAt;
  };

  const locale = language === "ru" ? ru : kk;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const hasNotifications = cancellations.length > 0;

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
          <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {t("cancelledBookings")}
          </h3>

          <div className="space-y-2">
            {cancellations.map((cancellation) => (
              <Card key={cancellation.id} className="relative overflow-hidden">
                {isNew(cancellation.cancelled_at) && (
                  <div className="absolute top-0 right-0">
                    <Badge className="rounded-none rounded-bl-lg bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5">
                      {t("new")}
                    </Badge>
                  </div>
                )}
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-4 h-4 text-destructive" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {language === "ru" ? "Запись отменена автором" : "Автор жазылуды болдырмады"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {cancellation.product_title}
                        {cancellation.schedule_title && ` • ${cancellation.schedule_title}`}
                      </p>
                      
                      {/* Причины отмены от автора */}
                      {cancellation.cancellation_reasons && cancellation.cancellation_reasons.length > 0 && (
                        <div className="mt-1.5 p-1.5 bg-destructive/5 rounded">
                          <div className="flex flex-wrap gap-1">
                            {cancellation.cancellation_reasons.map((reason: string, idx: number) => (
                              <Badge key={idx} variant="outline" className="text-[10px] px-1 py-0 border-destructive/30 text-destructive">
                                {reason}
                              </Badge>
                            ))}
                          </div>
                          {cancellation.cancellation_comment && (
                            <p className="text-[10px] text-muted-foreground mt-1 italic">
                              "{cancellation.cancellation_comment}"
                            </p>
                          )}
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-0.5">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(cancellation.slot_date), "d MMM", { locale })}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Clock className="w-3 h-3" />
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
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsTab;
