import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Announcement {
  id: string;
  product_id: string;
  owner_id: string | null;
  content_html: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export const useAnnouncements = (productId: string | undefined) =>
  useQuery({
    queryKey: ["announcements", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("product_id", productId!)
        .order("order_index", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Announcement[];
    },
  });

export const useCreateAnnouncement = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { productId: string; ownerId: string; contentHtml: string }) => {
      const { data: maxRow } = await supabase
        .from("announcements")
        .select("order_index")
        .eq("product_id", v.productId)
        .order("order_index", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextIndex = ((maxRow?.order_index as number | undefined) ?? -1) + 1;
      const { data, error } = await supabase
        .from("announcements")
        .insert({
          product_id: v.productId,
          owner_id: v.ownerId,
          creator_id: v.ownerId,
          content_html: v.contentHtml,
          order_index: nextIndex,
        } as never)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Announcement;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["announcements", v.productId] }),
  });
};

export const useUpdateAnnouncement = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; productId: string; contentHtml: string }) => {
      const { error } = await supabase
        .from("announcements")
        .update({ content_html: v.contentHtml })
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["announcements", v.productId] }),
  });
};

export const useDeleteAnnouncement = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; productId: string }) => {
      const { error } = await supabase.from("announcements").delete().eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["announcements", v.productId] }),
  });
};