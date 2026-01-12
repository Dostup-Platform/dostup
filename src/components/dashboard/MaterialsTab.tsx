import { Card, CardContent } from "@/components/ui/card";
import { useUserMaterials } from "@/hooks/useMaterials";
import { useLanguage } from "@/contexts/LanguageContext";
import { FileText, Video, Type, Download, ExternalLink, Link as LinkIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const getIcon = (type: string) => {
  switch (type) {
    case "video":
      return <Video className="w-5 h-5" />;
    case "file":
      return <FileText className="w-5 h-5" />;
    case "text":
      return <Type className="w-5 h-5" />;
    case "link":
      return <LinkIcon className="w-5 h-5" />;
    default:
      return <FileText className="w-5 h-5" />;
  }
};

const MaterialsTab = () => {
  const { data: materials, isLoading } = useUserMaterials();
  const { t } = useLanguage();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const groupedMaterials = materials?.reduce((acc, material) => {
    const productTitle = (material as any).products?.title || "Продукт";
    if (!acc[productTitle]) {
      acc[productTitle] = [];
    }
    acc[productTitle].push(material);
    return acc;
  }, {} as Record<string, typeof materials>) || {};

  const hasNoMaterials = !materials || materials.length === 0;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">{t("myMaterials")}</h2>

      {hasNoMaterials ? (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-muted-foreground">{t("noMaterials")}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {t("purchaseToAccess")}
          </p>
        </div>
      ) : (
        Object.entries(groupedMaterials).map(([productTitle, productMaterials]) => (
          <div key={productTitle} className="space-y-3">
            <h3 className="font-medium text-muted-foreground">{productTitle}</h3>
            {productMaterials?.map((material, index) => (
              <Card 
                key={material.id} 
                className="animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      {getIcon(material.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground">{material.title}</h3>
                      <p className="text-sm text-muted-foreground capitalize mt-0.5">
                        {material.type}
                      </p>
                      
                      {material.type === "text" && material.content && (
                        <p className="text-sm text-muted-foreground mt-3 whitespace-pre-line">
                          {material.content}
                        </p>
                      )}
                    </div>
                    
                    {material.type === "file" && material.file_url && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="flex-shrink-0"
                        onClick={() => window.open(material.file_url!, "_blank")}
                      >
                        <Download className="w-5 h-5" />
                      </Button>
                    )}
                    
                    {(material.type === "video" || material.type === "link") && material.file_url && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="flex-shrink-0"
                        onClick={() => window.open(material.file_url!, "_blank")}
                      >
                        <ExternalLink className="w-5 h-5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ))
      )}
    </div>
  );
};

export default MaterialsTab;
