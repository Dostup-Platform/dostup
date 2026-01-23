import { useMemo, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, Calendar, Clock, User, X, Check, ShoppingCart, Loader2, Phone, XCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCreatorProducts } from "@/hooks/useProducts";
import { useCreatorSimpleBookings, useCreatorCancelBooking } from "@/hooks/useSimplePurchases";
import { format, differenceInMinutes, differenceInHours } from "date-fns";
import { ru, kk } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import NotificationPreferences from "@/components/NotificationPreferences";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "KZT",
    minimumFractionDigits: 0,
  }).format(price);
};

interface PendingPurchase {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  product_id: string;
  simple_user_id: string;
  user?: { id: string; name: string; phone: string };
  product?: { id: string; title: string };
}

interface BookingCancellation {
  id: string;
  user_name: string;
  user_phone: string | null;
  product_title: string;
  product_id: string;
  schedule_id: string | null;
  schedule_title: string | null;
  slot_date: string;
  slot_time: string;
  cancelled_at: string;
  cancelled_by: string;
}

interface CreatorNotificationsTabProps {
  creatorName: string;
  lastViewedAt?: Date | null;
}

const CreatorNotificationsTab = ({ creatorName, lastViewedAt }: CreatorNotificationsTabProps) => {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const { data: products } = useCreatorProducts(creatorName);
  const productIds = useMemo(() => products?.map(p => p.id) || [], [products]);
  const { data: bookings, isLoading: bookingsLoading } = useCreatorSimpleBookings(productIds);
  const cancelBooking = useCreatorCancelBooking();

  const dateLocale = language === "kk" ? kk : ru;

  // Получить ID расписаний автора (без teacher_id)
  const { data: authorScheduleIds = [] } = useQuery({
    queryKey: ["creator-author-schedule-ids", productIds],
    queryFn: async () => {
      if (!productIds.length) return [];
      const { data } = await supabase
        .from("schedules")
        .select("id")
        .in("product_id", productIds)
        .is("teacher_id", null);
      return data?.map(s => s.id) || [];
    },
    enabled: productIds.length > 0,
  });

  // Получить отменённые записи - только для расписаний автора
  const { data: cancellations = [], isLoading: cancellationsLoading } = useQuery<BookingCancellation[]>({
    queryKey: ["creator-cancellations", productIds, authorScheduleIds],
    queryFn: async () => {
      if (!productIds.length || !authorScheduleIds.length) return [];

      // Получить отмены где schedule_id принадлежит расписаниям автора
      // или schedule_id отсутствует (старые записи) - для них фильтруем по названию
      const { data: allCancellations } = await supabase
        .from("booking_cancellations")
        .select("*")
        .in("product_id", productIds)
        .eq("cancelled_by", "student")
        .order("cancelled_at", { ascending: false })
        .limit(100);

      if (!allCancellations?.length) return [];

      // Получаем названия расписаний автора для fallback фильтрации старых записей
      const { data: authorSchedules } = await supabase
        .from("schedules")
        .select("id, title")
        .in("id", authorScheduleIds);

      const authorScheduleTitles = new Set(authorSchedules?.map(s => s.title) || []);

      // Фильтруем: 
      // 1. Если есть schedule_id - проверяем что он в списке расписаний автора
      // 2. Если нет schedule_id (старые записи) - проверяем по названию
      const filtered = (allCancellations as BookingCancellation[]).filter(c => {
        if (c.schedule_id) {
          return authorScheduleIds.includes(c.schedule_id);
        }
        // Fallback для старых записей без schedule_id
        return c.schedule_title && authorScheduleTitles.has(c.schedule_title);
      });

      return (filtered.slice(0, 50) || []) as BookingCancellation[];
    },
    enabled: productIds.length > 0 && authorScheduleIds.length > 0,
  });

  // Realtime подписка для обновления отменённых записей
  // ВАЖНО: только для расписаний автора (где teacher_id = null)
  useEffect(() => {
    if (!productIds.length || !authorScheduleIds.length) return;

    const channel = supabase
      .channel("creator-cancellations-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "booking_cancellations",
        },
        (payload) => {
          const newCancellation = payload.new as BookingCancellation;
          
          // Проверяем: отмена должна быть от студента И для расписания автора
          if (newCancellation.cancelled_by !== "student") {
            console.log("Cancellation not by student, ignoring for creator");
            return;
          }
          
          // Проверяем что schedule_id принадлежит автору (не учителю)
          if (newCancellation.schedule_id && !authorScheduleIds.includes(newCancellation.schedule_id)) {
            console.log("Cancellation is for teacher's schedule, not notifying creator");
            return;
          }
          
          // Только если это расписание автора - обновляем
          queryClient.invalidateQueries({ queryKey: ["creator-cancellations"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [productIds, authorScheduleIds, queryClient]);

  // Получить ожидающие покупки
  const { data: pendingPurchases = [], isLoading: purchasesLoading } = useQuery<PendingPurchase[]>({
    queryKey: ["creator-pending-purchases", productIds],
    queryFn: async () => {
      if (!productIds.length) return [];

      const { data: purchases } = await supabase
        .from("simple_purchases")
        .select(`
          id,
          amount,
          status,
          created_at,
          product_id,
          simple_user_id
        `)
        .in("product_id", productIds)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (!purchases?.length) return [];

      // Fetch user details
      const userIds = [...new Set(purchases.map(p => p.simple_user_id))];
      const { data: users } = await supabase
        .from("simple_users")
        .select("id, name, phone")
        .in("id", userIds);

      return purchases.map(purchase => ({
        ...purchase,
        user: users?.find(u => u.id === purchase.simple_user_id),
        product: products?.find(p => p.id === purchase.product_id)
      }));
    },
    enabled: productIds.length > 0,
  });

  // Мутация для подтверждения покупки
  const confirmPurchase = useMutation({
    mutationFn: async (purchaseId: string) => {
      const { error } = await supabase
        .from("simple_purchases")
        .update({ 
          status: "completed",
          confirmed_at: new Date().toISOString()
        })
        .eq("id", purchaseId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-pending-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["creator-pending-purchases-count"] });
      queryClient.invalidateQueries({ queryKey: ["creator-purchases"] });
      toast.success(t("paymentConfirmed") || "Оплата подтверждена!");
    },
    onError: () => {
      toast.error("Ошибка при подтверждении");
    },
  });

  const handleCancelBooking = async (bookingId: string) => {
    try {
      await cancelBooking.mutateAsync(bookingId);
      toast.success(t("bookingCancelledCreator"));
    } catch (error) {
      toast.error(t("cancelFailed"));
    }
  };

  // Sort bookings by created_at (newest first)
  const sortedBookings = useMemo(() => {
    if (!bookings) return [];
    return [...bookings].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [bookings]);

  // Check if item is new - use lastViewedAt if available, otherwise 24 hours
  const isNew = (createdAt: string) => {
    const created = new Date(createdAt);
    if (lastViewedAt) {
      return created > lastViewedAt;
    }
    // Fallback: show as new if within last 24 hours
    const now = new Date();
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

  const isLoading = bookingsLoading || purchasesLoading || cancellationsLoading;

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

  const hasNotifications = sortedBookings.length > 0 || pendingPurchases.length > 0 || cancellations.length > 0;

  if (!hasNotifications) {
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

  // Get creator phone for preferences (using creatorName)
  const creatorPhone = `creator_${creatorName}`;

  return (
    <div className="space-y-4">
      {/* Notification Preferences */}
      <NotificationPreferences userPhone={creatorPhone} />

      {/* Pending Purchases Section */}
      {pendingPurchases.length > 0 && (
        <Card className="border-warning/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-warning">
              <ShoppingCart className="w-5 h-5" />
              {t("pendingPayments")} ({pendingPurchases.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {pendingPurchases.map((purchase) => {
                const isNewPurchase = isNew(purchase.created_at);

                return (
                  <div 
                    key={purchase.id} 
                    className={`p-4 transition-colors ${isNewPurchase ? "bg-warning/5" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-full flex-shrink-0 bg-warning/10 text-warning">
                        <ShoppingCart className="w-4 h-4" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground">
                            {purchase.user?.name || t("student")}
                          </span>
                          <span className="text-muted-foreground">
                            {language === "ru" ? "хочет купить" : "сатып алғысы келеді"}
                          </span>
                          {isNewPurchase && (
                            <Badge variant="default" className="text-xs bg-warning text-warning-foreground">
                              {t("new")}
                            </Badge>
                          )}
                        </div>
                        
                        <p className="text-sm text-muted-foreground mt-1 truncate">
                          {purchase.product?.title}
                        </p>
                        
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {formatPrice(Number(purchase.amount))}
                          </span>
                          {purchase.user?.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="w-3.5 h-3.5" />
                              <span>{purchase.user.phone}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                          {getTimeAgo(purchase.created_at)}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => confirmPurchase.mutate(purchase.id)}
                          disabled={confirmPurchase.isPending}
                          className="h-8"
                        >
                          {confirmPurchase.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Check className="w-4 h-4 mr-1" />
                              {t("confirmPayment")}
                            </>
                          )}
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

      {/* Bookings Section */}
      {sortedBookings.length > 0 && (
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
                const isNewBooking = isNew(booking.created_at);
                const timeSlot = booking.time_slot;
                const schedule = booking.schedule;
                const product = booking.product;
                const user = booking.user;

                return (
                  <div 
                    key={booking.id} 
                    className={`p-4 transition-colors ${isNewBooking ? "bg-primary/5" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-full flex-shrink-0 ${isNewBooking ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
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
                          {isNewBooking && (
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
                              <Phone className="w-3.5 h-3.5" />
                              <span>{user.phone}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                          {getTimeAgo(booking.created_at)}
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("cancelBookingCreator")}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t("confirmCancelBooking")}
                                <div className="mt-3 p-3 bg-muted rounded-lg">
                                  <p className="font-medium">{user?.name}</p>
                                  <p className="text-sm">{product?.title}</p>
                                  {timeSlot && (
                                    <p className="text-sm text-muted-foreground">
                                      {format(new Date(timeSlot.date), "d MMMM", { locale: dateLocale })} в {timeSlot.start_time?.slice(0, 5)}
                                    </p>
                                  )}
                                </div>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleCancelBooking(booking.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                {t("cancelBookingCreator")}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cancellations Section */}
      {cancellations.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-destructive">
              <XCircle className="w-5 h-5" />
              {t("cancelledBookings")} ({cancellations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {cancellations.map((cancellation) => {
                const isNewCancellation = isNew(cancellation.cancelled_at);

                return (
                  <div 
                    key={cancellation.id} 
                    className={`p-4 transition-colors ${isNewCancellation ? "bg-destructive/5" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-full flex-shrink-0 bg-destructive/10 text-destructive">
                        <XCircle className="w-4 h-4" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground">
                            {cancellation.user_name || t("student")}
                          </span>
                          <span className="text-muted-foreground">
                            {t("cancelledSession")}
                          </span>
                          {isNewCancellation && (
                            <Badge variant="destructive" className="text-xs">
                              {t("new")}
                            </Badge>
                          )}
                        </div>
                        
                        <p className="text-sm text-muted-foreground mt-1 truncate">
                          {cancellation.product_title}
                        </p>
                        
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>
                              {format(new Date(cancellation.slot_date), "d MMM", { locale: dateLocale })}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>
                              {cancellation.slot_time?.slice(0, 5)}
                            </span>
                          </div>
                          {cancellation.user_phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="w-3.5 h-3.5" />
                              <span>{cancellation.user_phone}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {getTimeAgo(cancellation.cancelled_at)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CreatorNotificationsTab;
