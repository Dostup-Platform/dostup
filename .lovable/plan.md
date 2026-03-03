

## Problem

Hidden iframe downloads **don't work on iOS Safari** (confirmed by Apple developer forums and Stack Overflow). iOS ignores iframe-based downloads in standalone PWA mode. The presigned URL still causes iOS to navigate or show its native download UI, which disrupts the app.

## Solution: Blob download

The only reliable way to download files in iOS PWA standalone mode is the **blob approach**:

1. Fetch the file entirely into memory using `fetch()`
2. Create a local `Blob` URL with `URL.createObjectURL()`
3. Trigger download via an `<a download>` anchor click on the blob URL

This completely avoids navigating to an external URL. iOS handles blob URLs locally without any navigation or preview flashing.

For "view" actions, keep `window.location.href` since the user wants to see the file.

## Changes (4 files, same pattern)

**All files**: `MaterialsTab.tsx`, `TeacherMaterialsTab.tsx`, `TeacherMaterialsManager.tsx`, `ProductMaterialsManager.tsx`

Replace the `nav` function's standalone download branch:

```typescript
const nav = async (url: string) => {
  if (isStandalone && action === 'download') {
    // Blob approach: fetch file into memory, then trigger local download
    // This avoids any external URL navigation on iOS PWA
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = material.title || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (e) {
      // Fallback: open URL directly if blob fails
      window.location.href = url;
    }
  } else if (newWindow) {
    newWindow.location.href = url;
  } else {
    window.location.href = url;
  }
};
```

Since `nav` becomes async, all calls to `nav(url)` need `await nav(url)`.

The loading toast "Подготовка файла..." will remain visible during both the presigned URL generation AND the actual file download, giving proper feedback for the full process.

For a 15MB video this will take a few seconds to fetch into memory but will completely eliminate the flashing/navigation issue.

