/**
 * Build synchronous redirect URLs for file download/view.
 * These URLs point to edge functions that return 302 redirects,
 * eliminating the async gap that causes popup blocker issues on mobile PWAs.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Check if a file_url points to S3 storage
 */
export function isS3Path(fileUrl: string): boolean {
  return fileUrl.startsWith('s3://');
}

/**
 * Check if file is an Office document (needs special viewer)
 */
export function isOfficeDocument(fileName: string): boolean {
  return /\.(docx?|xlsx?|pptx?|odt|ods|odp)(\?.*)?$/i.test(fileName);
}

/**
 * Build a direct URL to the s3-redirect edge function.
 * This URL can be used as an <a href> — no async needed.
 */
export function buildS3RedirectUrl(
  path: string,
  role: string,
  userId?: string,
  downloadFileName?: string
): string {
  const params = new URLSearchParams();
  params.set('path', path);
  params.set('role', role);
  if (userId) params.set('userId', userId);
  if (downloadFileName) params.set('download', downloadFileName);
  // Add apikey for edge function auth
  params.set('apikey', SUPABASE_KEY);
  return `${SUPABASE_URL}/functions/v1/s3-redirect?${params.toString()}`;
}

/**
 * Build a direct URL to the storage-redirect edge function.
 * For legacy Supabase Storage files.
 */
export function buildStorageRedirectUrl(
  path: string,
  downloadFileName?: string
): string {
  const params = new URLSearchParams();
  params.set('path', path);
  if (downloadFileName) params.set('download', downloadFileName);
  params.set('apikey', SUPABASE_KEY);
  return `${SUPABASE_URL}/functions/v1/storage-redirect?${params.toString()}`;
}

/**
 * Parse a file_url to get the storage path.
 * Handles both full URLs and relative paths.
 */
export function parseStoragePath(fileUrl: string): string | null {
  if (fileUrl.startsWith('http')) {
    const parts = fileUrl.split('/materials/');
    return parts.length > 1 ? parts[1] : null;
  }
  return fileUrl;
}
