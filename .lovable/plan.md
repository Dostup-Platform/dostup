

# Отмена запроса на перенос учеником

## Что делаем

1. **ScheduleTab.tsx** — добавить кнопку "✕" рядом с оранжевым текстом "Ожидание подтверждения переноса на 10:00". По клику удаляем запрос из `reschedule_requests` (DELETE по id, status=pending). Инвалидируем `student-pending-reschedules`.

2. **Realtime у автора (`useRealtimeBookings.ts`)** — добавить подписку на DELETE событие таблицы `reschedule_requests`. При удалении — инвалидировать `creator-reschedule-requests` и `creator-reschedule-requests-count`, чтобы запрос исчез из списка и бейдж обновился.

3. **Realtime у учителя** — нужно найти аналогичный хук для учителя и добавить такую же подписку на DELETE `reschedule_requests`. Инвалидировать соответствующие query keys.

## Технические детали

**ScheduleTab — мутация отмены:**
```typescript
const cancelRescheduleRequest = useMutation({
  mutationFn: async (requestId: string) => {
    const { error } = await supabase
      .from("reschedule_requests")
      .delete()
      .eq("id", requestId)
      .eq("status", "pending");
    if (error) throw error;
  },
  onSuccess: () => {
    toast.success(language === "ru" ? "Запрос отменён" : "Сұраныс болдырмалды");
    queryClient.invalidateQueries({ queryKey: ["student-pending-reschedules"] });
  },
});
```

**ScheduleTab — UI (строки 434-444):** добавить кнопку X рядом с текстом ожидания.

**useRealtimeBookings.ts** — в существующий channel добавить:
```typescript
.on("postgres_changes", { event: "DELETE", schema: "public", table: "reschedule_requests" }, () => {
  queryClient.invalidateQueries({ queryKey: ["creator-reschedule-requests"] });
  queryClient.invalidateQueries({ queryKey: ["creator-reschedule-requests-count"] });
})
```

**Учитель** — аналогичная подписка в хуке realtime учителя (useRealtimeTeacherBookings или похожий).

Итого: 3 файла изменены. Без миграций — DELETE уже разрешён в RLS для `reschedule_requests`.

