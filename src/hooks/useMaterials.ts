import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type MaterialType = "file" | "video" | "text";

interface Material {
  id: string;
  product_id: string;
  title: string;
  type: MaterialType;
  content: string | null;
  file_url: string | null;
  order_index: number;
  created_at: string;
}

export const useMaterials = (productId: string | undefined) => {
  return useQuery({
    queryKey: ["materials", productId],
    queryFn: async () => {
      if (!productId) return [];
      
      const { data, error } = await supabase
        .from("materials")
        .select("*")
        .eq("product_id", productId)
        .order("order_index", { ascending: true });
      
      if (error) throw error;
      return data as Material[];
    },
    enabled: !!productId,
  });
};

// Alias for backward compatibility
export const useProductMaterials = useMaterials;

export const useUserMaterials = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-materials", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      // Get all purchased product IDs
      const { data: purchases, error: purchasesError } = await supabase
        .from("purchases")
        .select("product_id")
        .eq("user_id", user.id)
        .eq("status", "completed");
      
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

export const uploadMaterialFile = async (file: File, productId: string): Promise<string> => {
  const fileExt = file.name.split(".").pop();
  const fileName = `${productId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  
  const { error: uploadError } = await supabase.storage
    .from("materials")
    .upload(fileName, file);
  
  if (uploadError) throw uploadError;
  
  const { data } = supabase.storage.from("materials").getPublicUrl(fileName);
  return data.publicUrl;
};
