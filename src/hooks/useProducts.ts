import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Product {
  id: string;
  creator_id: string;
  title: string;
  headline: string | null;
  description: string | null;
  price: number;
  image_url: string | null;
  has_schedule: boolean;
  is_active: boolean;
  slug: string | null;
  created_at: string;
  updated_at: string;
  kaspi_link: string | null;
}

export const useProduct = (productId: string | undefined) => {
  return useQuery({
    queryKey: ["product", productId],
    queryFn: async () => {
      if (!productId) return null;
      
      // Try to find by slug first, then by id
      let { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("slug", productId)
        .eq("is_active", true)
        .maybeSingle();
      
      if (!data) {
        const result = await supabase
          .from("products")
          .select("*")
          .eq("id", productId)
          .eq("is_active", true)
          .maybeSingle();
        
        data = result.data;
        error = result.error;
      }
      
      if (error) throw error;
      return data as Product | null;
    },
    enabled: !!productId,
  });
};

export const useCreatorProducts = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["creator-products", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("creator_id", user.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!user,
  });
};

export const useCreateProduct = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (product: Omit<Product, "id" | "creator_id" | "created_at" | "updated_at">) => {
      if (!user) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from("products")
        .insert({
          ...product,
          creator_id: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-products"] });
    },
  });
};

export const useUpdateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Product> & { id: string }) => {
      const { data, error } = await supabase
        .from("products")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-products"] });
      queryClient.invalidateQueries({ queryKey: ["product"] });
    },
  });
};
