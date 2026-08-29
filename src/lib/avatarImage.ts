export const AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_OUTPUT_SIZE = 400;
export const AVATAR_PREVIEW_SIZE = 256;

export type AvatarFileError = "type" | "size";

export function avatarFileError(file: File): AvatarFileError | null {
  if (!AVATAR_TYPES.has(file.type)) return "type";
  if (file.size > AVATAR_MAX_BYTES) return "size";
  return null;
}

export function cropToSquare(
  image: HTMLImageElement,
  zoom: number,
  offsetX: number,
  offsetY: number,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_OUTPUT_SIZE;
  canvas.height = AVATAR_OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("canvas"));

  const minSide = Math.min(image.naturalWidth, image.naturalHeight);
  const cropSize = minSide / zoom;
  const sx = image.naturalWidth / 2 + offsetX - cropSize / 2;
  const sy = image.naturalHeight / 2 + offsetY - cropSize / 2;
  ctx.drawImage(image, sx, sy, cropSize, cropSize, 0, 0, AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("blob"))),
      "image/jpeg",
      0.92,
    );
  });
}
