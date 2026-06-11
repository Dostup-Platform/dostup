import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Announcement {
  id: string;
  product_id: string;
  creator_id: string;
  content_html: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export const useAnnouncements = (productId: string | undefined) => {
  return useQuery({
    queryKey: ["announcements", productId],
    queryFn: async () => {
      if (!productId) return [] as Announcement[];
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("product_id", productId)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return (data || []) as Announcement[];
    },
    enabled: !!productId,
  });
};

export const useAnnouncementsForProducts = (productIds: string[]) => {
  return useQuery({
    queryKey: ["announcements-multi", [...productIds].sort().join(",")],
    queryFn: async () => {
      if (productIds.length === 0) return [] as Announcement[];
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .in("product_id", productIds)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return (data || []) as Announcement[];
    },
    enabled: productIds.length > 0,
  });
};

const getCreds = () => ({
  creatorName: localStorage.getItem("creator_name") || "",
  creatorToken: localStorage.getItem("creator_token") || "",
});

const invokeManage = async (body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke("manage-announcements", {
    body: { ...getCreds(), ...body },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
};

export const useCreateAnnouncement = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { productId: string; contentHtml: string }) =>
      invokeManage({ action: "create", productId: input.productId, contentHtml: input.contentHtml }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["announcements", v.productId] });
      qc.invalidateQueries({ queryKey: ["announcements-multi"] });
    },
  });
};

export const useUpdateAnnouncement = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; productId: string; contentHtml: string }) =>
      invokeManage({ action: "update", id: input.id, contentHtml: input.contentHtml }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["announcements", v.productId] });
      qc.invalidateQueries({ queryKey: ["announcements-multi"] });
    },
  });
};

export const useDeleteAnnouncement = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; productId: string }) =>
      invokeManage({ action: "delete", id: input.id }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["announcements", v.productId] });
      qc.invalidateQueries({ queryKey: ["announcements-multi"] });
    },
  });
};

export const useReorderAnnouncements = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { productId: string; ids: string[] }) =>
      invokeManage({ action: "reorder", productId: input.productId, ids: input.ids }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["announcements", v.productId] });
    },
  });
};

export const useSetGroupLink = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { productId: string; groupLinkUrl: string | null; groupLinkLabel: string | null }) =>
      invokeManage({
        action: "set_group_link",
        productId: input.productId,
        groupLinkUrl: input.groupLinkUrl,
        groupLinkLabel: input.groupLinkLabel,
      }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["creator-products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["product", v.productId] });
    },
  });
};

export const uploadAnnouncementMedia = async (
  file: File,
  productId: string,
  kind: "image" | "video",
): Promise<string> => {
  const creatorName = localStorage.getItem("creator_name") || "";
  const creatorToken = localStorage.getItem("creator_token") || "";
  const form = new FormData();
  form.append("file", file);
  form.append("productId", productId);
  form.append("creatorName", creatorName);
  form.append("creatorToken", creatorToken);
  form.append("kind", kind);
  const { data, error } = await supabase.functions.invoke("upload-product-media", { body: form });
  if (error) throw error;
  if (!data?.url) throw new Error(data?.error || "Upload failed");
  return data.url as string;
};