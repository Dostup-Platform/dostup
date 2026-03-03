

## Problem

The standalone PWA detection fix didn't resolve the issue. When using `window.location.href = presignedUrl` in PWA mode, iOS still briefly navigates the webview to the file URL, causing the page to flash/disappear and then the file preview pops up seconds later when the download completes.

## Solution

Use a **hidden iframe** to trigger downloads in standalone PWA mode. This keeps the main page completely untouched -- the iframe silently handles the download in the background, and iOS shows its native download sheet without disrupting the app.

For "view" actions (not download), continue using `window.location.href` since the user explicitly wants to navigate to the file.

## Changes (4 files, same pattern)

**All files**: `MaterialsTab.tsx`, `TeacherMaterialsTab.tsx`, `TeacherMaterialsManager.tsx`, `ProductMaterialsManager.tsx`

Replace the standalone download logic:

```typescript
// For downloads in standalone PWA mode: use hidden iframe
if (isStandalone && action === 'download') {
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = url;
  document.body.appendChild(iframe);
  setTimeout(() => document.body.removeChild(iframe), 30000);
} else if (newWindow) {
  newWindow.location.href = url;
} else {
  window.location.href = url;
}
```

For **view** actions in standalone mode, `window.location.href` remains since the user wants to see the file. For **download** actions, the hidden iframe triggers the iOS download sheet without navigating away from the app.

