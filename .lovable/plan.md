

## Problem

Proxying a 15MB video through an edge function is too slow and unreliable on mobile -- it times out or runs out of memory, causing "Ошибка при открытии файла". The proxy approach was designed to avoid CORS, but it's overkill for downloads.

## Root Cause

The `getS3FileBlob` call downloads the entire 15MB file through the edge function into browser memory, then tries to create a File object and share it. This is slow, memory-intensive, and often times out on mobile networks.

## Solution: Simple direct navigation

The simplest approach that actually works on mobile: just use `window.location.href = presignedUrl` directly. No blank window, no proxy, no blob. The presigned URL from `s3-download` already supports `response-content-disposition: attachment`, which tells the browser to download the file.

On iOS Safari and mobile Chrome, `window.location.href` to a URL with `Content-Disposition: attachment` triggers the native download bar -- the file downloads in the background and the user stays on the current page. The previous flickering was caused by `window.open('about:blank')`, which is already removed.

## Changes

### All 4 material components

Remove the blob/proxy branch for mobile downloads. Use the same presigned URL approach for all platforms, just without opening a blank window on mobile:

```typescript
// For S3 files:
if (action === 'download') {
  const url = await getS3DownloadUrl(material.file_url, role, userId, material.title);
  if (newWindow) {
    newWindow.location.href = url;
  } else {
    // Mobile: direct navigation with attachment header -- browser downloads natively
    window.location.href = url;
  }
}
```

Key: `newWindow` is already `null` on mobile (from `isMobile` check). So on mobile it just does `window.location.href = presignedUrl` with `Content-Disposition: attachment`. No blank tab, no flickering, no proxy timeout.

### Files to edit:
1. `src/components/dashboard/MaterialsTab.tsx` -- remove `getS3FileBlob` import and blob branch
2. `src/components/teacher/TeacherMaterialsTab.tsx` -- same
3. `src/components/teacher/TeacherMaterialsManager.tsx` -- same
4. `src/components/creator/ProductMaterialsManager.tsx` -- same

The `s3-download-proxy` edge function and `getS3FileBlob` helper can stay for potential future use but won't be called for downloads.

