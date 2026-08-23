export type ProductFormat = "recorded" | "individual" | "group";

export type CatalogProduct = {
  id: string;
  slug: string | null;
  title: string;
  headline: string | null;
  image_url: string | null;
  price: number;
  format: ProductFormat | string;
  subject: string | null;
  has_schedule: boolean;
  created_at: string;
  seller_handle: string | null;
  seller_display_name: string | null;
  seller_avatar_url: string | null;
  seller_type: string | null;
};

export type SellerStorefront = {
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  type: string;
  bio: string | null;
  products: CatalogProduct[];
};

export const CATALOG_FILTER_THRESHOLD = 12;

export function productHref(product: { id: string; slug?: string | null }) {
  return `/p/${encodeURIComponent(product.slug || product.id)}`;
}

export function formatPriceTenge(price: number) {
  const amount = new Intl.NumberFormat("ru-KZ", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(price) || 0);
  return `${amount}\u00A0₸`;
}

export function isProductFormat(value: string | null | undefined): value is ProductFormat {
  return value === "recorded" || value === "individual" || value === "group";
}

export function formatLabelKey(format: string | null | undefined): "formatRecorded" | "formatIndividual" | "formatGroup" {
  if (format === "individual") return "formatIndividual";
  if (format === "group") return "formatGroup";
  return "formatRecorded";
}
