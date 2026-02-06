import { useState, useRef, useMemo } from "react";

// Check if file can be viewed via Google Docs Viewer
const isOfficeDocument = (fileName: string): boolean => {
  return /\.(docx?|xlsx?|pptx?|odt|ods|odp)$/i.test(fileName);
};
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Card, CardContent } from "@/components/ui/card";
 import {
   Dialog,
   DialogContent,
   DialogHeader,
   DialogTitle,
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
 import { Plus, FileText, Folder, Trash2, Edit, Loader2, Upload, GripVertical, ChevronLeft, FolderOpen, Download, X } from "lucide-react";
import { ExternalLink } from "lucide-react";
 import { toast } from "sonner";
 import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye } from "lucide-react";
 
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
  allow_view?: boolean;
  allow_download?: boolean;
 }
 
interface FilePermission {
  allow_view: boolean;
  allow_download: boolean;
}

interface FileEntry {
  file: File;
  customName: string;
  permissions: FilePermission;
}

interface FormData {
  title: string;
  itemType: ItemType;
  files: File[];
  filePermissions: FilePermission[];
  fileEntries: FileEntry[];
  allow_view: boolean;
  allow_download: boolean;
}
 
 const ProductMaterialsManager = ({ productId, productTitle, isOpen, onClose }: ProductMaterialsManagerProps) => {
   const { t } = useLanguage();
   const { data: allMaterials = [], isLoading } = useProductMaterials(productId, { creatorOnly: true });
   const createMaterial = useCreateMaterial();
   const updateMaterial = useUpdateMaterial();
   const deleteMaterial = useDeleteMaterial();
   
   const [isAdding, setIsAdding] = useState(false);
   const [editingId, setEditingId] = useState<string | null>(null);
   const [deletingMaterial, setDeletingMaterial] = useState<{ id: string; title: string; file_url?: string | null } | null>(null);
   const [isUploading, setIsUploading] = useState(false);
   const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
   const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
   
   const [formData, setFormData] = useState<FormData>({
     title: "",
     itemType: "file",
     files: [],
     filePermissions: [],
     fileEntries: [],
     allow_view: true,
     allow_download: true,
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
     setFormData({ title: "", itemType: "file", files: [], filePermissions: [], fileEntries: [], allow_view: true, allow_download: true });
     if (fileInputRef.current) fileInputRef.current.value = "";
   };
 
   const handleAdd = async (e: React.FormEvent) => {
     e.preventDefault();
     
     if (formData.itemType === "folder" && !formData.title) {
       toast.error("Введите название папки");
       return;
     }
     
     if (formData.itemType === "file" && formData.fileEntries.length === 0) {
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
         if (formData.fileEntries.length > 0) {
           for (let i = 0; i < formData.fileEntries.length; i++) {
             const entry = formData.fileEntries[i];
             const fileUrl = await uploadMaterialFile(entry.file, productId);
             await createMaterial.mutateAsync({
               product_id: productId,
               title: entry.customName || entry.file.name,
               type: "file",
               content: null,
               file_url: fileUrl,
               order_index: i,
               parent_id: folder.id,
               allow_view: entry.permissions.allow_view,
               allow_download: entry.permissions.allow_download,
             });
           }
         }

         toast.success(`Папка "${formData.title}" создана!`);
       } else {
         // Upload files
         for (let i = 0; i < formData.fileEntries.length; i++) {
           const entry = formData.fileEntries[i];
           const fileUrl = await uploadMaterialFile(entry.file, productId);
           await createMaterial.mutateAsync({
             product_id: productId,
             title: entry.customName || entry.file.name,
             type: "file",
             content: null,
             file_url: fileUrl,
             order_index: materials.length + i,
             parent_id: currentFolderId,
             allow_view: entry.permissions.allow_view,
             allow_download: entry.permissions.allow_download,
           });
         }
         toast.success(formData.fileEntries.length > 1 ? "Файлы добавлены!" : "Файл добавлен!");
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
       filePermissions: [],
       fileEntries: [],
       allow_view: material.allow_view !== false,
       allow_download: material.allow_download !== false,
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
        allow_view: formData.allow_view,
        allow_download: formData.allow_download,
       });
 
      toast.success("Изменения сохранены!");
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
    
   // Открыть окно СРАЗУ (до async), чтобы избежать блокировки popup (только для view)
   const newWindow = action === 'view' ? window.open('about:blank', '_blank') : null;
   
    try {
      setIsLoadingUrl(true);
      
     // Handle both old format (full URL) and new format (path only)
     const isFullUrl = material.file_url.startsWith('http');
     const path = isFullUrl 
       ? material.file_url.split('/materials/')[1] 
       : material.file_url;
     
     if (!path) {
       newWindow?.close();
       throw new Error('Invalid file path');
     }
     
      // Generate signed URL with download option based on action
       const { data, error } = await supabase.storage
         .from('materials')
        .createSignedUrl(path, 3600, { download: action === 'download' ? material.title : false });
      
      if (error) {
       newWindow?.close();
       throw error;
     }
      
      if (action === 'download') {
        // Скачивание файла
        const link = document.createElement('a');
        link.href = data.signedUrl;
        link.download = material.title;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (newWindow) {
        // Просмотр в браузере
        if (isOfficeDocument(material.title)) {
          // Use proxy URL for office documents so Microsoft Office Online can access them
          const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxy-material?path=${encodeURIComponent(path)}`;
          // Use Microsoft Office Online Viewer - works better for Office docs than Google Docs Viewer
          const viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(proxyUrl)}`;
          newWindow.location.href = viewerUrl;
        } else {
          newWindow.location.href = data.signedUrl;
        }
      }
      
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
         {/* Selected files list */}
         {formData.fileEntries.length > 0 && (
             <div className="space-y-2 mb-3">
               {formData.fileEntries.map((entry, index) => (
                <div key={index} className="bg-muted/50 rounded-md px-3 py-2 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                    <Input
                      placeholder={entry.file.name}
                      value={entry.customName}
                      onChange={(e) => {
                        setFormData(prev => {
                          const newEntries = [...prev.fileEntries];
                          newEntries[index] = { ...newEntries[index], customName: e.target.value };
                          return { ...prev, fileEntries: newEntries };
                        });
                      }}
                      className="flex-1 h-8 text-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          fileEntries: prev.fileEntries.filter((_, i) => i !== index)
                        }));
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                   </div>
                  <div className="flex items-center gap-4 pl-6">
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <Checkbox
                        checked={entry.permissions.allow_view}
                        onCheckedChange={(checked) => {
                          setFormData(prev => {
                            const newEntries = [...prev.fileEntries];
                            newEntries[index] = { 
                              ...newEntries[index], 
                              permissions: { ...newEntries[index].permissions, allow_view: !!checked }
                            };
                            return { ...prev, fileEntries: newEntries };
                          });
                        }}
                      />
                      <Eye className="w-3 h-3" />
                      Просмотр
                    </label>
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <Checkbox
                        checked={entry.permissions.allow_download}
                        onCheckedChange={(checked) => {
                          setFormData(prev => {
                            const newEntries = [...prev.fileEntries];
                            newEntries[index] = { 
                              ...newEntries[index], 
                              permissions: { ...newEntries[index].permissions, allow_download: !!checked }
                            };
                            return { ...prev, fileEntries: newEntries };
                          });
                        }}
                      />
                      <Download className="w-3 h-3" />
                      Скачивание
                    </label>
                  </div>
                 </div>
               ))}
             </div>
         )}

         {/* Add more files button */}
         <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
           <input
             ref={fileInputRef}
             type="file"
             multiple
             onChange={(e) => {
               if (e.target.files && e.target.files.length > 0) {
                 const newEntries: FileEntry[] = Array.from(e.target.files).map(file => ({
                   file,
                   customName: "",
                   permissions: { allow_view: true, allow_download: true }
                 }));
                 setFormData(prev => ({ 
                   ...prev, 
                   fileEntries: [...prev.fileEntries, ...newEntries]
                 }));
               }
               if (fileInputRef.current) fileInputRef.current.value = "";
             }}
             className="hidden"
             id="file-upload"
           />
           <label htmlFor="file-upload" className="cursor-pointer">
             <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
             <p className="text-sm text-muted-foreground">
               {formData.fileEntries.length > 0 ? "Добавить ещё файл(ы)" : "Нажмите для выбора файла(ов)"}
             </p>
           </label>
         </div>
       </div>
 
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
 
      {formData.itemType === "file" && (
        <div className="space-y-3">
          <Label>Доступ для учеников/учителей</Label>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={formData.allow_view}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, allow_view: !!checked }))}
              />
              <Eye className="w-4 h-4" />
              Просмотр в браузере
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={formData.allow_download}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, allow_download: !!checked }))}
              />
              <Download className="w-4 h-4" />
              Скачивание файла
            </label>
          </div>
        </div>
      )}

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
         <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
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
                             className="flex items-center gap-2 sm:gap-3 min-w-0 w-full"
                             onClick={() => material.type === "folder" && handleOpenFolder(material.id)}
                           >
                             <div className="text-muted-foreground cursor-grab flex-shrink-0 hidden sm:block">
                               <GripVertical className="w-4 h-4" />
                             </div>
                             <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                               {getItemIcon(material.type)}
                             </div>
                             <div className="flex-1 min-w-0">
                               <p className="font-medium text-sm truncate" title={material.title}>{material.title}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {material.type === "folder" 
                                  ? `Папка • ${(allMaterials as Material[]).filter(m => m.parent_id === material.id).length} файл(ов)`
                                  : `Файл • ${
                                      material.allow_view !== false && material.allow_download !== false 
                                        ? 'просм. и скач.'
                                        : material.allow_view !== false 
                                          ? 'только просмотр'
                                          : material.allow_download !== false 
                                            ? 'только скач.'
                                            : 'без доступа'
                                    }`
                                }
                              </p>
                            </div>
                            <div className="flex gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                             {material.type === "file" && material.file_url && (
                               <>
                                 <Button 
                                   variant="ghost" 
                                   size="icon" 
                                   className="h-8 w-8"
                                   onClick={() => handleOpenFile(material, 'download')}
                                   disabled={isLoadingUrl}
                                   title="Скачать"
                                 >
                                   <Download className="w-4 h-4" />
                                 </Button>
                                 <Button 
                                   variant="ghost" 
                                   size="icon" 
                                   className="h-8 w-8"
                                   onClick={() => handleOpenFile(material, 'view')}
                                   disabled={isLoadingUrl}
                                   title="Открыть в браузере"
                                 >
                                   <ExternalLink className="w-4 h-4" />
                                 </Button>
                               </>
                              )}
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(material)}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
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

     </>
   );
 };
 
 export default ProductMaterialsManager;