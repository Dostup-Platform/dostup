import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, Calendar, Clock, User } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCreatorProducts } from "@/hooks/useProducts";
import { useCreatorSimpleBookings } from "@/hooks/useSimplePurchases";
import { format, differenceInHours, differenceInMinutes } from "date-fns";
import { ru, kk } from "date-fns/locale";

const CreatorNotificationsTab = () => {
  const { t, language } = useLanguage();
  const { data: products } = useCreatorProducts();
  const productIds = useMemo(() => products?.map(p => p.id) || [], [products]);
  const { data: bookings, isLoading } = useCreatorSimpleBookings(productIds);

  const dateLocale = language === "kk" ? kk : ru;

  // Sort bookings by created_at (newest first)
  const sortedBookings = useMemo(() => {
    if (!bookings) return [];
    return [...bookings].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [bookings]);

  // Check if booking is new (within last 24 hours)
  const isNewBooking = (createdAt: string) => {
    const now = new Date();
    const created = new Date(createdAt);
    return differenceInHours(now, created) <= 24;
  };

  // Get time ago string
  const getTimeAgo = (createdAt: string) => {
    const now = new Date();
    const created = new Date(createdAt);
    const minutesAgo = differenceInMinutes(now, created);
    const hoursAgo = differenceInHours(now, created);
    
    if (minutesAgo < 1) return language === "ru" ? "только что" : "дәл қазір";
    if (minutesAgo < 60) return language === "ru" ? `${minutesAgo} мин назад` : `${minutesAgo} мин бұрын`;
    if (hoursAgo < 24) return language === "ru" ? `${hoursAgo} ч назад` : `${hoursAgo} сағ бұрын`;
    
    const daysAgo = Math.floor(hoursAgo / 24);
    if (daysAgo === 1) return language === "ru" ? "вчера" : "кеше";
    if (daysAgo < 7) return language === "ru" ? `${daysAgo} дн назад` : `${daysAgo} күн бұрын`;
    
    return format(created, "d MMM", { locale: dateLocale });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-16 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!sortedBookings.length) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{t("noNotifications")}</p>
          <p className="text-sm text-muted-foreground mt-1">{t("notificationsWillAppear")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="w-5 h-5" />
            {t("notifications")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {sortedBookings.map((booking) => {
              const isNew = isNewBooking(booking.created_at);
              const timeSlot = booking.time_slot;
              const schedule = booking.schedule;
              const product = booking.product;
              const user = booking.user;

              return (
                <div 
                  key={booking.id} 
                  className={`p-4 transition-colors ${isNew ? "bg-primary/5" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-full ${isNew ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      <Bell className="w-4 h-4" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground">
                          {user?.name || t("student")}
                        </span>
                        <span className="text-muted-foreground">
                          {t("bookedSession")}
                        </span>
                        {isNew && (
                          <Badge variant="default" className="text-xs">
                            {t("new")}
                          </Badge>
                        )}
                      </div>
                      
                      <p className="text-sm text-muted-foreground mt-1 truncate">
                        {product?.title || schedule?.title}
                      </p>
                      
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        {timeSlot && (
                          <>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              <span>
                                {format(new Date(timeSlot.date), "d MMM", { locale: dateLocale })}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              <span>
                                {timeSlot.start_time?.slice(0, 5)}
                              </span>
                            </div>
                          </>
                        )}
                        {user?.phone && (
                          <div className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5" />
                            <span>{user.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {getTimeAgo(booking.created_at)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreatorNotificationsTab;
