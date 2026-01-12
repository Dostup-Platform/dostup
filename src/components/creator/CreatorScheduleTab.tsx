import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { demoSchedules, generateDemoTimeSlots, demoUser } from "@/lib/demo-data";
import { Calendar, Clock, Users, User, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { format, addDays, isSameDay, parseISO, startOfWeek, addWeeks, subWeeks } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CreatorScheduleTab = () => {
  const schedules = demoSchedules;
  const timeSlots = useMemo(() => generateDemoTimeSlots(), []);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedView, setSelectedView] = useState<"daily" | "weekly">("weekly");
  const [isCreatingSlot, setIsCreatingSlot] = useState(false);

  // Get days for current week
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Get bookings for display
  const bookedSlots = timeSlots.filter((slot) => !slot.is_available);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Schedule Management</h2>
        <Dialog open={isCreatingSlot} onOpenChange={setIsCreatingSlot}>
          <DialogTrigger asChild>
            <Button variant="default" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Slot
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Time Slot</DialogTitle>
            </DialogHeader>
            <form className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Schedule</Label>
                <Select>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select schedule" />
                  </SelectTrigger>
                  <SelectContent>
                    {schedules.map((schedule) => (
                      <SelectItem key={schedule.id} value={schedule.id}>
                        {schedule.title} ({schedule.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input id="date" type="date" className="h-12" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start">Start Time</Label>
                  <Input id="start" type="time" className="h-12" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end">End Time</Label>
                  <Input id="end" type="time" className="h-12" />
                </div>
              </div>
              <Button type="submit" variant="cta" className="w-full">
                Create Slot
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Schedule Types */}
      <div className="grid grid-cols-2 gap-3">
        {schedules.map((schedule) => (
          <Card key={schedule.id} className="p-4">
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
                Capacity: {schedule.capacity}
              </p>
            )}
          </Card>
        ))}
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <span className="font-medium text-foreground">
          {format(weekStart, "MMM d")} - {format(addDays(weekStart, 6), "MMM d, yyyy")}
        </span>
        <Button variant="ghost" size="icon" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Weekly Calendar */}
      <div className="overflow-x-auto -mx-4 px-4">
        <div className="grid grid-cols-7 gap-2 min-w-[600px]">
          {weekDays.map((day) => {
            const daySlots = timeSlots.filter((slot) =>
              isSameDay(parseISO(slot.start_time), day)
            );
            const bookedCount = daySlots.filter((s) => !s.is_available).length;

            return (
              <div
                key={day.toISOString()}
                className="text-center p-3 rounded-xl bg-card border border-border"
              >
                <div className="text-xs text-muted-foreground">{format(day, "EEE")}</div>
                <div className="text-lg font-bold">{format(day, "d")}</div>
                <div className="mt-2 space-y-1">
                  <div className="text-xs text-muted-foreground">
                    {daySlots.length} slots
                  </div>
                  {bookedCount > 0 && (
                    <div className="text-xs text-success font-medium">
                      {bookedCount} booked
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming Bookings */}
      <div className="space-y-3">
        <h3 className="font-medium text-foreground">Upcoming Bookings</h3>
        {bookedSlots.slice(0, 5).map((slot) => {
          const schedule = schedules.find((s) => s.id === slot.schedule_id);
          return (
            <Card key={slot.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      {schedule?.type === "group" ? (
                        <Users className="w-5 h-5 text-primary" />
                      ) : (
                        <User className="w-5 h-5 text-primary" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{schedule?.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(parseISO(slot.start_time), "EEE, MMM d")} at{" "}
                        {format(parseISO(slot.start_time), "h:mm a")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">{demoUser.name}</p>
                    <p className="text-xs text-muted-foreground">{demoUser.email}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {bookedSlots.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            No bookings yet
          </p>
        )}
      </div>
    </div>
  );
};

export default CreatorScheduleTab;
