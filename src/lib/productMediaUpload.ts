import { supabase } from "@/integrations/supabase/client";

export type ProductMediaKind = "image" | "video";

export const MAX_VIDEO_DURATION_SECONDS = 180; // 3 minutes

export async function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.src = url;
    video.onloadedmetadata = () => {
      const d = video.duration;
      URL.revokeObjectURL(url);
      if (!isFinite(d)) reject(new Error("Cannot read video duration"));
      else resolve(d);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Cannot read video metadata"));
    };
  });
}

export async function uploadProductMedia(
  file: File,
  productId: string,
  kind: ProductMediaKind,
  retries = 1
): Promise<string> {
  const creatorToken = localStorage.getItem("creator_token") || "";
  const creatorName = localStorage.getItem("creator_name") || "";

  const form = new FormData();
  form.append("file", file);
  form.append("productId", productId);
  form.append("creatorName", creatorName);
  form.append("creatorToken", creatorToken);
  form.append("kind", kind);

  let lastError: any = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 1000));
    }
    try {
      const { data, error } = await supabase.functions.invoke("upload-product-media", {
        body: form,
      });

      if (error) {
        const msg = error.message || "Upload failed";
        if (msg.includes("Failed to send a request") && attempt < retries) {
          lastError = new Error(msg);
          continue;
        }
        if (msg.includes("Failed to send a request")) {
          throw new Error("Не удалось загрузить медиафайл из-за сбоя соединения. Попробуйте ещё раз.");
        }
        throw new Error(msg);
      }
      if (!data?.url) throw new Error("Upload failed: no URL returned");
      return data.url as string;
    } catch (err: any) {
      lastError = err;
      if (err?.message?.includes("Failed to send a request") && attempt < retries) {
        continue;
      }
      if (err?.message?.includes("Failed to send a request")) {
        throw new Error("Не удалось загрузить медиафайл из-за сбоя соединения. Попробуйте ещё раз.");
      }
      throw err;
    }
  }

  throw lastError || new Error("Не удалось загрузить файл");
}