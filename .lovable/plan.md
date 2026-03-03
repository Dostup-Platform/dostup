

## Problem Analysis

On iOS mobile, when downloading large files (like 15MB MP4 video), the behavior is:
1. The presigned URL is generated quickly, and the download starts
2. iOS Safari briefly opens a download preview that immediately disappears (because the file hasn't finished downloading yet)
3. After a few seconds when the download completes, the preview opens again unexpectedly

This is iOS Safari's native download behavior -- it tries to preview the file immediately but the content isn't ready. We cannot control Safari's download manager behavior, but we can improve the UX by:

1. **Using `window.open('about:blank')` for downloads too** (not just views) -- open a blank tab synchronously, then redirect it to the download URL. This way the download happens in a separate tab and doesn't disrupt the current page.
2. **Showing a longer-lasting toast** that says "File downloading..." so the user understands what's happening.

## Plan

### Changes across 4 files

**1. `src/components/teacher/TeacherMaterialsManager.tsx`**
- Change download logic: instead of creating an `<a>` element and clicking it, open `window.open('about:blank')` at the top of the function (for both view AND download), then set `newWindow.location.href = downloadUrl`. This moves the download to a separate tab, avoiding the flickering on the current page.
- Add a loading toast (currently missing in this file).

**2. `src/components/teacher/TeacherMaterialsTab.tsx`**  
- Change `window.location.href = url` for downloads to use a pre-opened `window.open('about:blank')` tab, same approach.
- After getting the URL and redirecting the new window, show a success toast like "File download started" instead of just dismissing the loading toast.

**3. `src/components/dashboard/MaterialsTab.tsx`** (student)
- Same change: replace `window.location.href = url` with a pre-opened blank window redirect for downloads.

**4. `src/components/creator/ProductMaterialsManager.tsx`**
- Same change: replace `document.createElement('a')` click approach with the pre-opened blank window redirect.

### How it works
- For **all roles** and **all download actions**: the function opens `window.open('about:blank', '_blank')` synchronously (before any async call), then after getting the presigned URL, sets `newWindow.location.href = url`.
- This way the download happens in a new tab. On iOS, the new tab will handle the download preview/loading, and the user stays on their dashboard without interruption.
- A toast will show "Downloading file..." and dismiss after the URL is ready.

### Technical detail
The key change pattern in each file:
```
// BEFORE (download case):
window.location.href = url;
// or
const link = document.createElement('a'); link.click();

// AFTER (download case):
// At function start: open blank window for BOTH view and download
const newWindow = window.open('about:blank', '_blank');
// Then later:
newWindow.location.href = url;
```

