import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Purchase {
  id: string;
  user_id: string;
  product_id: string | null;
  amount: number;
  status: string;
  payment_intent_id: string | null;
  created_at: string;
}

export interface PurchaseWithProduct extends Purchase {
  product?: { id: string; title: string; image_url: string | null; price: number; has_schedule?: boolean } | null;
  buyer?: { user_id: string; name: string | null; email: string | null } | null;
}

export const useMyPurchases = (userId: string | undefined) =>
  useQuery({
    queryKey: ["my-purchases", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select("*, product:products(id,title,image_url,price,has_schedule)")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PurchaseWithProduct[];
    },
  });

export const useCreatorPurchases = (ownerId: string | undefined) =>
  useQuery({
    queryKey: ["creator-purchases", ownerId],
    enabled: !!ownerId,
    queryFn: async () => {
      const { data: prods } = await supabase.from("products").select("id").eq("owner_id", ownerId!);
      const ids = (prods ?? []).map((p) => p.id);
      if (ids.length === 0) return [] as PurchaseWithProduct[];
      const { data, error } = await supabase
        .from("purchases")
        .select("*, product:products(id,title,image_url,price)")
        .in("product_id", ids)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as PurchaseWithProduct[];
      const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles").select("user_id,name,email").in("user_id", userIds);
        const map = new Map((profs ?? []).map((p) => [p.user_id, p]));
        for (const r of rows) r.buyer = (map.get(r.user_id) as any) ?? null;
      }
      return rows;
    },
  });

export const useCreatePurchase = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, userId, amount }: { productId: string; userId: string; amount: number }) => {
      const { data: existing } = await supabase
        .from("purchases").select("id,status")
        .eq("user_id", userId).eq("product_id", productId)
        .in("status", ["pending", "completed"]).maybeSingle();
      if (existing) return existing;
      const { data, error } = await supabase
        .from("purchases")
        .insert({ user_id: userId, product_id: productId, amount, status: "pending" })
        .select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-purchases"] }),
  });
};

export const useApprovePurchase = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (purchaseId: string) => {
      const { data, error } = await supabase.functions.invoke("approve-purchase", {
        body: { purchaseId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["creator-purchases"] }),
  });
};

export const useRejectPurchase = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (purchaseId: string) => {
      const { error } = await supabase.from("purchases").update({ status: "rejected" }).eq("id", purchaseId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["creator-purchases"] }),
  });
};