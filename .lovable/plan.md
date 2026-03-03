

## Root Cause

The `fetch(s3PresignedUrl)` call in the browser fails silently due to **CORS** — AWS S3 doesn't have CORS configured to allow requests from your app's domain. When fetch fails, the catch block falls back to `window.location.href = url`, which causes the exact flickering behavior you described.

## Solution

Instead of fetching the S3 file directly from the browser (which hits CORS), **proxy the file through a backend function** that returns the binary data with proper CORS headers. The flow becomes:

1. Client calls edge function with file path + role
2. Edge function fetches from S3 server-side (no CORS issues)
3. Edge function streams the file bytes back to client with CORS headers
4. Client creates Blob → File → `navigator.share()` or `<a download>`

## Changes

### 1. New edge function: `s3-download-proxy`

A simple function that:
- Accepts `path`, `role`, `userId` (same as `s3-download`)
- Validates access (same logic as current `s3-download`)
- Fetches the file from S3 server-side
- Returns the raw file bytes with `Content-Type` and CORS headers

```typescript
// Returns actual file content, not a URL
return new Response(s3Response.body, {
  headers: {
    ...corsHeaders,
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${encodedName}"`,
  },
});
```

### 2. Update `s3Helpers.ts` — add `getS3FileBlob()`

New helper function that calls `s3-download-proxy` and returns a `Blob`:

```typescript
export async function getS3FileBlob(
  path: string, role: string, userId?: string
): Promise<{ blob: Blob; fileName: string }> {
  const response = await fetch(`${supabaseUrl}/functions/v1/s3-download-proxy`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, role, userId }),
  });
  const blob = await response.blob();
  const fileName = path.split('/').pop() || 'download';
  return { blob, fileName };
}
```

### 3. Update `nav()` in all 4 material files

For mobile downloads, instead of `fetch(presignedUrl)` (which hits CORS), call `getS3FileBlob()` before `nav()` and pass the blob directly:

```typescript
if (isMobile && action === 'download') {
  // For S3 files, get blob via proxy (avoids CORS)
  const { blob } = await getS3FileBlob(material.file_url, role, userId);
  const file = new File([blob], material.title || 'download', { type: blob.type });
  
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: material.title });
    toast.success("Файл сохранён");
  } else {
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = material.title;
    a.click();
  }
}
```

For non-S3 files (Supabase storage), the signed URLs already have CORS, so `fetch()` works fine.

### Files to change:
1. **New**: `supabase/functions/s3-download-proxy/index.ts`
2. **Edit**: `src/lib/s3Helpers.ts` — add `getS3FileBlob`
3. **Edit**: `src/components/dashboard/MaterialsTab.tsx`
4. **Edit**: `src/components/teacher/TeacherMaterialsTab.tsx`
5. **Edit**: `src/components/teacher/TeacherMaterialsManager.tsx`
6. **Edit**: `src/components/creator/ProductMaterialsManager.tsx`

