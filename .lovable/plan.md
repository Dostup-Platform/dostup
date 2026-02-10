
# Исправление дублирования пуш-уведомлений на телефоне

## Причина

Сервер отправляет **1 FCM-сообщение**, но на устройстве ученика появляется **2 уведомления**:

1. **FCM автоматически** показывает системное уведомление (потому что в payload есть поле `notification`)
2. **Service Worker** в обработчике `onBackgroundMessage` вызывает `self.registration.showNotification()` -- это создает **второе** уведомление

## Решение

Убрать `self.registration.showNotification()` из service worker. FCM SDK уже сам показывает уведомление когда есть поле `notification` в payload. Обработчик `onBackgroundMessage` нужен только для логирования.

## Файлы для изменения

### `public/firebase-messaging-sw.js`
- Убрать вызов `self.registration.showNotification()` из `onBackgroundMessage`
- Оставить только логирование

### Больше ничего менять не нужно
- Серверная часть (`unlock-materials`) уже работает правильно -- отправляет 1 сообщение
- Токенов в базе тоже 1 для этого ученика

## Техническое пояснение

Когда FCM-сообщение содержит поле `notification`, браузер автоматически показывает уведомление. Поле `webpush.notification` в payload уже содержит иконку, badge и настройки вибрации. Вызов `showNotification()` в SW дублирует это поведение.
