import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";

type MaterialType = "file" | "video" | "text" | "folder" | "link";

interface Material {
  id: string;
  product_id: string;
  title: string;
  type: MaterialType;
  content: string | null;
  file_url: string | null;
  order_index: number;
  created_at: string;
  parent_id?: string | null;
  allow_view?: boolean;
  allow_download?: boolean;
  available_at?: string | null;
  teacher_allow_download?: boolean;
  deleted_at?: string | null;
  file_size?: number | null;
  original_parent_id?: string | null;
}

export const useMaterials = (productId: string | undefined, options?: { creatorOnly?: boolean }) => {
  return useQuery({
    queryKey: ["materials", productId, options?.creatorOnly ? "creator" : "all"],
    queryFn: async () => {
      if (!productId) return [];
      
      let query = supabase
        .from("materials")
        .select("*")
        .eq("product_id", productId)
        .is("deleted_at", null);
      
      // Filter to only creator materials (teacher_id is null)
      if (options?.creatorOnly) {
        query = query.is("teacher_id", null);
      }
      
      const { data, error } = await query.order("order_index", { ascending: true });
      
      if (error) throw error;
      return data as Material[];
    },
    enabled: !!productId,
  });
};

// Alias for backward compatibility
export const useProductMaterials = (productId: string | undefined, options?: { creatorOnly?: boolean }) => 
  useMaterials(productId, options);

export const useUserMaterials = () => {
  const { user } = useSimpleAuth();

  return useQuery({
    queryKey: ["user-materials", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      // Get all purchased product IDs for simple_users
      const { data: purchases, error: purchasesError } = await supabase
        .from("simple_purchases")
        .select("product_id")
        .eq("simple_user_id", user.id)
        .eq("status", "confirmed");
      
      if (purchasesError) throw purchasesError;
      
      const productIds = purchases.map(p => p.product_id).filter(Boolean) as string[];
      
      if (productIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("materials")
        .select(`
          *,
          products (
            id,
            title,
            headline
          )
        `)
        .in("product_id", productIds)
        .order("order_index", { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
};

interface CreateMaterialInput {
  product_id: string;
  title: string;
  type: MaterialType;
  content?: string | null;
  file_url?: string | null;
  order_index?: number;
  parent_id?: string | null;
  allow_view?: boolean;
  allow_download?: boolean;
  available_at?: string | null;
  teacher_allow_download?: boolean;
  file_size?: number | null;
}

export const useCreateMaterial = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (material: CreateMaterialInput) => {
      const { data, error } = await supabase
        .from("materials")
        .insert({
          product_id: material.product_id,
          title: material.title,
          type: material.type,
          content: material.content || null,
          file_url: material.file_url || null,
          order_index: material.order_index || 0,
          parent_id: material.parent_id || null,
          allow_view: true,
          allow_download: material.allow_download !== false,
          available_at: material.available_at || null,
          teacher_allow_download: material.teacher_allow_download !== false,
          file_size: material.file_size ?? null,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["materials", variables.product_id] });
      queryClient.invalidateQueries({ queryKey: ["user-materials"] });
    },
  });
};

export const useUpdateMaterial = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, productId, ...updates }: Partial<Material> & { id: string; productId: string }) => {
      const { data, error } = await supabase
        .from("materials")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return { ...data, productId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["materials", data.productId] });
      queryClient.invalidateQueries({ queryKey: ["user-materials"] });
    },
  });
};

export const useDeleteMaterial = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, productId }: { id: string; productId: string; file_url?: string | null }) => {
      // Soft delete — move to trash. Snapshot the source folder so we can restore
      // back to it. We also clear parent_id to avoid cascade deletes from the
      // parent folder hard-deleting trashed children.
      const { data: cur } = await supabase
        .from("materials")
        .select("parent_id, original_parent_id")
        .eq("id", id)
        .maybeSingle();
      const snapshot = cur?.original_parent_id ?? cur?.parent_id ?? null;
      const { error } = await supabase
        .from("materials")
        .update({
          deleted_at: new Date().toISOString(),
          original_parent_id: snapshot,
          parent_id: null,
        })
        .eq("id", id);
      if (error) throw error;
      return { id, productId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["materials", data.productId] });
      queryClient.invalidateQueries({ queryKey: ["user-materials"] });
      queryClient.invalidateQueries({ queryKey: ["deleted-materials", data.productId] });
    },
  });
};

