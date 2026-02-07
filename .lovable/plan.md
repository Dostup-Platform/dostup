

## Генерация Share Image для превью ссылок

**Что произойдёт:**
- Я сгенерирую картинку 1200x630 пикселей с названием "Dostup" и покажу её вам
- Вы посмотрите и решите — вставлять или нет
- Иконки и логотип внутри приложения и на сайте **НЕ изменятся** — это отдельная картинка только для превью ссылок в мессенджерах (WhatsApp, Telegram и т.д.)

**Что НЕ изменится:**
- Логотип в приложении (оранжевая "D")
- Favicon в браузере
- PWA иконки (192x192, 512x512)

**Шаги:**
1. Создам edge-функцию `generate-og-image`, которая через AI (Gemini) сгенерирует изображение с оранжевым фоном и белым текстом "Dostup"
2. Покажу вам результат
3. Только после вашего одобрения — сохраню как `public/og-image.png` и добавлю OG мета-теги в `index.html`

### Технические детали

**Шаг 1.** Создать edge-функцию `generate-og-image/index.ts` с вызовом модели `google/gemini-2.5-flash-image`:
- Промпт: "Create a clean, modern social media preview image 1200x630 pixels. Orange gradient background. Large white text 'Dostup' centered. Minimalist professional style."
- Функция вернёт base64-изображение

**Шаг 2.** Вызвать функцию и показать результат в чате

**Шаг 3.** После одобрения:
- Сохранить изображение как `public/og-image.png`
- Обновить `index.html` — добавить мета-теги:

```html
<meta property="og:image" content="/og-image.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="/og-image.png" />
```

