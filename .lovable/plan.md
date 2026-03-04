

## Problem

This app is a **PWA in standalone mode** (`display: "standalone"`). On iOS/Android standalone PWA:
- `window.open('about:blank')` is blocked or behaves unpredictably
- `window.location.href = externalUrl` navigates the entire PWA away, potentially losing state
- Programmatic `<a>.click()` after `await` is blocked by popup blockers

The edge function logs confirm presigned URLs ARE being generated successfully -- the problem is 100% client-side navigation after the async call.

## Root Cause

Every approach tried so far follows the same pattern:
1. User clicks (sync gesture)
2. `await getS3DownloadUrl(...)` (async, ~1 second)
3. Try to navigate/open (gesture context lost)

No matter what navigation method is used in step 3, mobile browsers and PWAs block it.

## Solution: Server-side redirect edge function

Eliminate the async gap entirely. Create a new edge function `s3-redirect` that:
1. Accepts a **GET request** with query parameters (path, role, userId, download)
2. Validates access (same logic as `s3-download`)
3. Returns a **302 redirect** to the presigned S3 URL

The client then uses this URL **synchronously** -- no async needed:
- **Download button**: `<a href="s3-redirect?path=...&download=true">` -- plain HTML link, works everywhere
- **View button**: `<a href="s3-redirect?path=..." target="_blank">` -- opens in Safari/browser from PWA

Since the redirect URL is known at render time (it's just the edge function URL with query params), there's zero async between user tap and navigation. The browser/PWA handles the redirect natively.

For **Office documents** (docx/xlsx via Microsoft Viewer), the existing token flow will remain since it requires a different URL structure.

For **Supabase Storage files** (non-S3, legacy), a similar redirect function `storage-redirect` will handle those.

## Changes

### 1. New edge function: `supabase/functions/s3-redirect/index.ts`
- GET handler with query params: `path`, `role`, `userId`, `download`
- Same access validation as `s3-download` (check purchases for students)
- Returns `302 redirect` to presigned S3 URL
- Add to `config.toml` with `verify_jwt = false`

### 2. New edge function: `supabase/functions/storage-redirect/index.ts`
- GET handler for legacy Supabase Storage files
- Query params: `path`, `download`
- Creates signed URL and returns 302 redirect

### 3. New helper: `src/lib/fileRedirect.ts`
- `buildS3RedirectUrl(path, role, userId?, download?)` -- constructs the redirect URL
- `buildStorageRedirectUrl(path, download?)` -- for legacy files
- Used by all 4 material components

### 4. Update all 4 material components
Replace async `handleOpenFile` with synchronous URL construction:

```typescript
// No more async! URL is known at render time
const getFileUrl = (material, action) => {
  if (isS3Path(material.file_url)) {
    if (action === 'view' && isOfficeDocument(material.title)) {
      return null; // Office docs still need async token flow
    }
    return buildS3RedirectUrl(material.file_url, role, userId, 
      action === 'download' ? material.title : undefined);
  } else {
    return buildStorageRedirectUrl(parsePath(material.file_url), 
      action === 'download' ? material.title : undefined);
  }
};

// Buttons become plain <a> tags:
<a href={getFileUrl(material, 'download')}>Download</a>
<a href={getFileUrl(material, 'view')} target="_blank">View</a>
```

Office documents keep the existing async flow with `window.open('about:blank')` since Microsoft Viewer needs a special URL.

### Files to edit:
1. `supabase/functions/s3-redirect/index.ts` -- **new**
2. `supabase/functions/storage-redirect/index.ts` -- **new**
3. `supabase/config.toml` -- add entries for new functions
4. `src/lib/fileRedirect.ts` -- **new** helper
5. `src/components/dashboard/MaterialsTab.tsx` -- use `<a href>` links
6. `src/components/teacher/TeacherMaterialsTab.tsx` -- same
7. `src/components/teacher/TeacherMaterialsManager.tsx` -- same
8. `src/components/creator/ProductMaterialsManager.tsx` -- same

