

# Авто-установка времени окончания при изменении начала

## Что сейчас
При создании слотов в форме время начала рабочего дня по умолчанию 09:00, окончания 18:00. При изменении времени начала — время окончания не обновляется.

## Что нужно
При изменении времени начала (`startTime`) в форме создания слотов — автоматически подставлять `endTime = startTime + slotDuration` (по умолчанию 60 минут). Пользователь сможет вручную поменять время окончания.

## Изменения

### Файл 1: `src/components/creator/CreatorScheduleTab.tsx`
- В обработчике `onChange` поля `startTime` (~строка 1119) — при изменении значения автоматически вычислять `endTime` как `startTime + slotDuration` минут и обновлять оба поля в `slotsForm`

### Файл 2: `src/components/teacher/TeacherScheduleTab.tsx`
- Аналогичное изменение в обработчике `onChange` поля `startTime` (~строка 1171)

### Логика
```typescript
// При изменении startTime:
const addMinutes = (time, mins) => {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total/60)%24).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`;
};

onChange={(e) => setSlotsForm({
  ...slotsForm,
  startTime: e.target.value,
  endTime: addMinutes(e.target.value, Number(slotsForm.slotDuration))
})}
```

Два файла, минимальное изменение в каждом.

