

## Problem

On mobile, the `<a target="_blank">` programmatic click after `await getS3DownloadUrl(...)` is **silently blocked by popup blockers** because it's no longer in the synchronous user gesture context. The toast appears during the async call, then dismisses, and nothing opens — no error thrown.

## Solution

Different strategy for download vs view:

- **Download**: Use `window.location.href = presignedUrl`. With `Content-Disposition: attachment` header, the browser starts a background download without navigating away from the SPA. No new window needed on any platform.
- **View**: Use `window.open('about:blank', '_blank')` **synchronously on ALL platforms** (remove the mobile exclusion). This captures the user gesture. After the async call completes, navigate the opened window to the URL. Brief blank page is acceptable.

### Code change in all 4 files

Replace the `newWindow` and `nav` logic:

```typescript
// View: open window synchronously to capture user gesture (all platforms)
// Download: no window needed — window.location.href with attachment header
const newWindow = action === 'view' ? window.open('about:blank', '_blank') : null;
const loadingToast = toast.loading(...);

try {
  // ...async work to get URL...

  const nav = async (url: string) => {
    if (newWindow) {
      newWindow.location.href = url;
    } else {
      // Download: triggers native download, page stays intact
      window.location.href = url;
    }
  };
```

### Files to edit
1. `src/components/dashboard/MaterialsTab.tsx`
2. `src/components/teacher/TeacherMaterialsTab.tsx`
3. `src/components/teacher/TeacherMaterialsManager.tsx`
4. `src/components/creator/ProductMaterialsManager.tsx`

