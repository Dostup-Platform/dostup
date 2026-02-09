import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

// Get materials uploaded by a specific teacher for their products
export const useTeacherOwnMaterials = (teacherId: string | undefined, productIds: string[]) => {
  return useQuery({
    queryKey: ["teacher-own-materials", teacherId, productIds],
    queryFn: async () => {
      if (!teacherId || !productIds.length) return [];
      
      const { data, error } = await supabase
        .from("materials")
        .select("*")
        .eq("teacher_id", teacherId)
        .in("product_id", productIds)
        .order("order_index", { ascending: true });
      
      if (error) throw error;
      return data as TeacherMaterial[];
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
      const { data, error } = await supabase
        .from("materials")
        .insert({
          product_id: material.product_id,
          teacher_id: material.teacher_id,
          title: material.title,
          type: material.type,
          content: material.content || null,
          file_url: material.file_url || null,
          order_index: material.order_index || 0,
          parent_id: material.parent_id || null,
          allow_view: material.allow_view !== false,
          allow_download: material.allow_download !== false,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["teacher-own-materials"] });
      queryClient.invalidateQueries({ queryKey: ["student-teacher-materials"] });
    },
  });
};

export const useUpdateTeacherMaterial = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, teacherId, ...updates }: Partial<TeacherMaterial> & { id: string; teacherId: string }) => {
      const { data, error } = await supabase
        .from("materials")
        .update(updates)
        .eq("id", id)
        .eq("teacher_id", teacherId)
        .select()
        .single();
      
      if (error) throw error;
      return { ...data, teacherId };
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
    mutationFn: async ({ id, teacherId, file_url }: { id: string; teacherId: string; file_url?: string | null }) => {
      // Delete file from storage if exists
      if (file_url) {
        const path = file_url.split("/materials/")[1] || file_url;
        if (path && !path.startsWith('http')) {
          await supabase.storage.from("materials").remove([path]);
        }
      }
      
      const { error } = await supabase
        .from("materials")
        .delete()
        .eq("id", id)
        .eq("teacher_id", teacherId);
      
      if (error) throw error;
      return { id, teacherId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-own-materials"] });
      queryClient.invalidateQueries({ queryKey: ["student-teacher-materials"] });
    },
  });
};

// Upload material file for teacher
export const uploadTeacherMaterialFile = async (file: File, productId: string, teacherId: string): Promise<string> => {
  // Upload to S3 via edge function
  const { uploadFileToS3 } = await import("@/lib/s3Helpers");
  
  return uploadFileToS3(file, productId, 'teacher', {
    teacherId,
  });
};
