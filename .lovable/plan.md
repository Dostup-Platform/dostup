

## Problem

`window.open('about:blank', '_blank')` in a standalone PWA on iOS doesn't open Safari -- it opens a blank page *inside* the PWA webview. The user sees "about:blank" with a loading bar that never finishes.

## Solution

Detect if the app is running as a standalone PWA. If yes, skip `window.open` and use `window.location.href` directly for **downloads** (with `response-content-disposition: attachment`, iOS will handle it as a download without leaving the page). For **view** actions, also use `window.location.href` since there's no other option in standalone mode.

For non-PWA (regular browser), keep the current `window.open('about:blank')` approach.

## Changes (4 files, same pattern)

**All 4 files**: `MaterialsTab.tsx`, `TeacherMaterialsManager.tsx`, `TeacherMaterialsTab.tsx`, `ProductMaterialsManager.tsx`

Replace the download/view logic:

```typescript
// Detect standalone PWA
const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
  || (navigator as any).standalone === true;

const newWindow = isStandalone ? null : window.open('about:blank', '_blank');
const loadingToast = toast.loading("Подготовка файла...");

try {
  const url = await getPresignedUrl(...);
  if (newWindow) {
    newWindow.location.href = url;
  } else {
    window.location.href = url;
  }
} catch (err) {
  newWindow?.close();
  // handle error
} finally {
  toast.dismiss(loadingToast);
}
```

In standalone PWA mode on iOS, `window.location.href = presignedUrl` for a download (with attachment header) will trigger the native iOS download sheet without navigating away. For view (inline), it will open the file in the current view, but this is the only viable option in standalone mode.

