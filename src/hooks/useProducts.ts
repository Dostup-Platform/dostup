import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";

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
  const { user } = useSimpleAuth();

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
    enabled: !!user && user.role === "creator",
  });
};

interface CreateProductInput {
  title: string;
  headline?: string | null;
  description?: string | null;
  price: number;
  kaspi_link?: string | null;
  has_schedule?: boolean;
  is_active?: boolean;
  image_url?: string | null;
  slug?: string | null;
}

export const useCreateProduct = () => {
  const queryClient = useQueryClient();
  const { user } = useSimpleAuth();

  return useMutation({
    mutationFn: async (product: CreateProductInput) => {
      if (!user) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from("products")
        .insert({
          title: product.title,
          headline: product.headline || null,
          description: product.description || null,
          price: product.price,
          kaspi_link: product.kaspi_link || null,
          has_schedule: product.has_schedule || false,
          is_active: product.is_active ?? true,
          image_url: product.image_url || null,
          slug: product.slug || null,
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

export const useDeleteProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", productId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-products"] });
    },
  });
};
