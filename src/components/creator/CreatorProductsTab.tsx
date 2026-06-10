import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { useCreatorProducts, useCreateProduct, useUpdateProduct, useDeleteProduct } from "@/hooks/useProducts";
import { useLanguage } from "@/contexts/LanguageContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Plus, Copy, Package, Loader2, Edit, Trash2, FileText } from "lucide-react";
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
import { uploadProductMedia, getVideoDuration, MAX_VIDEO_DURATION_SECONDS } from "@/lib/productMediaUpload";
import { ImageIcon, Video as VideoIcon, X as XIcon, HelpCircle } from "lucide-react";

interface Product {
  id: string;
  title: string;
  headline: string | null;
  description: string | null;
  price: number;
  kaspi_link: string | null;
  telegram_link: string | null;
  has_schedule: boolean;
  is_active: boolean;
  image_url?: string | null;
  video_url?: string | null;
  faq?: Array<{ question: string; answer: string }> | null;
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
  telegramLink: string;
  imageUrl: string;
  videoUrl: string;
  faq: Array<{ question: string; answer: string }>;
}

interface ProductFormProps {
  onSubmit: (e: React.FormEvent) => void;
  isEdit?: boolean;
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  isPending: boolean;
  t: (key: string) => string;
  editingProductId?: string | null;
}

