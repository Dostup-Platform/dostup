import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sessionCreds, invokeApi } from "@/lib/sessionApi";

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

export const useMaterialBookmarks = (viewer: BookmarkViewer | null) => {
  return useQuery({
    queryKey: ["material-bookmarks", viewer?.userType, viewer?.userRef],
    enabled: !!viewer?.userRef,
    queryFn: async () => {
      if (!viewer?.userRef) return [] as MaterialBookmark[];
      const data = await invokeApi<{ bookmarks: MaterialBookmark[] }>("manage-materials", {
        action: "list_bookmarks",
        ...sessionCreds(),
      });
      return data.bookmarks ?? [];
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
      const data = await invokeApi<{ deleted: boolean }>("manage-materials", {
        action: "toggle_bookmark",
        ...sessionCreds(),
        materialId,
        existingId,
      });
      return data;
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
      await invokeApi("manage-materials", {
        action: "set_bookmark_public",
        ...sessionCreds(),
        id,
        isPublic,
      });
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
      await invokeApi("manage-materials", {
        action: "set_bookmark_public",
        ...sessionCreds(),
        ids,
        isPublic,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["material-bookmarks", viewer?.userType, viewer?.userRef] });
    },
  });
};
