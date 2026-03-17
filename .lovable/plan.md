

## План: Расширить текст при раскрытии

### Проблема
Раскрытый текст находится внутри `flex-1` div рядом с иконкой (40px) и кнопкой, поэтому имеет большие отступы слева и справа.

### Решение

**Файл:** `src/components/dashboard/MaterialsTab.tsx`

Вынести блок раскрытого текста (строки 363-367) **за пределы** flex-контейнера (строка 353), но внутри `CardContent`. Так текст будет занимать всю ширину карточки без боковых отступов от иконки и кнопки.

```text
До:
<CardContent>
  <div flex>
    <icon/>
    <div flex-1>
      <title/>
      <expanded-text/>  ← зажат между иконкой и кнопкой
    </div>
    <button/>
  </div>
</CardContent>

После:
<CardContent>
  <div flex>
    <icon/>
    <div flex-1><title/></div>
    <button/>
  </div>
  {expanded && <expanded-text/>}  ← на всю ширину карточки
</CardContent>
```

Один файл, ~5 строк перемещения.

