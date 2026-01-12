import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { demoSchedules, generateDemoTimeSlots, demoBookings } from "@/lib/demo-data";
import { Calendar, Clock, Users, User, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { format, addDays, isSameDay, parseISO, startOfDay } from "date-fns";

const ScheduleTab = () => {
  const schedules = demoSchedules;
  const timeSlots = useMemo(() => generateDemoTimeSlots(), []);
  const [bookings, setBookings] = useState(demoBookings);
  const [selectedDate, setSelectedDate] = useState(addDays(new Date(), 1));
  const [selectedSchedule, setSelectedSchedule] = useState<string | null>(null);

  // Get next 7 days
  const days = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i + 1));

  // Filter slots for selected schedule and date
  const filteredSlots = timeSlots.filter(
    (slot) =>
      slot.schedule_id === selectedSchedule &&
      isSameDay(parseISO(slot.start_time), selectedDate)
  );

  const handleBookSlot = (slotId: string) => {
    const newBooking = {
      id: `booking-${Date.now()}`,
      user_id: "user-1",
      time_slot_id: slotId,
      schedule_id: selectedSchedule!,
      status: "confirmed" as const,
      created_at: new Date().toISOString(),
    };
    setBookings([...bookings, newBooking]);
  };

  const isSlotBooked = (slotId: string) => {
    return bookings.some((b) => b.time_slot_id === slotId && b.status === "confirmed");
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">Schedule Sessions</h2>

      {/* Schedule Type Selection */}
      <div className="grid grid-cols-2 gap-3">
        {schedules.map((schedule) => (
          <button
            key={schedule.id}
            onClick={() => setSelectedSchedule(schedule.id)}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              selectedSchedule === schedule.id
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {schedule.type === "group" ? (
                <Users className="w-5 h-5 text-primary" />
              ) : (
                <User className="w-5 h-5 text-primary" />
              )}
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {schedule.type}
              </span>
            </div>
            <h3 className="font-medium text-foreground text-sm">{schedule.title}</h3>
            {schedule.capacity && (
              <p className="text-xs text-muted-foreground mt-1">
                Up to {schedule.capacity} participants
              </p>
            )}
          </button>
        ))}
      </div>

      {selectedSchedule && (
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
            <div className="grid grid-cols-2 gap-2">
              {filteredSlots.map((slot) => {
                const booked = isSlotBooked(slot.id);
                const available = slot.is_available && !booked;
                
                return (
                  <button
                    key={slot.id}
                    onClick={() => available && handleBookSlot(slot.id)}
                    disabled={!available}
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
                        {format(parseISO(slot.start_time), "h:mm a")}
                      </span>
                      {booked && <Check className="w-4 h-4 ml-auto" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {filteredSlots.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No slots available for this date
              </p>
            )}
          </div>
        </>
      )}

      {!selectedSchedule && (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-muted-foreground">Select a session type to view available times</p>
        </div>
      )}
    </div>
  );
};

export default ScheduleTab;
