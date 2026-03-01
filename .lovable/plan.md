
# Исправление: тост на казахском вместо русского

## Проблема
В `ScheduleTab.tsx` строки 82 и 86 используют `t("language") === "ru"` для определения языка. Но `t("language")` возвращает **перевод** слова "language" (например, "Тіл" на казахском), а не код языка `"ru"`. Поэтому условие всегда false и показывается казахский текст.

## Решение

### Файл: `src/components/dashboard/ScheduleTab.tsx`

1. Добавить `language` в деструктуризацию `useLanguage()` (строка 31):
   ```typescript
   const { t, language } = useLanguage();
   ```

2. Заменить `t("language")` на `language` в строках 82 и 86:
   ```typescript
   toast.success(language === "ru" ? "Запрос на перенос отправлен" : "Ауыстыру сұранысы жіберілді");
   // ...
   toast.error(language === "ru" ? "Ошибка при отправке запроса" : "Сұраныс жіберу қатесі");
   ```
