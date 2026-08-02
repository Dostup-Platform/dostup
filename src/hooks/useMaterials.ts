import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MaterialType = "file" | "folder" | "link" | "text";

export interface Material {
  id: string;
  product_id: string;
  parent_id: string | null;
  title: string;
  type: MaterialType;
  content: string | null;
  file_url: string | null;
  order_index: number;
  allow_view: boolean;
  allow_download: boolean;
  teacher_id: string | null;
  teacher_allow_download: boolean;
  available_at: string | null;
  deleted_at: string | null;
  original_parent_id: string | null;
  file_size: number | null;
  created_at: string;
}

export const useProductMaterials = (productId: string | undefined) =>
  useQuery({
    queryKey: ["materials", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials")
        .select("*")
        .eq("product_id", productId!)
        .is("deleted_at", null)
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Material[];
    },
  });

export async function fetchMaterialUrl(materialId: string, download = false): Promise<string> {
  const { data, error } = await supabase.functions.invoke("get-material-url", {
    body: { materialId, download },
  });
  if (error) throw error;
  const payload = data as { url?: string; error?: string };
  if (payload.error) throw new Error(payload.error);
  if (!payload.url) throw new Error("Не удалось получить ссылку");
  return payload.url;
}