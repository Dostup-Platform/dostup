import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type MaterialType = "file" | "video" | "text" | "link";

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

export const useCreateMaterial = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (material: Omit<Material, "id" | "created_at">) => {
      const { data, error } = await supabase
        .from("materials")
        .insert(material)
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

export const useDeleteMaterial = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, productId }: { id: string; productId: string }) => {
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
