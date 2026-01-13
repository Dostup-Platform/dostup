import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useCreatorProducts, useCreateProduct, useUpdateProduct, useDeleteProduct } from "@/hooks/useProducts";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Plus, Copy, ExternalLink, Package, Loader2, Edit, Trash2, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { toast } from "sonner";
import ProductMaterialsManager from "./ProductMaterialsManager";

interface Product {
  id: string;
  title: string;
  headline: string | null;
  description: string | null;
  price: number;
  kaspi_link: string | null;
  has_schedule: boolean;
  is_active: boolean;
}

const formatPrice = (price: number, currency: string = "KZT") => {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 0,
  }).format(price);
};

const CreatorProductsTab = () => {
  const { user } = useSimpleAuth();
  const { t } = useLanguage();
  const { data: products = [], isLoading } = useCreatorProducts();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  
  const [isCreating, setIsCreating] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [materialsProduct, setMaterialsProduct] = useState<{ id: string; title: string } | null>(null);
  
  const [formData, setFormData] = useState({
    title: "",
    headline: "",
    description: "",
    price: "",
    kaspiLink: "",
    hasSchedule: false,
  });

  const resetForm = () => {
    setFormData({
      title: "",
      headline: "",
      description: "",
      price: "",
      kaspiLink: "",
      hasSchedule: false,
    });
  };

  const copyLink = (productId: string) => {
    const link = `${window.location.origin}/product/${productId}`;
    navigator.clipboard.writeText(link);
    toast.success(t("linkCopied"));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.price) {
      toast.error("Заполните обязательные поля");
      return;
    }

    try {
      await createProduct.mutateAsync({
        title: formData.title,
        headline: formData.headline || null,
        description: formData.description || null,
        price: Number(formData.price),
        kaspi_link: formData.kaspiLink || null,
        has_schedule: formData.hasSchedule,
        is_active: true,
      });
      
      toast.success("Продукт создан!");
      setIsCreating(false);
      resetForm();
    } catch (error) {
      toast.error("Ошибка при создании продукта");
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      title: product.title,
      headline: product.headline || "",
      description: product.description || "",
      price: String(product.price),
      kaspiLink: product.kaspi_link || "",
      hasSchedule: product.has_schedule,
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingProduct || !formData.title || !formData.price) {
      toast.error("Заполните обязательные поля");
      return;
    }

    try {
      await updateProduct.mutateAsync({
        id: editingProduct.id,
        title: formData.title,
        headline: formData.headline || null,
        description: formData.description || null,
        price: Number(formData.price),
        kaspi_link: formData.kaspiLink || null,
        has_schedule: formData.hasSchedule,
      });
      
      toast.success("Продукт обновлён!");
      setEditingProduct(null);
      resetForm();
    } catch (error) {
      toast.error("Ошибка при обновлении продукта");
    }
  };

  const handleDelete = async () => {
    if (!deletingProduct) return;

    try {
      await deleteProduct.mutateAsync(deletingProduct.id);
      toast.success("Продукт удалён!");
      setDeletingProduct(null);
    } catch (error) {
      toast.error("Ошибка при удалении продукта");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const ProductForm = ({ onSubmit, isEdit = false }: { onSubmit: (e: React.FormEvent) => void; isEdit?: boolean }) => (
    <form onSubmit={onSubmit} className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label htmlFor="title">Название *</Label>
        <Input 
          id="title" 
          placeholder="Название курса" 
          className="h-12"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="headline">Краткое описание</Label>
        <Input 
          id="headline" 
          placeholder="Что получит пользователь" 
          className="h-12"
          value={formData.headline}
          onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Полное описание</Label>
        <Textarea 
          id="description" 
          placeholder="Подробное описание курса" 
          rows={4}
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="price">Цена (тенге) *</Label>
        <Input 
          id="price" 
          type="number" 
          placeholder="49000" 
          className="h-12"
          value={formData.price}
          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="kaspiLink">{t("kaspiLink")}</Label>
        <Input 
          id="kaspiLink" 
          type="url" 
          placeholder={t("kaspiLinkPlaceholder")} 
          className="h-12"
          value={formData.kaspiLink}
          onChange={(e) => setFormData({ ...formData, kaspiLink: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Ссылка на оплату через Kaspi.kz
        </p>
      </div>
      <div className="flex items-center justify-between py-2">
        <div>
          <Label htmlFor="schedule">Включить расписание</Label>
          <p className="text-sm text-muted-foreground">Позволит записываться на сессии</p>
        </div>
        <Switch 
          id="schedule"
          checked={formData.hasSchedule}
          onCheckedChange={(checked) => setFormData({ ...formData, hasSchedule: checked })}
        />
      </div>
      <Button 
        type="submit" 
        variant="cta" 
        className="w-full"
        disabled={isEdit ? updateProduct.isPending : createProduct.isPending}
      >
        {(isEdit ? updateProduct.isPending : createProduct.isPending) ? (
          <span className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            {isEdit ? "Сохранение..." : "Создание..."}
          </span>
        ) : (
          isEdit ? "Сохранить изменения" : "Создать продукт"
        )}
      </Button>
    </form>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{t("products")}</h2>
        <Dialog open={isCreating} onOpenChange={(open) => { setIsCreating(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button variant="default" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              {t("create")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Создать продукт</DialogTitle>
            </DialogHeader>
            <ProductForm onSubmit={handleCreate} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={(open) => { if (!open) { setEditingProduct(null); resetForm(); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("edit")} продукт</DialogTitle>
          </DialogHeader>
          <ProductForm onSubmit={handleUpdate} isEdit />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingProduct} onOpenChange={(open) => { if (!open) setDeletingProduct(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить продукт?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить "{deletingProduct?.title}"? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteProduct.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                t("delete")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Products List */}
      <div className="space-y-4">
        {products.map((product) => (
          <Card key={product.id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground">{product.title}</h3>
                  {product.headline && (
                    <p className="text-sm text-muted-foreground mt-1">{product.headline}</p>
                  )}
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <span className="text-lg font-bold text-primary">
                      {formatPrice(Number(product.price))}
                    </span>
                    {product.has_schedule && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                        Расписание
                      </span>
                    )}
                    {product.kaspi_link && (
                      <span className="text-xs bg-success/10 text-success px-2 py-1 rounded-full">
                        Kaspi
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setMaterialsProduct({ id: product.id, title: product.title })}
                    title={t("materials")}
                  >
                    <FileText className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(product)}
                    title={t("edit")}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyLink(product.id)}
                    title={t("copyLink")}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" asChild title={t("view")}>
                    <a href={`/product/${product.id}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeletingProduct(product)}
                    title={t("delete")}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {products.length === 0 && (
        <div className="text-center py-12">
          <Package className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-muted-foreground">{t("noProducts")}</p>
          <Button variant="default" className="mt-4" onClick={() => setIsCreating(true)}>
          {t("createFirstProduct")}
        </Button>
      </div>
    )}

    {/* Materials Manager */}
    {materialsProduct && (
      <ProductMaterialsManager
        productId={materialsProduct.id}
        productTitle={materialsProduct.title}
        isOpen={!!materialsProduct}
        onClose={() => setMaterialsProduct(null)}
      />
    )}
  </div>
  );
};

export default CreatorProductsTab;
