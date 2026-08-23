export const HANDLE_FORMAT = /^[a-z0-9-]{3,30}$/;

export function normalizeHandle(raw: string) {
  return raw.trim().toLowerCase().replace(/\s+/g, "-");
}

export function isHandleFormatValid(handle: string) {
  return HANDLE_FORMAT.test(handle);
}
