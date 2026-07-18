import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ArrowLeft, Calendar, Video, X } from "lucide-react";
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
} from "@/hooks/useSchedule";

const fmtDate = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
};
const fmtTime = (t: string) => t.slice(0, 5);

const SchedulePage = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

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

  const createBooking = useCreateBooking();
  const cancelBooking = useCancelBooking();

  if (authLoading || sLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }
  if (!user) { navigate("/auth"); return null; }

  const bookedByMe = new Set(myBookings.map((b) => b.time_slot_id));
  const bookingBySlot = new Map(myBookings.map((b) => [b.time_slot_id, b]));
  const countsBySlot = new Map<string, number>();
  allBookings.forEach((b) => countsBySlot.set(b.time_slot_id, (countsBySlot.get(b.time_slot_id) ?? 0) + 1));

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
                          <Button size="sm" variant="outline" onClick={async () => {
                            const b = bookingBySlot.get(slot.id);
                            if (!b) return;
                            if (!confirm("Отменить запись?")) return;
                            try { await cancelBooking.mutateAsync(b.id); toast.success("Запись отменена"); }
                            catch (e) { toast.error((e as Error).message); }
                          }}><X className="w-4 h-4 mr-1" />Отменить</Button>
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
    </div>
  );
};

export default SchedulePage;