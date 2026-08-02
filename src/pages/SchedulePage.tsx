import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ArrowLeft, Calendar, Video, X, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  useProductSchedules,
  useScheduleSlots,
  useMyBookings,
  useSlotBookings,
  useCreateBooking,
  useCancelBooking,
  type Booking,
  type Schedule,
  type TimeSlot,
} from "@/hooks/useSchedule";
import { useMyPendingRescheduleRequests } from "@/hooks/useReschedule";
import {
  RescheduleLessonDialog,
  PendingRescheduleBadge,
} from "@/components/RescheduleLessonDialog";

const fmtDate = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
};
const fmtTime = (t: string) => t.slice(0, 5);

const SchedulePage = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [rescheduleTarget, setRescheduleTarget] = useState<{
    booking: Booking;
    slot: TimeSlot;
    schedule: Schedule;
  } | null>(null);

  const { data: product } = useQuery({
    queryKey: ["product-lite", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id,title").eq("id", productId!).maybeSingle();
      return data;
    },
  });

  const { data: schedules = [], isLoading: sLoading } = useProductSchedules(productId);
  const scheduleIds = useMemo(() => schedules.map((s) => s.id), [schedules]);
  const { data: slots = [] } = useScheduleSlots(scheduleIds);
  const { data: myBookings = [] } = useMyBookings(user?.id, scheduleIds);
  const { data: allBookings = [] } = useSlotBookings(scheduleIds);
  const bookingIds = useMemo(() => myBookings.map((b) => b.id), [myBookings]);
  const { data: pendingReschedules = [] } = useMyPendingRescheduleRequests(user?.id, bookingIds);

  const createBooking = useCreateBooking();
  const cancelBooking = useCancelBooking();

  if (authLoading || sLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }
  if (!user) { navigate("/auth"); return null; }

  const bookedByMe = new Set(myBookings.map((b) => b.time_slot_id));
  const bookingBySlot = new Map(myBookings.map((b) => [b.time_slot_id, b]));
  const pendingByBooking = new Set(pendingReschedules.map((r) => r.booking_id));
  const countsBySlot = new Map<string, number>();
  allBookings.forEach((b) => countsBySlot.set(b.time_slot_id, (countsBySlot.get(b.time_slot_id) ?? 0) + 1));
  const scheduleById = new Map(schedules.map((s) => [s.id, s]));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button asChild variant="ghost" size="sm"><Link to="/dashboard"><ArrowLeft className="w-4 h-4" /></Link></Button>
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{product?.title ?? "Расписание"}</div>
            <div className="text-xs text-muted-foreground">Расписание занятий</div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {schedules.length === 0 && (
          <Card><CardContent className="py-8 text-center text-muted-foreground">Расписание пока не создано.</CardContent></Card>
        )}

        {schedules.map((sch) => {
          const own = slots.filter((s) => s.schedule_id === sch.id);
          const upcoming = own.filter((s) => {
            const dt = new Date(`${s.date}T${s.start_time}`);
            return dt.getTime() > Date.now() - 60 * 60 * 1000;
          });
          return (
            <Card key={sch.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  {sch.title}
                  <Badge variant="outline">{sch.event_type === "group" ? "Группа" : "Индивидуально"}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {upcoming.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Нет доступных занятий.</p>
                ) : (
                  upcoming.map((slot) => {
                    const cap = slot.max_participants ?? sch.max_participants ?? (sch.event_type === "individual" ? 1 : null);
                    const count = countsBySlot.get(slot.id) ?? 0;
                    const isBooked = bookedByMe.has(slot.id);
                    const full = cap !== null && count >= cap && !isBooked;
                    const currentBooking = bookingBySlot.get(slot.id);
                    const hasPendingReschedule = currentBooking ? pendingByBooking.has(currentBooking.id) : false;
                    return (
                      <div key={slot.id} className="flex items-center gap-3 p-3 border rounded-lg">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{fmtDate(slot.date)} · {fmtTime(slot.start_time)}–{fmtTime(slot.end_time)}</div>
                          {cap !== null && (
                            <div className="text-xs text-muted-foreground">Занято: {count}/{cap}</div>
                          )}
                          {isBooked && slot.lesson_link && (
                            <a href={slot.lesson_link} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1 mt-1">
                              <Video className="w-3 h-3" />Ссылка на занятие
                            </a>
                          )}
                        </div>
                        {isBooked ? (
                          <div className="flex flex-col items-end gap-1">
                            {hasPendingReschedule && <PendingRescheduleBadge />}
                            <div className="flex gap-1">
                              {!hasPendingReschedule && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => {
                                    const b = currentBooking;
                                    const scheduleItem = scheduleById.get(slot.schedule_id);
                                    if (!b || !scheduleItem) return;
                                    setRescheduleTarget({ booking: b, slot, schedule: scheduleItem });
                                  }}
                                >
                                  <CalendarClock className="w-4 h-4 mr-1" />
                                  Перенести
                                </Button>
                              )}
                              <Button size="sm" variant="outline" onClick={async () => {
                                if (!currentBooking) return;
                                if (!confirm("Отменить запись?")) return;
                                try { await cancelBooking.mutateAsync(currentBooking.id); toast.success("Запись отменена"); }
                                catch (e) { toast.error((e as Error).message); }
                              }}><X className="w-4 h-4 mr-1" />Отменить</Button>
                            </div>
                          </div>
                        ) : (
                          <Button size="sm" disabled={full || !slot.is_available} onClick={async () => {
                            try { await createBooking.mutateAsync({ userId: user.id, slot }); toast.success("Записались"); }
                            catch (e) { toast.error((e as Error).message); }
                          }}>{full ? "Мест нет" : "Записаться"}</Button>
                        )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          );
        })}
      </main>

      {rescheduleTarget && productId && product?.title && user && (
        <RescheduleLessonDialog
          open={!!rescheduleTarget}
          onOpenChange={(open) => {
            if (!open) setRescheduleTarget(null);
          }}
          booking={rescheduleTarget.booking}
          currentSlot={rescheduleTarget.slot}
          schedule={rescheduleTarget.schedule}
          productId={productId}
          productTitle={product.title}
          userId={user.id}
          slots={slots}
          schedules={schedules}
          bookingsCountBySlot={countsBySlot}
        />
      )}
    </div>
  );
};

export default SchedulePage;
