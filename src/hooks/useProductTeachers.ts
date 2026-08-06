import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ProductTeacher {
  id: string;
  product_id: string;
  teacher_name: string;
  created_at: string;
}

// Получить учителей для продукта
export const useProductTeachers = (productId: string | undefined) => {
  return useQuery({
    queryKey: ["product-teachers", productId],
    queryFn: async () => {
      if (!productId) return [];
      
      const { data, error } = await supabase
        .from("product_teachers")
        .select("*")
        .eq("product_id", productId)
        .order("created_at");
      
      if (error) throw error;
      return data as ProductTeacher[];
    },
    enabled: !!productId,
  });
};

// Получить всех учителей для всех продуктов создателя
export const useCreatorTeachers = (productIds: string[]) => {
  return useQuery({
    queryKey: ["creator-teachers", productIds],
    queryFn: async () => {
      if (!productIds.length) return [];
      
      const { data, error } = await supabase
        .from("product_teachers")
        .select("*, product:products(title)")
        .in("product_id", productIds)
        .order("created_at");
      
      if (error) throw error;
      return data as (ProductTeacher & { product: { title: string } | null })[];
    },
    enabled: productIds.length > 0,
  });
};

// Добавить учителя к продукту
export const useAddProductTeacher = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, teacherName }: { productId: string; teacherName: string }) => {
      const { data, error } = await supabase
        .from("product_teachers")
        .insert({
          product_id: productId,
          teacher_name: teacherName.trim(),
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error("Этот учитель уже добавлен к продукту");
        }
        throw error;
      }
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["product-teachers", variables.productId] });
      queryClient.invalidateQueries({ queryKey: ["creator-teachers"] });
    },
  });
};

// Удалить учителя из продукта
export const useRemoveProductTeacher = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (teacherId: string) => {
      const { error } = await supabase
        .from("product_teachers")
        .delete()
        .eq("id", teacherId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-teachers"] });
      queryClient.invalidateQueries({ queryKey: ["creator-teachers"] });
    },
  });
};

// Проверить, является ли пользователь учителем для каких-либо продуктов
export const useTeacherProducts = (teacherName: string | undefined) => {
  return useQuery({
    queryKey: ["teacher-products", teacherName],
    queryFn: async () => {
      if (!teacherName) return [];

      const { data, error } = await supabase
        .from("product_teachers")
        .select("*, product:products(*)")
        .eq("teacher_name", teacherName);

      if (error) throw error;
      return data || [];
    },
    enabled: !!teacherName,
  });
};
