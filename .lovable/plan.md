

## План: убрать утренние напоминания и UI настроек

### Что делаем
1. Убираем компонент `NotificationPreferences` из всех трёх вкладок аккаунта (ученик, учитель, автор)
2. Убираем создание утренних напоминаний из триггера `create_booking_reminders`
3. Убираем обработку утренних напоминаний из edge-функции `send-reminders`
4. Оставляем только 24h и 2h — всегда включены, без выбора

### Изменения

| Файл | Что меняем |
|------|-----------|
| `src/components/dashboard/AccountTab.tsx` | Убираем импорт и рендер `NotificationPreferences` |
| `src/components/creator/CreatorAccountTab.tsx` | Убираем импорт и рендер `NotificationPreferences` |
| `src/components/teacher/TeacherAccountTab.tsx` | Убираем импорт и рендер `NotificationPreferences` |
| `supabase/functions/send-reminders/index.ts` | Убираем блок обработки morning reminders (~строки 57-149) |
| SQL миграция | Обновляем функцию `create_booking_reminders` — убираем все блоки с `reminder_type = 'morning'` и убираем зависимость от `notification_preferences` |

### Триггер `create_booking_reminders` — упрощение

Сейчас триггер читает `notification_preferences` для каждого пользователя. Поскольку настройки убираем и 24h/2h всегда включены, триггер упрощается: всегда создавать 24h и 2h напоминания для ученика, учителя и автора без проверки preferences.

