import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
      const target = (all ?? []).find((r) => r.id === id);
      // Remember where the root item lived, in case its original folder gets
      // deleted or moved before it's restored from trash.
      const { error: rootErr } = await supabase
        .from("materials")
        .update({ deleted_at: now, original_parent_id: target?.parent_id ?? null })
        .eq("id", id);
      if (rootErr) throw rootErr;
      const descendants = Array.from(toDelete).filter((mid) => mid !== id);
      if (descendants.length > 0) {
        const { error } = await supabase
          .from("materials")
          .update({ deleted_at: now })
          .in("id", descendants);
        if (error) throw error;
      }
      return { productId };
    },
    onSuccess: ({ productId }) => qc.invalidateQueries({ queryKey: ["materials", productId] }),
  });
};

export const useTrashedMaterials = (productId: string | undefined) =>
  useQuery({
    queryKey: ["trashed-materials", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials")
        .select("*")
        .eq("product_id", productId!)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as Material[];
      const deletedIds = new Set(rows.map((r) => r.id));
      // Only show "root" trashed items - ones whose parent isn't itself in the
      // trash - so restoring one brings back its whole subtree at once.
      return rows.filter((r) => !r.parent_id || !deletedIds.has(r.parent_id));
    },
  });

export const useRestoreMaterial = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ material, productId }: { material: Material; productId: string }) => {
      let newParentId = material.original_parent_id ?? material.parent_id;
      if (newParentId) {
        const { data: parent } = await supabase
          .from("materials")
          .select("id, deleted_at")
          .eq("id", newParentId)
          .maybeSingle();
        if (!parent || parent.deleted_at) newParentId = null;
      }

      const { data: all } = await supabase
        .from("materials")
        .select("id, parent_id")
        .eq("product_id", productId)
        .not("deleted_at", "is", null);
      const toRestore = new Set<string>([material.id]);
      let changed = true;
      while (changed) {
        changed = false;
        (all ?? []).forEach((r: { id: string; parent_id: string | null }) => {
          if (r.parent_id && toRestore.has(r.parent_id) && !toRestore.has(r.id)) {
            toRestore.add(r.id);
            changed = true;
          }
        });
      }

      const { error: rootErr } = await supabase
        .from("materials")
        .update({ deleted_at: null, parent_id: newParentId })
        .eq("id", material.id);
      if (rootErr) throw rootErr;

      const descendants = Array.from(toRestore).filter((mid) => mid !== material.id);
      if (descendants.length > 0) {
        const { error } = await supabase.from("materials").update({ deleted_at: null }).in("id", descendants);
        if (error) throw error;
      }
      return { productId, movedToRoot: newParentId === null && material.parent_id !== null };
    },
    onSuccess: ({ productId }) => {
      qc.invalidateQueries({ queryKey: ["materials", productId] });
      qc.invalidateQueries({ queryKey: ["trashed-materials", productId] });
    },
  });
};

export const useMoveMaterial = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      productId,
      newParentId,
    }: {
      id: string;
      productId: string;
      newParentId: string | null;
    }) => {
      const order_index = await nextOrderIndex(productId, newParentId);
      const { error } = await supabase
        .from("materials")
        .update({ parent_id: newParentId, order_index })
        .eq("id", id);
      if (error) throw error;
      return { productId };
    },
    onSuccess: ({ productId }) => qc.invalidateQueries({ queryKey: ["materials", productId] }),
  });
};

export interface StorageFile {
  id: string;
  title: string;
  product_id: string;
  file_size: number | null;
}

const STORAGE_QUOTA_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB

export const useCreatorStorage = (ownerId: string | undefined) =>
  useQuery({
    queryKey: ["creator-storage", ownerId],
    enabled: !!ownerId,
    queryFn: async () => {
      const { data: prods, error: prodErr } = await supabase
        .from("products")
        .select("id")
        .eq("owner_id", ownerId!);
      if (prodErr) throw prodErr;
      const productIds = (prods ?? []).map((p) => p.id);
      if (productIds.length === 0) {
        return { files: [] as StorageFile[], totalBytes: 0, quotaBytes: STORAGE_QUOTA_BYTES };
      }
      const { data, error } = await supabase
        .from("materials")
        .select("id,title,product_id,file_size")
        .in("product_id", productIds)
        .eq("type", "file")
        .is("deleted_at", null)
        .order("file_size", { ascending: false });
      if (error) throw error;
      const files = (data ?? []) as StorageFile[];
      const totalBytes = files.reduce((sum, f) => sum + (f.file_size ?? 0), 0);
      return { files, totalBytes, quotaBytes: STORAGE_QUOTA_BYTES };
    },
  });

export const useRefreshFileSizes = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("material-file-sizes", { body: {} });
      if (error) throw error;
      const payload = data as { updated?: number; total?: number; error?: string };
      if (payload.error) throw new Error(payload.error);
      return payload;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["creator-storage"] });
      qc.invalidateQueries({ queryKey: ["materials"] });
    },
  });
};

export const useReorderMaterials = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      productId,
      orderedIds,
    }: {
      productId: string;
      orderedIds: string[];
    }) => {
      await Promise.all(
        orderedIds.map((id, index) =>
          supabase.from("materials").update({ order_index: index }).eq("id", id),
        ),
      );
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