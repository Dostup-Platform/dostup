import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sessionCreds, studentCreds, invokeApi } from "@/lib/sessionApi";

type MaterialType = "file" | "video" | "text" | "folder" | "link";

interface TeacherMaterial {
  id: string;
  product_id: string;
  teacher_id: string;
  title: string;
  type: MaterialType;
  content: string | null;
  file_url: string | null;
  order_index: number;
  created_at: string;
  parent_id?: string | null;
  allow_view?: boolean;
  allow_download?: boolean;
}

export const useTeacherOwnMaterials = (teacherId: string | undefined, productIds: string[]) => {
  return useQuery({
    queryKey: ["teacher-own-materials", teacherId, productIds],
    queryFn: async () => {
      if (!teacherId || !productIds.length) return [];
      const all: TeacherMaterial[] = [];
      for (const productId of productIds) {
        const data = await invokeApi<{ materials: TeacherMaterial[] }>("manage-materials", {
          action: "list",
          ...sessionCreds(),
          productId,
          teacherId,
        });
        all.push(...(data.materials ?? []));
      }
      return all;
    },
    enabled: !!teacherId && productIds.length > 0,
  });
};

interface CreateTeacherMaterialInput {
  product_id: string;
  teacher_id: string;
  title: string;
  type: MaterialType;
  content?: string | null;
  file_url?: string | null;
  order_index?: number;
  parent_id?: string | null;
  allow_view?: boolean;
  allow_download?: boolean;
}

export const useCreateTeacherMaterial = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (material: CreateTeacherMaterialInput) => {
      const data = await invokeApi<{ material: TeacherMaterial }>("manage-materials", {
        action: "create",
        ...sessionCreds(),
        material,
      });
      return data.material;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-own-materials"] });
      queryClient.invalidateQueries({ queryKey: ["student-teacher-materials"] });
    },
  });
};

export const useUpdateTeacherMaterial = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, teacherId, ...updates }: Partial<TeacherMaterial> & { id: string; teacherId: string }) => {
      const data = await invokeApi<{ material: TeacherMaterial }>("manage-materials", {
        action: "update",
        ...sessionCreds(),
        id,
        updates,
      });
      return { ...data.material, teacherId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-own-materials"] });
      queryClient.invalidateQueries({ queryKey: ["student-teacher-materials"] });
    },
  });
};

export const useDeleteTeacherMaterial = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, teacherId }: { id: string; teacherId: string; file_url?: string | null }) => {
      await invokeApi("manage-materials", {
        action: "hard_delete",
        ...sessionCreds(),
        id,
      });
      return { id, teacherId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-own-materials"] });
      queryClient.invalidateQueries({ queryKey: ["student-teacher-materials"] });
    },
  });
};

export const uploadTeacherMaterialFile = async (
  file: File,
  productId: string,
  teacherId: string,
  onProgress?: (progress: number) => void,
): Promise<string> => {
  const { uploadFileToS3 } = await import("@/lib/s3Helpers");
  return uploadFileToS3(file, productId, "teacher", {
    teacherId,
    sessionToken: localStorage.getItem("simple_session_token") || "",
    onProgress,
  });
};
