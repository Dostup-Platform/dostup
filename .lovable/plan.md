

## Problem

The Web Share API fix only applies when `isStandalone` is true (installed PWA). But the user is using a **regular mobile browser** (not installed PWA), where `isStandalone` is false. In that case, the code does `window.open('about:blank', '_blank')` then `newWindow.location.href = presignedUrl`. On iOS Safari, this causes:
1. A blank tab opens
2. iOS download bar appears at bottom
3. The blank tab flashes/navigates
4. Eventually the file preview appears "out of nowhere"

The standalone-only check means the blob+share fix never runs for mobile browser users.

## Solution

Detect **mobile devices** (iOS/Android) separately from standalone mode. For mobile downloads:
- Use Web Share API (blob → File → `navigator.share`) if available
- Fallback: blob → `<a download>` click
- Do NOT open a new blank window on mobile at all

For desktop: keep existing `window.open('about:blank')` behavior (works fine there).

## Changes (4 files, same pattern)

**All files**: `MaterialsTab.tsx`, `TeacherMaterialsTab.tsx`, `TeacherMaterialsManager.tsx`, `ProductMaterialsManager.tsx`

Replace standalone detection + newWindow logic:

```typescript
const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  || (navigator as any).standalone === true;
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

// Don't open blank window on mobile - it causes flickering
const newWindow = (isStandalone || isMobile) ? null : window.open('about:blank', '_blank');
```

Replace the `nav` function to use blob+share for ALL mobile downloads (not just standalone):

```typescript
const nav = async (url: string) => {
  if (isMobile && action === 'download') {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const fileName = material.title || 'download';
      const file = new File([blob], fileName, { type: blob.type });
      
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: fileName });
        toast.success(language === "ru" ? "Файл сохранён" : "Файл сақталды");
      } else {
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
  } else if (newWindow) {
    newWindow.location.href = url;
  } else {
    window.location.href = url;
  }
};
```

This ensures that on any mobile device (browser or PWA), downloads go through the share sheet / blob path instead of opening a blank tab.

