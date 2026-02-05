
# План исправления открытия файла

## Проблема
Браузеры блокируют всплывающие окна (`window.open`), если они вызываются не напрямую в обработчике клика, а после асинхронной операции. Сейчас код сначала запрашивает signed URL, а потом пытается открыть окно - это блокируется.

## Решение
Открыть пустое окно **сразу** по клику пользователя, а затем установить его URL после получения signed URL.

## Изменения

### Файл: `src/components/creator/ProductMaterialsManager.tsx`

**Функция `handleOpenFile`:**

```typescript
const handleOpenFile = async (material: Material, action: 'view' | 'download') => {
  if (!material.file_url) return;
  
  // Для просмотра - открыть окно СРАЗУ (до async)
  let newWindow: Window | null = null;
  if (action === 'view') {
    newWindow = window.open('about:blank', '_blank');
  }
  
  try {
    setIsLoadingUrl(true);
    
    const isFullUrl = material.file_url.startsWith('http');
    const path = isFullUrl 
      ? material.file_url.split('/materials/')[1] 
      : material.file_url;
    
    if (!path) {
      newWindow?.close();
      throw new Error('Invalid file path');
    }
    
    const { data, error } = await supabase.storage
      .from('materials')
      .createSignedUrl(path, 3600);
    
    if (error) {
      newWindow?.close();
      throw error;
    }
    
    if (action === 'download') {
      const link = document.createElement('a');
      link.href = data.signedUrl;
      link.download = material.title;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (newWindow) {
      // Установить URL в уже открытое окно
      newWindow.location.href = data.signedUrl;
    }
    
    setOpeningFile(null);
  } catch (err) {
    console.error('Error getting file URL:', err);
    toast.error('Ошибка при открытии файла');
  } finally {
    setIsLoadingUrl(false);
  }
};
```

## Технические детали
- `window.open('about:blank', '_blank')` вызывается синхронно при клике - браузер не блокирует
- После получения signed URL устанавливаем `newWindow.location.href`
- При ошибке закрываем пустое окно через `newWindow?.close()`

## Результат
Файлы будут корректно открываться в новой вкладке браузера без блокировки popup-blocker.
