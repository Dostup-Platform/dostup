import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MaterialBookmark {
  id: string;
  material_id: string;
  user_id: string;
  is_public: boolean;
  created_at: string;
}

export const useMaterialBookmarks = (userId: string | undefined, materialIds: string[]) =>
  useQuery({
    queryKey: ["material-bookmarks", userId, materialIds.sort().join(",")],
    enabled: !!userId && materialIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("material_bookmarks")
        .select("*")
        .eq("user_id", userId!)
        .in("material_id", materialIds);
      if (error) throw error;
      return (data ?? []) as MaterialBookmark[];
    },
  });

// Public bookmarks (recommended by the creator) for materials students can see,
// regardless of who owns them - relies on RLS allowing is_public=true rows to be read.
export const usePublicMaterialBookmarks = (materialIds: string[]) =>
  useQuery({
    queryKey: ["public-material-bookmarks", materialIds.sort().join(",")],
    enabled: materialIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("material_bookmarks")
        .select("*")
        .eq("is_public", true)
        .in("material_id", materialIds);
      if (error) throw error;
      return (data ?? []) as MaterialBookmark[];
    },
  });

export const useToggleBookmark = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      materialId,
      userId,
      bookmarked,
    }: {
      materialId: string;
      userId: string;
      bookmarked: boolean;
    }) => {
      if (bookmarked) {
        const { error } = await supabase
          .from("material_bookmarks")
          .delete()
          .eq("material_id", materialId)
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("material_bookmarks")
          .insert({ material_id: materialId, user_id: userId, is_public: false });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["material-bookmarks"] });
      qc.invalidateQueries({ queryKey: ["public-material-bookmarks"] });
    },
  });
};

export const useSetBookmarkPublic = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      materialId,
      userId,
      isPublic,
    }: {
      materialId: string;
      userId: string;
      isPublic: boolean;
    }) => {
      const { error } = await supabase
        .from("material_bookmarks")
        .update({ is_public: isPublic })
        .eq("material_id", materialId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["material-bookmarks"] });
      qc.invalidateQueries({ queryKey: ["public-material-bookmarks"] });
    },
  });
};
