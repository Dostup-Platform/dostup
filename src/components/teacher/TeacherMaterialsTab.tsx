 import { useQuery } from "@tanstack/react-query";
 import { useState, useCallback } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { useLanguage } from "@/contexts/LanguageContext";
import { FileText, ExternalLink, Loader2, Video, Link as LinkIcon, Folder, Download } from "lucide-react";
 import { Card, CardContent } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
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
 
   const handleOpenFile = useCallback(async (material: { file_url: string; title: string }, action: 'view' | 'download') => {
     if (!material.file_url) return;
     
     try {
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
     } catch (err) {
       console.error('Error getting file URL:', err);
       toast.error('Ошибка при открытии файла');
     }
   }, []);
 
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
                     <div className="flex gap-1">
                       {material.type === "link" && material.content && (
                         <Button
                           variant="ghost"
                           size="icon"
                           onClick={() => window.open(material.content!, "_blank")}
                           title="Открыть ссылку"
                         >
                           <ExternalLink className="w-4 h-4" />
                         </Button>
                       )}
                       {material.type === "file" && material.file_url && (
                         <>
                           {material.allow_download !== false && (
                             <Button
                               variant="ghost"
                               size="icon"
                               onClick={() => handleOpenFile({ file_url: material.file_url!, title: material.title }, 'download')}
                               title="Скачать"
                             >
                               <Download className="w-4 h-4" />
                             </Button>
                           )}
                           {material.allow_view !== false && (
                             <Button
                               variant="ghost"
                               size="icon"
                               onClick={() => handleOpenFile({ file_url: material.file_url!, title: material.title }, 'view')}
                               title="Открыть в браузере"
                             >
                               <ExternalLink className="w-4 h-4" />
                             </Button>
                           )}
                         </>
                       )}
                       {material.type === "video" && material.file_url && (
                         <Button
                           variant="ghost"
                           size="icon"
                           onClick={() => window.open(material.file_url!, "_blank")}
                           title="Открыть видео"
                         >
                           <ExternalLink className="w-4 h-4" />
                         </Button>
                       )}
                     </div>
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
     </div>
   );
 };
 
 export default TeacherMaterialsTab;