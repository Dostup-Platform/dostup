

## Problem

iOS PWA standalone mode doesn't support traditional download methods — `<a download>`, hidden iframes, and `window.location.href` all cause issues. The blob approach also fails because iOS Safari ignores the `download` attribute on blob URLs.

## Solution: Web Share API with File

Use `navigator.share({ files: [file] })` on iOS PWA. This opens the native iOS share sheet where the user can tap "Save to Files" or "Save Image/Video." After triggering the share sheet, show a toast message like "Сохраните файл через меню 'Сохранить в Файлы'" (Save the file via 'Save to Files').

If `navigator.share` is not available or `navigator.canShare` returns false for files, fall back to opening the URL directly.

## Flow

1. Fetch file as blob (already implemented)
2. Create a `File` object from the blob
3. Call `navigator.share({ files: [file] })`
4. iOS shows native share sheet → user taps "Save to Files" or "Save to Photos"
5. Show a toast: "Выберите 'Сохранить в Файлы' для загрузки" / after share completes: "Файл сохранён"

## Changes (4 files, same pattern)

**All files**: `MaterialsTab.tsx`, `TeacherMaterialsTab.tsx`, `TeacherMaterialsManager.tsx`, `ProductMaterialsManager.tsx`

Replace the standalone download branch in `nav`:

```typescript
if (isStandalone && action === 'download') {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const fileName = material.title || 'download';
    const file = new File([blob], fileName, { type: blob.type });
    
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: fileName });
      toast.success(language === "ru" 
        ? "Файл сохранён" 
        : "Файл сақталды");
    } else {
      // Fallback: open blob URL
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    }
  } catch (e) {
    if ((e as Error).name !== 'AbortError') {
      window.location.href = url;
    }
  }
}
```

Key details:
- `navigator.canShare({ files })` is supported on iOS 15+ Safari and PWA
- `AbortError` is thrown if user dismisses the share sheet — we silently ignore it
- The share sheet lets users save to Files app, Photos (for images/videos), AirDrop, etc.
- Loading toast "Подготовка файла..." stays visible during the fetch, dismissed after share

