 import { useState, useRef, useMemo } from "react";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Card, CardContent } from "@/components/ui/card";
 import {
   Dialog,
   DialogContent,
   DialogHeader,
   DialogTitle,
  DialogDescription,
 } from "@/components/ui/dialog";
 import {
   AlertDialog,
   AlertDialogAction,
   AlertDialogCancel,
   AlertDialogContent,
   AlertDialogDescription,
   AlertDialogFooter,
   AlertDialogHeader,
   AlertDialogTitle,
 } from "@/components/ui/alert-dialog";
 import { useProductMaterials, useCreateMaterial, useUpdateMaterial, useDeleteMaterial, uploadMaterialFile } from "@/hooks/useMaterials";
 import { useLanguage } from "@/contexts/LanguageContext";
import { Plus, FileText, Folder, Trash2, Edit, Loader2, Upload, ExternalLink, GripVertical, ChevronLeft, FolderOpen, Download, Eye } from "lucide-react";
 import { toast } from "sonner";
 import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
 
 interface ProductMaterialsManagerProps {
   productId: string;
   productTitle: string;
   isOpen: boolean;
   onClose: () => void;
 }
 
 type ItemType = "file" | "folder";
 
 interface Material {
   id: string;
   product_id: string;
   title: string;
   type: string;
   content: string | null;
   file_url: string | null;
   order_index: number;
   created_at: string;
   parent_id?: string | null;
 }
 
 interface FormData {
   title: string;
   itemType: ItemType;
   files: File[];
 }
 
 const ProductMaterialsManager = ({ productId, productTitle, isOpen, onClose }: ProductMaterialsManagerProps) => {
   const { t } = useLanguage();
   const { data: allMaterials = [], isLoading } = useProductMaterials(productId);
   const createMaterial = useCreateMaterial();
   const updateMaterial = useUpdateMaterial();
   const deleteMaterial = useDeleteMaterial();
   
   const [isAdding, setIsAdding] = useState(false);
   const [editingId, setEditingId] = useState<string | null>(null);
   const [deletingMaterial, setDeletingMaterial] = useState<{ id: string; title: string; file_url?: string | null } | null>(null);
   const [isUploading, setIsUploading] = useState(false);
   const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
   const fileInputRef = useRef<HTMLInputElement>(null);
  const [openingFile, setOpeningFile] = useState<Material | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
   
   const [formData, setFormData] = useState<FormData>({
     title: "",
     itemType: "file",
     files: [],
   });
 
   // Filter materials for current folder level
   const materials = useMemo(() => {
     return (allMaterials as Material[]).filter(m => 
       currentFolderId ? m.parent_id === currentFolderId : !m.parent_id
     );
   }, [allMaterials, currentFolderId]);
 
   // Get current folder info
   const currentFolder = useMemo(() => {
     if (!currentFolderId) return null;
     return (allMaterials as Material[]).find(m => m.id === currentFolderId);
   }, [allMaterials, currentFolderId]);
 
   // Get breadcrumb path
   const getBreadcrumbPath = (): Material[] => {
     const path: Material[] = [];
     let folderId = currentFolderId;
     while (folderId) {
       const folder = (allMaterials as Material[]).find(m => m.id === folderId);
       if (folder) {
         path.unshift(folder);
         folderId = folder.parent_id || null;
       } else {
         break;
       }
     }
     return path;
   };
 
   const resetForm = () => {
     setFormData({ title: "", itemType: "file", files: [] });
     if (fileInputRef.current) fileInputRef.current.value = "";
   };
 
   const handleAdd = async (e: React.FormEvent) => {
     e.preventDefault();
     
     if (formData.itemType === "folder" && !formData.title) {
       toast.error("Введите название папки");
       return;
     }
     
     if (formData.itemType === "file" && formData.files.length === 0) {
       toast.error("Выберите файл(ы)");
       return;
     }
 
     try {
       setIsUploading(true);
 
       if (formData.itemType === "folder") {
         // Create folder
         const folder = await createMaterial.mutateAsync({
           product_id: productId,
           title: formData.title,
           type: "folder",
           content: null,
           file_url: null,
           order_index: materials.length,
           parent_id: currentFolderId,
         });
 
         // If files selected, add them to the folder
         if (formData.files.length > 0) {
           for (let i = 0; i < formData.files.length; i++) {
             const file = formData.files[i];
             const fileUrl = await uploadMaterialFile(file, productId);
             await createMaterial.mutateAsync({
               product_id: productId,
               title: file.name,
               type: "file",
               content: null,
               file_url: fileUrl,
               order_index: i,
               parent_id: folder.id,
             });
           }
         }
 
         toast.success(`Папка "${formData.title}" создана!`);
       } else {
         // Upload files
         for (let i = 0; i < formData.files.length; i++) {
           const file = formData.files[i];
           const fileUrl = await uploadMaterialFile(file, productId);
           await createMaterial.mutateAsync({
             product_id: productId,
             title: formData.title || file.name,
             type: "file",
             content: null,
             file_url: fileUrl,
             order_index: materials.length + i,
             parent_id: currentFolderId,
           });
         }
         toast.success(formData.files.length > 1 ? "Файлы добавлены!" : "Файл добавлен!");
       }
 
       setIsAdding(false);
       resetForm();
     } catch (err) {
       console.error(err);
       toast.error("Ошибка при добавлении");
     } finally {
       setIsUploading(false);
     }
   };
 
   const handleEdit = (material: Material) => {
     setEditingId(material.id);
     setFormData({
       title: material.title,
       itemType: material.type === "folder" ? "folder" : "file",
       files: [],
     });
   };
 
   const handleUpdate = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!editingId || !formData.title) return;
 
     try {
       await updateMaterial.mutateAsync({
         id: editingId,
         productId: productId,
         title: formData.title,
       });
 
       toast.success("Название обновлено!");
       setEditingId(null);
       resetForm();
     } catch (err) {
       console.error(err);
       toast.error("Ошибка при обновлении");
     }
   };
 
   const handleDelete = async () => {
     if (!deletingMaterial) return;
 
     try {
       await deleteMaterial.mutateAsync({
         id: deletingMaterial.id,
         productId: productId,
         file_url: deletingMaterial.file_url,
       });
       toast.success("Удалено!");
       setDeletingMaterial(null);
     } catch (err) {
       console.error(err);
       toast.error("Ошибка при удалении");
     }
   };
 
   const getItemIcon = (type: string) => {
     if (type === "folder") {
       return <Folder className="w-4 h-4 text-primary" />;
     }
     return <FileText className="w-4 h-4 text-primary" />;
   };
 
   const handleOpenFolder = (folderId: string) => {
     setCurrentFolderId(folderId);
     setIsAdding(false);
     setEditingId(null);
   };
 
  const handleOpenFile = async (material: Material, action: 'view' | 'download') => {
    if (!material.file_url) return;
    
    try {
      setIsLoadingUrl(true);
      
     // Handle both old format (full URL) and new format (path only)
     const isFullUrl = material.file_url.startsWith('http');
     const path = isFullUrl 
       ? material.file_url.split('/materials/')[1] 
       : material.file_url;
     
     if (!path) {
       throw new Error('Invalid file path');
     }
     
     // Generate signed URL
      const { data, error } = await supabase.storage
        .from('materials')
       .createSignedUrl(path, 3600); // 1 hour
      
      if (error) throw error;
      
      if (action === 'download') {
        // Create download link
        const link = document.createElement('a');
        link.href = data.signedUrl;
        link.download = material.title;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // Open in new tab
        window.open(data.signedUrl, '_blank');
      }
      
      setOpeningFile(null);
    } catch (err) {
      console.error('Error getting file URL:', err);
      toast.error('Ошибка при открытии файла');
    } finally {
      setIsLoadingUrl(false);
    }
  };

   const renderAddForm = () => (
     <form onSubmit={handleAdd} className="space-y-4">
       <div className="space-y-3">
         <Label>Что добавить?</Label>
         <RadioGroup
           value={formData.itemType}
           onValueChange={(value: ItemType) => setFormData(prev => ({ ...prev, itemType: value, files: [] }))}
           className="flex gap-4"
         >
           <div className="flex items-center space-x-2">
             <RadioGroupItem value="file" id="type-file" />
             <Label htmlFor="type-file" className="cursor-pointer flex items-center gap-2">
               <FileText className="w-4 h-4" />
               Файл
             </Label>
           </div>
           <div className="flex items-center space-x-2">
             <RadioGroupItem value="folder" id="type-folder" />
             <Label htmlFor="type-folder" className="cursor-pointer flex items-center gap-2">
               <Folder className="w-4 h-4" />
               Папка
             </Label>
           </div>
         </RadioGroup>
       </div>
 
       {formData.itemType === "folder" && (
         <div className="space-y-2">
           <Label>Название папки *</Label>
           <Input
             placeholder="Введите название папки"
             value={formData.title}
             onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
             required
           />
         </div>
       )}
 
       <div className="space-y-2">
         <Label>
           {formData.itemType === "folder" 
             ? "Файлы в папку (опционально)" 
             : "Выберите файл(ы) *"}
         </Label>
         <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
           <input
             ref={fileInputRef}
             type="file"
             multiple
             onChange={(e) => setFormData(prev => ({ 
               ...prev, 
               files: e.target.files ? Array.from(e.target.files) : [] 
             }))}
             className="hidden"
             id="file-upload"
           />
           <label htmlFor="file-upload" className="cursor-pointer">
             <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
             {formData.files.length > 0 ? (
               <div className="text-sm text-foreground">
                 <p className="font-medium">Выбрано: {formData.files.length} файл(ов)</p>
                 <p className="text-xs text-muted-foreground mt-1">
                   {formData.files.map(f => f.name).join(", ")}
                 </p>
               </div>
             ) : (
               <p className="text-sm text-muted-foreground">
                 Нажмите для выбора файла(ов)
               </p>
             )}
           </label>
         </div>
       </div>
 
       {formData.itemType === "file" && formData.files.length === 1 && (
         <div className="space-y-2">
           <Label>Название (по умолчанию имя файла)</Label>
           <Input
             placeholder={formData.files[0]?.name || "Название материала"}
             value={formData.title}
             onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
           />
         </div>
       )}
 
       <div className="flex gap-2 pt-2">
         <Button
           type="button"
           variant="outline"
           className="flex-1"
           onClick={() => { setIsAdding(false); resetForm(); }}
         >
           {t("cancel")}
         </Button>
         <Button
           type="submit"
           variant="cta"
           className="flex-1"
           disabled={isUploading || createMaterial.isPending}
         >
           {(isUploading || createMaterial.isPending) ? (
             <span className="flex items-center gap-2">
               <Loader2 className="w-4 h-4 animate-spin" />
               Загрузка...
             </span>
           ) : (
             t("add")
           )}
         </Button>
       </div>
     </form>
   );
 
   const renderEditForm = () => (
     <form onSubmit={handleUpdate} className="space-y-4">
       <div className="space-y-2">
         <Label>Название *</Label>
         <Input
           placeholder="Введите название"
           value={formData.title}
           onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
           required
         />
       </div>
 
       <div className="flex gap-2 pt-2">
         <Button
           type="button"
           variant="outline"
           className="flex-1"
           onClick={() => { setEditingId(null); resetForm(); }}
         >
           {t("cancel")}
         </Button>
         <Button
           type="submit"
           variant="cta"
           className="flex-1"
           disabled={updateMaterial.isPending}
         >
           {updateMaterial.isPending ? (
             <span className="flex items-center gap-2">
               <Loader2 className="w-4 h-4 animate-spin" />
               Сохранение...
             </span>
           ) : (
             t("save")
           )}
         </Button>
       </div>
     </form>
   );
 
   return (
     <>
       <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { onClose(); setCurrentFolderId(null); } }}>
         <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
           <DialogHeader>
             <DialogTitle className="flex items-center gap-2">
               Материалы: {productTitle}
             </DialogTitle>
           </DialogHeader>
 
           <div className="space-y-4 mt-4">
             {/* Breadcrumb navigation */}
             {currentFolderId && (
               <div className="flex items-center gap-2 text-sm">
                 <Button 
                   variant="ghost" 
                   size="sm" 
                   onClick={() => setCurrentFolderId(currentFolder?.parent_id || null)}
                   className="h-auto p-1"
                 >
                   <ChevronLeft className="w-4 h-4 mr-1" />
                   Назад
                 </Button>
                 <span className="text-muted-foreground">/</span>
                 {getBreadcrumbPath().map((folder, idx) => (
                   <div key={folder.id} className="flex items-center gap-2">
                     <button
                       onClick={() => setCurrentFolderId(folder.id)}
                       className="hover:text-primary transition-colors flex items-center gap-1"
                     >
                       <FolderOpen className="w-4 h-4" />
                       {folder.title}
                     </button>
                     {idx < getBreadcrumbPath().length - 1 && (
                       <span className="text-muted-foreground">/</span>
                     )}
                   </div>
                 ))}
               </div>
             )}
 
             {/* Add button */}
             {!isAdding && !editingId && (
               <Button onClick={() => setIsAdding(true)} variant="outline" className="w-full">
                 <Plus className="w-4 h-4 mr-2" />
                 {currentFolderId ? "Добавить в папку" : "Добавить материал"}
               </Button>
             )}
 
             {/* Add form */}
             {isAdding && (
               <Card>
                 <CardContent className="pt-4">
                   {renderAddForm()}
                 </CardContent>
               </Card>
             )}
 
             {/* Materials list */}
             {isLoading ? (
               <div className="flex justify-center py-8">
                 <Loader2 className="w-6 h-6 animate-spin text-primary" />
               </div>
             ) : materials.length === 0 && !isAdding ? (
               <div className="text-center py-8 text-muted-foreground">
                 {currentFolderId ? (
                   <>
                     <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-50" />
                     <p>Папка пуста</p>
                   </>
                 ) : (
                   <>
                     <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                     <p>Материалов пока нет</p>
                   </>
                 )}
               </div>
             ) : (
               <div className="space-y-2">
                 {materials.map((material) => (
                   <Card 
                     key={material.id} 
                     className={material.type === "folder" ? "cursor-pointer hover:bg-accent/50 transition-colors" : ""}
                   >
                     <CardContent className="p-3">
                       {editingId === material.id ? (
                         renderEditForm()
                       ) : (
                         <div 
                           className="flex items-center gap-3"
                           onClick={() => material.type === "folder" && handleOpenFolder(material.id)}
                         >
                           <div className="text-muted-foreground cursor-grab">
                             <GripVertical className="w-4 h-4" />
                           </div>
                           <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                             {getItemIcon(material.type)}
                           </div>
                           <div className="flex-1 min-w-0">
                             <p className="font-medium text-sm truncate">{material.title}</p>
                             <p className="text-xs text-muted-foreground">
                               {material.type === "folder" 
                                 ? `Папка • ${(allMaterials as Material[]).filter(m => m.parent_id === material.id).length} файл(ов)`
                                 : "Файл"
                               }
                             </p>
                           </div>
                           <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                             {material.file_url && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => setOpeningFile(material)}
                              >
                                <ExternalLink className="w-4 h-4" />
                               </Button>
                             )}
                             <Button variant="ghost" size="icon" onClick={() => handleEdit(material)}>
                               <Edit className="w-4 h-4" />
                             </Button>
                             <Button
                               variant="ghost"
                               size="icon"
                               className="text-destructive hover:text-destructive"
                               onClick={() => setDeletingMaterial({ id: material.id, title: material.title, file_url: material.file_url })}
                             >
                               <Trash2 className="w-4 h-4" />
                             </Button>
                           </div>
                         </div>
                       )}
                     </CardContent>
                   </Card>
                 ))}
               </div>
             )}
           </div>
         </DialogContent>
       </Dialog>
 
       {/* Delete confirmation */}
       <AlertDialog open={!!deletingMaterial} onOpenChange={(open) => { if (!open) setDeletingMaterial(null); }}>
         <AlertDialogContent>
           <AlertDialogHeader>
             <AlertDialogTitle>Удалить?</AlertDialogTitle>
             <AlertDialogDescription>
               Вы уверены, что хотите удалить "{deletingMaterial?.title}"? 
               {(allMaterials as Material[]).find(m => m.id === deletingMaterial?.id)?.type === "folder" && 
                 " Все файлы внутри папки также будут удалены."
               }
             </AlertDialogDescription>
           </AlertDialogHeader>
           <AlertDialogFooter>
             <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
             <AlertDialogAction
               onClick={handleDelete}
               className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
             >
               {deleteMaterial.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t("delete")}
             </AlertDialogAction>
           </AlertDialogFooter>
         </AlertDialogContent>
       </AlertDialog>

      {/* File open dialog */}
      <Dialog open={!!openingFile} onOpenChange={(open) => { if (!open) setOpeningFile(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Открыть файл</DialogTitle>
            <DialogDescription>
              {openingFile?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-4">
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
          </div>
        </DialogContent>
      </Dialog>
     </>
   );
 };
 
 export default ProductMaterialsManager;