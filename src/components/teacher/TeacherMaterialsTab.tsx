import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { FileText, ExternalLink, Loader2, Video, Link as LinkIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface TeacherMaterialsTabProps {
  productIds: string[];
}

interface Material {
  id: string;
  title: string;
  type: "file" | "video" | "text" | "link";
  content: string | null;
  file_url: string | null;
  product_id: string;
  product?: { title: string };
}

const TeacherMaterialsTab = ({ productIds }: TeacherMaterialsTabProps) => {
  const { language } = useLanguage();

  const { data: materials = [], isLoading } = useQuery({
    queryKey: ["teacher-materials", productIds],
    queryFn: async () => {
      if (!productIds.length) return [];

      const { data, error } = await supabase
        .from("materials")
        .select("id, title, type, content, file_url, product_id")
        .in("product_id", productIds)
        .order("order_index");

      if (error) throw error;

      // Get product titles
      const { data: products } = await supabase
        .from("products")
        .select("id, title")
        .in("id", productIds);

      return (data || []).map(m => ({
        ...m,
        product: products?.find(p => p.id === m.product_id),
      })) as Material[];
    },
    enabled: productIds.length > 0,
  });

  // Group materials by product
  const groupedMaterials = materials.reduce((acc, material) => {
    const productTitle = material.product?.title || "Unknown";
    if (!acc[productTitle]) {
      acc[productTitle] = [];
    }
    acc[productTitle].push(material);
    return acc;
  }, {} as Record<string, Material[]>);

  const getIcon = (type: string) => {
    switch (type) {
      case "video":
        return <Video className="w-5 h-5" />;
      case "link":
        return <LinkIcon className="w-5 h-5" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  const handleOpenMaterial = async (material: Material) => {
    if (material.type === "link" && material.content) {
      window.open(material.content, "_blank");
    } else if (material.file_url) {
      // Request signed URL from edge function
      try {
        const { data, error } = await supabase.functions.invoke("get-material-url", {
          body: { fileUrl: material.file_url },
        });
        
        if (error) throw error;
        if (data?.signedUrl) {
          window.open(data.signedUrl, "_blank");
        }
      } catch (error) {
        console.error("Error getting material URL:", error);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (materials.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
        <p className="text-muted-foreground">
          {language === "ru" ? "Материалов пока нет" : "Материалдар әзірше жоқ"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">
        {language === "ru" ? "Материалы курсов" : "Курс материалдары"}
      </h2>

      {Object.entries(groupedMaterials).map(([productTitle, productMaterials]) => (
        <div key={productTitle} className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">{productTitle}</h3>
          <div className="space-y-2">
            {productMaterials.map((material) => (
              <Card key={material.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      {getIcon(material.type)}
                    </div>
                    <div>
                      <p className="font-medium">{material.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">{material.type}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenMaterial(material)}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      <p className="text-xs text-muted-foreground text-center">
        {language === "ru" 
          ? "Только просмотр. Редактирование доступно автору курса."
          : "Тек қарау. Өңдеу курс авторына қолжетімді."}
      </p>
    </div>
  );
};

export default TeacherMaterialsTab;
