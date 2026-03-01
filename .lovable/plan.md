

# Сделать цветные точки видимыми на мобильных устройствах

## Проблема
На мобильных экранах ячейки 7-колоночной сетки очень узкие. Точка стоит **inline** рядом с текстом дня (например, "пнд •") через `flex + gap-1`, и при ширине ячейки ~45px текст + точка просто не помещаются — точка вытесняется или обрезается.

## Решение
Вынести точку из inline-потока и разместить её **абсолютно сверху по центру** ячейки. Ячейка уже имеет `relative`, поэтому достаточно заменить inline-span на абсолютно позиционированный элемент.

## Изменения (3 файла, одинаковый паттерн)

### 1. `src/components/creator/CreatorScheduleTab.tsx` (строки ~790-795)
Заменить:
```tsx
<div className="text-xs font-medium flex items-center justify-center gap-1">
  {format(day, "EEE", { locale: ru })}
  {hasSlots && (
    <span className={`w-2.5 h-2.5 sm:w-2 sm:h-2 rounded-full ${getDotColor()}`} />
  )}
</div>
```
На:
```tsx
<div className="text-xs font-medium">
  {format(day, "EEE", { locale: ru })}
</div>
{hasSlots && (
  <span className={`absolute top-0.5 right-0.5 w-2 h-2 rounded-full ${getDotColor()}`} />
)}
```

### 2. `src/components/teacher/TeacherScheduleTab.tsx` (строки ~841-846)
Такая же замена.

### 3. `src/components/dashboard/ScheduleTab.tsx` (строки ~475-480)
Такая же замена (с учётом что переменная называется `dayHasSlots`).

## Результат
Точка будет видна всегда — на любой ширине экрана, как маленький индикатор в правом верхнем углу ячейки дня.

