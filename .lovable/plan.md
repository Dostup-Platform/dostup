

# Fix: Orange indicator appears immediately after sending reschedule request

## Problem
After sending a reschedule request, the orange indicator doesn't appear immediately because the `onSuccess` handlers don't invalidate the right query keys.

## Fix — 2 files

### 1. `src/hooks/useSimplePurchases.ts` (line 765-772)
The `useCreatorRescheduleRequest` mutation's `onSuccess` invalidates `creator-reschedule-requests` and `teacher-reschedule-requests` (incoming from students), but NOT `creator-outgoing-reschedules` or `teacher-outgoing-reschedules` (the queries that power the orange indicator).

Add two lines:
```typescript
queryClient.invalidateQueries({ queryKey: ["creator-outgoing-reschedules"] });
queryClient.invalidateQueries({ queryKey: ["teacher-outgoing-reschedules"] });
```

### 2. `src/components/dashboard/ScheduleTab.tsx` (line 195-199)
The student's `rescheduleRequest` mutation's `onSuccess` only invalidates `student-pending-reschedules`. Need to also invalidate the student's own outgoing indicator:
```typescript
queryClient.invalidateQueries({ queryKey: ["student-pending-reschedules"] });
queryClient.invalidateQueries({ queryKey: ["student-incoming-reschedules"] });
queryClient.invalidateQueries({ queryKey: ["student-incoming-reschedules-count"] });
```

