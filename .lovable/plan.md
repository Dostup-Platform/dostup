

# Add outgoing reschedule request indicator for creator and teacher

## Problem
When a creator or teacher sends a reschedule request, there's no visual feedback in their schedule showing that a request is pending. Students see this as an orange "Ожидание подтверждения переноса на 12:00 ✕" indicator, but creators/teachers see nothing.

## Solution — 2 files

### 1. `src/components/creator/CreatorScheduleTab.tsx`
- Add a `useQuery` to fetch pending `reschedule_requests` where `requested_by = "creator"` and `product_id` in creator's productIds
- Add a `useMutation` to cancel (delete) a pending request
- After each booking row (line ~1012-1016), check if there's a pending outgoing request for that booking and show the orange indicator with ✕ button, matching the student's UI exactly

### 2. `src/components/teacher/TeacherScheduleTab.tsx`
- Same as above but with `requested_by = "teacher"`
- Same orange indicator + cancel button after each booking row (line ~1063-1068)

### UI added per booking (when pending request exists)
```
<div className="mt-1 flex items-center gap-2">
  <span className="text-orange-500 text-sm font-medium">
    Ожидание подтверждения переноса на {new_time}
  </span>
  <button className="text-orange-500 hover:text-destructive ...">
    <X />
  </button>
</div>
```

The query matches pending requests to bookings via `booking_id`, and cancellation deletes the request and invalidates the query cache.

