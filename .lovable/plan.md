

# Диалог причины при отклонении + уведомления ученику

## Что нужно сделать

### 1. Создать компонент `RejectRescheduleDialog`
Новый файл `src/components/RejectRescheduleDialog.tsx` — диалог с выбором причины (RadioGroup: "Не могу перенести" / "Своя причина" + Textarea), аналогично `RescheduleSlotDialog`. При подтверждении возвращает `{ reasonType, comment }`.

### 2. Обновить `CreatorNotificationsTab.tsx`
- Добавить state для открытия диалога и хранения `requestId` для отклонения
- Изменить мутацию `rejectReschedule` — принимать `{ requestId, comment }` вместо просто `requestId`, записывать `response_comment` из диалога
- Кнопка "Отклонить" теперь открывает диалог, а не вызывает мутацию напрямую

### 3. Обновить `TeacherNotificationsTab.tsx`
Аналогичные изменения — диалог причины при отклонении.

### 4. Добавить отклонённые запросы в `NotificationsTab.tsx` (раздел уведомлений ученика)
- Добавить запрос `reschedule_requests` с `status = "rejected"` для текущего ученика
- Добавить тип `RescheduleRejection` в `NotificationItem`
- Отображать карточку с иконкой, названием продукта, причиной отклонения и временем
- Подписаться на realtime UPDATE `reschedule_requests` для обновления списка

### 5. Обновить счётчик бейджа в `Dashboard.tsx`
- Добавить запрос rejected reschedule_requests для подсчёта
- Включить в `newNotificationsCount`

### 6. Обновить `useRealtimeStudentNotifications.ts`
- Добавить `invalidateQueries` для нового query key `student-rejected-reschedules` и `student-rejected-reschedules-count` при UPDATE `reschedule_requests`

Тосты, пуш и бейдж уже работают через существующий обработчик UPDATE `reschedule_requests` в `useRealtimeStudentNotifications` и edge function `notify-reschedule-response`. Причина будет передаваться через поле `response_comment`, которое уже включается в push-уведомление.

## Технические детали

**RejectRescheduleDialog props:**
```typescript
interface RejectRescheduleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (comment: string) => void;
  isPending?: boolean;
}
```

**Мутация reject (обновлённая):**
```typescript
mutationFn: async ({ requestId, comment }: { requestId: string; comment: string }) => {
  await supabase.from("reschedule_requests").update({
    status: "rejected",
    response_comment: comment,
    responded_at: new Date().toISOString(),
  }).eq("id", requestId);
}
```

**NotificationsTab — новый запрос:**
```typescript
const { data: rejectedReschedules = [] } = useQuery({
  queryKey: ["student-rejected-reschedules", user?.id],
  queryFn: async () => {
    const { data } = await supabase
      .from("reschedule_requests")
      .select("id, product_title, old_date, old_time, new_date, new_time, response_comment, responded_at")
      .eq("simple_user_id", user.id)
      .eq("status", "rejected")
      .order("responded_at", { ascending: false })
      .limit(50);
    return data || [];
  },
});
```

Итого: 1 новый файл, 4 изменённых файла. Без миграций БД — поле `response_comment` уже существует.

