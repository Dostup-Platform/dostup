import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Purchase {
  id: string;
  user_id: string;
  product_id: string | null;
  amount: number;
  status: string;
  payment_intent_id: string | null;
  created_at: string;
}

interface PurchaseWithProduct extends Purchase {
  products: {
    id: string;
    title: string;
    headline: string | null;
    image_url: string | null;
  } | null;
}

export const useUserPurchases = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["purchases", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("purchases")
        .select(`
          *,
          products (
            id,
            title,
            headline,
            image_url
          )
        `)
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as PurchaseWithProduct[];
    },
    enabled: !!user,
  });
};

export const useCreatorPurchases = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["creator-purchases", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      // First get creator's products
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id")
        .eq("creator_id", user.id);
      
      if (productsError) throw productsError;
      
      const productIds = products.map(p => p.id);
      
      if (productIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("purchases")
        .select(`
          *,
          products (
            id,
            title
          ),
          profiles!purchases_user_id_fkey (
            name,
            email,
            phone
          )
        `)
        .in("product_id", productIds)
        .eq("status", "completed")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
};

export const useCreatePurchase = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (purchase: Omit<Purchase, "id" | "created_at">) => {
      const { data, error } = await supabase
        .from("purchases")
        .insert(purchase)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
    },
  });
};

export const useHasPurchased = (productId: string | undefined) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["has-purchased", productId, user?.id],
    queryFn: async () => {
      if (!user || !productId) return false;
      
      const { data, error } = await supabase
        .from("purchases")
        .select("id")
        .eq("user_id", user.id)
        .eq("product_id", productId)
        .eq("status", "completed")
        .maybeSingle();
      
      if (error) throw error;
      return !!data;
    },
    enabled: !!user && !!productId,
  });
};
