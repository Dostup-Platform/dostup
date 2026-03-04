

## Problem

The S3 `SignatureDoesNotMatch` error occurs because the download filename (containing Cyrillic characters like "1200 на 700.png") is being **double-encoded**:

1. `encodeURIComponent(download)` encodes it → `1200%20%D0%BD%D0%B0%20700.png`
2. The `aws_s3_presign` library **also encodes** query param values internally when computing the signature
3. The actual URL ends up with single encoding, but the signature was computed over double-encoded values → **mismatch**

The view button works because it doesn't add `response-content-disposition` with a filename.

## Fix

In `supabase/functions/s3-redirect/index.ts` line 82, remove `encodeURIComponent`:

```typescript
// Before (broken):
'response-content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(download)}`,

// After (fixed):
'response-content-disposition': `attachment; filename*=UTF-8''${download}`,
```

The presign library handles URL-encoding internally. We should pass the raw value.

### File to edit:
1. `supabase/functions/s3-redirect/index.ts` — remove `encodeURIComponent` on line 82

