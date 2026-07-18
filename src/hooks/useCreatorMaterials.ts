import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Material, MaterialType } from "./useMaterials";

async function nextOrderIndex(productId: string, parentId: string | null): Promise<number> {
  let query = supabase
    .from("materials")
    .select("order_index")
    .eq("product_id", productId)
    .is("deleted_at", null)
    .order("order_index", { ascending: false })
    .limit(1);
  query = parentId ? query.eq("parent_id", parentId) : query.is("parent_id", null);
  const { data } = await query;
  const max = data?.[0]?.order_index ?? -1;
  return max + 1;
}

export interface CreateMaterialInput {
  productId: string;
  parentId: string | null;
  title: string;
  type: MaterialType;
  content?: string | null;
  file_url?: string | null;
  file_size?: number | null;
}

export const useCreateMaterial = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateMaterialInput) => {
      const order_index = await nextOrderIndex(input.productId, input.parentId);
      const { data, error } = await supabase
        .from("materials")
        .insert({
          product_id: input.productId,
          parent_id: input.parentId,
          title: input.title,
          type: input.type,
          content: input.content ?? null,
          file_url: input.file_url ?? null,
          file_size: input.file_size ?? null,
          order_index,
          allow_view: true,
          allow_download: true,
          teacher_allow_download: true,
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Material;
    },
    onSuccess: (m) => qc.invalidateQueries({ queryKey: ["materials", m.product_id] }),
  });
};

export const useUpdateMaterial = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch, productId }: { id: string; patch: Partial<Material>; productId: string }) => {
      const { error } = await supabase.from("materials").update(patch).eq("id", id);
      if (error) throw error;
      return { id, productId };
    },
    onSuccess: ({ productId }) => qc.invalidateQueries({ queryKey: ["materials", productId] }),
  });
};

export const useDeleteMaterial = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, productId }: { id: string; productId: string }) => {
      // Soft delete: mark this and all descendants
      const { data: all } = await supabase
        .from("materials")
        .select("id, parent_id")
        .eq("product_id", productId)
        .is("deleted_at", null);
      const toDelete = new Set<string>([id]);
      let changed = true;
      while (changed) {
        changed = false;
        (all ?? []).forEach((r: { id: string; parent_id: string | null }) => {
          if (r.parent_id && toDelete.has(r.parent_id) && !toDelete.has(r.id)) {
            toDelete.add(r.id);
            changed = true;
          }
        });
      }
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("materials")
        .update({ deleted_at: now })
        .in("id", Array.from(toDelete));
      if (error) throw error;
      return { productId };
    },
    onSuccess: ({ productId }) => qc.invalidateQueries({ queryKey: ["materials", productId] }),
  });
};

export async function presignUpload(productId: string, file: File): Promise<{ storagePath: string; size: number }> {
  const { data, error } = await supabase.functions.invoke("s3-presign-upload", {
    body: { productId, fileName: file.name, fileType: file.type },
  });
  if (error) throw error;
  const payload = data as { uploadUrl?: string; storagePath?: string; contentType?: string; error?: string };
  if (payload.error || !payload.uploadUrl || !payload.storagePath) {
    throw new Error(payload.error ?? "Не удалось получить URL загрузки");
  }
  const putRes = await fetch(payload.uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": payload.contentType ?? file.type ?? "application/octet-stream" },
  });
  if (!putRes.ok) throw new Error(`Ошибка загрузки: ${putRes.status}`);
  return { storagePath: payload.storagePath, size: file.size };
}