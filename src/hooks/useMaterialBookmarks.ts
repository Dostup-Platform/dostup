import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BookmarkUserType = "creator" | "teacher" | "student";

export interface BookmarkViewer {
  userType: BookmarkUserType;
  userRef: string;
}

export interface MaterialBookmark {
  id: string;
  material_id: string;
  user_type: BookmarkUserType;
  user_ref: string;
  is_public: boolean;
  created_at: string;
}

/**
 * Load:
 *  - The viewer's own bookmarks
 *  - All public bookmarks made by ANY creator (so teachers/students see author marks)
 *
 * We don't restrict by product here — caller filters by material ids.
 */
export const useMaterialBookmarks = (viewer: BookmarkViewer | null) => {
  return useQuery({
    queryKey: ["material-bookmarks", viewer?.userType, viewer?.userRef],
    enabled: !!viewer?.userRef,
    queryFn: async () => {
      if (!viewer?.userRef) return [] as MaterialBookmark[];
      const orParts = [
        `and(user_type.eq.${viewer.userType},user_ref.eq.${viewer.userRef})`,
        `and(user_type.eq.creator,is_public.eq.true)`,
      ];
      const { data, error } = await supabase
        .from("material_bookmarks")
        .select("*")
        .or(orParts.join(","));
      if (error) throw error;
      return (data ?? []) as MaterialBookmark[];
    },
  });
};

export interface BookmarkState {
  mine: MaterialBookmark | null;
  authorPublic: MaterialBookmark | null;
}

export const indexBookmarks = (
  rows: MaterialBookmark[],
  viewer: BookmarkViewer | null,
): Map<string, BookmarkState> => {
  const map = new Map<string, BookmarkState>();
  if (!rows.length) return map;
  for (const row of rows) {
    const slot = map.get(row.material_id) ?? { mine: null, authorPublic: null };
    if (viewer && row.user_type === viewer.userType && row.user_ref === viewer.userRef) {
      slot.mine = row;
    }
    if (row.user_type === "creator" && row.is_public) {
      // Don't overwrite "mine" with the same row (creator viewing own public bookmark).
      if (!slot.authorPublic) slot.authorPublic = row;
    }
    map.set(row.material_id, slot);
  }
  return map;
};

export const useToggleBookmark = (viewer: BookmarkViewer | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      materialId,
      existingId,
    }: { materialId: string; existingId: string | null }) => {
      if (!viewer?.userRef) throw new Error("no viewer");
      if (existingId) {
        const { error } = await supabase
          .from("material_bookmarks")
          .delete()
          .eq("id", existingId);
        if (error) throw error;
        return { deleted: true };
      }
      const { error } = await supabase.from("material_bookmarks").insert({
        material_id: materialId,
        user_type: viewer.userType,
        user_ref: viewer.userRef,
        is_public: false,
      });
      if (error) throw error;
      return { deleted: false };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["material-bookmarks", viewer?.userType, viewer?.userRef] });
    },
  });
};

export const useToggleBookmarkPublic = (viewer: BookmarkViewer | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isPublic }: { id: string; isPublic: boolean }) => {
      const { error } = await supabase
        .from("material_bookmarks")
        .update({ is_public: isPublic })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["material-bookmarks", viewer?.userType, viewer?.userRef] });
    },
  });
};

export const useBulkSetBookmarksPublic = (viewer: BookmarkViewer | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, isPublic }: { ids: string[]; isPublic: boolean }) => {
      if (!ids.length) return;
      const { error } = await supabase
        .from("material_bookmarks")
        .update({ is_public: isPublic })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["material-bookmarks", viewer?.userType, viewer?.userRef] });
    },
  });
};
