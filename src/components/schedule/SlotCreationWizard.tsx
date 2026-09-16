import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronLeft, ChevronRight, Check, Clock, Repeat, Settings, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface SlotCreationWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: "ru" | "kk";
  onCreateSlots: (params: {
    timeIntervals: { start: string; end: string }[];
    repeatDays: number[];
    repeatWeekly: boolean;
    repeatPeriod: "2weeks" | "1month" | "2months" | "custom" | null;
    repeatUntil: string | null;
    slotDuration: number;
    maxParticipants: number;
    title?: string;
    description?: string;
    imageUrl?: string;
  }) => void;
  isPending?: boolean;
}

export default function SlotCreationWizard({
  open,
  onOpenChange,
  language,
  onCreateSlots,
  isPending,
}: SlotCreationWizardProps) {
  const [step, setStep] = useState(1);

  // Step 1 State
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [lastClickedCell, setLastClickedCell] = useState<string | null>(null);
  const [showAllHours, setShowAllHours] = useState(false);
  const [workingHours, setWorkingHours] = useState({ start: "08:00", end: "23:59" });

  // Step 2 State
  const [repeatDays, setRepeatDays] = useState<number[]>([new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]);
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [repeatPeriod, setRepeatPeriod] = useState<"2weeks" | "1month" | "2months" | "custom" | null>(null);
  const [repeatUntil, setRepeatUntil] = useState<string>("");

  // Step 3 State
  const [slotDuration, setSlotDuration] = useState<number>(60);
  const [customSlotDuration, setCustomSlotDuration] = useState<string>("");
  const [maxParticipants, setMaxParticipants] = useState<number>(1);
  const [customMaxParticipants, setCustomMaxParticipants] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Reset state on open
  useEffect(() => {
    if (open) {
      setStep(1);
      setSelectedCells(new Set());
      setLastClickedCell(null);
      setShowAllHours(false);
      setWorkingHours({ start: "08:00", end: "23:59" });
      setRepeatDays([new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]);
      setRepeatWeekly(false);
      setRepeatPeriod(null);
      setRepeatUntil("");
      setSlotDuration(60);
      setCustomSlotDuration("");
      setMaxParticipants(1);
      setCustomMaxParticipants("");
      setTitle("");
      setDescription("");
      setImageUrl("");
      setDetailsOpen(false);
    }
  }, [open]);

  const dict = {
    ru: {
      step1: "Выбор времени",
      step2: "Повторение",
      step3: "Настройки",
      showOtherHours: "Показать остальные часы",
      hideOtherHours: "Скрыть остальные часы",
      timeRange: "Диапазон времени",
      start: "Начало",
      end: "Конец",
      save: "Сохранить",
      weekDays: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
      everyWeek: "Каждую неделю",
      twoWeeks: "2 недели",
      oneMonth: "1 месяц",
      twoMonths: "2 месяца",
      custom: "Свой",
      lessonDuration: "Длительность урока",
      min: "мин",
      participants: "Максимум участников",
      individual: "Индивидуально",
      group: "Группа",
      details: "Детали",
      title: "Название",
      description: "Описание",
      imageUrl: "Ссылка на изображение",
      ready: "Готово",
      time: "Время",
      repeat: "Повторение",
      settings: "Настройки",
      close: "Закрыть",
    },
    kk: {
      step1: "Уақытты таңдау",
      step2: "Қайталау",
      step3: "Баптаулар",
      showOtherHours: "Қалған сағаттарды көрсету",
      hideOtherHours: "Қалған сағаттарды жасыру",
      timeRange: "Уақыт аралығы",
      start: "Басталуы",
      end: "Аяқталуы",
      save: "Сақтау",
      weekDays: ["Дс", "Сс", "Ср", "Бс", "Жм", "Сн", "Жс"],
      everyWeek: "Әр апта сайын",
      twoWeeks: "2 апта",
      oneMonth: "1 ай",
      twoMonths: "2 ай",
      custom: "Өз",
      lessonDuration: "Сабақ ұзақтығы",
      min: "мин",
      participants: "Қатысушылар саны",
      individual: "Жеке",
      group: "Топ",
      details: "Мәліметтер",
      title: "Атауы",
      description: "Сипаттамасы",
      imageUrl: "Сурет сілтемесі",
      ready: "Дайын",
      time: "Уақыт",
      repeat: "Қайталау",
      settings: "Баптаулар",
      close: "Жабу",
    }
  };

  const t = dict[language];

  // Logic for Time Grid
  const generateHours = () => {
    const hours = [];
    const startHour = showAllHours ? 0 : parseInt(workingHours.start.split(":")[0], 10);
    let endHour = showAllHours ? 23 : parseInt(workingHours.end.split(":")[0], 10);
    
    // Safety bounds
    const safeStart = Math.max(0, Math.min(23, isNaN(startHour) ? 8 : startHour));
    const safeEnd = Math.max(0, Math.min(23, isNaN(endHour) ? 23 : endHour));

    for (let i = safeStart; i <= safeEnd; i++) {
      hours.push(i.toString().padStart(2, "0"));
    }
    return hours;
  };

  const hoursList = useMemo(generateHours, [showAllHours, workingHours]);
  const quarters = ["00", "15", "30", "45"];

  const getCellId = (hour: string, quarter: string) => `${hour}:${quarter}`;

  const allCells = useMemo(() => {
    const cells: string[] = [];
    for (let h = 0; h < 24; h++) {
      const hs = h.toString().padStart(2, "0");
      for (const q of quarters) {
        cells.push(`${hs}:${q}`);
      }
    }
    return cells;
  }, []);

  const handleCellClick = (cellId: string) => {
    setSelectedCells(prev => {
      const next = new Set(prev);
      if (next.has(cellId)) {
        next.delete(cellId);
        setLastClickedCell(cellId);
      } else {
        if (lastClickedCell && !prev.has(lastClickedCell)) {
            // Fill between
            const currentIndex = allCells.indexOf(cellId);
            const lastIndex = allCells.indexOf(lastClickedCell);
            if (currentIndex !== -1 && lastIndex !== -1) {
                const start = Math.min(currentIndex, lastIndex);
                const end = Math.max(currentIndex, lastIndex);
                for (let i = start; i <= end; i++) {
                    next.add(allCells[i]);
                }
            } else {
                next.add(cellId);
            }
        } else {
            next.add(cellId);
        }
        setLastClickedCell(cellId);
      }
      return next;
    });
  };

  const formatSelectedIntervals = () => {
    if (selectedCells.size === 0) return [];
    const sortedCells = Array.from(selectedCells).sort((a, b) => {
        const [ah, am] = a.split(":").map(Number);
        const [bh, bm] = b.split(":").map(Number);
        return ah !== bh ? ah - bh : am - bm;
    });

    const intervals: {start: string, end: string}[] = [];
    let currentStart = sortedCells[0];
    let currentEnd = sortedCells[0];

    const add15Min = (time: string) => {
        let [h, m] = time.split(":").map(Number);
        m += 15;
        if (m >= 60) {
            h += 1;
            m -= 60;
        }
        return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
    };

    for (let i = 1; i < sortedCells.length; i++) {
        const expectedNext = add15Min(currentEnd);
        if (sortedCells[i] === expectedNext) {
            currentEnd = sortedCells[i];
        } else {
            intervals.push({ start: currentStart, end: add15Min(currentEnd) });
            currentStart = sortedCells[i];
            currentEnd = sortedCells[i];
        }
    }
    intervals.push({ start: currentStart, end: add15Min(currentEnd) });
    return intervals;
  };


  const handleReady = () => {
    onCreateSlots({
      timeIntervals: formatSelectedIntervals(),
      repeatDays,
      repeatWeekly,
      repeatPeriod: repeatWeekly ? repeatPeriod : null,
      repeatUntil: repeatWeekly && repeatPeriod === "custom" ? repeatUntil : null,
      slotDuration,
      maxParticipants,
      title: title || undefined,
      description: description || undefined,
      imageUrl: imageUrl || undefined,
    });
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-full h-full max-h-full m-0 p-0 rounded-none sm:rounded-none flex flex-col bg-background overflow-hidden border-0 gap-0">
        <VisuallyHidden>
            <DialogTitle>Slot Creation</DialogTitle>
        </VisuallyHidden>
        
        {/* Header */}
        <header className="flex-none flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
             <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                <X className="w-5 h-5" />
             </Button>
             <h2 className="text-lg font-semibold">
               {step === 1 ? t.step1 : step === 2 ? t.step2 : t.step3} ({step}/3)
             </h2>
          </div>
          {step === 1 && (
             <Popover>
               <PopoverTrigger asChild>
                 <Button variant="outline" size="sm" className="hidden sm:flex items-center gap-2">
                   <Clock className="w-4 h-4" />
                   {t.timeRange}
                 </Button>
               </PopoverTrigger>
               <PopoverContent className="w-64" align="end">
                 <div className="space-y-4">
                   <h4 className="font-medium leading-none">{t.timeRange}</h4>
                   <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                       <Label htmlFor="start">{t.start}</Label>
                       <Input id="start" type="time" value={workingHours.start} onChange={(e) => setWorkingHours({...workingHours, start: e.target.value})} />
                     </div>
                     <div className="space-y-2">
                       <Label htmlFor="end">{t.end}</Label>
                       <Input id="end" type="time" value={workingHours.end} onChange={(e) => setWorkingHours({...workingHours, end: e.target.value})} />
                     </div>
                   </div>
                 </div>
               </PopoverContent>
             </Popover>
          )}
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-32">
          <div className="max-w-2xl mx-auto">
            {step === 1 && (
              <div className="space-y-6">
                <div className="flex justify-between items-center sm:hidden">
                    <span className="text-sm text-muted-foreground">{t.timeRange}</span>
                    <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" size="sm">
                        <Settings className="w-4 h-4" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64" align="end">
                        <div className="space-y-4">
                        <h4 className="font-medium leading-none">{t.timeRange}</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                            <Label htmlFor="start-mob">{t.start}</Label>
                            <Input id="start-mob" type="time" value={workingHours.start} onChange={(e) => setWorkingHours({...workingHours, start: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                            <Label htmlFor="end-mob">{t.end}</Label>
                            <Input id="end-mob" type="time" value={workingHours.end} onChange={(e) => setWorkingHours({...workingHours, end: e.target.value})} />
                            </div>
                        </div>
                        </div>
                    </PopoverContent>
                    </Popover>
                </div>

                <div className="flex flex-col gap-2">
                  {hoursList.map(hour => (
                    <div key={hour} className="flex items-center gap-2 sm:gap-4">
                      <div className="w-12 text-right text-sm text-muted-foreground select-none">
                        {hour}:00
                      </div>
                      <div className="flex-1 grid grid-cols-4 gap-1">
                        {quarters.map(q => {
                          const cellId = getCellId(hour, q);
                          const isSelected = selectedCells.has(cellId);
                          return (
                            <div
                              key={cellId}
                              onPointerDown={() => handleCellClick(cellId)}
                              onPointerEnter={(e) => {
                                  if (e.buttons === 1) {
                                    handleCellClick(cellId);
                                  }
                              }}
                              className={cn(
                                "h-12 rounded-md border flex items-center justify-center cursor-pointer select-none transition-colors touch-none text-xs sm:text-sm",
                                isSelected
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-muted/30 hover:bg-muted/60 border-border"
                              )}
                            >
                              {q}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-center pt-4">
                  <Button variant="ghost" onClick={() => setShowAllHours(!showAllHours)}>
                    {showAllHours ? t.hideOtherHours : t.showOtherHours}
                  </Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-8 animate-in slide-in-from-right-4">
                <div className="bg-muted/30 p-4 rounded-lg">
                   <h3 className="text-sm font-medium text-muted-foreground mb-2">{t.timeRange}:</h3>
                   <div className="flex flex-wrap gap-2">
                       {formatSelectedIntervals().length > 0 ? formatSelectedIntervals().map((interval, i) => (
                           <Badge key={i} variant="secondary" className="text-base">
                               {interval.start} - {interval.end}
                           </Badge>
                       )) : (
                           <span className="text-sm">-</span>
                       )}
                   </div>
                </div>

                <div className="space-y-4">
                  <Label className="text-base">{t.weekDays}</Label>
                  <div className="flex flex-wrap gap-2">
                    {t.weekDays.map((day, index) => {
                      const isSelected = repeatDays.includes(index);
                      return (
                        <Button
                          key={index}
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          className={cn("w-12 h-12 rounded-full", isSelected && "bg-primary text-primary-foreground")}
                          onClick={() => {
                            if (isSelected && repeatDays.length > 1) {
                              setRepeatDays(repeatDays.filter(d => d !== index));
                            } else if (!isSelected) {
                              setRepeatDays([...repeatDays, index].sort());
                            }
                          }}
                        >
                          {day}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <Label className="text-base" htmlFor="repeat">{t.everyWeek}</Label>
                    <Switch id="repeat" checked={repeatWeekly} onCheckedChange={setRepeatWeekly} />
                  </div>

                  {repeatWeekly && (
                    <div className="space-y-4 pt-4 animate-in fade-in zoom-in-95">
                      <div className="flex flex-wrap gap-2">
                        {(["2weeks", "1month", "2months", "custom"] as const).map((period) => (
                          <Button
                            key={period}
                            type="button"
                            variant={repeatPeriod === period ? "default" : "outline"}
                            onClick={() => setRepeatPeriod(period)}
                            className={cn(repeatPeriod === period && "bg-primary text-primary-foreground")}
                          >
                            {period === "2weeks" ? t.twoWeeks :
                             period === "1month" ? t.oneMonth :
                             period === "2months" ? t.twoMonths : t.custom}
                          </Button>
                        ))}
                      </div>

                      {repeatPeriod === "custom" && (
                        <div className="space-y-2 max-w-xs">
                           <Input 
                             type="date" 
                             value={repeatUntil}
                             onChange={(e) => setRepeatUntil(e.target.value)}
                           />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-8 animate-in slide-in-from-right-4">
                 <div className="space-y-4">
                   <Label className="text-base">{t.lessonDuration}</Label>
                   <div className="flex flex-wrap gap-2">
                     {[45, 50, 60, 90].map(dur => (
                         <Button
                           key={dur}
                           type="button"
                           variant={slotDuration === dur ? "default" : "outline"}
                           onClick={() => setSlotDuration(dur)}
                           className={cn(slotDuration === dur && "bg-primary text-primary-foreground")}
                         >
                           {dur} {t.min}
                         </Button>
                     ))}
                     <div className="flex items-center gap-2 max-w-[120px]">
                        <Input 
                          type="number"
                          placeholder={t.custom}
                          value={customSlotDuration}
                          onChange={(e) => {
                              setCustomSlotDuration(e.target.value);
                              if (e.target.value) setSlotDuration(Number(e.target.value));
                          }}
                        />
                     </div>
                   </div>
                 </div>

                 <div className="space-y-4">
                   <Label className="text-base">{t.participants}</Label>
                   <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant={maxParticipants === 1 ? "default" : "outline"}
                        onClick={() => setMaxParticipants(1)}
                        className={cn(maxParticipants === 1 && "bg-primary text-primary-foreground")}
                      >
                        1 ({t.individual})
                      </Button>
                      <Button
                        type="button"
                        variant={maxParticipants === 5 ? "default" : "outline"}
                        onClick={() => setMaxParticipants(5)}
                        className={cn(maxParticipants === 5 && "bg-primary text-primary-foreground")}
                      >
                        5 ({t.group})
                      </Button>
                      <Button
                        type="button"
                        variant={maxParticipants === 10 ? "default" : "outline"}
                        onClick={() => setMaxParticipants(10)}
                        className={cn(maxParticipants === 10 && "bg-primary text-primary-foreground")}
                      >
                        10 ({t.group})
                      </Button>
                      <div className="flex items-center gap-2 max-w-[120px]">
                        <Input 
                          type="number"
                          placeholder={t.custom}
                          value={customMaxParticipants}
                          onChange={(e) => {
                              setCustomMaxParticipants(e.target.value);
                              if (e.target.value) setMaxParticipants(Number(e.target.value));
                          }}
                        />
                     </div>
                   </div>
                 </div>

                 <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen} className="border rounded-lg p-4">
                    <CollapsibleTrigger asChild>
                       <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                          <span className="text-base font-semibold">{t.details}</span>
                          <ChevronDown className={cn("w-5 h-5 transition-transform", detailsOpen && "rotate-180")} />
                       </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-4 pt-4">
                       <div className="space-y-2">
                           <Label htmlFor="title">{t.title}</Label>
                           <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
                       </div>
                       <div className="space-y-2">
                           <Label htmlFor="desc">{t.description}</Label>
                           <Input id="desc" value={description} onChange={(e) => setDescription(e.target.value)} />
                       </div>
                       <div className="space-y-2">
                           <Label htmlFor="imgUrl">{t.imageUrl}</Label>
                           <Input id="imgUrl" type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
                       </div>
                    </CollapsibleContent>
                 </Collapsible>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t shadow-[0_-2px_10px_rgba(0,0,0,0.05)] z-10 pb-8 sm:pb-4">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            
            <div className="w-16">
              {step > 1 && (
                <Button variant="ghost" size="icon" onClick={() => setStep(step - 1)}>
                  <ChevronLeft className="w-6 h-6" />
                </Button>
              )}
            </div>

            <div className="flex flex-col items-center gap-2 flex-1">
               <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", step >= 1 ? "bg-primary" : "bg-muted")} />
                  <div className={cn("w-8 h-[2px]", step >= 2 ? "bg-primary" : "bg-muted")} />
                  <div className={cn("w-2 h-2 rounded-full", step >= 2 ? "bg-primary" : "bg-muted")} />
                  <div className={cn("w-8 h-[2px]", step >= 3 ? "bg-primary" : "bg-muted")} />
                  <div className={cn("w-2 h-2 rounded-full", step >= 3 ? "bg-primary" : "bg-muted")} />
               </div>
               <div className="flex justify-between w-[140px] text-[10px] text-muted-foreground uppercase font-medium">
                  <span className={cn(step >= 1 && "text-foreground")}>{t.time}</span>
                  <span className={cn(step >= 2 && "text-foreground")}>{t.repeat}</span>
                  <span className={cn(step >= 3 && "text-foreground")}>{t.settings}</span>
               </div>
            </div>

            <div className="w-16 flex justify-end">
              {step < 3 && (
                <Button variant="ghost" size="icon" onClick={() => setStep(step + 1)}>
                  <ChevronRight className="w-6 h-6" />
                </Button>
              )}
            </div>
            
          </div>
          
          <div className="max-w-2xl mx-auto mt-4">
             <Button 
               size="lg" 
               className="w-full text-base font-semibold" 
               onClick={handleReady}
               disabled={isPending || (step === 1 && selectedCells.size === 0)}
             >
               {isPending ? "..." : t.ready}
             </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
