import { useState, useMemo } from "react";
import { useUserPurchases } from "@/hooks/usePurchases";
import { useSchedules, useTimeSlots, useUserBookings, useCreateBooking } from "@/hooks/useSchedules";
import { Calendar, Clock, Users, User, Check, Loader2 } from "lucide-react";
import { format, addDays, isSameDay, parseISO } from "date-fns";
import { toast } from "sonner";

const ScheduleTab = () => {
  const { data: purchases, isLoading: purchasesLoading } = useUserPurchases();
  const { data: bookings, isLoading: bookingsLoading } = useUserBookings();
  const createBooking = useCreateBooking();
  
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(addDays(new Date(), 1));

  // Get product IDs from purchases
  const productIds = useMemo(() => 
    purchases?.map(p => p.product_id).filter(Boolean) as string[] || [],
    [purchases]
  );

  // Get schedules for the first purchased product (or selected one)
  const activeProductId = selectedProductId || productIds[0];
  const { data: schedules, isLoading: schedulesLoading } = useSchedules(activeProductId);
  
  // Get time slots for selected schedule
  const { data: timeSlots, isLoading: timeSlotsLoading } = useTimeSlots(selectedScheduleId || undefined);

  // Get next 7 days
  const days = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i + 1));

  // Filter slots for selected date
  const filteredSlots = useMemo(() => {
    if (!timeSlots) return [];
    return timeSlots.filter((slot) => 
      isSameDay(parseISO(slot.date), selectedDate)
    );
  }, [timeSlots, selectedDate]);

  const handleBookSlot = async (slotId: string) => {
    if (!selectedScheduleId) return;
    
    try {
      await createBooking.mutateAsync({
        timeSlotId: slotId,
        scheduleId: selectedScheduleId,
      });
      toast.success("Booking confirmed!");
    } catch (error) {
      toast.error("Failed to book slot");
    }
  };

  const isSlotBooked = (slotId: string) => {
    return bookings?.some((b) => b.time_slot_id === slotId && b.status === "confirmed");
  };

  const isLoading = purchasesLoading || schedulesLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!purchases || purchases.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
        <p className="text-muted-foreground">No purchased products with schedules</p>
        <p className="text-sm text-muted-foreground mt-1">
          Purchase a product to access scheduling
        </p>
      </div>
    );
  }

  if (!schedules || schedules.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
        <p className="text-muted-foreground">No schedules available</p>
        <p className="text-sm text-muted-foreground mt-1">
          This product doesn't have scheduling enabled
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">Schedule Sessions</h2>

      {/* Schedule Type Selection */}
      <div className="grid grid-cols-2 gap-3">
        {schedules.map((schedule) => (
          <button
            key={schedule.id}
            onClick={() => setSelectedScheduleId(schedule.id)}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              selectedScheduleId === schedule.id
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {schedule.event_type === "group" ? (
                <Users className="w-5 h-5 text-primary" />
              ) : (
                <User className="w-5 h-5 text-primary" />
              )}
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {schedule.event_type}
              </span>
            </div>
            <h3 className="font-medium text-foreground text-sm">{schedule.title}</h3>
            {schedule.max_participants && (
              <p className="text-xs text-muted-foreground mt-1">
                Up to {schedule.max_participants} participants
              </p>
            )}
          </button>
        ))}
      </div>

      {selectedScheduleId && (
        <>
          {/* Date Selection */}
          <div className="space-y-3">
            <h3 className="font-medium text-foreground">Select Date</h3>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4">
              {days.map((day) => (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={`flex-shrink-0 p-3 rounded-xl text-center min-w-[72px] transition-all ${
                    isSameDay(day, selectedDate)
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border hover:border-primary/50"
                  }`}
                >
                  <div className="text-xs opacity-80">{format(day, "EEE")}</div>
                  <div className="text-lg font-bold">{format(day, "d")}</div>
                  <div className="text-xs opacity-80">{format(day, "MMM")}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Time Slots */}
          <div className="space-y-3">
            <h3 className="font-medium text-foreground">Available Times</h3>
            {timeSlotsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filteredSlots.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {filteredSlots.map((slot) => {
                  const booked = isSlotBooked(slot.id);
                  const available = slot.is_available && !booked;
                  
                  return (
                    <button
                      key={slot.id}
                      onClick={() => available && handleBookSlot(slot.id)}
                      disabled={!available || createBooking.isPending}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        booked
                          ? "bg-success/10 border-success text-success"
                          : available
                          ? "border-border hover:border-primary bg-card"
                          : "border-border bg-muted/50 text-muted-foreground opacity-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span className="font-medium">
                          {slot.start_time.slice(0, 5)}
                        </span>
                        {booked && <Check className="w-4 h-4 ml-auto" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No slots available for this date
              </p>
            )}
          </div>
        </>
      )}

      {!selectedScheduleId && (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-muted-foreground">Select a session type to view available times</p>
        </div>
      )}
    </div>
  );
};

export default ScheduleTab;
