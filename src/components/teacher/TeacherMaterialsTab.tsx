 import { useQuery } from "@tanstack/react-query";
 import { useState, useCallback } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { useLanguage } from "@/contexts/LanguageContext";
 import { FileText, ExternalLink, Loader2, Video, Link as LinkIcon, Folder, Eye, Download } from "lucide-react";
 import { Card, CardContent } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
 import { toast } from "sonner";
 
 interface TeacherMaterialsTabProps {
   productIds: string[];
 }
 
 interface Material {
   id: string;
   title: string;
   type: "file" | "video" | "text" | "link" | "folder";
   content: string | null;
   file_url: string | null;
   product_id: string;
   product?: { title: string };
  allow_view?: boolean;
  allow_download?: boolean;
 }
 
 const TeacherMaterialsTab = ({ productIds }: TeacherMaterialsTabProps) => {
   const { language } = useLanguage();
   const [openingFile, setOpeningFile] = useState<Material | null>(null);
   const [isLoadingUrl, setIsLoadingUrl] = useState(false);
 
   const { data: materials = [], isLoading } = useQuery({
     queryKey: ["teacher-materials", productIds],
     queryFn: async () => {
       if (!productIds.length) return [];
 
       const { data, error } = await supabase
         .from("materials")
        .select("id, title, type, content, file_url, product_id, allow_view, allow_download")
         .in("product_id", productIds)
         .order("order_index");
 
       if (error) throw error;
 
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
       case "folder":
         return <Folder className="w-5 h-5" />;
       default:
         return <FileText className="w-5 h-5" />;
     }
   };
 
   const handleOpenFile = useCallback(async (material: Material, action: 'view' | 'download') => {
     if (!material.file_url) return;
     
     try {
       setIsLoadingUrl(true);
       
       const isPath = !material.file_url.startsWith('http');
       
       let url = material.file_url;
       if (isPath) {
         const { data, error } = await supabase.storage
           .from('materials')
           .createSignedUrl(material.file_url, 3600);
         
         if (error) throw error;
         url = data.signedUrl;
       }
       
       if (action === 'download') {
         const link = document.createElement('a');
         link.href = url;
         link.download = material.title;
         document.body.appendChild(link);
         link.click();
         document.body.removeChild(link);
       } else {
         window.open(url, '_blank');
       }
       
       setOpeningFile(null);
     } catch (err) {
       console.error('Error getting file URL:', err);
       toast.error('Ошибка при открытии файла');
     } finally {
       setIsLoadingUrl(false);
     }
   }, []);
 
   const handleOpenMaterial = (material: Material) => {
     if (material.type === "link" && material.content) {
       window.open(material.content, "_blank");
     } else if (material.file_url) {
       setOpeningFile(material);
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
                   {material.type !== "folder" && (
                    (material.allow_view !== false || material.allow_download !== false) && (
                     <Button
                       variant="ghost"
                       size="icon"
                       onClick={() => handleOpenMaterial(material)}
                     >
                       <ExternalLink className="w-4 h-4" />
                     </Button>
                    )
                   )}
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
 
       <Dialog open={!!openingFile} onOpenChange={(open) => { if (!open) setOpeningFile(null); }}>
         <DialogContent className="max-w-sm">
           <DialogHeader>
             <DialogTitle>Открыть файл</DialogTitle>
             <DialogDescription>
               {openingFile?.title}
             </DialogDescription>
           </DialogHeader>
           <div className="flex flex-col gap-3 mt-4">
            {openingFile?.allow_view !== false && (
             <Button
               onClick={() => openingFile && handleOpenFile(openingFile, 'view')}
               disabled={isLoadingUrl}
               className="w-full"
             >
               {isLoadingUrl ? (
                 <Loader2 className="w-4 h-4 animate-spin mr-2" />
               ) : (
                 <Eye className="w-4 h-4 mr-2" />
               )}
               Открыть в браузере
             </Button>
            )}
            {openingFile?.allow_download !== false && (
             <Button
               variant="outline"
               onClick={() => openingFile && handleOpenFile(openingFile, 'download')}
               disabled={isLoadingUrl}
               className="w-full"
             >
               {isLoadingUrl ? (
                 <Loader2 className="w-4 h-4 animate-spin mr-2" />
               ) : (
                 <Download className="w-4 h-4 mr-2" />
               )}
               Скачать файл
             </Button>
            )}
           </div>
         </DialogContent>
       </Dialog>
     </div>
   );
 };
 
 export default TeacherMaterialsTab;