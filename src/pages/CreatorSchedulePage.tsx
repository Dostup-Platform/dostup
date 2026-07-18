import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ArrowLeft, Plus, Trash2, Calendar, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  useProductSchedules,
  useScheduleSlots,
  useSlotBookings,
  useCreateSchedule,
  useDeleteSchedule,
  useCreateSlot,
  useDeleteSlot,
} from "@/hooks/useSchedule";

const fmtDate = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
};
const fmtTime = (t: string) => t.slice(0, 5);

const CreateScheduleDialog = ({ productId }: { productId: string }) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"group" | "individual">("individual");
  const [maxP, setMaxP] = useState("");
  const create = useCreateSchedule();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />Новое расписание</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Создать расписание</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Название</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: Speaking club" /></div>
          <div>
            <Label>Тип</Label>
            <Select value={type} onValueChange={(v) => setType(v as "group" | "individual")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">Индивидуально</SelectItem>
                <SelectItem value="group">Группа</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {type === "group" && (
            <div><Label>Мест по умолчанию</Label><Input type="number" min="1" value={maxP} onChange={(e) => setMaxP(e.target.value)} /></div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
          <Button disabled={!title.trim() || create.isPending} onClick={async () => {
            try {
              await create.mutateAsync({
                product_id: productId,
                title: title.trim(),
                event_type: type,
                max_participants: type === "group" && maxP ? Number(maxP) : type === "individual" ? 1 : null,
              });
              toast.success("Расписание создано");
              setOpen(false); setTitle(""); setMaxP("");
            } catch (e) { toast.error((e as Error).message); }
          }}>Создать</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const AddSlotDialog = ({ scheduleId }: { scheduleId: string }) => {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [maxP, setMaxP] = useState("");
  const [link, setLink] = useState("");
  const create = useCreateSlot();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="w-4 h-4 mr-1" />Слот</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Добавить занятие</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Дата</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Начало</Label><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div><Label>Конец</Label><Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          </div>
          <div><Label>Мест (опционально)</Label><Input type="number" min="1" value={maxP} onChange={(e) => setMaxP(e.target.value)} placeholder="Оставьте пустым для значения из расписания" /></div>
          <div><Label>Ссылка на встречу (опционально)</Label><Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
          <Button disabled={!date || !start || !end || create.isPending} onClick={async () => {
            try {
              await create.mutateAsync({
                schedule_id: scheduleId,
                date, start_time: start, end_time: end,
                max_participants: maxP ? Number(maxP) : null,
                lesson_link: link.trim() || null,
              });
              toast.success("Занятие добавлено");
              setOpen(false); setDate(""); setStart(""); setEnd(""); setMaxP(""); setLink("");
            } catch (e) { toast.error((e as Error).message); }
          }}>Добавить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const CreatorSchedulePage = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const { data: product } = useQuery({
    queryKey: ["product-owner", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id,title,owner_id").eq("id", productId!).maybeSingle();
      return data;
    },
  });

  const { data: schedules = [], isLoading: sLoading } = useProductSchedules(productId);
  const scheduleIds = useMemo(() => schedules.map((s) => s.id), [schedules]);
  const { data: slots = [] } = useScheduleSlots(scheduleIds);
  const { data: allBookings = [] } = useSlotBookings(scheduleIds);
  const deleteSchedule = useDeleteSchedule();
  const deleteSlot = useDeleteSlot();

  if (loading || sLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }
  if (!user) { navigate("/auth"); return null; }
  if (product && product.owner_id !== user.id) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Нет доступа</div>;
  }

  const countsBySlot = new Map<string, number>();
  allBookings.forEach((b) => countsBySlot.set(b.time_slot_id, (countsBySlot.get(b.time_slot_id) ?? 0) + 1));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button asChild variant="ghost" size="sm"><Link to="/dashboard"><ArrowLeft className="w-4 h-4" /></Link></Button>
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{product?.title ?? "Расписание"}</div>
            <div className="text-xs text-muted-foreground">Управление расписанием</div>
          </div>
          {productId && <CreateScheduleDialog productId={productId} />}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {schedules.length === 0 && (
          <Card><CardContent className="py-8 text-center text-muted-foreground">Нет расписаний. Создайте первое.</CardContent></Card>
        )}

        {schedules.map((sch) => {
          const own = slots.filter((s) => s.schedule_id === sch.id);
          return (
            <Card key={sch.id}>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="w-5 h-5" />
                  {sch.title}
                  <Badge variant="outline">{sch.event_type === "group" ? `Группа${sch.max_participants ? ` · ${sch.max_participants}` : ""}` : "Индивидуально"}</Badge>
                </CardTitle>
                <div className="flex gap-2">
                  <AddSlotDialog scheduleId={sch.id} />
                  <Button size="icon" variant="ghost" onClick={async () => {
                    if (!confirm("Удалить расписание и все его слоты?")) return;
                    try { await deleteSchedule.mutateAsync(sch.id); toast.success("Удалено"); }
                    catch (e) { toast.error((e as Error).message); }
                  }}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {own.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Слоты не добавлены.</p>
                ) : (
                  own.map((slot) => {
                    const cap = slot.max_participants ?? sch.max_participants ?? (sch.event_type === "individual" ? 1 : null);
                    const count = countsBySlot.get(slot.id) ?? 0;
                    return (
                      <div key={slot.id} className="flex items-center gap-3 p-2 border rounded-lg text-sm">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{fmtDate(slot.date)} · {fmtTime(slot.start_time)}–{fmtTime(slot.end_time)}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <Users className="w-3 h-3" />{count}{cap !== null ? `/${cap}` : ""}
                            {slot.lesson_link && <span className="truncate">· ссылка</span>}
                          </div>
                        </div>
                        <Button size="icon" variant="ghost" onClick={async () => {
                          if (!confirm("Удалить слот? Все записи будут удалены.")) return;
                          try { await deleteSlot.mutateAsync(slot.id); toast.success("Удалено"); }
                          catch (e) { toast.error((e as Error).message); }
                        }}><Trash2 className="w-4 h-4" /></Button>
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

export default CreatorSchedulePage;