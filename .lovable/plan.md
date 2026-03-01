

# Исправить исчезающие заголовки в материалах учителя

## Проблема
В `TeacherMaterialsTab.tsx` кнопки-заголовки "Мои материалы" и "Материалы автора" используют `variant="ghost"` с `hover:bg-transparent`. Ghost variant добавляет `hover:text-accent-foreground` (белый цвет текста) + `hover:bg-accent` (оранжевый фон). Но `hover:bg-transparent` перезаписывает фон на прозрачный, а текст остается белым — белый текст на белом фоне = невидимый.

## Решение
Убрать `variant="ghost"` и `hover:bg-transparent`, заменив на простую стилизацию без смены цвета текста при наведении.

## Изменение (1 файл)

### `src/components/teacher/TeacherMaterialsTab.tsx`
В двух CollapsibleTrigger (строки ~168 и ~195) заменить:
```
<Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
```
на:
```
<Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent hover:text-foreground">
```

Добавление `hover:text-foreground` перезапишет белый цвет текста из ghost variant, оставив текст видимым.

