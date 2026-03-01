

# Edit time for unbooked slots

## What to do
Add a button (Clock icon) next to the delete button for slots with **no bookings**, allowing the creator/teacher to change start and end time of that slot. Since nobody is booked, no reason or notification is needed — just a simple time edit dialog.

## Changes

### 1. New component `EditSlotTimeDialog.tsx`
Simple dialog with only two fields: start time and end time (24h format). No date, no reason. Props: `isOpen, onClose, onConfirm, slot, isPending`.

### 2. Mutation for updating slot time
Add `useEditSlotTime` in `useSimplePurchases.ts` — updates `time_slots` (start_time, end_time) by slot id. Invalidates slot caches.

### 3. `CreatorScheduleTab.tsx` — add edit button for unbooked slots
In the `slotBookings.length === 0` branch (line 905), add a Clock button before the Trash button. State: `editingSlotTime`. Wire up the dialog.

### 4. `TeacherScheduleTab.tsx` — same change
Mirror the same button and dialog integration.

### 5. Translations
Add key `editTime` ("Изменить время" / "Уақытты өзгерту").

