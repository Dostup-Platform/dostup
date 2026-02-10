

# Исправление пуш-уведомлений и PWA

## Проблема 1: Пуш-уведомления не приходят

У студента "Чингиз Хайрулла" пустое поле `phone` в базе данных. Из-за этого:
- При входе в приложение система НЕ регистрирует FCM-токен (потому что проверяет `phone` и видит пустую строку)
- При разблокировке материала серверная функция ищет токены по `phone`, не находит совпадений и пропускает отправку

**Решение**: Исправить студента с пустым `phone` в базе + изменить логику так, чтобы push-токены привязывались к `user_id`, а не к `phone`. Это надёжнее, потому что `id` всегда есть.

### Шаги:
1. **Миграция БД**: Добавить столбец `user_id` в таблицу `push_tokens` + обновить существующие записи по совпадению `user_phone`
2. **Исправить данные**: Присвоить `phone` студенту "Чингиз Хайрулла" (у которого пустое поле)
3. **`useFCMRegistration`**: Передавать `userId` вместо `phone`, регистрировать токен даже если `phone` пустой
4. **`src/lib/firebase.ts` (`registerPushToken`)**: Сохранять `userId` при регистрации токена
5. **`manage-push-token` edge function**: Принимать `userId` и сохранять его в `push_tokens`
6. **`unlock-materials` edge function**: Искать push-токены через `user_id` (JOIN purchases -> push_tokens напрямую по user_id), минуя `phone` полностью
7. **`send-push-notification` edge function**: Поддержать поиск токенов и по `userId`

## Проблема 2: PWA показывает "not found" и чёрный экран

PWA кэширует старую версию приложения. Когда маршруты или код обновляются, кэш устаревает.

### Шаги:
1. **`vite.config.ts`**: Добавить `skipWaiting: true` и `clientsClaim: true` в настройки Workbox, чтобы новый service worker активировался сразу
2. **Увеличить `navigateFallbackDenylist`**: Убедиться что Firebase SW не конфликтует с Workbox SW
3. **`main.tsx`**: Добавить принудительную перезагрузку при обнаружении ошибки загрузки (стратегия "если не загрузилось -- очистить кэш и перезагрузить")

## Технические детали

### Новый столбец в push_tokens
```text
push_tokens
  + user_id UUID (nullable, indexed)
  
  INDEX: idx_push_tokens_user_id ON push_tokens(user_id)
```

### Изменённый поток поиска токенов в unlock-materials
```text
simple_purchases (product_id, status=completed)
  -> simple_user_id
  -> push_tokens WHERE user_id = simple_user_id
  -> fcm_token -> send notification
```

Больше не зависит от поля `phone` вообще.

### Файлы для изменения
- **Новая миграция SQL**: добавить `user_id` в `push_tokens`, индекс, обновить существующие записи, присвоить phone пустому студенту
- **`supabase/functions/manage-push-token/index.ts`**: сохранять `userId` в `push_tokens`
- **`supabase/functions/unlock-materials/index.ts`**: искать токены по `user_id` через JOIN
- **`supabase/functions/send-push-notification/index.ts`**: поддержать поиск по `userId`
- **`src/lib/firebase.ts`**: передавать `userId` при регистрации
- **`src/hooks/useFCMRegistration.ts`**: принимать `userId`, не зависеть от `phone`
- **`src/pages/Dashboard.tsx`**: передавать `user.id` в `useFCMRegistration`
- **`vite.config.ts`**: добавить `skipWaiting` и `clientsClaim`
- **`src/main.tsx`**: добавить обработку ошибок загрузки для PWA