export const useDeletedMaterials = (productId: string | undefined) => {
  return useQuery({
    queryKey: ["deleted-materials", productId],
    queryFn: async () => {
      if (!productId) return [];
      const { data, error } = await supabase
        .from("materials")
        .select("*")
        .eq("product_id", productId)
        .is("teacher_id", null)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Material[];
    },
    enabled: !!productId,
  });
};

export const useRestoreMaterial = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      productId,
      targetParentId,
    }: {
      id: string;
      productId: string;
      // undefined → auto (original folder if exists, otherwise root)
      // null     → forced root
      // string   → forced into that folder
      targetParentId?: string | null;
    }) => {
      const { data: cur } = await supabase
        .from("materials")
        .select("original_parent_id")
        .eq("id", id)
        .maybeSingle();
      const orig = cur?.original_parent_id ?? null;

      let parent: string | null = null;
      let restoredTo: "original" | "root" | "custom" = "root";

      if (targetParentId === undefined) {
        if (orig) {
          const { data: folder } = await supabase
            .from("materials")
            .select("id, title, deleted_at")
            .eq("id", orig)
            .maybeSingle();
          if (folder && !folder.deleted_at) {
            parent = orig;
            restoredTo = "original";
          }
        }
      } else if (targetParentId) {
        parent = targetParentId;
        restoredTo = "custom";
      }

      const { error } = await supabase
        .from("materials")
        .update({ deleted_at: null, parent_id: parent, original_parent_id: null })
        .eq("id", id);
      if (error) throw error;
      return { id, productId, restoredTo, parentId: parent };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["materials", data.productId] });
      queryClient.invalidateQueries({ queryKey: ["deleted-materials", data.productId] });
    },
  });
};

export const usePermanentlyDeleteMaterial = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, productId, file_url }: { id: string; productId: string; file_url?: string | null }) => {
      if (file_url) {
        const path = file_url.split("/materials/")[1];
        if (path) {
          await supabase.storage.from("materials").remove([path]);
        }
      }
      const { error } = await supabase.from("materials").delete().eq("id", id);
      if (error) throw error;
      return { id, productId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["deleted-materials", data.productId] });
      queryClient.invalidateQueries({ queryKey: ["materials", data.productId] });
    },
  });
};

export const useEmptyTrash = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId }: { productId: string }) => {
      const { data: rows } = await supabase
        .from("materials")
        .select("id, file_url")
        .eq("product_id", productId)
        .is("teacher_id", null)
        .not("deleted_at", "is", null);
      const paths = (rows ?? [])
        .map((r: { file_url: string | null }) => r.file_url?.split("/materials/")[1])
        .filter((p): p is string => !!p);
      if (paths.length) {
        await supabase.storage.from("materials").remove(paths);
      }
      const { error } = await supabase
        .from("materials")
        .delete()
        .eq("product_id", productId)
        .is("teacher_id", null)
        .not("deleted_at", "is", null);
      if (error) throw error;
      return { productId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["deleted-materials", data.productId] });
    },
  });
};

/**
 * All creator-owned, live (not trashed) materials across all of the creator's products.
 * Used by the Storage view to compute total usage and list files by size.
 */
export const useAllCreatorMaterials = (creatorName: string | undefined) => {
  return useQuery({
    queryKey: ["all-creator-materials", creatorName],
    queryFn: async () => {
      if (!creatorName) return [];
      const { data: products, error: pErr } = await supabase
        .from("products")
        .select("id, title")
        .eq("creator_id", creatorName);
      if (pErr) throw pErr;
      const ids = (products ?? []).map((p) => p.id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("materials")
        .select("id, product_id, title, type, file_url, file_size, created_at")
        .in("product_id", ids)
        .eq("type", "file")
        .is("teacher_id", null)
        .is("deleted_at", null);
      if (error) throw error;
      const titleMap = new Map((products ?? []).map((p) => [p.id, p.title]));
      return (data ?? []).map((m) => ({
        ...m,
        product_title: titleMap.get(m.product_id) ?? "",
      }));
    },
    enabled: !!creatorName,
  });
};

export const uploadMaterialFile = async (
  file: File, 
  productId: string,
  onProgress?: (progress: number) => void
): Promise<string> => {
  // Upload to S3 via presigned URL
  const { uploadFileToS3 } = await import("@/lib/s3Helpers");
  
  // Get creator session from localStorage
  const creatorToken = localStorage.getItem('creator_token') || '';
  const creatorName = localStorage.getItem('creator_name') || '';
  
  return uploadFileToS3(file, productId, 'creator', {
    creatorToken,
    creatorName,
    onProgress,
  });
};
