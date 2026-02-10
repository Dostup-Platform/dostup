import { supabase } from "@/integrations/supabase/client";

/**
 * Check if a file_url points to S3 storage
 */
export function isS3Path(fileUrl: string): boolean {
  return fileUrl.startsWith('s3://');
}

/**
 * Get a presigned URL for an S3 file
 */
export async function getS3DownloadUrl(
  path: string,
  role: 'student' | 'teacher' | 'creator',
  userId?: string,
  download?: string | false
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('s3-download', {
    body: { path, role, userId, download: download || false },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.url;
}

/**
 * Upload a file to S3 via the s3-upload edge function
 */
export async function uploadFileToS3(
  file: File,
  productId: string,
  role: 'creator' | 'teacher',
  options: {
    creatorToken?: string;
    creatorName?: string;
    teacherId?: string;
  }
): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('productId', productId);
  formData.append('role', role);

  if (options.creatorToken) formData.append('creatorToken', options.creatorToken);
  if (options.creatorName) formData.append('creatorName', options.creatorName);
  if (options.teacherId) formData.append('teacherId', options.teacherId);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const response = await fetch(`${supabaseUrl}/functions/v1/s3-upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Upload failed');
  }

  const data = await response.json();
  return data.path; // Returns s3://bucket/key
}
