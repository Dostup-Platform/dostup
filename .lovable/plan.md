

## Problem

S3 rejects raw Cyrillic in `response-content-disposition` because non-ASCII chars can't be represented in ISO-8859-1. But `encodeURIComponent` caused double-encoding (signature mismatch). Both approaches fail.

## Root Cause

The `aws_s3_presign` library encodes query param values internally for signature computation. There's no way to pass a pre-encoded `filename*=UTF-8''...` value that works for both the URL and the signature with this library.

## Solution

Use `response-content-disposition=attachment` **without a filename**. S3 will force a download. The browser will derive the filename from the URL path (the S3 key), which is a unique hash like `1772121810588-zf8jm.png`. This always works regardless of character encoding.

For a human-readable filename, the client-side `<a>` tag can set the `download` attribute — but this only works for same-origin URLs, so it won't apply here. The tradeoff is: **downloads work reliably on all platforms** but the filename will be the S3 key rather than the original name. This is acceptable since the file opens correctly.

## Change

**File**: `supabase/functions/s3-redirect/index.ts` — line 82

```typescript
// Before:
'response-content-disposition': `attachment; filename*=UTF-8''${download}`,

// After:
'response-content-disposition': 'attachment',
```

Single line change. No other files affected.

