import { Card, CardContent } from "@/components/ui/card";
import { demoMaterials, demoProduct } from "@/lib/demo-data";
import { FileText, Video, Type, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const getIcon = (type: string) => {
  switch (type) {
    case "video":
      return <Video className="w-5 h-5" />;
    case "file":
      return <FileText className="w-5 h-5" />;
    case "text":
      return <Type className="w-5 h-5" />;
    default:
      return <FileText className="w-5 h-5" />;
  }
};

const MaterialsTab = () => {
  const product = demoProduct;
  const materials = demoMaterials;

  return (
    <div className="space-y-6">
      {/* Product Info */}
      <div>
        <h2 className="text-lg font-semibold text-foreground">{product.title}</h2>
        <p className="text-sm text-muted-foreground mt-1">{product.headline}</p>
      </div>

      {/* Materials List */}
      <div className="space-y-3">
        {materials.map((material, index) => (
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
                  
                  {material.type === "text" && (
                    <p className="text-sm text-muted-foreground mt-3 whitespace-pre-line">
                      {material.content}
                    </p>
                  )}
                </div>
                
                {material.type === "file" && (
                  <Button variant="ghost" size="icon" className="flex-shrink-0">
                    <Download className="w-5 h-5" />
                  </Button>
                )}
                
                {material.type === "video" && (
                  <Button variant="ghost" size="icon" className="flex-shrink-0">
                    <ExternalLink className="w-5 h-5" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {materials.length === 0 && (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-muted-foreground">No materials available yet</p>
        </div>
      )}
    </div>
  );
};

export default MaterialsTab;
