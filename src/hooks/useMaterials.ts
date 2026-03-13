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
}

export const useMaterials = (productId: string | undefined, options?: { creatorOnly?: boolean }) => {
  return useQuery({
    queryKey: ["materials", productId, options?.creatorOnly ? "creator" : "all"],
    queryFn: async () => {
      if (!productId) return [];
      
      let query = supabase
        .from("materials")
        .select("*")
        .eq("product_id", productId);
      
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
    mutationFn: async ({ id, productId, file_url }: { id: string; productId: string; file_url?: string | null }) => {
      // Delete file from storage if exists
      if (file_url) {
        const path = file_url.split("/materials/")[1];
        if (path) {
          await supabase.storage.from("materials").remove([path]);
        }
      }
      
      const { error } = await supabase
        .from("materials")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
      return { id, productId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["materials", data.productId] });
      queryClient.invalidateQueries({ queryKey: ["user-materials"] });
    },
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
