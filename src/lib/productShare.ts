import { productHref } from "@/lib/catalog";

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function buildProductShareUrl(
  product: { id: string; slug?: string | null },
  sellerHandle?: string | null,
  origin?: string,
) {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  const path = productHref(product);
  const url = new URL(path, base);
  if (sellerHandle) {
    url.searchParams.set("ref", sellerHandle);
  }
  return url.toString();
}

export function whatsAppShareUrl(text: string, url: string) {
  return `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
}

export function telegramShareUrl(text: string, url: string) {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}
