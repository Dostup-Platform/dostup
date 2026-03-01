

# Перенос времени слота с уведомлением ученика

## Что нужно сделать

Добавить возможность для автора/учителя изменить время забронированного слота. Перед изменением — запросить причину (аналогично отмене). Ученик получает уведомление (toast + push) о переносе. Бронирование НЕ отменяется.

## Технические изменения

### 1. Новая таблица `booking_reschedules` (миграция)
Для хранения истории переносов и доставки уведомлений ученику через Realtime:
- `id`, `booking_id`, `simple_user_id`, `schedule_id`, `product_id`
- `product_title`, `old_date`, `old_time`, `new_date`, `new_time`
- `rescheduled_by` (creator/teacher), `reasons text[]`, `comment text`
- `created_at`
- Включить Realtime для этой таблицы
- RLS: разрешить всё (аналогично booking_cancellations)

### 2. UI — Кнопка "Перенести" в `CreatorScheduleTab.tsx` и `TeacherScheduleTab.tsx`
Рядом с кнопками ссылки/удаления для слотов, у которых есть бронирования, добавить кнопку с иконкой `Clock` для переноса. По клику:
1. Открывается **RescheduleDialog** — новый компонент
2. В диалоге: новая дата (input date), новое время начала и конца (input time, 24ч), причина (выбор из 2 вариантов: "Не успеваю" / "Своя причина" + textarea)
3. При подтверждении: обновляется `time_slots` (date, start_time, end_time), создаётся запись в `booking_reschedules`

### 3. Новый компонент `RescheduleSlotDialog.tsx`
- Props: `isOpen, onClose, onConfirm, slot (date, start_time, end_time), isPending`
- Поля: новая дата, новое время начала, окончания
- Причина: радиокнопки "Не успеваю" / "Своя причина" с textarea
- Кнопка подтверждения "Перенести"

### 4. Мутация `useRescheduleSlot` в `useSimplePurchases.ts`
- Обновляет `time_slots` (date, start_time, end_time)
- Получает данные бронирований для этого слота
- Вставляет запись в `booking_reschedules` для каждого ученика
- Инвалидирует кеши слотов и бронирований

### 5. Realtime-уведомление ученику в `useRealtimeStudentNotifications.ts`
- Подписка на INSERT в `booking_reschedules` по `simple_user_id = userId`
- Показать toast: "Урок перенесён — Автор/Учитель перенёс ваш урок ... с {old_date} {old_time} на {new_date} {new_time}. Причина: ..."
- Обновить badge, инвалидировать `simple-bookings` и `simple-time-slots`

### 6. Push-уведомление — новая Edge Function `notify-reschedule`
- Триггер на INSERT в `booking_reschedules` → вызов Edge Function
- Отправка FCM ученику с текстом о переносе и причиной
- Аналогично `notify-booking-change` для отмен

### 7. Переводы в `translations.ts`
Добавить ключи: `reschedule`, `rescheduleLesson`, `cantMakeIt`, `ownReason`, `lessonRescheduled`