const ProductForm = ({ onSubmit, isEdit = false, formData, setFormData, isPending, t, editingProductId }: ProductFormProps) => {
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !editingProductId) return;
    setUploadingImage(true);
    try {
      const url = await uploadProductMedia(file, editingProductId, "image");
      setFormData(prev => ({ ...prev, imageUrl: url }));
      toast.success("Изображение загружено");
    } catch (err: any) {
      toast.error(err?.message || "Ошибка загрузки изображения");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !editingProductId) return;
    setUploadingVideo(true);
    try {
      const duration = await getVideoDuration(file);
      if (duration > MAX_VIDEO_DURATION_SECONDS) {
        toast.error(`Видео слишком длинное (${Math.round(duration)} сек). Максимум 3 минуты.`);
        setUploadingVideo(false);
        return;
      }
      const url = await uploadProductMedia(file, editingProductId, "video");
      setFormData(prev => ({ ...prev, videoUrl: url }));
      toast.success("Видео загружено");
    } catch (err: any) {
      toast.error(err?.message || "Ошибка загрузки видео");
    } finally {
      setUploadingVideo(false);
    }
  };

  return (
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
    <div className="space-y-2">
      <Label htmlFor="telegramLink">Ссылка на группу/канал</Label>
      <Input 
        id="telegramLink" 
        type="url" 
        placeholder="https://t.me/... или https://discord.gg/..." 
        className="h-12"
        value={formData.telegramLink}
        onChange={(e) => setFormData(prev => ({ ...prev, telegramLink: e.target.value }))}
      />
      <p className="text-xs text-muted-foreground">
        Ссылка на группу или канал (Telegram, Discord и др.). Будет показана ученикам после покупки.
      </p>
    </div>

    {isEdit && editingProductId && (
      <>
        {/* Image upload */}
        <div className="space-y-2">
          <Label>Обложка (изображение)</Label>
          {formData.imageUrl ? (
            <div className="relative rounded-md overflow-hidden border border-border">
              <img src={formData.imageUrl} alt="cover" className="w-full max-h-48 object-cover" />
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="absolute top-2 right-2 h-7 w-7 p-0"
                onClick={() => setFormData(prev => ({ ...prev, imageUrl: "" }))}
              >
                <XIcon className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <label className="flex items-center justify-center gap-2 h-24 border-2 border-dashed border-border rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
              {uploadingImage ? (
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <ImageIcon className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Загрузить изображение</span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadingImage}
                onChange={handleImageChange}
              />
            </label>
          )}
          <p className="text-xs text-muted-foreground">JPG, PNG, WebP. До 15 МБ.</p>
        </div>

        {/* Video upload */}
        <div className="space-y-2">
          <Label>Видео-презентация (до 3 минут)</Label>
          {formData.videoUrl ? (
            <div className="relative rounded-md overflow-hidden border border-border">
              <video src={formData.videoUrl} controls playsInline preload="metadata" className="w-full max-h-56 bg-black" />
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="absolute top-2 right-2 h-7 w-7 p-0"
                onClick={() => setFormData(prev => ({ ...prev, videoUrl: "" }))}
              >
                <XIcon className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <label className="flex items-center justify-center gap-2 h-24 border-2 border-dashed border-border rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
              {uploadingVideo ? (
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <VideoIcon className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Загрузить видео</span>
                </>
              )}
              <input
                type="file"
                accept="video/*"
                className="hidden"
                disabled={uploadingVideo}
                onChange={handleVideoChange}
              />
            </label>
          )}
          <p className="text-xs text-muted-foreground">MP4, WebM, MOV. Длительность до 3 минут, размер до 250 МБ.</p>
        </div>
      </>
    )}

    {!isEdit && (
      <p className="text-xs text-muted-foreground">
        Изображение и видео можно добавить после создания продукта — откройте «Редактировать».
      </p>
    )}

    {/* FAQ editor */}
    <div className="space-y-3 pt-2 border-t border-border">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4" />
          Часто задаваемые вопросы
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setFormData(prev => ({
              ...prev,
              faq: [...prev.faq, { question: "", answer: "" }],
            }))
          }
        >
          <Plus className="w-4 h-4 mr-1" />
          Добавить
        </Button>
      </div>
      {formData.faq.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Добавьте вопросы и ответы — они появятся на странице продукта в виде раскрывающегося списка.
        </p>
      )}
      {formData.faq.map((item, idx) => (
        <div key={idx} className="space-y-2 rounded-md border border-border p-3 relative">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute top-1 right-1 h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            onClick={() =>
              setFormData(prev => ({
                ...prev,
                faq: prev.faq.filter((_, i) => i !== idx),
              }))
            }
          >
            <XIcon className="w-4 h-4" />
          </Button>
          <Input
            placeholder="Вопрос"
            className="h-10"
            value={item.question}
            onChange={e => {
              const v = e.target.value;
              setFormData(prev => ({
                ...prev,
                faq: prev.faq.map((it, i) => (i === idx ? { ...it, question: v } : it)),
              }));
            }}
          />
          <Textarea
            placeholder="Ответ"
            rows={3}
            value={item.answer}
            onChange={e => {
              const v = e.target.value;
              setFormData(prev => ({
                ...prev,
                faq: prev.faq.map((it, i) => (i === idx ? { ...it, answer: v } : it)),
              }));
            }}
          />
        </div>
      ))}
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
};

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
  
  const [formData, setFormData] = useState({
    title: "",
    headline: "",
    description: "",
    price: "",
    kaspiLink: "",
    telegramLink: "",
    imageUrl: "",
    videoUrl: "",
    faq: [] as Array<{ question: string; answer: string }>,
  });

  const resetForm = () => {
    setFormData({
      title: "",
      headline: "",
      description: "",
      price: "",
      kaspiLink: "",
      telegramLink: "",
      imageUrl: "",
      videoUrl: "",
      faq: [],
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
        telegram_link: formData.telegramLink || null,
        has_schedule: false,
        is_active: true,
        faq: formData.faq.filter(it => it.question.trim() || it.answer.trim()),
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
      telegramLink: product.telegram_link || "",
      imageUrl: product.image_url || "",
      videoUrl: product.video_url || "",
      faq: Array.isArray(product.faq) ? product.faq : [],
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
        telegram_link: formData.telegramLink || null,
        image_url: formData.imageUrl || null,
        video_url: formData.videoUrl || null,
        faq: formData.faq.filter(it => it.question.trim() || it.answer.trim()) as any,
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
            editingProductId={editingProduct?.id || null}
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
              <div className={`flex items-center justify-end ${isMobile ? "flex-wrap gap-1.5" : "gap-2 flex-wrap"}`}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMaterialsProduct({ id: product.id, title: product.title })}
                  className={isMobile ? "h-8 px-2 text-xs" : "h-9"}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span className="ml-1">{t("materials")}</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(`https://dostup.lovable.app/product/${product.id}`);
                    toast.success(language === "ru" ? "Ссылка скопирована!" : "Сілтеме көшірілді!");
                  }}
                  className={isMobile ? "h-8 px-2 text-xs" : "h-9"}
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span className="ml-1">{language === "ru" ? "Ссылка" : "Сілтеме"}</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(product)}
                  className={isMobile ? "h-8 px-2 text-xs" : "h-9"}
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span className="ml-1">{t("edit")}</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeletingProduct(product)}
                  className={`text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30 ${isMobile ? "h-8 px-2 text-xs" : "h-9"}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
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

  </div>
  );
};

export default CreatorProductsTab;
