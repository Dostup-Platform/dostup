import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { useCreatorProducts, useCreateProduct, useUpdateProduct, useDeleteProduct } from "@/hooks/useProducts";
import { useLanguage } from "@/contexts/LanguageContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Plus, Minus, Copy, Package, Loader2, Edit, Trash2, FileText, ChevronDown } from "lucide-react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import ProductMaterialsManager from "./ProductMaterialsManager";
import { uploadProductMedia, getVideoDuration, MAX_VIDEO_DURATION_SECONDS } from "@/lib/productMediaUpload";
import { ImageIcon, Video as VideoIcon, X as XIcon, HelpCircle, Play } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
  kaspi_phone?: string | null;
  access_duration_days?: number | null;
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
  isPaid: boolean;
  kaspiMethod: "link" | "phone";
  kaspiPhone: string;
  accessMode: "forever" | "limited";
  accessDurationDays: number;
}

interface ProductFormProps {
  onSubmit: (e: React.FormEvent) => void;
  isEdit?: boolean;
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  isPending: boolean;
  t: (key: string) => string;
  editingProductId?: string | null;
  pendingImageFile?: File | null;
  pendingVideoFile?: File | null;
  setPendingImageFile?: (f: File | null) => void;
  setPendingVideoFile?: (f: File | null) => void;
}

