

## Problem Analysis

The error toast "Ошибка при открытии файла" appears on mobile when trying to download. The s3-download edge function works correctly (verified by direct call), so the issue is client-side. Two problems:

1. **`window.location.href = presignedUrl`** navigates away from the SPA. On iOS Safari, this can cause the app to unload before the download starts, or the browser may fail to handle the navigation gracefully and trigger the catch block.

2. **Error toast doesn't show the actual error** in ProductMaterialsManager (line 376: `toast.error('Ошибка при открытии файла')` without error details), making debugging impossible.

## Solution

Replace `window.location.href` with `<a>` tag approach for mobile downloads. Create an invisible `<a>` element with `target="_blank"` and click it programmatically. This:
- Opens the presigned URL in a new tab (no blank-window flickering since it goes directly to the URL)
- Keeps the current app tab intact
- Works reliably on both iOS Safari and Chrome for Android
- With `Content-Disposition: attachment`, the browser downloads the file in the new tab

### Changes

**All 4 material files** - update the `nav` function:

```typescript
const nav = async (url: string) => {
  if (newWindow) {
    newWindow.location.href = url;
  } else {
    // Mobile: use <a> tag to open in new tab without navigating away
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
};
```

Also add error details to the toast in all files for better debugging:

```typescript
toast.error(`Ошибка при открытии файла: ${err instanceof Error ? err.message : String(err)}`);
```

### Files to edit:
1. `src/components/dashboard/MaterialsTab.tsx`
2. `src/components/teacher/TeacherMaterialsTab.tsx`
3. `src/components/teacher/TeacherMaterialsManager.tsx`
4. `src/components/creator/ProductMaterialsManager.tsx`

