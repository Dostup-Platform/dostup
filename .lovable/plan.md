

# Вернуть белый цвет точки при выборе + опустить точку ниже

## Изменения (3 файла, одинаковый паттерн)

### 1. `src/components/creator/CreatorScheduleTab.tsx`
- Строка 769: вернуть `if (isSelected) return "bg-primary-foreground";` перед switch
- Строка 790: заменить `top-0` на `top-1` — опустить точку между верхним краем и текстом дня

### 2. `src/components/teacher/TeacherScheduleTab.tsx`
- Аналогично: вернуть проверку `isSelected` в `getDotColor` и заменить `top-0` на `top-1`

### 3. `src/components/dashboard/ScheduleTab.tsx`
- Аналогично: вернуть проверку `isSameDay(day, selectedDate)` в `getDotColor` и заменить `top-1` на `top-1.5` (у студента чуть другой отступ)

