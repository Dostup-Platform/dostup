import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Product {
  id: string;
  creator_id: string;
  owner_id: string | null;
  title: string;
  headline: string | null;
  description: string | null;
  price: number;
  image_url: string | null;
  has_schedule: boolean;
  is_active: boolean;
  slug: string | null;
  kaspi_link: string | null;
  telegram_link: string | null;
  video_url: string | null;
  faq: unknown;
  kaspi_phone: string | null;
  access_duration_days: number | null;
  group_link_label: string | null;
  is_paused: boolean;
  paused_message: string | null;
  created_at: string;
  updated_at: string;
}

export const useProducts = () => {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Product[];
    },
  });
};

export const useProduct = (productId: string | undefined) => {
  return useQuery({
    queryKey: ["product", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Product | null;
    },
  });
};