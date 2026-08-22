import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CATALOG_FILTER_THRESHOLD,
  isProductFormat,
  type CatalogProduct,
  type ProductFormat,
} from "@/lib/catalog";

export type CatalogSort = "newest" | "price_asc" | "price_desc";

export type CatalogFilters = {
  q?: string;
  format?: ProductFormat | "";
  subject?: string;
  minPrice?: number | null;
  maxPrice?: number | null;
  sort?: CatalogSort;
};

function asCatalogRows(data: unknown): CatalogProduct[] {
  if (!Array.isArray(data)) return [];
  return data.map((row) => {
    const item = row as CatalogProduct;
    return {
      ...item,
      price: Number(item.price) || 0,
      has_schedule: Boolean(item.has_schedule),
      format: isProductFormat(String(item.format)) ? item.format : "recorded",
    };
  });
}

async function searchCatalog(filters: CatalogFilters, limit = 48, offset = 0) {
  const { data, error } = await supabase.rpc("search_catalog", {
    q: filters.q?.trim() || null,
    p_format: filters.format || null,
    p_subject: filters.subject?.trim() || null,
    p_min: filters.minPrice ?? null,
    p_max: filters.maxPrice ?? null,
    p_sort: filters.sort || "newest",
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;
  return asCatalogRows(data);
}

export function useCatalogPreview() {
  return useQuery({
    queryKey: ["catalog-preview"],
    queryFn: () => searchCatalog({}, CATALOG_FILTER_THRESHOLD, 0),
  });
}

export function useCatalogSearch(filters: CatalogFilters, enabled = true) {
  return useQuery({
    queryKey: ["catalog-search", filters],
    queryFn: () => searchCatalog(filters, 48, 0),
    enabled,
  });
}

export function useCatalogSubjects(enabled = true) {
  return useQuery({
    queryKey: ["catalog-subjects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_products")
        .select("subject")
        .not("subject", "is", null);
      if (error) throw error;
      const values = new Set<string>();
      for (const row of data ?? []) {
        const subject = typeof row.subject === "string" ? row.subject.trim() : "";
        if (subject) values.add(subject);
      }
      return [...values].sort((a, b) => a.localeCompare(b, "ru"));
    },
    enabled,
  });
}