const ProductForm = ({
  onSubmit,
  isEdit = false,
  formData,
  setFormData,
  isPending,
  t,
  editingProductId,
  pendingImageFile,
  pendingVideoFile,
  setPendingImageFile,
  setPendingVideoFile,
}: ProductFormProps) => {
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [removeImageOpen, setRemoveImageOpen] = useState(false);
  const [removeVideoOpen, setRemoveVideoOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [isImageDragging, setIsImageDragging] = useState(false);
  const [isVideoDragging, setIsVideoDragging] = useState(false);

  // Object URL previews for pending files (create mode)
  const [pendingImagePreview, setPendingImagePreview] = useState<string>("");
  const [pendingVideoPreview, setPendingVideoPreview] = useState<string>("");

  useEffect(() => {
    if (pendingImageFile) {
      const url = URL.createObjectURL(pendingImageFile);
      setPendingImagePreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setPendingImagePreview("");
  }, [pendingImageFile]);

  useEffect(() => {
    if (pendingVideoFile) {
      const url = URL.createObjectURL(pendingVideoFile);
      setPendingVideoPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setPendingVideoPreview("");
  }, [pendingVideoFile]);


  const processImageFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Это не изображение");
      return;
    }
    if (!isEdit) {
      setPendingImageFile?.(file);
      return;
    }
    if (!editingProductId) return;
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

  const processVideoFile = async (file: File) => {
    if (!file.type.startsWith("video/")) {
      toast.error("Это не видео");
      return;
    }
    try {
      const duration = await getVideoDuration(file);
      if (duration > MAX_VIDEO_DURATION_SECONDS) {
        toast.error(`Видео слишком длинное (${Math.round(duration)} сек). Максимум 3 минуты.`);
        return;
      }
    } catch {
      toast.error("Не удалось прочитать видео");
      return;
    }
    if (!isEdit) {
      setPendingVideoFile?.(file);
      return;
    }
    if (!editingProductId) return;
    setUploadingVideo(true);
    try {
      const url = await uploadProductMedia(file, editingProductId, "video");
      setFormData(prev => ({ ...prev, videoUrl: url }));
      toast.success("Видео загружено");
    } catch (err: any) {
      toast.error(err?.message || "Ошибка загрузки видео");
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await processImageFile(file);
  };

  const handleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await processVideoFile(file);
  };

  const displayedImageUrl = formData.imageUrl || pendingImagePreview;
  const displayedVideoUrl = formData.videoUrl || pendingVideoPreview;

  // Paste support: listen on window while at least one slot is empty.
  useEffect(() => {
    const imageEmpty = !displayedImageUrl;
    const videoEmpty = !displayedVideoUrl;
    if (!imageEmpty && !videoEmpty) return;

    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      // Don't hijack paste in inputs/textareas/contenteditable
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return;
      }
      const files = e.clipboardData?.files;
      if (!files || files.length === 0) return;
      const filesArr = Array.from(files);
      const imgFile = filesArr.find(f => f.type.startsWith("image/"));
      const vidFile = filesArr.find(f => f.type.startsWith("video/"));
      if (imageEmpty && imgFile) {
        e.preventDefault();
        void processImageFile(imgFile);
        return;
      }
      if (videoEmpty && vidFile) {
        e.preventDefault();
        void processVideoFile(vidFile);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayedImageUrl, displayedVideoUrl, isEdit, editingProductId]);

  const clearImage = () => {
    setFormData(prev => ({ ...prev, imageUrl: "" }));
    setPendingImageFile?.(null);
    setRemoveImageOpen(false);
  };
  const clearVideo = () => {
    setFormData(prev => ({ ...prev, videoUrl: "" }));
    setPendingVideoFile?.(null);
    setRemoveVideoOpen(false);
    setVideoPlaying(false);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Auto-open sections containing required-but-empty fields
    if (!formData.title) {
      setDetailsOpen(true);
    }
    if (formData.isPaid && !formData.price) {
      setPaymentOpen(true);
    }
    onSubmit(e);
  };

  const SectionHeader = ({
    label,
    open,
  }: { label: string; open: boolean }) => (
    <CollapsibleTrigger asChild>
      <button
        type="button"
        className="flex items-center justify-between w-full px-4 py-3 bg-muted/40 hover:bg-muted/60 rounded-md border border-border transition-colors"
      >
        <span className="font-medium text-foreground">{label}</span>
        {open ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
      </button>
    </CollapsibleTrigger>
  );

  const durationPresets = [
    { label: "7 дней", value: 7 },
    { label: "2 недели", value: 14 },
    { label: "1 месяц", value: 30 },
  ];

  return (
  <form onSubmit={handleFormSubmit} className="space-y-4 mt-4">
    {/* ============ ДЕТАЛИ ============ */}
    <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
      <SectionHeader label="Детали" open={detailsOpen} />
      <CollapsibleContent className="space-y-4 pt-4">
        {/* Image upload */}
        <div className="space-y-2">
          <Label>Обложка (изображение)</Label>
          {displayedImageUrl ? (
            <div className="relative rounded-md overflow-hidden border border-border">
              <img src={displayedImageUrl} alt="cover" className="w-full max-h-48 object-cover" />
              <AlertDialog open={removeImageOpen} onOpenChange={setRemoveImageOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2 h-7 w-7 p-0"
                  >
                    <XIcon className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Удалить обложку?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Вы уверены, что хотите удалить изображение продукта? Это действие нельзя отменить.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setRemoveImageOpen(false)}>Отмена</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={clearImage}
                    >
                      Удалить
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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
          {displayedVideoUrl ? (
            <div className="relative rounded-md overflow-hidden border border-border">
              <video src={displayedVideoUrl} controls playsInline preload="metadata" className="w-full max-h-56 bg-black" />
              <AlertDialog open={removeVideoOpen} onOpenChange={setRemoveVideoOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2 h-7 w-7 p-0"
                  >
                    <XIcon className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Удалить видео?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Вы уверены, что хотите удалить видео продукта? Это действие нельзя отменить.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setRemoveVideoOpen(false)}>Отмена</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={clearVideo}
                    >
                      Удалить
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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

        {/* Title */}
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

        {/* Headline */}
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

        {/* Description */}
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

        {/* FAQ editor (внутри Деталей) */}
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
      </CollapsibleContent>
    </Collapsible>

    {/* ============ ОПЛАТА ============ */}
    <Collapsible open={paymentOpen} onOpenChange={setPaymentOpen}>
      <SectionHeader label="Оплата" open={paymentOpen} />
      <CollapsibleContent className="space-y-4 pt-4">
        {/* Free / Paid */}
        <div className="space-y-2">
          <Label>Как люди получат доступ?</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={formData.isPaid ? "outline" : "default"}
              onClick={() => setFormData(prev => ({ ...prev, isPaid: false }))}
            >
              Бесплатно
            </Button>
            <Button
              type="button"
              variant={formData.isPaid ? "default" : "outline"}
              onClick={() => setFormData(prev => ({ ...prev, isPaid: true }))}
            >
              Платно
            </Button>
          </div>
        </div>

        {formData.isPaid && (
          <>
            <div className="space-y-2">
              <Label htmlFor="price">Цена (тенге) *</Label>
              <Input
                id="price"
                type="number"
                placeholder="49000"
                className="h-12"
                value={formData.price}
                onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                required={formData.isPaid}
              />
            </div>

            <div className="space-y-2">
              <Label>Способ оплаты через Kaspi</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={formData.kaspiMethod === "link" ? "default" : "outline"}
                  onClick={() => setFormData(prev => ({ ...prev, kaspiMethod: "link" }))}
                >
                  Ссылка
                </Button>
                <Button
                  type="button"
                  variant={formData.kaspiMethod === "phone" ? "default" : "outline"}
                  onClick={() => setFormData(prev => ({ ...prev, kaspiMethod: "phone" }))}
                >
                  Номер телефона
                </Button>
              </div>
              {formData.kaspiMethod === "link" ? (
                <Input
                  type="url"
                  placeholder={t("kaspiLinkPlaceholder")}
                  className="h-12"
                  value={formData.kaspiLink}
                  onChange={(e) => setFormData(prev => ({ ...prev, kaspiLink: e.target.value }))}
                />
              ) : (
                <Input
                  type="tel"
                  placeholder="+7 700 000 00 00"
                  className="h-12"
                  value={formData.kaspiPhone}
                  onChange={(e) => setFormData(prev => ({ ...prev, kaspiPhone: e.target.value }))}
                />
              )}
            </div>
          </>
        )}

        {/* Access duration */}
        <div className="space-y-2 pt-2 border-t border-border">
          <Label>Доступ к продукту</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={formData.accessMode === "forever" ? "default" : "outline"}
              onClick={() => setFormData(prev => ({ ...prev, accessMode: "forever" }))}
            >
              Навсегда
            </Button>
            <Button
              type="button"
              variant={formData.accessMode === "limited" ? "default" : "outline"}
              onClick={() => setFormData(prev => ({ ...prev, accessMode: "limited" }))}
            >
              На время
            </Button>
          </div>

          {formData.accessMode === "limited" && (
            <div className="space-y-2 pt-2">
              <div className="flex flex-wrap gap-2">
                {durationPresets.map(p => (
                  <Button
                    key={p.value}
                    type="button"
                    size="sm"
                    variant={formData.accessDurationDays === p.value ? "default" : "outline"}
                    onClick={() => setFormData(prev => ({ ...prev, accessDurationDays: p.value }))}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="customDays" className="text-xs text-muted-foreground whitespace-nowrap">
                  Своё число дней:
                </Label>
                <Input
                  id="customDays"
                  type="number"
                  min={1}
                  className="h-10 w-28"
                  value={formData.accessDurationDays || ""}
                  onChange={(e) =>
                    setFormData(prev => ({
                      ...prev,
                      accessDurationDays: Number(e.target.value) || 0,
                    }))
                  }
                />
                <span className="text-xs text-muted-foreground">дн.</span>
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>

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
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [pendingVideoFile, setPendingVideoFile] = useState<File | null>(null);
  
  const [formData, setFormData] = useState<FormData>({
    title: "",
    headline: "",
    description: "",
    price: "",
    kaspiLink: "",
    telegramLink: "",
    imageUrl: "",
    videoUrl: "",
    faq: [] as Array<{ question: string; answer: string }>,
    isPaid: true,
    kaspiMethod: "link",
    kaspiPhone: "",
    accessMode: "forever",
    accessDurationDays: 14,
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
      isPaid: true,
      kaspiMethod: "link",
      kaspiPhone: "",
      accessMode: "forever",
      accessDurationDays: 14,
    });
    setPendingImageFile(null);
    setPendingVideoFile(null);
  };

  // copyLink function removed - now using ShareLinkDialog for all link copying

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || (formData.isPaid && !formData.price)) {
      toast.error("Заполните обязательные поля");
      return;
    }

    try {
      const created = await createProduct.mutateAsync({
        title: formData.title,
        headline: formData.headline || null,
        description: formData.description || null,
        price: formData.isPaid ? Number(formData.price) : 0,
        kaspi_link: formData.isPaid && formData.kaspiMethod === "link" ? (formData.kaspiLink || null) : null,
        kaspi_phone: formData.isPaid && formData.kaspiMethod === "phone" ? (formData.kaspiPhone || null) : null,
        telegram_link: null,
        access_duration_days: formData.accessMode === "limited" ? (formData.accessDurationDays || null) : null,
        has_schedule: false,
        is_active: true,
        faq: formData.faq.filter(it => it.question.trim() || it.answer.trim()),
      });

      // Upload pending media (if any)
      let imageUrl: string | null = null;
      let videoUrl: string | null = null;
      if (pendingImageFile && created?.id) {
        try {
          imageUrl = await uploadProductMedia(pendingImageFile, created.id, "image");
        } catch (err: any) {
          toast.error(err?.message || "Ошибка загрузки изображения. Можно догрузить в редакторе.");
        }
      }
      if (pendingVideoFile && created?.id) {
        try {
          videoUrl = await uploadProductMedia(pendingVideoFile, created.id, "video");
        } catch (err: any) {
          toast.error(err?.message || "Ошибка загрузки видео. Можно догрузить в редакторе.");
        }
      }
      if ((imageUrl || videoUrl) && created?.id) {
        try {
          await updateProduct.mutateAsync({
            id: created.id,
            ...(imageUrl ? { image_url: imageUrl } : {}),
            ...(videoUrl ? { video_url: videoUrl } : {}),
          });
        } catch {
          // already toasted above
        }
      }

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
      isPaid: Number(product.price) > 0,
      kaspiMethod: product.kaspi_phone ? "phone" : "link",
      kaspiPhone: product.kaspi_phone || "",
      accessMode: product.access_duration_days ? "limited" : "forever",
      accessDurationDays: product.access_duration_days || 14,
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingProduct || !formData.title || (formData.isPaid && !formData.price)) {
      toast.error("Заполните обязательные поля");
      return;
    }

    try {
      await updateProduct.mutateAsync({
        id: editingProduct.id,
        title: formData.title,
        headline: formData.headline || null,
        description: formData.description || null,
        price: formData.isPaid ? Number(formData.price) : 0,
        kaspi_link: formData.isPaid && formData.kaspiMethod === "link" ? (formData.kaspiLink || null) : null,
        kaspi_phone: formData.isPaid && formData.kaspiMethod === "phone" ? (formData.kaspiPhone || null) : null,
        access_duration_days: formData.accessMode === "limited" ? (formData.accessDurationDays || null) : null,
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
              pendingImageFile={pendingImageFile}
              pendingVideoFile={pendingVideoFile}
              setPendingImageFile={setPendingImageFile}
              setPendingVideoFile={setPendingVideoFile}
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
