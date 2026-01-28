import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Bell, Calendar, Clock, User, X, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";

interface TeacherNotificationsTabProps {
  teacherName: string;
  productIds: string[];
  lastViewedAt: Date | null;
}

const TeacherNotificationsTab = ({ teacherName, productIds, lastViewedAt }: TeacherNotificationsTabProps) => {
  const { language } = useLanguage();

  // Get teacher's user ID for phone
  const { data: teacherData } = useQuery({
    queryKey: ["teacher-id", teacherName],
    queryFn: async () => {
      const { data } = await supabase
        .from("simple_users")
        .select("id, phone")
        .eq("name", teacherName)
        .single();
      return data;
    },
    enabled: !!teacherName,
  });
  // Get teacher's schedules
  const { data: teacherSchedules = [] } = useQuery({
    queryKey: ["teacher-notification-schedules", teacherData?.id, productIds],
    queryFn: async () => {
      if (!teacherData?.id || !productIds.length) return [];
      
      const { data, error } = await supabase
        .from("schedules")
        .select("id")
        .in("product_id", productIds)
        .eq("teacher_id", teacherData.id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!teacherData?.id && productIds.length > 0,
  });

  const scheduleIds = teacherSchedules.map(s => s.id);

  // Get bookings for teacher's schedules
  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ["teacher-notification-bookings", scheduleIds],
    queryFn: async () => {
      if (!scheduleIds.length) return [];
      
      const { data, error } = await supabase
        .from("simple_bookings")
        .select(`
          id,
          created_at,
          time_slot:time_slots(date, start_time, end_time),
          schedule:schedules(title, product:products(title)),
          user:simple_users(name, phone)
        `)
        .in("schedule_id", scheduleIds)
        .eq("status", "confirmed")
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data || [];
    },
    enabled: scheduleIds.length > 0,
  });

  // Get cancellations for teacher's products
  const { data: cancellations = [], isLoading: cancellationsLoading } = useQuery({
    queryKey: ["teacher-notification-cancellations", productIds],
    queryFn: async () => {
      if (!productIds.length) return [];
      
      const { data, error } = await supabase
        .from("booking_cancellations")
        .select("*")
        .in("product_id", productIds)
        .eq("cancelled_by", "student")
        .order("cancelled_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data || [];
    },
    enabled: productIds.length > 0,
  });

  const isLoading = bookingsLoading || cancellationsLoading;
  const compareDate = lastViewedAt || new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Combine and sort all notifications
  const allNotifications = [
    ...bookings.map(b => ({
      id: b.id,
      type: "booking" as const,
      date: b.created_at,
      data: b,
    })),
    ...cancellations.map(c => ({
      id: c.id,
      type: "cancellation" as const,
      date: c.cancelled_at,
      data: c,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Bell className="w-5 h-5" />
        {language === "ru" ? "Уведомления" : "Хабарландырулар"}
      </h2>

      {allNotifications.length === 0 ? (
        <div className="text-center py-12">
          <Bell className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-muted-foreground">
            {language === "ru" ? "Уведомлений пока нет" : "Хабарландырулар әзірше жоқ"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {language === "ru" 
              ? "Здесь будут появляться записи и отмены" 
              : "Мұнда жазбалар мен бас тартулар пайда болады"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
        {allNotifications.map((notification) => {
          const isNew = new Date(notification.date) > compareDate;
          
          if (notification.type === "booking") {
            const booking = notification.data as any;
            return (
              <Card key={`booking-${notification.id}`} className={isNew ? "border-primary/50 bg-primary/5" : ""}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-success" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium truncate">{booking.user?.name || "—"}</p>
                        {isNew && (
                          <Badge variant="default" className="text-[10px] px-1.5 py-0">
                            {language === "ru" ? "Новое" : "Жаңа"}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {language === "ru" ? "записался на" : "жазылды"} {booking.schedule?.product?.title || booking.schedule?.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-0.5">
                          <Calendar className="w-3 h-3" />
                          {booking.time_slot?.date && format(parseISO(booking.time_slot.date), "d MMM", { locale: ru })}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Clock className="w-3 h-3" />
                          {booking.time_slot?.start_time?.slice(0, 5)}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          } else {
            const cancellation = notification.data as any;
            return (
              <Card key={`cancel-${notification.id}`} className={isNew ? "border-destructive/50 bg-destructive/5" : ""}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                      <X className="w-4 h-4 text-destructive" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium truncate">{cancellation.user_name}</p>
                        {isNew && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                            {language === "ru" ? "Новое" : "Жаңа"}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {language === "ru" ? "отменил запись на" : "жазбасын бас тартты"} {cancellation.product_title}
                      </p>
                      
                      {/* Причины отмены или комментарий */}
                      {((cancellation.cancellation_reasons && cancellation.cancellation_reasons.length > 0) || cancellation.cancellation_comment) && (
                        <div className="mt-1.5 p-1.5 bg-destructive/5 rounded">
                          {cancellation.cancellation_reasons && cancellation.cancellation_reasons.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {cancellation.cancellation_reasons.map((reason: string, idx: number) => (
                                <Badge key={idx} variant="outline" className="text-[10px] px-1 py-0 border-destructive/30 text-destructive">
                                  {reason}
                                </Badge>
                              ))}
                            </div>
                          )}
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
                          {cancellation.slot_date && format(parseISO(cancellation.slot_date), "d MMM", { locale: ru })}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Clock className="w-3 h-3" />
                          {cancellation.slot_time?.slice(0, 5)}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          }
        })}
        </div>
      )}
    </div>
  );
};

export default TeacherNotificationsTab;
