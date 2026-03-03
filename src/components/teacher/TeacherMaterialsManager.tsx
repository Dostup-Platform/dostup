import { useState, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  useTeacherOwnMaterials,
  useCreateTeacherMaterial,
  useUpdateTeacherMaterial,
  useDeleteTeacherMaterial,
  uploadTeacherMaterialFile,
} from "@/hooks/useTeacherMaterials";
import { useLanguage } from "@/contexts/LanguageContext";
import { Plus, FileText, Folder, Trash2, Edit, Loader2, Upload, ChevronLeft, FolderOpen, Download, X, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { requestMaterialToken, buildProxyUrl } from "@/lib/materialToken";
import { Checkbox } from "@/components/ui/checkbox";

interface TeacherMaterialsManagerProps {
  teacherId: string;
  productId: string;
  productTitle: string;
}

type ItemType = "file" | "folder";

interface Material {
  id: string;
  product_id: string;
  teacher_id: string;
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
  allow_download: boolean;
}

const isOfficeDocument = (fileName: string): boolean => {
  return /\.(docx?|xlsx?|pptx?|odt|ods|odp)$/i.test(fileName);
};

const TeacherMaterialsManager = ({ teacherId, productId, productTitle }: TeacherMaterialsManagerProps) => {
  const { language } = useLanguage();
  const { data: allMaterials = [], isLoading } = useTeacherOwnMaterials(teacherId, [productId]);
  const createMaterial = useCreateTeacherMaterial();
  const updateMaterial = useUpdateTeacherMaterial();
  const deleteMaterial = useDeleteTeacherMaterial();
  
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

  const resetForm = () => {
    setFormData({ title: "", itemType: "file", files: [], filePermissions: [], fileEntries: [], allow_download: true });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.itemType === "folder" && !formData.title) {
      toast.error(language === "ru" ? "Введите название папки" : "Қалта атын енгізіңіз");
      return;
    }
    
    if (formData.itemType === "file" && formData.fileEntries.length === 0) {
      toast.error(language === "ru" ? "Выберите файл(ы)" : "Файл(дар)ды таңдаңыз");
      return;
    }

    try {
      setIsUploading(true);

      if (formData.itemType === "folder") {
        const folder = await createMaterial.mutateAsync({
          product_id: productId,
          teacher_id: teacherId,
          title: formData.title,
          type: "folder",
          content: null,
          file_url: null,
          order_index: materials.length,
          parent_id: currentFolderId,
        });

        if (formData.fileEntries.length > 0) {
          for (let i = 0; i < formData.fileEntries.length; i++) {
            const entry = formData.fileEntries[i];
            const fileUrl = await uploadTeacherMaterialFile(entry.file, productId, teacherId);
            await createMaterial.mutateAsync({
              product_id: productId,
              teacher_id: teacherId,
              title: entry.customName || entry.file.name,
              type: "file",
              content: null,
              file_url: fileUrl,
              order_index: i,
              parent_id: folder.id,
              allow_view: true,
              allow_download: entry.permissions.allow_download,
            });
          }
        }

        toast.success(language === "ru" ? `Папка "${formData.title}" создана!` : `"${formData.title}" қалтасы жасалды!`);
      } else {
        for (let i = 0; i < formData.fileEntries.length; i++) {
          const entry = formData.fileEntries[i];
          const fileUrl = await uploadTeacherMaterialFile(entry.file, productId, teacherId);
          await createMaterial.mutateAsync({
            product_id: productId,
            teacher_id: teacherId,
            title: entry.customName || entry.file.name,
            type: "file",
            content: null,
            file_url: fileUrl,
            order_index: materials.length + i,
            parent_id: currentFolderId,
            allow_view: true,
            allow_download: entry.permissions.allow_download,
          });
        }
        toast.success(language === "ru" 
          ? (formData.fileEntries.length > 1 ? "Файлы добавлены!" : "Файл добавлен!")
          : (formData.fileEntries.length > 1 ? "Файлдар қосылды!" : "Файл қосылды!"));
      }

      setIsAdding(false);
      resetForm();
    } catch (err) {
      console.error(err);
      toast.error(language === "ru" ? "Ошибка при добавлении" : "Қосу кезінде қате");
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
      allow_download: material.allow_download !== false,
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !formData.title) return;

    try {
      await updateMaterial.mutateAsync({
        id: editingId,
        teacherId: teacherId,
        title: formData.title,
        allow_view: true,
        allow_download: formData.allow_download,
      });

      toast.success(language === "ru" ? "Изменения сохранены!" : "Өзгерістер сақталды!");
      setEditingId(null);
      resetForm();
    } catch (err) {
      console.error(err);
      toast.error(language === "ru" ? "Ошибка при обновлении" : "Жаңарту кезінде қате");
    }
  };

  const handleDelete = async () => {
    if (!deletingMaterial) return;

    try {
      await deleteMaterial.mutateAsync({
        id: deletingMaterial.id,
        teacherId: teacherId,
        file_url: deletingMaterial.file_url,
      });
      toast.success(language === "ru" ? "Удалено!" : "Жойылды!");
      setDeletingMaterial(null);
    } catch (err) {
      console.error(err);
      toast.error(language === "ru" ? "Ошибка при удалении" : "Жою кезінде қате");
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
     
    // Detect standalone PWA mode (iOS opens about:blank inside the app webview, not Safari)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as any).standalone === true;
    const newWindow = isStandalone ? null : window.open('about:blank', '_blank');
    const loadingToast = toast.loading(language === "ru" ? "Подготовка файла..." : "Файл дайындалуда...");
    
    try {
      setIsLoadingUrl(true);
      const { isS3Path, getS3DownloadUrl } = await import("@/lib/s3Helpers");
      
      const nav = async (url: string) => {
        if (isStandalone && action === 'download') {
          try {
            const response = await fetch(url);
            const blob = await response.blob();
            const fileName = material.title || 'download';
            const file = new File([blob], fileName, { type: blob.type });
            
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({ files: [file], title: fileName });
              toast.success(language === "ru" ? "Файл сохранён" : "Файл сақталды");
            } else {
              const blobUrl = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = blobUrl;
              a.download = fileName;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
            }
          } catch (e) {
            if ((e as Error).name !== 'AbortError') {
              window.location.href = url;
            }
          }
        } else if (newWindow) {
          newWindow.location.href = url;
        } else {
          window.location.href = url;
        }
      };

      if (isS3Path(material.file_url)) {
        if (action === 'download') {
          const url = await getS3DownloadUrl(material.file_url, 'teacher', teacherId, material.title);
          await nav(url);
        } else {
          if (isOfficeDocument(material.title)) {
            const token = await requestMaterialToken(material.file_url, 'teacher', teacherId);
            const proxyUrl = buildProxyUrl(token);
            const viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(proxyUrl)}`;
            await nav(viewerUrl);
          } else {
            const url = await getS3DownloadUrl(material.file_url, 'teacher', teacherId);
            await nav(url);
          }
        }
      } else {
        const isFullUrl = material.file_url.startsWith('http');
        const path = isFullUrl 
          ? material.file_url.split('/materials/')[1] 
          : material.file_url;
        
        if (!path) {
          newWindow?.close();
          throw new Error('Invalid file path');
        }
        
        const { data, error } = await supabase.storage
          .from('materials')
          .createSignedUrl(path, 3600, { download: action === 'download' ? material.title : false });
        
        if (error) {
          newWindow?.close();
          throw error;
        }
        
        if (action === 'download') {
          await nav(data.signedUrl);
        } else {
          if (isOfficeDocument(material.title)) {
            const token = await requestMaterialToken(path, 'teacher', teacherId);
            const proxyUrl = buildProxyUrl(token);
            const viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(proxyUrl)}`;
            await nav(viewerUrl);
          } else {
            await nav(data.signedUrl);
          }
        }
      }
    } catch (err) {
      console.error('Error getting file URL:', err);
      newWindow?.close();
      toast.error(language === "ru" ? 'Ошибка при открытии файла' : 'Файлды ашу кезінде қате');
    } finally {
      setIsLoadingUrl(false);
      toast.dismiss(loadingToast);
    }
  };

  const getAccessLabel = (material: Material) => {
    const canDownload = material.allow_download !== false;
    return canDownload 
      ? (language === "ru" ? "скачивание разрешено" : "жүктеуге рұқсат") 
      : (language === "ru" ? "только просмотр" : "тек көру");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with product title and navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {currentFolderId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentFolderId(currentFolder?.parent_id || null)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          )}
          <h4 className="font-medium text-sm">
            {currentFolder ? currentFolder.title : productTitle}
          </h4>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setIsAdding(true);
            setEditingId(null);
            resetForm();
          }}
          disabled={isAdding || !!editingId}
        >
          <Plus className="w-4 h-4 mr-1" />
          {language === "ru" ? "Добавить" : "Қосу"}
        </Button>
      </div>

      {/* Add Form */}
      {isAdding && (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-3">
                <Label>{language === "ru" ? "Что добавить?" : "Нені қосу керек?"}</Label>
                <RadioGroup
                  value={formData.itemType}
                  onValueChange={(value: ItemType) => setFormData(prev => ({ ...prev, itemType: value, files: [] }))}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="file" id="teacher-type-file" />
                    <Label htmlFor="teacher-type-file" className="cursor-pointer flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      {language === "ru" ? "Файл" : "Файл"}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="folder" id="teacher-type-folder" />
                    <Label htmlFor="teacher-type-folder" className="cursor-pointer flex items-center gap-2">
                      <Folder className="w-4 h-4" />
                      {language === "ru" ? "Папка" : "Қалта"}
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {formData.itemType === "folder" && (
                <div className="space-y-2">
                  <Label>{language === "ru" ? "Название папки *" : "Қалта атауы *"}</Label>
                  <Input
                    placeholder={language === "ru" ? "Введите название" : "Атауын енгізіңіз"}
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>
                  {formData.itemType === "folder" 
                    ? (language === "ru" ? "Файлы в папку (опционально)" : "Қалтаға файлдар (міндетті емес)")
                    : (language === "ru" ? "Выберите файл(ы) *" : "Файл(дар)ды таңдаңыз *")}
                </Label>
                
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
                            {language === "ru" ? "Скачивание" : "Жүктеу"}
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

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
                          permissions: { allow_download: true }
                        }));
                        setFormData(prev => ({ 
                          ...prev, 
                          fileEntries: [...prev.fileEntries, ...newEntries]
                        }));
                      }
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="hidden"
                    id="teacher-file-upload"
                  />
                  <label htmlFor="teacher-file-upload" className="cursor-pointer">
                    <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {formData.fileEntries.length > 0 
                        ? (language === "ru" ? "Добавить ещё файл(ы)" : "Тағы файл қосу")
                        : (language === "ru" ? "Нажмите для выбора файла(ов)" : "Файл таңдау үшін басыңыз")}
                    </p>
                  </label>
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={isUploading} className="flex-1">
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {language === "ru" ? "Загрузка..." : "Жүктелуде..."}
                    </>
                  ) : (
                    language === "ru" ? "Сохранить" : "Сақтау"
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setIsAdding(false); resetForm(); }}>
                  {language === "ru" ? "Отмена" : "Болдырмау"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Materials List */}
      {materials.length === 0 && !isAdding ? (
        <div className="text-center py-8 text-muted-foreground">
          <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">
            {language === "ru" ? "Нет материалов" : "Материалдар жоқ"}
          </p>
          <p className="text-xs mt-1">
            {language === "ru" 
              ? "Добавьте файлы или папки для ваших учеников"
              : "Оқушыларыңыз үшін файлдар немесе қалталар қосыңыз"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {materials.map((material) => (
            <Card key={material.id}>
              <CardContent className="p-3">
                {editingId === material.id ? (
                  <form onSubmit={handleUpdate} className="space-y-3">
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      required
                    />
                    {material.type === "file" && (
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                          <Checkbox
                            checked={formData.allow_download}
                            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, allow_download: !!checked }))}
                          />
                          <Download className="w-3 h-3" />
                          {language === "ru" ? "Скачивание" : "Жүктеу"}
                        </label>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button type="submit" size="sm">{language === "ru" ? "Сохранить" : "Сақтау"}</Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => { setEditingId(null); resetForm(); }}>
                        {language === "ru" ? "Отмена" : "Болдырмау"}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center justify-between">
                    <div 
                      className={`flex items-center gap-3 min-w-0 flex-1 ${material.type === "folder" ? "cursor-pointer" : ""}`}
                      onClick={() => material.type === "folder" && handleOpenFolder(material.id)}
                    >
                      <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                        {getItemIcon(material.type)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{material.title}</p>
                        {material.type === "file" && (
                          <p className="text-xs text-muted-foreground">{getAccessLabel(material)}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {material.type === "file" && material.file_url && (
                        <>
                          {material.allow_download !== false && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleOpenFile(material, 'download')}
                              disabled={isLoadingUrl}
                              title={language === "ru" ? "Скачать" : "Жүктеу"}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleOpenFile(material, 'view')}
                            disabled={isLoadingUrl}
                            title={language === "ru" ? "Открыть" : "Ашу"}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(material)}
                      >
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

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingMaterial} onOpenChange={() => setDeletingMaterial(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{language === "ru" ? "Удалить материал?" : "Материалды жою керек пе?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {language === "ru" 
                ? `Вы уверены, что хотите удалить "${deletingMaterial?.title}"? Это действие нельзя отменить.`
                : `"${deletingMaterial?.title}" жойғыңыз келе ме? Бұл әрекетті болдырмау мүмкін емес.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{language === "ru" ? "Отмена" : "Болдырмау"}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              {language === "ru" ? "Удалить" : "Жою"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TeacherMaterialsManager;
