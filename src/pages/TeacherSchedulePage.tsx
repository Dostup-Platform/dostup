import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ArrowLeft, Calendar, Users, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  useProductSchedules,
  useScheduleSlots,
  useSlotBookings,
} from "@/hooks/useSchedule";

const fmtDate = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
};
const fmtTime = (t: string) => t.slice(0, 5);

const TeacherSchedulePage = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const { data: product } = useQuery({
    queryKey: ["product-teacher", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id,title").eq("id", productId!).maybeSingle();
      return data;
    },
  });

  const { data: schedules = [], isLoading: sLoading } = useProductSchedules(productId);
  const scheduleIds = useMemo(() => schedules.map((s) => s.id), [schedules]);
  const { data: slots = [] } = useScheduleSlots(scheduleIds);
  const { data: allBookings = [] } = useSlotBookings(scheduleIds);

  const studentIds = useMemo(
    () => Array.from(new Set(allBookings.map((b) => b.user_id))),
    [allBookings],
  );
  const { data: students = [] } = useQuery({
    queryKey: ["teacher-students", studentIds.sort().join(",")],
    enabled: studentIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles")
        .select("user_id,name,display_name,email")
        .in("user_id", studentIds);
      return data ?? [];
    },
  });
  const studentMap = new Map(students.map((s) => [s.user_id, s]));

  if (loading || sLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }
  if (!user) { navigate("/auth"); return null; }

  const bookingsBySlot = new Map<string, typeof allBookings>();
  allBookings.forEach((b) => {
    const arr = bookingsBySlot.get(b.time_slot_id) ?? [];
    arr.push(b);
    bookingsBySlot.set(b.time_slot_id, arr);
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button asChild variant="ghost" size="sm"><Link to="/dashboard"><ArrowLeft className="w-4 h-4" /></Link></Button>
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{product?.title ?? "Расписание"}</div>
            <div className="text-xs text-muted-foreground">Мои занятия</div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {schedules.length === 0 && (
          <Card><CardContent className="py-8 text-center text-muted-foreground">Нет расписаний.</CardContent></Card>
        )}

        {schedules.map((sch) => {
          const own = slots.filter((s) => s.schedule_id === sch.id);
          return (
            <Card key={sch.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="w-5 h-5" />
                  {sch.title}
                  <Badge variant="outline">{sch.event_type === "group" ? `Группа${sch.max_participants ? ` · ${sch.max_participants}` : ""}` : "Индивидуально"}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {own.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Слотов нет.</p>
                ) : (
                  own.map((slot) => {
                    const cap = slot.max_participants ?? sch.max_participants ?? (sch.event_type === "individual" ? 1 : null);
                    const bookings = bookingsBySlot.get(slot.id) ?? [];
                    return (
                      <div key={slot.id} className="p-3 border rounded-lg text-sm space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="font-medium flex-1">
                            {fmtDate(slot.date)} · {fmtTime(slot.start_time)}–{fmtTime(slot.end_time)}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Users className="w-3 h-3" />{bookings.length}{cap !== null ? `/${cap}` : ""}
                          </div>
                          {slot.lesson_link && (
                            <Button asChild size="sm" variant="outline">
                              <a href={slot.lesson_link} target="_blank" rel="noreferrer">
                                <ExternalLink className="w-3 h-3 mr-1" />Ссылка
                              </a>
                            </Button>
                          )}
                        </div>
                        {bookings.length > 0 && (
                          <div className="pl-2 border-l space-y-1">
                            {bookings.map((b) => {
                              const st = studentMap.get(b.user_id);
                              return (
                                <div key={b.id} className="text-xs text-muted-foreground">
                                  {st?.name || st?.display_name || st?.email || b.user_id.slice(0, 8)}
                                </div>
                              );
                            })}
                          </div>
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

export default TeacherSchedulePage;