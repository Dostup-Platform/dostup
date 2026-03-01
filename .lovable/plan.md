

# Fix: Default end time and auto-calculation

## Problem
The default `endTime` is `18:00` (representing a full work day), but the user expects it to be `startTime + slotDuration` (e.g., `09:00` → `10:00`). The auto-calculation onChange handler was added correctly, but the initial default doesn't match this logic.

## Changes

### File 1: `src/components/creator/CreatorScheduleTab.tsx`
- Change default `endTime` from `"18:00"` to `"10:00"` (line 124) — so initial state is 09:00-10:00 (1 hour)

### File 2: `src/components/teacher/TeacherScheduleTab.tsx`
- Same change: default `endTime` from `"18:00"` to `"10:00"` (line 124)

The onChange handler from the previous edit already handles recalculating endTime when startTime changes. The only issue was the initial default value.

