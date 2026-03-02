import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Bell, Calendar, Clock, User, X, Loader2, Timer, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "sonner";
import { useEffect } from "react";
import RejectRescheduleDialog from "@/components/RejectRescheduleDialog";

interface RescheduleRequest {
  id: string;
  booking_id: string;
  simple_user_id: string | null;
  schedule_id: string | null;
  product_id: string;
  product_title: string;
  old_date: string;
  old_time: string;
  new_date: string;
  new_time: string;
  reasons: string[] | null;
  comment: string | null;
  status: string;
  response_comment: string | null;
  created_at: string;
  user_name?: string;
}

interface TeacherNotificationsTabProps {
  teacherName: string;
  productIds: string[];
  lastViewedAt: Date | null;
}

const TeacherNotificationsTab = ({ teacherName, productIds, lastViewedAt }: TeacherNotificationsTabProps) => {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null);

  // Get teacher's user ID
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
          id, created_at,
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

  // Get cancellations
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

  // Get reschedule requests for teacher's schedules
  const { data: rescheduleRequests = [], isLoading: rescheduleLoading } = useQuery<RescheduleRequest[]>({
    queryKey: ["teacher-reschedule-requests", scheduleIds],
    queryFn: async () => {
      if (!scheduleIds.length) return [];
      const { data } = await supabase
        .from("reschedule_requests")
        .select("*")
        .in("schedule_id", scheduleIds)
        .eq("status", "pending")
        .eq("requested_by", "student")
        .order("created_at", { ascending: false })
        .limit(50);
      if (!data?.length) return [];

      const userIds = [...new Set((data as any[]).map((r: any) => r.simple_user_id).filter(Boolean))];
      const { data: users } = await supabase.from("simple_users").select("id, name").in("id", userIds);

      return (data as any[]).map((r: any) => ({
        ...r,
        user_name: users?.find((u: any) => u.id === r.simple_user_id)?.name || "Ученик",
      })) as RescheduleRequest[];
    },
    enabled: scheduleIds.length > 0,
  });

  // Approve reschedule
  const approveReschedule = useMutation({
    mutationFn: async (request: RescheduleRequest) => {
      const { error: updateError } = await supabase
        .from("reschedule_requests")
        .update({ status: "approved", responded_at: new Date().toISOString() } as any)
        .eq("id", request.id);
      if (updateError) throw updateError;

      const { data: booking } = await supabase
        .from("simple_bookings")
        .select("time_slot_id")
        .eq("id", request.booking_id)
        .single();

      if (booking?.time_slot_id) {
        const { data: currentSlot } = await supabase
          .from("time_slots")
          .select("start_time, end_time")
          .eq("id", booking.time_slot_id)
          .single();

        let newEndTime = request.new_time;
        if (currentSlot) {
          const [sh, sm] = currentSlot.start_time.split(":").map(Number);
          const [eh, em] = currentSlot.end_time.split(":").map(Number);
          const durationMin = (eh * 60 + em) - (sh * 60 + sm);
          const [nh, nm] = request.new_time.split(":").map(Number);
          const endTotal = nh * 60 + nm + durationMin;
          newEndTime = `${String(Math.floor(endTotal / 60) % 24).padStart(2, "0")}:${String(endTotal % 60).padStart(2, "0")}:00`;
        }

        await supabase.from("time_slots").update({
          date: request.new_date,
          start_time: request.new_time,
          end_time: newEndTime,
        }).eq("id", booking.time_slot_id);
      }

      await supabase.from("booking_reschedules").insert({
        booking_id: request.booking_id,
        simple_user_id: request.simple_user_id,
        schedule_id: request.schedule_id,
        product_id: request.product_id,
        product_title: request.product_title,
        old_date: request.old_date,
        old_time: request.old_time,
        new_date: request.new_date,
        new_time: request.new_time,
        rescheduled_by: "teacher",
        reasons: ["Запрос ученика подтверждён"],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-reschedule-requests"] });
      toast.success(language === "ru" ? "Перенос подтверждён" : "Ауыстыру расталды");
    },
    onError: () => {
      toast.error(language === "ru" ? "Ошибка при подтверждении" : "Растау қатесі");
    },
  });

  // Reject reschedule
  const rejectReschedule = useMutation({
    mutationFn: async ({ requestId, comment }: { requestId: string; comment: string }) => {
      const { error } = await supabase
        .from("reschedule_requests")
        .update({ status: "rejected", response_comment: comment, responded_at: new Date().toISOString() } as any)
        .eq("id", requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-reschedule-requests"] });
      setRejectingRequestId(null);
      toast.success(language === "ru" ? "Запрос отклонён" : "Сұраныс қабылданбады");
    },
    onError: () => {
      toast.error(language === "ru" ? "Ошибка" : "Қате");
    },
  });

  // Realtime for reschedule requests
  useEffect(() => {
    if (!scheduleIds.length) return;
    const channel = supabase
      .channel("teacher-reschedule-requests-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reschedule_requests" },
        (payload) => {
          const newRequest = payload.new as any;
          if (scheduleIds.includes(newRequest.schedule_id)) {
            queryClient.invalidateQueries({ queryKey: ["teacher-reschedule-requests"] });
          }
        }
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [scheduleIds, queryClient]);

  const isLoading = bookingsLoading || cancellationsLoading || rescheduleLoading;
  const compareDate = lastViewedAt || new Date(Date.now() - 24 * 60 * 60 * 1000);

  const allNotifications = [
    ...bookings.map(b => ({ id: b.id, type: "booking" as const, date: b.created_at, data: b })),
    ...cancellations.map(c => ({ id: c.id, type: "cancellation" as const, date: c.cancelled_at, data: c })),
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

      {/* Reschedule Requests */}
      {rescheduleRequests.length > 0 && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2 px-3 pt-3">
            <CardTitle className="text-base flex items-center gap-2 text-primary">
              <Timer className="w-4 h-4" />
              {language === "ru" ? "Запросы на перенос" : "Ауыстыру сұраныстары"} ({rescheduleRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {rescheduleRequests.map((request) => {
                const isNew = new Date(request.created_at) > compareDate;
                return (
                  <div key={request.id} className={`p-3 transition-colors ${isNew ? "bg-primary/5" : ""}`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="p-1.5 rounded-full flex-shrink-0 bg-primary/10 text-primary">
                          <Timer className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-foreground truncate">{request.user_name}</span>
                            {isNew && <Badge variant="default" className="text-[10px] px-1.5 py-0">{language === "ru" ? "Новое" : "Жаңа"}</Badge>}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="pl-8 space-y-2">
                      <p className="text-xs text-muted-foreground">
                        {language === "ru" ? "просит перенести" : "ауыстыруды сұрайды"}: <span className="font-medium text-foreground">{request.product_title}</span>
                      </p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-medium text-orange-500">{request.old_time?.slice(0, 5)}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-medium text-orange-500">{request.new_time?.slice(0, 5)}</span>
                      </div>
                      {((request.reasons && request.reasons.length > 0) || request.comment) && (
                        <div className="p-2 bg-muted/50 rounded text-xs">
                          {request.reasons && request.reasons.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {request.reasons.map((reason, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs px-1.5 py-0">{reason}</Badge>
                              ))}
                            </div>
                          )}
                          {request.comment && <p className="text-muted-foreground mt-1 italic">"{request.comment}"</p>}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Button size="sm" onClick={() => approveReschedule.mutate(request)} disabled={approveReschedule.isPending || rejectReschedule.isPending} className="h-7 text-xs px-2">
                          {approveReschedule.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Check className="w-3.5 h-3.5 mr-1" />{language === "ru" ? "Подтвердить" : "Растау"}</>}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setRejectingRequestId(request.id)} disabled={approveReschedule.isPending || rejectReschedule.isPending} className="h-7 text-xs px-2 text-destructive border-destructive/30">
                          {rejectReschedule.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><X className="w-3.5 h-3.5 mr-1" />{language === "ru" ? "Отклонить" : "Қабылдамау"}</>}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {allNotifications.length === 0 && rescheduleRequests.length === 0 ? (
        <div className="text-center py-12">
          <Bell className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-muted-foreground">{language === "ru" ? "Уведомлений пока нет" : "Хабарландырулар әзірше жоқ"}</p>
          <p className="text-sm text-muted-foreground mt-1">{language === "ru" ? "Здесь будут появляться записи и отмены" : "Мұнда жазбалар мен бас тартулар пайда болады"}</p>
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
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-success" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{booking.user?.name || "—"}</p>
                        {isNew && <Badge variant="default" className="text-xs px-2 py-0.5">{language === "ru" ? "Новое" : "Жаңа"}</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                        {language === "ru" ? "записался на" : "жазылды"} {booking.schedule?.product?.title || booking.schedule?.title}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{booking.time_slot?.date && format(parseISO(booking.time_slot.date), "d MMM", { locale: ru })}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{booking.time_slot?.start_time?.slice(0, 5)}</span>
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
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                      <X className="w-5 h-5 text-destructive" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{cancellation.user_name}</p>
                        {isNew && <Badge variant="destructive" className="text-xs px-2 py-0.5">{language === "ru" ? "Новое" : "Жаңа"}</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                        {language === "ru" ? "отменил запись на" : "жазбасын бас тартты"} {cancellation.product_title}
                      </p>
                      {((cancellation.cancellation_reasons?.length > 0) || cancellation.cancellation_comment) && (
                        <div className="mt-2 p-2 bg-destructive/5 rounded">
                          {cancellation.cancellation_reasons?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {cancellation.cancellation_reasons.map((reason: string, idx: number) => (
                                <Badge key={idx} variant="outline" className="text-xs px-1.5 py-0.5 border-destructive/30 text-destructive">{reason}</Badge>
                              ))}
                            </div>
                          )}
                          {cancellation.cancellation_comment && <p className="text-xs text-muted-foreground mt-1.5 italic">"{cancellation.cancellation_comment}"</p>}
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{cancellation.slot_date && format(parseISO(cancellation.slot_date), "d MMM", { locale: ru })}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{cancellation.slot_time?.slice(0, 5)}</span>
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
      <RejectRescheduleDialog
        isOpen={!!rejectingRequestId}
        onClose={() => setRejectingRequestId(null)}
        onConfirm={(comment) => {
          if (rejectingRequestId) {
            rejectReschedule.mutate({ requestId: rejectingRequestId, comment });
          }
        }}
        isPending={rejectReschedule.isPending}
      />
    </div>
  );
};

export default TeacherNotificationsTab;
