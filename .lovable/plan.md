

# Исправить залипание выбора дат при удалении слотов

## Проблема
Баг вызван **stale closure** — классической ошибкой React. При быстром нажатии на кнопки дат, каждый `onClick` использует **старое значение** `slotsToDeleteDates` из момента рендера, а не актуальное. Поэтому при быстром снятии нескольких дат после "Выбрать все" — одни даты не снимаются или снимаются с задержкой.

Текущий код:
```typescript
setSlotsToDeleteDates(slotsToDeleteDates.filter(d => d !== date));
setSlotsToDeleteDates([...slotsToDeleteDates, date]);
```

Нужно заменить на **функциональное обновление состояния**:
```typescript
setSlotsToDeleteDates(prev => prev.filter(d => d !== date));
setSlotsToDeleteDates(prev => [...prev, date]);
```

## Изменения (2 файла)

### 1. `src/components/creator/CreatorScheduleTab.tsx`
Строки ~1285-1290: заменить `onClick` обработчик кнопок дат на функциональное обновление `setSlotsToDeleteDates(prev => ...)`.

### 2. `src/components/teacher/TeacherScheduleTab.tsx`
Строки ~1374-1379: аналогичная замена на `setSlotsToDeleteDates(prev => ...)`.

Оба файла — одинаковое изменение в одном месте каждый.

