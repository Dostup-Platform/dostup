

# Два изменения: время по умолчанию + улучшение доставки пуш-уведомлений

## Проблема 1: Время по умолчанию при планировании

Сейчас при включении "Запланировать открытие доступа" автоматически ставится время через 30 минут. Нужно ставить текущее время.

**Что менять:**
- `src/components/creator/ProductMaterialsManager.tsx` -- в двух местах (форма добавления, строка ~539, и форма редактирования, строка ~633) убрать `now.setMinutes(now.getMinutes() + 30)`, чтобы ставилось текущее время.

## Проблема 2: Пуш-уведомление не приходит на iPhone

По логам сервер отправил FCM сообщение успешно -- Google его принял. Токен ученика зарегистрирован и актуален (iPhone, iOS 18.7). Значит проблема где-то между Google и устройством.

Что можно улучшить с нашей стороны:

1. **Полный URL в `fcm_options.link`** -- сейчас стоит `"/"`, но iOS PWA требует полный URL (`https://dostup.lovable.app/dashboard`). Относительный путь может не работать на iOS.

2. **Добавить `tag` в webpush notification** -- чтобы iOS правильно группировал/показывал уведомления, а не игнорировал как дубликат.

3. **Убрать `vibrate`** -- iOS не поддерживает vibrate для web push, это может вызывать ошибки.

4. **Добавить `tag` в Service Worker** -- при показе background-уведомления тоже использовать tag для корректного отображения.

**Что менять:**
- `supabase/functions/unlock-materials/index.ts` -- исправить webpush payload (полный URL, tag, убрать vibrate)
- `public/firebase-messaging-sw.js` -- добавить tag при отображении уведомлений

---

## Технические детали

### ProductMaterialsManager.tsx (2 места)

Заменить `now.setMinutes(now.getMinutes() + 30)` на просто использование текущего времени `new Date()` без добавления 30 минут -- в обоих формах (добавление и редактирование).

### unlock-materials/index.ts

Изменить webpush payload:

```text
webpush: {
  notification: {
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: `material_unlock_${productId}`,
    requireInteraction: true
  },
  fcm_options: { link: "https://dostup.lovable.app/dashboard" }
}
```

### firebase-messaging-sw.js

Убедиться что background-уведомления показываются с правильным tag для iOS.

