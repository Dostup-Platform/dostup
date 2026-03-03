

# Исправление: ученик не получает уведомления и бейдж о запросах на перенос от автора/учителя

## Проблема

Бейдж уведомлений в Dashboard ученика и список уведомлений в NotificationsTab **не учитывают** входящие запросы на перенос от автора/учителя (`requested_by = "creator"` или `"teacher"`). 

В `Dashboard.tsx` badge считается из 4 источников: отмены, покупки, разблокировки материалов, отклонённые переносы. **Входящие pending запросы от преподавателя не включены**.

В `NotificationsTab.tsx` также отсутствует отображение таких запросов.

Realtime тосты работают (строки 251-279 в `useRealtimeStudentNotifications.ts`), но бейдж и список — нет.

## Решение — 2 файла

### 1. `src/pages/Dashboard.tsx`
Добавить запрос для подсчёта pending reschedule_requests от преподавателя:
```typescript
const { data: incomingReschedules = [] } = useQuery({
  queryKey: ["student-incoming-reschedules-count", user?.id],
  queryFn: async () => {
    if (!user?.id) return [];
    const { data, error } = await supabase
      .from("reschedule_requests")
      .select("id, created_at")
      .eq("simple_user_id", user.id)
      .eq("status", "pending")
      .neq("requested_by", "student")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return data || [];
  },
  enabled: !!user?.id,
});
```
Добавить в подсчёт `newNotificationsCount`:
```typescript
const newIncoming = incomingReschedules.filter(r => new Date(r.created_at) > compareDate).length;
return newCancellations + newPurchases + newUnlocks + newRejections + newIncoming;
```

### 2. `src/components/dashboard/NotificationsTab.tsx`
Добавить запрос для получения pending reschedule_requests от преподавателя и отобразить их в списке уведомлений как карточки "Запрос на перенос от преподавателя" с датой/временем.

