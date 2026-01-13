import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProductMaterials, useCreateMaterial, useUpdateMaterial, useDeleteMaterial, uploadMaterialFile } from "@/hooks/useMaterials";
import { useLanguage } from "@/contexts/LanguageContext";
import { Plus, FileText, Video, Type, Trash2, Edit, Loader2, Upload, ExternalLink, GripVertical } from "lucide-react";
import { toast } from "sonner";

interface ProductMaterialsManagerProps {
  productId: string;
  productTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

type MaterialType = "video" | "file" | "text";

interface FormData {
  title: string;
  type: MaterialType;
  content: string;
  file: File | null;
}

const ProductMaterialsManager = ({ productId, productTitle, isOpen, onClose }: ProductMaterialsManagerProps) => {
  const { t } = useLanguage();
  const { data: materials = [], isLoading } = useProductMaterials(productId);
  const createMaterial = useCreateMaterial();
  const updateMaterial = useUpdateMaterial();
  const deleteMaterial = useDeleteMaterial();
  
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingMaterial, setDeletingMaterial] = useState<{ id: string; title: string; file_url?: string | null } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState<FormData>({
    title: "",
    type: "text",
    content: "",
    file: null,
  });

  const resetForm = () => {
    setFormData({ title: "", type: "text", content: "", file: null });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) {
      toast.error("Введите название");
      return;
    }

    try {
      setIsUploading(true);
      let fileUrl: string | null = null;

      if ((formData.type === "file" || formData.type === "video") && formData.file) {
        fileUrl = await uploadMaterialFile(formData.file, productId);
      }

      await createMaterial.mutateAsync({
        product_id: productId,
        title: formData.title,
        type: formData.type,
        content: formData.type === "text" ? formData.content : null,
        file_url: fileUrl,
        order_index: materials.length,
      });

      toast.success("Материал добавлен!");
      setIsAdding(false);
      resetForm();
    } catch (error) {
      toast.error("Ошибка при добавлении материала");
    } finally {
      setIsUploading(false);
    }
  };

  const handleEdit = (material: typeof materials[0]) => {
    setEditingId(material.id);
    setFormData({
      title: material.title,
      type: material.type as MaterialType,
      content: material.content || "",
      file: null,
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !formData.title) return;

    try {
      setIsUploading(true);
      let fileUrl: string | undefined = undefined;

      if ((formData.type === "file" || formData.type === "video") && formData.file) {
        fileUrl = await uploadMaterialFile(formData.file, productId);
      }

      await updateMaterial.mutateAsync({
        id: editingId,
        productId: productId,
        title: formData.title,
        content: formData.type === "text" ? formData.content : null,
        ...(fileUrl && { file_url: fileUrl }),
      });

      toast.success("Материал обновлён!");
      setEditingId(null);
      resetForm();
    } catch (error) {
      toast.error("Ошибка при обновлении");
    } finally {
      setIsUploading(false);
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
      toast.success("Материал удалён!");
      setDeletingMaterial(null);
    } catch (error) {
      toast.error("Ошибка при удалении");
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "video": return <Video className="w-4 h-4 text-primary" />;
      case "file": return <FileText className="w-4 h-4 text-primary" />;
      default: return <Type className="w-4 h-4 text-primary" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "video": return "Видео";
      case "file": return "Файл";
      default: return "Текст";
    }
  };

  const MaterialForm = ({ onSubmit, isEdit = false }: { onSubmit: (e: React.FormEvent) => void; isEdit?: boolean }) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Название *</Label>
        <Input
          placeholder="Название материала"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
        />
      </div>

      {!isEdit && (
        <div className="space-y-2">
          <Label>Тип материала</Label>
          <Select
            value={formData.type}
            onValueChange={(value: MaterialType) => setFormData({ ...formData, type: value, file: null, content: "" })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">📝 Текст</SelectItem>
              <SelectItem value="file">📄 Файл (PDF, документ)</SelectItem>
              <SelectItem value="video">🎬 Видео</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {formData.type === "text" && (
        <div className="space-y-2">
          <Label>Содержимое</Label>
          <Textarea
            placeholder="Текст материала..."
            rows={6}
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          />
        </div>
      )}

      {(formData.type === "file" || formData.type === "video") && (
        <div className="space-y-2">
          <Label>{formData.type === "video" ? "Видеофайл" : "Файл"}</Label>
          <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept={formData.type === "video" ? "video/*" : "*"}
              onChange={(e) => setFormData({ ...formData, file: e.target.files?.[0] || null })}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              {formData.file ? (
                <p className="text-sm text-foreground font-medium">{formData.file.name}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Нажмите для выбора {formData.type === "video" ? "видео" : "файла"}
                </p>
              )}
            </label>
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => { isEdit ? setEditingId(null) : setIsAdding(false); resetForm(); }}
        >
          {t("cancel")}
        </Button>
        <Button
          type="submit"
          variant="cta"
          className="flex-1"
          disabled={isUploading || createMaterial.isPending || updateMaterial.isPending}
        >
          {(isUploading || createMaterial.isPending || updateMaterial.isPending) ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {isUploading ? "Загрузка..." : "Сохранение..."}
            </span>
          ) : (
            isEdit ? t("save") : t("add")
          )}
        </Button>
      </div>
    </form>
  );

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Материалы: {productTitle}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Add button */}
            {!isAdding && !editingId && (
              <Button onClick={() => setIsAdding(true)} variant="outline" className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Добавить материал
              </Button>
            )}

            {/* Add form */}
            {isAdding && (
              <Card>
                <CardContent className="pt-4">
                  <MaterialForm onSubmit={handleAdd} />
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
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>Материалов пока нет</p>
              </div>
            ) : (
              <div className="space-y-2">
                {materials.map((material, index) => (
                  <Card key={material.id}>
                    <CardContent className="p-3">
                      {editingId === material.id ? (
                        <MaterialForm onSubmit={handleUpdate} isEdit />
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="text-muted-foreground cursor-grab">
                            <GripVertical className="w-4 h-4" />
                          </div>
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            {getTypeIcon(material.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{material.title}</p>
                            <p className="text-xs text-muted-foreground">{getTypeLabel(material.type)}</p>
                          </div>
                          <div className="flex gap-1">
                            {material.file_url && (
                              <Button variant="ghost" size="icon" asChild>
                                <a href={material.file_url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="w-4 h-4" />
                                </a>
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
            <AlertDialogTitle>Удалить материал?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить "{deletingMaterial?.title}"?
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
