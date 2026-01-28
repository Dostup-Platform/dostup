import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { useCreatorProducts, useCreateProduct, useUpdateProduct, useDeleteProduct } from "@/hooks/useProducts";
import { useLanguage } from "@/contexts/LanguageContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Plus, Copy, ExternalLink, Package, Loader2, Edit, Trash2, FileText, Users } from "lucide-react";
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
import ProductTeachersManager from "./ProductTeachersManager";
import ShareLinkDialog from "./ShareLinkDialog";

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

interface FormData {
  title: string;
  headline: string;
  description: string;
  price: string;
  kaspiLink: string;
}

interface ProductFormProps {
  onSubmit: (e: React.FormEvent) => void;
  isEdit?: boolean;
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  isPending: boolean;
  t: (key: string) => string;
}

const ProductForm = ({ onSubmit, isEdit = false, formData, setFormData, isPending, t }: ProductFormProps) => (
  <form onSubmit={onSubmit} className="space-y-4 mt-4">
    <div className="space-y-2">
      <Label htmlFor="title">Название *</Label>
      <Input 
        id="title" 
        placeholder="Название курса" 
        className="h-12"
        value={formData.title}
        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
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
        onChange={(e) => setFormData(prev => ({ ...prev, headline: e.target.value }))}
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="description">Полное описание</Label>
      <Textarea 
        id="description" 
        placeholder="Подробное описание курса" 
        rows={4}
        value={formData.description}
        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
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
        onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
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
        onChange={(e) => setFormData(prev => ({ ...prev, kaspiLink: e.target.value }))}
      />
      <p className="text-xs text-muted-foreground">
        Ссылка на оплату через Kaspi.kz
      </p>
    </div>
    <Button 
      type="submit" 
      variant="cta" 
      className="w-full"
      disabled={isPending}
    >
      {isPending ? (
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

interface CreatorProductsTabProps {
  creatorName: string;
}

const CreatorProductsTab = ({ creatorName }: CreatorProductsTabProps) => {
  const { t, language } = useLanguage();
  const isMobile = useIsMobile();
  const { data: products = [], isLoading } = useCreatorProducts(creatorName);
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  
  const [isCreating, setIsCreating] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [materialsProduct, setMaterialsProduct] = useState<{ id: string; title: string } | null>(null);
  const [teachersProduct, setTeachersProduct] = useState<{ id: string; title: string } | null>(null);
  const [shareProduct, setShareProduct] = useState<{ id: string; title: string } | null>(null);
  
  const [formData, setFormData] = useState({
    title: "",
    headline: "",
    description: "",
    price: "",
    kaspiLink: "",
  });

  const resetForm = () => {
    setFormData({
      title: "",
      headline: "",
      description: "",
      price: "",
      kaspiLink: "",
    });
  };

  // copyLink function removed - now using ShareLinkDialog for all link copying

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
        has_schedule: false,
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
            <ProductForm 
              onSubmit={handleCreate} 
              formData={formData}
              setFormData={setFormData}
              isPending={createProduct.isPending}
              t={t}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={(open) => { if (!open) { setEditingProduct(null); resetForm(); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("edit")} продукт</DialogTitle>
          </DialogHeader>
          <ProductForm 
            onSubmit={handleUpdate} 
            isEdit 
            formData={formData}
            setFormData={setFormData}
            isPending={updateProduct.isPending}
            t={t}
          />
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
      <div className="space-y-3">
        {products.map((product) => (
          <Card key={product.id} className="overflow-hidden">
            <CardContent className={isMobile ? "p-3" : "p-4"}>
              {/* Header: title + price */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className={`font-semibold text-foreground ${isMobile ? "text-sm line-clamp-2" : "text-base"}`}>{product.title}</h3>
                  {product.headline && (
                    <p className={`text-muted-foreground mt-0.5 ${isMobile ? "text-xs line-clamp-1" : "text-sm"}`}>{product.headline}</p>
                  )}
                </div>
                <span className={`font-bold text-primary whitespace-nowrap ${isMobile ? "text-sm" : "text-base"}`}>
                  {formatPrice(Number(product.price))}
                </span>
              </div>
              
              {/* Badges */}
              <div className="flex items-center gap-1.5 mb-3">
                {product.has_schedule && (
                  <span className={`bg-primary/10 text-primary px-2 py-0.5 rounded-full ${isMobile ? "text-[10px]" : "text-xs"}`}>
                    {language === "ru" ? "Расписание" : "Кесте"}
                  </span>
                )}
                {product.kaspi_link && (
                  <span className={`bg-success/10 text-success px-2 py-0.5 rounded-full ${isMobile ? "text-[10px]" : "text-xs"}`}>
                    Kaspi
                  </span>
                )}
              </div>
              
              {/* Actions */}
              <div className={`flex items-center ${isMobile ? "gap-1 overflow-x-auto scrollbar-hide -mx-1 px-1" : "gap-2 flex-wrap"}`}>
                <Button
                  variant={isMobile ? "ghost" : "outline"}
                  size="sm"
                  onClick={() => setMaterialsProduct({ id: product.id, title: product.title })}
                  className={isMobile ? "h-8 px-2 flex-shrink-0" : "h-9"}
                >
                  <FileText className="w-4 h-4" />
                  {!isMobile && <span className="ml-2">{t("materials")}</span>}
                </Button>
                <Button
                  variant={isMobile ? "ghost" : "outline"}
                  size="sm"
                  onClick={() => setTeachersProduct({ id: product.id, title: product.title })}
                  className={isMobile ? "h-8 px-2 flex-shrink-0" : "h-9"}
                >
                  <Users className="w-4 h-4" />
                  {!isMobile && <span className="ml-2">{language === "ru" ? "Учителя" : "Мұғалімдер"}</span>}
                </Button>
                <Button
                  variant={isMobile ? "ghost" : "outline"}
                  size="sm"
                  onClick={() => setShareProduct({ id: product.id, title: product.title })}
                  className={isMobile ? "h-8 px-2 flex-shrink-0" : "h-9"}
                >
                  <Copy className="w-4 h-4" />
                  {!isMobile && <span className="ml-2">{language === "ru" ? "Ссылка" : "Сілтеме"}</span>}
                </Button>
                {!isMobile && (
                  <Button variant="outline" size="sm" asChild className="h-9">
                    <a href={`/product/${product.id}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4" />
                      <span className="ml-2">{language === "ru" ? "Открыть" : "Ашу"}</span>
                    </a>
                  </Button>
                )}
                <Button
                  variant={isMobile ? "ghost" : "outline"}
                  size="sm"
                  onClick={() => handleEdit(product)}
                  className={isMobile ? "h-8 px-2 flex-shrink-0" : "h-9"}
                >
                  <Edit className="w-4 h-4" />
                  {!isMobile && <span className="ml-2">{t("edit")}</span>}
                </Button>
                <Button
                  variant={isMobile ? "ghost" : "outline"}
                  size="sm"
                  onClick={() => setDeletingProduct(product)}
                  className={`text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30 ${isMobile ? "h-8 px-2 flex-shrink-0" : "h-9"}`}
                >
                  <Trash2 className="w-4 h-4" />
                  {!isMobile && <span className="ml-2">{t("delete")}</span>}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {products.length === 0 && (
        <div className="text-center py-12">
          <Package className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-muted-foreground">{t("noProducts")}</p>
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

    {/* Teachers Manager */}
    {teachersProduct && (
      <ProductTeachersManager
        productId={teachersProduct.id}
        productTitle={teachersProduct.title}
        isOpen={!!teachersProduct}
        onClose={() => setTeachersProduct(null)}
      />
    )}

    {/* Share Link Dialog */}
    {shareProduct && (
      <ShareLinkDialog
        productId={shareProduct.id}
        productTitle={shareProduct.title}
        isOpen={!!shareProduct}
        onClose={() => setShareProduct(null)}
      />
    )}

  </div>
  );
};

export default CreatorProductsTab;
