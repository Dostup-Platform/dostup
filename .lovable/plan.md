

# Мобильная адаптация сегодняшних изменений

## Проблемные места

1. **Карточка записи ученика (`ScheduleTab.tsx`, строки 362-470)** — метаданные (дата, время, тип, учитель) идут в одну строку `flex gap-3` и вываливаются на мобильном. Кнопки переноса и отмены тоже могут налезать. Текст "Ожидание подтверждения переноса на ..." с кнопкой ✕ может не помещаться.

2. **Диалог запроса на перенос (`StudentRescheduleDialog.tsx`)** — `max-w-md` без `mobileFullScreen`, может обрезаться на маленьких экранах.

3. **Диалог отклонения переноса (`RejectRescheduleDialog.tsx`)** — аналогично, нет полноэкранного режима на мобильных.

4. **Уведомления автора (`CreatorNotificationsTab.tsx`, строки 740-810)** — в секции записей кнопка отмены и "время назад" идут в одну строку справа, на узком экране могут сжимать текст. Секция отмен (строки 830-905) использует `p-4`, `text-base`, `text-sm` — крупновато для мобильных.

5. **Уведомления учителя (`TeacherNotificationsTab.tsx`, строки 340-405)** — карточки записей и отмен используют `p-4`, `w-10 h-10` аватары — нужно сделать компактнее как в creator.

## План изменений

### 1. `ScheduleTab.tsx` — карточка записи ученика
- Метаданные (строки 367-388): заменить `flex items-center gap-3` на `flex flex-wrap items-center gap-x-3 gap-y-1` чтобы переносились на следующую строку
- Карточка: уменьшить padding `p-4` → `p-3` для мобильных

### 2. `StudentRescheduleDialog.tsx`
- Добавить `mobileFullScreen` проп к `DialogContent` (строка 98), чтобы на телефоне открывался на весь экран

### 3. `RejectRescheduleDialog.tsx`
- Добавить `mobileFullScreen` к `DialogContent` (строка 42)

### 4. `CreatorNotificationsTab.tsx` — секция записей
- Строки 740-810: уменьшить padding записей `p-4` → `p-3`, сделать layout более компактным на мобильных
- Строки 830-905 (отмены): уменьшить `p-4` → `p-3`, `text-base` → `text-sm`, `p-2.5` → `p-2` для мобильных, иконку `w-5 h-5` → `w-4 h-4`

### 5. `TeacherNotificationsTab.tsx` — карточки записей и отмен
- Строки 344-365 (записи): `p-4` → `p-3`, `w-10 h-10` → `w-8 h-8`, `text-base` → `text-sm`
- Строки 369-403 (отмены): аналогично — `p-4` → `p-3`, `w-10 h-10` → `w-8 h-8`

## Технические детали

**ScheduleTab метаданные (строка 367):**
```
flex items-center gap-3 → flex flex-wrap items-center gap-x-3 gap-y-1
```

**StudentRescheduleDialog (строка 98):**
```
<DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" mobileFullScreen>
```

**RejectRescheduleDialog (строка 42):**
```
<DialogContent className="max-w-md" mobileFullScreen>
```

**CreatorNotificationsTab записи (строка 742):**
```
p-4 → p-3
```

**CreatorNotificationsTab отмены (строки 833, 836, 842-843):**
```
p-4 → p-3
p-2.5 → p-1.5
w-5 h-5 → w-4 h-4 (иконки)
text-base → text-sm (имя)
```

**TeacherNotificationsTab записи и отмены (строки 344, 346, 351, 369, 372, 377):**
```
p-4 → p-3
w-10 h-10 → w-8 h-8
text-base → text-sm
```

Итого: 5 файлов, без миграций, только CSS-классы.

