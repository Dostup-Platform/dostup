import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronLeft, ChevronRight, Clock, ChevronDown, X, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";

interface SlotCreationWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: "ru" | "kk";
  onCreateSlots: (params: {
    daySlots?: Record<number, { start: string; end: string }[]>;
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

  // Step 1 State: cells format is `${dayIndex}_${hour}:${minute}`, e.g. "0_09:00", "0_09:30"
  // dayIndex: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [showAllHours, setShowAllHours] = useState(false);
  const [workingHours, setWorkingHours] = useState({ start: "08:00", end: "22:00" });

  // Step 2 State
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [repeatPeriod, setRepeatPeriod] = useState<"2weeks" | "1month" | "2months" | "custom" | null>("1month");
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
      setShowAllHours(false);
      setWorkingHours({ start: "08:00", end: "22:00" });
      setRepeatWeekly(false);
      setRepeatPeriod("1month");
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
      showOtherHours: "Показать ранние/ночные часы (00:00 – 08:00)",
      hideOtherHours: "Скрыть ночные часы",
      timeRange: "Диапазон часов",
      timezone: "Часовой пояс",
      start: "С",
      end: "По",
      weekDays: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
      weekDaysFull: ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"],
      everyWeek: "Повторять каждую неделю",
      twoWeeks: "2 недели",
      oneMonth: "1 месяц",
      twoMonths: "2 месяца",
      custom: "Свой срок",
      lessonDuration: "Длительность одного урока",
      min: "мин",
      participants: "Количество участников в слоте",
      individual: "Индивидуально",
      group: "Группа",
      details: "Детали урока (необязательно)",
      title: "Название",
      description: "Описание",
      imageUrl: "Ссылка на обложку",
      ready: "Готово",
      time: "Время",
      repeat: "Повтор",
      settings: "Настройки",
      clearAll: "Очистить всё",
      noSlotsWarning: "Выберите хотя бы одну клетку на сетке времени",
      repeatSummary: "Слоты будут созданы на следующие дни:",
    },
    kk: {
      step1: "Уақытты таңдау",
      step2: "Қайталау",
      step3: "Баптаулар",
      showOtherHours: "Түнгі сағаттарды көрсету (00:00 – 08:00)",
      hideOtherHours: "Түнгі сағаттарды жасыру",
      timeRange: "Сағат аралығы",
      timezone: "Уақыт белдеуі",
      start: "Басталуы",
      end: "Аяқталуы",
      weekDays: ["Дс", "Сс", "Ср", "Бс", "Жм", "Сн", "Жс"],
      weekDaysFull: ["Дүйсенбі", "Сейсенбі", "Сәрсенбі", "Бейсенбі", "Жұма", "Сенбі", "Жексенбі"],
      everyWeek: "Әр апта сайын қайталау",
      twoWeeks: "2 апта",
      oneMonth: "1 ай",
      twoMonths: "2 ай",
      custom: "Өз мерзімі",
      lessonDuration: "Бір сабақтың ұзақтығы",
      min: "мин",
      participants: "Слоттағы қатысушылар саны",
      individual: "Жеке",
      group: "Топ",
      details: "Сабақ туралы мәлімет (міндетті емес)",
      title: "Атауы",
      description: "Сипаттамасы",
      imageUrl: "Мұқаба сілтемесі",
      ready: "Дайын",
      time: "Уақыт",
      repeat: "Қайталау",
      settings: "Баптаулар",
      clearAll: "Тазарту",
      noSlotsWarning: "Кем дегенде бір ұяшықты таңдаңыз",
      repeatSummary: "Слоттар келесі күндерге жасалады:",
    }
  };

  const t = dict[language];

  // Dates for current week (Mon -> Sun)
  const weekDates = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, []);

  // 30-min rows generator
  const timeRows = useMemo(() => {
    const rows: string[] = [];
    const startHour = showAllHours ? 0 : parseInt(workingHours.start.split(":")[0], 10) || 8;
    const endHour = showAllHours ? 23 : parseInt(workingHours.end.split(":")[0], 10) || 22;

    const safeStart = Math.max(0, Math.min(23, startHour));
    const safeEnd = Math.max(0, Math.min(23, endHour));

    for (let h = safeStart; h <= safeEnd; h++) {
      const hh = h.toString().padStart(2, "0");
      rows.push(`${hh}:00`);
      rows.push(`${hh}:30`);
    }
    return rows;
  }, [showAllHours, workingHours]);

  const toggleCell = (cellId: string) => {
    setSelectedCells((prev) => {
      const next = new Set(prev);
      if (next.has(cellId)) {
        next.delete(cellId);
      } else {
        next.add(cellId);
      }
      return next;
    });
  };

  // Group selected 30-min cells into contiguous intervals per day
  const selectedIntervalsByDay = useMemo(() => {
    const byDay: Record<number, { start: string; end: string }[]> = {};

    const add30Min = (time: string) => {
      let [h, m] = time.split(":").map(Number);
      m += 30;
      if (m >= 60) {
        h += 1;
        m -= 60;
      }
      return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
    };

    for (let day = 0; day < 7; day++) {
      const dayTimes = Array.from(selectedCells)
        .filter((id) => id.startsWith(`${day}_`))
        .map((id) => id.split("_")[1])
        .sort((a, b) => {
          const [ah, am] = a.split(":").map(Number);
          const [bh, bm] = b.split(":").map(Number);
          return ah !== bh ? ah - bh : am - bm;
        });

      if (dayTimes.length === 0) continue;

      const intervals: { start: string; end: string }[] = [];
      let curStart = dayTimes[0];
      let curEnd = dayTimes[0];

      for (let i = 1; i < dayTimes.length; i++) {
        if (dayTimes[i] === add30Min(curEnd)) {
          curEnd = dayTimes[i];
        } else {
          intervals.push({ start: curStart, end: add30Min(curEnd) });
          curStart = dayTimes[i];
          curEnd = dayTimes[i];
        }
      }
      intervals.push({ start: curStart, end: add30Min(curEnd) });
      byDay[day] = intervals;
    }

    return byDay;
  }, [selectedCells]);

  const activeDays = useMemo(() => {
    return Object.keys(selectedIntervalsByDay).map(Number);
  }, [selectedIntervalsByDay]);

  const handleReady = () => {
    if (selectedCells.size === 0) return;

    const allIntervals = Object.values(selectedIntervalsByDay).flat();

    onCreateSlots({
      daySlots: selectedIntervalsByDay,
      timeIntervals: allIntervals,
      repeatDays: activeDays,
      repeatWeekly,
      repeatPeriod: repeatWeekly ? repeatPeriod : null,
      repeatUntil: repeatWeekly && repeatPeriod === "custom" ? repeatUntil : null,
      slotDuration,
      maxParticipants,
      title: title.trim() || undefined,
      description: description.trim() || undefined,
      imageUrl: imageUrl.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-full h-full max-h-full m-0 p-0 rounded-none sm:rounded-none flex flex-col bg-background overflow-hidden border-0 gap-0 z-50">
        <VisuallyHidden>
          <DialogTitle>Slot Creation Wizard</DialogTitle>
        </VisuallyHidden>

        {/* Top Header */}
        <header className="flex-none flex items-center justify-between p-3 sm:p-4 border-b bg-card">
          {/* Step Title (left) - without 1/3 badge and without left cross */}
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-foreground">
              {step === 1 ? t.step1 : step === 2 ? t.step2 : t.step3}
            </h2>
          </div>

          {/* Right Controls: Time Range left of Close button */}
          <div className="flex items-center gap-2">
            {step === 1 && (
              <>
                {selectedCells.size > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedCells(new Set())}
                    className="text-xs h-8 text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {t.clearAll}
                  </Button>
                )}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{t.timeRange}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3" align="end">
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold">{t.timeRange}</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">{t.start}</Label>
                          <Input
                            type="time"
                            value={workingHours.start}
                            onChange={(e) => setWorkingHours({ ...workingHours, start: e.target.value })}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">{t.end}</Label>
                          <Input
                            type="time"
                            value={workingHours.end}
                            onChange={(e) => setWorkingHours({ ...workingHours, end: e.target.value })}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </>
            )}

            {/* Close cross separated on far right */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 ml-2 text-muted-foreground hover:text-foreground"
              onClick={() => onOpenChange(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto overflow-x-auto pb-28">
          {/* STEP 1: Google Calendar Week Grid */}
          {step === 1 && (
            <div className="min-w-[650px] max-w-5xl mx-auto p-2 sm:p-4">
              {/* Early hours toggle */}
              <div className="flex justify-end mb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllHours(!showAllHours)}
                  className="h-7 text-xs text-muted-foreground hover:text-primary font-normal"
                >
                  {showAllHours ? t.hideOtherHours : t.showOtherHours}
                </Button>
              </div>

              {/* Weekly Calendar Table */}
              <div className="border border-border/80 rounded-xl overflow-hidden shadow-sm bg-card">
                {/* Header Row: Days of the week */}
                <div className="grid grid-cols-[85px_repeat(7,1fr)] bg-muted/50 border-b border-border">
                  <div className="py-2.5 px-1 text-center text-[11px] font-semibold text-muted-foreground border-r border-border/60 flex items-center justify-center">
                    {t.timezone}
                  </div>
                  {t.weekDays.map((dayName, idx) => {
                    const date = weekDates[idx];
                    const isCur = isSameDay(date, new Date());
                    const countForDay = Array.from(selectedCells).filter((id) => id.startsWith(`${idx}_`)).length;

                    return (
                      <div
                        key={idx}
                        className={cn(
                          "py-2 px-1 text-center border-r last:border-r-0 border-border/60 flex flex-col items-center justify-center transition-colors",
                          countForDay > 0 && "bg-primary/5"
                        )}
                      >
                        <span className="text-[11px] font-semibold text-muted-foreground">{dayName}</span>
                        <div
                          className={cn(
                            "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mt-0.5",
                            isCur
                              ? "bg-primary text-primary-foreground"
                              : countForDay > 0
                              ? "bg-primary/20 text-primary"
                              : "text-foreground"
                          )}
                        >
                          {format(date, "d")}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Time Rows */}
                <div className="divide-y divide-border/40">
                  {timeRows.map((time) => {
                    const isFullHour = time.endsWith(":00");

                    return (
                      <div
                        key={time}
                        className={cn(
                          "grid grid-cols-[85px_repeat(7,1fr)] items-stretch",
                          isFullHour ? "bg-background" : "bg-muted/10"
                        )}
                      >
                        {/* Time Label on left */}
                        <div className="py-1 px-1 text-[11px] font-mono text-muted-foreground text-center border-r border-border/60 flex items-center justify-center select-none">
                          {isFullHour ? (
                            <span className="font-semibold text-foreground">{time}</span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/60">{time}</span>
                          )}
                        </div>

                        {/* 7 Day Cells */}
                        {Array.from({ length: 7 }).map((_, dayIdx) => {
                          const cellId = `${dayIdx}_${time}`;
                          const isSelected = selectedCells.has(cellId);

                          return (
                            <button
                              key={dayIdx}
                              type="button"
                              onClick={() => toggleCell(cellId)}
                              className={cn(
                                "h-8 border-r last:border-r-0 border-border/40 transition-all flex items-center justify-center text-xs select-none",
                                isSelected
                                  ? "bg-primary text-primary-foreground font-semibold shadow-inner"
                                  : "hover:bg-primary/10 active:bg-primary/20"
                              )}
                              title={`${t.weekDaysFull[dayIdx]} ${time}`}
                            >
                              {isSelected && (
                                <span className="text-[10px] tracking-tight">30м</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Repetition */}
          {step === 2 && (
            <div className="max-w-xl mx-auto p-4 sm:p-6 space-y-6 animate-in slide-in-from-right-4">
              <div className="space-y-3">
                <Label className="text-sm font-semibold">{t.repeatSummary}</Label>
                <div className="space-y-2">
                  {activeDays.length === 0 ? (
                    <div className="p-4 border rounded-xl text-center text-sm text-muted-foreground">
                      {t.noSlotsWarning}
                    </div>
                  ) : (
                    activeDays.map((dayIdx) => (
                      <div
                        key={dayIdx}
                        className="flex items-center justify-between p-3 rounded-xl border border-border bg-card shadow-sm"
                      >
                        <div className="flex items-center gap-2.5">
                          <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5">
                            {t.weekDaysFull[dayIdx]}
                          </Badge>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedIntervalsByDay[dayIdx]?.map((interval, i) => (
                              <Badge key={i} variant="secondary" className="text-xs font-mono">
                                {interval.start} – {interval.end}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Weekly repetition toggle */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card">
                  <div>
                    <Label htmlFor="repeat-switch" className="text-sm font-semibold cursor-pointer">
                      {t.everyWeek}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {language === "ru"
                        ? "Автоматически повторять выбранные часы каждую неделю"
                        : "Таңдалған сағаттарды әр апта сайын қайталау"}
                    </p>
                  </div>
                  <Switch id="repeat-switch" checked={repeatWeekly} onCheckedChange={setRepeatWeekly} />
                </div>

                {repeatWeekly && (
                  <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3 animate-in fade-in zoom-in-95">
                    <Label className="text-xs font-semibold">{language === "ru" ? "Срок повторения:" : "Қайталау мерзімі:"}</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(["2weeks", "1month", "2months", "custom"] as const).map((period) => (
                        <Button
                          key={period}
                          type="button"
                          variant={repeatPeriod === period ? "default" : "outline"}
                          size="sm"
                          onClick={() => setRepeatPeriod(period)}
                          className={cn("text-xs", repeatPeriod === period && "bg-primary text-primary-foreground font-semibold")}
                        >
                          {period === "2weeks"
                            ? t.twoWeeks
                            : period === "1month"
                            ? t.oneMonth
                            : period === "2months"
                            ? t.twoMonths
                            : t.custom}
                        </Button>
                      ))}
                    </div>

                    {repeatPeriod === "custom" && (
                      <div className="pt-2 max-w-xs">
                        <Label className="text-xs">{language === "ru" ? "Повторять до даты:" : "Күнге дейін қайталау:"}</Label>
                        <Input
                          type="date"
                          value={repeatUntil}
                          onChange={(e) => setRepeatUntil(e.target.value)}
                          className="h-9 mt-1 text-sm bg-background"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: Settings */}
          {step === 3 && (
            <div className="max-w-xl mx-auto p-4 sm:p-6 space-y-6 animate-in slide-in-from-right-4">
              {/* Duration */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">{t.lessonDuration}</Label>
                <div className="flex flex-wrap gap-2">
                  {[30, 45, 50, 60, 90].map((dur) => (
                    <Button
                      key={dur}
                      type="button"
                      variant={slotDuration === dur ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setSlotDuration(dur);
                        setCustomSlotDuration("");
                      }}
                      className={cn(slotDuration === dur && "bg-primary text-primary-foreground font-semibold")}
                    >
                      {dur} {t.min}
                    </Button>
                  ))}
                  <div className="flex items-center gap-1 max-w-[110px]">
                    <Input
                      type="number"
                      placeholder={t.custom}
                      value={customSlotDuration}
                      className="h-8 text-xs"
                      onChange={(e) => {
                        setCustomSlotDuration(e.target.value);
                        if (e.target.value) setSlotDuration(Number(e.target.value));
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Participants */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">{t.participants}</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={maxParticipants === 1 ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setMaxParticipants(1);
                      setCustomMaxParticipants("");
                    }}
                    className={cn(maxParticipants === 1 && "bg-primary text-primary-foreground font-semibold")}
                  >
                    1 ({t.individual})
                  </Button>
                  <Button
                    type="button"
                    variant={maxParticipants === 5 ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setMaxParticipants(5);
                      setCustomMaxParticipants("");
                    }}
                    className={cn(maxParticipants === 5 && "bg-primary text-primary-foreground font-semibold")}
                  >
                    5 ({t.group})
                  </Button>
                  <Button
                    type="button"
                    variant={maxParticipants === 10 ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setMaxParticipants(10);
                      setCustomMaxParticipants("");
                    }}
                    className={cn(maxParticipants === 10 && "bg-primary text-primary-foreground font-semibold")}
                  >
                    10 ({t.group})
                  </Button>
                  <div className="flex items-center gap-1 max-w-[110px]">
                    <Input
                      type="number"
                      placeholder={t.custom}
                      value={customMaxParticipants}
                      className="h-8 text-xs"
                      onChange={(e) => {
                        setCustomMaxParticipants(e.target.value);
                        if (e.target.value) setMaxParticipants(Number(e.target.value));
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Optional Details Collapsible */}
              <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen} className="border rounded-xl p-4 bg-card shadow-sm">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                    <span className="text-sm font-semibold">{t.details}</span>
                    <ChevronDown className={cn("w-4 h-4 transition-transform", detailsOpen && "rotate-180")} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-3">
                  <div className="space-y-1">
                    <Label htmlFor="wiz-title" className="text-xs">
                      {t.title}
                    </Label>
                    <Input
                      id="wiz-title"
                      value={title}
                      placeholder={language === "ru" ? "Например: Английский для начинающих" : "Сабақ атауы"}
                      onChange={(e) => setTitle(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="wiz-desc" className="text-xs">
                      {t.description}
                    </Label>
                    <Input
                      id="wiz-desc"
                      value={description}
                      placeholder={language === "ru" ? "Краткое описание урока..." : "Сабақ сипаттамасы..."}
                      onChange={(e) => setDescription(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="wiz-img" className="text-xs">
                      {t.imageUrl}
                    </Label>
                    <Input
                      id="wiz-img"
                      type="url"
                      value={imageUrl}
                      placeholder="https://..."
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}
        </div>

        {/* Bottom Navigation Bar */}
        <div className="fixed bottom-0 left-0 right-0 p-3 sm:p-4 bg-card/95 backdrop-blur-sm border-t border-border shadow-[0_-4px_16px_rgba(0,0,0,0.06)] z-20">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
            {/* Left: Back button */}
            <div className="w-16 flex-none flex items-center">
              {step > 1 && (
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => setStep(step - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              )}
            </div>

            {/* Center: Stepper (strictly ends at step 3) + Next button */}
            <div className="flex-1 flex items-center justify-center gap-3">
              <div className="flex items-center justify-center w-full max-w-xs">
                {/* Step 1 */}
                <div className="flex flex-col items-center gap-1 flex-none">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all",
                      step >= 1
                        ? "bg-primary text-primary-foreground ring-4 ring-background shadow-sm"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    1
                  </button>
                  <span
                    className={cn(
                      "text-[10px] tracking-wider uppercase transition-colors select-none",
                      step === 1 ? "text-primary font-bold" : "text-muted-foreground font-medium"
                    )}
                  >
                    {t.time}
                  </span>
                </div>

                {/* Segment 1 -> 2 (strictly stops at step 2) */}
                <div className="flex-1 h-[2px] mx-2 -mt-4 bg-muted overflow-hidden">
                  <div className={cn("h-full bg-primary transition-all duration-300", step >= 2 ? "w-full" : "w-0")} />
                </div>

                {/* Step 2 */}
                <div className="flex flex-col items-center gap-1 flex-none">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedCells.size > 0) setStep(2);
                    }}
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all",
                      step >= 2
                        ? "bg-primary text-primary-foreground ring-4 ring-background shadow-sm"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    2
                  </button>
                  <span
                    className={cn(
                      "text-[10px] tracking-wider uppercase transition-colors select-none",
                      step === 2 ? "text-primary font-bold" : "text-muted-foreground font-medium"
                    )}
                  >
                    {t.repeat}
                  </span>
                </div>

                {/* Segment 2 -> 3 (strictly stops at step 3) */}
                <div className="flex-1 h-[2px] mx-2 -mt-4 bg-muted overflow-hidden">
                  <div className={cn("h-full bg-primary transition-all duration-300", step >= 3 ? "w-full" : "w-0")} />
                </div>

                {/* Step 3 (END OF LINE) */}
                <div className="flex flex-col items-center gap-1 flex-none">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedCells.size > 0) setStep(3);
                    }}
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all",
                      step >= 3
                        ? "bg-primary text-primary-foreground ring-4 ring-background shadow-sm"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    3
                  </button>
                  <span
                    className={cn(
                      "text-[10px] tracking-wider uppercase transition-colors select-none",
                      step === 3 ? "text-primary font-bold" : "text-muted-foreground font-medium"
                    )}
                  >
                    {t.settings}
                  </span>
                </div>
              </div>

              {/* Next arrow right after Step 3 */}
              {step < 3 ? (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-full ml-1 flex-none"
                  onClick={() => setStep(step + 1)}
                  disabled={step === 1 && selectedCells.size === 0}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <div className="w-8 h-8 ml-1 flex-none" />
              )}
            </div>

            {/* Far Right bottom corner: Small Ready button */}
            <div className="w-16 flex-none flex justify-end">
              <Button
                size="sm"
                className="h-8 px-3 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                onClick={handleReady}
                disabled={isPending || selectedCells.size === 0}
              >
                {isPending ? "..." : t.ready}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
