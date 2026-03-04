import { useQuery } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { requestMaterialToken, buildProxyUrl } from "@/lib/materialToken";
import { isS3Path, isOfficeDocument, buildS3RedirectUrl, buildStorageRedirectUrl, parseStoragePath } from "@/lib/fileRedirect";
import { useLanguage } from "@/contexts/LanguageContext";
import { FileText, ExternalLink, Loader2, Video, Link as LinkIcon, Folder, Download, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import TeacherMaterialsManager from "./TeacherMaterialsManager";

interface TeacherMaterialsTabProps {
  productIds: string[];
  teacherName?: string;
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
  teacher_allow_download?: boolean;
}

const TeacherMaterialsTab = ({ productIds, teacherName }: TeacherMaterialsTabProps) => {
  const { language } = useLanguage();
  const [creatorMaterialsOpen, setCreatorMaterialsOpen] = useState(true);
  const [myMaterialsOpen, setMyMaterialsOpen] = useState(true);

  // Get teacher's user ID
  const { data: teacherUser } = useQuery({
    queryKey: ["teacher-user-id", teacherName],
    queryFn: async () => {
      if (!teacherName) return null;
      const { data } = await supabase
        .from("simple_users")
        .select("id")
        .eq("name", teacherName)
        .eq("role", "teacher")
        .maybeSingle();
      return data;
    },
    enabled: !!teacherName,
  });

  // Get products info
  const { data: products = [] } = useQuery({
    queryKey: ["teacher-products-info", productIds],
    queryFn: async () => {
      if (!productIds.length) return [];
      const { data, error } = await supabase
        .from("products")
        .select("id, title")
        .in("id", productIds);
      if (error) throw error;
      return data || [];
    },
    enabled: productIds.length > 0,
  });

  // Get creator materials (materials without teacher_id)
  const { data: creatorMaterials = [], isLoading: creatorLoading } = useQuery({
    queryKey: ["teacher-creator-materials", productIds],
    queryFn: async () => {
      if (!productIds.length) return [];

      const { data, error } = await supabase
        .from("materials")
        .select("id, title, type, content, file_url, product_id, allow_view, allow_download, teacher_allow_download")
        .in("product_id", productIds)
        .is("teacher_id", null)
        .order("order_index");

      if (error) throw error;

      const { data: productsData } = await supabase
        .from("products")
        .select("id, title")
        .in("id", productIds);

      return (data || []).map(m => ({
        ...m,
        product: productsData?.find(p => p.id === m.product_id),
      })) as Material[];
    },
    enabled: productIds.length > 0,
  });

  const groupedCreatorMaterials = creatorMaterials.reduce((acc, material) => {
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

  /**
   * Get a synchronous URL for file download/view.
   * Returns null for Office docs in view mode (needs async token flow).
   */
  const getFileUrl = useCallback((material: { file_url: string; title: string }, action: 'view' | 'download'): string | null => {
    if (!material.file_url) return null;

    if (isS3Path(material.file_url)) {
      if (action === 'view' && isOfficeDocument(material.title)) return null;
      return buildS3RedirectUrl(
        material.file_url, 'teacher', teacherUser?.id,
        action === 'download' ? material.title : undefined
      );
    } else {
      const path = parseStoragePath(material.file_url);
      if (!path) return null;
      return buildStorageRedirectUrl(path, action === 'download' ? material.title : undefined);
    }
  }, [teacherUser?.id]);

  const handleOfficeView = useCallback(async (material: { file_url: string; title: string }) => {
    const loadingToast = toast.loading(language === "ru" ? "Подготовка файла..." : "Файл дайындалуда...");
    try {
      const token = await requestMaterialToken(material.file_url, 'teacher', teacherUser?.id);
      const proxyUrl = buildProxyUrl(token);
      const viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(proxyUrl)}`;
      window.open(viewerUrl, '_blank');
    } catch (err) {
      console.error('Error opening office doc:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      toast.error(language === "ru" ? `Ошибка: ${errMsg}` : `Қате: ${errMsg}`);
    } finally {
      toast.dismiss(loadingToast);
    }
  }, [language, teacherUser?.id]);

  if (creatorLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* My Materials Section - Teacher can manage */}
      <Collapsible open={myMaterialsOpen} onOpenChange={setMyMaterialsOpen}>
        <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent hover:text-foreground">
            <h2 className="text-lg font-semibold">
              {language === "ru" ? "Мои материалы" : "Менің материалдарым"}
            </h2>
            {myMaterialsOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4">
          <p className="text-sm text-muted-foreground mb-4">
            {language === "ru" 
              ? "Материалы, которые вы добавляете, будут доступны только вашим ученикам"
              : "Сіз қосқан материалдар тек сіздің оқушыларыңызға қол жетімді болады"}
          </p>
          
          {teacherUser?.id && products.length > 0 ? (
            <div className="space-y-6">
              {products.map(product => (
                <Card key={product.id}>
                  <CardContent className="p-4">
                    <TeacherMaterialsManager
                      teacherId={teacherUser.id}
                      productId={product.id}
                      productTitle={product.title}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {language === "ru" ? "Нет доступных продуктов" : "Қолжетімді өнімдер жоқ"}
              </p>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Creator Materials Section - Read only */}
      <Collapsible open={creatorMaterialsOpen} onOpenChange={setCreatorMaterialsOpen}>
        <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent hover:text-foreground">
            <h2 className="text-lg font-semibold">
              {language === "ru" ? "Материалы автора" : "Автор материалдары"}
            </h2>
            {creatorMaterialsOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4">
          <p className="text-sm text-muted-foreground mb-4">
            {language === "ru" 
              ? "Только просмотр. Редактирование доступно автору курса."
              : "Тек қарау. Өңдеу курс авторына қолжетімді."}
          </p>

          {creatorMaterials.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                {language === "ru" ? "Материалов автора пока нет" : "Автор материалдары әзірше жоқ"}
              </p>
            </div>
          ) : (
            Object.entries(groupedCreatorMaterials).map(([productTitle, productMaterials]) => (
              <div key={productTitle} className="space-y-3 mb-4">
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
                                title={language === "ru" ? "Открыть ссылку" : "Сілтемені ашу"}
                              >
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            )}
                            {material.type === "file" && material.file_url && (() => {
                              const dlUrl = material.teacher_allow_download !== false 
                                ? getFileUrl({ file_url: material.file_url!, title: material.title }, 'download') 
                                : null;
                              const vUrl = getFileUrl({ file_url: material.file_url!, title: material.title }, 'view');
                              const needsOffice = isOfficeDocument(material.title) && isS3Path(material.file_url!);
                              return (
                                <>
                                  {dlUrl && (
                                    <a
                                      href={dlUrl}
                                      className="inline-flex items-center justify-center rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground h-10 w-10"
                                      title={language === "ru" ? "Скачать" : "Жүктеу"}
                                    >
                                      <Download className="w-4 h-4" />
                                    </a>
                                  )}
                                  {vUrl ? (
                                    <a
                                      href={vUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center justify-center rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground h-10 w-10"
                                      title={language === "ru" ? "Открыть в браузере" : "Браузерде ашу"}
                                    >
                                      <ExternalLink className="w-4 h-4" />
                                    </a>
                                  ) : needsOffice ? (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleOfficeView({ file_url: material.file_url!, title: material.title })}
                                      title={language === "ru" ? "Открыть в браузере" : "Браузерде ашу"}
                                    >
                                      <ExternalLink className="w-4 h-4" />
                                    </Button>
                                  ) : null}
                                </>
                              );
                            })()}
                            {material.type === "video" && material.file_url && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => window.open(material.file_url!, "_blank")}
                                title={language === "ru" ? "Открыть видео" : "Бейнені ашу"}
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
            ))
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default TeacherMaterialsTab;
