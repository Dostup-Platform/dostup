import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Users, User, ChevronLeft, ChevronRight, Bell, Loader2, Phone } from "lucide-react";
import { format, addDays, isSameDay, parseISO, startOfWeek, addWeeks, subWeeks, isToday, differenceInHours } from "date-fns";
import { ru } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCreatorProducts } from "@/hooks/useProducts";
import { useCreatorSimpleBookings } from "@/hooks/useSimplePurchases";

const CreatorScheduleTab = () => {
  const { t } = useLanguage();
  const { data: products, isLoading: productsLoading } = useCreatorProducts();
  const productIds = useMemo(() => products?.map(p => p.id) || [], [products]);
  const { data: bookings, isLoading: bookingsLoading } = useCreatorSimpleBookings(productIds);
  
  const [currentWeek, setCurrentWeek] = useState(new Date());

  const isLoading = productsLoading || bookingsLoading;

  // Get days for current week
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Новые записи (за последние 24 часа)
  const newBookings = useMemo(() => {
    if (!bookings) return [];
    const now = new Date();
    return bookings.filter(b => {
      const createdAt = new Date(b.created_at);
      return differenceInHours(now, createdAt) <= 24;
    });
  }, [bookings]);

  // Записи на сегодня
  const todayBookings = useMemo(() => {
    if (!bookings) return [];
    return bookings.filter(b => {
      if (!b.time_slot?.date) return false;
      return isToday(parseISO(b.time_slot.date));
    });
  }, [bookings]);

  // Предстоящие записи
  const upcomingBookings = useMemo(() => {
    if (!bookings) return [];
    const now = new Date();
    return bookings.filter(b => {
      if (!b.time_slot?.date) return false;
      return parseISO(b.time_slot.date) >= now;
    }).sort((a, b) => {
      const dateA = a.time_slot?.date || "";
      const dateB = b.time_slot?.date || "";
      return dateA.localeCompare(dateB);
    });
  }, [bookings]);

  // Подсчёт записей по дням недели
  const getBookingsForDay = (day: Date) => {
    if (!bookings) return [];
    return bookings.filter(b => {
      if (!b.time_slot?.date) return false;
      return isSameDay(parseISO(b.time_slot.date), day);
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">{t("weeklySchedule")}</h2>

      {/* Уведомления о новых записях */}
      {newBookings.length > 0 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Bell className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{t("newBookings")}</h3>
                <p className="text-sm text-muted-foreground">
                  {newBookings.length} {newBookings.length === 1 ? "новая запись" : "новых записей"} за 24 часа
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {newBookings.slice(0, 3).map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-background border border-border"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                      {booking.schedule?.event_type === "group" ? (
                        <Users className="w-4 h-4 text-green-600" />
                      ) : (
                        <User className="w-4 h-4 text-green-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-sm">{booking.user?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {booking.product?.title} • {booking.time_slot?.date && format(parseISO(booking.time_slot.date), "d MMM", { locale: ru })} в {booking.time_slot?.start_time?.slice(0, 5)}
                      </p>
                    </div>
                  </div>
                  {booking.user?.phone && (
                    <a
                      href={`tel:${booking.user.phone}`}
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Phone className="w-3 h-3" />
                      {booking.user.phone}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Записи на сегодня */}
      {todayBookings.length > 0 && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-4">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-green-600" />
              {t("todayBookings")} ({todayBookings.length})
            </h3>
            <div className="space-y-2">
              {todayBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-background border border-border"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center justify-center min-w-[50px]">
                      <Clock className="w-4 h-4 text-muted-foreground mb-1" />
                      <span className="text-sm font-semibold text-foreground">
                        {booking.time_slot?.start_time?.slice(0, 5)}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-sm">{booking.user?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {booking.schedule?.title}
                      </p>
                    </div>
                  </div>
                  {booking.user?.phone && (
                    <a
                      href={`tel:${booking.user.phone}`}
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Phone className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <span className="font-medium text-foreground">
          {format(weekStart, "d MMM", { locale: ru })} - {format(addDays(weekStart, 6), "d MMM yyyy", { locale: ru })}
        </span>
        <Button variant="ghost" size="icon" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Weekly Calendar */}
      <div className="overflow-x-auto -mx-4 px-4">
        <div className="grid grid-cols-7 gap-2 min-w-[500px]">
          {weekDays.map((day) => {
            const dayBookings = getBookingsForDay(day);
            const isCurrentDay = isToday(day);

            return (
              <div
                key={day.toISOString()}
                className={`text-center p-3 rounded-xl border transition-all ${
                  isCurrentDay 
                    ? "bg-primary/10 border-primary" 
                    : "bg-card border-border"
                }`}
              >
                <div className="text-xs text-muted-foreground">{format(day, "EEE", { locale: ru })}</div>
                <div className={`text-lg font-bold ${isCurrentDay ? "text-primary" : ""}`}>
                  {format(day, "d")}
                </div>
                {dayBookings.length > 0 && (
                  <div className="mt-2 text-xs font-medium text-green-600 bg-green-500/10 rounded-full px-2 py-0.5">
                    {dayBookings.length}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Предстоящие записи */}
      <div className="space-y-3">
        <h3 className="font-medium text-foreground">{t("upcomingBookings")}</h3>
        {upcomingBookings.length > 0 ? (
          upcomingBookings.slice(0, 10).map((booking) => (
            <Card key={booking.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      {booking.schedule?.event_type === "group" ? (
                        <Users className="w-5 h-5 text-primary" />
                      ) : (
                        <User className="w-5 h-5 text-primary" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{booking.user?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {booking.product?.title} • {booking.schedule?.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {booking.time_slot?.date && format(parseISO(booking.time_slot.date), "EEEE, d MMMM", { locale: ru })} в {booking.time_slot?.start_time?.slice(0, 5)}
                      </p>
                    </div>
                  </div>
                  {booking.user?.phone && (
                    <a
                      href={`tel:${booking.user.phone}`}
                      className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      <Phone className="w-4 h-4" />
                      <span className="hidden sm:inline">{booking.user.phone}</span>
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground">{t("noBookings")}</p>
            <p className="text-sm text-muted-foreground mt-1">{t("noBookingsYet")}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreatorScheduleTab;
